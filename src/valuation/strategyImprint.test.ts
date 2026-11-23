// Abdruck der Strategie je Version (Spezifikation 1). Der Test rechnet einen festen Satz Beispielaktien durch Vorschlag,
// Bewertung und Zielportfolio und hält Ergebnis und alle Parameter in `imprints/strategie-<Version>.json` fest. Ändert sich das
// Ergebnis, ohne dass `STRATEGY_VERSION` steigt, bricht der Test: Entweder hat sich eine Regel geändert (dann Version, Strategie
// und Änderungsprotokoll nachziehen), oder die Änderung ist bewusst ohne Wirkung auf das Zielportfolio – dann den Abdruck mit
// `mise run strategy:imprint` neu schreiben und den Commit mit `Strategie: ohne Wirkung` kennzeichnen (Hook `commit-msg`).
//
// Die Tabellen gegen den Code prüft `strategyDocument.test.ts`; dieser Test fängt, was dort durchrutscht: geänderte Logik ohne
// neuen Wert und geänderte Werte ohne neue Version.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPTIONS } from "../backtest/run.ts";
import {
  DEFAULT_DEBT_PARAMS,
  DEFAULT_GROWTH_PARAMS,
  DEFAULT_PROBABILITY_PARAMS,
  DEFAULT_RETURN_PARAMS,
  DEFAULT_SCENARIO_SPREAD,
  EXCLUSION_SCORE,
  FINANCIAL_STAND_INS,
  FULL_YEARS,
  MANUAL_FOR_FINANCIALS,
  MIN_YEARS,
  type Stock as PortfolioStock,
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
  type Profile,
  RISK_FACTOR_IDS,
  RISK_FACTORS,
  targetPortfolio,
  withHurdle,
} from "../calc/index.ts";
import type { FundamentalsYear, Stock } from "../data/db.ts";
import { FACTOR_QUESTIONS, JUDGED_FACTORS } from "../judgement/factors.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { REVIEW_MONTHS } from "./review.ts";
import { STRATEGY_VERSION } from "./run.ts";
import { MIN_MARKET_CAP_EUR } from "./universe.ts";
import { evaluate, type InputValues, proposeInputs } from "./valuation.ts";

const IMPRINT = join(import.meta.dirname, "imprints", `strategie-${STRATEGY_VERSION}.json`);

interface Example {
  id: string;
  stock?: Partial<Stock>;
  years: FundamentalsYear[];
  price: number;
  /** Einheiten der Berichtswährung je Euro. */
  fx?: number;
  inflationGap?: number;
  /** Stufe (0 = beste) für alle Urteilsfaktoren. */
  level: number;
  /** Gewicht im Bestand, für Tauschschwelle und Halten. */
  held?: number;
}

