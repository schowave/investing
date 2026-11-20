import { describe, expect, it } from "vitest";
import type { BacktestSummary } from "./report.ts";
import {
  compareResults,
  describeResult,
  median,
  metrics,
  quality,
  quantile,
  randomScores,
  seededRandom,
  thirds,
  windowStarts,
  yearsBetween,
} from "./report.ts";

describe("Kennzahlen", () => {
  it("rechnet Gesamtrendite, Rendite p. a., Schwankung und größten Rückgang", () => {
    const m = metrics([100, 110, 99, 121], 2);
    expect(m.total).toBeCloseTo(0.21);
    expect(m.cagr).toBeCloseTo(0.1);
    expect(m.maxDrawdown).toBeCloseTo(-0.1);
    expect(m.vol).toBeGreaterThan(0);
  });

  it("hat ohne Schwankung die Schwankung 0 und ohne Zeitraum keine Rendite p. a.", () => {
    expect(metrics([100, 100, 100], 1).vol).toBe(0);
    expect(metrics([100, 120], 0).cagr).toBeNaN();
  });

  it("zählt Jahre zwischen zwei Tagen", () => {
    expect(yearsBetween("2024-01-01", "2026-01-01")).toBeCloseTo(2, 1);
  });

  it("berechnet Quantile und Median", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(10);
    expect(quantile([], 0.5)).toBeNaN();
  });
});

describe("Zufall und Fenster", () => {
  it("liefert aus demselben Startwert dieselbe Folge in [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const first = [a(), a(), a()];
    expect(first).toEqual([b(), b(), b()]);
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRandom(8)()).not.toBe(first[0]);
  });

  it("würfelt je Titel und Jahr: stabil im Jahr, verschieden zwischen Titeln, Jahren und Startwerten", () => {
    const scores = randomScores(1);
    expect(scores("A", "2026-01")).toBe(scores("A", "2026-10"));
    expect(scores("A", "2026-01")).not.toBe(scores("B", "2026-01"));
    expect(scores("A", "2026-01")).not.toBe(scores("A", "2027-01"));
    expect(randomScores(1)("A", "2026-01")).toBe(scores("A", "2026-01"));
    expect(randomScores(2)("A", "2026-01")).not.toBe(scores("A", "2026-01"));
    expect(scores("A", "2026-01")).toBeGreaterThanOrEqual(0);
    expect(scores("A", "2026-01")).toBeLessThan(1);
  });

  it("legt rollende Fenster alle drei Monate, solange sie in die Reihe passen", () => {
    // 50 Monate (Index 0 bis 49), Fenster 36: Starts 0, 3, ..., 12
    expect(windowStarts(50, 36)).toEqual([0, 3, 6, 9, 12]);
    expect(windowStarts(30, 36)).toEqual([]);
  });

  it("teilt die Reihe in drei Zeiträume", () => {
    expect(thirds(31)).toEqual([
      [0, 10],
      [10, 20],
      [20, 30],
    ]);
  });
});

const OPTIONS = {
  start: "2016-10",
  end: "2026-11",
  endDate: "2026-11-20",
  windowMonths: 36,
  cost: 0.0025,
  cashRate: 0.034,
  hurdle: 0.034,
  minCapEur: 300e6,
  delistLoss: 0.5,
  randomRuns: 200,
  profile: "fokussiert",
  swap: 0.01,
  every: 1,
};

function summary(
  name: string,
  total: number,
  windows: [string, number, number | null][],
  options: Record<string, unknown> = {},
): BacktestSummary {
  const m = { total, cagr: 0.1, vol: 0.2, maxDrawdown: -0.3 };
  return {
    name,
    meta: { optionen: { ...OPTIONS, ...options }, rechenversion: 8 },
    months: ["2016-10", "2026-11"],
    strategy: [100, 100 * (1 + total)],
    benchmark: [100, 200],
    full: { strategy: { ...m, turnover: 0.8, holdings: 10 }, benchmark: { ...m, total: 1 } },
    periods: [{ label: "2016-10 bis 2020-01", strategy: 0.5, benchmark: 0.2, randomMedian: 0.1 }],
    windows: windows.map(([start, t, b]) => ({ start, strategy: { total: t, vol: 0.2, maxDrawdown: -0.1, turnover: 0.7 }, benchmark: b })),
    diagnostics: {
      skipped: { split: 3, kurs: 0 },
      delistings: ["X.US 2020-01"],
      outliers: [{ month: "2020-03", id: "Y.US", name: "Y Corp", monthlyReturn: 1.4 }],
      stocksWithBars: 120,
    },
    random: {
      runs: 10,
      median: [100, 150],
      p5: [100, 110],
      p95: [100, 200],
      shareBeatingStrategy: 0.1,
      shareBeatingBenchmark: 0.2,
      turnover: 1.5,
    },
  };
}

