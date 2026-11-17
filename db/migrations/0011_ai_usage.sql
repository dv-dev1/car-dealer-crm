-- How many AI calls each store made in a day, to cap what a store can cost.
-- The app has no grant on the table: it counts only through use_ai_call, so nobody resets or reads the counter.
create table ai_usage (
  store_id uuid not null references stores (id) on delete cascade,
  day date not null,
  calls int not null check (calls > 0),
  primary key (store_id, day)
);
alter table ai_usage enable row level security;

-- Counts one call for the caller's store and says whether it fits the day's limit. At the limit nothing is counted.
-- security definer: the table is closed to app_user. One statement, so simultaneous calls never pass the limit.
create function use_ai_call(p_day date, p_limit int)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_store uuid := app_store_id();
  v_calls int;
begin
  if v_store is null or p_limit < 1 then
    return false;
  end if;
  insert into ai_usage (store_id, day, calls) values (v_store, p_day, 1)
  on conflict (store_id, day) do update set calls = ai_usage.calls + 1 where ai_usage.calls < p_limit
  returning calls into v_calls;
  return v_calls is not null;
end
$$;

revoke all on function use_ai_call(date, int) from public;
grant execute on function use_ai_call(date, int) to app_user;
