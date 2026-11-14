-- What a car cost the store: the consignor's payout for a consigned car, the purchase price otherwise, plus
-- its expenses. The one source for cost and profit in every screen. security_invoker keeps the RLS of
-- vehicle_finances and vehicle_expenses, so a seller reads no rows.
create view vehicle_costs with (security_invoker = true) as
  select v.id as vehicle_id, v.store_id,
         coalesce(case when v.source = 'consignment' then f.consignor_payout else f.purchase_price end, 0)
           + coalesce((select sum(e.amount) from vehicle_expenses e where e.vehicle_id = v.id), 0) as cost
    from vehicles v
    join vehicle_finances f on f.vehicle_id = v.id;

grant select on vehicle_costs to app_user;
