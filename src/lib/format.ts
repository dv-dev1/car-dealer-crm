// Formatação pt-BR usada em todo o site.

export function formatPreco(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function formatKm(km: number): string {
  return `${km.toLocaleString("pt-BR")} km`;
}

/** Whole reais as digits from what a person types: "68.000,00" → "68000". The cents after the comma are dropped. */
export function reaisEmDigitos(valor: string): string {
  return valor.split(",")[0].replace(/\D/g, "");
}
