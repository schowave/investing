// Bewertet die Watchlist, speichert den Tagesstand und zeigt die Rangliste.
// Aufruf: pnpm run evaluate              Rangliste der Watchlist
//         pnpm run evaluate IMB.LSE   dazu alle Eingaben dieser Aktie

import type { RiskFactorId } from "../src/calc/index.ts";
import { RISK_FACTORS } from "../src/calc/index.ts";
import { Database } from "../src/data/db.ts";
import { valueStock } from "../src/valuation/run.ts";
import { INPUT_KEYS } from "../src/valuation/valuation.ts";

const percent = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined ? "–" : `${(value * 100).toFixed(digits)} %`;
const amount = (value: number | null | undefined) => (value === null || value === undefined ? "–" : value.toFixed(2));

const db = new Database(process.env.INVESTING_DB ?? "data/investing.sqlite");
const wanted = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);
const results = db.stocks().map((stock) => valueStock(db, stock, today));
results.sort((a, b) => (b.valuation.returns?.base ?? -1) - (a.valuation.returns?.base ?? -1));

// Die Legende gehört zur Ausgabe: Wer die Zahlen weiterrechnet, muss wissen, dass der Inflationsabgleich schon drin ist.
console.log("Kurs und Rückfluss je Aktie in Berichtswährung; Rendite schon um den Inflationsabstand zum Euro gekürzt.");
console.log("Aktie        Kurs      Rückfluss  Wachstum  Risiko  Rendite in EUR (vorsichtig bis optimistisch)  Stand");
for (const { stock, valuation: v } of results) {
  const r = v.returns;
  const state = v.complete ? "vollständig" : `vorläufig, ${v.missing.length} Eingaben offen`;
  console.log(
    `${stock.id.padEnd(12)} ${amount(v.price).padStart(8)}  ${amount(v.inputs.payoutLevel).padStart(9)}  ${percent(v.inputs.growth).padStart(8)}  ` +
      `${percent(v.riskScore, 0).padStart(6)}  ${percent(r?.base).padStart(7)} (${percent(r?.cautious)} bis ${percent(r?.optimistic)})`.padEnd(
        40,
      ) +
      `  ${state}`,
  );
}

for (const { stock, priceDate, proposals, valuation: v } of results.filter((r) => wanted.includes(r.stock.id))) {
  const d = proposals.details;
  console.log(
    `\n${stock.id}  ${stock.name}  (${stock.reportingCurrency}, Geschäftsjahre ${d.fiscalYears[0]} bis ${d.fiscalYears.at(-1)}, Kurs vom ${priceDate ?? "–"})`,
  );
  console.log(
    `  Gewinnniveau ${amount(d.earningsLevel)}, Dividendenniveau ${amount(d.dividendLevel)}, Netto-Rückkäufe ${amount(d.netBuybacksPerShare)}, Rückflussdeckel ${amount(d.sustainablePayout)}`,
  );
  console.log(
    `  Wachstum historisch ${percent(d.historicalGrowth)}, Umsatz je Aktie ${percent(d.revenueGrowth)}, Grenze aus Einbehaltung ${percent(d.retentionCap)}`,
  );
  console.log(`  Risikoklasse ${v.riskClass}, Ausfallwahrscheinlichkeit ${percent(v.defaultProbability)} pro Jahr`);
  for (const key of INPUT_KEYS) {
    const label = key.startsWith("risk.")
      ? RISK_FACTORS[key.slice(5) as RiskFactorId].label
      : key === "growth"
        ? "Wachstum"
        : "Rückflussniveau";
    const show = key === "payoutLevel" ? amount : percent;
    const origin = v.manual.includes(key)
      ? `manuell (Vorschlag ${show(proposals.values[key])})`
      : v.inputs[key] === undefined
        ? "offen"
        : "Vorschlag";
    console.log(`  ${key.padEnd(22)} ${show(v.inputs[key]).padStart(8)}  ${origin.padEnd(28)} ${label}`);
  }
  proposals.notes.forEach((note) => {
    console.log(`  Hinweis: ${note}`);
  });
}
db.close();
