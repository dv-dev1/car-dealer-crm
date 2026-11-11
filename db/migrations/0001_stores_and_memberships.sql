-- Roles are cluster-wide, so app_user may already exist from another database on the same server.
do $$
begin
  if not exists (select from pg_roles where rolname = 'app_user') then
    create role app_user nologin nobypassrls;
  end if;
  -- Naming NOSUPERUSER in ALTER ROLE needs a superuser, which Neon's owner is not, so alter only on drift.
  if exists (select from pg_roles where rolname = 'app_user' and (rolsuper or rolbypassrls or rolcanlogin)) then
    alter role app_user nologin nosuperuser nobypassrls;
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
  workos_user_id text check (workos_user_id <> ''),
  created_at timestamptz not null default now(),
  unique (store_id, email)
);
-- A person is linked to at most one store.
create unique index memberships_workos_user_id_key on memberships (workos_user_id) where workos_user_id is not null;
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
-- An owner manages anyone in the store; a manager only sellers, before and after the change.
create policy memberships_insert on memberships for insert to app_user
  with check (store_id = app_store_id() and (app_role() = 'owner' or (app_role() = 'manager' and role = 'seller')));
create policy memberships_update on memberships for update to app_user
  using (store_id = app_store_id() and (app_role() = 'owner' or (app_role() = 'manager' and role = 'seller')))
  with check (store_id = app_store_id() and (app_role() = 'owner' or (app_role() = 'manager' and role = 'seller')));
create policy memberships_delete on memberships for delete to app_user
  using (store_id = app_store_id() and (app_role() = 'owner' or (app_role() = 'manager' and role = 'seller')));

grant select on stores to app_user;
-- workos_user_id is written only by resolve_membership, created_at only by its default.
-- An e-mail is not edited: changing one is remove + add.
grant select, delete on memberships to app_user;
grant insert (store_id, email, name, role), update (name, role) on memberships to app_user;

-- Login runs before any store is known: as the table owner this bypasses RLS and sees every store.
-- A linked person keeps their row; otherwise a verified e-mail links only when exactly one invite is open.
create function resolve_membership(p_workos_user_id text, p_email text, p_email_verified boolean)
  returns table (membership_id uuid, store_id uuid, role text, name text)
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
    select m.id, m.store_id, m.role, m.name from memberships m where m.workos_user_id = p_workos_user_id;
end
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
