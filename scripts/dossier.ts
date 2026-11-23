// Schreibt je Aktie ein Dossier (<ID>.json) mit Vorschlägen, Werten von Hand, Jev, Recherche, Abschlüssen und Dividenden.
// Aufruf: pnpm run bewertung:dossier <verzeichnis> <ID> [<ID> …]
// Ablauf der Bewertung: Skill .claude/skills/bewertung.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "../src/data/db.ts";
import { dossier } from "../src/valuation/assessmentFile.ts";

const [dir, ...ids] = process.argv.slice(2);
if (!dir || ids.length === 0) {
  console.error("Aufruf: pnpm run bewertung:dossier <verzeichnis> <ID> [<ID> …]");
  process.exit(1);
}
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const today = new Date().toISOString().slice(0, 10);
mkdirSync(dir, { recursive: true });
for (const id of ids) {
  try {
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(dossier(db, id, today), null, 1));
    console.log(`ok     ${id}`);
  } catch (error) {
    console.log(`fehlt  ${id}  ${error instanceof Error ? error.message : String(error)}`);
  }
}
db.close();
