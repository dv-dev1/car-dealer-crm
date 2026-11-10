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
