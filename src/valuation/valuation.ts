// Bewertung einer Aktie: Vorschläge aus den Fundamentaldaten, manuelle Übersteuerung, innere Rendite.
// Reine Rechnung ohne Datenbank- und Netzzugriff (Strategie 3 bis 6).

import type { Region, ReturnInputs, RiskClass, RiskFactorId, RiskRatings, ScenarioReturns } from "../calc/index.ts";
import {
  assessRisk,
  comparableReturn,
  defaultProbability,
  dividendLevel,
  dividendWasCut,
  earningsLevel,
  FINANCIAL_STAND_INS,
  FULL_YEARS,
  growthParamsFor,
  growthProposal,
  historicalGrowth,
  innerReturn,
  lossesAtEnd,
  lowerGrowth,
  MANUAL_FOR_FINANCIALS,
  MIN_YEARS,
  netBuybacksPerShare,
  payoutLevelProposal,
  proposeAge,
  proposeCashFlow,
  proposeCountry,
  proposeCurrency,
  proposeEarnings,
  proposeFinancing,
  proposeProfitability,
  proposeSize,
  RISK_FACTOR_IDS,
  RISK_FACTORS,
  requiredDebtRepayment,
  returnParamsFor,
  riskClass,
  scenarioReturns,
  sustainableCashFlow,
  terminalPayoutRatio,
  toLocalTerms,
  usableCompensation,
} from "../calc/index.ts";
import type { FundamentalsYear, Stock } from "../data/db.ts";

/** Schlüssel einer Eingabe: `payoutLevel`, `growth` oder `risk.<Faktor>`. */
export type InputKey = "payoutLevel" | "growth" | `risk.${RiskFactorId}`;

export const INPUT_KEYS: InputKey[] = ["payoutLevel", "growth", ...RISK_FACTOR_IDS.map((id) => `risk.${id}` as const)];

/** Branchen, deren tragbarer Rückfluss aus dem operativen Cashflow kommt (Bezeichnung des Anbieters). */
const REAL_ESTATE_SECTORS = ["Real Estate"];
const REAL_ESTATE_GICS = "Real Estate";

export type InputValues = Partial<Record<InputKey, number>>;

export interface Proposals {
  /** Automatische Vorschläge; ein fehlender Schlüssel bedeutet: kein Vorschlag möglich. */
  values: InputValues;
  /**
   * Ersatzabzüge für Risikofaktoren ohne Vorschlag, die bei fehlendem Urteil in die vorläufige Rechnung eingehen, statt als 0
   * zu zählen (bei Finanzwerten die Faktoren 2, 8, 9). Kein Vorschlag: Sie füllen kein Feld vor, die Eingabe bleibt offen.
   */
  standIns: InputValues;
  /** Zwischenwerte je Aktie in Berichtswährung, zur Anzeige und Kontrolle. */
  details: {
    fiscalYears: number[];
    earningsLevel: number | null;
    /**
     * Gewinnniveau für die Ausschüttungsquote der Rechnung (Strategie 4.5), wenn ein Deckel den Rückfluss gesenkt hat: im Verhältnis
     * gedeckelt zu ungedeckelt gekürzt, sodass die Quote die des ungedeckelten Rückflusses bleibt. Gilt nur für den
     * vorgeschlagenen Rückfluss; bei einem Wert von Hand rechnet die Quote mit `earningsLevel`. Fehlt, wenn kein Deckel greift.
     */
    payoutEarningsLevel?: number | null;
    dividendLevel: number | null;
    netBuybacksPerShare: number | null;
    sustainablePayout: number | null;
    /** Woraus der tragbare Rückfluss kommt; fehlt in Bewertungen, die vor dieser Angabe gespeichert wurden. */
    sustainableFrom?: "freeCashFlow" | "operatingCashFlow" | "earnings";
    /**
     * Fenster des Cashflow-Durchschnitts im tragbaren Rückfluss (vor Abzug von Vergütung und Tilgung). `usedLong`: Bei
     * einem Zykliker (Faktor 1 mit Abzug) war der Median der ganzen Reihe niedriger und gilt. Fehlt bei Banken
     * und Versicherern und in Bewertungen, die vor dieser Angabe gespeichert wurden.
     */
    cashFlowWindow?: { years: number; fiveYearAverage: number; longMedian: number | null; usedLong: boolean };
    /** Aktienbasierte Vergütung je Aktie (Mittel der Jahre des Fensters mit Wert), vom Cashflow abgezogen; fehlt wie oben. */
    compensationPerShare?: number;
    /** Gewinnwachstum: das niedrigere aus je Aktie und Gesamtunternehmen. */
    historicalGrowth: number | null;
    /** Umsatzwachstum: das niedrigere aus je Aktie und Gesamtunternehmen. */
    revenueGrowth: number | null;
    earningsGrowthPerShare: number | null;
    earningsGrowthTotal: number | null;
    /** Jährliche Tilgung je Aktie für überhöhte Schulden; mindert den tragbaren Rückfluss. */
    debtRepaymentPerShare: number | null;
    retentionCap: number | null;
    /** Die Dividenden stammen aus der Dividendenhistorie statt aus gezahlter Summe und Aktienzahl. */
    dividendsFromHistory: boolean;
    /** Aktiensplit, um den die Reihen offenbar nicht bereinigt sind. */
    unadjustedSplit: { date: string; ratio: number } | null;
    /**
     * Aktienzahl wechselt zeitweise die Stückelung: springt und später zurück (Datenfehler). Nur in der
     * Anwendung gesetzt (computeValuation), nicht im Rückblick: Dort verschlechterte die Prüfung das Ergebnis (Strategie 11.19).
     */
    shareJump: { fiscalYear: number; factor: number } | null;
  };
  /** Hinweise für die Oberfläche, z. B. gegriffene Deckelung oder fehlende Daten. */
  notes: string[];
}

export interface History {
  /** Regelmäßige Dividende je Aktie nach Kalenderjahr des Ex-Tags, in Berichtswährung; `null`, wenn nicht nutzbar. */
  dividendsByYear: Map<number, number> | null;
  splits: readonly { date: string; ratio: number }[];
}

