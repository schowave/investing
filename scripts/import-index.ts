// Legt einen Datenvorrat an: Fundamentaldaten aller Bestandteile eines oder mehrerer Indizes (10 Abrufe je Aktie).
// Aufruf: npm run import:index -- GSPC.INDX STOXX.INDX     neue Titel laden, vorhandene überspringen
//         npm run import:index -- KAP.IL KSPI.US           einzelne Symbole
//         npm run import:index -- --boerse=IL              alle Stammaktien einer Börse
//         npm run import:index -- --auffrischen            alle gespeicherten Titel neu laden (vor einer Kündigung)
//         npm run import:index -- --archiv                 ohne Abruf neu aus den gespeicherten Rohantworten auswerten
// Ein abgebrochener Lauf lässt sich einfach wiederholen.

import { Database } from "../src/data/db.ts";
import { EodhdError } from "../src/data/eodhd.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals, searchEodhd, stockFromEodhd } from "../src/data/eodhdFundamentals.ts";

const KIND = "eodhd-fundamentals";
const PARALLEL = 4;
/** Ersatzbörsen für Titel, deren Heimatbörse der Anbieter nicht führt (Mailand). */
const FALLBACK_EXCHANGES = ["XETRA", "F", "STU", "MU"];

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
const plain = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const indices = plain.filter((a) => a.endsWith(".INDX"));
const symbols = plain.filter((a) => !a.endsWith(".INDX"));
const exchanges = process.argv.slice(2).filter((a) => a.startsWith("--boerse=")).map((a) => a.slice(9));

function store(symbol: string, raw: string, keepRaw: boolean): void {
  const parsed = parseEodhdFundamentals(JSON.parse(raw));
  if (parsed.years.length === 0) throw new Error("keine Jahresabschlüsse");
  const derived = stockFromEodhd(symbol, parsed);
  db.addStockIfMissing(derived);
  db.setSeatInStockpile(symbol, derived.country, derived.region);
  if (parsed.foundedYear !== null) db.setFoundedYearIfMissing(symbol, parsed.foundedYear);
  if (parsed.securityType !== null) db.setSecurityType(symbol, parsed.securityType);
  if (keepRaw) db.saveRawDocument(symbol, KIND, raw);
  db.saveFundamentals(symbol, parsed.years, "eodhd");
}

if (flags.has("--archiv")) {
  let done = 0;
  for (const id of db.stockIdsWithRawDocument(KIND)) {
    store(id, db.rawDocument(id, KIND)!.body, false);
    done++;
  }
  console.log(`${done} Aktien aus dem Archiv neu ausgewertet.`);
  db.close();
  process.exit(0);
}

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}
if (plain.length === 0 && exchanges.length === 0 && !flags.has("--auffrischen")) {
  console.error("Bitte mindestens einen Index nennen, z. B. GSPC.INDX, oder --auffrischen.");
  process.exit(1);
}

const names = new Map<string, string>();
for (const index of indices) {
  const data = JSON.parse(await fetchEodhdFundamentalsRaw(index, token)) as { Components?: Record<string, { Code: string; Exchange: string; Name: string }> };
  const components = Object.values(data.Components ?? {}).filter((c) => c.Code && c.Exchange);
  components.forEach((c) => names.set(`${c.Code}.${c.Exchange}`, c.Name));
  console.log(`${index}: ${components.length} Bestandteile`);
}

symbols.forEach((symbol) => names.set(symbol, ""));
for (const exchange of exchanges) {
  const url = new URL(`https://eodhd.com/api/exchange-symbol-list/${encodeURIComponent(exchange)}`);
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const response = await fetch(url);
  if (!response.ok) throw new EodhdError(response.status, `exchange-symbol-list/${exchange}`);
  const list = ((await response.json()) as { Code: string; Name: string; Type: string }[]).filter((x) => x.Type === "Common Stock");
  list.forEach((x) => names.set(`${x.Code}.${exchange}`, x.Name));
  console.log(`Börse ${exchange}: ${list.length} Stammaktien`);
}

const known = db.stockIdsWithRawDocument(KIND);
const todo = flags.has("--auffrischen") ? [...new Set([...known, ...names.keys()])].sort() : [...names.keys()].filter((s) => !known.has(s)).sort();
console.log(`${todo.length} Aktien zu laden${flags.has("--auffrischen") ? " (Auffrischen)" : `, ${names.size - todo.length} schon vorhanden`}`);

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

/** Sucht dieselbe Aktie an einer deutschen Börse, wenn die Heimatbörse fehlt. */
async function fallbackSymbol(name: string | undefined): Promise<string | null> {
  if (!name) return null;
  const firstWord = name.split(/\s+/)[0]!.toLowerCase();
  const hits = (await searchEodhd(name, token!)).filter(
    (h) => h.type === "Common Stock" && FALLBACK_EXCHANGES.includes(h.exchange) && h.name.toLowerCase().startsWith(firstWord),
  );
  hits.sort((a, b) => FALLBACK_EXCHANGES.indexOf(a.exchange) - FALLBACK_EXCHANGES.indexOf(b.exchange));
  return hits[0]?.symbol ?? null;
}

let done = 0;
let failed = 0;
let next = 0;
let limitReached = false;
async function worker(): Promise<void> {
  while (next < todo.length && !limitReached) {
    const symbol = todo[next++]!;
    try {
      let stored = symbol;
      let raw: string;
      try {
        raw = await fetchWithRetry(symbol);
      } catch (error) {
        if (!(error instanceof EodhdError && error.status === 404)) throw error;
        const alternative = await fallbackSymbol(names.get(symbol));
        if (!alternative) throw error;
        if (known.has(alternative)) {
          done++;
          continue;
        }
        raw = await fetchWithRetry(alternative);
        stored = alternative;
        console.log(`ersatz ${symbol.padEnd(12)} als ${alternative}`);
      }
      store(stored, raw, true);
      done++;
    } catch (error) {
      if (error instanceof EodhdError && error.status === 402) {
        if (!limitReached) console.log(`Tageslimit erreicht bei ${done + failed} von ${todo.length}. Morgen denselben Befehl wiederholen.`);
        limitReached = true;
        return;
      }
      failed++;
      console.log(`fehlt  ${symbol.padEnd(12)} ${error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message}`);
    }
    if ((done + failed) % 250 === 0) console.log(`${done + failed} von ${todo.length} (${failed} fehlgeschlagen)`);
  }
}
await Promise.all(Array.from({ length: PARALLEL }, worker));
console.log(`Fertig: ${done} geladen, ${failed} fehlgeschlagen.`);
db.close();
process.exit(failed > 0 ? 1 : 0);
