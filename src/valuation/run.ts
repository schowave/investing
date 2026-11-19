// Bewertet eine Aktie aus der Datenbank und speichert den Tagesstand.

import type { Database, Stock } from "../data/db.ts";
import { evaluate, INPUT_KEYS, priceInReportingCurrency, proposeInputs } from "./valuation.ts";
import type { InputKey, InputValues, Proposals, Valuation } from "./valuation.ts";

export interface StockValuation {
  stock: Stock;
  priceDate: string | null;
  proposals: Proposals;
  valuation: Valuation;
}

/** Rechnet die Bewertung, ohne etwas zu speichern. @param date ISO-Datum der Bewertung, z. B. 2026-11-19. */
export function computeValuation(db: Database, stock: Stock, date: string): StockValuation {
  const reportingPerEur = db.latestFxRate(stock.reportingCurrency);
  const proposals = proposeInputs(stock, db.fundamentals(stock.id), reportingPerEur, Number(date.slice(0, 4)));

  const manual: InputValues = {};
  for (const input of db.manualInputs(stock.id)) {
    if ((INPUT_KEYS as string[]).includes(input.key)) manual[input.key as InputKey] = input.value;
  }

  const latest = db.latestPrice(stock.id);
  const price = latest ? priceInReportingCurrency(latest.close, db.latestFxRate(stock.priceCurrency), reportingPerEur) : null;
  const valuation = evaluate(proposals.values, manual, price);

  return { stock, priceDate: latest?.date ?? null, proposals, valuation };
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
