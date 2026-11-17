-- Each sale's commission, from the seller's own rule or else the store's: fixed per car, % of the price or
-- % of the profit (never below zero). Computed with the rule in force, so changing a rule changes past months.
-- security definer: it reads commission_rules and sale_profits (a security_invoker view, which would apply the
-- caller's RLS even inside another view) as the function's owner, and returns only the commission. The where
-- clause does what RLS would: the caller's store, and a seller's own sales.
create function sale_commissions(p_from date, p_to date)
  returns table (sale_id uuid, seller_id uuid, commission numeric)
  language sql stable security definer set search_path = public, pg_temp
as $$
  select s.id, s.seller_id,
         round(case r.kind
                 when 'fixed' then r.value
                 when 'sale_pct' then s.price * r.value
                 when 'profit_pct' then greatest(p.profit, 0) * r.value
                 else 0
               end, 2)
    from sales s
    join sale_profits p on p.sale_id = s.id
    left join lateral (
      select c.kind, c.value from commission_rules c
       where c.store_id = s.store_id and (c.member_id = s.seller_id or c.member_id is null)
       order by c.member_id nulls last
       limit 1
    ) r on true
   where s.store_id = app_store_id() and s.sold_on between p_from and p_to
     and (app_is_manager() or s.seller_id = app_membership_id())
$$;

revoke all on function sale_commissions(date, date) from public;
grant execute on function sale_commissions(date, date) to app_user;
