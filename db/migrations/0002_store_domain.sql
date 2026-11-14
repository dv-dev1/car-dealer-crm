-- Store domain: stock, customers, sales, money. Every table is per store under RLS; what a seller must not
-- see (cost, profit, financing return, channel cost, commission rules, store expenses) lives in its own table
-- that RLS opens only to owner and manager. References between tables carry store_id, so a row cannot
-- point at another store's row.

alter table stores
  add column is_demo boolean not null default false,
  add column demo_restored_at timestamptz,
  add column whatsapp text check (whatsapp ~ '^55[0-9]{10,11}$'),
  add column city text;

alter table memberships add constraint memberships_id_store_id_key unique (id, store_id);

create function app_membership_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.membership_id', true), '')::uuid $$;

create function app_is_manager() returns boolean
  language sql stable
  as $$ select coalesce(app_role() in ('owner', 'manager'), false) $$;

create table channels (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  unique (store_id, name),
  unique (id, store_id)
);

create table channel_costs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  channel_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount numeric(12,2) not null check (amount >= 0),
  unique (channel_id, month),
  foreign key (channel_id, store_id) references channels (id, store_id) on delete cascade
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  brand text not null,
  model text not null,
  version text not null,
  model_year int not null check (model_year between 1950 and 2100),
  manufacture_year int not null check (manufacture_year between 1950 and 2100),
  km int not null check (km >= 0),
  color text,
  fuel text not null,
  transmission text not null,
  body_type text,
  doors int check (doors between 1 and 6),
  engine text,
  power text,
  description text not null default '',
  features text[] not null default '{}',
  plate text check (plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  renavam text,
  chassis text,
  price numeric(12,2) not null check (price > 0),
  -- Null while the margin is not set; the seller sees it, not the cost behind it.
  min_cash_price numeric(12,2) check (min_cash_price > 0 and min_cash_price <= price),
  -- "reserved" is not a status: it comes from an open reservation when read.
  status text not null default 'preparing' check (status in ('preparing', 'available', 'away', 'sold', 'removed')),
  away_reason text check (away_reason in ('service', 'repair', 'body_shop', 'other')),
  away_until date,
  removed_reason text check (removed_reason in ('wrong_entry', 'returned_to_consignor')),
  source text not null default 'purchase' check (source in ('purchase', 'trade_in', 'consignment')),
  acquired_in_sale_id uuid,
  entered_on date not null,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique (store_id, slug),
  unique (id, store_id),
  check ((status = 'away') = (away_reason is not null)),
  check (away_until is null or status = 'away'),
  check ((status = 'removed') = (removed_reason is not null))
);

create table vehicle_finances (
  vehicle_id uuid primary key,
  store_id uuid not null references stores on delete cascade,
  purchase_price numeric(12,2) not null default 0 check (purchase_price >= 0),
  consignor_name text,
  consignor_phone text check (consignor_phone ~ '^55[0-9]{10,11}$'),
  consignor_payout numeric(12,2) check (consignor_payout > 0),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade
);

create table vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  vehicle_id uuid not null,
  position int not null check (position >= 0),
  path text not null,
  created_at timestamptz not null default now(),
  unique (vehicle_id, position),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade
);

create table vehicle_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  vehicle_id uuid not null,
  category text not null check (category in (
    'mechanical', 'body_paint', 'detailing', 'tires', 'documents', 'transport', 'sourcing_commission', 'other'
  )),
  spent_on date not null,
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade,
  foreign key (created_by, store_id) references memberships (id, store_id) on delete set null (created_by)
);

