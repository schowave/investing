// Lädt Fundamentaldaten von EODHD in die Datenbank (10 Abrufe je Aktie, Tarif "Fundamentals" nötig).
// Aufruf: pnpm run import:eodhd            alle Aktien der Watchlist
//         pnpm run import:eodhd IMB.LSE    nur diese Aktie
//         pnpm run import:eodhd --archiv   ohne Abruf neu aus den gespeicherten Rohantworten auswerten
// In der Oberfläche: Aktienseite → „Daten aktualisieren“.

import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { refreshFundamentals } from "../src/jobs/fundamentals.ts";

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const wanted = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const stocks = db.stocks().filter((s) => wanted.length === 0 || wanted.includes(s.id));
if (stocks.length === 0) {
  console.error(
    `Keine passende Aktie. Bekannt: ${db
      .stocks()
      .map((s) => s.id)
      .join(", ")}`,
  );
  process.exit(1);
}
const result = await refreshFundamentals(consoleContext(db), stocks, process.argv.includes("--archiv"));
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