describe("Textausgabe", () => {
  it("beschreibt einen Lauf mit Einstellungen, Strategie, Index, Zufall, Zeiträumen, Fenstern, Daten und Grenzen", () => {
    const text = describeResult(
      summary("lauf", 2, [
        ["2016-10", 0.6, 0.4],
        ["2017-01", 0.3, 0.4],
      ]),
    ).join("\n");
    expect(text).toContain("Rückblick „lauf“: 2016-10 bis 2026-11");
    expect(text).toContain("Profil fokussiert, Tauschschwelle 1 %, Hürde 3,4 %");
    expect(text).toContain("+200 %");
    expect(text).toContain("Umschlag 80 % je Umschichtung (Käufe plus Verkäufe), 10,0 Titel");
    expect(text).toContain("Vergleichsindex");
    expect(text).toContain("10 % der 10 Läufe schlagen die Strategie; Umschlag 150 %");
    expect(text).toContain("Rollende Fenster (2, Start alle drei Monate): Median");
    expect(text).toContain("schlägt den Index in 50 %");
    expect(text).toContain("120 Titel waren mindestens einmal Kandidat; übersprungen (Titel-Monate): split 3");
    expect(text).toContain("Annahme Einstellung: 1 Abschläge (X.US 2020-01)");
    expect(text).toContain("Ausreißer: 1 Positionsmonate");
    expect(text).toContain("Y Corp 2020-03 +140 %");
    expect(text).toContain("Survivorship");
  });

  it("kommt ohne Index, Zufall, Fenster und Diagnosen aus", () => {
    const base = summary("x", 1, []);
    const bare = { ...base, meta: {}, benchmark: null, random: null, diagnostics: undefined, full: { ...base.full, benchmark: null } };
    const text = describeResult(bare).join("\n");
    expect(text).not.toContain("Vergleichsindex");
    expect(text).not.toContain("Zufallsauswahl");
    expect(text).not.toContain("Rollende Fenster");
    expect(text).not.toContain("Daten:");
    expect(text).toContain("Rückblick „x“: 2016-10 bis 2026-11, Euro, nach Kosten\n");
  });
});

describe("Vergleich zweier Läufe", () => {
  const a = summary("main", 2, [
    ["2016-10", 0.5, null],
    ["2017-01", 0.4, null],
    ["2017-04", 0.3, null],
  ]);

  it("zählt die gemeinsamen Fenster und nennt Anteil, Median und Spanne der Differenz", () => {
    const b = summary("änderung", 3, [
      ["2016-10", 0.6, null],
      ["2017-01", 0.35, null],
      ["2017-07", 9, null],
    ]);
    const text = compareResults(a, b).join("\n");
    expect(text).toContain("„main“ (Stand) gegen „änderung“ (Änderung)");
    expect(text).toContain(
      "Rollende Fenster (2): Änderung besser in 50 %, Median der Differenz +10,0 %, schlechteste Differenz -5 %, beste +10 %",
    );
    expect(text).toContain("Median der Fensterrendite: Stand +50 %, Änderung +60 %");
    expect(text).toContain("Gesamtrendite");
    expect(text).toContain("+100 %");
  });

  it("zeigt eine schlechtere Änderung mit negativer Differenz", () => {
    const worse = summary("schlechter", 1, [
      ["2016-10", 0.4, null],
      ["2017-01", 0.3, null],
      ["2017-04", 0.2, null],
    ]);
    const text = compareResults(a, worse).join("\n");
    expect(text).toContain("Änderung besser in 0 %");
    expect(text).toContain("Median der Differenz -10,0 %");
  });

  it("meldet geänderte Strategieoptionen und Rechenversion, ohne abzubrechen", () => {
    const b = {
      ...summary("b", 2, [["2016-10", 0.5, null]], { swap: 0.03 }),
      meta: { optionen: { ...OPTIONS, swap: 0.03 }, rechenversion: 9 },
    };
    const text = compareResults(a, b).join("\n");
    expect(text).toContain("Geänderte Strategieoptionen: swap 0.01 → 0.03");
    expect(text).toContain("Rechenversion 8 → 9");
    expect(text).not.toContain("ACHTUNG");
  });

  it("warnt, wenn sich Kosten, Hürde oder Datenbasis unterscheiden", () => {
    const b = summary("b", 2, [["2016-10", 0.5, null]], { hurdle: 0.02, cost: 0.01 });
    b.diagnostics!.stocksWithBars = 130;
    const text = compareResults(a, b).join("\n");
    expect(text).toContain("ACHTUNG: Einstellungen unterscheiden sich (cost, hurdle)");
    expect(text).toContain("Zahl der Kandidatentitel: 120 → 130");
  });

  it("bricht ab, wenn Zeitraum, Enddatum oder Fensterlänge nicht übereinstimmen", () => {
    expect(() => compareResults(a, summary("b", 2, [], { windowMonths: 24 }))).toThrow(/Nicht vergleichbar: windowMonths 36 gegen 24/);
    expect(() => compareResults(a, summary("b", 2, [], { endDate: "2026-11-21" }))).toThrow(/endDate "2026-11-20" gegen "2026-11-21"/);
    expect(() => compareResults(a, summary("b", 2, [], { start: "2018-01" }))).toThrow(/start/);
  });

  it("lässt den Fensterteil weg, wenn es kein gemeinsames Fenster gibt, und rechnet mit unbestimmter Rendite p. a.", () => {
    const b = summary("b", 1, [["2020-01", 0.5, null]]);
    b.full.strategy.cagr = Number.NaN;
    const text = compareResults(a, b).join("\n");
    expect(text).not.toContain("Rollende Fenster");
    expect(text).toContain("NaN");
  });
});

