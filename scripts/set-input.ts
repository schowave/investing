// Setzt oder löscht einen manuellen Wert.
// Aufruf: pnpm run set IMB.LSE risk.moat 5        Prozentwert (5 = 5 %); negative Werte sind ein Bonus
//         pnpm run set IMB.LSE growth 2.3         Wachstum in Prozent
//         pnpm run set IMB.LSE payoutLevel 3.09   Rückfluss je Aktie in Berichtswährung
//         pnpm run set IMB.LSE risk.moat -        manuellen Wert löschen, es gilt wieder der Vorschlag

import { Database } from "../src/data/db.ts";
import { assess, inflationGapOf } from "../src/valuation/run.ts";
import type { InputKey } from "../src/valuation/valuation.ts";
import { INPUT_KEYS, parseManualInput } from "../src/valuation/valuation.ts";

const [stockId, key, rawValue, ...noteParts] = process.argv.slice(2);
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
if (!stockId || !key || rawValue === undefined) fail("Aufruf: pnpm run set <Aktie> <Eingabe> <Wert oder -> [Notiz]");
if (!(INPUT_KEYS as string[]).includes(key!)) fail(`Unbekannte Eingabe. Möglich: ${INPUT_KEYS.join(", ")}`);

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const stock = db.stock(stockId!) ?? fail(`Unbekannte Aktie ${stockId}.`);
const inputKey = key as InputKey;
const today = new Date().toISOString().slice(0, 10);

// Wie das Speichern auf der Aktienseite: mit Tagesstand, damit „Bewertung prüfen“ einen Prüfstand hat.
if (rawValue === "-") {
  assess(db, stock, [{ key: inputKey, value: null }], today);
  console.log(`${stockId} ${key}: manueller Wert gelöscht.`);
} else {
  const parsed = parseManualInput(inputKey, rawValue!, inflationGapOf(db, stock).gap);
  if ("error" in parsed) fail(parsed.error);
  const value = (parsed as { value: number }).value;
  // Die Notiz gilt wie angegeben; ohne Angabe wird die alte gelöscht.
  assess(db, stock, [{ key: inputKey, value, note: noteParts.join(" ") }], today);
  console.log(`${stockId} ${key} = ${inputKey === "payoutLevel" ? value : `${(value * 100).toFixed(2)} %`}`);
}
db.close();
