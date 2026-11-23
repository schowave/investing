// Prüfungen der Anbieterdaten, die ohne Urteil auffallen (Spezifikation 4.1). Rein rechnend; sie liefern Hinweise für die
// Aktienseite und ändern keine Rechnung. Gefunden bei der Opus-Bewertung von 150 Titeln im November 2026: Diese Muster
// kehrten dort am häufigsten wieder.

import type { FundamentalsYear, Stock } from "../data/db.ts";

/** Währung des Sitzlands (ISO-Ländercode → Währung) für die Länder des Datenbestands. */
const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
  CO: "COP",
  GB: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  NL: "EUR",
  BE: "EUR",
  LU: "EUR",
  AT: "EUR",
  IT: "EUR",
  ES: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  CY: "EUR",
  SI: "EUR",
  SK: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  HR: "EUR",
  MT: "EUR",
  CH: "CHF",
  SE: "SEK",
  NO: "NOK",
  DK: "DKK",
  IS: "ISK",
  PL: "PLN",
  CZ: "CZK",
  HU: "HUF",
  RO: "RON",
  BG: "BGN",
  TR: "TRY",
  IL: "ILS",
  ZA: "ZAR",
  EG: "EGP",
  NG: "NGN",
  KE: "KES",
  MA: "MAD",
  JP: "JPY",
  KR: "KRW",
  CN: "CNY",
  HK: "HKD",
  TW: "TWD",
  SG: "SGD",
  MY: "MYR",
  TH: "THB",
  ID: "IDR",
  PH: "PHP",
  VN: "VND",
  IN: "INR",
  PK: "PKR",
  KZ: "KZT",
  AU: "AUD",
  NZ: "NZD",
  SA: "SAR",
  AE: "AED",
  QA: "QAR",
};
/** Viele Unternehmen bilanzieren in diesen Währungen statt in der ihres Sitzlands (Rohstoffe, Holdings, Reedereien). */
const COMMON_REPORTING = new Set(["USD", "EUR", "GBP"]);

/** Netto-Rückkäufe über diesem Anteil des Kurses je Jahr gelten bei gleichbleibender Aktienzahl als verdächtig. */
const SUSPICIOUS_BUYBACK_YIELD = 0.05;

export interface DataCheckInput {
  stock: Stock;
  years: readonly FundamentalsYear[];
  /** Dividendenhistorie (Zahlungen mit Art wie „Final“, „Quarterly“); `null`, wenn keine geladen ist. */
  payments: readonly { date: string; value: number; period?: string }[] | null;
  /** Netto-Rückkäufe je Aktie aus der Herleitung. */
  netBuybacksPerShare: number | null;
  /** Kurs in Berichtswährung. */
  price: number | null;
}

