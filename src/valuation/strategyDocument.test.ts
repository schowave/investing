// `docs/STRATEGIE.md` ist für Regeln und Werte maßgeblich. Dieser Test liest alle Tabellen mit Schlüsseln (6.2, 10.1, 10.3), das
// Risikoraster (6.1), die Stufen der Urteilsfaktoren (6.3), die Profile (7.3), die Faktoren der Bandbreite (5.2), die Zahlen der
// Kurzfassung und die Version im Kopf und vergleicht sie mit dem Rechenmodul. Weicht ein Wert ab, ist entweder das Dokument oder
// der Code falsch; eine Regeländerung ändert beide im selben Commit.
//
// Fenster („die letzten n Jahre“) werden in beide Richtungen geprüft: Die Testreihen sind so gewählt, dass n − 1, n und n + 1
// Jahre verschiedene Ergebnisse geben. Werte, die im Code als Stützpunkt in einer Regel stehen, prüft der Test am Verhalten.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../backtest/run.ts";
import type { Profile } from "../calc/index.ts";
import {
  DEFAULT_DEBT_PARAMS,
  DEFAULT_GROWTH_PARAMS,
  DEFAULT_PROBABILITY_PARAMS,
  DEFAULT_RETURN_PARAMS,
  DEFAULT_SCENARIO_SPREAD,
  dividendWasCut,
  EXCLUSION_SCORE,
  FINANCIAL_STAND_INS,
  FULL_YEARS,
  hurdleRate,
  MIN_YEARS,
  netBuybacksPerShare,
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
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
  riskClass,
  sustainableCashFlow,
  usableCompensation,
  withHurdle,
} from "../calc/index.ts";
import { parseInflationForecasts } from "../data/reference.ts";
import { FACTOR_QUESTIONS, JUDGED_FACTORS } from "../judgement/factors.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { MAX_PRICE_AGE_DAYS } from "./recompute.ts";
import { PRICE_DROP, REVIEW_MONTHS, reviewOf } from "./review.ts";
import { STRATEGY_VERSION } from "./run.ts";
import { keyedValues, markdownTables, parseValue, prose, strategyHead, withoutHead } from "./strategyDocument.ts";
import { MIN_MARKET_CAP_EUR } from "./universe.ts";
import { growthInputBounds, MAX_PAYOUT_YIELD, MIN_PRICE_TO_EARNINGS, MIN_SHARE_JUMP, proposeInputs } from "./valuation.ts";

const docs = join(import.meta.dirname, "..", "..", "docs");
const strategy = readFileSync(join(docs, "STRATEGIE.md"), "utf8");
const changes = readFileSync(join(docs, "STRATEGIE-AENDERUNGEN.md"), "utf8");
const tables = markdownTables(strategy);

function tablesIn(section: string, header?: string) {
  const found = tables.filter((t) => t.section.startsWith(`${section} `) && (header === undefined || t.header.includes(header)));
  if (found.length === 0) throw new Error(`Keine Tabelle in Abschnitt ${section}`);
  return found;
}

/** Alle Tabellen mit Schlüssel und Wert, wo immer sie im Dokument stehen. */
const parameters = new Map<string, string>();
for (const table of tables.filter((t) => t.header.includes("Schlüssel") && t.header.includes("Wert"))) {
  for (const [key, text] of keyedValues(table)) {
    if (parameters.has(key)) throw new Error(`Schlüssel doppelt: ${key}`);
    parameters.set(key, text);
  }
}

/** Wert eines Schlüssels als Zahl; ein fehlender Schlüssel lässt den Test scheitern. */
function value(key: string): number {
  const text = parameters.get(key);
  if (text === undefined) throw new Error(`Schlüssel fehlt im Dokument: ${key}`);
  const parsed = parseValue(text).value;
  if (parsed === null) throw new Error(`Schlüssel ${key} hat keinen Zahlenwert`);
  return parsed;
}

const close = (a: number, b: number) => {
  expect(a).toBeCloseTo(b, 10);
};
const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m]! : (sorted[m - 1]! + sorted[m]!) / 2;
};
/** Die Testreihe muss für n − 1, n und n + 1 verschiedene Ergebnisse liefern, sonst prüft sie das Fenster nicht. */
function distinct(f: (n: number) => number, n: number) {
  expect(new Set([f(n - 1), f(n), f(n + 1)].map((x) => x.toFixed(9))).size).toBe(3);
}
const tenYears = (overrides: Record<number, number>, base = 10) => Array.from({ length: 10 }, (_, i) => overrides[i] ?? base);
const noDebt = { netDebt: 0, operatingCashFlow: 1, ebit: 1, interestExpense: 0, currentAssets: 1, currentLiabilities: 0 };
const isoAfter = (date: string, months: number, days = 0) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

type Unit = "%" | "Prozentpunkte" | "Jahre" | "Monate" | "Tage" | "-fach" | "Mrd. €" | "Mio. €" | "Läufe";
interface Check {
  unit: Unit;
  check: (v: number) => void;
}

/**
 * Je Schlüssel die erwartete Einheit und die Prüfung gegen den Code: direkt gegen die Konstante oder, wo der Wert als Stützpunkt
 * in einer Regel steht, über das Verhalten an der Grenze.
 */