create table vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  vehicle_id uuid not null,
  item text not null check (item in (
    'ipva', 'fines', 'inspection_report', 'lien', 'transfer_document', 'spare_key', 'manual'
  )),
  status text not null check (status in ('ok', 'pending', 'not_applicable')),
  note text,
  unique (vehicle_id, item),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  name text not null check (btrim(name) <> ''),
  phone text check (phone ~ '^55[0-9]{10,11}$'),
  channel_id uuid,
  seller_id uuid,
  stage text not null default 'new' check (stage in (
    'new', 'visit_scheduled', 'negotiating', 'call_back', 'won', 'lost'
  )),
  interest text,
  vehicle_id uuid,
  note text,
  created_at timestamptz not null default now(),
  first_response_at timestamptz,
  last_contact_at timestamptz,
  visit_on date,
  visit_time time,
  came_on date,
  call_back_on date,
  lost_reason text,
  closed_at timestamptz,
  unique (id, store_id),
  check ((stage in ('won', 'lost')) = (closed_at is not null)),
  foreign key (channel_id, store_id) references channels (id, store_id) on delete set null (channel_id),
  foreign key (seller_id, store_id) references memberships (id, store_id) on delete set null (seller_id),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete set null (vehicle_id)
);

create table lead_contacts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  lead_id uuid not null,
  member_id uuid,
  kind text not null check (kind in ('whatsapp', 'call', 'visit', 'note')),
  happened_at timestamptz not null default now(),
  note text,
  foreign key (lead_id, store_id) references leads (id, store_id) on delete cascade,
  foreign key (member_id, store_id) references memberships (id, store_id) on delete set null (member_id)
);

create table sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  vehicle_id uuid not null unique,
  lead_id uuid,
  seller_id uuid,
  -- Kept when the seller leaves the team, so history and commissions still name them.
  seller_name text not null check (btrim(seller_name) <> ''),
  sold_on date not null,
  price numeric(12,2) not null check (price > 0),
  payment text not null check (payment in ('cash', 'financing')),
  bank text,
  financed_amount numeric(12,2) check (financed_amount > 0 and financed_amount <= price),
  trade_in_vehicle_id uuid,
  warranty_until date not null,
  transfer_done_on date,
  created_at timestamptz not null default now(),
  unique (id, store_id),
  check ((payment = 'financing') = (financed_amount is not null)),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade,
  foreign key (lead_id, store_id) references leads (id, store_id) on delete set null (lead_id),
  foreign key (seller_id, store_id) references memberships (id, store_id) on delete set null (seller_id),
  foreign key (trade_in_vehicle_id, store_id) references vehicles (id, store_id) on delete set null (trade_in_vehicle_id)
);

-- A trade-in vehicle and its sale reference each other; deferred so both go in one transaction.
alter table vehicles add foreign key (acquired_in_sale_id, store_id) references sales (id, store_id)
  on delete set null (acquired_in_sale_id) deferrable initially deferred;

create table sale_finances (
  sale_id uuid primary key,
  store_id uuid not null references stores on delete cascade,
  financing_return_pct numeric(5,4) not null check (financing_return_pct between 0 and 0.2),
  foreign key (sale_id, store_id) references sales (id, store_id) on delete cascade
);

-- What the store paid for the car taken in the sale: a cost, so a seller reads only their own sale's.
create table sale_trade_ins (
  sale_id uuid primary key,
  store_id uuid not null references stores on delete cascade,
  trade_in_value numeric(12,2) not null check (trade_in_value > 0),
  foreign key (sale_id, store_id) references sales (id, store_id) on delete cascade
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  vehicle_id uuid not null,
  lead_id uuid,
  deposit numeric(12,2) not null check (deposit > 0),
  expires_on date not null,
  created_by uuid,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (vehicle_id, store_id) references vehicles (id, store_id) on delete cascade,
  foreign key (lead_id, store_id) references leads (id, store_id) on delete set null (lead_id),
  foreign key (created_by, store_id) references memberships (id, store_id) on delete set null (created_by)
);

-- member_id null is the store's rule; a row with a member is that seller's exception.
create table commission_rules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  member_id uuid,
  kind text not null check (kind in ('fixed', 'sale_pct', 'profit_pct')),
  value numeric(12,4) not null check (value > 0),
  unique nulls not distinct (store_id, member_id),
  foreign key (member_id, store_id) references memberships (id, store_id) on delete cascade
);

