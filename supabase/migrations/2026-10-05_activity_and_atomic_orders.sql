begin;

-- 1. Server-side timestamps -------------------------------------------------
alter table shifts alter column opened_at set default now();
alter table orders alter column created_at set default now();

-- Time recorded on the phone when the order was confirmed (informational)
alter table orders add column if not exists client_created_at timestamptz;

create index if not exists orders_shift_created_idx
  on orders (shift_id, created_at);

-- 2. Close a shift using SERVER time ---------------------------------------
create or replace function close_shift(p_shift_id uuid, p_user_id uuid)
returns setof shifts
language sql
as $$
  update shifts
     set closed_at = now(),
         closed_by = p_user_id
   where id = p_shift_id
     and closed_at is null
  returning *;
$$;

-- 3. Atomic order creation: order + stock deduction in ONE transaction -----
create or replace function create_order(
  p_id             uuid,
  p_shift_id       uuid,
  p_staff_id       uuid,
  p_items          jsonb,
  p_total          numeric,
  p_payment_method text,
  p_cash           numeric,
  p_transfer       numeric,
  p_change         numeric,
  p_client_time    timestamptz
) returns jsonb
language plpgsql
as $$
declare
  v_item    jsonb;
  v_updated integer;
begin
  -- Idempotency: a retry of an order that already saved is a no-op
  if exists (select 1 from orders where id = p_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Closed shifts are immutable
  if not exists (
    select 1 from shifts where id = p_shift_id and closed_at is null
  ) then
    raise exception 'SHIFT_CLOSED';
  end if;

  insert into orders (
    id, shift_id, staff_id, items_json, subtotal, total,
    payment_method, cash_amount, transfer_amount, change_given,
    client_created_at
  ) values (
    p_id, p_shift_id, p_staff_id, p_items, p_total, p_total,
    p_payment_method, p_cash, p_transfer, p_change,
    p_client_time
  );

  -- Deduct stock item by item (sorted to avoid deadlocks between
  -- two orders touching the same items)
  for v_item in
    select value
      from jsonb_array_elements(p_items) as t(value)
     order by value->>'item_id'
  loop
    update shift_stock
       set quantity = quantity - (v_item->>'qty')::numeric
     where shift_id = p_shift_id
       and item_id::text = v_item->>'item_id'
       and quantity >= (v_item->>'qty')::numeric;

    get diagnostics v_updated = row_count;

    if v_updated = 0 then
      -- Raising rolls back the order insert AND any earlier deductions
      raise exception 'INSUFFICIENT_STOCK:%', v_item->>'name';
    end if;
  end loop;

  return jsonb_build_object('status', 'ok');
end;
$$;

commit;
