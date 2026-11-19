// Täglicher Abgleich: Kurse und Wechselkurse laden, Bewertungen und Zielportfolios als Tagesstand speichern.
// Aufruf: npm run sync   (ein EODHD-Abruf je Aktie der Watchlist; der kostenlose Tarif erlaubt 20 am Tag)

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
for (const price of report.prices) {
  console.log(price.error ? `fehlt  ${price.id.padEnd(12)} ${price.error} (letzter Kurs ${price.date ?? "keiner"})` : `ok     ${price.id.padEnd(12)} Kurs vom ${price.date}`);
}
console.log(`${report.valuations} Bewertungen und ${report.portfolios} Portfolios gespeichert.`);
db.close();
process.exit(syncSucceeded(report) ? 0 : 1);
