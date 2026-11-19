// Dividenden, Splits und Monatsschlusskurse für alle gespeicherten Aktien (3 Abrufe je Aktie und Art fehlt).

import { fetchDividends, fetchMonthlyCloses, fetchSplits } from "../data/eodhdHistory.ts";
import { eachParallel, type JobContext, type JobResult, requireToken } from "./context.ts";

const PARALLEL = 4;

/** Abrufe, die `loadHistory` brauchen würde: je fehlender Art und Aktie einer. */
export function historyTodo(ctx: Pick<JobContext, "db">, refresh: boolean): { id: string; kind: string }[] {
  const stocks = ctx.db.stocks({ includeStockpile: true });
  // Die Watchlist zuerst, damit sie auch bei knappem Budget vollständig ist.
  stocks.sort((a, b) => Number(b.watched) - Number(a.watched) || a.id.localeCompare(b.id));
  const kinds = ["dividends", "splits", "monthly_prices"];
  const loaded = new Map(kinds.map((kind) => [kind, refresh ? new Set<string>() : ctx.db.stockIdsWithHistory(kind)]));
  return stocks.flatMap((s) => kinds.filter((kind) => !loaded.get(kind)!.has(s.id)).map((kind) => ({ id: s.id, kind })));
}

export async function loadHistory(ctx: JobContext, refresh: boolean): Promise<JobResult> {
  const token = requireToken(ctx);
  const todo = historyTodo(ctx, refresh);
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
  const rest = result.limitReached || result.stopped ? ", Rest offen" : "";
  return {
    summary: `${result.done} Historien geladen, ${result.failed} fehlgeschlagen${rest}`,
    ok: result.failed === 0 && !result.limitReached && !result.stopped,
  };
}
