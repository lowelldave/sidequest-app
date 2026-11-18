-- Records a sale of several toys at once. Each line becomes its own
-- transaction, all sharing one batch_id, so they read and print as one sale.
-- All lines are saved together or not at all.
create or replace function public.record_sale(p_lines jsonb)
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
  v_name text;
  v_stock integer;
begin
  if not private.has_permission('transactions.create') then
    raise exception 'Your role can''t record transactions.';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'A sale needs at least one toy.';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_toy_id := (v_line ->> 'toy_id')::uuid;
    v_quality := v_line ->> 'quality';
    v_quantity := (v_line ->> 'quantity')::integer;
    v_unit_price := (v_line ->> 'unit_price')::numeric;

    select name into v_name from public.toys where id = v_toy_id;
    if not found then
      raise exception 'That toy no longer exists.';
    end if;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Quantity must be a whole number above zero.';
    end if;
    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'Unit price can''t be negative.';
    end if;

    select stock into v_stock
      from public.toy_qualities
     where toy_id = v_toy_id and quality = v_quality
       for update;
    if not found then
      raise exception '"%" doesn''t come in %.', v_name, v_quality;
    end if;
    if v_quantity > v_stock then
      raise exception 'Only % of "%" (%) in stock.', v_stock, v_name, v_quality;
    end if;

    update public.toy_qualities set stock = stock - v_quantity
     where toy_id = v_toy_id and quality = v_quality;

    insert into public.transactions
      (id, date, type, toy_id, toy_name, quality, quantity, unit_price, amount, payment, note, batch_id)
    values (
      coalesce((v_line ->> 'id')::uuid, gen_random_uuid()),
      coalesce((v_line ->> 'date')::date, current_date),
      'sale',
      v_toy_id,
      v_name,
      v_quality,
      v_quantity,
      v_unit_price,
      round(v_quantity * v_unit_price, 2),
      v_line ->> 'payment',
      coalesce(v_line ->> 'note', ''),
      (v_line ->> 'batch_id')::uuid
    );
  end loop;
end;
$$;

revoke execute on function public.record_sale(jsonb) from public, anon;
grant execute on function public.record_sale(jsonb) to authenticated;
