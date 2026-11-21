-- Imports many toys at once (from a CSV the app has already read and checked).
-- p_toys is an array of:
--   { action: 'create' | 'update', id?, name, sku, manufacturer, category,
--     reorder_level, notes, qualities: [{ quality, price, cost, stock }] }
-- 'create' adds a new toy (needs inventory.create). 'update' changes an existing
-- toy's details and sets the price, cost and stock of the listed qualities; its
-- pictures and any other qualities stay as they are (needs inventory.edit).
-- Everything is saved together or not at all, and the activity log gets one entry.
create or replace function public.import_toys(p_toys jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_action text;
  v_created integer := 0;
  v_updated integer := 0;
  v_qualities integer;
begin
  if p_toys is null or jsonb_typeof(p_toys) <> 'array' or jsonb_array_length(p_toys) = 0 then
    raise exception 'There are no toys to import.';
  end if;
  if jsonb_array_length(p_toys) > 500 then
    raise exception 'Import at most 500 toys at a time.';
  end if;

  -- One log entry for the whole import instead of one per toy.
  perform set_config('sidequest.bulk', 'on', true);

  for v_item in select * from jsonb_array_elements(p_toys) loop
    v_action := v_item ->> 'action';

    if v_action = 'create' then
      if not private.has_permission('inventory.create') then
        raise exception 'Your role can''t add toys.';
      end if;
      v_id := gen_random_uuid();
      insert into public.toys (id, name, sku, manufacturer, category, reorder_level, notes)
      values (
        v_id,
        v_item ->> 'name',
        coalesce(v_item ->> 'sku', ''),
        coalesce(v_item ->> 'manufacturer', ''),
        v_item ->> 'category',
        coalesce((v_item ->> 'reorder_level')::integer, 5),
        coalesce(v_item ->> 'notes', '')
      );
      v_created := v_created + 1;

    elsif v_action = 'update' then
      if not private.has_permission('inventory.edit') then
        raise exception 'Your role can''t edit toys.';
      end if;
      v_id := (v_item ->> 'id')::uuid;
      update public.toys set
        name = v_item ->> 'name',
        sku = coalesce(v_item ->> 'sku', ''),
        manufacturer = coalesce(v_item ->> 'manufacturer', ''),
        category = v_item ->> 'category',
        reorder_level = coalesce((v_item ->> 'reorder_level')::integer, reorder_level),
        notes = coalesce(v_item ->> 'notes', '')
      where id = v_id;
      if not found then
        raise exception 'A toy to update no longer exists: %.', v_item ->> 'name';
      end if;
      update public.transactions set toy_name = v_item ->> 'name'
       where toy_id = v_id and toy_name is distinct from v_item ->> 'name';
      v_updated := v_updated + 1;

    else
      raise exception 'Unknown import action "%".', v_action;
    end if;

    -- Qualities: set price, cost and stock; new ones go after the toy's existing ones.
    insert into public.toy_qualities (toy_id, quality, price, cost, stock, position)
    select v_id, q ->> 'quality', (q ->> 'price')::numeric, (q ->> 'cost')::numeric,
           (q ->> 'stock')::integer,
           (coalesce((select max(position) + 1 from public.toy_qualities where toy_id = v_id), 0) + ord - 1)::smallint
      from jsonb_array_elements(coalesce(v_item -> 'qualities', '[]'::jsonb)) with ordinality as t (q, ord)
    on conflict (toy_id, quality) do update set
      price = excluded.price, cost = excluded.cost, stock = excluded.stock;
    get diagnostics v_qualities = row_count;
    if v_qualities = 0 then
      raise exception '"%" needs at least one quality.', v_item ->> 'name';
    end if;
  end loop;

  perform private.log('inventory.import',
    format('Imported toys from a file: %s added, %s updated', v_created, v_updated));

  return jsonb_build_object('created', v_created, 'updated', v_updated);
end;
$$;

revoke execute on function public.import_toys(jsonb) from public, anon;
grant execute on function public.import_toys(jsonb) to authenticated;
