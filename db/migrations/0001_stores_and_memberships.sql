-- Roles are cluster-wide, so app_user may already exist from another database on the same server.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user nologin nobypassrls;
  end if;
end
$$;

create table stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  email text not null check (email = lower(btrim(email))),
  name text not null check (btrim(name) <> ''),
  role text not null check (role in ('owner', 'manager', 'seller')),
  workos_user_id text,
  created_at timestamptz not null default now(),
  unique (store_id, email)
);
create index memberships_workos_user_id_idx on memberships (workos_user_id);
create index memberships_email_idx on memberships (email);

-- A pooled connection reads a setting from an ended transaction as '', which must not be cast to uuid.
create function app_store_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.store_id', true), '')::uuid $$;

create function app_role() returns text
  language sql stable
  as $$ select nullif(current_setting('app.role', true), '') $$;

alter table stores enable row level security;
alter table memberships enable row level security;

create policy stores_select on stores for select to app_user
  using (id = app_store_id());

create policy memberships_select on memberships for select to app_user
  using (store_id = app_store_id());
create policy memberships_insert on memberships for insert to app_user
  with check (store_id = app_store_id() and app_role() in ('owner', 'manager'));
create policy memberships_update on memberships for update to app_user
  using (store_id = app_store_id() and app_role() in ('owner', 'manager'))
  with check (store_id = app_store_id() and app_role() in ('owner', 'manager'));
create policy memberships_delete on memberships for delete to app_user
  using (store_id = app_store_id() and app_role() in ('owner', 'manager'));

grant select on stores to app_user;
grant select, insert, update, delete on memberships to app_user;

-- Login runs before any store is known: as the table owner this bypasses RLS and sees every store.
create function resolve_membership(p_workos_user_id text, p_email text, p_email_verified boolean)
  returns table (membership_id uuid, store_id uuid, role text, name text)
  language sql security definer set search_path = public, pg_temp
as $$
  update memberships set workos_user_id = p_workos_user_id
   where p_email_verified and email = lower(btrim(p_email)) and workos_user_id is null;
  select id, store_id, role, name from memberships
   where workos_user_id = p_workos_user_id
   order by created_at, id
   limit 1;
$$;

create function login_email_allowed(p_email text) returns boolean
  language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (select from memberships where email = lower(btrim(p_email)));
$$;

revoke all on function resolve_membership(text, text, boolean) from public;
revoke all on function login_email_allowed(text) from public;
grant execute on function resolve_membership(text, text, boolean) to app_user;
grant execute on function login_email_allowed(text) to app_user;
