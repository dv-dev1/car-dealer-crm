-- sale_profits gave a seller "profit = price": RLS hid the car's cost and the coalesce turned it into zero.
-- The inner join on vehicle_costs drops the row instead, so a seller reads no profit at all. Every car has its
-- vehicle_finances row (registration, trade-in and the demo write it).
create or replace view sale_profits with (security_invoker = true) as
  select s.id as sale_id, s.store_id,
         s.price - c.cost + coalesce(s.financed_amount * f.financing_return_pct, 0) as profit
    from sales s
    join vehicle_costs c on c.vehicle_id = s.vehicle_id
    left join sale_finances f on f.sale_id = s.id;
