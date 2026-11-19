// Fundamentaldaten von EODHD (Tarif "Fundamentals", 10 Abrufe je Aktie).
// Die Werte sind um Aktiensplits bereinigt; Beträge kommen als Zeichenketten.

import { EodhdError } from "./eodhd.ts";
import type { FundamentalsYear, Stock } from "./db.ts";

export interface EodhdFundamentals {
  /** Geschäftsjahre, ältestes zuerst. */
  years: FundamentalsYear[];
  reportingCurrency: string | null;
  sector: string | null;
  country: string | null;
  name: string | null;
  /** Währung der Kursnotiz, wie der Anbieter sie nennt (z. B. GBX für Pence). */
  quoteCurrency: string | null;
}

type Row = Record<string, unknown>;
type Statement = Record<string, Row>;

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function yearly(financials: Row | undefined, statement: string): Statement {
  const section = financials?.[statement] as { yearly?: Statement } | undefined;
  return section?.yearly ?? {};
}

export function parseEodhdFundamentals(data: unknown): EodhdFundamentals {
  const root = data as { General?: Row; Financials?: Row };
  const income = yearly(root.Financials, "Income_Statement");
  const balance = yearly(root.Financials, "Balance_Sheet");
  const cashFlow = yearly(root.Financials, "Cash_Flow");

  const years = Object.keys(income)
    .sort()
    .map((date): FundamentalsYear => {
      const inc = income[date] ?? {};
      const bal = balance[date] ?? {};
      const cf = cashFlow[date] ?? {};
      const shares = num(bal.commonStockSharesOutstanding);
      const netIncome = num(inc.netIncome);
      const perShare = (amount: number | null) => (amount !== null && shares ? amount / shares : null);
      const dividendsPaid = num(cf.dividendsPaid);
      const stockTrades = num(cf.salePurchaseOfStock);
      return {
        fiscalYear: Number(date.slice(0, 4)),
        // Aus dem Jahresabschluss gerechnet. Das Feld epsActual des Anbieters mischt bei Titeln außerhalb
        // der USA Einheiten (Pence und Pfund, Aktie und Hinterlegungsschein) und ist nicht verlässlich.
        epsDiluted: perShare(netIncome),
        dividendPerShare: perShare(dividendsPaid === null ? null : Math.abs(dividendsPaid)),
        shares,
        // Negativ bedeutet Rückkauf; die Ausgabe neuer Aktien steht in einem eigenen Feld.
        repurchases: stockTrades === null ? null : Math.max(0, -stockTrades),
        issuance: num(cf.issuanceOfCapitalStock) ?? (stockTrades === null ? null : 0),
        stockBasedCompensation: num(cf.stockBasedCompensation),
        revenue: num(inc.totalRevenue),
        ebit: num(inc.ebit),
        totalAssets: num(bal.totalAssets),
        equity: num(bal.totalStockholderEquity),
        currentAssets: num(bal.totalCurrentAssets),
        currentLiabilities: num(bal.totalCurrentLiabilities),
        longTermDebt: num(bal.longTermDebt),
        cash: num(bal.cash),
        operatingCashFlow: num(cf.totalCashFromOperatingActivities),
        freeCashFlow: num(cf.freeCashFlow),
      };
    });

  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  const currency = (root.Financials?.Income_Statement as Row | undefined)?.currency_symbol;
  return {
    years,
    reportingCurrency: text(currency) ?? text(root.General?.CurrencyCode),
    sector: text(root.General?.Sector),
    country: text(root.General?.CountryISO),
    name: text(root.General?.Name),
    quoteCurrency: text(root.General?.CurrencyCode),
  };
}

/** Notiz in einer Unterwährung: Hauptwährung und Teiler. */
const MINOR_UNITS: Record<string, { currency: string; divisor: number }> = {
  GBX: { currency: "GBP", divisor: 100 },
  ILA: { currency: "ILS", divisor: 100 },
  ZAC: { currency: "ZAR", divisor: 100 },
};

const REGION_BY_COUNTRY: Record<string, string> = {
  US: "Nordamerika", CA: "Nordamerika", BM: "Nordamerika", MX: "Südamerika", BR: "Südamerika",
  CL: "Südamerika", JP: "Japan", CN: "Asien", HK: "Asien", SG: "Asien", IN: "Asien", KR: "Asien",
  TW: "Asien", IL: "Asien", KZ: "Asien", AU: "Ozeanien", NZ: "Ozeanien", ZA: "Afrika",
};
const EUROPE = "AT BE CH CY CZ DE DK ES FI FR GB GG GR HU IE IM IS IT JE LU MT NL NO PL PT SE".split(" ");
for (const country of EUROPE) REGION_BY_COUNTRY[country] = "Europa";

/**
 * Stammdaten für den Datenvorrat aus der Antwort des Anbieters. Es sind Vorschläge: Branche und Land
 * kommen ungeprüft vom Anbieter (das Land ist bei Hinterlegungsscheinen das der Börse), das Gründungsjahr fehlt.
 */
export function stockFromEodhd(symbol: string, parsed: EodhdFundamentals): Stock {
  const quote = (parsed.quoteCurrency ?? parsed.reportingCurrency ?? "").toUpperCase();
  const minor = MINOR_UNITS[quote];
  const country = parsed.country ?? "";
  return {
    id: symbol,
    name: parsed.name ?? symbol,
    sector: parsed.sector ?? "Unbekannt",
    region: REGION_BY_COUNTRY[country] ?? "Unbekannt",
    country,
    reportingCurrency: parsed.reportingCurrency ?? minor?.currency ?? quote,
    priceCurrency: minor?.currency ?? quote,
    priceDivisor: minor?.divisor ?? 1,
    foundedYear: null,
    isFinancial: parsed.sector === "Financial Services",
    watched: false,
  };
}

/** Lädt die vollständige, unveränderte Antwort als Text (rund 1 MB je Aktie). */
export async function fetchEodhdFundamentalsRaw(
  symbol: string,
  token: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const url = new URL(`https://eodhd.com/api/fundamentals/${encodeURIComponent(symbol)}`);
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const response = await fetchFn(url);
  if (!response.ok) throw new EodhdError(response.status, `fundamentals/${symbol}`);
  return response.text();
}
