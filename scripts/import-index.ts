// Legt einen Datenvorrat an: Fundamentaldaten aller Bestandteile eines oder mehrerer Indizes (10 Abrufe je Aktie).
// Aufruf: pnpm run import:index GSPC.INDX STOXX.INDX     neue Titel laden, vorhandene überspringen
//         pnpm run import:index KAP.IL KSPI.US           einzelne Symbole
//         pnpm run import:index --boerse=IL              alle Stammaktien einer Börse
//         pnpm run import:index --auffrischen            alle gespeicherten Titel neu laden (vor einer Kündigung)
//         pnpm run import:index --archiv                 ohne Abruf neu aus den gespeicherten Rohantworten auswerten
// Ein abgebrochener Lauf lässt sich einfach wiederholen. In der Oberfläche: Seiten „Abgleich“ und „Datenvorrat“.

import { Database } from "../src/data/db.ts";
import { consoleContext } from "../src/jobs/context.ts";
import { importStockpile, reparseArchive } from "../src/jobs/stockpile.ts";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const plain = args.filter((a) => !a.startsWith("--"));
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const ctx = consoleContext(db);

if (!flags.has("--archiv") && plain.length === 0 && !args.some((a) => a.startsWith("--boerse=")) && !flags.has("--auffrischen")) {
  console.error("Bitte mindestens einen Index nennen, z. B. GSPC.INDX, oder --auffrischen.");
  process.exit(1);
}
const result = flags.has("--archiv")
  ? reparseArchive(ctx)
  : await importStockpile(ctx, {
      indices: plain.filter((a) => a.endsWith(".INDX")),
      symbols: plain.filter((a) => !a.endsWith(".INDX")),
      exchanges: args.filter((a) => a.startsWith("--boerse=")).map((a) => a.slice(9)),
      refreshAll: flags.has("--auffrischen"),
      watch: false,
    });
console.log(result.summary);
db.close();
process.exit(result.ok ? 0 : 1);
