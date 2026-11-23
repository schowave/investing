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
  const month = (i: number) => `${2016 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  const flat = (price: number, n = 60) => Array.from({ length: n }, (_, i) => ({ month: month(i), close: price, adjustedClose: price }));
  const walk = (prices: number[], raw: number[] = prices) => prices.map((p, i) => ({ month: month(i), close: raw[i]!, adjustedClose: p }));

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

  it("erkennt unmögliche Kurse als Datenfehler: Sprung nach oben, Fehler der Anpassung, nicht angepassten Split", () => {
    expect(delistedArtefact(live, [2020], walk([10, 11, 150]))).toBe("kursfehler");
    // Bereinigter Kurs fällt auf ein Hundertstel, der rohe bleibt ruhig: Fehler der Anpassung.
    expect(delistedArtefact(live, [2020], walk([10, 0.1], [10, 9]))).toBe("kursfehler");
    // Der rohe Kurs springt auf das Zwanzigfache, der bereinigte nicht: richtig bereinigter Reverse Split, kein Fehler.
    expect(delistedArtefact(live, [2020], walk([10, 10.5], [1, 20]))).toBeNull();
    // Rohkurs fällt auf ein Zehntel genau im Monat eines Splits 10:1: nicht angepasster Split, kein Absturz.
    expect(delistedArtefact(live, [2020], walk([10, 1]), [{ date: "2016-02-10", ratio: 10 }])).toBe("kursfehler");
  });

  it("lässt echte Abstürze drin, auch auf ein Zwanzigstel und tiefer: die Gescheiterten braucht der Rückblick", () => {
    expect(delistedArtefact(live, [2020], walk([10, 0.4]))).toBeNull();
    expect(delistedArtefact(live, [2020], walk([10, 0.003]))).toBeNull();
    expect(delistedArtefact(live, [2020], walk([10, 3.3]))).toBeNull();
    // Ein Split mit anderem Verhältnis erklärt den Absturz nicht.
    expect(delistedArtefact(live, [2020], walk([10, 0.4]), [{ date: "2016-02-10", ratio: 2 }])).toBeNull();
    // Ein Split mit Verhältnis nahe 1 erklärt keine gewöhnliche Bewegung.
    expect(delistedArtefact(live, [2020], walk([10, 8]), [{ date: "2016-02-10", ratio: 1.25 }])).toBeNull();
  });

  it("erkennt eine Umbenennung an Abschlüssen, die über die Einstellung hinausreichen", () => {
    expect(delistedArtefact(live, [2020, 2021, 2023], walk([10, 11]))).toBeNull();
    expect(delistedArtefact(live, [2020, 2021, 2024], walk([10, 11]))).toBe("fortgesetzt");
  });
});