const CHECKS: Record<string, Check> = {
  "reihe.jahre": { unit: "Jahre", check: (v) => expect(FULL_YEARS).toBe(v) },
  "reihe.mindestjahre": { unit: "Jahre", check: (v) => expect(MIN_YEARS).toBe(v) },
  "dividende.kuerzungstoleranz": {
    unit: "%",
    check: (v) => {
      expect(dividendWasCut([1, 1 - v + 1e-9])).toBe(false);
      expect(dividendWasCut([1, 1 - v - 1e-6])).toBe(true);
    },
  },
  "rueckkaeufe.jahre": {
    unit: "Jahre",
    check: (v) => {
      // Rückkauf je Aktie steigt jedes Jahr um 1: Jede Fensterlänge gibt einen anderen Durchschnitt.
      const years = Array.from({ length: 10 }, (_, i) => ({ repurchases: i + 1, issuance: 0, stockBasedCompensation: 0, shares: 1 }));
      const expected = (n: number) => mean(years.slice(-n).map((y) => y.repurchases));
      distinct(expected, v);
      close(netBuybacksPerShare(years), expected(v));
    },
  },
  "cashflow.jahre": {
    unit: "Jahre",
    check: (v) => {
      const series = Array.from({ length: 10 }, (_, i) => i + 1);
      const expected = (n: number) => mean(series.slice(-n));
      distinct(expected, v);
      const level = sustainableCashFlow(series)!;
      close(level.cashFlow, expected(v));
      expect(level.windowYears).toBe(v);
      // Fehlt ein Jahr im Fenster, gibt es keinen Wert; fehlt eines davor, schon.
      expect(sustainableCashFlow(series.map((x, i) => (i === 10 - v ? null : x)))).toBeNull();
      expect(sustainableCashFlow(series.map((x, i) => (i === 9 - v ? null : x)))).not.toBeNull();
    },
  },
  "zyklus.mindestjahre": {
    unit: "Jahre",
    check: (v) => {
      const series = (n: number) => Array.from({ length: n }, (_, i) => n - i);
      expect(sustainableCashFlow(series(v), { cyclical: true })!.longMedian).not.toBeNull();
      expect(sustainableCashFlow(series(v - 1), { cyclical: true })!.longMedian).toBeNull();
    },
  },
  "verguetung.ausreisser": {
    unit: "-fach",
    check: (v) => {
      expect(usableCompensation([1, 1, 1, v * 1.01]).flagged).toBe(1);
      expect(usableCompensation([1, 1, 1, v * 0.99]).flagged).toBe(0);
    },
  },
  "verguetung.ausreisser_mindestjahre": {
    unit: "Jahre",
    check: (v) => {
      const outlier = value("verguetung.ausreisser") * 10;
      const withPositive = (n: number) => [...Array.from({ length: n - 1 }, () => 1), outlier];
      expect(usableCompensation(withPositive(v)).flagged).toBe(1);
      expect(usableCompensation(withPositive(v - 1)).flagged).toBe(0);
    },
  },
  "schulden.ebitda_vielfaches": { unit: "-fach", check: (v) => expect(DEFAULT_DEBT_PARAMS.maxDebtToEbitda).toBe(v) },
  "schulden.tilgungsjahre": { unit: "Jahre", check: (v) => expect(DEFAULT_DEBT_PARAMS.repaymentYears).toBe(v) },
  "wachstum.obergrenze": { unit: "%", check: (v) => close(DEFAULT_GROWTH_PARAMS.maxGrowth, v) },
  "wachstum.preissteigerung": {
    unit: "%",
    check: (v) => {
      close(DEFAULT_GROWTH_PARAMS.inflationAllowance, v);
      close(DEFAULT_RETURN_PARAMS.inflationAllowance, v);
    },
  },
  "wachstum.untergrenze": { unit: "%", check: (v) => close(DEFAULT_GROWTH_PARAMS.minGrowth, v) },
  "wachstum.obergrenze_umsatz": { unit: "%", check: (v) => close(DEFAULT_GROWTH_PARAMS.maxGrowthFromRevenue, v) },
  "wachstum.abschmelzjahre": { unit: "Jahre", check: (v) => expect(DEFAULT_RETURN_PARAMS.fadeYears).toBe(v) },
  "wachstum.dauerwachstum": { unit: "%", check: (v) => close(DEFAULT_RETURN_PARAMS.maxTerminalGrowth, v) },
  "quote.rendite_einbehalten": { unit: "%", check: (v) => close(DEFAULT_RETURN_PARAMS.returnOnRetained, v) },
  "waehrung.prognosejahre": {
    unit: "Jahre",
    check: (v) => {
      // Prognose k Jahre nach dem laufenden ist k Prozent; das Mittel der ersten v Jahre ist (v + 1) / 2 Prozent.
      const years = Object.fromEntries(Array.from({ length: 10 }, (_, k) => [String(2026 + k), k]));
      close(parseInflationForecasts({ values: { PCPIPCH: { EURO: years } } }, 2026).EUR!, (v + 1) / 2 / 100);
    },
  },
  "bandbreite.rueckfluss": { unit: "%", check: (v) => close(DEFAULT_SCENARIO_SPREAD.payoutFactor, v) },
  "bandbreite.wachstum": { unit: "Prozentpunkte", check: (v) => close(DEFAULT_SCENARIO_SPREAD.growthPoints, v) },
  "faktor1.vorjahre": {
    unit: "Jahre",
    check: (v) => {
      // Vor dem geprüften Jahr: ein niedriges Jahr, dann v − 1 hohe, dann wieder ein niedriges. Nur mit genau v Vorjahren
      // liegt der Median hoch genug, dass das geprüfte Jahr ein Einbruch ist. Das EBIT bestätigt nur dieses Jahr.
      const before = [1, ...Array.from({ length: v - 1 }, () => 10), 1];
      const target = 4.9;
      const eps = [...before, target, ...Array.from({ length: 9 - before.length }, () => 10)];
      const at = before.length;
      const collapses = (n: number) => (target < median(before.slice(-n)) * value("faktor1.einbruch") ? 1 : 0);
      expect([collapses(v - 1), collapses(v), collapses(v + 1)]).toEqual([0, 1, 0]);
      const ebit = eps.map((_, i) => (i === at ? 1 : 10));
      expect(proposeEarnings(eps, ebit)).toBe(value("faktor1.abzug_einbruch"));
    },
  },
  "faktor1.verlustjahre_hoch": {
    unit: "Jahre",
    check: (v) => {
      const losses = (count: number) => tenYears(Object.fromEntries(Array.from({ length: count }, (_, i) => [i * 2, -1])));
      expect(proposeEarnings(losses(v))).toBe(RISK_FACTORS.earnings.maxDeduction);
      expect(proposeEarnings(losses(v - 1))).toBe(value("faktor1.abzug_verlust"));
    },
  },
  "faktor1.abzug_verlust": { unit: "%", check: (v) => expect(proposeEarnings(tenYears({ 4: -1 }))).toBe(v) },
  "faktor1.abzug_einbruch": { unit: "%", check: (v) => expect(proposeEarnings(tenYears({ 4: 1 }))).toBe(v) },
  "faktor1.einbruch": {
    unit: "%",
    check: (v) => {
      expect(proposeEarnings(tenYears({ 4: 10 * v - 0.01 }))).toBe(value("faktor1.abzug_einbruch"));
      expect(proposeEarnings(tenYears({ 4: 10 * v + 0.01 }))).toBe(0);
    },
  },
  "faktor1.einbruch_ebit": {
    unit: "%",
    check: (v) => {
      const eps = tenYears({ 4: 1 });
      expect(proposeEarnings(eps, tenYears({ 4: 10 * v - 0.01 }))).toBe(value("faktor1.abzug_einbruch"));
      expect(proposeEarnings(eps, tenYears({ 4: 10 * v + 0.01 }))).toBe(0);
    },
  },
  "faktor2.cashflow_jahre": {
    unit: "Jahre",
    check: (v) => {
      // Operativer Cashflow steigt jedes Jahr; die Nettoschulden liegen so, dass das Verhältnis zwischen den Stützpunkten liegt.
      const years = steadyYears((y, i) => {
        y.operatingCashFlow = 100 * (i + 1);
        y.netDebt = i === 9 ? 4000 : 0;
      });
      const ocf = (n: number) => mean(years.slice(-n).map((y) => y.operatingCashFlow!));
      const expected = (n: number) =>
        proposeFinancing({
          netDebt: 4000,
          operatingCashFlow: ocf(n),
          ebit: years[9]!.ebit!,
          interestExpense: 0,
          currentAssets: years[9]!.currentAssets!,
          currentLiabilities: years[9]!.currentLiabilities!,
          earningsRating: proposeEarnings(years.map((y) => y.epsDiluted!)),
        });
      distinct(expected, v);
      close(proposeInputs(stock, years, 1, 2026).values["risk.financing"]!, expected(v));
    },
  },
  "faktor2.schulden_ohne_abzug": {
    unit: "-fach",
    check: (v) => {
      expect(proposeFinancing({ ...noDebt, netDebt: v })).toBe(0);
      expect(proposeFinancing({ ...noDebt, netDebt: v + 0.01 })).toBeGreaterThan(0);
    },
  },
  "faktor2.schulden_voller_abzug": {
    unit: "-fach",
    check: (v) => {
      close(proposeFinancing({ ...noDebt, netDebt: v }), value("faktor2.abzug_schulden"));
      expect(proposeFinancing({ ...noDebt, netDebt: v - 0.01 })).toBeLessThan(value("faktor2.abzug_schulden"));
    },
  },
  "faktor2.abzug_schulden": {
    unit: "%",
    check: (v) => {
      close(proposeFinancing({ ...noDebt, netDebt: 100 }), v);
      close(proposeFinancing({ ...noDebt, netDebt: 1, operatingCashFlow: 0 }), v);
    },
  },
  "faktor2.zinsdeckung_ohne_abzug": {
    unit: "-fach",
    check: (v) => {
      expect(proposeFinancing({ ...noDebt, ebit: v, interestExpense: 1 })).toBe(0);
      expect(proposeFinancing({ ...noDebt, ebit: v - 0.01, interestExpense: 1 })).toBeGreaterThan(0);
    },
  },
  "faktor2.zinsdeckung_voller_abzug": {
    unit: "-fach",
    check: (v) => {
      close(proposeFinancing({ ...noDebt, ebit: v, interestExpense: 1 }), value("faktor2.abzug_zinsdeckung"));
      expect(proposeFinancing({ ...noDebt, ebit: v + 0.01, interestExpense: 1 })).toBeLessThan(value("faktor2.abzug_zinsdeckung"));
    },
  },
  "faktor2.abzug_zinsdeckung": { unit: "%", check: (v) => close(proposeFinancing({ ...noDebt, ebit: 0, interestExpense: 1 }), v) },
  "faktor2.abzug_kurzfristig": { unit: "%", check: (v) => close(proposeFinancing({ ...noDebt, currentLiabilities: 2 }), v) },
  "faktor2.anteil_stetig": {
    unit: "%",
    check: (v) => close(proposeFinancing({ ...noDebt, netDebt: 100, earningsRating: 0 }), value("faktor2.abzug_schulden") * v),
  },
  "faktor2.anteil_steigend": {
    unit: "%",
    check: (v) => close(proposeFinancing({ ...noDebt, netDebt: 100, earningsRating: -0.1 }), value("faktor2.abzug_schulden") * v),
  },
  "faktor3.ohne_abzug": {
    unit: "Mrd. €",
    check: (v) => {
      expect(proposeSize(v)).toBe(0);
      expect(proposeSize(v * 0.99)).toBeGreaterThan(0);
    },
  },
  "faktor3.voller_abzug": {
    unit: "Mio. €",
    check: (v) => {
      close(proposeSize(v), RISK_FACTORS.size.maxDeduction);
      expect(proposeSize(v * 1.01)).toBeLessThan(RISK_FACTORS.size.maxDeduction);
    },
  },
  "faktor4.ohne_abzug": {
    unit: "Jahre",
    check: (v) => {
      expect(proposeAge(v)).toBe(0);
      expect(proposeAge(v - 0.1)).toBeGreaterThan(0);
    },
  },
  "faktor4.voller_abzug": {
    unit: "Jahre",
    check: (v) => {
      close(proposeAge(v), RISK_FACTORS.age.maxDeduction);
      expect(proposeAge(v + 0.1)).toBeLessThan(RISK_FACTORS.age.maxDeduction);
    },
  },
  "faktor6.ausgangswert": {
    unit: "%",
    check: (v) => {
      for (const region of ["Asien", "Südamerika", "Afrika", "Ozeanien"] as const) expect(proposeCountry(region)).toBe(v);
      for (const region of ["Europa", "Nordamerika", "Japan"] as const) expect(proposeCountry(region)).toBe(0);
    },
  },
  "faktor8_9.jahre": {
    unit: "Jahre",
    check: (v) => {
      // EBIT-Marge steigt jedes Jahr um einen halben Punkt, im Bereich zwischen den Stützpunkten.
      const years = steadyYears((y, i) => {
        y.revenue = 10000;
        y.ebit = 500 + 50 * i;
      });
      const expected = (n: number) => proposeProfitability(mean(years.slice(-n).map((y) => y.ebit! / y.revenue!)));
      distinct(expected, v);
      close(proposeInputs(stock, years, 1, 2026).values["risk.ebitMargin"]!, expected(v));
    },
  },
  "faktor8_9.ohne_abzug": {
    unit: "%",
    check: (v) => {
      expect(proposeProfitability(v)).toBe(0);
      expect(proposeProfitability(v - 0.001)).toBeGreaterThan(0);
    },
  },
  "faktor8_9.voller_abzug": {
    unit: "%",
    check: (v) => {
      close(proposeProfitability(v), RISK_FACTORS.returnOnCapital.maxDeduction);
      close(proposeProfitability(v), RISK_FACTORS.ebitMargin.maxDeduction);
      expect(proposeProfitability(v + 0.001)).toBeLessThan(RISK_FACTORS.returnOnCapital.maxDeduction);
    },
  },
  "faktor8_9.bonus_ab": {
    unit: "%",
    check: (v) => {
      expect(proposeProfitability(v)).toBe(-RISK_FACTORS.returnOnCapital.bonus);
      expect(proposeProfitability(v)).toBe(-RISK_FACTORS.ebitMargin.bonus);
      // Zwischen „ohne Abzug“ und „Bonus ab“ kein Abzug, danach ein Sprung (keine Interpolation).
      expect(proposeProfitability(v - 0.001)).toBe(0);
      expect(proposeProfitability((v + value("faktor8_9.ohne_abzug")) / 2)).toBe(0);
    },
  },
  "faktor12.positive_jahre": {
    unit: "%",
    check: (v) => {
      const base = { years: 10, paysOut: true, dividendCutInLastTenYears: false };
      expect(proposeCashFlow({ ...base, positiveFreeCashFlowYears: v * 10 })).toBe(0);
      expect(proposeCashFlow({ ...base, positiveFreeCashFlowYears: v * 10 - 1 })).toBe(value("faktor12.abzug_teilweise"));
    },
  },
  "faktor12.abzug_kuerzung": {
    unit: "%",
    check: (v) =>
      expect(proposeCashFlow({ positiveFreeCashFlowYears: 10, years: 10, paysOut: true, dividendCutInLastTenYears: true })).toBe(v),
  },
  "faktor12.abzug_teilweise": {
    unit: "%",
    check: (v) => {
      expect(proposeCashFlow({ positiveFreeCashFlowYears: 5, years: 10, paysOut: true, dividendCutInLastTenYears: false })).toBe(v);
      expect(proposeCashFlow({ positiveFreeCashFlowYears: 0, years: 10, paysOut: false, dividendCutInLastTenYears: false })).toBe(
        RISK_FACTORS.cashFlow.maxDeduction,
      );
    },
  },
  "finanzwerte.ersatz_finanzierung": { unit: "%", check: (v) => expect(FINANCIAL_STAND_INS.financing).toBe(v) },
  "finanzwerte.ersatz_kapitalrendite": { unit: "%", check: (v) => expect(FINANCIAL_STAND_INS.returnOnCapital).toBe(v) },
  "finanzwerte.ersatz_marge": { unit: "%", check: (v) => expect(FINANCIAL_STAND_INS.ebitMargin).toBe(v) },
  "risiko.grenze_hervorragend": {
    unit: "%",
    check: (v) => {
      expect(riskClass(v)).toBe("hervorragend");
      expect(riskClass(v + 1e-6)).toBe("durchschnittlich");
    },
  },
  "risiko.grenze_durchschnittlich": {
    unit: "%",
    check: (v) => {
      expect(riskClass(v)).toBe("durchschnittlich");
      expect(riskClass(v + 1e-6)).toBe("riskant");
    },
  },
  "risiko.ausschluss": {
    unit: "%",
    check: (v) => {
      expect(EXCLUSION_SCORE).toBe(v);
      expect(riskClass(v)).toBe("Spekulation");
      expect(riskClass(v - 1e-6)).toBe("riskant");
    },
  },
  "ausfall.sockel": { unit: "%", check: (v) => expect(DEFAULT_PROBABILITY_PARAMS.base).toBe(v) },
  "ausfall.je_risikowert": { unit: "%", check: (v) => expect(DEFAULT_PROBABILITY_PARAMS.perScore).toBe(v) },
  "huerde.aufschlag": { unit: "Prozentpunkte", check: (v) => close(hurdleRate(0.025), 0.025 + v) },
  "huerde.mindestwert": { unit: "%", check: (v) => close(hurdleRate(-0.01), Math.max(v, -0.01 + value("huerde.aufschlag"))) },
  "huerde.ersatzwert": {
    unit: "%",
    check: (v) => {
      for (const profile of [PROFILE_FOCUSED, PROFILE_GLOBAL]) expect(withHurdle(profile, null).minReturn).toBe(v);
    },
  },
  "pruefung.monate": {
    unit: "Monate",
    check: (v) => {
      expect(REVIEW_MONTHS).toBe(v);
      const at = (today: string) => reviewOf({ assessedOn: "2026-01-01", today, before: null, now: basis }).overdue;
      expect(at(isoAfter("2026-01-01", v))).toBe(false);
      expect(at(isoAfter("2026-01-01", v, 1))).toBe(true);
    },
  },
  "pruefung.risiko": {
    unit: "Prozentpunkte",
    check: (v) => {
      const changesAfter = (shift: number) =>
        reviewOf({ assessedOn: "2026-01-01", today: "2026-02-01", before: basis, now: { ...basis, numberRisk: 0.1 + shift } }).changes;
      expect(changesAfter(v)).toEqual([]);
      expect(changesAfter(v + 0.001)).toHaveLength(1);
    },
  },
  "pruefung.kursrueckgang": {
    unit: "%",
    check: (v) => {
      expect(PRICE_DROP).toBe(v);
      const dropAt = (priceNow: number) =>
        reviewOf({ assessedOn: "2026-01-01", today: "2026-02-01", before: basis, now: basis, priceBefore: 100, priceNow }).priceDrop;
      expect(dropAt(100 * (1 - v))).toBeNull();
      expect(dropAt(100 * (1 - v) - 0.1)).toBeCloseTo(v + 0.001);
    },
  },
  // Werte der Umsetzung und des Rückblicks (10.3).
  "plausibilitaet.rueckfluss": { unit: "%", check: (v) => expect(MAX_PAYOUT_YIELD).toBe(v) },
  "plausibilitaet.kurs_gewinn": { unit: "-fach", check: (v) => expect(MIN_PRICE_TO_EARNINGS).toBe(v) },
  "plausibilitaet.aktienzahl": { unit: "-fach", check: (v) => expect(MIN_SHARE_JUMP).toBe(v) },
  "plausibilitaet.kursalter": { unit: "Tage", check: (v) => expect(MAX_PRICE_AGE_DAYS).toBe(v) },
  "handwert.wachstum_min": { unit: "%", check: (v) => close(growthInputBounds(0).min / 100, v) },
  "handwert.wachstum_max": { unit: "%", check: (v) => close(growthInputBounds(0).max / 100, v) },
  "rueckblick.marktwert": {
    unit: "Mio. €",
    check: (v) => {
      expect(MIN_MARKET_CAP_EUR).toBe(v);
      expect(DEFAULT_OPTIONS.minCapEur).toBe(v);
    },
  },
  "rueckblick.kosten": { unit: "%", check: (v) => close(DEFAULT_OPTIONS.cost, v) },
  "rueckblick.bargeldzins": { unit: "%", check: (v) => close(DEFAULT_OPTIONS.cashRate, v) },
  "rueckblick.einstellung": { unit: "%", check: (v) => close(DEFAULT_OPTIONS.delistLoss, v) },
  "rueckblick.zufallslaeufe": { unit: "Läufe", check: (v) => expect(DEFAULT_OPTIONS.randomRuns).toBe(v) },
  "rueckblick.fenster": { unit: "Monate", check: (v) => expect(DEFAULT_OPTIONS.windowMonths).toBe(v) },
};
const basis = { payoutLevel: 1, growth: 0.05, earningsLevel: 2, numberRisk: 0.1 };

