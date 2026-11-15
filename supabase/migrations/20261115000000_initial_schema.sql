-- SideQuest: Toys and Figures — initial database schema.
--
-- Sign-in is not built yet, so for now every table is readable and writable
-- with the project's publishable key (see the "open access" policies below).
-- The schema is already shaped for sign-in: every row-owning table has a
-- `user_id` column that fills itself from the signed-in user, and row level
-- security is switched on. When sign-in is added, apply
-- `supabase/auth/enable_auth.sql` to replace the open policies with
-- per-owner ones.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.toys (
  id uuid primary key default gen_random_uuid(),
  -- Owner. Null until sign-in exists; defaults to the signed-in user after.
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  sku text not null default '',
  manufacturer text not null default '',
  category text not null check (category in ('Figures', 'Plush', 'Model Kits', 'Collectibles')),
  -- Paths of the toy's pictures in the "toy-images" storage bucket; the first is the cover.
  images text[] not null default '{}',
  -- Total stock (all qualities) at or below this counts as "low".
  reorder_level integer not null default 5 check (reorder_level >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- One row per quality a toy comes in, each with its own price and stock.
create table public.toy_qualities (
  toy_id uuid not null references public.toys (id) on delete cascade,
  quality text not null check (quality in ('MISB', 'MIB', 'BIB', 'Loose', 'Damaged')),
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) not null check (cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  -- Display order within the toy.
  position smallint not null default 0,
  primary key (toy_id, quality)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in ('sale', 'refund', 'restock')),
  -- Becomes null if the toy is deleted; toy_name keeps the record readable.
  toy_id uuid references public.toys (id) on delete set null,
  toy_name text not null,
  quality text not null check (quality in ('MISB', 'MIB', 'BIB', 'Loose', 'Damaged')),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  -- quantity × unit_price, always positive.
  amount numeric(12, 2) not null check (amount >= 0),
  payment text not null check (payment in ('Cash', 'Card', 'E-wallet', 'Bank transfer')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  date date not null default current_date,
  category text not null check (
    category in ('Rent', 'Utilities', 'Wages', 'Marketing', 'Shipping', 'Supplies', 'Maintenance', 'Other')
  ),
  vendor text not null default '',
  description text not null default '',
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index toys_user_id_idx on public.toys (user_id);
create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_toy_id_idx on public.transactions (toy_id);
create index transactions_date_idx on public.transactions (date desc);
create index expenses_user_id_idx on public.expenses (user_id);
create index expenses_date_idx on public.expenses (date desc);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.toys, public.toy_qualities, public.transactions, public.expenses
  to anon, authenticated;

alter table public.toys enable row level security;
alter table public.toy_qualities enable row level security;
alter table public.transactions enable row level security;
alter table public.expenses enable row level security;

-- TEMPORARY: anyone holding the publishable key can read and change everything.
-- Replaced by per-owner policies in supabase/auth/enable_auth.sql.
create policy "Open access until sign-in is added" on public.toys
  for all to anon, authenticated using (true) with check (true);
create policy "Open access until sign-in is added" on public.toy_qualities
  for all to anon, authenticated using (true) with check (true);
create policy "Open access until sign-in is added" on public.transactions
  for all to anon, authenticated using (true) with check (true);
create policy "Open access until sign-in is added" on public.expenses
  for all to anon, authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Functions: changes that must happen together or not at all.
-- They run with the caller's permissions, so row level security still applies.
-- ---------------------------------------------------------------------------

-- Creates or updates a toy together with its list of qualities.
-- p_toy: { id?, name, sku, manufacturer, category, images: [..], reorder_level, notes,
--          created_at?, qualities: [{ quality, price, cost, stock }, ..] }
create function public.save_toy(p_toy jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_toy ->> 'id')::uuid, gen_random_uuid());
  v_count integer;
begin
  insert into public.toys (id, name, sku, manufacturer, category, images, reorder_level, notes, created_at)
  values (
    v_id,
    p_toy ->> 'name',
    coalesce(p_toy ->> 'sku', ''),
    coalesce(p_toy ->> 'manufacturer', ''),
    p_toy ->> 'category',
    coalesce(
      (select array_agg(x order by ord)
         from jsonb_array_elements_text(coalesce(p_toy -> 'images', '[]'::jsonb)) with ordinality as t (x, ord)),
      '{}'
    ),
    coalesce((p_toy ->> 'reorder_level')::integer, 5),
    coalesce(p_toy ->> 'notes', ''),
    coalesce((p_toy ->> 'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    name = excluded.name,
    sku = excluded.sku,
    manufacturer = excluded.manufacturer,
    category = excluded.category,
    images = excluded.images,
    reorder_level = excluded.reorder_level,
    notes = excluded.notes;

  delete from public.toy_qualities where toy_id = v_id;

  insert into public.toy_qualities (toy_id, quality, price, cost, stock, position)
  select v_id, q ->> 'quality', (q ->> 'price')::numeric, (q ->> 'cost')::numeric,
         (q ->> 'stock')::integer, ord::smallint
    from jsonb_array_elements(coalesce(p_toy -> 'qualities', '[]'::jsonb)) with ordinality as t (q, ord);
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'A toy needs at least one quality.';
  end if;

  -- Keep the name shown on past transactions in step with a rename.
  update public.transactions
     set toy_name = p_toy ->> 'name'
   where toy_id = v_id and toy_name is distinct from p_toy ->> 'name';

  return v_id;
end;
$$;

-- Records a sale, refund or restock and adjusts that quality's stock in the same step.
-- A sale larger than the stock on hand is refused.
-- p_tx: { id?, date?, type, toy_id, quality, quantity, unit_price, payment, note? }
create function public.record_transaction(p_tx jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_tx ->> 'id')::uuid, gen_random_uuid());
  v_toy_id uuid := (p_tx ->> 'toy_id')::uuid;
  v_type text := p_tx ->> 'type';
  v_quality text := p_tx ->> 'quality';
  v_quantity integer := (p_tx ->> 'quantity')::integer;
  v_unit_price numeric(12, 2) := (p_tx ->> 'unit_price')::numeric;
  v_name text;
  v_stock integer;
begin
  select name into v_name from public.toys where id = v_toy_id;
  if not found then
    raise exception 'That toy no longer exists.';
  end if;

  -- Lock the row so two sales at once can't both take the last unit.
  select stock into v_stock
    from public.toy_qualities
   where toy_id = v_toy_id and quality = v_quality
     for update;
  if not found then
    raise exception '"%" doesn''t come in %.', v_name, v_quality;
  end if;

  if v_quantity is null or v_quantity <= 0 then
    raise exception 'Quantity must be a whole number above zero.';
  end if;

  if v_type = 'sale' then
    if v_quantity > v_stock then
      raise exception 'Only % of "%" (%) in stock.', v_stock, v_name, v_quality;
    end if;
    update public.toy_qualities set stock = stock - v_quantity
     where toy_id = v_toy_id and quality = v_quality;
  elsif v_type in ('refund', 'restock') then
    update public.toy_qualities set stock = stock + v_quantity
     where toy_id = v_toy_id and quality = v_quality;
  else
    raise exception 'Unknown transaction type "%".', v_type;
  end if;

  insert into public.transactions
    (id, date, type, toy_id, toy_name, quality, quantity, unit_price, amount, payment, note)
  values (
    v_id,
    coalesce((p_tx ->> 'date')::date, current_date),
    v_type,
    v_toy_id,
    v_name,
    v_quality,
    v_quantity,
    v_unit_price,
    round(v_quantity * v_unit_price, 2),
    p_tx ->> 'payment',
    coalesce(p_tx ->> 'note', '')
  );

  return v_id;
end;
$$;

-- Deletes a transaction and undoes its effect on stock (never below zero).
create function public.delete_transaction(p_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  delete from public.transactions where id = p_id returning * into v_tx;
  if not found or v_tx.toy_id is null then
    return;
  end if;

  update public.toy_qualities
     set stock = greatest(
           0,
           stock + case when v_tx.type = 'sale' then v_tx.quantity else -v_tx.quantity end
         )
   where toy_id = v_tx.toy_id and quality = v_tx.quality;
end;
$$;

revoke execute on function public.save_toy(jsonb) from public;
revoke execute on function public.record_transaction(jsonb) from public;
revoke execute on function public.delete_transaction(uuid) from public;
grant execute on function public.save_toy(jsonb) to anon, authenticated;
grant execute on function public.record_transaction(jsonb) to anon, authenticated;
grant execute on function public.delete_transaction(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: toy pictures
-- ---------------------------------------------------------------------------

-- Public bucket: pictures are shown straight from their public URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toy-images', 'toy-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- TEMPORARY, like the table policies above: anyone with the publishable key can
-- upload to and delete from this bucket. Tightened in supabase/auth/enable_auth.sql.
create policy "toy-images: open read until sign-in is added" on storage.objects
  for select to anon, authenticated using (bucket_id = 'toy-images');
create policy "toy-images: open upload until sign-in is added" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'toy-images');
create policy "toy-images: open delete until sign-in is added" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'toy-images');
