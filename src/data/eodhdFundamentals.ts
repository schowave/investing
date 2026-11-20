// Fundamentaldaten von EODHD (Tarif "Fundamentals", 10 Abrufe je Aktie).
// Die Werte sind um Aktiensplits bereinigt; Beträge kommen als Zeichenketten.

import { z } from "zod";
import type { FundamentalsYear, Stock } from "./db.ts";
import { EodhdError } from "./eodhd.ts";

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
  /** Sektor nach GICS, z. B. "Real Estate". */
  gicSector: string | null;
  /** Aus dem Beschreibungstext gelesen ("founded in 1901"); `null`, wenn dort nichts steht. */
  foundedYear: number | null;
  /** Währung der Kursnotiz, wie der Anbieter sie nennt (z. B. GBX für Pence). */
  quoteCurrency: string | null;
}

type Row = Record<string, unknown>;
type Statement = Record<string, Row>;

/** Jahreswerte eines Abschlusses: Datum -> Posten. Beträge kommen als Text oder Zahl und werden in num() gelesen. */
const Yearly = z.record(z.string(), z.record(z.string(), z.unknown()));
const StatementSchema = z.looseObject({ currency_symbol: z.string().nullish(), yearly: Yearly.optional() });
/**
 * Nur die Teile der rund 1 MB großen Antwort, die gelesen werden. Fehlt etwas oder hat es eine andere Form
 * (etwa eine Fehlermeldung statt eines Objekts), gilt der Teil als leer, statt später in der Bewertung aufzufallen.
 */
const FundamentalsAnswer = z
  .looseObject({
    General: z.looseObject({}).catch({}).optional(),
    Financials: z
      .looseObject({
        Income_Statement: StatementSchema.catch({}).optional(),
        Balance_Sheet: StatementSchema.catch({}).optional(),
        Cash_Flow: StatementSchema.catch({}).optional(),
      })
      .catch({})
      .optional(),
    outstandingShares: z.looseObject({ annual: z.unknown() }).catch({ annual: undefined }).optional(),
  })
  .catch({});
const OutstandingShares = z.looseObject({ date: z.string().nullish(), dateFormatted: z.string().nullish(), shares: z.unknown() });

const SearchRow = z.object({
  Code: z.string(),
  Exchange: z.string(),
  Name: z.string().nullish(),
  Type: z.string().nullish(),
  ISIN: z.string().nullish(),
  isPrimary: z.boolean().nullish(),
  previousClose: z.number().nullish(),
  previousCloseDate: z.string().nullish(),
});

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const absolute = (value: number | null) => (value === null ? null : Math.abs(value));
const sum = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);

function debtLessCash(totalDebt: number | null, longTermDebt: number | null, cash: number | null): number | null {
  const debt = totalDebt ?? longTermDebt;
  return debt === null ? null : debt - (cash ?? 0);
}

/** Höchstens so viele Jahre darf das Nachbarjahr entfernt sein, dessen Aktienzahl eine Lücke füllt. */
const MAX_SHARES_DISTANCE = 2;

/** Aktienzahl je Kalenderjahr aus `outstandingShares.annual` (Liste oder Objekt mit `dateFormatted`/`date` und `shares`). */
function outstandingSharesByYear(value: unknown): Map<number, number> {
  const result = new Map<number, number>();
  if (value === null || typeof value !== "object") return result;
  for (const entry of Object.values(value)) {
    const parsed = OutstandingShares.safeParse(entry);
    if (!parsed.success) continue;
    const year = Number((parsed.data.dateFormatted ?? parsed.data.date ?? "").slice(0, 4));
    const shares = num(parsed.data.shares);
    if (year > 0 && shares !== null && shares > 0) result.set(year, shares);
  }
  return result;
}

/**
 * Aktienzahl je Abschlussdatum. Fehlt sie in der Bilanz, gilt die gemeldete Aktienzahl desselben Jahres, sonst die des
 * nächsten Jahres mit Bilanzangabe (höchstens zwei Jahre entfernt, das frühere bei Gleichstand). Einzelne Lücken
 * würden sonst die ganze Zehnjahresreihe sperren.
 */
function sharesPerDate(dates: readonly string[], balance: Statement, outstanding: Map<number, number>): (number | null)[] {
  const reported = dates.map((date) => {
    const shares = num(balance[date]?.commonStockSharesOutstanding);
    return shares !== null && shares > 0 ? shares : null;
  });
  return reported.map((shares, i) => {
    if (shares !== null) return shares;
    const fromOutstanding = outstanding.get(Number(dates[i]!.slice(0, 4)));
    if (fromOutstanding !== undefined) return fromOutstanding;
    for (let distance = 1; distance <= MAX_SHARES_DISTANCE; distance++) {
      const neighbour = reported[i - distance] ?? reported[i + distance];
      if (neighbour != null) return neighbour;
    }
    return null;
  });
}

