// Täglicher Abgleich: Kurse und Wechselkurse laden, Bewertungen und Zielportfolios als Tagesstand speichern.
// Aufruf: npm run sync   (ein EODHD-Abruf je Aktie; reicht das Tagesbudget nicht, kommt der Rest am nächsten Tag)

import { mkdirSync } from "node:fs";
import { Database } from "../src/data/db.ts";
import { START_WATCHLIST } from "../src/data/seed.ts";
import { runDailySync, syncSucceeded } from "../src/sync/dailySync.ts";

mkdirSync("data", { recursive: true });
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
START_WATCHLIST.forEach((stock) => db.addStockIfMissing(stock));

const token = process.env.EODHD_API_TOKEN ?? null;
if (!token) console.log("EODHD_API_TOKEN fehlt in .env.local, Kurse werden nicht geladen.");

const report = await runDailySync(db, token);
console.log(`Abgleich ${report.date} um ${new Date().toISOString().slice(11, 16)} UTC`);
console.log(report.fxError ? `Wechselkurse nicht geladen: ${report.fxError}` : `Wechselkurse vom ${report.fxDate}`);
console.log(`Kurse: ${report.pricesLoaded} geladen, ${report.pricesCurrent} waren aktuell (Tagesbudget ${report.budget} Abrufe).`);
for (const { id, error } of report.priceErrors) console.log(`fehlt  ${id.padEnd(12)} ${error}`);
if (report.pricesDeferred.length > 0) {
  console.log(`Budget erschöpft, folgen beim nächsten Lauf: ${report.pricesDeferred.join(", ")}`);
}
console.log(`${report.valuations} Bewertungen mit Verlauf, ${report.screened} Titel im Screening, ${report.portfolios} Portfolios gespeichert.`);
db.close();
process.exit(syncSucceeded(report) ? 0 : 1);
