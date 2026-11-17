-- The store's monthly cost of money: what the cash tied up in a parked car stops earning. Owner and manager
-- change it; nothing else in the store row is writable by the app.
alter table stores
  add column money_rate numeric(5,4) not null default 0.01 check (money_rate between 0 and 0.1);

create policy stores_update on stores for update to app_user
  using (id = app_store_id() and app_is_manager())
  with check (id = app_store_id() and app_is_manager());

grant update (money_rate) on stores to app_user;
