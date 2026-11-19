// Setzt oder löscht einen manuellen Wert.
// Aufruf: npm run set -- IMB.LSE risk.moat 5        Prozentwert (5 = 5 %); negative Werte sind ein Bonus
//         npm run set -- IMB.LSE growth 2.3         Wachstum in Prozent
//         npm run set -- IMB.LSE payoutLevel 3.09   Rückfluss je Aktie in Berichtswährung
//         npm run set -- IMB.LSE risk.moat -        manuellen Wert löschen, es gilt wieder der Vorschlag

import { Database } from "../src/data/db.ts";
import { INPUT_KEYS, parseManualInput } from "../src/valuation/valuation.ts";
import type { InputKey } from "../src/valuation/valuation.ts";

const [stockId, key, rawValue, ...noteParts] = process.argv.slice(2);
const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};
if (!stockId || !key || rawValue === undefined) fail("Aufruf: npm run set -- <Aktie> <Eingabe> <Wert oder -> [Notiz]");
if (!(INPUT_KEYS as string[]).includes(key!)) fail(`Unbekannte Eingabe. Möglich: ${INPUT_KEYS.join(", ")}`);

const db = new Database("data/investing.sqlite");
if (!db.stocks({ includeStockpile: true }).some((s) => s.id === stockId)) fail(`Unbekannte Aktie ${stockId}.`);

if (rawValue === "-") {
  db.clearManualInput(stockId!, key!);
  console.log(`${stockId} ${key}: manueller Wert gelöscht.`);
} else {
  const inputKey = key as InputKey;
  const parsed = parseManualInput(inputKey, rawValue!);
  if ("error" in parsed) fail(parsed.error);
  const value = (parsed as { value: number }).value;
  db.setManualInput(stockId!, key!, value, noteParts.join(" "));
  console.log(`${stockId} ${key} = ${inputKey === "payoutLevel" ? value : `${(value * 100).toFixed(2)} %`}`);
}
db.close();
