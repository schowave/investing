// Lädt Fundamentaldaten von EODHD in die Datenbank (10 Abrufe je Aktie, Tarif "Fundamentals" nötig).
// Aufruf: npm run import:eodhd            alle Aktien der Watchlist
//         npm run import:eodhd -- IMB.LSE nur diese Aktie
//         npm run import:eodhd -- --archiv  ohne Abruf neu aus den gespeicherten Rohantworten auswerten

import { Database, FUNDAMENTAL_FIELDS } from "../src/data/db.ts";
import { EodhdError } from "../src/data/eodhd.ts";
import { fetchEodhdFundamentalsRaw, parseEodhdFundamentals } from "../src/data/eodhdFundamentals.ts";

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}
const db = new Database("data/investing.sqlite");
const fromArchive = process.argv.includes("--archiv");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const stocks = db.stocks().filter((s) => wanted.length === 0 || wanted.includes(s.id));
if (stocks.length === 0) {
  console.error(`Keine passende Aktie. Bekannt: ${db.stocks().map((s) => s.id).join(", ")}`);
  process.exit(1);
}

let failed = 0;
for (const stock of stocks) {
  try {
    const archived = fromArchive ? db.rawDocument(stock.id, "eodhd-fundamentals") : null;
    if (fromArchive && !archived) throw new Error("keine gespeicherte Rohantwort");
    const raw = archived?.body ?? (await fetchEodhdFundamentalsRaw(stock.id, token));
    // Die Rohantwort bleibt vollständig erhalten, damit sich später weitere Kennzahlen ohne neuen Abruf gewinnen lassen.
    if (!archived) db.saveRawDocument(stock.id, "eodhd-fundamentals", raw);
    const { years: recent, reportingCurrency } = parseEodhdFundamentals(JSON.parse(raw));
    db.saveFundamentals(stock.id, recent, "eodhd");
    const lastTen = recent.slice(-10);
    const gaps = FUNDAMENTAL_FIELDS.filter((f) => lastTen.some((y) => y[f] === null));
    const complete = lastTen.filter((y) => FUNDAMENTAL_FIELDS.every((f) => y[f] !== null)).length;
    const note = reportingCurrency && reportingCurrency !== stock.reportingCurrency ? `, Währung ${reportingCurrency} statt ${stock.reportingCurrency}` : "";
    console.log(`ok     ${stock.id.padEnd(10)} ${recent.length} Jahre (${recent[0]?.fiscalYear} bis ${recent.at(-1)?.fiscalYear}), ${complete} von 10 vollständig${note}${gaps.length ? `\n         Lücken: ${gaps.join(", ")}` : ""}`);
  } catch (error) {
    failed++;
    const reason = error instanceof EodhdError ? `HTTP ${error.status}${error.status === 403 ? " (Tarif enthält keine Fundamentaldaten)" : ""}` : (error as Error).message;
    console.log(`fehlt  ${stock.id.padEnd(10)} ${reason}`);
  }
}
db.close();
process.exit(failed > 0 ? 1 : 0);