-- member_id null is the store's goal.
create table goals (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  month date not null check (extract(day from month) = 1),
  member_id uuid,
  cars int not null check (cars > 0),
  unique nulls not distinct (store_id, month, member_id),
  foreign key (member_id, store_id) references memberships (id, store_id) on delete cascade
);

create table store_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  month date not null check (extract(day from month) = 1),
  category text not null check (category in ('rent', 'payroll', 'accountant', 'utilities', 'other')),
  description text not null default '',
  amount numeric(12,2) not null check (amount > 0)
);

alter table channels enable row level security;
alter table channel_costs enable row level security;
alter table vehicles enable row level security;
alter table vehicle_finances enable row level security;
alter table vehicle_photos enable row level security;
alter table vehicle_expenses enable row level security;
alter table vehicle_documents enable row level security;
alter table leads enable row level security;
alter table lead_contacts enable row level security;
alter table sales enable row level security;
alter table sale_finances enable row level security;
alter table sale_trade_ins enable row level security;
alter table reservations enable row level security;
alter table commission_rules enable row level security;
alter table goals enable row level security;
alter table store_expenses enable row level security;

-- Everyone in the store reads; owner and manager write.
create policy vehicles_select on vehicles for select to app_user using (store_id = app_store_id());
create policy vehicles_manage on vehicles for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy vehicle_photos_select on vehicle_photos for select to app_user using (store_id = app_store_id());
create policy vehicle_photos_manage on vehicle_photos for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy vehicle_documents_select on vehicle_documents for select to app_user using (store_id = app_store_id());
create policy vehicle_documents_manage on vehicle_documents for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy sales_select on sales for select to app_user using (store_id = app_store_id());
create policy sales_manage on sales for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());

-- Only owner and manager, for reading too.
create policy vehicle_finances_manage on vehicle_finances for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy vehicle_expenses_manage on vehicle_expenses for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy sale_finances_manage on sale_finances for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());

-- The seller who made the sale negotiated the trade-in, so they see that value; owner and manager write it.
create policy sale_trade_ins_select on sale_trade_ins for select to app_user using (
  store_id = app_store_id()
  and (app_is_manager() or exists (select from sales s where s.id = sale_id and s.seller_id = app_membership_id()))
);
create policy sale_trade_ins_manage on sale_trade_ins for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());

-- Owner and manager read; only the owner writes.
create policy channel_costs_select on channel_costs for select to app_user
  using (store_id = app_store_id() and app_is_manager());
create policy channel_costs_owner on channel_costs for all to app_user
  using (store_id = app_store_id() and app_role() = 'owner') with check (store_id = app_store_id() and app_role() = 'owner');
create policy commission_rules_select on commission_rules for select to app_user
  using (store_id = app_store_id() and app_is_manager());
create policy commission_rules_owner on commission_rules for all to app_user
  using (store_id = app_store_id() and app_role() = 'owner') with check (store_id = app_store_id() and app_role() = 'owner');

-- Everyone reads the channel names (a lead's origin); only the owner writes.
create policy channels_select on channels for select to app_user using (store_id = app_store_id());
create policy channels_owner on channels for all to app_user
  using (store_id = app_store_id() and app_role() = 'owner') with check (store_id = app_store_id() and app_role() = 'owner');

-- Only the owner.
create policy store_expenses_owner on store_expenses for all to app_user
  using (store_id = app_store_id() and app_role() = 'owner') with check (store_id = app_store_id() and app_role() = 'owner');

-- A seller sees the store goal and their own.
create policy goals_select on goals for select to app_user
  using (store_id = app_store_id() and (app_is_manager() or member_id is null or member_id = app_membership_id()));
create policy goals_manage on goals for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());

-- Every seller sees every lead; a seller creates and edits only their own and cannot hand one over.
create policy leads_select on leads for select to app_user using (store_id = app_store_id());
create policy leads_manage on leads for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy leads_seller_insert on leads for insert to app_user
  with check (store_id = app_store_id() and seller_id = app_membership_id());
