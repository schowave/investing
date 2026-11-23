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

  it("erkennt einen nicht angepassten Split nur, wenn roher und bereinigter Kurs gemeinsam fallen, auch über den Jahreswechsel", () => {
    // Dezember 2016 -> Januar 2017, Split 3:1 im Dezember (±1 Monat zählt): beide Kurse fallen auf ein Drittel.
    const bars = [
      { month: "2016-11", close: 30, adjustedClose: 30 },
      { month: "2016-12", close: 30, adjustedClose: 30 },
      { month: "2017-01", close: 10, adjustedClose: 10 },
    ];
    expect(delistedArtefact(live, [2020], bars, [{ date: "2016-12-20", ratio: 3 }])).toBe("kursfehler");
    // Richtig bereinigt: echter Absturz auf 0,3 plus Split 3:1, der rohe Kurs fällt also auf ein Zehntel, der bereinigte auf 0,3.
    const adjustedRight = [
      { month: "2016-11", close: 30, adjustedClose: 10 },
      { month: "2016-12", close: 3, adjustedClose: 3 },
    ];
    expect(delistedArtefact(live, [2020], adjustedRight, [{ date: "2016-12-20", ratio: 3 }])).toBeNull();
    // Toleranz: 0,45 statt 1/3 liegt außerhalb von ±30 % um das Verhältnis, ein Split in zwei Monaten Abstand zählt nicht.
    const off = [
      { month: "2016-11", close: 30, adjustedClose: 30 },
      { month: "2016-12", close: 13.5, adjustedClose: 13.5 },
    ];
    expect(delistedArtefact(live, [2020], off, [{ date: "2016-12-20", ratio: 3 }])).toBeNull();
    expect(delistedArtefact(live, [2020], bars, [{ date: "2016-09-20", ratio: 3 }])).toBeNull();
  });

  it("erkennt einen nicht angepassten Reverse Split bis 1:9 an roher und bereinigter Reihe", () => {
    const bars = [
      { month: "2016-01", close: 2, adjustedClose: 2 },
      { month: "2016-02", close: 10, adjustedClose: 10 },
    ];
    expect(delistedArtefact(live, [2020], bars, [{ date: "2016-02-10", ratio: 0.2 }])).toBe("kursfehler");
    expect(delistedArtefact(live, [2020], bars)).toBeNull();
  });

  it("vergleicht nur benachbarte Monate und überspringt Reihen mit Kursen unter oder gleich null", () => {
    const gap = [
      { month: "2016-01", close: 1, adjustedClose: 1 },
      { month: "2016-08", close: 50, adjustedClose: 50 },
    ];
    expect(delistedArtefact(live, [2020], gap)).toBeNull();
    const zero = [
      { month: "2016-01", close: 0, adjustedClose: 0 },
      { month: "2016-02", close: 50, adjustedClose: 50 },
    ];
    expect(delistedArtefact(live, [2020], zero)).toBeNull();
  });

  it("prüft zuerst den Namen: ein Schuldtitel mit Kursfehler gilt als Wertpapier", () => {
    expect(delistedArtefact({ ...live, name: "Qwest Corp. NT" }, [2020], walk([10, 11, 150]))).toBe("wertpapier");
    // Ein Wort wie „Floating“ im Namen einer Stammaktie macht sie nicht zum Schuldtitel.
    expect(delistedArtefact({ ...live, name: "Fifth Street Senior Floating Rate Corp" }, [2020], walk([10, 11]))).toBeNull();
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
