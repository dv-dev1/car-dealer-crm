-- How many times a login code was tried for an e-mail. The edge limit (Cloudflare) counts per location, so
-- someone trying codes from many regions gets many budgets; this one is a single count for the whole world.
-- The app has no grant on the table: it counts only through use_login_attempt. The e-mail is kept as a hash.
create table login_attempts (
  email_hash bytea primary key,
  window_start timestamptz not null,
  attempts int not null check (attempts > 0)
);
alter table login_attempts enable row level security;
create index login_attempts_window_start on login_attempts (window_start);

-- Counts one attempt for the e-mail and says whether it fits the limit of the window. At the limit nothing is
-- counted; a window that has passed starts over. security definer: the table is closed to app_user.
-- The count is one statement, so simultaneous attempts never pass the limit.
create function use_login_attempt(p_email text, p_limit int, p_minutes int)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_hash bytea := sha256(convert_to(lower(btrim(coalesce(p_email, ''))), 'UTF8'));
  v_window interval := make_interval(mins => p_minutes);
  v_attempts int;
begin
  if p_limit < 1 or p_minutes < 1 then
    return false;
  end if;
  -- Anyone can ask for any e-mail: windows that ended a day ago go away, so the table does not grow forever.
  delete from login_attempts where window_start < now() - interval '1 day';
  insert into login_attempts (email_hash, window_start, attempts) values (v_hash, now(), 1)
  on conflict (email_hash) do update
    set window_start = case when login_attempts.window_start <= now() - v_window then now() else login_attempts.window_start end,
        attempts = case when login_attempts.window_start <= now() - v_window then 1 else login_attempts.attempts + 1 end
    where login_attempts.window_start <= now() - v_window or login_attempts.attempts < p_limit
  returning attempts into v_attempts;
  return v_attempts is not null;
end
$$;

revoke all on function use_login_attempt(text, int, int) from public;
grant execute on function use_login_attempt(text, int, int) to app_user;
