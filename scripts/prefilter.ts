// Vorfilter vor der Bewertung mit Opus: setzt die Ergebnisdateien eines billigen Modells (<ID>.haiku.json) als Werte von Hand
// (Notiz „Haiku-Einschätzung vom <Tag>“, nur wo kein anderer Wert von Hand steht) und teilt die Titel nach der Bewertung damit
// in „verworfen“ und „an Opus“. Titel mit Opus-Bewertung bleiben unberührt. Die Listen stehen zusätzlich in
// <verzeichnis>/vorfilter.json (bei jedem Lauf aus allen Dateien des Verzeichnisses neu); am Ende rechnet es Datenvorrat und
// Portfolios neu. Aufruf: pnpm run bewertung:vorfilter <verzeichnis>
// Ablauf im Skill .claude/skills/bewertung.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Database, MODEL_NOTE } from "../src/data/db.ts";
import { prefilterStock } from "../src/valuation/assessmentFile.ts";
import { recomputeAll } from "../src/valuation/recompute.ts";

const [dir] = process.argv.slice(2);
if (!dir) {
  console.error("Aufruf: pnpm run bewertung:vorfilter <verzeichnis>");
  process.exit(1);
}
const SUFFIX = ".haiku.json";
const ids = readdirSync(dir)
  .filter((f) => f.endsWith(SUFFIX))
  .map((f) => f.slice(0, -SUFFIX.length))
  .sort();
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const today = new Date().toISOString().slice(0, 10);
const note = `${MODEL_NOTE.haiku} vom ${today}`;
const pct = (x: number | null) => (x === null ? "–" : `${(x * 100).toFixed(1)} %`);
const lists = { verworfen: [] as string[], opus: [] as string[], übersprungen: [] as string[], unbekannt: [] as string[] };
for (const id of ids) {
  const stock = db.stock(id);
  if (!stock) {
    lists.unbekannt.push(id);
    console.log(`${"unbekannt".padEnd(12)} ${id}`);
    continue;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(dir, `${id}${SUFFIX}`), "utf8"));
  } catch (error) {
    raw = { error: error instanceof Error ? error.message : String(error) };
  }
  const result = prefilterStock(db, stock, raw, today, note);
  lists[result.verdict].push(id);
  const returnText = "innerReturn" in result ? `Rendite ${pct(result.innerReturn).padStart(8)}  ` : "";
  console.log(`${result.verdict.padEnd(12)} ${id.padEnd(12)} ${returnText}${result.reason}`);
}
writeFileSync(join(dir, "vorfilter.json"), JSON.stringify(lists, null, 1));
console.log(
  `\n${lists.verworfen.length} verworfen, ${lists.opus.length} an Opus, ${lists.übersprungen.length} übersprungen, ` +
    `${lists.unbekannt.length} unbekannt. An Opus: ${lists.opus.join(" ")}`,
);
if (lists.verworfen.length + lists.opus.length > 0) {
  const report = recomputeAll(db, today);
  console.log(`neu gerechnet: ${report.screened} Titel im Datenvorrat, ${report.portfolios} Portfolios`);
}
db.close();
