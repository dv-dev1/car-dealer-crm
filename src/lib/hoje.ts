// Âncora de "hoje" e utilidades de data do painel do gestor.
//
// Enquanto os dados são mock (leads/agenda fixos em 2026), "hoje" é uma
// constante — assim as telas ficam determinísticas e batem com os dados de
// demonstração. Com o Supabase e dados reais, troca HOJE_ISO por new Date().

export const HOJE_ISO = "2026-07-21"; // 21/07/2026 (terça)

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const DIAS_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_LONGO = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

/** ISO "2026-06-27" → "27/06". */
export function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** ISO → Date local (meia-noite). Evita o shift de fuso do `new Date(iso)`. */
export function isoParaData(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** Date → ISO "YYYY-MM-DD" (local). */
export function dataParaIso(d: Date): string {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${a}-${m}-${dia}`;
}

/** Soma dias a um ISO e devolve ISO. */
export function somaDias(iso: string, dias: number): string {
  const d = isoParaData(iso);
  d.setDate(d.getDate() + dias);
  return dataParaIso(d);
}

/** Quantos dias tem o mês (mes 0-idx). */
export function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/** Dia da semana (0=Dom) do 1º dia do mês. */
export function primeiroDiaSemana(ano: number, mes: number): number {
  return new Date(ano, mes, 1).getDay();
}

/** ISO → "Quinta-feira, 25 de junho". */
export function diaPorExtenso(iso: string): string {
  const d = isoParaData(iso);
  return `${DIAS_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}