create policy leads_seller_update on leads for update to app_user
  using (store_id = app_store_id() and seller_id = app_membership_id())
  with check (store_id = app_store_id() and seller_id = app_membership_id());

create policy lead_contacts_select on lead_contacts for select to app_user using (store_id = app_store_id());
create policy lead_contacts_manage on lead_contacts for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy lead_contacts_seller_insert on lead_contacts for insert to app_user
  with check (
    store_id = app_store_id() and member_id = app_membership_id()
    and exists (select from leads l where l.id = lead_id and l.seller_id = app_membership_id())
  );

-- A seller takes a deposit and cancels the reservations they made.
create policy reservations_select on reservations for select to app_user using (store_id = app_store_id());
create policy reservations_manage on reservations for all to app_user
  using (store_id = app_store_id() and app_is_manager()) with check (store_id = app_store_id() and app_is_manager());
create policy reservations_seller_insert on reservations for insert to app_user
  with check (store_id = app_store_id() and created_by = app_membership_id());
create policy reservations_seller_update on reservations for update to app_user
  using (store_id = app_store_id() and created_by = app_membership_id())
  with check (store_id = app_store_id() and created_by = app_membership_id());

grant select, insert, update, delete on
  channels, channel_costs, vehicles, vehicle_finances, vehicle_photos, vehicle_expenses, vehicle_documents,
  leads, lead_contacts, sales, sale_finances, sale_trade_ins, reservations, commission_rules, goals, store_expenses
  to app_user;

-- Restore: only the owner of a demo store. Locks the store row so two restores run one after the other.
-- Deletes the store's domain rows and the fictional team (e-mails in the reserved .invalid domain).
create function reset_demo_store() returns void
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  demo boolean;
begin
  if app_role() is distinct from 'owner' then
    raise exception 'reset_demo_store: only the owner restores the demo' using errcode = '42501';
  end if;
  select s.is_demo into demo from stores s where s.id = app_store_id() for update;
  if not coalesce(demo, false) then
    raise exception 'reset_demo_store: not a demo store';
  end if;
  delete from sales where store_id = app_store_id();
  delete from reservations where store_id = app_store_id();
  delete from leads where store_id = app_store_id();
  delete from vehicles where store_id = app_store_id();
  delete from channels where store_id = app_store_id();
  delete from commission_rules where store_id = app_store_id();
  delete from goals where store_id = app_store_id();
  delete from store_expenses where store_id = app_store_id();
  delete from memberships where store_id = app_store_id() and email like '%@exemplo.invalid';
  update stores set demo_restored_at = now() where id = app_store_id();
end
$$;

revoke all on function reset_demo_store() from public;
grant execute on function reset_demo_store() to app_user;

-- Same as 0001, now also returning the store's name and demo flag.
drop function resolve_membership(text, text, boolean);
create function resolve_membership(p_workos_user_id text, p_email text, p_email_verified boolean)
  returns table (membership_id uuid, store_id uuid, role text, name text, store_name text, store_is_demo boolean)
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  candidates uuid[];
begin
  if coalesce(btrim(p_workos_user_id), '') = '' then
    return;
  end if;
  if p_email_verified and not exists (select from memberships m where m.workos_user_id = p_workos_user_id) then
    select array_agg(m.id) into candidates from memberships m
     where m.email = lower(btrim(p_email)) and m.workos_user_id is null;
    if cardinality(candidates) = 1 then
      begin
        -- Rechecked after a concurrent login's commit, so the loser links nothing.
        update memberships m set workos_user_id = p_workos_user_id
         where m.id = candidates[1] and m.workos_user_id is null;
      exception when unique_violation then
        null; -- a concurrent login linked another row to this person first; that row is returned below
      end;
    end if;
  end if;
  return query
    select m.id, m.store_id, m.role, m.name, s.name, s.is_demo
      from memberships m join stores s on s.id = m.store_id
     where m.workos_user_id = p_workos_user_id;
end
$$;

revoke all on function resolve_membership(text, text, boolean) from public;
grant execute on function resolve_membership(text, text, boolean) to app_user;
