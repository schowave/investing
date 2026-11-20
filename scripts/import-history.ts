// Lädt Dividenden und Aktiensplits (je Aktie 2 Abrufe), mit --monatskurse auch Monatsschlusskurse (1 weiterer).
// Aufruf: pnpm run import:history                   fehlende für alle gespeicherten Aktien
//         pnpm run import:history --neu             alles neu laden
//         pnpm run import:history --watchlist       nur Watchlist und Bestand
//         pnpm run import:history --rechenbar       Watchlist, Bestand und alle Titel mit berechenbarer Rendite
// Bricht am Tageslimit (abzüglich der Reserve für den Abgleich) sauber ab; derselbe Befehl setzt am nächsten Tag fort.
// In der Oberfläche: Seite „Abgleich“.

import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { loadHistory } from "../src/jobs/history.ts";

const flag = (name: string) => process.argv.includes(name);
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const result = await loadHistory(consoleContext(db), {
  refresh: flag("--neu"),
  scope: flag("--watchlist") ? "watchlist" : flag("--rechenbar") ? "rechenbar" : "alle",
  monthly: flag("--monatskurse"),
});
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
