import { describe, expect, it } from "vitest";
import { lastKnownFiscalYear, monthEnd, monthRange, shiftMonth } from "./calendar.ts";

describe("Kalender", () => {
  it("verschiebt Monate über Jahresgrenzen", () => {
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-05", 0)).toBe("2026-05");
    expect(shiftMonth("2026-03", -15)).toBe("2024-12");
  });

  it("zählt alle Monate von bis, beide eingeschlossen", () => {
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthRange("2026-05", "2026-05")).toEqual(["2026-05"]);
    expect(monthRange("2026-06", "2026-05")).toEqual([]);
  });

  it("nennt den letzten Tag des Monats, im Schaltjahr und für den letzten Kurs", () => {
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(monthEnd("2026-12")).toBe("2026-12-31");
    expect(monthEnd("2026-11", { month: "2026-11", date: "2026-11-20" })).toBe("2026-11-20");
    expect(monthEnd("2026-10", { month: "2026-11", date: "2026-11-20" })).toBe("2026-10-31");
  });

  it("lässt den Jahresabschluss erst ab Juni des Folgejahres gelten", () => {
    expect(lastKnownFiscalYear("2026-05")).toBe(2024);
    expect(lastKnownFiscalYear("2026-06")).toBe(2025);
    expect(lastKnownFiscalYear("2026-12")).toBe(2025);
    expect(lastKnownFiscalYear("2026-01")).toBe(2024);
  });
});
