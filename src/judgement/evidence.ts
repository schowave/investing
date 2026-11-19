// Stellt zusammen, was Jev über ein Unternehmen erfährt: Stammdaten und Beschreibung, zehn Geschäftsjahre,
// Gewinnüberraschungen, Insidergeschäfte, bei US-Werten die Mitteilungen an die SEC und, falls vorhanden, die Recherche
// aus dem Netz.

import type { FundamentalsYear, Stock } from "../data/db.ts";
import type { Filing } from "./edgar.ts";

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const num = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const round = (value: number | null, digits = 2) => (value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits);
const ratio = (a: number | null, b: number | null) => (a === null || !b ? null : a / b);

/** Wie viele Quartale und Insidergeschäfte Jev sieht. */
const QUARTERS = 12;
const INSIDER_YEARS = 3;

export interface Evidence {
  asOf: string;
  company: Row;
  fiscalYears: Row[];
  earningsSurprises: Row[];
  insiderTransactions: Row[];
  analystRatings: Row | null;
  /** Mitteilungen an die SEC der letzten zwölf Monate; `null`, wenn nicht abgefragt (kein US-Wert, keine CIK). */
  secFilings: Pick<Filing, "date" | "form" | "description" | "excerpt">[] | null;
  research: string | null;
}

/**
 * @param fundamentalsJson Rohantwort von EODHD (Fundamentals), sofern gespeichert.
 * @param research Text der Recherche aus dem Netz, sofern vorhanden.
 * @param secFilings Mitteilungen an die SEC, sofern abgefragt.
 */
export function buildEvidence(args: {
  stock: Stock;
  years: readonly FundamentalsYear[];
  fundamentalsJson: string | null;
  research: string | null;
  secFilings?: readonly Filing[] | null;
  asOf: string;
}): Evidence {
  const raw = args.fundamentalsJson ? (JSON.parse(args.fundamentalsJson) as Row) : {};
  const general = (raw.General ?? {}) as Row;
  const earnings = (raw.Earnings ?? {}) as Row;

  const officers = Object.values((general.Officers ?? {}) as Row)
    .map((o) => o as Row)
    .map((o) => [text(o.Name), text(o.Title)].filter(Boolean).join(", "))
    .filter((o) => o !== "");

  const company: Row = {
    name: args.stock.name,
    ticker: args.stock.id,
    sector: args.stock.sector,
    industry: text(general.Industry) ?? text(general.GicIndustry),
    country: args.stock.country,
    reportingCurrency: args.stock.reportingCurrency,
    isFinancial: args.stock.isFinancial,
    founded: args.stock.foundedYear,
    ipoDate: text(general.IPODate),
    employees: num(general.FullTimeEmployees),
    description: text(general.Description),
    officers: officers.slice(0, 8),
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

  const earningsSurprises = Object.values((earnings.History ?? {}) as Row)
    .map((q) => q as Row)
    .filter((q) => num(q.epsActual) !== null && num(q.epsEstimate) !== null)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, QUARTERS)
    .map((q) => ({
      quarter: q.date,
      epsActual: num(q.epsActual),
      epsEstimate: round(num(q.epsEstimate), 3),
      surprisePercent: round(num(q.surprisePercent), 1),
    }));

  const cutoff = `${Number(args.asOf.slice(0, 4)) - INSIDER_YEARS}${args.asOf.slice(4)}`;
  const insiderTransactions = Object.values((raw.InsiderTransactions ?? {}) as Row)
    .map((t) => t as Row)
    // Ohne Datum lässt sich nicht sagen, ob ein Geschäft in den Zeitraum fällt ("undefined" >= "2023-…" wäre wahr).
    .filter((t) => {
      const date = text(t.transactionDate) ?? text(t.date);
      return date !== null && date >= cutoff;
    })
    .sort((a, b) => String(b.transactionDate ?? b.date).localeCompare(String(a.transactionDate ?? a.date)))
    .map((t) => ({
      date: t.transactionDate ?? t.date,
      insider: t.ownerName,
      type: t.transactionAcquiredDisposed === "A" ? "buy" : t.transactionAcquiredDisposed === "D" ? "sell" : t.transactionCode,
      shares: num(t.transactionAmount),
      price: num(t.transactionPrice),
      sharesHeldAfter: num(t.postTransactionAmount),
    }));

  const ratings = raw.AnalystRatings as Row | undefined;
  return {
    asOf: args.asOf,
    company,
    fiscalYears,
    earningsSurprises,
    insiderTransactions,
    analystRatings: ratings ? { rating: num(ratings.Rating), targetPrice: num(ratings.TargetPrice) } : null,
    secFilings: args.secFilings
      ? args.secFilings.map(({ date, form, description, excerpt }) => ({ date, form, description, ...(excerpt ? { excerpt } : {}) }))
      : null,
    research: args.research,
  };
}