/** Schlüssel ohne Zahlenwert, mit eigener Prüfung. */
const TEXT_CHECKS: Record<string, (text: string) => void> = {
  "faktor14.hauptwaehrungen": (text) => {
    const currencies = text.split(",").map((c) => c.trim());
    expect(currencies.length).toBeGreaterThan(0);
    for (const currency of currencies) expect(proposeCurrency(currency)).toBe(0);
    expect(proposeCurrency("SEK")).toBe(RISK_FACTORS.currency.maxDeduction);
  },
};

/**
 * Jedes Feld der Parameterobjekte gehört zu einem Schlüssel (oder ausdrücklich zu keinem, mit Grund). Kommt im Code ein Feld
 * hinzu, scheitert der Test, bis es im Dokument steht.
 */
const FIELDS: Record<string, { object: object; keys: Record<string, string | null> }> = {
  DEFAULT_GROWTH_PARAMS: {
    object: DEFAULT_GROWTH_PARAMS,
    keys: {
      maxGrowth: "wachstum.obergrenze",
      minGrowth: "wachstum.untergrenze",
      inflationAllowance: "wachstum.preissteigerung",
      maxGrowthFromRevenue: "wachstum.obergrenze_umsatz",
      // Je Aktie gesetzter Inflationsabstand, kein Parameter der Strategie.
      inflationGap: null,
    },
  },
  DEFAULT_RETURN_PARAMS: {
    object: DEFAULT_RETURN_PARAMS,
    keys: {
      fadeYears: "wachstum.abschmelzjahre",
      maxTerminalGrowth: "wachstum.dauerwachstum",
      inflationAllowance: "wachstum.preissteigerung",
      returnOnRetained: "quote.rendite_einbehalten",
      inflationGap: null,
    },
  },
  DEFAULT_DEBT_PARAMS: {
    object: DEFAULT_DEBT_PARAMS,
    keys: { maxDebtToEbitda: "schulden.ebitda_vielfaches", repaymentYears: "schulden.tilgungsjahre" },
  },
  DEFAULT_SCENARIO_SPREAD: {
    object: DEFAULT_SCENARIO_SPREAD,
    keys: { payoutFactor: "bandbreite.rueckfluss", growthPoints: "bandbreite.wachstum" },
  },
  DEFAULT_PROBABILITY_PARAMS: { object: DEFAULT_PROBABILITY_PARAMS, keys: { base: "ausfall.sockel", perScore: "ausfall.je_risikowert" } },
  FINANCIAL_STAND_INS: {
    object: FINANCIAL_STAND_INS,
    keys: {
      financing: "finanzwerte.ersatz_finanzierung",
      returnOnCapital: "finanzwerte.ersatz_kapitalrendite",
      ebitMargin: "finanzwerte.ersatz_marge",
    },
  },
  DEFAULT_OPTIONS: {
    object: DEFAULT_OPTIONS,
    keys: {
      minCapEur: "rueckblick.marktwert",
      cost: "rueckblick.kosten",
      cashRate: "rueckblick.bargeldzins",
      delistLoss: "rueckblick.einstellung",
      randomRuns: "rueckblick.zufallslaeufe",
      windowMonths: "rueckblick.fenster",
      // Profil und Schrittweite sind Aufrufoptionen des Werkzeugs (Standard: fokussiert, jede Umschichtung), keine Werte.
      profile: null,
      every: null,
    },
  },
};