export function parseEodhdFundamentals(data: unknown): EodhdFundamentals {
  const root = FundamentalsAnswer.parse(data);
  const income: Statement = root.Financials?.Income_Statement?.yearly ?? {};
  const balance: Statement = root.Financials?.Balance_Sheet?.yearly ?? {};
  const cashFlow: Statement = root.Financials?.Cash_Flow?.yearly ?? {};
  const dates = Object.keys(income).sort();
  const sharesByDate = sharesPerDate(dates, balance, outstandingSharesByYear(root.outstandingShares?.annual));

  const years = dates.map((date, index): FundamentalsYear => {
    const inc = income[date] ?? {};
    const bal = balance[date] ?? {};
    const cf = cashFlow[date] ?? {};
    const shares = sharesByDate[index]!;
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
      netDebt: num(bal.netDebt) ?? debtLessCash(num(bal.shortLongTermDebtTotal), num(bal.longTermDebt), num(bal.cash)),
      interestExpense: absolute(num(inc.interestExpense)),
      ebitda: num(inc.ebitda) ?? sum(num(inc.ebit), num(inc.depreciationAndAmortization)),
    };
  });

  const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
  const currency = root.Financials?.Income_Statement?.currency_symbol;
  return {
    years,
    reportingCurrency: text(currency) ?? text(root.General?.CurrencyCode),
    sector: text(root.General?.Sector),
    country: text(root.General?.CountryISO),
    name: text(root.General?.Name),
    seatCountry: text((root.General?.AddressData as Row | undefined)?.Country),
    securityType: text(root.General?.Type),
    gicSector: text(root.General?.GicSector),
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
  US: "Nordamerika",
  CA: "Nordamerika",
  BM: "Nordamerika",
  MX: "Südamerika",
  BR: "Südamerika",
  CL: "Südamerika",
  JP: "Japan",
  CN: "Asien",
  HK: "Asien",
  SG: "Asien",
  IN: "Asien",
  KR: "Asien",
  TW: "Asien",
  IL: "Asien",
  KZ: "Asien",
  AU: "Ozeanien",
  NZ: "Ozeanien",
  ZA: "Afrika",
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
seats(
  "Europa",
  "United Kingdom=GB;Germany=DE;France=FR;Italy=IT;Spain=ES;Netherlands=NL;Belgium=BE;Luxembourg=LU;Switzerland=CH;Austria=AT;Ireland=IE;Sweden=SE;Norway=NO;Denmark=DK;Finland=FI;Iceland=IS;Portugal=PT;Greece=GR;Poland=PL;Czech Republic=CZ;Hungary=HU;Slovakia=SK;Slovenia=SI;Estonia=EE;Lithuania=LT;Latvia=LV;Bulgaria=BG;Romania=RO;Cyprus=CY;Malta=MT;Monaco=MC;Jersey=JE;Guernsey=GG;Isle of Man=IM;Gibraltar=GI;Ukraine=UA;Greenland=GL",
);
seats("Nordamerika", "United States=US;Canada=CA;Bermuda=BM;Cayman Islands=KY;Bahamas=BS;Panama=PA");
seats("Südamerika", "Brazil=BR;Mexico=MX;Argentina=AR;Chile=CL;Colombia=CO;Peru=PE;Uruguay=UY");
seats("Japan", "Japan=JP");
seats(
  "Asien",
  "China=CN;Hong Kong=HK;Taiwan=TW;South Korea=KR;India=IN;Singapore=SG;Indonesia=ID;Philippines=PH;Vietnam=VN;Thailand=TH;Malaysia=MY;Israel=IL;Turkey=TR;United Arab Emirates=AE;Saudi Arabia=SA;Kazakhstan=KZ;Georgia=GE;Uzbekistan=UZ;Russia=RU;Pakistan=PK;Bangladesh=BD;Qatar=QA;Kuwait=KW;Jordan=JO;Lebanon=LB;Oman=OM;Bahrain=BH",
);
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
export async function fetchEodhdFundamentalsRaw(symbol: string, token: string, fetchFn: typeof fetch = fetch): Promise<string> {
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
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = SearchRow.safeParse(row);
    if (!parsed.success) return [];
    const r = parsed.data;
    return [
      {
        symbol: `${r.Code}.${r.Exchange}`,
        name: r.Name ?? "",
        exchange: r.Exchange,
        type: r.Type ?? "",
        isin: r.ISIN ? r.ISIN : null,
        isPrimary: r.isPrimary === true,
        previousClose: r.previousClose && r.previousClose > 0 ? r.previousClose : null,
        previousCloseDate: r.previousCloseDate ?? null,
      },
    ];
  });
}
