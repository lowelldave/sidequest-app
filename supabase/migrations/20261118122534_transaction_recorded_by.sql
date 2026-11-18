-- Who entered each transaction. The name is saved with the transaction, so anyone
-- who can see transactions can see it (people can only read their own profile),
-- and it stays after that person's account is removed.
alter table public.transactions add column recorded_by text not null default '';

create function private.set_recorded_by()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.recorded_by, '') = '' then
    select coalesce(nullif(btrim(p.display_name), ''), p.email) into new.recorded_by
      from public.profiles p
     where p.id = new.user_id;
  end if;
  new.recorded_by := coalesce(new.recorded_by, '');
  return new;
end;
$$;

create trigger transactions_set_recorded_by
  before insert on public.transactions
  for each row execute function private.set_recorded_by();

-- Name the transactions already recorded by someone who still has an account.
update public.transactions t
   set recorded_by = coalesce(nullif(btrim(p.display_name), ''), p.email)
  from public.profiles p
 where p.id = t.user_id and t.recorded_by = '';

-- Backups and restores carry the name along.
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

  insert into public.toys (id, user_id, name, sku, manufacturer, category, images, reorder_level, notes, created_at)
  select x.id,
         case when exists (select 1 from auth.users u where u.id = x.user_id) then x.user_id end,
         x.name, coalesce(x.sku, ''), coalesce(x.manufacturer, ''), x.category, coalesce(x.images, '{}'),
         coalesce(x.reorder_level, 5), coalesce(x.notes, ''), coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_data -> 'toys', '[]')) as x (
      id uuid, user_id uuid, name text, sku text, manufacturer text, category text, images text[],
      reorder_level integer, notes text, created_at timestamptz);

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

revoke execute on function public.admin_replace_data(jsonb, text) from public, anon;
grant execute on function public.admin_replace_data(jsonb, text) to authenticated;
