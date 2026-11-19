// Stellt einen Lauf in die Warteschlange, ohne auf ihn zu warten (nächtlicher Timer im LXC).
// Aufruf: pnpm run enqueue sync
//         pnpm run enqueue sync --zeitplan   nur, wenn der automatische Abgleich eingeschaltet ist (Seite „Abgleich“)

import { Database } from "../src/data/db.ts";
import { isJobKind, JOB_KINDS } from "../src/jobs/registry.ts";

const kind = process.argv[2] ?? "";
if (!isJobKind(kind)) {
  console.error(`Aufruf: pnpm run enqueue <${Object.keys(JOB_KINDS).join("|")}> [JSON-Parameter]`);
  process.exit(1);
}
const scheduled = process.argv.includes("--zeitplan");
const json = process.argv.slice(3).find((a) => !a.startsWith("--"));
const args = JOB_KINDS[kind].args.parse(JSON.parse(json ?? "{}"));
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
if (scheduled && !db.autoSync()) {
  console.log("Automatischer Abgleich ist ausgeschaltet (Seite „Abgleich“); nichts eingestellt.");
  db.close();
  process.exit(0);
}
const { id, existing } = db.enqueueJob(kind, args);
db.close();
console.log(existing ? `Lauf ${id} (${kind}) wartet schon oder läuft` : `Lauf ${id} (${kind}) eingestellt`);
