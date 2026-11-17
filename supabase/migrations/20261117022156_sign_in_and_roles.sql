-- Sign-in, roles and shop settings.
--
-- The shop is shared: everyone who signs in works on the same toys,
-- transactions and expenses. What each person may see and do depends on their
-- role. Roles are lists of permissions that the admin edits in Settings; the
-- Admin role always has every permission and is the only one that can manage
-- people, roles, the shop setup and backups.
--
-- The first account created becomes the admin. Later accounts are created by
-- the admin (see the admin-users edge function). Anyone who signs up on their
-- own gets no role, and so no access, until the admin gives them one.
--
-- `user_id` on toys, transactions and expenses now means "recorded by".
-- Rows from before sign-in keep a null user_id and stay visible to everyone.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  description text not null default '',
  -- The single built-in admin role: every permission, can't be edited or deleted.
  is_admin boolean not null default false,
  permissions text[] not null default '{}' check (
    permissions <@ array[
      'dashboard.view',
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
      'transactions.view', 'transactions.create', 'transactions.delete',
      'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'
    ]::text[]
  ),
  created_at timestamptz not null default now()
);
create unique index roles_single_admin on public.roles ((true)) where is_admin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  display_name text not null default '',
  -- Path in the "avatars" bucket, or '' for none.
  avatar_path text not null default '',
  -- Null means no access yet.
  role_id uuid references public.roles (id) on delete set null,
  -- Switched off by the admin to block someone without deleting them.
  active boolean not null default true,
  -- Set when the admin picks a temporary password; cleared once they choose their own.
  must_change_password boolean not null default false,
  -- Personal display preferences: { theme, inventoryView }.
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index profiles_role_id_idx on public.profiles (role_id);

-- One row: the shop's name, branding and defaults.
create table public.shop_settings (
  id boolean primary key default true check (id),
  name text not null default 'SideQuest: Toys and Figures' check (length(btrim(name)) > 0),
  -- Path in the "shop-assets" bucket, or '' for the built-in logo.
  logo_path text not null default '',
  -- Accent colour as #rrggbb.
  accent text not null default '#4f46e5' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  currency text not null default 'USD',
  invoice_address text not null default '',
  invoice_phone text not null default '',
  invoice_email text not null default '',
  invoice_footer text not null default '',
  default_reorder_level integer not null default 5 check (default_reorder_level >= 0),
  default_quality text not null default 'MIB' check (default_quality in ('MISB', 'MIB', 'BIB', 'Loose', 'Damaged')),
  updated_at timestamptz not null default now()
);
insert into public.shop_settings default values;

create table public.activity_log (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  action text not null,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_log_user_id_idx on public.activity_log (user_id, created_at desc);
create index activity_log_created_at_idx on public.activity_log (created_at desc);

insert into public.roles (name, description, is_admin, permissions) values
  ('Admin', 'Full access, including people, roles, shop setup and backups.', true, '{}'),
  ('Manager', 'Runs the shop day to day: everything except admin settings.', false, array[
    'dashboard.view',
    'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
    'transactions.view', 'transactions.create', 'transactions.delete',
    'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'
  ]),
  ('Cashier', 'Records sales and refunds and looks up stock.', false, array[
    'inventory.view', 'transactions.view', 'transactions.create'
  ]),
  ('Viewer', 'Can look at everything but change nothing.', false, array[
    'dashboard.view', 'inventory.view', 'transactions.view', 'expenses.view'
  ]);

-- ---------------------------------------------------------------------------
-- Permission checks. In a schema the API doesn't expose, so they can only be
-- used from policies and functions. They read the caller's own profile.
-- ---------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated, supabase_auth_admin;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
     where p.id = (select auth.uid()) and p.active and r.is_admin
  );
$$;

create function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles p
      join public.roles r on r.id = p.role_id
     where p.id = (select auth.uid())
       and p.active
       and (r.is_admin or p_permission = any (r.permissions))
  );
$$;

