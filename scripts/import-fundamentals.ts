// Importiert Fundamentaldaten aus einer CSV-Datei.
// Aufruf: npm run import:fundamentals -- IMB.LSE pfad/zur/datei.csv

import { readFileSync } from "node:fs";
import { Database } from "../src/data/db.ts";
import { CSV_HEADER, parseFundamentalsCsv } from "../src/data/fundamentalsCsv.ts";

const [stockId, file] = process.argv.slice(2);
if (!stockId || !file) {
  console.error(`Aufruf: npm run import:fundamentals -- <Symbol> <Datei.csv>\nKopfzeile: ${CSV_HEADER}`);
  process.exit(1);
}

const db = new Database("data/investing.sqlite");
if (!db.stocks().some((s) => s.id === stockId)) {
  console.error(`Unbekanntes Symbol ${stockId}. Bekannt: ${db.stocks().map((s) => s.id).join(", ")}`);
  process.exit(1);
}
const years = parseFundamentalsCsv(readFileSync(file, "utf8"));
db.saveFundamentals(stockId, years, "csv");
const stored = db.fundamentals(stockId);
console.log(`${years.length} Geschäftsjahre importiert; ${stockId} hat jetzt ${stored.length} (${stored[0]?.fiscalYear} bis ${stored.at(-1)?.fiscalYear}).`);
if (stored.length < 10) console.log("Hinweis: Für die Bewertung werden zehn Geschäftsjahre gebraucht.");
db.close();
