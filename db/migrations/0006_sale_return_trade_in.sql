-- record_sale also takes the financing return (owner and manager only) and the car taken in trade, which
-- enters the stock in preparation costing what was given; and it refuses a car reserved for another client.
-- Refusals raise P0001 with one of: forbidden, not_found, not_available, lead_closed, reserved, invalid.
drop function record_sale(uuid, uuid, uuid, numeric, text, text, numeric, date);

create function record_sale(
  p_vehicle_id uuid, p_lead_id uuid, p_seller_id uuid, p_price numeric, p_payment text,
  p_bank text, p_financed_amount numeric, p_sold_on date, p_return_pct numeric, p_trade_in jsonb
) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_store uuid := app_store_id();
  v_role text := app_role();
  v_member uuid := app_membership_id();
  v_today date := (now() at time zone 'America/Fortaleza')::date;
  v_status text;
  v_lead_stage text;
  v_lead_seller uuid;
  v_seller uuid;
  v_seller_name text;
  v_sale uuid;
  v_trade uuid;
  v_trade_value numeric;
begin
  if v_store is null or v_role is null or v_member is null then
    raise exception 'forbidden';
  end if;

  -- The lock makes a second sale of the same car wait and then see it sold.
  select status into v_status from vehicles where id = p_vehicle_id and store_id = v_store for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_status in ('sold', 'removed') then
    raise exception 'not_available';
  end if;

  if p_lead_id is not null then
    select stage, seller_id into v_lead_stage, v_lead_seller from leads where id = p_lead_id and store_id = v_store for update;
    if not found then
      raise exception 'not_found';
    end if;
    if v_lead_stage in ('won', 'lost') then
      raise exception 'lead_closed';
    end if;
  end if;

  -- A seller records only the sale of their own lead, never a car on its own, and never the financing return.
  if v_role = 'seller' then
    if p_lead_id is null
       or (p_seller_id is not null and p_seller_id <> v_member)
       or v_lead_seller is distinct from v_member
       or p_return_pct is not null then
      raise exception 'forbidden';
    end if;
    v_seller := v_member;
  elsif v_role in ('owner', 'manager') then
    v_seller := coalesce(p_seller_id, v_lead_seller, v_member);
  else
    raise exception 'forbidden';
  end if;

  -- An open reservation holds the car for its client; one without a client holds it for nobody in particular.
  if exists (
    select from reservations r
     where r.vehicle_id = p_vehicle_id and r.canceled_at is null and r.expires_on >= v_today
       and r.lead_id is not null and r.lead_id is distinct from p_lead_id
  ) then
    raise exception 'reserved';
  end if;

  select name into v_seller_name from memberships where id = v_seller and store_id = v_store;
  if not found then
    raise exception 'not_found';
  end if;

  if p_price is null or p_price <= 0
     or p_payment is null or p_payment not in ('cash', 'financing')
     or (p_payment = 'financing' and (p_financed_amount is null or p_financed_amount <= 0 or p_financed_amount > p_price))
     or (p_payment = 'cash' and (p_financed_amount is not null or p_bank is not null or p_return_pct is not null))
     or (p_return_pct is not null and (p_return_pct < 0 or p_return_pct > 0.2))
     or p_sold_on is null or p_sold_on > v_today then
    raise exception 'invalid';
  end if;

  insert into sales (store_id, vehicle_id, lead_id, seller_id, seller_name, sold_on, price, payment, bank, financed_amount, warranty_until)
  values (v_store, p_vehicle_id, p_lead_id, v_seller, v_seller_name, p_sold_on, p_price, p_payment, nullif(btrim(p_bank), ''),
          p_financed_amount, p_sold_on + 90)
  returning id into v_sale;

  if p_return_pct is not null then
    insert into sale_finances (sale_id, store_id, financing_return_pct) values (v_sale, v_store, p_return_pct);
  end if;

  -- The model checks the trade-in's fields against the form's lists; the table checks repeat the limits.
  if p_trade_in is not null then
    v_trade := gen_random_uuid();
    v_trade_value := (p_trade_in ->> 'value')::numeric;
    if v_trade_value is null or v_trade_value <= 0 then
      raise exception 'invalid';
    end if;
    insert into vehicles (id, store_id, slug, brand, model, version, model_year, manufacture_year, km, fuel, transmission,
                          price, status, source, acquired_in_sale_id, entered_on)
    values (v_trade, v_store,
            trim(both '-' from regexp_replace(lower(concat_ws(' ', p_trade_in ->> 'brand', p_trade_in ->> 'model',
                 p_trade_in ->> 'version', p_trade_in ->> 'modelYear')), '[^a-z0-9]+', '-', 'g')) || '-' || left(v_trade::text, 6),
            btrim(p_trade_in ->> 'brand'), btrim(p_trade_in ->> 'model'), btrim(p_trade_in ->> 'version'),
            (p_trade_in ->> 'modelYear')::int, (p_trade_in ->> 'manufactureYear')::int, (p_trade_in ->> 'km')::int,
            p_trade_in ->> 'fuel', p_trade_in ->> 'transmission',
            -- The asking price starts at what was given, until the owner prices the car.
            v_trade_value, 'preparing', 'trade_in', v_sale, p_sold_on);
    insert into vehicle_finances (vehicle_id, store_id, purchase_price) values (v_trade, v_store, v_trade_value);
    insert into sale_trade_ins (sale_id, store_id, trade_in_value) values (v_sale, v_store, v_trade_value);
    update sales set trade_in_vehicle_id = v_trade where id = v_sale;
  end if;

  update vehicles set status = 'sold', away_reason = null, away_until = null where id = p_vehicle_id;

  if p_lead_id is not null then
    update leads set stage = 'won', closed_at = now(), vehicle_id = p_vehicle_id where id = p_lead_id;
  end if;

  return v_sale;
end
$$;

revoke all on function record_sale(uuid, uuid, uuid, numeric, text, text, numeric, date, numeric, jsonb) from public;
grant execute on function record_sale(uuid, uuid, uuid, numeric, text, text, numeric, date, numeric, jsonb) to app_user;

-- What a sale made the store: the price, less what the car cost, plus the bank's return on the financed amount.
-- security_invoker keeps the RLS of vehicle_finances, vehicle_expenses and sale_finances: a seller reads no profit.
create view sale_profits with (security_invoker = true) as
  select s.id as sale_id, s.store_id,
         s.price - coalesce(c.cost, 0) + coalesce(s.financed_amount * f.financing_return_pct, 0) as profit
    from sales s
    left join vehicle_costs c on c.vehicle_id = s.vehicle_id
    left join sale_finances f on f.sale_id = s.id;

grant select on sale_profits to app_user;
