// Lädt einzelne Aktien über ihre ISIN und nimmt sie auf die Watchlist (Tarif "Fundamentals" nötig, 11 Abrufe je Aktie).
// Aufruf: pnpm run import:isin GB0004544929 US16119P1084
//         pnpm run import:isin --datei positionen.txt     eine ISIN je Zeile; weiterer Text in der Zeile wird ignoriert
// Gedacht für Listen aus einem Depot oder einem fremden Portfolio: Tabelle kopieren und als Textdatei speichern.

import { readFileSync } from "node:fs";
import { Database } from "../src/data/db.ts";
import { EodhdError } from "../src/data/eodhd.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals, searchEodhd, stockFromEodhd } from "../src/data/eodhdFundamentals.ts";

const KIND = "eodhd-fundamentals";
const ISIN = /\b[A-Z]{2}[A-Z0-9]{9}[0-9]\b/g;

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}
const args = process.argv.slice(2);
const fileIndex = args.indexOf("--datei");
const text = fileIndex >= 0 ? readFileSync(args[fileIndex + 1]!, "utf8") : args.join(" ");
const isins = [...new Set(text.toUpperCase().match(ISIN) ?? [])];
if (isins.length === 0) {
  console.error("Keine ISIN gefunden.");
  process.exit(1);
}

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const known = db.stockIdsWithRawDocument(KIND);
let failed = 0;
for (const isin of isins) {
  try {
    const hits = (await searchEodhd(isin, token)).filter((h) => h.isin === isin && h.type === "Common Stock");
    if (hits.length === 0) throw new Error("beim Anbieter nicht gefunden");
    // Zuerst eine Notiz, die schon gespeichert ist, dann die Hauptnotiz, dann die übrigen.
    hits.sort((a, b) => Number(known.has(b.symbol)) - Number(known.has(a.symbol)) || Number(b.isPrimary) - Number(a.isPrimary));
    let stored: string | null = null;
    for (const hit of hits) {
      if (known.has(hit.symbol)) {
        stored = hit.symbol;
        break;
      }
      try {
        const raw = await fetchEodhdFundamentalsRaw(hit.symbol, token);
        const parsed = parseEodhdFundamentals(JSON.parse(raw));
        if (parsed.years.length === 0) continue;
        db.addStockIfMissing(stockFromEodhd(hit.symbol, parsed));
        if (parsed.securityType !== null) db.setSecurityType(hit.symbol, parsed.securityType);
        db.saveRawDocument(hit.symbol, KIND, raw);
        db.saveFundamentals(hit.symbol, parsed.years, "eodhd");
        if (hit.previousClose !== null && hit.previousCloseDate !== null) {
          db.saveRawCloses(hit.symbol, [{ date: hit.previousCloseDate, close: hit.previousClose }]);
        }
        known.add(hit.symbol);
        stored = hit.symbol;
        break;
      } catch (error) {
        if (!(error instanceof EodhdError && error.status === 404)) throw error;
      }
    }
    if (!stored) throw new Error("keine Notiz mit Jahresabschlüssen");
    db.setWatched(stored, true);
    const stock = db.stock(stored)!;
    console.log(`ok     ${isin}  ${stored.padEnd(12)} ${stock.name} (${db.fundamentals(stored).length} Jahre)`);
  } catch (error) {
    failed++;
    console.log(`fehlt  ${isin}  ${error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message}`);
  }
}
db.close();
process.exit(failed > 0 ? 1 : 0);
