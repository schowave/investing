// Dividenden und Splits (Plausibilität der Zahlen je Aktie), auf Wunsch Monatsschlusskurse; ein Abruf je Aktie und Art.

import { fetchDividends, fetchMonthlyCloses, fetchSplits } from "../data/eodhdHistory.ts";
import { eachParallel, type JobContext, type JobResult, requireToken } from "./context.ts";
import { capToBudget } from "./reserve.ts";

const PARALLEL = 4;

/** Für wen die Historie geladen wird: Watchlist und Bestand, dazu alle Titel mit berechenbarer Rendite, oder alle. */
type HistoryScope = "watchlist" | "rechenbar" | "alle";

export interface HistoryOptions {
  /** Auch schon geladene Arten neu holen. */
  refresh: boolean;
  scope: HistoryScope;
  /** Monatsschlusskurse mitladen; die Bewertung wertet sie (noch) nicht aus. */
  monthly: boolean;
}

/** Abrufe, die `loadHistory` brauchen würde: je fehlender Art und Aktie einer. */
export function historyTodo(ctx: Pick<JobContext, "db">, options: HistoryOptions): { id: string; kind: string }[] {
  const { db } = ctx;
  const tracked = new Set([...db.stocks().map((s) => s.id), ...db.heldStockIds()]);
  const rated = options.scope === "rechenbar" ? db.ratedStockIds() : new Set<string>();
  const stocks = db.stocks({ includeStockpile: true }).filter((s) => options.scope === "alle" || tracked.has(s.id) || rated.has(s.id));
  // Watchlist und Bestand zuerst, damit sie auch bei knappem Budget vollständig sind.
  stocks.sort((a, b) => Number(tracked.has(b.id)) - Number(tracked.has(a.id)) || a.id.localeCompare(b.id));
  const kinds = options.monthly ? ["dividends", "splits", "monthly_prices"] : ["dividends", "splits"];
  const loaded = new Map(kinds.map((kind) => [kind, options.refresh ? new Set<string>() : db.stockIdsWithHistory(kind)]));
  return stocks.flatMap((s) => kinds.filter((kind) => !loaded.get(kind)!.has(s.id)).map((kind) => ({ id: s.id, kind })));
}

export async function loadHistory(ctx: JobContext, options: HistoryOptions): Promise<JobResult> {
  const token = requireToken(ctx);
  const { items: todo, capped } = await capToBudget(ctx, historyTodo(ctx, options), 1);
  ctx.log(`${todo.length} Abrufe für ${new Set(todo.map((t) => t.id)).size} Aktien`);
  const load: Record<string, (id: string) => Promise<void>> = {
    dividends: async (id) => ctx.db.saveDividends(id, await fetchDividends(id, token, ctx.fetchFn)),
    splits: async (id) => ctx.db.saveSplits(id, await fetchSplits(id, token, ctx.fetchFn)),
    monthly_prices: async (id) => ctx.db.saveMonthlyPrices(id, await fetchMonthlyCloses(id, token, ctx.fetchFn)),
  };
  const result = await eachParallel(
    ctx,
    todo,
    PARALLEL,
    (item) => load[item.kind]!(item.id),
    (item) => `${item.id} ${item.kind}`,
  );
  const rest = result.limitReached || result.stopped || capped ? ", Rest offen" : "";
  return {
    summary: `${result.done} Historien geladen, ${result.failed} fehlgeschlagen${rest}`,
    ok: result.failed === 0 && !result.limitReached && !result.stopped && !capped,
  };
}