-- Signed in, active and given a role.
create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.active and p.role_id is not null
  );
$$;

-- Bulk changes (restore, sample data) log one entry instead of one per row.
create function private.bulk_mode()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('sidequest.bulk', true), '') = 'on';
$$;

-- ---------------------------------------------------------------------------
-- New accounts get a profile. The first one becomes the admin.
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role uuid;
begin
  -- Two accounts created at the same moment can't both become the admin.
  perform pg_advisory_xact_lock(hashtext('sidequest.first_admin'));
  if not exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id where r.is_admin
  ) then
    select id into v_role from public.roles where is_admin;
  end if;

  insert into public.profiles (id, email, display_name, role_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    v_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep the profile's copy of the email in step after a confirmed email change.
create function private.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function private.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Activity log, written by triggers.
-- ---------------------------------------------------------------------------

create function private.log(p_action text, p_summary text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.activity_log (action, summary) values (p_action, p_summary);
$$;

create function private.log_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.bulk_mode() then return null; end if;
  if tg_op = 'INSERT' then
    perform private.log('transactions.create',
      format('Recorded a %s: %s × %s (%s)', new.type, new.quantity, new.toy_name, new.quality));
  else
    perform private.log('transactions.delete',
      format('Deleted a %s: %s × %s (%s)', old.type, old.quantity, old.toy_name, old.quality));
  end if;
  return null;
end;
$$;

create function private.log_toy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.bulk_mode() then return null; end if;
  if tg_op = 'INSERT' then
    perform private.log('inventory.create', format('Added the toy "%s"', new.name));
  elsif tg_op = 'UPDATE' then
    perform private.log('inventory.edit', format('Edited the toy "%s"', new.name));
  else
    perform private.log('inventory.delete', format('Deleted the toy "%s"', old.name));
  end if;
  return null;
end;
$$;

create function private.log_expense()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.expenses;
  v_what text;
begin
  if private.bulk_mode() then return null; end if;
  if tg_op = 'DELETE' then v_row := old; else v_row := new; end if;
  v_what := format('%s expense of %s%s', v_row.category, v_row.amount,
    case when v_row.vendor <> '' then ' (' || v_row.vendor || ')' else '' end);
  perform private.log(
    'expenses.' || case tg_op when 'INSERT' then 'create' when 'UPDATE' then 'edit' else 'delete' end,
    case tg_op when 'INSERT' then 'Added a ' when 'UPDATE' then 'Edited a ' else 'Deleted a ' end || v_what
  );
  return null;
end;
$$;

create function private.log_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log(
    'roles.' || lower(tg_op),
    case tg_op
      when 'INSERT' then format('Created the role "%s"', new.name)
      when 'UPDATE' then format('Changed the role "%s"', new.name)
      else format('Deleted the role "%s"', old.name)
    end
  );
  return null;
end;
$$;

create function private.log_shop_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.log('shop.edit', 'Updated the shop setup');
  return null;
end;
$$;

create trigger log_transactions after insert or delete on public.transactions
  for each row execute function private.log_transaction();
create trigger log_toys after insert or update or delete on public.toys
  for each row execute function private.log_toy();
create trigger log_expenses after insert or update or delete on public.expenses
  for each row execute function private.log_expense();
create trigger log_roles after insert or update or delete on public.roles
  for each row execute function private.log_role();
create trigger log_shop_settings after update on public.shop_settings
  for each row execute function private.log_shop_settings();

-- Only policies (run as the signed-in user) need to call these.
revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_permission(text) to authenticated;
grant execute on function private.is_member() to authenticated;

-- ---------------------------------------------------------------------------
-- Access to the shop's data. Replaces the open policies.
-- ---------------------------------------------------------------------------

drop policy "Open access until sign-in is added" on public.toys;
drop policy "Open access until sign-in is added" on public.toy_qualities;
drop policy "Open access until sign-in is added" on public.transactions;
drop policy "Open access until sign-in is added" on public.expenses;

revoke all on public.toys, public.toy_qualities, public.transactions, public.expenses from anon;

-- Every member can read the toy list: recording a sale needs it.
create policy "Members read toys" on public.toys
  for select to authenticated using ((select private.is_member()));
create policy "Inventory: add" on public.toys
  for insert to authenticated with check ((select private.has_permission('inventory.create')));
create policy "Inventory: edit" on public.toys
  for update to authenticated
  using ((select private.has_permission('inventory.edit')))
  with check ((select private.has_permission('inventory.edit')));
create policy "Inventory: delete" on public.toys
  for delete to authenticated using ((select private.has_permission('inventory.delete')));

-- Qualities and stock change only through the functions below (or an admin restore).
create policy "Members read qualities" on public.toy_qualities
  for select to authenticated using ((select private.is_member()));
create policy "Admins change qualities" on public.toy_qualities
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- The dashboard shows sales, so seeing it means seeing transactions too.
create policy "Transactions: view" on public.transactions
  for select to authenticated
  using ((select private.has_permission('transactions.view')) or (select private.has_permission('dashboard.view')));
create policy "Admins change transactions" on public.transactions
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Expenses: view" on public.expenses
  for select to authenticated
  using ((select private.has_permission('expenses.view')) or (select private.has_permission('dashboard.view')));
create policy "Expenses: add" on public.expenses
  for insert to authenticated with check ((select private.has_permission('expenses.create')));
create policy "Expenses: edit" on public.expenses
  for update to authenticated
  using ((select private.has_permission('expenses.edit')))
  with check ((select private.has_permission('expenses.edit')));
create policy "Expenses: delete" on public.expenses
  for delete to authenticated using ((select private.has_permission('expenses.delete')));

-- Roles: everyone signed in can read them (to know their own); only the admin
-- changes them, and never the built-in Admin role.
alter table public.roles enable row level security;
grant select, insert, update, delete on public.roles to authenticated;
create policy "Signed-in users read roles" on public.roles
  for select to authenticated using (true);
create policy "Admins add roles" on public.roles
  for insert to authenticated with check ((select private.is_admin()) and not is_admin);
create policy "Admins edit roles" on public.roles
  for update to authenticated
  using ((select private.is_admin()) and not is_admin)
  with check ((select private.is_admin()) and not is_admin);
create policy "Admins delete roles" on public.roles
  for delete to authenticated using ((select private.is_admin()) and not is_admin);

-- Profiles: people see and edit their own; the admin sees everyone's. Role,
-- active and must_change_password change only through functions below.
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
grant update (display_name, avatar_path, preferences) on public.profiles to authenticated;
create policy "Read own profile, admins read all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));
create policy "Edit own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Shop settings: readable by anyone (the sign-in page shows the name, logo and
-- colour); changed only by the admin.
alter table public.shop_settings enable row level security;
grant select on public.shop_settings to anon, authenticated;
grant update (
  name, logo_path, accent, currency, invoice_address, invoice_phone, invoice_email,
  invoice_footer, default_reorder_level, default_quality, updated_at
) on public.shop_settings to authenticated;
create policy "Anyone reads the shop settings" on public.shop_settings
  for select to anon, authenticated using (true);
create policy "Admins change the shop settings" on public.shop_settings
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

alter table public.activity_log enable row level security;
grant select on public.activity_log to authenticated;
create policy "Read own activity, admins read all" on public.activity_log
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- The shop functions now check permissions themselves and run with the
-- owner's rights, so stock can change without giving everyone write access
-- to the qualities table.
-- ---------------------------------------------------------------------------

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

  update public.transactions
     set toy_name = p_toy ->> 'name'
   where toy_id = v_id and toy_name is distinct from p_toy ->> 'name';

  return v_id;
end;
$$;

create or replace function public.record_transaction(p_tx jsonb)
returns uuid
language plpgsql
security definer
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
  if not private.has_permission('transactions.create') then
    raise exception 'Your role can''t record transactions.';
  end if;

  select name into v_name from public.toys where id = v_toy_id;
  if not found then
    raise exception 'That toy no longer exists.';
  end if;

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

create or replace function public.delete_transaction(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
begin
  if not private.has_permission('transactions.delete') then
    raise exception 'Your role can''t delete transactions.';
  end if;

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

create or replace function public.record_restock(p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_line jsonb;
  v_toy_id uuid;
  v_quality text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_delivery numeric(12, 2);
  v_name text;
begin
  if not private.has_permission('transactions.create') then
    raise exception 'Your role can''t record transactions.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A restock needs at least one toy.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_toy_id := (v_line ->> 'toy_id')::uuid;
    v_quality := v_line ->> 'quality';
    v_quantity := (v_line ->> 'quantity')::integer;
    v_unit_price := (v_line ->> 'unit_price')::numeric;
    v_delivery := coalesce((v_line ->> 'delivery')::numeric, 0);

    select name into v_name from public.toys where id = v_toy_id;
    if not found then
      raise exception 'That toy no longer exists.';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantity must be a whole number above zero.';
    end if;

    perform 1 from public.toy_qualities
      where toy_id = v_toy_id and quality = v_quality
        for update;
    if not found then
      raise exception '"%" doesn''t come in %.', v_name, v_quality;
    end if;

    update public.toy_qualities set stock = stock + v_quantity
     where toy_id = v_toy_id and quality = v_quality;

    insert into public.transactions
      (id, date, type, toy_id, toy_name, quality, quantity, unit_price, delivery, amount, payment, note, batch_id)
    values (
      coalesce((v_line ->> 'id')::uuid, gen_random_uuid()),
      coalesce((v_line ->> 'date')::date, current_date),
      'restock',
      v_toy_id,
      v_name,
      v_quality,
      v_quantity,
      v_unit_price,
      v_delivery,
      round(v_quantity * v_unit_price + v_delivery, 2),
      v_line ->> 'payment',
      coalesce(v_line ->> 'note', ''),
      (v_line ->> 'batch_id')::uuid
    );
  end loop;
end;
$$;

revoke execute on function public.save_toy(jsonb) from public, anon;
revoke execute on function public.record_transaction(jsonb) from public, anon;
revoke execute on function public.delete_transaction(uuid) from public, anon;
revoke execute on function public.record_restock(jsonb) from public, anon;
grant execute on function public.save_toy(jsonb) to authenticated;
grant execute on function public.record_transaction(jsonb) to authenticated;
grant execute on function public.delete_transaction(uuid) to authenticated;
grant execute on function public.record_restock(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the app calls for sign-in and administration.
-- ---------------------------------------------------------------------------

-- The signed-in person's role and permissions (null if they have no profile).
create function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'active', p.active,
    'must_change_password', p.must_change_password,
    'role_id', r.id,
    'role_name', r.name,
    'is_admin', coalesce(r.is_admin, false) and p.active,
    'permissions', case
      when not p.active or r.id is null then '{}'::text[]
      when r.is_admin then array[
        'dashboard.view',
        'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.delete',
        'transactions.view', 'transactions.create', 'transactions.delete',
        'expenses.view', 'expenses.create', 'expenses.edit', 'expenses.delete'
      ]
      else r.permissions
    end
  )
    from public.profiles p
    left join public.roles r on r.id = p.role_id
   where p.id = (select auth.uid());
$$;

-- True until the first admin account exists; the sign-in page then offers to create it.
create function public.shop_needs_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id where r.is_admin
  );
$$;

-- Called after someone sets their own password.
create function public.password_changed()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = (select auth.uid());
$$;

-- Admin: change someone's role or block/unblock them. There must always be an active admin.
create function public.admin_set_member(p_user uuid, p_role uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_role uuid;
  v_profile public.profiles;
  v_role_name text;
begin
  if not private.is_admin() then
    raise exception 'Only an admin can change people''s access.';
  end if;
  select id into v_admin_role from public.roles where is_admin;
  select * into v_profile from public.profiles where id = p_user for update;
  if not found then
    raise exception 'That person no longer exists.';
  end if;

  if v_profile.role_id = v_admin_role and v_profile.active
     and (p_role is distinct from v_admin_role or not p_active)
     and (select count(*) from public.profiles where role_id = v_admin_role and active) <= 1 then
    raise exception 'The shop needs at least one active admin. Make someone else an admin first.';
  end if;

  update public.profiles set role_id = p_role, active = p_active where id = p_user;

  select name into v_role_name from public.roles where id = p_role;
  perform private.log('people.edit', format('Changed %s: %s, %s',
    coalesce(nullif(v_profile.display_name, ''), v_profile.email),
    coalesce(v_role_name, 'no role'),
    case when p_active then 'active' else 'blocked' end));
end;
$$;

-- Admin: replace all toys, transactions and expenses with `p_data`
-- ({ toys, toy_qualities, transactions, expenses }, rows as stored), in one step.
-- Used for restoring a backup, loading the sample data and clearing everything.
create function public.admin_replace_data(p_data jsonb, p_label text)
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
    (id, user_id, date, type, toy_id, toy_name, quality, quantity, unit_price, delivery, amount, payment, note, batch_id, created_at)
  select x.id,
         case when exists (select 1 from auth.users u where u.id = x.user_id) then x.user_id end,
         x.date, x.type,
         case when exists (select 1 from public.toys t where t.id = x.toy_id) then x.toy_id end,
         x.toy_name, x.quality, x.quantity, x.unit_price, coalesce(x.delivery, 0), x.amount, x.payment,
         coalesce(x.note, ''), x.batch_id, coalesce(x.created_at, now())
    from jsonb_to_recordset(coalesce(p_data -> 'transactions', '[]')) as x (
      id uuid, user_id uuid, date date, type text, toy_id uuid, toy_name text, quality text, quantity integer,
      unit_price numeric, delivery numeric, amount numeric, payment text, note text, batch_id uuid,
      created_at timestamptz);

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

revoke execute on function public.my_access() from public, anon;
revoke execute on function public.password_changed() from public, anon;
revoke execute on function public.admin_set_member(uuid, uuid, boolean) from public, anon;
revoke execute on function public.admin_replace_data(jsonb, text) from public, anon;
grant execute on function public.my_access() to authenticated;
grant execute on function public.password_changed() to authenticated;
grant execute on function public.admin_set_member(uuid, uuid, boolean) to authenticated;
grant execute on function public.admin_replace_data(jsonb, text) to authenticated;
revoke execute on function public.shop_needs_admin() from public;
grant execute on function public.shop_needs_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Toy pictures: public to view. Anyone who may add or edit toys may upload;
-- edit or delete permission is needed to remove one.
drop policy "toy-images: open upload until sign-in is added" on storage.objects;
drop policy "toy-images: open delete until sign-in is added" on storage.objects;
drop policy "toy-images: open read until sign-in is added" on storage.objects;

-- Removing a file needs read access as well as delete access.
create policy "toy-images: signed-in users read" on storage.objects
  for select to authenticated using (bucket_id = 'toy-images');
create policy "toy-images: inventory editors upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'toy-images'
    and ((select private.has_permission('inventory.create')) or (select private.has_permission('inventory.edit')))
  );
create policy "toy-images: inventory editors delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'toy-images'
    and ((select private.has_permission('inventory.edit')) or (select private.has_permission('inventory.delete')))
  );

-- Profile pictures: public to view; each person manages files in their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: own folder upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Shop logo: public to view; only the admin changes it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-assets', 'shop-assets', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "shop-assets: admins read" on storage.objects
  for select to authenticated using (bucket_id = 'shop-assets' and (select private.is_admin()));
create policy "shop-assets: admins upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-assets' and (select private.is_admin()));
create policy "shop-assets: admins delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-assets' and (select private.is_admin()));
