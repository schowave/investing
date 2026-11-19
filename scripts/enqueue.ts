// Stellt einen Lauf in die Warteschlange, ohne auf ihn zu warten (nächtlicher Timer im LXC).
// Aufruf: pnpm run enqueue sync

import { Database } from "../src/data/db.ts";
import { isJobKind, JOB_KINDS } from "../src/jobs/registry.ts";

const kind = process.argv[2] ?? "";
if (!isJobKind(kind)) {
  console.error(`Aufruf: pnpm run enqueue <${Object.keys(JOB_KINDS).join("|")}> [JSON-Parameter]`);
  process.exit(1);
}
const args = JOB_KINDS[kind].args.parse(JSON.parse(process.argv[3] ?? "{}"));
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const { id, existing } = db.enqueueJob(kind, args);
db.close();
console.log(existing ? `Lauf ${id} (${kind}) wartet schon oder läuft` : `Lauf ${id} (${kind}) eingestellt`);
