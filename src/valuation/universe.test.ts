import { describe, expect, it } from "vitest";
import { delistedArtefact, fingerprint, isCommonShare } from "./universe.ts";

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

describe("delistedArtefact", () => {
  const live = { id: "AAA.US", name: "AAA Inc", delistedOn: "2022-06-30" };
  const flat = (price: number, n = 60) => Array.from({ length: n }, () => ({ close: price, adjustedClose: price }));
  const walk = (prices: number[]) => prices.map((p) => ({ close: p, adjustedClose: p }));

  it("prüft nur eingestellte Titel", () => {
    expect(delistedArtefact({ ...live, delistedOn: null }, [2020], flat(25))).toBeNull();
  });

  it("erkennt Schuld- und Vorzugstitel an Name, Kürzel und Kursband", () => {
    expect(delistedArtefact({ ...live, name: "Southern Company JR SUB NT 2015A" }, [2020], walk([50, 60]))).toBe("wertpapier");
    expect(delistedArtefact({ ...live, id: "ANG-PB.US" }, [2020], walk([50, 60]))).toBe("wertpapier");
    expect(delistedArtefact(live, [2020], flat(25))).toBe("wertpapier");
    // Ein Kurs um 25 USD mit Schwankung ist eine Aktie; ein Band von 100 USD auch.
    const moving = Array.from({ length: 60 }, (_, i) => 20 + (i % 10));
    expect(delistedArtefact(live, [2020], walk(moving))).toBeNull();
    expect(delistedArtefact(live, [2020], flat(100))).toBeNull();
    // Zu kurze Reihe: kein Bandurteil.
    expect(delistedArtefact(live, [2020], flat(25, 20))).toBeNull();
  });

  it("erkennt Kurssprünge als Datenfehler, auch einen Absturz auf ein Zwanzigstel, nicht aber einen auf ein Drittel", () => {
    expect(delistedArtefact(live, [2020], walk([10, 11, 150]))).toBe("kursfehler");
    expect(delistedArtefact(live, [2020], walk([10, 0.4]))).toBe("kursfehler");
    expect(delistedArtefact(live, [2020], walk([10, 3.3]))).toBeNull();
  });

  it("erkennt eine Umbenennung an Abschlüssen, die über die Einstellung hinausreichen", () => {
    expect(delistedArtefact(live, [2020, 2021, 2023], walk([10, 11]))).toBeNull();
    expect(delistedArtefact(live, [2020, 2021, 2024], walk([10, 11]))).toBe("fortgesetzt");
  });
});
