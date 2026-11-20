import { describe, expect, it } from "vitest";
import { parseSaved } from "./saved.ts";

const metrics = { total: 1, cagr: 0.1, vol: 0.2, maxDrawdown: -0.3 };
const saved = {
  name: "lauf",
  meta: { x: 1 },
  months: ["2026-01"],
  strategy: [100],
  benchmark: null,
  full: { strategy: { ...metrics, turnover: 0.5, holdings: 9 }, benchmark: null },
  periods: [],
  windows: [],
  random: null,
  diagnostics: { skipped: { split: 2 }, delistings: ["A 2020-01"], outliers: [], stocksWithBars: 7 },
};

describe("parseSaved", () => {
  it("liest einen gespeicherten Lauf", () => {
    expect(parseSaved(saved).full.strategy.turnover).toBe(0.5);
  });

  it("liest Diagnosen und die Umschlagzahl der Zufallsläufe, wenn sie da sind, und kommt ohne sie aus", () => {
    expect(parseSaved(saved).diagnostics?.stocksWithBars).toBe(7);
    const { diagnostics, ...older } = saved;
    expect(diagnostics).toBeDefined();
    expect(parseSaved(older).diagnostics).toBeUndefined();
    const random = { runs: 5, median: [100], p5: [90], p95: [110], shareBeatingStrategy: 0.2, shareBeatingBenchmark: null, turnover: 1.2 };
    expect(parseSaved({ ...saved, random }).random?.turnover).toBe(1.2);
    expect(() => parseSaved({ ...saved, random: { ...random, turnover: undefined } })).toThrow();
  });

  it("macht aus einer als null gespeicherten Rendite p. a. wieder NaN", () => {
    const result = parseSaved({ ...saved, full: { ...saved.full, strategy: { ...saved.full.strategy, cagr: null } } });
    expect(result.full.strategy.cagr).toBeNaN();
  });

  it("wirft bei fehlenden oder falschen Feldern", () => {
    expect(() => parseSaved({ ...saved, windows: "nein" })).toThrow();
    expect(() => parseSaved({})).toThrow();
  });
});
