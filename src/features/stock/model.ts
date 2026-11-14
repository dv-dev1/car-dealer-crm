import { CAMBIOS, CATEGORIAS, COMBUSTIVEIS, CORES, OPCIONAIS } from "@/data/opcoes-veiculo";
import { UUID, withStore, type Db, type MemberContext } from "@/shared/db/client";
import { todayIso } from "@/shared/today";

import { photoUrl } from "./photos";

export type StockStatus = "preparing" | "available" | "reserved" | "away" | "sold";
export type StockPhoto = { id: string; url: string };
/** `acquisitionCost` is the purchase price (or the consignor payout); `cost` adds the car's expenses. */
export type StockMoney = { acquisitionCost: number; cost: number; profit: number };
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
  acquisitionCost: string | null;
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
         %COST%
    from vehicles v
   where v.store_id = $1`;

// A seller never reads vehicle_costs; RLS would return no rows anyway, the query does not rely on it.
function select(ctx: MemberContext, where: string): string {
  const cost =
    ctx.role === "seller"
      ? `null::numeric as cost, null::numeric as "acquisitionCost"`
      : `c.cost, c.acquisition_cost as "acquisitionCost"`;
  const sql = SELECT.replace("%COST%", cost);
  return ctx.role === "seller"
    ? `${sql} ${where}`
    : `${sql.replace("from vehicles v", "from vehicles v left join vehicle_costs c on c.vehicle_id = v.id")} ${where}`;
}

function toVehicle(row: Row): StockVehicle {
  const price = Number(row.price);
  const minCashPrice = row.minCashPrice === null ? null : Number(row.minCashPrice);
  const cost = row.cost === null ? null : Number(row.cost);
  const { cost: _cost, acquisitionCost, photos, ...rest } = row;
  return {
    ...rest,
    title: `${row.brand} ${row.model} ${row.version}`,
    price,
    minCashPrice,
    photos: photos.map((photo) => ({ id: photo.id, url: photoUrl(photo.path) })),
    money: cost === null ? null : { acquisitionCost: Number(acquisitionCost), cost, profit: (minCashPrice ?? price) - cost },
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

export type VehicleInput = {
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
  description: string;
  features: string[];
  featured: boolean;
  price: number;
  /** The consignor's payout for a consigned car, the purchase price otherwise. */
  acquisitionCost: number;
  enteredOn: string;
  /** Ready to advertise: available; otherwise in preparation. */
  ready: boolean;
};

export type SaveVehicleResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: "forbidden" | "not_found" | "not_editable" | "invalid"; field?: keyof VehicleInput };

const MAX_TEXT = 60;
const MAX_DESCRIPTION = 4000;
const MAX_MONEY = 10_000_000;

const within = (list: readonly string[], value: string) => list.includes(value);
const integer = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
const text = (value: string) => value.trim().length >= 1 && value.trim().length <= MAX_TEXT;

/** The first invalid field, or null. Lists come from the form's options, so the screens and the data agree. */
export function validateVehicle(input: VehicleInput, today: string): keyof VehicleInput | null {
  const year = Number(today.slice(0, 4));
  if (!text(input.brand)) return "brand";
  if (!text(input.model)) return "model";
  if (!text(input.version)) return "version";
  if (!integer(input.manufactureYear, 1950, year + 1)) return "manufactureYear";
  if (!integer(input.modelYear, input.manufactureYear, input.manufactureYear + 1)) return "modelYear";
  if (!integer(input.km, 0, 2_000_000)) return "km";
  if (input.color !== null && !within(CORES, input.color)) return "color";
  if (!within(COMBUSTIVEIS, input.fuel)) return "fuel";
  if (!within(CAMBIOS, input.transmission)) return "transmission";
  if (input.bodyType !== null && !within(CATEGORIAS, input.bodyType)) return "bodyType";
  if (input.doors !== null && !integer(input.doors, 2, 5)) return "doors";
  if (input.description.length > MAX_DESCRIPTION) return "description";
  if (new Set(input.features).size !== input.features.length || !input.features.every((f) => within(OPCIONAIS, f))) return "features";
  if (!integer(input.price, 1, MAX_MONEY)) return "price";
  if (!integer(input.acquisitionCost, 0, MAX_MONEY)) return "acquisitionCost";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.enteredOn) || Number.isNaN(Date.parse(input.enteredOn)) || input.enteredOn > today) {
    return "enteredOn";
  }
  return null;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const columns = (input: VehicleInput) => [
  input.brand.trim(),
  input.model.trim(),
  input.version.trim(),
  input.modelYear,
  input.manufactureYear,
  input.km,
  input.color,
  input.fuel,
  input.transmission,
  input.bodyType,
  input.doors,
  input.description.trim(),
  input.features,
  input.featured,
  input.price,
  input.enteredOn,
];

// RLS lets only owner and manager write the stock; the checks here pick the error to show.
export async function createVehicle(ctx: MemberContext, input: VehicleInput, today: string = todayIso()): Promise<SaveVehicleResult> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  const field = validateVehicle(input, today);
  if (field) return { ok: false, error: "invalid", field };

  const id = crypto.randomUUID();
  const slug = `${slugify(`${input.brand} ${input.model} ${input.version} ${input.modelYear}`)}-${id.slice(0, 6)}`;
  await withStore(ctx, async (db) => {
    await db.query(
      `insert into vehicles (brand, model, version, model_year, manufacture_year, km, color, fuel, transmission, body_type, doors,
                             description, features, featured, price, entered_on, id, store_id, slug, status, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'purchase')`,
      [...columns(input), id, ctx.storeId, slug, input.ready ? "available" : "preparing"],
    );
    await db.query("insert into vehicle_finances (vehicle_id, store_id, purchase_price) values ($1, $2, $3)", [
      id,
      ctx.storeId,
      input.acquisitionCost,
    ]);
  });
  return { ok: true, id, slug };
}

// The slug stays, so links to the car keep working. A new price keeps the discount already given.
export async function updateVehicle(
  ctx: MemberContext,
  vehicleId: string,
  input: VehicleInput,
  today: string = todayIso(),
): Promise<SaveVehicleResult> {
  if (ctx.role === "seller") return { ok: false, error: "forbidden" };
  const field = validateVehicle(input, today);
  if (field) return { ok: false, error: "invalid", field };
  if (!UUID.test(vehicleId)) return { ok: false, error: "not_found" };

  return withStore(ctx, async (db): Promise<SaveVehicleResult> => {
    const [car] = await db.query<{ slug: string; status: string; source: string }>(
      "select slug, status, source from vehicles where id = $1 and store_id = $2 for update",
      [vehicleId, ctx.storeId],
    );
    if (!car) return { ok: false, error: "not_found" };
    if (car.status === "sold" || car.status === "removed") return { ok: false, error: "not_editable" };
    if (car.source === "consignment" && input.acquisitionCost <= 0) return { ok: false, error: "invalid", field: "acquisitionCost" };

    await db.query(
      `update vehicles set brand = $1, model = $2, version = $3, model_year = $4, manufacture_year = $5, km = $6, color = $7,
              fuel = $8, transmission = $9, body_type = $10, doors = $11, description = $12, features = $13, featured = $14,
              price = $15, entered_on = $16,
              min_cash_price = case when min_cash_price is null or $15 - (price - min_cash_price) <= 0 then null
                                    else $15 - (price - min_cash_price) end,
              status = case when status in ('preparing', 'available') then $18 else status end
        where id = $17`,
      [...columns(input), vehicleId, input.ready ? "available" : "preparing"],
    );
    const cost = car.source === "consignment" ? "consignor_payout" : "purchase_price";
    await db.query(
      `insert into vehicle_finances (vehicle_id, store_id, ${cost}) values ($1, $2, $3)
       on conflict (vehicle_id) do update set ${cost} = excluded.${cost}`,
      [vehicleId, ctx.storeId, input.acquisitionCost],
    );
    return { ok: true, id: vehicleId, slug: car.slug };
  });
}
