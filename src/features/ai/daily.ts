import { listStock, type StockVehicle } from "@/features/stock/model";
import { priceSuggestion, staleLevel } from "@/features/stock/rules";
import { withStore, type MemberContext } from "@/shared/db/client";

import { complete } from "./client";
import { onlyKnownNumbers, plainSummary, type AiFailure, type DailyFacts } from "./rules";

export type DailyCounts = Pick<DailyFacts, "salesToday" | "newLeadsNoResponse" | "reservationsExpiring">;

/** The day's counts that are not in the stock list. Owner and manager only; null for a seller. */
export async function dailyCounts(ctx: MemberContext, today: string): Promise<DailyCounts | null> {
  if (ctx.role === "seller") return null;
  const [row] = await withStore(ctx, (db) =>
    db.query<DailyCounts>(
      `select (select count(*)::int from sales s where s.store_id = $1 and s.sold_on = $2::date) as "salesToday",
              (select count(*)::int from leads l
                where l.store_id = $1 and l.stage not in ('won', 'lost') and l.first_response_at is null) as "newLeadsNoResponse",
              (select count(*)::int from reservations r join vehicles v on v.id = r.vehicle_id
                where r.store_id = $1 and r.canceled_at is null and r.expires_on between $2::date and $2::date + 1
                  and v.status not in ('sold', 'removed')) as "reservationsExpiring"`,
      [ctx.storeId, today],
    ),
  );
  return row;
}

/** The day's numbers, with the yard's part taken from the stock list the caller already has. */
export function dailyFactsFrom(cars: StockVehicle[], counts: DailyCounts): DailyFacts {
  return {
    ...counts,
    carsOver60: cars.filter((car) => staleLevel(car.daysInStock) === "attention").length,
    carsOver90: cars.filter((car) => staleLevel(car.daysInStock) === "stale").length,
    pendingDocs: cars.filter((car) => car.pendingDocs > 0).length,
    priceSuggestions: cars.filter((car) => priceSuggestion(car)?.suggested != null).length,
  };
}

/** Every number of the day's summary, computed by the server. Null for a seller. */
export async function dailyFacts(ctx: MemberContext, today: string): Promise<DailyFacts | null> {
  if (ctx.role === "seller") return null;
  const [cars, counts] = await Promise.all([listStock(ctx, today), dailyCounts(ctx, today)]);
  return counts && dailyFactsFrom(cars, counts);
}

const SYSTEM =
  "Você redige o resumo do dia de uma revenda de carros para o dono, em 2 a 4 frases curtas, em português do Brasil, sem saudação. " +
  "Use só os números recebidos, exatamente como estão e em algarismos: não some, não calcule, não estime e não cite valor em reais. " +
  "Comece pelo que pede ação hoje. Não cite item com valor zero. Se tudo for zero, diga que o dia está tranquilo.";

const MAX_SUMMARY = 600;

export type DailySummary = { text: string; byAi: boolean; reason?: AiFailure | "numbers" };

/**
 * The day's summary: the numbers are the server's, the wording is the AI's. A text that cites any number the
 * server did not compute is dropped, and so is a failed call: then the server's own lines stand.
 */
export async function dailySummary(ctx: MemberContext, today: string): Promise<DailySummary | null> {
  const facts = await dailyFacts(ctx, today);
  if (!facts) return null;
  const plain = plainSummary(facts).join(" ");
  const answer = await complete(ctx, today, {
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          vendasHoje: facts.salesToday,
          clientesNovosSemResposta: facts.newLeadsNoResponse,
          carrosEntre60e90DiasNoPatio: facts.carsOver60,
          carrosComMaisDe90DiasNoPatio: facts.carsOver90,
          reservasQueVencemAteAmanha: facts.reservationsExpiring,
          carrosComDocumentoPendente: facts.pendingDocs,
          carrosComSugestaoDeBaixarOPreco: facts.priceSuggestions,
        }),
      },
    ],
  });
  if (!answer.ok) return { text: plain, byAi: false, reason: answer.reason };
  const text = answer.text.trim().slice(0, MAX_SUMMARY);
  if (text === "") return { text: plain, byAi: false, reason: "failed" };
  return onlyKnownNumbers(text, facts) ? { text, byAi: true } : { text: plain, byAi: false, reason: "numbers" };
}
