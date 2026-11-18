import { listSiteVehicles } from "@/features/site/model";
import type { Veiculo } from "@/types/veiculo";

// The site's one source of cars: the store's stock in the database, for sale or reserved (features/site).

export async function getVeiculos(): Promise<Veiculo[]> {
  return listSiteVehicles();
}

export async function getDestaques(): Promise<Veiculo[]> {
  // Home mostra destaques num grid de 4 colunas. Pra nunca sobrar card órfão
  // numa linha, arredonda pra baixo ao múltiplo de 4 (4, 8, ...). Com menos
  // de 4 destaques, mostra os que houver. O botão "Ver todos" leva ao resto.
  const destaques = (await listSiteVehicles()).filter((v) => v.destaque);
  if (destaques.length < 4) return destaques;
  const linhasCheias = Math.floor(destaques.length / 4) * 4;
  return destaques.slice(0, linhasCheias);
}

export async function getVeiculoBySlug(slug: string): Promise<Veiculo | null> {
  return (await listSiteVehicles()).find((v) => v.slug === slug) ?? null;
}

export async function getOutrosVeiculos(slugAtual: string, limite = 4): Promise<Veiculo[]> {
  return (await listSiteVehicles()).filter((v) => v.slug !== slugAtual).slice(0, limite);
}

export async function contarVeiculos(): Promise<number> {
  return (await listSiteVehicles()).length;
}
