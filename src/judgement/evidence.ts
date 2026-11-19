// Stellt zusammen, was Jev über ein Unternehmen erfährt: Stammdaten und Beschreibung, zehn Geschäftsjahre,
// Insidergeschäfte, bei US-Werten die Mitteilungen an die SEC und, falls vorhanden, die Recherche aus dem Netz.
// Die Gewinnüberraschungen des Anbieters gehen nicht mit: Außerhalb der USA mischen sie Einheiten (Pence und Pfund,
// Aktie und Hinterlegungsschein, unbereinigte Splits) und sehen dann wie grobe Verfehlungen aus.

import type { FundamentalsYear, Stock } from "../data/db.ts";
import type { EodhdSnapshot } from "../data/eodhdSnapshot.ts";
import type { Filing } from "./edgar.ts";

type Row = Record<string, unknown>;

const round = (value: number | null, digits = 2) => (value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits);
const ratio = (a: number | null, b: number | null) => (a === null || !b ? null : a / b);

/** Wie weit die Insidergeschäfte zurückreichen, die Jev sieht. */
const INSIDER_YEARS = 3;

export interface Evidence {
  asOf: string;
  company: Row;
  fiscalYears: Row[];
  insiderTransactions: Row[];
  analystRatings: Row | null;
  /** Mitteilungen an die SEC der letzten zwölf Monate; `null`, wenn nicht abgefragt (kein US-Wert, keine CIK). */
  secFilings: Pick<Filing, "date" | "form" | "description" | "excerpt">[] | null;
  research: string | null;
}

/**
 * @param snapshot Momentaufnahme aus der Rohantwort von EODHD, sofern gespeichert.
 * @param research Text der Recherche aus dem Netz, sofern vorhanden.
 * @param secFilings Mitteilungen an die SEC, sofern abgefragt.
 */
export function buildEvidence(args: {
  stock: Stock;
  years: readonly FundamentalsYear[];
  snapshot: EodhdSnapshot | null;
  research: string | null;
  secFilings?: readonly Filing[] | null;
  asOf: string;
}): Evidence {
  const snapshot = args.snapshot;
  const company: Row = {
    name: args.stock.name,
    ticker: args.stock.id,
    sector: args.stock.sector,
    industry: snapshot?.company.industry ?? null,
    country: args.stock.country,
    reportingCurrency: args.stock.reportingCurrency,
    isFinancial: args.stock.isFinancial,
    founded: args.stock.foundedYear,
    ipoDate: snapshot?.company.ipoDate ?? null,
    employees: snapshot?.company.employees ?? null,
    description: snapshot?.company.description ?? null,
    officers: (snapshot?.company.officers ?? []).slice(0, 8),
  };

  const fiscalYears = args.years.slice(-10).map((y) => ({
    year: y.fiscalYear,
    revenue: y.revenue,
    epsDiluted: round(y.epsDiluted),
    ebitMargin: round(ratio(y.ebit, y.revenue), 3),
    netIncomeToEquity: round(ratio(y.epsDiluted !== null && y.shares !== null ? y.epsDiluted * y.shares : null, y.equity), 3),
    freeCashFlow: y.freeCashFlow,
    netDebtToEbitda: y.ebitda !== null && y.ebitda > 0 ? round(ratio(y.netDebt, y.ebitda)) : null,
    dividendPerShare: round(y.dividendPerShare, 3),
    sharesMillions: round(ratio(y.shares, 1e6), 1),
  }));

  const cutoff = `${Number(args.asOf.slice(0, 4)) - INSIDER_YEARS}${args.asOf.slice(4)}`;
  const insiderTransactions = (snapshot?.insiderTransactions ?? [])
    // Ohne Datum lässt sich nicht sagen, ob ein Geschäft in den Zeitraum fällt.
    .filter((t): t is typeof t & { date: string } => t.date !== null && t.date >= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((t) => ({
      date: t.date,
      insider: t.owner,
      type: t.acquiredDisposed === "A" ? "buy" : t.acquiredDisposed === "D" ? "sell" : t.code,
      shares: t.amount,
      price: t.price,
      sharesHeldAfter: t.heldAfter,
    }));

  return {
    asOf: args.asOf,
    company,
    fiscalYears,
    insiderTransactions,
    analystRatings: snapshot?.analystRatings ?? null,
    secFilings: args.secFilings
      ? args.secFilings.map(({ date, form, description, excerpt }) => ({ date, form, description, ...(excerpt ? { excerpt } : {}) }))
      : null,
    research: args.research,
  };
}
