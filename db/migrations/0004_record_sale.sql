-- Records a sale: the sale row, the car as sold and the lead as won, in one step.
-- security definer because a seller records the sale of their own lead, while RLS lets only owner and
-- manager write sales and change a car's status. The checks below stand in for those policies.
-- Refusals raise P0001 with one of: forbidden, not_found, not_available, lead_closed, invalid.
create function record_sale(
  p_vehicle_id uuid, p_lead_id uuid, p_seller_id uuid, p_price numeric, p_payment text,
  p_bank text, p_financed_amount numeric, p_sold_on date
) returns uuid
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_store uuid := app_store_id();
  v_role text := app_role();
  v_member uuid := app_membership_id();
  v_status text;
  v_lead_stage text;
  v_lead_seller uuid;
  v_seller uuid;
  v_seller_name text;
  v_sale uuid;
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

  if v_role = 'seller' then
    if (p_seller_id is not null and p_seller_id <> v_member)
       or (p_lead_id is not null and v_lead_seller is distinct from v_member) then
      raise exception 'forbidden';
    end if;
    v_seller := v_member;
  elsif v_role in ('owner', 'manager') then
    v_seller := coalesce(p_seller_id, v_lead_seller, v_member);
  else
    raise exception 'forbidden';
  end if;

  select name into v_seller_name from memberships where id = v_seller and store_id = v_store;
  if not found then
    raise exception 'not_found';
  end if;

  if p_price is null or p_price <= 0
     or p_payment is null or p_payment not in ('cash', 'financing')
     or (p_payment = 'financing' and (p_financed_amount is null or p_financed_amount <= 0 or p_financed_amount > p_price))
     or (p_payment = 'cash' and (p_financed_amount is not null or p_bank is not null))
     or p_sold_on is null or p_sold_on > (now() at time zone 'America/Fortaleza')::date then
    raise exception 'invalid';
  end if;

  insert into sales (store_id, vehicle_id, lead_id, seller_id, seller_name, sold_on, price, payment, bank, financed_amount, warranty_until)
  values (v_store, p_vehicle_id, p_lead_id, v_seller, v_seller_name, p_sold_on, p_price, p_payment, nullif(btrim(p_bank), ''),
          p_financed_amount, p_sold_on + 90)
  returning id into v_sale;

  update vehicles set status = 'sold', away_reason = null, away_until = null where id = p_vehicle_id;

  if p_lead_id is not null then
    update leads set stage = 'won', closed_at = now(), vehicle_id = p_vehicle_id where id = p_lead_id;
  end if;

  return v_sale;
end
$$;

revoke all on function record_sale(uuid, uuid, uuid, numeric, text, text, numeric, date) from public;
grant execute on function record_sale(uuid, uuid, uuid, numeric, text, text, numeric, date) to app_user;
