import type { Veiculo } from "@/types/veiculo";
import { veiculosMock } from "@/data/veiculos-mock";

// ─── CAMADA DE ACESSO A DADOS ────────────────────────────────
// Fonte única de veículos pro site. Hoje lê do mock local; quando
// as chaves do Supabase entrarem (.env.local), estas funções passam
// a consultar o banco — SEM mudar as telas que as consomem.

export async function getVeiculos(): Promise<Veiculo[]> {
  return veiculosMock.filter((v) => v.status !== "vendido");
}

export async function getDestaques(): Promise<Veiculo[]> {
  // Home mostra destaques num grid de 4 colunas. Pra nunca sobrar card órfão
  // numa linha, arredonda pra baixo ao múltiplo de 4 (4, 8, ...). Com menos
  // de 4 destaques, mostra os que houver. O botão "Ver todos" leva ao resto.
  const destaques = veiculosMock.filter(
    (v) => v.destaque && v.status !== "vendido"
  );
  if (destaques.length < 4) return destaques;
  const linhasCheias = Math.floor(destaques.length / 4) * 4;
  return destaques.slice(0, linhasCheias);
}

export async function getVeiculoBySlug(slug: string): Promise<Veiculo | null> {
  return veiculosMock.find((v) => v.slug === slug) ?? null;
}

export async function getOutrosVeiculos(
  slugAtual: string,
  limite = 4
): Promise<Veiculo[]> {
  return veiculosMock
    .filter((v) => v.slug !== slugAtual && v.status !== "vendido")
    .slice(0, limite);
}

export async function contarVeiculos(): Promise<number> {
  return veiculosMock.filter((v) => v.status !== "vendido").length;
}
