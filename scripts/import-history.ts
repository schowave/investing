// Lädt Dividenden, Aktiensplits und Monatsschlusskurse für alle gespeicherten Aktien (3 Abrufe je Aktie).
// Aufruf: pnpm run import:history            fehlende Historien laden
//         pnpm run import:history --neu   alles neu laden
// Bricht am Tageslimit sauber ab; derselbe Befehl setzt am nächsten Tag fort.

import { Database } from "../src/data/db.ts";
import { EodhdError } from "../src/data/eodhd.ts";
import { fetchDividends, fetchMonthlyCloses, fetchSplits } from "../src/data/eodhdHistory.ts";

const PARALLEL = 4;
const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const refresh = process.argv.includes("--neu");
const stocks = db.stocks({ includeStockpile: true });
// Die Watchlist zuerst, damit sie auch bei knappem Budget vollständig ist.
stocks.sort((a, b) => Number(b.watched) - Number(a.watched) || a.id.localeCompare(b.id));

const kinds = [
  { kind: "dividends", load: async (id: string) => db.saveDividends(id, await fetchDividends(id, token)) },
  { kind: "splits", load: async (id: string) => db.saveSplits(id, await fetchSplits(id, token)) },
  { kind: "monthly_prices", load: async (id: string) => db.saveMonthlyPrices(id, await fetchMonthlyCloses(id, token)) },
];
const loaded = new Map(kinds.map((k) => [k.kind, refresh ? new Set<string>() : db.stockIdsWithHistory(k.kind)]));
const todo = stocks.flatMap((s) => kinds.filter((k) => !loaded.get(k.kind)!.has(s.id)).map((k) => ({ id: s.id, ...k })));
console.log(`${todo.length} Abrufe für ${new Set(todo.map((t) => t.id)).size} Aktien`);

let done = 0;
let failed = 0;
let next = 0;
let limitReached = false;
async function worker(): Promise<void> {
  while (next < todo.length && !limitReached) {
    const task = todo[next++]!;
    try {
      await task.load(task.id);
      done++;
    } catch (error) {
      if (error instanceof EodhdError && error.status === 402) {
        if (!limitReached) console.log(`Tageslimit erreicht nach ${done} Abrufen. Morgen denselben Befehl wiederholen.`);
        limitReached = true;
        return;
      }
      failed++;
      if (failed <= 30)
        console.log(
          `fehlt  ${task.id.padEnd(12)} ${task.kind}: ${error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message}`,
        );
    }
    if ((done + failed) % 2000 === 0) console.log(`${done + failed} von ${todo.length} (${failed} fehlgeschlagen)`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
console.log(`Fertig: ${done} geladen, ${failed} fehlgeschlagen${limitReached ? ", Rest offen" : ""}.`);
db.close();
process.exit(limitReached || failed > 0 ? 1 : 0);