/** Zeilen der Profiltabelle (7.3) zu den Feldern eines Profils, mit Einheit; `minReturn` steht als `huerde.ersatzwert` in 10.1. */
const PROFILE_ROWS: Record<string, { field: keyof Profile; unit: Unit | "" }> = {
  Basislimit: { field: "baseLimit", unit: "%" },
  Mindestposition: { field: "minPosition", unit: "%" },
  "Neue Titel je Branche und Region": { field: "maxPerSectorAndRegion", unit: "" },
  "Höchstanteil je Branche": { field: "maxSectorShare", unit: "%" },
  "Höchstanteil je Region": { field: "maxRegionShare", unit: "%" },
  Tauschschwelle: { field: "swapThreshold", unit: "Prozentpunkte" },
};

/** Deutsche Schreibweise einer Zahl wie im Dokument: 0.085 → „8,5“ (als Prozent), 15 → „15“. */
const de = (x: number) => String(Math.round(x * 1e6) / 1e6).replace(".", ",");
const pct = (x: number) => `${de(x * 100)} %`;

/** Zahlen mit Einheit im Fließtext. */
const NUMBER_WITH_UNIT = /[+−-]?\d+(?:,\d+)?\s?(?:%|Prozentpunkt|Punkt|Jahre?\b|Monate?\b|-fach|Mrd\.|Mio\.)/g;

