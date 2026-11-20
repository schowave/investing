import { describe, expect, it } from "vitest";
import { fingerprint, isCommonShare } from "./universe.ts";

describe("isCommonShare", () => {
  it("lässt Stammaktien und Titel ohne Angabe zu", () => {
    expect(isCommonShare({ name: "BASF SE", securityType: "Common Stock" })).toBe(true);
    expect(isCommonShare({ name: "BASF SE", securityType: null })).toBe(true);
    expect(isCommonShare({ name: "BASF SE" })).toBe(true);
  });

  it("schließt andere Wertpapierarten und Anleihen mit Aktienkennung aus", () => {
    expect(isCommonShare({ name: "Fonds", securityType: "FUND" })).toBe(false);
    expect(isCommonShare({ name: "DTE Energy Company 2020 Series G", securityType: "Common Stock" })).toBe(false);
    expect(isCommonShare({ name: "Foo Preferred", securityType: null })).toBe(false);
    expect(isCommonShare({ name: "Seriesly Inc", securityType: null })).toBe(true);
  });
});

describe("fingerprint", () => {
  it("ist für gleiche Zahlen gleich, für andere Währung, Gewinn oder Aktienzahl verschieden", () => {
    const base = fingerprint("A", "EUR", 5.4, 1e9);
    expect(fingerprint("B", "EUR", 5.4, 1e9)).toBe(base);
    expect(fingerprint("A", "USD", 5.4, 1e9)).not.toBe(base);
    expect(fingerprint("A", "EUR", 5.5, 1e9)).not.toBe(base);
    expect(fingerprint("A", "EUR", 5.4, 2e9)).not.toBe(base);
  });

  it("steht ohne Gewinn je Aktie für sich allein", () => {
    expect(fingerprint("A", "EUR", null, 1e9)).toBe("id|A");
    expect(fingerprint("B", "EUR", undefined, 1e9)).toBe("id|B");
    expect(fingerprint("A", "EUR", Number.NaN, 1e9)).not.toBe(fingerprint("B", "EUR", Number.NaN, 1e9));
  });
});
