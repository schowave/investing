// Lädt Dividenden, Aktiensplits und Monatsschlusskurse für alle gespeicherten Aktien (3 Abrufe je Aktie).
// Aufruf: pnpm run import:history         fehlende Historien laden
//         pnpm run import:history --neu   alles neu laden
// Bricht am Tageslimit sauber ab; derselbe Befehl setzt am nächsten Tag fort. In der Oberfläche: Seite „Abgleich“.

import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { loadHistory } from "../src/jobs/history.ts";

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const result = await loadHistory(consoleContext(db), process.argv.includes("--neu"));
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