describe("Gütemaß", () => {
  it("rechnet Rendite über Bargeld je Schwankung und Rendite je größtem Rückgang für den ganzen Zeitraum", () => {
    // Rendite p. a. 10 %, Bargeld 3,4 %, Schwankung 20 %, größter Rückgang 30 %
    const q = quality(summary("a", 2, []));
    expect(q.sharpe).toBeCloseTo((0.1 - 0.034) / 0.2, 10);
    expect(q.calmar).toBeCloseTo(0.1 / 0.3, 10);
    expect(q.windowSharpe).toBeNull();
    expect(q.windowCalmar).toBeNull();
  });

  it("nimmt über die Fenster den Median und das schwache Viertel, mit der Jahresrendite aus der Fensterrendite", () => {
    // 36-Monats-Fenster: (1+p.a.)^3 − 1 für 0 %, 5 %, 10 %, 15 %, 20 % p. a.; Bargeld 3,4 %, Schwankung 20 %
    const totals = [0, 0.157625, 0.331, 0.520875, 0.728];
    const q = quality(
      summary(
        "a",
        2,
        totals.map((t, i) => [`2017-0${i + 1}`, t, null]),
      ),
    );
    const sharpe = (cagr: number) => (cagr - 0.034) / 0.2;
    // sortiert: −0,17, 0,08, 0,33, 0,58, 0,83; Median Index 2, schwaches Viertel Index 1
    expect(q.windowSharpe).toBeCloseTo(sharpe(0.1), 6);
    expect(q.windowSharpeWeak).toBeCloseTo(sharpe(0.05), 6);
    expect(q.windowCalmar).toBeCloseTo(0.1 / 0.1, 6);
  });

  it("lässt Fenster ohne Schwankung beim Sharpe-Wert aus und begrenzt den Rückgang nach unten", () => {
    const flat = summary("a", 2, [["2016-10", 0.1, null]]);
    flat.windows[0]!.strategy.vol = 0;
    flat.windows[0]!.strategy.maxDrawdown = 0;
    const q = quality(flat);
    expect(q.windowSharpe).toBeNull();
    // ohne Rückgang gilt 1 % als Nenner statt Division durch 0
    expect(q.windowCalmar).toBeCloseTo((1.1 ** (12 / 36) - 1) / 0.01, 6);
    expect(Number.isNaN(quality({ ...flat, full: { ...flat.full, strategy: { ...flat.full.strategy, vol: 0 } } }).sharpe)).toBe(true);
  });

  it("steht im Bericht und im Vergleich", () => {
    const a = summary("main", 2, [
      ["2016-10", 0.331, null],
      ["2017-01", 0.331, null],
    ]);
    const b = summary("änderung", 2, [
      ["2016-10", 0.728, null],
      ["2017-01", 0.1, null],
    ]);
    const text = describeResult(a).join("\n");
    expect(text).toContain("Güte (Rendite über Bargeld je Schwankung): Strategie 0,33, Index 0,33; Fenstermedian 0,33");
    expect(text).toContain("Rendite je größtem Rückgang: Strategie 0,33, Index 0,33; Fenstermedian 1,00");
    const compared = compareResults(a, b).join("\n");
    expect(compared).toContain("Güte besser in 50 % der Fenster (2).");
    expect(compared).toContain("Güte, Fenstermedian");
    expect(compared).toContain("Güte, schwaches Viertel");
  });

  it("warnt im Vergleich, wenn ein Lauf Bargeldzins oder Fensterlänge nicht kennt", () => {
    const a = summary("main", 2, [["2016-10", 0.3, null]]);
    const old = { ...summary("alt", 2, [["2016-10", 0.3, null]]), meta: { optionen: { ...OPTIONS, cashRate: undefined } } };
    expect(compareResults(a, old).join("\n")).toContain("In „alt“ fehlen Bargeldzins oder Fensterlänge");
    expect(compareResults(a, a).join("\n")).not.toContain("fehlen Bargeldzins");
  });
});