export const MINOR_UNIT: Record<string, { currency: string; divisor: number }> = {
  GBX: { currency: "GBP", divisor: 100 },
  ILA: { currency: "ILS", divisor: 100 },
  ZAC: { currency: "ZAR", divisor: 100 },
};

/**
 * Summiert regelmäßige Dividenden je Kalenderjahr des Ex-Tags. Sonderdividenden und angekündigte, noch nicht
 * fällige Zahlungen zählen nicht. Liefert `null`, wenn eine Zahlung in einer anderen Währung als der
 * Berichtswährung vorliegt (Hinterlegungsscheine); dann bleibt es bei der Rechnung aus der gezahlten Summe.
 */
export function dividendsByYear(
  payments: readonly { date: string; value: number; currency: string; period: string }[],
  reportingCurrency: string,
  today: string,
): Map<number, number> | null {
  const result = new Map<number, number>();
  for (const payment of payments) {
    if (payment.date > today || /special|extra/i.test(payment.period)) continue;
    const minor = MINOR_UNIT[payment.currency.toUpperCase()];
    const currency = minor?.currency ?? payment.currency.toUpperCase();
    if (currency !== reportingCurrency.toUpperCase()) return null;
    const year = Number(payment.date.slice(0, 4));
    result.set(year, (result.get(year) ?? 0) + payment.value / (minor?.divisor ?? 1));
  }
  return result;
}

/**
 * Findet einen Aktiensplit, um den die Aktienzahl offenbar nicht bereinigt ist: Die Aktienzahl springt im Jahr
 * des Splits ungefähr um dessen Verhältnis. Dann passen Gewinn je Aktie und Kurs nicht zusammen.
 */
export function unadjustedSplit(
  years: readonly { fiscalYear: number; shares: number | null }[],
  splits: readonly { date: string; ratio: number }[],
): { date: string; ratio: number } | null {
  for (const split of splits) {
    if (Math.abs(split.ratio - 1) < 0.2) continue;
    const year = Number(split.date.slice(0, 4));
    for (const candidate of [year, year + 1]) {
      const now = years.find((y) => y.fiscalYear === candidate)?.shares;
      const before = years.find((y) => y.fiscalYear === candidate - 1)?.shares;
      if (now && before && Math.abs(now / before / split.ratio - 1) < 0.25) return split;
    }
  }
  return null;
}

/**
 * Ob die Abschlüsse um einen Split bereinigt sind: Springt die Aktienzahl im Jahr des Splits oder im Jahr danach um sein
 * Verhältnis, nicht; bleibt sie gleich, ja. Ohne Jahr nach dem Split (Split nach dem letzten Abschluss) ist es offen.
 */
export function splitBasis(
  years: readonly { fiscalYear: number; shares: number | null }[],
  split: { date: string; ratio: number },
): "adjusted" | "unadjusted" | "unknown" {
  const year = Number(split.date.slice(0, 4));
  for (const candidate of [year, year + 1]) {
    const now = years.find((y) => y.fiscalYear === candidate)?.shares;
    const before = years.find((y) => y.fiscalYear === candidate - 1)?.shares;
    if (!now || !before || now <= 0 || before <= 0) continue;
    if (Math.abs(now / before / split.ratio - 1) < 0.25) return "unadjusted";
    if (Math.abs(now / before - 1) < 0.25) return "adjusted";
  }
  return "unknown";
}

/** Ab diesem Faktor von einem Jahr aufs nächste zählt ein Sprung der Aktienzahl für die Prüfung (Spezifikation 4.1). */
const MIN_SHARE_JUMP = 3;

/**
 * Erster Sprung der Aktienzahl um mindestens `MIN_SHARE_JUMP`, auf den später ein Sprung zurück folgt (beide zusammen
 * ungefähr Faktor 1): Die Reihe wechselt zeitweise die Stückelung (Aktien statt Hinterlegungsscheine, Tausender), ein
 * Datenfehler (XYF, NLB). Echte Kapitalmaßnahmen und Gratisaktien kehren nicht zurück und fallen nicht darunter.
 */
export function shareJump(
  years: readonly { fiscalYear: number; shares: number | null }[],
  _splits: readonly { date: string; ratio: number }[] = [],
): { fiscalYear: number; factor: number } | null {
  const jumps: { fiscalYear: number; ratio: number }[] = [];
  for (let i = 1; i < years.length; i++) {
    const before = years[i - 1]!.shares;
    const now = years[i]!.shares;
    if (!before || !now || before <= 0 || now <= 0) continue;
    const ratio = now / before;
    if (Math.max(ratio, 1 / ratio) >= MIN_SHARE_JUMP) jumps.push({ fiscalYear: years[i]!.fiscalYear, ratio });
  }
  for (const [i, first] of jumps.entries()) {
    const back = jumps
      .slice(i + 1)
      .find((later) => later.ratio > 1 !== first.ratio > 1 && Math.abs(Math.log(first.ratio * later.ratio)) < Math.log(2));
    if (back) return { fiscalYear: first.fiscalYear, factor: Math.max(first.ratio, 1 / first.ratio) };
  }
  return null;
}