/** Beispielaktien, die möglichst viele Regeln berühren: Deckel, Wachstum, Schrumpfen, Schulden, Finanzwerte, Fremdwährung. */
const EXAMPLES: Example[] = [
  { id: "RUHIG", years: steadyYears(), price: 40, level: 0 },
  { id: "RUHIG.TEUER", years: steadyYears(), price: 90, level: 1, held: 0.1 },
  {
    id: "WACHSTUM",
    years: steadyYears((y, i) => {
      y.epsDiluted = 3 * 1.12 ** i;
      y.dividendPerShare = 1 * 1.1 ** i;
      y.freeCashFlow = 500 * 1.12 ** i;
    }),
    price: 60,
    level: 1,
  },
  {
    id: "SCHRUMPF",
    stock: { sector: "Telekom" },
    years: steadyYears((y, i) => {
      y.epsDiluted = 6 - i * 0.3;
      y.revenue = 5000 * 0.97 ** i;
    }),
    price: 30,
    level: 2,
  },
  {
    id: "DECKEL",
    years: steadyYears((y) => {
      y.freeCashFlow = 250;
      y.repurchases = 300;
    }),
    price: 35,
    level: 1,
  },
  {
    id: "SCHULDEN",
    stock: { sector: "Versorger" },
    years: steadyYears((y) => {
      y.netDebt = 4000;
      y.longTermDebt = 4500;
      y.interestExpense = 150;
    }),
    price: 25,
    level: 1,
    held: 0.05,
  },
  {
    id: "ZYKLIKER",
    stock: { sector: "Rohstoffe", region: "Ozeanien", country: "AU", reportingCurrency: "AUD", priceCurrency: "AUD" },
    years: steadyYears((y, i) => {
      y.epsDiluted = [6, 2, -1, 4, 7, 3, 1, 5, 8, 4][i]!;
      y.dividendPerShare = [3, 1, 0, 2, 3.5, 1.5, 0.5, 2.5, 4, 2][i]!;
      y.freeCashFlow = [700, 250, -50, 450, 800, 350, 150, 550, 900, 450][i]!;
    }),
    price: 70,
    fx: 1.65,
    inflationGap: 0.006,
    level: 2,
  },
  {
    id: "BANK",
    stock: { sector: "Banken", isFinancial: true, region: "Nordamerika", country: "US", reportingCurrency: "USD", priceCurrency: "USD" },
    years: steadyYears((y) => {
      y.netDebt = null;
      y.ebit = null;
    }),
    price: 45,
    fx: 1.08,
    inflationGap: 0.004,
    level: 0,
  },
  {
    id: "JUNG",
    stock: { foundedYear: 2012, region: "Asien", country: "SG", reportingCurrency: "SGD", priceCurrency: "SGD" },
    years: steadyYears().slice(3),
    price: 38,
    fx: 1.45,
    inflationGap: -0.003,
    level: 3,
  },
  {
    id: "KUERZUNG",
    years: steadyYears((y, i) => {
      y.dividendPerShare = i < 6 ? 2.5 : 1.2;
      y.stockBasedCompensation = 30;
      y.issuance = 50;
    }),
    price: 28,
    level: 1,
  },
  {
    id: "OHNE.AUSSCHUETTUNG",
    years: steadyYears((y) => {
      y.dividendPerShare = 0;
      y.repurchases = 0;
    }),
    price: 50,
    level: 0,
  },
];

/** Zwölf gültige Ziffern: genug, um jede Regeländerung zu sehen, und unempfindlich gegen Rundung der Plattform. */
function round(value: unknown): unknown {
  if (typeof value === "number") return Number.isFinite(value) ? Number(value.toPrecision(12)) : String(value);
  if (Array.isArray(value)) return value.map(round);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, round(v)]));
  return value;
}

function judged(example: Example, isFinancial: boolean, proposed: InputValues): InputValues {
  const manual: InputValues = {};
  for (const factor of JUDGED_FACTORS) {
    const levels = FACTOR_QUESTIONS[factor].levels;
    manual[`risk.${factor}`] = levels[Math.min(example.level, levels.length - 1)]!.value;
  }
  // Bei Finanzwerten setzt der Nutzer 2, 8 und 9 von Hand; hier ein fester mittlerer Wert, nicht der Ersatzabzug.
  if (isFinancial) for (const id of MANUAL_FOR_FINANCIALS) if (proposed[`risk.${id}`] === undefined) manual[`risk.${id}`] = 0.05;
  return manual;
}

