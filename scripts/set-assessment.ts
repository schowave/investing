// Setzt Bewertungen aus Ergebnisdateien (<ID>.opus.json) als Werte von Hand, wie das Speichern auf der Aktienseite.
// Aufruf: pnpm run bewertung:setzen <verzeichnis> <ID>[:<Datei>] [… ]   Datei ohne .opus.json, Vorgabe die ID
//         pnpm run bewertung:setzen <verzeichnis> --alle                alle <ID>.opus.json im Verzeichnis
// Notiz je Wert: „Opus-Einschätzung vom <Tag>“ (mit BEWERTUNG_NOTIZ überschreibbar). Am Ende rechnet es Datenvorrat und
// Portfolios neu, damit sie den neuen Stand zeigen.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "../src/data/db.ts";
import { parseAssessment } from "../src/valuation/assessmentFile.ts";
import { recomputeAll } from "../src/valuation/recompute.ts";
import { assess, inflationGapOf } from "../src/valuation/run.ts";

const [dir, ...args] = process.argv.slice(2);
if (!dir || args.length === 0) {
  console.error("Aufruf: pnpm run bewertung:setzen <verzeichnis> <ID>[:<Datei>] … | --alle");
  process.exit(1);
}
const targets =
  args[0] === "--alle"
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".opus.json"))
        .map((f) => f.slice(0, -".opus.json".length))
    : args;
const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const today = new Date().toISOString().slice(0, 10);
const note = process.env.BEWERTUNG_NOTIZ ?? `Opus-Einschätzung vom ${today}`;
const pct = (x: number | null | undefined) => (x == null ? "–" : `${(x * 100).toFixed(1)} %`);
let failed = 0;
for (const target of targets) {
  const [id, file = id] = target.split(":") as [string, string?];
  const stock = db.stock(id);
  if (!stock) {
    console.log(`fehlt  ${id}  unbekannte Aktie`);
    failed++;
    continue;
  }
  const { fields, errors, stockId } = parseAssessment(
    JSON.parse(readFileSync(join(dir, `${file}.opus.json`), "utf8")),
    stock.reportingCurrency,
    inflationGapOf(db, stock).gap,
  );
  if (stockId !== "" && stockId !== id && file === id) errors.push(`Datei gehört zu ${stockId}`);
  if (errors.length > 0) {
    console.log(`nicht  ${id}  ${errors.join("; ")}`);
    failed++;
    continue;
  }
  const { valuation: v } = assess(
    db,
    stock,
    fields.map((f) => ({ ...f, note })),
    today,
  );
  console.log(
    `ok     ${id.padEnd(10)} ${fields.length} Werte; Risiko ${pct(v.riskScore)} (${v.riskClass}), Rendite ${pct(v.returns?.base)}`,
  );
}
if (failed < targets.length) {
  const report = recomputeAll(db, today);
  console.log(`neu gerechnet: ${report.screened} Titel im Datenvorrat, ${report.portfolios} Portfolios`);
}
db.close();
process.exit(failed > 0 ? 1 : 0);
