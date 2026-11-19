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

/** @param date ISO-Datum der Bewertung, z. B. 2026-11-19. */
export function valueStock(db: Database, stock: Stock, date: string): StockValuation {
  const reportingPerEur = db.latestFxRate(stock.reportingCurrency);
  const proposals = proposeInputs(stock, db.fundamentals(stock.id), reportingPerEur, Number(date.slice(0, 4)));

  const manual: InputValues = {};
  for (const input of db.manualInputs(stock.id)) {
    if ((INPUT_KEYS as string[]).includes(input.key)) manual[input.key as InputKey] = input.value;
  }

  const latest = db.latestPrice(stock.id);
  const price = latest ? priceInReportingCurrency(latest.close, db.latestFxRate(stock.priceCurrency), reportingPerEur) : null;
  const valuation = evaluate(proposals.values, manual, price);

  db.saveValuation(stock.id, date, {
    complete: valuation.complete,
    price,
    riskScore: valuation.riskScore,
    innerReturn: valuation.returns?.base ?? null,
    innerReturnCautious: valuation.returns?.cautious ?? null,
    innerReturnOptimistic: valuation.returns?.optimistic ?? null,
    details: { priceDate: latest?.date ?? null, inputs: valuation.inputs, manual: valuation.manual, missing: valuation.missing, proposals },
  });
  return { stock, priceDate: latest?.date ?? null, proposals, valuation };
}
