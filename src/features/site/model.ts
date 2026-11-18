import { cache } from "react";

import { photoUrl } from "@/features/stock/photos";
import { withoutStore } from "@/shared/db/client";
import { todayIso } from "@/shared/today";
import type { Veiculo } from "@/types/veiculo";

/** The store the public site shows: one per deploy, until each store has its own address. */
export function siteStoreSlug(): string {
  return process.env.SITE_STORE_SLUG || "mare-veiculos";
}

type Row = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  version: string;
  model_year: number;
  km: number;
  price: string;
  transmission: string;
  fuel: string;
  color: string | null;
  doors: number | null;
  body_type: string | null;
  power: string | null;
  engine: string | null;
  description: string;
  features: string[];
  featured: boolean;
  reserved: boolean;
  photos: string[];
};

async function readSiteVehicles(today: string): Promise<Veiculo[]> {
  // The visitor has no store: site_vehicles is the only thing this connection can read (0012).
  const rows = await withoutStore((db) => db.query<Row>("select * from site_vehicles($1, $2)", [siteStoreSlug(), today]));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    marca: row.brand,
    modelo: row.model,
    titulo: `${row.brand} ${row.model} ${row.version}`,
    ano: row.model_year,
    km: row.km,
    preco: Number(row.price),
    cambio: row.transmission,
    combustivel: row.fuel,
    cor: row.color ?? undefined,
    portas: row.doors ?? undefined,
    carroceria: row.body_type ?? undefined,
    potencia: row.power ?? undefined,
    motor: row.engine ?? undefined,
    descricao: row.description || undefined,
    fotos: row.photos.map(photoUrl),
    equipamentos: row.features,
    fichaTecnica: Object.fromEntries(
      Object.entries({ Motor: row.engine, Câmbio: row.transmission, "Tipo de carroceria": row.body_type, Potência: row.power }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    ),
    status: row.reserved ? "reservado" : "disponivel",
    destaque: row.featured,
  }));
}

/** The cars for sale of the site's store, featured first. Read once per request, however many blocks ask. */
export const listSiteVehicles = cache((today: string = todayIso()) => readSiteVehicles(today));
