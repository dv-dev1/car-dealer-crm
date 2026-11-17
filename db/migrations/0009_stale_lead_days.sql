-- After how many days without contact an open client counts as stale. Owner and manager change it.
alter table stores
  add column stale_lead_days int not null default 3 check (stale_lead_days between 1 and 30);

grant update (stale_lead_days) on stores to app_user;