function imprint() {
  const valued = EXAMPLES.map((example) => {
    const subject: Stock = { ...stock, ...example.stock, id: example.id };
    const gap = example.inflationGap ?? 0;
    const proposals = proposeInputs(subject, example.years, example.fx ?? 1, 2026, undefined, gap);
    const manual = judged(example, subject.isFinancial, proposals.values);
    const valuation = evaluate(
      proposals.values,
      manual,
      example.price,
      gap,
      proposals.details.earningsLevel,
      proposals.details.payoutEarningsLevel ?? null,
      proposals.standIns,
    );
    const portfolioStock: PortfolioStock = {
      id: example.id,
      innerReturn: valuation.returns?.base ?? null,
      riskScore: valuation.riskScore,
      complete: valuation.complete,
      sector: subject.sector,
      region: subject.region,
      heldWeight: example.held ?? 0,
    };
    return {
      result: {
        id: example.id,
        proposals: proposals.values,
        standIns: proposals.standIns,
        details: proposals.details,
        notes: proposals.notes,
        inputs: valuation.inputs,
        missing: valuation.missing,
        complete: valuation.complete,
        riskScore: valuation.riskScore,
        riskClass: valuation.riskClass,
        defaultProbability: valuation.defaultProbability,
        returns: valuation.returns,
        localReturn: valuation.localReturn,
        payoutRatio: valuation.payoutRatio,
      },
      portfolioStock,
    };
  });
  const stocks = valued.map((v) => v.portfolioStock);
  const portfolios = Object.fromEntries(
    (
      [
        ["fokussiert", PROFILE_FOCUSED],
        ["global", PROFILE_GLOBAL],
      ] as [string, Profile][]
    ).flatMap(([name, profile]) => [
      [`${name} ohne Anleiherendite`, targetPortfolio(stocks, withHurdle(profile, null))],
      [`${name} bei 5 % Anleiherendite`, targetPortfolio(stocks, withHurdle(profile, 0.05))],
    ]),
  );
  return round({
    version: STRATEGY_VERSION,
    parameters: {
      FULL_YEARS,
      MIN_YEARS,
      EXCLUSION_SCORE,
      REVIEW_MONTHS,
      MIN_MARKET_CAP_EUR,
      DEFAULT_GROWTH_PARAMS,
      DEFAULT_RETURN_PARAMS,
      DEFAULT_DEBT_PARAMS,
      DEFAULT_SCENARIO_SPREAD,
      DEFAULT_PROBABILITY_PARAMS,
      FINANCIAL_STAND_INS,
      RISK_FACTORS: Object.fromEntries(RISK_FACTOR_IDS.map((id) => [id, RISK_FACTORS[id]])),
      JUDGED_LEVELS: Object.fromEntries(JUDGED_FACTORS.map((f) => [f, FACTOR_QUESTIONS[f].levels.map((l) => l.value)])),
      PROFILE_FOCUSED,
      PROFILE_GLOBAL,
      BACKTEST_OPTIONS: DEFAULT_OPTIONS,
    },
    examples: valued.map((v) => v.result),
    portfolios,
  });
}

describe("Abdruck der Strategie", () => {
  it(`Rechnung und Parameter entsprechen dem Abdruck der Version ${STRATEGY_VERSION}`, () => {
    const current = imprint();
    if (process.env.STRATEGY_IMPRINT === "schreiben") writeFileSync(IMPRINT, `${JSON.stringify(current, null, 2)}\n`);
    expect(
      existsSync(IMPRINT),
      `Kein Abdruck für Version ${STRATEGY_VERSION}. Neue Version: \`mise run strategy:imprint\` und die Datei committen.`,
    ).toBe(true);
    const stored = JSON.parse(readFileSync(IMPRINT, "utf8"));
    expect(
      current,
      `Die Rechnung weicht vom Abdruck der Version ${STRATEGY_VERSION} ab. Regeländerung: Version erhöhen, STRATEGIE.md und ` +
        "Änderungsprotokoll nachziehen. Ohne Wirkung auf das Zielportfolio: `mise run strategy:imprint` und im Commit " +
        "„Strategie: ohne Wirkung“.",
    ).toEqual(stored);
  });

  it("die Beispiele landen teils im Portfolio, teils nicht, damit Auswahl und Grenzen mitgeprüft werden", () => {
    const { portfolios, examples } = imprint() as {
      portfolios: Record<string, { positions: { id: string }[] }>;
      examples: { complete: boolean }[];
    };
    expect(examples.filter((e) => e.complete).length).toBeGreaterThan(EXAMPLES.length / 2);
    for (const portfolio of Object.values(portfolios)) {
      expect(portfolio.positions.length).toBeGreaterThan(1);
      expect(portfolio.positions.length).toBeLessThan(EXAMPLES.length);
    }
  });
});
