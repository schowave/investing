import { describe, expect, it } from "vitest";
import { amount, fieldValue, isoDate, percent } from "./format.ts";

describe("Zahlenformate", () => {
  it("schreibt Prozente und Beträge deutsch und Fehlendes als Strich", () => {
    expect(percent(0.1234)).toBe("12,3 %");
    expect(percent(null)).toBe("–");
    expect(amount(1234.5)).toBe("1.234,50");
    expect(amount(undefined)).toBe("–");
    expect(isoDate("2026-11-19")).toBe("19.11.2026");
    expect(isoDate(null)).toBe("–");
  });

  it("füllt Eingabefelder ohne Tausenderpunkte, so dass sie wieder gelesen werden können", () => {
    expect(fieldValue(0.023, true)).toBe("2,3");
    expect(fieldValue(1234.567, false)).toBe("1234,57");
    expect(fieldValue(undefined, true)).toBe("");
  });
});
