// Bewertet eine Aktie aus der Datenbank und speichert den Tagesstand.

import type { Database, Stock } from "../data/db.ts";
import type { InputKey, InputValues, Proposals, Valuation } from "./valuation.ts";
import { dividendsByYear, evaluate, INPUT_KEYS, priceInReportingCurrency, proposeInputs } from "./valuation.ts";

export interface StockValuation {
  stock: Stock;
  priceDate: string | null;
  proposals: Proposals;
  valuation: Valuation;
}

/** Rechnet die Bewertung, ohne etwas zu speichern. @param date ISO-Datum der Bewertung, z. B. 2026-11-19. */
export function computeValuation(db: Database, stock: Stock, date: string): StockValuation {
  const reportingPerEur = db.latestFxRate(stock.reportingCurrency);
  const payments = db.dividends(stock.id);
  const history = {
    dividendsByYear: payments === null ? null : dividendsByYear(payments, stock.reportingCurrency, date),
    splits: db.splits(stock.id),
  };
  const proposals = proposeInputs(stock, db.fundamentals(stock.id), reportingPerEur, Number(date.slice(0, 4)), history);

  const manual: InputValues = {};
  for (const input of db.manualInputs(stock.id)) {
    if ((INPUT_KEYS as string[]).includes(input.key)) manual[input.key as InputKey] = input.value;
    // Ein Betrag je Aktie, der vor einem Split gesetzt wurde, passt danach nicht mehr zum Kurs.
    if (input.key === "payoutLevel") manual.payoutLevel = afterSplits(input, history.splits, proposals.notes);
  }

  const latest = db.latestPrice(stock.id);
  const price = latest ? priceInReportingCurrency(latest.close, db.latestFxRate(stock.priceCurrency), reportingPerEur) : null;
  // Fremdwährung: Inflationsunterschied zum Euro abziehen, damit die Renditen vergleichbar sind.
  let inflationGap = 0;
  if (stock.reportingCurrency !== "EUR") {
    const local = db.referenceRate(`inflation:${stock.reportingCurrency}`);
    const euro = db.referenceRate("inflation:EUR");
    if (local !== null && euro !== null) inflationGap = local - euro;
    else
      proposals.notes.push(`Keine Inflationsprognose für ${stock.reportingCurrency}; die Rendite ist nicht mit Euro-Titeln vergleichbar.`);
  }
  const valuation = evaluate(proposals.values, manual, price, inflationGap, proposals.details.earningsLevel);

  return { stock, priceDate: latest?.date ?? null, proposals, valuation };
}

/** Manueller Betrag je Aktie, um alle Splits nach seinem Setzen bereinigt; jede Bereinigung steht in den Hinweisen. */
function afterSplits(
  input: { value: number; updatedAt: string },
  splits: readonly { date: string; ratio: number }[],
  notes: string[],
): number {
  const setOn = input.updatedAt.slice(0, 10);
  let value = input.value;
  for (const split of splits.filter((s) => s.date > setOn && s.ratio > 0)) {
    value /= split.ratio;
    notes.push(
      `Rückflussniveau vom ${setOn} um den Split vom ${split.date} (Verhältnis ${split.ratio.toLocaleString("de-DE")}) bereinigt: ${input.value.toLocaleString("de-DE")} wird zu ${value.toLocaleString("de-DE", { maximumFractionDigits: 4 })}.`,
    );
  }
  return value;
}

/** Rechnet die Bewertung und speichert sie als Tagesstand. */
export function valueStock(db: Database, stock: Stock, date: string): StockValuation {
  const result = computeValuation(db, stock, date);
  const { valuation, proposals, priceDate } = result;
  db.saveValuation(stock.id, date, {
    complete: valuation.complete,
    price: valuation.price,
    riskScore: valuation.riskScore,
    innerReturn: valuation.returns?.base ?? null,
    innerReturnCautious: valuation.returns?.cautious ?? null,
    innerReturnOptimistic: valuation.returns?.optimistic ?? null,
    details: { priceDate, inputs: valuation.inputs, manual: valuation.manual, missing: valuation.missing, proposals },
  });
  return result;
}