/** Prozentzahl mit einer Nachkommastelle, deutsches Komma und echtem Minus: `0.085` wird `8,5 %`. */
function germanPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",").replace("-", "−")} %`;
}

/** Wie `germanPercent`, aber ohne die Nachkommastelle bei ganzen Werten: `0.03` wird `3 %`. Für Grenzen. */
function limitPercent(value: number): string {
  return germanPercent(value).replace(",0 %", " %");
}

const REGIONS: readonly string[] = ["Europa", "Nordamerika", "Japan", "Asien", "Südamerika", "Afrika", "Ozeanien"];

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

function allNumbers(values: readonly (number | null)[]): values is number[] {
  return values.every((v) => v !== null);
}

/**
 * Vorschläge aus den letzten zehn Geschäftsjahren; bei jüngeren Unternehmen genügen fünf. Nicht gemeldete Dividenden, Rückkäufe, Aktienausgaben und
 * aktienbasierte Vergütung zählen als 0; fehlen dagegen Gewinn oder Aktienzahl, gibt es keinen Vorschlag.
 *
 * @param years Geschäftsjahre, ältestes zuerst (beliebig viele; verwendet werden die letzten zehn).
 * @param reportingPerEur Einheiten der Berichtswährung je Euro; `null`, wenn kein Wechselkurs vorliegt.
 * @param currentYear Kalenderjahr der Bewertung, für die Existenzdauer.
 * @param inflationGap Erwartete Inflation der Berichtswährung minus die des Euro; verschiebt die Wachstumsgrenzen (Strategie 4.6).
 */
export function proposeInputs(
  stock: Stock,
  years: readonly FundamentalsYear[],
  reportingPerEur: number | null,
  currentYear: number,
  history: History = { dividendsByYear: null, splits: [] },
  inflationGap = 0,
): Proposals {
  const values: InputValues = {};
  // Bei Finanzwerten haben die Faktoren 2, 8, 9 keinen Vorschlag; bis zum Urteil rechnet die vorläufige Rendite mit Ersatzabzügen.
  const standIns: InputValues = {};
  if (stock.isFinancial)
    for (const id of MANUAL_FOR_FINANCIALS) {
      const standIn = FINANCIAL_STAND_INS[id];
      if (standIn !== undefined) standIns[`risk.${id}`] = standIn;
    }
  const notes: string[] = [];
  const details: Proposals["details"] = {
    fiscalYears: [],
    earningsLevel: null,
    dividendLevel: null,
    netBuybacksPerShare: null,
    sustainablePayout: null,
    historicalGrowth: null,
    revenueGrowth: null,
    earningsGrowthPerShare: null,
    earningsGrowthTotal: null,
    debtRepaymentPerShare: null,
    retentionCap: null,
    dividendsFromHistory: false,
    unadjustedSplit: null,
    shareJump: null,
  };

  values["risk.currency"] = proposeCurrency(stock.reportingCurrency);
  if (REGIONS.includes(stock.region)) values["risk.country"] = proposeCountry(stock.region as Region);

  // Existenzdauer: Gründungsjahr, mindestens aber die Zeitspanne, für die Abschlüsse vorliegen.
  const firstYear = years[0]?.fiscalYear;
  const knownSince = Math.min(stock.foundedYear ?? Infinity, firstYear ?? Infinity);
  if (Number.isFinite(knownSince)) {
    const age = currentYear - knownSince;
    if (stock.foundedYear !== null || age >= 20) values["risk.age"] = proposeAge(age);
  }

  const ten = years.slice(-FULL_YEARS);
  details.fiscalYears = ten.map((y) => y.fiscalYear);
  if (ten.length < MIN_YEARS) {
    notes.push(`Nur ${ten.length} Geschäftsjahre vorhanden, mindestens ${MIN_YEARS} sind nötig.`);
    return { values, standIns, details, notes };
  }
  // Der Autor bewertet auch junge Börsenwerte (Höegh Autoliners, Kaspi). Eine kürzere Reihe trägt die Vorschläge,
  // aber nichts, was Stetigkeit über zehn Jahre belegen soll.
  const short = ten.length < FULL_YEARS;
  if (short) {
    notes.push(
      `Nur ${ten.length} statt ${FULL_YEARS} Geschäftsjahre: Niveau und Wachstum stehen auf einer kürzeren Reihe und sind unsicherer.`,
    );
  }
  const last = ten.at(-1)!;
  if (last.fiscalYear < currentYear - 2) notes.push(`Letzter Abschluss ist von ${last.fiscalYear}.`);

  const eps = ten.map((y) => y.epsDiluted);
  const shares = ten.map((y) => y.shares);
  if (!allNumbers(eps) || !allNumbers(shares) || shares.some((s) => !(s > 0))) {
    notes.push("Gewinn je Aktie oder Aktienzahl fehlt in mindestens einem Jahr.");
    return { values, standIns, details, notes };
  }

  // Rückflussniveau
  // Dividenden: bevorzugt aus der Dividendenhistorie (echte Beträge je Aktie, ohne Sonderzahlungen). Sie gilt nur,
  // wenn sie zur Rechnung aus gezahlter Summe und Aktienzahl passt; sonst beziehen sich beide auf verschiedene Stückelungen.
  const paid = ten.map((y) => y.dividendPerShare ?? 0);
  let dividends = paid;
  details.unadjustedSplit = unadjustedSplit(ten, history.splits);
  if (history.dividendsByYear !== null) {
    const listed = ten.map((y) => history.dividendsByYear!.get(y.fiscalYear) ?? 0);
    const ratios = paid
      .map((value, i) => (value > 0 && listed[i]! > 0 ? value / listed[i]! : null))
      .filter((r): r is number => r !== null)
      .sort((x, y) => x - y);
    const ratio = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)]! : 1;
    if (ratio >= 0.5 && ratio <= 2) {
      dividends = listed;
      details.dividendsFromHistory = true;
    } else {
      // Entspricht der Abstand einem Aktiensplit, sind die Zahlen je Aktie nicht um ihn bereinigt.
      details.unadjustedSplit ??= history.splits.findLast((split) => Math.abs(ratio / split.ratio - 1) < 0.25) ?? null;
      if (!details.unadjustedSplit) {
        notes.push(
          `Dividendenhistorie und Abschlusszahlen beziehen sich auf verschiedene Stückelungen (Faktor ${ratio.toFixed(1)}); es gilt die Rechnung aus den Abschlüssen.`,
        );
      }
    }
  }
  if (details.unadjustedSplit) {
    notes.push(
      `Aktiensplit vom ${details.unadjustedSplit.date} ist in den Zahlen offenbar nicht bereinigt; Werte je Aktie und Kurs passen nicht zusammen.`,
    );
  }
  const level = earningsLevel(eps);
  const divLevel = dividendLevel(dividends);
  // Aktienbasierte Vergütung ohne Datenfehler des Anbieters (fehlend, negativ, grob überhöht): für Netto-Rückkäufe und Deckel gleich.
  const usable = usableCompensation(ten.map((y) => y.stockBasedCompensation));
  const buybacks = netBuybacksPerShare(
    ten.map((y, i) => ({
      repurchases: y.repurchases ?? 0,
      issuance: y.issuance ?? 0,
      stockBasedCompensation: usable.values[i] ?? 0,
      shares: shares[i]!,
    })),
  );
  const five = ten.slice(-5);
  // Faktor 1 mit Abzug (Verlustjahr oder Einbruch): Der Zyklus ist sichtbar, fünf Jahre im Hoch tragen den Rückfluss nicht.
  // Maßgeblich ist der Vorschlag, nicht der übersteuerte Wert.
  const earned = proposeEarnings(
    eps,
    ten.map((y) => y.ebit),
  );
  const cyclical = !stock.isFinancial && earned > 0;
  // Schulden über dem Dreifachen des EBITDA müssen getilgt werden; das Geld steht den Eigentümern nicht zu.
  let repayment = 0;
  if (!stock.isFinancial && last.netDebt !== null && last.ebitda !== null) {
    repayment = requiredDebtRepayment(last.netDebt, last.ebitda) / last.shares!;
    details.debtRepaymentPerShare = repayment;
    if (repayment > 0)
      notes.push(`Hohe Schulden: ${repayment.toFixed(2)} je Aktie und Jahr sind für die Tilgung angesetzt und zählen nicht als Rückfluss.`);
  }
  // Immobilienwerte kaufen Objekte aus dem operativen Cashflow; der Anbieter zählt das als Investition, ihr freier
  // Cashflow ist deshalb dauerhaft negativ. Der operative Cashflow steht für das, was sie ausschütten können (wie FFO).
  // Der Anbieter führt auch Anleihen von Versorgern als REIT; deren Sektor nach GICS verrät sie.
  const realEstate =
    !stock.isFinancial && REAL_ESTATE_SECTORS.includes(stock.sector) && (stock.gicSector == null || stock.gicSector === REAL_ESTATE_GICS);
  const cashFlowPerShare = ten.map((y, i) => {
    const amount = realEstate ? y.operatingCashFlow : y.freeCashFlow;
    return amount === null ? null : amount / shares[i]!;
  });
  // Der freie Cashflow des Anbieters ist operativer Cashflow minus Investitionen; der operative Cashflow rechnet die
  // aktienbasierte Vergütung als nicht zahlungswirksamen Aufwand wieder hinzu (Strategie 3.6). Sie kostet die Eigentümer
  // aber Verwässerung, deshalb mindert sie den tragbaren Rückfluss. Banken und Versicherer rechnen aus dem Gewinn,
  // der sie schon als Aufwand enthält.
  const compensationPerShare = usable.values.map((v, i) => (v === null ? null : v / shares[i]!));
  // Die Bereinigung wirkt auch bei Finanzwerten (über die Netto-Rückkäufe), der Hinweis gilt deshalb für alle.
  if (usable.flagged > 0 || usable.negative > 0) {
    const dropped = [
      usable.negative > 0 ? `${usable.negative} Jahr(e) mit negativem Wert` : null,
      usable.flagged > 0 ? `${usable.flagged} Jahr(e) um mehr als das Hundertfache über dem Üblichen` : null,
    ]
      .filter((text) => text !== null)
      .join(" und ");
    notes.push(
      `Aktienbasierte Vergütung: ${dropped} (offenbar Datenfehler des Anbieters) nicht verwertet; kleinere Abweichungen werden nicht erkannt. Das verschiebt die Netto-Rückkäufe${stock.isFinancial ? "" : " und den Abzug vom Cashflow"}.`,
    );
  }
  const cashLevel = stock.isFinancial ? null : sustainableCashFlow(cashFlowPerShare, { cyclical, inflationGap, compensationPerShare });
  const sustainable = stock.isFinancial
    ? level
    : cashLevel !== null
      ? Math.max(0, cashLevel.cashFlow - cashLevel.compensation - repayment)
      : null;
  details.sustainableFrom = stock.isFinancial ? "earnings" : realEstate ? "operatingCashFlow" : "freeCashFlow";
  if (realEstate) notes.push("Immobilienwert: Der Rückflussdeckel kommt aus dem operativen Cashflow statt aus dem freien Cashflow.");
  if (cashLevel !== null) {
    details.cashFlowWindow = {
      years: cashLevel.windowYears,
      fiveYearAverage: cashLevel.fiveYearAverage,
      longMedian: cashLevel.longMedian,
      usedLong: cashLevel.usedLong,
    };
    details.compensationPerShare = cashLevel.compensation;
    if (cashLevel.usedLong) {
      const what = realEstate ? "operativen Cashflows" : "freien Cashflows";
      notes.push(
        `Zyklus: Faktor 1 zeigt Verlust oder Einbruch, deshalb gilt der Median der letzten ${cashLevel.windowYears} Jahre (${cashLevel.longMedian!.toFixed(2)} je Aktie) statt des Mittels der letzten fünf (${cashLevel.fiveYearAverage.toFixed(2)}) als Ausgangswert des ${what}${inflationGap !== 0 ? "; ältere Jahre sind um den Inflationsabstand auf heutige Kaufkraft hochgerechnet" : ""}.`,
      );
    }
    if (cyclical && short)
      notes.push(
        `Zyklus: Die Reihe hat nur ${ten.length} Jahre; ein ganzer Zyklus ist womöglich nicht abgedeckt, der Rückflussdeckel kann zu hoch sein.`,
      );
  }
  Object.assign(details, { earningsLevel: level, dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });

  let payout: number | null = null;
  if (sustainable === null) {
    notes.push(
      stock.isFinancial
        ? "Gewinnniveau nicht bestimmbar, daher kein Vorschlag für den Rückfluss."
        : realEstate
          ? "Operativer Cashflow fehlt, daher kein Vorschlag für den Rückfluss."
          : "Freier Cashflow fehlt, daher kein Vorschlag für den Rückfluss.",
    );
  } else {
    const proposal = payoutLevelProposal({ dividendLevel: divLevel, netBuybacksPerShare: buybacks, sustainablePayout: sustainable });
    payout = proposal.value;
    values.payoutLevel = payout;
    if (proposal.capped)
      notes.push(`Ausschüttungsniveau ${(divLevel + buybacks).toFixed(2)} auf den Rückflussdeckel ${payout.toFixed(2)} begrenzt.`);
    // Hätte der Deckel ohne den Abzug der Vergütung nicht gegriffen, sagt der Hinweis es.
    if (
      proposal.capped &&
      cashLevel !== null &&
      cashLevel.compensation > 0 &&
      divLevel + buybacks <= Math.max(0, cashLevel.cashFlow - repayment)
    )
      notes.push(
        `Aktienbasierte Vergütung von ${cashLevel.compensation.toFixed(2)} je Aktie ist vom Cashflow abgezogen und bringt die Deckelung des Rückflusses zum Greifen.`,
      );
    if (payout === 0) notes.push("Rückflussniveau ist 0, eine innere Rendite lässt sich daraus nicht rechnen.");
  }

  // Greift ein Deckel, bleibt die Quote der Rechnung (Strategie 4.5) die des ungedeckelten Rückflusses: Das Gewinnniveau geht im
  // Verhältnis gedeckelt zu ungedeckelt gekürzt ein. Unabhängig davon, ob Eigenkapital vorliegt.
  if (payout !== null && payout < divLevel + buybacks && level !== null && level > 0)
    details.payoutEarningsLevel = (level * payout) / (divLevel + buybacks);

  // Wachstum
  // Rückkäufe stehen schon im Rückfluss. Das Wachstum je Aktie enthält sie ein zweites Mal, deshalb gilt das
  // niedrigere aus je Aktie und Gesamtunternehmen (bei Verwässerung ist das der Wert je Aktie).
  const perShareGrowth = historicalGrowth(eps);
  const totalGrowth = historicalGrowth(eps.map((e, i) => e * shares[i]!));
  const growthHistory = lowerGrowth(perShareGrowth, totalGrowth);
  Object.assign(details, { historicalGrowth: growthHistory, earningsGrowthPerShare: perShareGrowth, earningsGrowthTotal: totalGrowth });
  const equityPerShare = last.equity === null ? null : last.equity / last.shares!;
  if (payout !== null && equityPerShare !== null) {
    const revenuePerShare = ten.map((y, i) => (y.revenue === null ? null : y.revenue / shares[i]!));
    const revenueGrowth = allNumbers(revenuePerShare)
      ? lowerGrowth(historicalGrowth(revenuePerShare), historicalGrowth(revenuePerShare.map((r, i) => r * shares[i]!)))
      : null;
    details.revenueGrowth = revenueGrowth;
    const endLosses = lossesAtEnd(eps);
    const params = growthParamsFor(inflationGap);
    // Einbehalten ist, was vom Gewinn nicht ausgeschüttet wird. Eine Deckelung des Rückflusses (freier Cashflow, Zyklus,
    // Vergütung, Tilgung) ist kein einbehaltener Gewinn: Die Grenze aus Einbehaltung
    // rechnet mit dem ungedeckelten Rückfluss. Dasselbe gilt für die Quote der Rechnung (Strategie 4.5): Das Gewinnniveau geht im
    // Verhältnis gedeckelt zu ungedeckelt gekürzt ein, die Quote bleibt die des ungedeckelten Rückflusses.
    const uncapped = divLevel + buybacks;
    const growth = growthProposal(
      {
        historicalGrowth: growthHistory,
        revenueGrowth,
        payoutLevel: uncapped,
        earningsLevel: level,
        equityPerShare,
        lossesAtEnd: endLosses,
      },
      params,
    );
    details.retentionCap = growth.retentionCap;
    if (growth.value !== null) values.growth = growth.value;
    else
      notes.push(
        "Historisches Wachstum nicht bestimmbar (Verluste am Anfang oder Ende der Reihe, Umsatz unvollständig), Wachstum muss von Hand gesetzt werden.",
      );
    const shifted =
      inflationGap !== 0
        ? ` (in ${stock.reportingCurrency}, Euro-Kaufkraft um ${germanPercent(inflationGap)} Inflationsabstand verschoben)`
        : "";
    if (growth.fromRevenue)
      notes.push(
        `Gewinnwachstum nicht bestimmbar (Verluste am ${endLosses ? "Ende" : "Anfang"} der Reihe): Vorschlag aus dem Umsatzwachstum je Aktie von ${germanPercent(revenueGrowth!)}, begrenzt auf ${limitPercent(params.minGrowth)} bis ${limitPercent(endLosses ? params.inflationGap : params.maxGrowthFromRevenue)}${shifted}.`,
      );
    if (growth.shrinking) {
      const nominalGrowth =
        inflationGap !== 0 && growthHistory! >= 0 ? " (nominal wächst er, aber langsamer als der Inflationsabstand)" : "";
      const floor = `${limitPercent(params.minGrowth)}${inflationGap !== 0 ? ", Euro-Kaufkraft um den Inflationsabstand verschoben" : ""}`;
      // Greift die Untergrenze, ist der Vorschlag nicht das gemessene Wachstum, sondern der Mindestwert.
      notes.push(
        growth.value! > growthHistory! + 1e-12
          ? `Gewinn schrumpft${nominalGrowth}: Gemessen sind ${germanPercent(growthHistory!)}, der Vorschlag ist die Untergrenze von ${floor}; der Rückfluss schrumpft damit dauerhaft.`
          : `Gewinn schrumpft${nominalGrowth}: Vorschlag ist das gemessene Wachstum von ${germanPercent(growth.value!)} (Untergrenze ${floor}), der Rückfluss schrumpft damit dauerhaft.`,
      );
    }
    if (equityPerShare <= 0) notes.push("Eigenkapital negativ, die Wachstumsgrenze aus Einbehaltung entfällt.");
  }

  // Risikofaktoren aus Zahlen
  // Der Bonus für stetig steigende Gewinne verlangt die volle Reihe.
  const earningsRating = short ? Math.max(0, earned) : earned;
  values["risk.earnings"] = earningsRating;
  if (last.totalAssets !== null && reportingPerEur !== null) values["risk.size"] = proposeSize(last.totalAssets / reportingPerEur);
  else if (reportingPerEur === null) notes.push(`Kein Wechselkurs für ${stock.reportingCurrency}, Größe nicht bewertbar.`);

  if (!stock.isFinancial) {
    const netDebt = last.netDebt ?? (last.longTermDebt === null ? null : last.longTermDebt - (last.cash ?? 0));
    // Operativer Cashflow als Mittel der letzten drei Jahre, damit ein Jahr mit Sondereffekten im Umlaufvermögen nicht
    // entscheidet; fehlt er ganz, steht das EBITDA für ihn.
    const cashFlows = ten
      .slice(-3)
      .map((y) => y.operatingCashFlow)
      .filter((v): v is number => v !== null);
    const operatingCashFlow = cashFlows.length > 0 ? mean(cashFlows) : (last.ebitda ?? last.ebit);
    if (
      netDebt !== null &&
      operatingCashFlow !== null &&
      last.ebit !== null &&
      last.currentAssets !== null &&
      last.currentLiabilities !== null
    ) {
      values["risk.financing"] = proposeFinancing({
        netDebt,
        operatingCashFlow,
        // Der Nachlass für stetige Gewinne ebenso.
        earningsRating: short ? undefined : earningsRating,
        ebit: last.ebit,
        interestExpense: last.interestExpense ?? 0,
        currentAssets: last.currentAssets,
        currentLiabilities: last.currentLiabilities,
      });
    }
    // Kapitalrendite und Marge als Durchschnitt der letzten fünf Jahre, damit ein Ausreißerjahr nicht entscheidet.
    const returns = five.map((y) => (y.ebit === null || y.totalAssets === null ? null : y.ebit / (y.totalAssets - (y.cash ?? 0))));
    const margins = five.map((y) => (y.ebit === null || !y.revenue ? null : y.ebit / y.revenue));
    if (allNumbers(returns)) values["risk.returnOnCapital"] = proposeProfitability(mean(returns));
    if (allNumbers(margins)) values["risk.ebitMargin"] = proposeProfitability(mean(margins));
  }

  values["risk.cashFlow"] = proposeCashFlow({
    // Der freie Cashflow einer Bank oder Versicherung sagt nichts über ihre Ertragskraft; dort zählen die Gewinnjahre.
    positiveFreeCashFlowYears: stock.isFinancial ? eps.filter((e) => e > 0).length : ten.filter((y) => (y.freeCashFlow ?? 0) > 0).length,
    years: ten.length,
    paysOut: divLevel > 0 || buybacks > 0,
    dividendCutInLastTenYears: dividendWasCut(dividends),
  });

  for (const id of MANUAL_FOR_FINANCIALS) if (stock.isFinancial) delete values[`risk.${id}`];
  return { values, standIns, details, notes };
}

export interface Valuation {
  /** Geltende Eingaben: manueller Wert, sonst Vorschlag. */
  inputs: InputValues;
  /** Schlüssel, bei denen ein manueller Wert gilt. */
  manual: InputKey[];
  /** Eingaben ohne Wert. Solange eine fehlt, ist die Bewertung unvollständig. */
  missing: InputKey[];
  complete: boolean;
  /**
   * Summe der gesetzten Risikofaktoren und der Ersatzabzüge für offene Faktoren; fehlen Faktoren ohne Ersatzabzug, eine
   * Untergrenze.
   */
  riskScore: number;
  /** Ersatzabzüge, die im Risikowert stecken, weil der Faktor offen ist (Proposals.standIns). */
  standIns: InputValues;
  /**
   * Risikowert ohne Ersatzabzüge, also nur aus gesetzten Faktoren. Gegen ihn prüft der Ausschluss (ab 75 %), solange Faktoren
   * offen sind: Ein Urteil kann den Ersatzabzug wieder senken. Bei vollständiger Bewertung gleich `riskScore`.
   */
  riskFloor: number;
  riskClass: RiskClass;
  defaultProbability: number;
  /** Kurs je Aktie in Berichtswährung; `null`, wenn Kurs oder Wechselkurs fehlen. */
  price: number | null;
  /**
   * Innere Rendite mit Bandbreite, mit dem Euro vergleichbar gemacht; bei unvollständiger Bewertung vorläufig
   * (fehlende Risikofaktoren mit Ersatzabzug, sonst als 0).
   */
  returns: ScenarioReturns | null;
  /** Innere Rendite im Basisfall in Berichtswährung, vor dem Währungsabgleich. */
  localReturn: number | null;
  /** Erwartete Inflation der Berichtswährung minus die des Euro. */
  inflationGap: number;
  /** Eingaben der Renditerechnung im Basisfall; `null`, solange Rückfluss oder Wachstum fehlen. */
  returnInputs: ReturnInputs | null;
  /**
   * Ausschüttungsquote heute und am Ende der Abschmelzphase, wenn die Rechnung eine steigende Quote annimmt;
   * sonst `null` (kein Gewinnniveau, schon volle Ausschüttung oder einbehaltene Gewinne ohne Wachstum).
   */
  payoutRatio: {
    now: number;
    terminal: number;
    /** Ungedeckelter Rückfluss, auf den sich die Quote bezieht, wenn ein Deckel greift und die Quote mit gekürztem Gewinnniveau rechnet; sonst `null`. */
    uncappedPayout: number | null;
  } | null;
}

/**
 * Führt Vorschläge und manuelle Werte zusammen und rechnet die innere Rendite.
 * @param earningsLevel Gewinnniveau je Aktie aus den Vorschlägen; ohne es bleibt die Ausschüttungsquote in der Rechnung fest.
 * @param cappedEarningsLevel Gekürztes Gewinnniveau (`payoutEarningsLevel`), wenn ein Deckel den vorgeschlagenen Rückfluss
 *   gesenkt hat. Es gilt nur für den Vorschlag; ist der Rückfluss von Hand gesetzt, gilt `earningsLevel`.
 * @param standIns Ersatzabzüge für offene Risikofaktoren (`Proposals.standIns`); ein gesetzter Wert geht immer vor.
 */
export function evaluate(
  proposals: InputValues,
  manualValues: InputValues,
  price: number | null,
  inflationGap = 0,
  earningsLevel: number | null = null,
  cappedEarningsLevel: number | null = null,
  standIns: InputValues = {},
): Valuation {
  const inputs: InputValues = { ...proposals, ...manualValues };
  const ratioEarnings = manualValues.payoutLevel === undefined && cappedEarningsLevel !== null ? cappedEarningsLevel : earningsLevel;
  const manual = INPUT_KEYS.filter((key) => manualValues[key] !== undefined);
  const missing = INPUT_KEYS.filter((key) => inputs[key] === undefined);

  // Ersatzabzüge zählen im Risikowert, die Faktoren bleiben aber offen (`missing`, `complete`).
  const ratings: RiskRatings = {};
  const withStandIns: RiskRatings = {};
  const usedStandIns: InputValues = {};
  for (const id of RISK_FACTOR_IDS) {
    const key = `risk.${id}` as const;
    const rating = inputs[key];
    if (rating !== undefined) ratings[id] = withStandIns[id] = rating;
    else if (standIns[key] !== undefined) withStandIns[id] = usedStandIns[key] = standIns[key];
  }
  const score = assessRisk(withStandIns).score;
  const floor = assessRisk(ratings).score;
  const probability = defaultProbability(score);
  const { payoutLevel, growth } = inputs;
  const returnInputs =
    payoutLevel !== undefined && growth !== undefined
      ? { payoutLevel, growth, defaultProbability: probability, earningsLevel: ratioEarnings }
      : null;
  const params = returnParamsFor(inflationGap);
  const local = price !== null && returnInputs ? scenarioReturns(price, returnInputs, undefined, params) : null;
  const terminalRatio = returnInputs && terminalPayoutRatio(returnInputs, params);
  const ratioNow = returnInputs && ratioEarnings ? returnInputs.payoutLevel / ratioEarnings : null;
  const returns = local && {
    cautious: comparableReturn(local.cautious, inflationGap),
    base: comparableReturn(local.base, inflationGap),
    optimistic: comparableReturn(local.optimistic, inflationGap),
  };
  return {
    inputs,
    manual,
    missing,
    complete: missing.length === 0 && price !== null && returns?.base != null,
    riskScore: score,
    standIns: usedStandIns,
    riskFloor: floor,
    riskClass: riskClass(score),
    defaultProbability: probability,
    price,
    returns,
    localReturn: local?.base ?? null,
    inflationGap,
    returnInputs,
    payoutRatio:
      terminalRatio != null && ratioNow !== null && terminalRatio > ratioNow + 1e-9
        ? {
            now: ratioNow,
            terminal: terminalRatio,
            uncappedPayout:
              earningsLevel !== null && ratioEarnings !== earningsLevel && returnInputs
                ? (returnInputs.payoutLevel * earningsLevel) / ratioEarnings!
                : null,
          }
        : null,
  };
}

/**
 * Vorschau: dieselbe Bewertung, wenn die Vorschläge (z. B. von Jev) für offene Eingaben gälten. Gesetzte Eingaben
 * bleiben, wie sie sind. `null`, wenn kein Vorschlag eine offene Eingabe füllt.
 */
export function withSuggestions(valuation: Valuation, suggestions: InputValues): Valuation | null {
  const filled = valuation.missing.filter((key) => suggestions[key] !== undefined);
  if (filled.length === 0) return null;
  const inputs: InputValues = { ...valuation.inputs };
  for (const key of filled) inputs[key] = suggestions[key];
  return evaluate(
    inputs,
    {},
    valuation.price,
    valuation.inflationGap,
    valuation.returnInputs?.earningsLevel ?? null,
    null,
    valuation.standIns,
  );
}

/**
 * Bewertung aus den Feldern des Formulars, wie Speichern sie ergäbe: Ein leeres Feld übernimmt den Vorschlag,
 * ein gefülltes gilt als Wert von Hand. Für die Vorschau beim Tippen; liefert die erste ungültige Eingabe als Fehler.
 */
export function evaluateFields(
  fields: Partial<Record<InputKey, string>>,
  proposals: InputValues,
  price: number | null,
  inflationGap: number,
  earningsLevel: number | null,
  cappedEarningsLevel: number | null = null,
  standIns: InputValues = {},
): Valuation | { error: string } {
  const manualValues: InputValues = {};
  for (const key of INPUT_KEYS) {
    const text = fields[key]?.trim() ?? "";
    if (text === "") continue;
    const parsed = parseManualInput(key, text, inflationGap);
    if ("error" in parsed) return parsed;
    manualValues[key] = parsed.value;
  }
  return evaluate(proposals, manualValues, price, inflationGap, earningsLevel, cappedEarningsLevel, standIns);
}

/**
 * Innere Rendite im Basisfall bei anderen Kursen, mit denselben Eingaben und demselben Währungsabgleich wie
 * `evaluate`. Leer ohne Kurs oder ohne Rückfluss und Wachstum.
 * @param steps Abstand zum heutigen Kurs, z. B. -0.1 für 10 % darunter.
 */
export function priceSensitivity(
  valuation: Valuation,
  steps: readonly number[],
): { step: number; price: number; innerReturn: number | null }[] {
  const { price, returnInputs, inflationGap } = valuation;
  if (price === null || returnInputs === null) return [];
  return steps.map((step) => {
    const shifted = price * (1 + step);
    return {
      step,
      price: shifted,
      innerReturn: comparableReturn(innerReturn(shifted, returnInputs, returnParamsFor(inflationGap)), inflationGap),
    };
  });
}

/** Kurs in Berichtswährung umrechnen; Wechselkurse als Einheiten je Euro. */
export function priceInReportingCurrency(price: number, pricePerEur: number | null, reportingPerEur: number | null): number | null {
  if (pricePerEur === null || reportingPerEur === null) return null;
  return (price / pricePerEur) * reportingPerEur;
}

/**
 * Erlaubter Bereich für das Wachstum von Hand in Prozent: −20 bis 30 % in Euro-Kaufkraft, in der Berichtswährung
 * verschoben und nach innen auf Zehntel gerundet. Formular, Prüfung und Meldung nehmen alle diese Zahlen. Die Toleranz
 * fängt Gleitkommarauschen ab (−5,99999… zählt als −6,0).
 */
export function growthInputBounds(inflationGap: number): { min: number; max: number } {
  const tolerance = 1e-6;
  return {
    min: Math.ceil(toLocalTerms(-0.2, inflationGap) * 1000 - tolerance) / 10,
    max: Math.floor(toLocalTerms(0.3, inflationGap) * 1000 + tolerance) / 10,
  };
}

/** Der Bereich als Text, z. B. „−20 bis 30 %“. */
export function growthRangeText(inflationGap: number): string {
  const { min, max } = growthInputBounds(inflationGap);
  const shown = (value: number) => value.toFixed(1).replace(".", ",").replace(",0", "").replace("-", "−");
  return `${shown(min)} bis ${shown(max)} %`;
}

/**
 * Prüft eine Eingabe von Hand. Rückfluss als Betrag je Aktie, alles andere in Prozent (5 = 5 %, Komma erlaubt).
 * Liefert den Wert als Anteil oder eine Fehlermeldung.
 */
export function parseManualInput(key: InputKey, text: string, inflationGap = 0): { value: number } | { error: string } {
  const entered = Number(text.trim().replace(",", "."));
  if (text.trim() === "" || !Number.isFinite(entered)) return { error: `"${text}" ist keine Zahl.` };
  if (key === "payoutLevel") return entered < 0 ? { error: "Der Rückfluss darf nicht negativ sein." } : { value: entered };
  const value = entered / 100;
  if (key === "growth") {
    const { min, max } = growthInputBounds(inflationGap);
    return entered < min - 1e-9 || entered > max + 1e-9 ? { error: `Wachstum: erlaubt sind ${growthRangeText(inflationGap)}.` } : { value };
  }
  const factor = RISK_FACTORS[key.slice(5) as RiskFactorId];
  if (value > factor.maxDeduction + 1e-9 || value < -factor.bonus - 1e-9) {
    return { error: `${factor.label}: erlaubt sind ${-factor.bonus * 100} bis ${factor.maxDeduction * 100} %.` };
  }
  return { value };
}

/**
 * Rückfluss über diesem Anteil des Kurses gilt als Datenfehler. Die Schwelle liegt über dem, was der Autor als echte
 * Gelegenheit nennt: Petrobras, Halyk und Stalexport mit rund 20 %, Höegh Autoliners mit über 25 %.
 */
export const MAX_PAYOUT_YIELD = 0.3;
/** Ein Kurs unter diesem Vielfachen des Gewinnniveaus gilt als Datenfehler; das Dreifache kommt vor (Interview). */
export const MIN_PRICE_TO_EARNINGS = 2;

/**
 * Grobe Prüfung, ob Kurs und Fundamentaldaten zusammenpassen. Sie fängt vor allem Hinterlegungsscheine, deren
 * Zahlen sich auf eine andere Stückelung oder Währung beziehen. Echte Sonderfälle fallen auch darunter.
 */
export function looksImplausible(price: number | null, payoutLevel: number | undefined, earningsLevel: number | null): boolean {
  return implausibleReason(price, payoutLevel, earningsLevel) !== null;
}

function implausibleReason(price: number | null, payoutLevel: number | undefined, earningsLevel: number | null): string | null {
  if (price === null || !(price > 0)) return null;
  if (payoutLevel !== undefined && payoutLevel / price > MAX_PAYOUT_YIELD) {
    return `Rückfluss ist ${Math.round((payoutLevel / price) * 100)} % des Kurses.`;
  }
  if (earningsLevel !== null && earningsLevel > 0 && price / earningsLevel < MIN_PRICE_TO_EARNINGS) {
    return `Kurs ist nur das ${(price / earningsLevel).toFixed(1).replace(".", ",")}-Fache des Gewinnniveaus.`;
  }
  return null;
}

/**
 * Warum Zahlen und Kurs nicht zusammenpassen, oder `null`. Dann ist die Rendite nicht ernst zu nehmen.
 * Eine Prüfung für Rangliste, Datenvorrat, Aktien- und Portfolioseite. Ist das Rückflussniveau von Hand gesetzt, hat ein
 * Mensch Kurs und Zahlen angesehen: Dann prüft sie nur noch auf einen unbereinigten Split, nicht mehr auf die Grenzen für
 * Rückfluss und Kurs-Gewinn-Verhältnis (ein sehr niedriges KGV kann echt sein, wenn der Markt einen Gewinneinbruch erwartet).
 */
export function doubtfulNumbers(valuation: Valuation, proposals: Proposals): string | null {
  const split = proposals.details.unadjustedSplit;
  if (split) return `Aktiensplit vom ${split.date} ist in den Zahlen nicht bereinigt.`;
  if (valuation.manual.includes("payoutLevel")) return null;
  const jump = proposals.details.shareJump;
  if (jump) {
    return `Aktienzahl springt ${jump.fiscalYear} um den Faktor ${jump.factor.toFixed(1).replace(".", ",")} und später zurück: andere Stückelung in einem Teil der Jahre.`;
  }
  return implausibleReason(valuation.price, valuation.inputs.payoutLevel, proposals.details.earningsLevel);
}

/** Kurs-Gewinn-Verhältnis: Kurs geteilt durch das Gewinnniveau (Strategie 3.3), nicht durch den Gewinn eines Jahres. */
export function priceToEarnings(price: number | null, earningsLevel: number | null): number | null {
  return price !== null && price > 0 && earningsLevel !== null && earningsLevel > 0 ? price / earningsLevel : null;
}
