// Täglicher Abgleich: Kurse und Wechselkurse laden, Bewertungen und Zielportfolios als Tagesstand speichern.
// Aufruf: pnpm run sync   (ein EODHD-Abruf je Aktie; reicht das Tagesbudget nicht, kommt der Rest am nächsten Tag)

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { rotateBackup } from "../src/data/backup.ts";
import { Database } from "../src/data/db.ts";
import { START_WATCHLIST } from "../src/data/seed.ts";
import { runDailySync, syncSucceeded } from "../src/sync/dailySync.ts";

const path = process.env.INVESTING_DB ?? "data/investing.sqlite";
// Neben der Datenbank, nicht relativ zum Arbeitsverzeichnis: im Container liegt sie unter /data.
mkdirSync(dirname(path), { recursive: true });
const db = new Database(path);
START_WATCHLIST.forEach((stock) => {
  db.addStockIfMissing(stock);
});

// Vor jedem Abgleich sichern: geht etwas schief, liegt der Stand vom Vortag in data/backups.
console.log(
  `Gesichert: ${rotateBackup(db, process.env.INVESTING_BACKUPS ?? "data/backups", new Date().toISOString().slice(0, 10), Number(process.env.INVESTING_BACKUP_KEEP ?? 7))}`,
);

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
console.log(
  `${report.valuations} Bewertungen mit Verlauf, ${report.screened} Titel im Screening, ${report.portfolios} Portfolios gespeichert.`,
);
db.close();
process.exit(syncSucceeded(report) ? 0 : 1);
