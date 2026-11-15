-- Multi-toy restocks with a delivery cost.
--
-- Each toy in a delivery is its own transaction row. Rows from one delivery
-- share a batch_id, and `delivery` is that row's share of the delivery cost,
-- already included in `amount`.

alter table public.transactions
  add column delivery numeric(12, 2) not null default 0 check (delivery >= 0),
  add column batch_id uuid;

create index transactions_batch_id_idx on public.transactions (batch_id) where batch_id is not null;

-- Records every line of a delivery and adds the stock in one step: either all
-- lines are saved or none are.
-- p_lines: [{ id, batch_id, date, toy_id, quality, quantity, unit_price, delivery, payment, note }]
create function public.record_restock(p_lines jsonb)
returns void
language plpgsql
security invoker
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

    -- Lock the row so the stock change can't race another one.
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

revoke execute on function public.record_restock(jsonb) from public;
grant execute on function public.record_restock(jsonb) to anon, authenticated;
