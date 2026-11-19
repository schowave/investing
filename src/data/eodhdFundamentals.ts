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
  /** Land des Firmensitzes als englischer Name aus der Adresse, z. B. "Kazakhstan". */
  seatCountry: string | null;
  /** Art des Wertpapiers, z. B. "Common Stock". */
  securityType: string | null;
  /** Aus dem Beschreibungstext gelesen ("founded in 1901"); `null`, wenn dort nichts steht. */
  foundedYear: number | null;
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
    seatCountry: text((root.General?.AddressData as Row | undefined)?.Country),
    securityType: text(root.General?.Type),
    foundedYear: foundedYearFrom(text(root.General?.Description)),
    quoteCurrency: text(root.General?.CurrencyCode),
  };
}

/** Frühestes plausibles Jahr hinter "founded in", "incorporated in" oder "established in". */
export function foundedYearFrom(description: string | null): number | null {
  if (!description) return null;
  const years = [...description.matchAll(/\b(?:founded|incorporated|established)\s+in\s+(\d{4})\b/gi)]
    .map((match) => Number(match[1]))
    .filter((year) => year >= 1500 && year <= new Date().getFullYear());
  return years.length > 0 ? Math.min(...years) : null;
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

/** Firmensitz nach englischem Ländernamen: ISO-Code und Region. Hinterlegungsscheine notieren oft anderswo. */
const SEATS: Record<string, [string, string]> = {};
const seats = (region: string, list: string) => {
  for (const entry of list.split(";")) {
    const [name, iso] = entry.split("=");
    SEATS[name!.trim()] = [iso!.trim(), region];
  }
};
seats("Europa", "United Kingdom=GB;Germany=DE;France=FR;Italy=IT;Spain=ES;Netherlands=NL;Belgium=BE;Luxembourg=LU;Switzerland=CH;Austria=AT;Ireland=IE;Sweden=SE;Norway=NO;Denmark=DK;Finland=FI;Iceland=IS;Portugal=PT;Greece=GR;Poland=PL;Czech Republic=CZ;Hungary=HU;Slovakia=SK;Slovenia=SI;Estonia=EE;Lithuania=LT;Latvia=LV;Bulgaria=BG;Romania=RO;Cyprus=CY;Malta=MT;Monaco=MC;Jersey=JE;Guernsey=GG;Isle of Man=IM;Gibraltar=GI;Ukraine=UA;Greenland=GL");
seats("Nordamerika", "United States=US;Canada=CA;Bermuda=BM;Cayman Islands=KY;Bahamas=BS;Panama=PA");
seats("Südamerika", "Brazil=BR;Mexico=MX;Argentina=AR;Chile=CL;Colombia=CO;Peru=PE;Uruguay=UY");
seats("Japan", "Japan=JP");
seats("Asien", "China=CN;Hong Kong=HK;Taiwan=TW;South Korea=KR;India=IN;Singapore=SG;Indonesia=ID;Philippines=PH;Vietnam=VN;Thailand=TH;Malaysia=MY;Israel=IL;Turkey=TR;United Arab Emirates=AE;Saudi Arabia=SA;Kazakhstan=KZ;Georgia=GE;Uzbekistan=UZ;Russia=RU;Pakistan=PK;Bangladesh=BD;Qatar=QA;Kuwait=KW;Jordan=JO;Lebanon=LB;Oman=OM;Bahrain=BH");
seats("Afrika", "South Africa=ZA;Egypt=EG;Nigeria=NG;Kenya=KE;Morocco=MA;Mauritius=MU;Ghana=GH");
seats("Ozeanien", "Australia=AU;New Zealand=NZ;Papua New Guinea=PG");

/**
 * Stammdaten für den Datenvorrat aus der Antwort des Anbieters. Es sind Vorschläge: Branche und Land
 * kommen ungeprüft vom Anbieter. Das Land ist der Firmensitz laut Adresse, ersatzweise das der Börse.
 */
export function stockFromEodhd(symbol: string, parsed: EodhdFundamentals): Stock {
  const quote = (parsed.quoteCurrency ?? parsed.reportingCurrency ?? "").toUpperCase();
  const minor = MINOR_UNITS[quote];
  const seat = parsed.seatCountry === null ? undefined : SEATS[parsed.seatCountry];
  const country = seat?.[0] ?? parsed.country ?? "";
  return {
    id: symbol,
    name: parsed.name ?? symbol,
    sector: parsed.sector ?? "Unbekannt",
    region: seat?.[1] ?? REGION_BY_COUNTRY[country] ?? "Unbekannt",
    country,
    reportingCurrency: parsed.reportingCurrency ?? minor?.currency ?? quote,
    priceCurrency: minor?.currency ?? quote,
    priceDivisor: minor?.divisor ?? 1,
    foundedYear: parsed.foundedYear,
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

export interface SearchHit {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  isin: string | null;
  /** Hauptnotiz des Unternehmens laut Anbieter. */
  isPrimary: boolean;
  /** Letzter Schlusskurs in der Einheit der Kursnotiz (bei London Pence). */
  previousClose: number | null;
  previousCloseDate: string | null;
}

/** Symbolsuche (ein Abruf). Liefert auch den letzten Schlusskurs, in jedem Tarif. */
export async function searchEodhd(query: string, token: string, fetchFn: typeof fetch = fetch): Promise<SearchHit[]> {
  const url = new URL(`https://eodhd.com/api/search/${encodeURIComponent(query)}`);
  url.searchParams.set("api_token", token);
  url.searchParams.set("fmt", "json");
  const response = await fetchFn(url);
  if (!response.ok) throw new EodhdError(response.status, `search/${query}`);
  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    symbol: `${String(r.Code)}.${String(r.Exchange)}`,
    name: String(r.Name ?? ""),
    exchange: String(r.Exchange),
    type: String(r.Type ?? ""),
    isin: typeof r.ISIN === "string" && r.ISIN !== "" ? r.ISIN : null,
    isPrimary: r.isPrimary === true,
    previousClose: typeof r.previousClose === "number" && r.previousClose > 0 ? r.previousClose : null,
    previousCloseDate: typeof r.previousCloseDate === "string" ? r.previousCloseDate : null,
  }));
}