/** Die Regel-Teile aller Unterabschnitte 3 bis 7: vom Absatz „**Regel.**“ bis „**Begründung.**“, ohne Tabellen und Formeln. */
function ruleParts(): { section: string; text: string }[] {
  const sections = [...strategy.matchAll(/^### ([3-7]\.\d) /gm)].map((m) => m[1]!);
  expect(sections.length).toBeGreaterThan(20);
  return sections.map((section) => {
    const text = prose(strategy, section);
    const start = text.indexOf("**Regel.**");
    const end = text.indexOf("**Begründung.**");
    expect(start, `Strategie ${section} hat keinen Absatz „Regel“`).toBeGreaterThanOrEqual(0);
    expect(end, `Strategie ${section} hat keinen Absatz „Begründung“`).toBeGreaterThan(start);
    for (const rubric of ["**Herkunft.**", "**Schwächen.**"]) expect(text, `Strategie ${section}: ${rubric} fehlt`).toContain(rubric);
    return { section, text: text.slice(start, end) };
  });
}

describe("Strategie-Dokument und Rechenmodul", () => {
  it("Version im Kopf des Dokuments und im Code stimmen überein", () => {
    expect(strategyHead(strategy)?.version).toBe(STRATEGY_VERSION);
  });

  it("der jüngste Eintrag im Änderungsprotokoll gehört zur geltenden Version", () => {
    const newest = /^## .*Version (\d+\.\d+)/m.exec(changes);
    expect(newest?.[1]).toBe(STRATEGY_VERSION);
  });

  it("jeder Schlüssel der Tabellen hat eine Prüfung und umgekehrt", () => {
    expect([...parameters.keys()].sort()).toEqual([...Object.keys(CHECKS), ...Object.keys(TEXT_CHECKS)].sort());
  });

  it.each(Object.keys(CHECKS))("Parameter %s hat die erwartete Einheit und stimmt mit dem Code überein", (key) => {
    expect(parseValue(parameters.get(key)!).unit).toBe(CHECKS[key]!.unit);
    CHECKS[key]!.check(value(key));
  });

  it.each(Object.keys(TEXT_CHECKS))("Parameter %s stimmt mit dem Code überein", (key) => {
    TEXT_CHECKS[key]!(parameters.get(key)!);
  });

  it.each(Object.keys(FIELDS))("jedes Feld von %s steht in einer Tabelle", (name) => {
    const { object, keys } = FIELDS[name]!;
    expect(Object.keys(object).sort()).toEqual(Object.keys(keys).sort());
    for (const key of Object.values(keys)) if (key !== null) expect(parameters.has(key)).toBe(true);
  });

  it("das Risikoraster (6.1) nennt alle Faktoren mit Höchstabzug, Bonus und Art wie im Code", () => {
    const [raster] = tablesIn("6.1", "Höchstabzug");
    const column = (name: string) => raster!.header.indexOf(name);
    expect(raster!.rows).toHaveLength(RISK_FACTOR_IDS.length);
    raster!.rows.forEach((row, i) => {
      const factor = RISK_FACTORS[RISK_FACTOR_IDS[i]!];
      expect(row[column("#")]).toBe(String(i + 1));
      expect(row[column("Faktor")]).toBe(factor.label);
      expect(parseValue(row[column("Höchstabzug")]!)).toEqual({ value: expect.closeTo(factor.maxDeduction, 10), unit: "%" });
      const bonus = parseValue(row[column("Bonus")]!);
      close(bonus.value ?? 0, factor.bonus);
      if (bonus.value !== null) expect(bonus.unit).toBe("%");
      expect(row[column("Art")]).toBe(factor.manual ? "Urteil" : "Zahlen");
    });
  });

  it("die Stufen der Urteilsfaktoren (6.3) stimmen mit den Stufen im Code überein", () => {
    const levels = tablesIn("6.3", "Merkmal");
    expect(levels).toHaveLength(JUDGED_FACTORS.length);
    JUDGED_FACTORS.forEach((factor, i) => {
      const column = levels[i]!.header.indexOf("Abzug");
      const parsed = levels[i]!.rows.map((row) => parseValue(row[column]!));
      expect(parsed.every((p) => p.unit === "%")).toBe(true);
      expect(parsed.map((p) => p.value)).toEqual(FACTOR_QUESTIONS[factor].levels.map((level) => expect.closeTo(level.value, 10)));
    });
  });

  it("die Profiltabelle (7.3) stimmt mit beiden Profilen überein und deckt alle Felder ab", () => {
    const [table] = tablesIn("7.3", "fokussiert");
    const label = table!.header.indexOf("Regel");
    expect(table!.rows.map((row) => row[label]).sort()).toEqual(Object.keys(PROFILE_ROWS).sort());
    for (const [name, profile] of [
      ["fokussiert", PROFILE_FOCUSED],
      ["global", PROFILE_GLOBAL],
    ] as const) {
      const column = table!.header.indexOf(name);
      for (const row of table!.rows) {
        const { field, unit } = PROFILE_ROWS[row[label]!]!;
        const expected = profile[field];
        const parsed = parseValue(row[column]!);
        if (expected === null) expect(parsed.value).toBeNull();
        else {
          close(parsed.value!, expected);
          expect(parsed.unit).toBe(unit);
        }
      }
    }
    expect(Object.keys(PROFILE_FOCUSED).sort()).toEqual([...Object.values(PROFILE_ROWS).map((r) => r.field), "minReturn"].sort());
  });

  it("die Faktoren der Bandbreite (5.2) folgen den Abständen im Code", () => {
    const [table] = tablesIn("5.2", "Fall");
    const row = (name: string) => table!.rows.find((r) => r[0] === name)!.join(" ");
    const { payoutFactor, growthPoints } = DEFAULT_SCENARIO_SPREAD;
    const points = `${de(growthPoints * 100)} Prozentpunkt`;
    expect(row("vorsichtig")).toContain(`· ${de(1 - payoutFactor)}`);
    expect(row("vorsichtig")).toContain(`g0 − ${points}`);
    expect(row("optimistisch")).toContain(`· ${de(1 + payoutFactor)}`);
    expect(row("optimistisch")).toContain(`g0 + ${points}`);
  });

  it("die Zahlen der Kurzfassung (1) stimmen mit dem Code und dem Rückblick (8.2) überein", () => {
    const summary = prose(strategy, "1");
    const judged = RISK_FACTOR_IDS.filter((id) => RISK_FACTORS[id].manual).length;
    // Jede Zahl ohne Vorzeichen muss einer dieser Werte aus dem Code sein …
    const allowed = new Set([
      `${FULL_YEARS} Jahre`,
      pct(DEFAULT_GROWTH_PARAMS.maxGrowth),
      `${DEFAULT_RETURN_PARAMS.fadeYears} Jahre`,
      pct(DEFAULT_RETURN_PARAMS.maxTerminalGrowth),
      pct(DEFAULT_PROBABILITY_PARAMS.base),
      pct(DEFAULT_PROBABILITY_PARAMS.perScore),
      pct(EXCLUSION_SCORE),
    ]);
    const unsigned = [...summary.matchAll(NUMBER_WITH_UNIT)].map((m) => m[0]).filter((n) => !/^[+−-]/.test(n));
    expect(unsigned.length).toBeGreaterThan(0);
    for (const n of unsigned) expect(allowed, `Kurzfassung nennt „${n}“`).toContain(n);
    // … und jeder dieser Werte steht dort, wo die Kurzfassung ihn braucht.
    for (const n of allowed) expect(summary).toContain(n);
    expect(summary).toContain(`${RISK_FACTOR_IDS.length} Faktoren, ${RISK_FACTOR_IDS.length - judged} aus Zahlen und ${judged} aus Urteil`);
    // Zahlen mit Vorzeichen sind Ergebnisse des Rückblicks und müssen in 8.2 stehen.
    const results = markdownTables(strategy)
      .filter((t) => t.section.startsWith("8.2 "))
      .flatMap((t) => t.rows.flat())
      .join(" ");
    for (const n of [...summary.matchAll(/[+−]\d+(?:,\d+)? %/g)].map((m) => m[0])) expect(results).toContain(n);
  });

  it("die Regeln in 3 bis 7 nennen keine Zahlenwerte im Fließtext, sondern verweisen auf die Tabellen", () => {
    const limit = 1 - PROFILE_GLOBAL.minPosition / PROFILE_GLOBAL.baseLimit;
    // Die einzige abgeleitete Zahl in einer Regel: die Folge von Mindestposition und Basislimit im globalen Profil (7.2).
    const derived = `etwa ${Math.round(limit * 100)} %`;
    const parts = ruleParts();
    expect(parts.find((p) => p.section === "7.2")!.text).toContain(derived);
    for (const { section, text } of parts) {
      const numbers = [...text.replace(derived, "").matchAll(NUMBER_WITH_UNIT)].map((m) => m[0]);
      expect(numbers, `Strategie ${section}: Zahlen im Regeltext`).toEqual([]);
    }
  });
});

describe("Lesen des Dokuments", () => {
  it("liest Version und Datum aus der Kopfzeile", () => {
    expect(strategyHead("# Titel\n\n**Version 2.3** vom 01.02.2027\n")).toEqual({ version: "2.3", date: "2027-02-01" });
    expect(strategyHead("# Titel ohne Version")).toBeNull();
  });

  it("entfernt die Kopfzeile für die Anzeige", () => {
    expect(withoutHead("# Titel\n\n**Version 2.3** vom 01.02.2027\n\nText\n")).toBe("# Titel\n\nText\n");
    expect(strategyHead(withoutHead(strategy))).toBeNull();
  });

  it("liest Zahlen in deutscher Schreibweise mit Einheit", () => {
    expect(parseValue("8,5 %")).toEqual({ value: expect.closeTo(0.085, 12), unit: "%" });
    expect(parseValue("−5 %").value).toBeCloseTo(-0.05, 12);
    expect(parseValue("1 Prozentpunkt")).toEqual({ value: expect.closeTo(0.01, 12), unit: "Prozentpunkte" });
    expect(parseValue("3 Prozentpunkte").value).toBeCloseTo(0.03, 12);
    expect(parseValue("20 Mrd. €")).toEqual({ value: 2e10, unit: "Mrd. €" });
    expect(parseValue("20 Mio. €")).toEqual({ value: 2e7, unit: "Mio. €" });
    expect(parseValue("3-fach")).toEqual({ value: 3, unit: "-fach" });
    expect(parseValue("1 Jahr")).toEqual({ value: 1, unit: "Jahre" });
    expect(parseValue("12 Monate")).toEqual({ value: 12, unit: "Monate" });
    expect(parseValue("200 Läufe")).toEqual({ value: 200, unit: "Läufe" });
    expect(parseValue("1.000")).toEqual({ value: 1000, unit: "" });
    expect(parseValue("höchstens 2")).toEqual({ value: 2, unit: "" });
    expect(parseValue("−20 % (Bonus)")).toEqual({ value: expect.closeTo(-0.2, 12), unit: "%" });
    expect(parseValue("keine Grenze").value).toBeNull();
    expect(parseValue("–").value).toBeNull();
    expect(() => parseValue("viel")).toThrow("Keine Zahl");
    expect(() => parseValue("5 $")).toThrow("Unbekannte Einheit");
  });

  it("findet Tabellen mit ihrem Abschnitt und überspringt Codeblöcke", () => {
    const markdown = [
      "## 1. Eins",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
      "```",
      "| kein | Tisch |",
      "| ---- | ----- |",
      "```",
      "### 1.1 Unterabschnitt",
      "| Schlüssel | Wert |",
      "| --------- | ---- |",
      "| `a.b`     | 3 %  |",
    ].join("\n");
    const found = markdownTables(markdown);
    expect(found.map((t) => t.section)).toEqual(["1. Eins", "1.1 Unterabschnitt"]);
    expect(found[0]!.rows).toEqual([["1", "2"]]);
    expect(keyedValues(found[1]!)).toEqual(new Map([["a.b", "3 %"]]));
    expect(() => keyedValues(found[0]!)).toThrow("keine Spalten");
  });

  it("lehnt doppelte Schlüssel ab", () => {
    const [table] = markdownTables("| Schlüssel | Wert |\n| --- | --- |\n| a | 1 |\n| a | 2 |");
    expect(() => keyedValues(table!)).toThrow("doppelt");
  });

  it("liest den Fließtext eines Abschnitts ohne Tabellen und Formeln", () => {
    const markdown = "## 1. Eins\n\nText 1\n\n| a |\n| - |\n\n```\nformel 2\n```\n\n### 1.1 Unter\n\nText 3\n\n## 2. Zwei\n\nText 4\n";
    expect(prose(markdown, "1")).toContain("Text 1");
    expect(prose(markdown, "1")).toContain("Text 3");
    expect(prose(markdown, "1")).not.toContain("formel");
    expect(prose(markdown, "1")).not.toContain("Text 4");
    expect(prose(markdown, "1.1").trim()).toBe("Text 3");
    expect(() => prose(markdown, "9")).toThrow("fehlt");
  });
});
