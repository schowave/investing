import { describe, expect, it } from "vitest";
import { closeAtOrBefore, parseChart } from "./benchmark.ts";

const day = (iso: string) => Date.parse(`${iso}T08:00:00Z`) / 1000;
const chart = (timestamps: number[], close: (number | null)[]) => ({
  chart: { result: [{ timestamp: timestamps, indicators: { quote: [{ close }] } }] },
});

describe("Vergleichsindex", () => {
  const series = parseChart("X", chart([day("2026-11-02"), day("2026-11-03"), day("2026-11-04")], [100, null, 110]));

  it("überspringt Tage ohne Kurs", () => {
    expect(series.points).toEqual([
      { date: "2026-11-02", close: 100 },
      { date: "2026-11-04", close: 110 },
    ]);
  });

  it("nimmt den letzten Kurs bis zum Tag", () => {
    expect(closeAtOrBefore(series, "2026-11-03")).toBe(100);
    expect(closeAtOrBefore(series, "2026-11-30")).toBe(110);
    expect(closeAtOrBefore(series, "2026-11-01")).toBeNull();
  });

  it("wirft, wenn gar kein Kurs da ist oder die Antwort anders aussieht", () => {
    expect(() => parseChart("X", chart([day("2026-11-02")], [null]))).toThrow(/keine Kurse/);
    expect(() => parseChart("X", { chart: { result: null } })).toThrow();
  });
});
