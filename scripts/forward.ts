// Zeigt das Vorwärtsprotokoll: Was die Anwendung zum Monatsanfang vorgeschlagen hätte und was daraus bis heute wurde.
// Aufruf: pnpm run forward
// Der Abgleich schreibt je Arm ("zahlen", "urteil") und Profil einmal im Monat einen Eintrag (src/valuation/forwardLog.ts).

import { Database } from "../src/data/db.ts";
import { groupSnapshots, overlap, snapshotResult } from "../src/valuation/forwardReport.ts";

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const snapshots = groupSnapshots(db.forwardLog());
if (snapshots.length === 0) {
  console.log("Das Vorwärtsprotokoll ist leer. Der nächste Abgleich legt den ersten Eintrag an.");
  db.close();
  process.exit(0);
}

const priceNow = (stockId: string): number | null => {
  const stock = db.stock(stockId);
  const price = db.latestPrice(stockId);
  const perEur = stock && db.latestFxRate(stock.priceCurrency);
  return price && perEur ? price.close / perEur : null;
};
const percent = (value: number, digits = 1) => `${(value * 100).toFixed(digits).replace(".", ",")} %`;
const today = Date.now();

console.log(
  "Kursrendite seit dem Eintrag, ohne Dividenden, ohne Kosten; Bargeld zählt 0. Arm zahlen = Datenvorrat ohne Urteile, urteil = Watchlist mit Urteilen.",
);
console.log("Datum       Profil      Arm     Version  Titel  investiert  Kurse da  Alter   Rendite");
for (const s of snapshots) {
  const r = snapshotResult(s, priceNow);
  const days = Math.round((today - Date.parse(s.date)) / 864e5);
  console.log(
    `${s.date}  ${s.profile.padEnd(10)}  ${s.arm.padEnd(6)}  ${s.strategyVersion.padEnd(7)}  ${String(r.positions).padStart(5)}  ${percent(r.invested, 0).padStart(10)}  ${percent(r.covered, 0).padStart(8)}  ${`${days} T`.padStart(5)}  ${percent(r.priceReturn).padStart(8)}`,
  );
}

console.log("\nÜberschneidung der Arme (Anteil des Portfolios, den beide halten):");
for (const a of snapshots.filter((s) => s.arm === "zahlen")) {
  const b = snapshots.find((s) => s.arm === "urteil" && s.date.slice(0, 7) === a.date.slice(0, 7) && s.profile === a.profile);
  if (b) console.log(`${a.date}  ${a.profile.padEnd(10)}  ${percent(overlap(a, b), 0)}`);
}
db.close();
