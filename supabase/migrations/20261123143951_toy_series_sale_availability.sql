-- Three optional details on each toy:
--   series        free text, searched from the inventory page
--   for_sale      false for toys kept in the collection but not sold
--   availability  where the stock is: on hand, incoming, or with an outsourced supplier
alter table public.toys
  add column series text not null default '',
  add column for_sale boolean not null default true,
  add column availability text not null default 'on-hand'
    check (availability in ('on-hand', 'incoming', 'outsource'));

-- Reads go through column grants on this table, so the new columns need their own.
grant select, insert, update (series, for_sale, availability) on public.toys to authenticated;
grant select (series, for_sale, availability) on public.toys to service_role;

create or replace function public.save_toy(p_toy jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce((p_toy ->> 'id')::uuid, gen_random_uuid());
  v_count integer;
begin
  if exists (select 1 from public.toys where id = v_id) then
    if not private.has_permission('inventory.edit') then
      raise exception 'Your role can''t edit toys.';
    end if;
  elsif not private.has_permission('inventory.create') then
    raise exception 'Your role can''t add toys.';
  end if;

  insert into public.toys (id, name, sku, manufacturer, series, for_sale, availability, category, images, reorder_level, notes, created_at)
  values (
    v_id,
    p_toy ->> 'name',
    coalesce(p_toy ->> 'sku', ''),
    coalesce(p_toy ->> 'manufacturer', ''),
    coalesce(p_toy ->> 'series', ''),
    coalesce((p_toy ->> 'for_sale')::boolean, true),
    coalesce(p_toy ->> 'availability', 'on-hand'),
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
    series = excluded.series,
    for_sale = excluded.for_sale,
    availability = excluded.availability,
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

  update public.transactions
     set toy_name = p_toy ->> 'name'
   where toy_id = v_id and toy_name is distinct from p_toy ->> 'name';

  return v_id;
end;
$$;

-- Restoring a backup brings the new details back too; an older backup without them
-- gets the defaults.
create or replace function public.admin_replace_data(p_data jsonb, p_label text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only an admin can replace the shop''s data.';
  end if;
  perform set_config('sidequest.bulk', 'on', true);

  delete from public.transactions where true;
  delete from public.toy_qualities where true;
  delete from public.toys where true;
  delete from public.expenses where true;

  insert into public.toys (id, user_id, name, sku, manufacturer, series, for_sale, availability, category, images, reorder_level, notes, created_at)
  select x.id,
         case when exists (select 1 from auth.users u where u.id = x.user_id) then x.user_id end,
         x.name, coalesce(x.sku, ''), coalesce(x.manufacturer, ''),
         coalesce(x.series, ''), coalesce(x.for_sale, true), coalesce(x.availability, 'on-hand'),
         x.category, coalesce(x.images, '{}'),
         coalesce(x.reorder_level, 5), coalesce(x.notes, ''), coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_data -> 'toys', '[]')) as x (
      id uuid, user_id uuid, name text, sku text, manufacturer text, series text, for_sale boolean,
      availability text, category text, images text[], reorder_level integer, notes text, created_at timestamptz);

  insert into public.toy_qualities (toy_id, quality, price, cost, stock, position)
  select x.toy_id, x.quality, x.price, x.cost, coalesce(x.stock, 0), coalesce(x.position, 0)
    from jsonb_to_recordset(coalesce(p_data -> 'toy_qualities', '[]')) as x (
      toy_id uuid, quality text, price numeric, cost numeric, stock integer, position smallint);

  insert into public.transactions
    (id, user_id, recorded_by, date, type, toy_id, toy_name, quality, quantity, unit_price, delivery, amount, payment, note, batch_id, created_at)
  select x.id,
         case when exists (select 1 from auth.users u where u.id = x.user_id) then x.user_id end,
         coalesce(x.recorded_by, ''),
         x.date, x.type,
         case when exists (select 1 from public.toys t where t.id = x.toy_id) then x.toy_id end,
         x.toy_name, x.quality, x.quantity, x.unit_price, coalesce(x.delivery, 0), x.amount, x.payment,
         coalesce(x.note, ''), x.batch_id, coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]')) as x (
      id uuid, user_id uuid, recorded_by text, date date, type text, toy_id uuid, toy_name text, quality text,
      quantity integer, unit_price numeric, delivery numeric, amount numeric, payment text, note text,
      batch_id uuid, created_at timestamptz);

  insert into public.expenses (id, user_id, date, category, vendor, description, amount, created_at)
  select x.id,
         case when exists (select 1 from auth.users u where u.id = x.user_id) then x.user_id end,
         x.date, x.category, coalesce(x.vendor, ''), coalesce(x.description, ''), x.amount,
         coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_data -> 'expenses', '[]')) as x (
      id uuid, user_id uuid, date date, category text, vendor text, description text, amount numeric,
      created_at timestamptz);

  perform private.log('data.replace', coalesce(nullif(btrim(p_label), ''), 'Replaced the shop''s data'));
end;
$$;
