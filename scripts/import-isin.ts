// Lädt einzelne Aktien über ihre ISIN und nimmt sie auf die Watchlist (Tarif "Fundamentals" nötig, 11 Abrufe je Aktie).
// Aufruf: pnpm run import:isin GB0004544929 US16119P1084
//         pnpm run import:isin --datei positionen.txt     eine ISIN je Zeile; weiterer Text in der Zeile wird ignoriert
// Gedacht für Listen aus einem Depot oder einem fremden Portfolio. In der Oberfläche: Seite „Datenvorrat“.

import { readFileSync } from "node:fs";
import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { addByIsin, isinsIn } from "../src/jobs/stockpile.ts";

const args = process.argv.slice(2);
const fileIndex = args.indexOf("--datei");
const isins = isinsIn(fileIndex >= 0 ? readFileSync(args[fileIndex + 1]!, "utf8") : args.join(" "));
if (isins.length === 0) {
  console.error("Keine ISIN gefunden.");
  process.exit(1);
}
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const result = await addByIsin(consoleContext(db), isins);
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