/** Hinweise zu verdächtigen Anbieterdaten, jeder als ganzer Satz mit „Daten prüfen:“ am Anfang. */
export function dataWarnings({ stock, years, payments, netBuybacksPerShare, price }: DataCheckInput): string[] {
  const warnings: string[] = [];
  const say = (text: string) => warnings.push(`Daten prüfen: ${text}`);
  const last = years.at(-1);

  // Stammdaten: Berichtswährung passt weder zum Sitzland noch zu einer üblichen Bilanzwährung (HDFC: TWD statt INR).
  const home = COUNTRY_CURRENCY[stock.country];
  if (home && stock.reportingCurrency !== home && !COMMON_REPORTING.has(stock.reportingCurrency)) {
    say(
      `Berichtswährung ${stock.reportingCurrency} passt nicht zum Sitzland ${stock.country} (${home}); Rückfluss und Rendite stehen womöglich in der falschen Währung.`,
    );
  }
  // Stammdaten: Finanzwert nach GICS oder ohne Sektor, aber nicht als Finanzwert geführt (Kaspi, Bank of Cyprus).
  if (!stock.isFinancial && (stock.gicSector === "Financials" || /^(unbekannt|unknown)?$/i.test(stock.sector.trim()))) {
    say(
      stock.gicSector === "Financials"
        ? "Sektor nach GICS ist „Financials“, der Titel gilt aber nicht als Finanzwert; Rückflussdeckel und Faktoren 2, 8, 9 rechnen dann wie bei einem Industrieunternehmen."
        : "Sektor unbekannt; ob der Titel ein Finanzwert ist, lässt sich nicht erkennen.",
    );
  }

  // Dividendenhistorie endet lange vor dem letzten Abschluss, der Abschluss weist aber gezahlte Dividenden aus (Acsion).
  if (last && payments !== null && (last.dividendPerShare ?? 0) > 0) {
    const lastPayment = payments.reduce<string | null>((latest, p) => (latest === null || p.date > latest ? p.date : latest), null);
    const lastPaidYear = lastPayment === null ? null : Number(lastPayment.slice(0, 4));
    if (lastPaidYear === null || lastPaidYear < last.fiscalYear - 1) {
      say(
        `Die Dividendenhistorie endet ${lastPaidYear === null ? "ohne Zahlung" : `${lastPaidYear}`}, der Abschluss ${last.fiscalYear} weist aber gezahlte Dividenden aus; das Dividendenniveau ist womöglich zu niedrig.`,
      );
    }
  }

  // Vermutete Sonderdividenden: eine Zahlung über dem 2,5-Fachen des Medians, ohne Kennzeichnung als Sonderzahlung (GDEV,
  // SIGA, BDCs). Als Regel verworfen (Strategie 11.22), als Hinweis nützlich.
  const regular = (payments ?? []).filter((p) => !/special|extra/i.test(p.period ?? ""));
  if (regular.length >= 4) {
    const sorted = regular.map((p) => p.value).sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    const outliers = regular.filter((p) => p.value > median * 2.5).map((p) => p.date);
    if (outliers.length > 0) {
      say(
        `Zahlung ${outliers.slice(-3).join(", ")} über dem 2,5-Fachen der üblichen Dividende; vermutlich eine Sonderdividende, die das Dividendenniveau hebt.`,
      );
    }
  }
  // Zwei Schlussdividenden in einem Kalenderjahr: Der Anbieter ordnet nach Zahlungsjahr, das erzeugt scheinbare Kürzungen
  // (Strategie 11.21).
  const finals = new Map<number, number>();
  for (const p of payments ?? [])
    if (/^final$/i.test(p.period ?? "")) finals.set(Number(p.date.slice(0, 4)), (finals.get(Number(p.date.slice(0, 4))) ?? 0) + 1);
  const doubled = [...finals].filter(([, n]) => n >= 2).map(([year]) => year);
  if (doubled.length > 0) {
    say(
      `Zwei Schlussdividenden im Kalenderjahr ${doubled.join(", ")}: Die Historie ordnet nach Zahlungsjahr; Kürzungen und Dividendenniveau können scheinbar sein.`,
    );
  }

  // „Rückkäufe“ ohne sinkende Aktienzahl: oft Tilgungen oder Rücknahmen anderer Papiere (Stabilus, PGAS, Hua Xia).
  const recent = years.slice(-6);
  const first = recent[0]?.shares;
  const end = recent.at(-1)?.shares;
  if (
    netBuybacksPerShare &&
    price &&
    price > 0 &&
    first &&
    end &&
    netBuybacksPerShare / price > SUSPICIOUS_BUYBACK_YIELD &&
    end >= first * 0.995
  ) {
    say(
      `Netto-Rückkäufe von ${((netBuybacksPerShare / price) * 100).toFixed(0)} % des Kurses je Jahr, die Aktienzahl ist aber nicht gesunken; vermutlich Tilgungen oder Rücknahmen anderer Papiere. Rückflussniveau von Hand prüfen.`,
    );
  }

  // Felder, aus denen Zahlenfaktoren rechnen, in den letzten fünf Jahren offensichtlich falsch.
  const five = years.slice(-5);
  const ebitAboveRevenue = five.filter((y) => y.ebit !== null && y.revenue !== null && y.revenue > 0 && y.ebit > y.revenue * 1.05);
  if (ebitAboveRevenue.length > 0 && !stock.isFinancial) {
    say(
      `EBIT über dem Umsatz in ${ebitAboveRevenue.map((y) => y.fiscalYear).join(", ")}; die EBIT-Marge (Faktor 9) ist dann nicht belastbar.`,
    );
  }
  const noCashFlow = five.filter((y) => y.operatingCashFlow === null);
  if (noCashFlow.length >= 2) {
    say(
      `Operativer Cashflow fehlt in ${noCashFlow.map((y) => y.fiscalYear).join(", ")}; Rückflussdeckel und Faktor 12 stehen auf weniger Jahren.`,
    );
  }
  const debtWithoutInterest = five.filter((y) => (y.netDebt ?? 0) > 0 && (y.longTermDebt ?? 0) > 0 && y.interestExpense === 0);
  if (debtWithoutInterest.length >= 2 && !stock.isFinancial) {
    say(
      `Schulden ohne Zinsaufwand in ${debtWithoutInterest.map((y) => y.fiscalYear).join(", ")}; die Finanzierung (Faktor 2) ist dann zu günstig.`,
    );
  }
  return warnings;
}
