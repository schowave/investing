import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import { scaledYears } from "../test/backtest.ts";
import { stock } from "../test/fixtures.ts";
import { parseChart } from "./benchmark.ts";
import { monthEnd, monthRange } from "./calendar.ts";
import { parseEcbHistory } from "./fx.ts";
import type { BacktestOptions } from "./run.ts";
import { DEFAULT_OPTIONS, runBacktest } from "./run.ts";

const START = "2025-10";
const END = "2026-11";
const options: BacktestOptions = {
  ...DEFAULT_OPTIONS,
  start: START,
  end: END,
  endDate: "2026-11-20",
  hurdle: 0.03,
  windowMonths: 6,
  randomRuns: 4,
};
const fx = parseEcbHistory("<Cube time='2026-11-20'><Cube currency='USD' rate='1.1'/></Cube>");

/** Zehn Aktien, jede mit Monatskursen von Oktober 2024 bis November 2026; Kurs 40, bei "STEIGT" um 2 % im Monat. */
function filled() {
  const db = new Database(":memory:");
  const months = monthRange("2024-10", END);
  for (const id of ["A", "B", "C", "D", "E", "F", "G", "H", "STEIGT", "FEHLT"]) {
    const symbol = `${id}.US`;
    db.addStockIfMissing({ ...stock, id: symbol, watched: false });
    if (id !== "FEHLT") db.saveFundamentals(symbol, scaledYears(1e9), "eodhd");
    db.saveMonthlyPrices(
      symbol,
      months.map((m, i) => {
        const close = id === "STEIGT" ? 40 * 1.02 ** i : 40;
        return { date: monthEnd(m, { month: END, date: "2026-11-20" }), close, adjustedClose: close };
      }),
    );
  }
  return db;
}

describe("runBacktest", () => {
  const db = filled();
  const benchmark = parseChart("IDX", {
    chart: {
      result: [
        {
          timestamp: monthRange("2024-10", END).map(
            (m) => Date.parse(`${monthEnd(m, { month: END, date: "2026-11-20" })}T12:00:00Z`) / 1000,
          ),
          indicators: { quote: [{ close: monthRange("2024-10", END).map((_, i) => 100 * 1.01 ** i) }] },
        },
      ],
    },
  });
  const result = runBacktest(db, options, { name: "test", fx, benchmark, now: new Date("2026-11-20T12:00:00Z") });

  it("hält Name, Rechenversion, Optionen und Index fest", () => {
    expect(result.name).toBe("test");
    expect(result.meta).toMatchObject({ vergleichsindex: "IDX", erstelltAm: "2026-11-20T12:00:00.000Z" });
    expect(result.meta.optionen).toMatchObject({ hurdle: 0.03, profile: "fokussiert" });
    expect(result.months[0]).toBe(START);
    expect(result.months.at(-1)).toBe(END);
  });

  it("bewertet je Quartalsstichtag die Kandidaten und zählt, was übersprungen wurde", () => {
    expect(Object.keys(result.candidatesPerDate)).toEqual(["2025-10", "2026-01", "2026-04", "2026-07", "2026-10"]);
    // Aktien mit gleichen Zahlen sind dasselbe Unternehmen: von den zehn bleibt je Stichtag eine.
    expect(Object.values(result.candidatesPerDate).every((n) => n >= 1)).toBe(true);
    expect(result.diagnostics.skipped).toMatchObject({ kurs: expect.any(Number), marktwert: expect.any(Number) });
    expect(result.diagnostics.stocksWithBars).toBeGreaterThanOrEqual(1);
    expect(result.diagnostics.delistings).toEqual([]);
  });

  it("protokolliert den Aufbau am ersten Stichtag als Käufe", () => {
    const first = result.trades[START]!;
    expect(first.length).toBeGreaterThan(0);
    expect(first.every((t) => t.action === "kaufen")).toBe(true);
  });

  it("liefert die Reihe, den Index auf 100 und rollende Fenster", () => {
    expect(result.strategy).toHaveLength(result.months.length);
    expect(result.strategy[0]).toBe(100);
    expect(result.benchmark![0]).toBeCloseTo(100);
    expect(result.full.benchmark!.total).toBeCloseTo(1.01 ** 13 - 1, 5);
    // 14 Monate (0 bis 13), Fenster 6: Starts 0, 3, 6
    expect(result.windows.map((w) => w.start)).toEqual(["2025-10", "2026-01", "2026-04"]);
    expect(result.windows[0]!.benchmark).toBeCloseTo(1.01 ** 6 - 1, 5);
  });

  it("führt die Zufallsgegenprobe und die Zeiträume", () => {
    expect(result.random!.runs).toBe(4);
    expect(result.random!.turnover).toBeGreaterThanOrEqual(0);
    expect(result.random!.median).toHaveLength(result.months.length);
    expect(result.random!.shareBeatingStrategy).toBeGreaterThanOrEqual(0);
    expect(result.periods).toHaveLength(3);
  });

  it("liefert bei gleicher Eingabe gleiche Zahlen", () => {
    const again = runBacktest(db, options, { name: "test", fx, benchmark, now: new Date("2026-11-20T12:00:00Z") });
    expect(again.strategy).toEqual(result.strategy);
    expect(again.random).toEqual(result.random);
  });

  it("kommt ohne Index und ohne Zufallsläufe aus", () => {
    const bare = runBacktest(db, { ...options, randomRuns: 0 }, { name: "bar", fx, benchmark: null });
    expect(bare.benchmark).toBeNull();
    expect(bare.random).toBeNull();
    expect(bare.windows.every((w) => w.benchmark === null)).toBe(true);
    expect(bare.periods.every((p) => p.benchmark === null && p.randomMedian === null)).toBe(true);
  });

  it("nimmt das Profil und die Tauschschwelle aus den Optionen", () => {
    const global = runBacktest(db, { ...options, profile: "global", swap: 0.05, randomRuns: 0 }, { name: "g", fx, benchmark: null });
    expect(global.meta.optionen).toMatchObject({ profile: "global", swap: 0.05 });
    expect(global.strategy).toHaveLength(result.months.length);
  });
});
