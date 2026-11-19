// Legt einen Datenvorrat an: Fundamentaldaten aller Bestandteile eines oder mehrerer Indizes (10 Abrufe je Aktie).
// Aufruf: npm run import:index -- GSPC.INDX STOXX.INDX FTSE.INDX
// Bereits geladene Aktien werden übersprungen, ein abgebrochener Lauf lässt sich also einfach wiederholen.

import { Database } from "../src/data/db.ts";
import { EodhdError } from "../src/data/eodhd.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals, stockFromEodhd } from "../src/data/eodhdFundamentals.ts";

const KIND = "eodhd-fundamentals";
const PARALLEL = 4;

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}
const indices = process.argv.slice(2);
if (indices.length === 0) {
  console.error("Bitte mindestens einen Index nennen, z. B. GSPC.INDX.");
  process.exit(1);
}

const db = new Database("data/investing.sqlite");
const symbols = new Set<string>();
for (const index of indices) {
  const data = JSON.parse(await fetchEodhdFundamentalsRaw(index, token)) as { Components?: Record<string, { Code: string; Exchange: string }> };
  const components = Object.values(data.Components ?? {});
  components.forEach((c) => symbols.add(`${c.Code}.${c.Exchange}`));
  console.log(`${index}: ${components.length} Bestandteile`);
}

const known = db.stockIdsWithRawDocument(KIND);
const todo = [...symbols].filter((s) => !known.has(s)).sort();
console.log(`${symbols.size} Aktien, ${symbols.size - todo.length} schon vorhanden, ${todo.length} zu laden`);

async function fetchWithRetry(symbol: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchEodhdFundamentalsRaw(symbol, token!);
    } catch (error) {
      const permanent = error instanceof EodhdError && [401, 402, 403, 404].includes(error.status);
      if (permanent || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
    }
  }
}

let done = 0;
let failed = 0;
let next = 0;
async function worker(): Promise<void> {
  while (next < todo.length) {
    const symbol = todo[next++]!;
    try {
      const raw = await fetchWithRetry(symbol);
      const parsed = parseEodhdFundamentals(JSON.parse(raw));
      if (parsed.years.length === 0) throw new Error("keine Jahresabschlüsse");
      db.addStockIfMissing(stockFromEodhd(symbol, parsed));
      db.saveRawDocument(symbol, KIND, raw);
      db.saveFundamentals(symbol, parsed.years, "eodhd");
      done++;
    } catch (error) {
      failed++;
      console.log(`fehlt  ${symbol.padEnd(12)} ${error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message}`);
    }
    if ((done + failed) % 50 === 0) console.log(`${done + failed} von ${todo.length} (${failed} fehlgeschlagen)`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
console.log(`Fertig: ${done} geladen, ${failed} fehlgeschlagen.`);
db.close();
process.exit(failed > 0 ? 1 : 0);
