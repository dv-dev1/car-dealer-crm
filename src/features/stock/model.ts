import { withStore, type Db, type MemberContext } from "@/shared/db/client";
import { todayIso } from "@/shared/today";

import { photoUrl } from "./photos";

export type StockStatus = "preparing" | "available" | "reserved" | "away" | "sold";
export type StockPhoto = { id: string; url: string };
export type StockMoney = { cost: number; profit: number };
export type StockVehicle = {
  id: string;
  slug: string;
  title: string;
  brand: string;
  model: string;
  version: string;
  modelYear: number;
  manufactureYear: number;
  km: number;
  color: string | null;
  fuel: string;
  transmission: string;
  bodyType: string | null;
  doors: number | null;
  engine: string | null;
  power: string | null;
  description: string;
  features: string[];
  featured: boolean;
  price: number;
  minCashPrice: number | null;
  status: StockStatus;
  source: "purchase" | "trade_in" | "consignment";
  enteredOn: string;
  daysInStock: number;
  photos: StockPhoto[];
  money: StockMoney | null;
};

type Row = Omit<StockVehicle, "title" | "price" | "minCashPrice" | "photos" | "money"> & {
  price: string;
  minCashPrice: string | null;
  photos: { id: string; path: string }[];
  cost: string | null;
};

// "reserved" is not stored: an available car with an open reservation reads as reserved.
const SELECT = `
  select v.id, v.slug, v.brand, v.model, v.version, v.model_year as "modelYear", v.manufacture_year as "manufactureYear",
         v.km, v.color, v.fuel, v.transmission, v.body_type as "bodyType", v.doors, v.engine, v.power, v.description,
         v.features, v.featured, v.price, v.min_cash_price as "minCashPrice", v.source,
         to_char(v.entered_on, 'YYYY-MM-DD') as "enteredOn", ($2::date - v.entered_on) as "daysInStock",
         case when v.status = 'available' and exists (
                select from reservations r
                 where r.vehicle_id = v.id and r.canceled_at is null and r.expires_on >= $2::date
              ) then 'reserved' else v.status end as status,
         coalesce((select json_agg(json_build_object('id', p.id, 'path', p.path) order by p.position)
                     from vehicle_photos p where p.vehicle_id = v.id), '[]') as photos,
         %COST% as cost
    from vehicles v
   where v.store_id = $1`;

// A seller never reads vehicle_costs; RLS would return no rows anyway, the query does not rely on it.
function select(ctx: MemberContext, where: string): string {
  const cost = ctx.role === "seller" ? "null::numeric" : "(select c.cost from vehicle_costs c where c.vehicle_id = v.id)";
  return `${SELECT.replace("%COST%", cost)} ${where}`;
}

function toVehicle(row: Row): StockVehicle {
  const price = Number(row.price);
  const minCashPrice = row.minCashPrice === null ? null : Number(row.minCashPrice);
  const cost = row.cost === null ? null : Number(row.cost);
  const { cost: _cost, photos, ...rest } = row;
  return {
    ...rest,
    title: `${row.brand} ${row.model} ${row.version}`,
    price,
    minCashPrice,
    photos: photos.map((photo) => ({ id: photo.id, url: photoUrl(photo.path) })),
    money: cost === null ? null : { cost, profit: (minCashPrice ?? price) - cost },
  };
}

async function read(db: Db, ctx: MemberContext, where: string, params: unknown[]): Promise<StockVehicle[]> {
  return (await db.query<Row>(select(ctx, where), params)).map(toVehicle);
}

/** Cars in the store's yard (not sold, not removed), the longest in stock first. */
export function listStock(ctx: MemberContext, today: string = todayIso()): Promise<StockVehicle[]> {
  return withStore(ctx, (db) =>
    read(db, ctx, "and v.status not in ('sold', 'removed') order by v.entered_on, v.id", [ctx.storeId, today]),
  );
}

/** One car by slug, sold ones included; a removed car is gone. */
export async function getVehicle(ctx: MemberContext, slug: string, today: string = todayIso()): Promise<StockVehicle | null> {
  const [car] = await withStore(ctx, (db) =>
    read(db, ctx, "and v.slug = $3 and v.status <> 'removed'", [ctx.storeId, today, slug]),
  );
  return car ?? null;
}
