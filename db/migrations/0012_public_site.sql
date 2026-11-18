-- The store's public site. A visitor has no store and no role in the session, so RLS gives them no row of any
-- table: these two functions are the whole of what the site reads and writes.

-- The cars for sale of one store, with the public sheet only: no cost, cash minimum, source, consignor, plate,
-- documents nor who reserved. A car with an open reservation is still shown, marked as reserved.
create function site_vehicles(p_store_slug text, p_today date)
  returns table (
    id uuid, slug text, brand text, model text, version text, model_year int, km int, price numeric,
    transmission text, fuel text, color text, doors int, body_type text, power text, engine text,
    description text, features text[], featured boolean, reserved boolean, photos text[]
  )
  language sql stable security definer set search_path = public, pg_temp
as $$
  select v.id, v.slug, v.brand, v.model, v.version, v.model_year, v.km, v.price,
         v.transmission, v.fuel, v.color, v.doors, v.body_type, v.power, v.engine,
         v.description, v.features, v.featured,
         exists (select from reservations r
                  where r.vehicle_id = v.id and r.canceled_at is null and r.expires_on >= p_today) as reserved,
         coalesce((select array_agg(p.path order by p.position) from vehicle_photos p where p.vehicle_id = v.id), '{}') as photos
    from vehicles v
    join stores s on s.id = v.store_id
   where s.slug = p_store_slug and v.status = 'available'
   order by v.featured desc, v.entered_on desc, v.created_at desc
$$;

revoke all on function site_vehicles(text, date) from public;
grant execute on function site_vehicles(text, date) to app_user;

-- "Tenho interesse" on a car's page: a new client of the store, by the channel "Site", with no seller yet.
-- False when the car is not on the site or the name or phone is not one. The same phone about the same car,
-- while that client is open, is answered as received and not written again.
create function create_site_lead(p_store_slug text, p_vehicle_slug text, p_name text, p_phone text)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_store uuid;
  v_vehicle uuid;
  v_title text;
  v_channel uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 2 and 80 or p_phone is null or p_phone !~ '^55[0-9]{10,11}$' then
    return false;
  end if;
  select v.store_id, v.id, v.brand || ' ' || v.model || ' ' || v.version
    into v_store, v_vehicle, v_title
    from vehicles v join stores s on s.id = v.store_id
   where s.slug = p_store_slug and v.slug = p_vehicle_slug and v.status = 'available';
  if v_vehicle is null then
    return false;
  end if;
  if exists (select from leads l
              where l.store_id = v_store and l.phone = p_phone and l.vehicle_id = v_vehicle and l.closed_at is null) then
    return true;
  end if;
  insert into channels (store_id, name) values (v_store, 'Site') on conflict (store_id, name) do nothing;
  select c.id into v_channel from channels c where c.store_id = v_store and c.name = 'Site';
  insert into leads (store_id, name, phone, channel_id, vehicle_id, interest)
  values (v_store, v_name, p_phone, v_channel, v_vehicle, v_title);
  return true;
end
$$;

revoke all on function create_site_lead(text, text, text, text) from public;
grant execute on function create_site_lead(text, text, text, text) to app_user;
