import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "../data/db.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import type { Basis } from "./review.ts";
import { basisOf, estimateShiftOf, needsReview, reviewOf } from "./review.ts";
import { assess, CALC_VERSION, computeValuation, storedBaseline, valueStock } from "./run.ts";

const basis: Basis = { payoutLevel: 3, growth: 0.05, earningsLevel: 6, numberRisk: 0.2 };

describe("reviewOf", () => {
  it("verlangt ohne Eingabe von Hand keine Prüfung", () => {
    const review = reviewOf({ assessedOn: null, today: "2026-11-19", before: null, now: basis });
    expect(review).toEqual({ assessedOn: null, overdue: false, changes: [], calcChanged: false, priceDrop: null, estimateShift: null });
    expect(needsReview(review)).toBe(false);
  });

  it("meldet eine Bewertung nach zwölf Monaten als überfällig", () => {
    const at = (today: string) => reviewOf({ assessedOn: "2025-11-19", today, before: basis, now: basis });
    expect(at("2026-11-19").overdue).toBe(false);
    expect(at("2026-11-20").overdue).toBe(true);
    expect(needsReview(at("2026-11-20"))).toBe(true);
  });

  it("lässt Verschiebungen innerhalb der Bandbreite stehen", () => {
    const now = { payoutLevel: 3.3, growth: 0.06, earningsLevel: 5.4, numberRisk: 0.25 };
    expect(reviewOf({ assessedOn: "2026-06-01", today: "2026-11-19", before: basis, now }).changes).toEqual([]);
  });

  it("nennt, was sich über die Bandbreite hinaus verschoben hat", () => {
    const now = { payoutLevel: 2.5, growth: 0.025, earningsLevel: 7.2, numberRisk: 0.32 };
    expect(reviewOf({ assessedOn: "2026-06-01", today: "2026-11-19", before: basis, now }).changes).toEqual([
      "Rückflussniveau 3,00 → 2,50 (−17 %)",
      "Gewinnniveau 6,00 → 7,20 (+20 %)",
      "Wachstum 5,0 % → 2,5 %",
      "Risiko aus Zahlen 20 % → 32 %",
    ]);
  });

  it("meldet weggefallene und neue Vorschläge", () => {
    const review = reviewOf({
      assessedOn: "2026-06-01",
      today: "2026-11-19",
      before: { ...basis, growth: null, payoutLevel: 0 },
      now: { ...basis, earningsLevel: null, payoutLevel: 1 },
    });
    expect(review.changes).toEqual(["Rückflussniveau 0,00 → 1,00", "Gewinnniveau: kein Vorschlag mehr", "Wachstum: neu"]);
  });

  it("zeigt bei negativem Gewinnniveau die Richtung richtig", () => {
    const review = reviewOf({
      assessedOn: "2026-06-01",
      today: "2026-11-19",
      before: { ...basis, earningsLevel: -1 },
      now: { ...basis, earningsLevel: -1.2 },
    });
    expect(review.changes).toEqual(["Gewinnniveau -1,00 → -1,20 (−20 %)"]);
  });

  it("verlangt die Prüfung, wenn der Kurs seit der Bewertung um mehr als ein Viertel gefallen ist", () => {
    const at = (priceNow: number | null, priceBefore: number | null = 100) =>
      reviewOf({ assessedOn: "2026-06-01", today: "2026-11-19", before: basis, now: basis, priceBefore, priceNow });
    expect(at(75).priceDrop).toBeNull();
    expect(needsReview(at(75))).toBe(false);
    expect(at(70).priceDrop).toBeCloseTo(0.3);
    expect(needsReview(at(70))).toBe(true);
    // Ein gestiegener Kurs und ein fehlender Kurs lösen nichts aus.
    expect(at(180).priceDrop).toBeNull();
    expect(at(null).priceDrop).toBeNull();
    expect(at(70, null).priceDrop).toBeNull();
  });

  it("verlangt die Prüfung, wenn sich die Gewinnschätzung um mehr als ein Fünftel verschoben hat", () => {
    const at = (shift: number | null) =>
      reviewOf({
        assessedOn: "2026-06-01",
        today: "2026-11-19",
        before: basis,
        now: basis,
        estimateShift: shift === null ? null : { shift, days: 90 },
      });
    expect(at(null).estimateShift).toBeNull();
    expect(at(-0.15).estimateShift).toBeNull();
    expect(needsReview(at(-0.15))).toBe(false);
    expect(at(-0.25).estimateShift).toEqual({ shift: -0.25, days: 90 });
    expect(needsReview(at(-0.25))).toBe(true);
    // Auch eine deutliche Anhebung ist ein Anlass: Das Niveau kann zu niedrig sein.
    expect(needsReview(at(0.3))).toBe(true);
  });

  it("vergleicht nicht, wenn kein Tagesstand aus der Zeit der Bewertung vorliegt", () => {
    expect(reviewOf({ assessedOn: "2026-06-01", today: "2026-11-19", before: null, now: basis }).changes).toEqual([]);
  });
});

describe("Grundlage einer Bewertung", () => {
  it("summiert nur die Risikofaktoren aus Zahlen", () => {
    const values = { payoutLevel: 2, "risk.earnings": -0.1, "risk.size": 0.15, "risk.moat": 0.2 };
    expect(basisOf({ values, details: {} })).toEqual({
      payoutLevel: 2,
      growth: null,
      earningsLevel: null,
      numberRisk: expect.closeTo(0.05),
    });
  });

  it("liest sie aus einem gespeicherten Tagesstand und verwirft fremde Formen", () => {
    expect(storedBaseline({ proposals: { values: { growth: 0.03 }, details: { earningsLevel: 4 } } })).toEqual({
      basis: { payoutLevel: null, growth: 0.03, earningsLevel: 4, numberRisk: 0 },
      // Tagesstände von vor der Einführung der Rechenversion gelten als Version 1.
      calcVersion: 1,
    });
    expect(storedBaseline({ inputs: {} })).toBeNull();
    expect(storedBaseline(null)).toBeNull();
  });
});

describe("estimateShiftOf", () => {
  const row = (period: string, current: number | null, before: number | null, analysts: number | null = 8) => ({
    period,
    analysts,
    current,
    daysAgo: { 7: before === null ? null : before * 0.99, 30: before, 60: before, 90: before === null ? null : before * 1.5 },
  });
  const shift = (assessedOn: string, trend: ReturnType<typeof row>[]) => estimateShiftOf({ assessedOn, fetchedOn: "2026-11-20", trend });

  it("misst über den längsten Rückblick, der nicht vor die Bewertung zurückreicht", () => {
    const trend = [row("0y", 9, 10)];
    // 20 Tage alt: nur der Stand vor 7 Tagen (9,9) liegt nach der Bewertung.
    expect(shift("2026-10-31", trend)).toEqual({ shift: expect.closeTo(9 / 9.9 - 1, 9), days: 7 });
    expect(shift("2026-10-01", trend)).toEqual({ shift: expect.closeTo(-0.1, 9), days: 30 });
    expect(shift("2026-06-01", trend)).toEqual({ shift: expect.closeTo(9 / 15 - 1, 9), days: 90 });
  });

  it("gibt nichts zurück, wenn die Bewertung jünger ist als der kürzeste Rückblick", () => {
    expect(shift("2026-11-16", [row("0y", 5, 10)])).toBeNull();
  });

  it("nimmt die größere Verschiebung aus laufendem und nächstem Geschäftsjahr, nicht die Quartale", () => {
    expect(shift("2026-10-01", [row("0q", 1, 10), row("0y", 9.5, 10), row("+1y", 12, 10)])?.shift).toBeCloseTo(0.2);
  });

  it("übergeht Schätzungen ohne Stand, um null herum oder mit zu wenig Analysten", () => {
    expect(shift("2026-10-01", [row("0y", null, 10), row("+1y", 5, null)])).toBeNull();
    expect(shift("2026-10-01", [row("0y", 0.5, -0.2), row("+1y", 1, 0)])).toBeNull();
    expect(shift("2026-10-01", [row("0y", 5, 10, 2), row("+1y", 5, 10, null)])).toBeNull();
  });
});

describe("Prüfstand aus der Datenbank", () => {
  afterEach(() => vi.useRealTimers());

  it("misst am Tagesstand vom Tag der Bewertung", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2025-05-30", close: 40 }]);
    expect(computeValuation(db, stock, "2025-06-01").review.assessedOn).toBeNull();

    db.setManualInput(stock.id, "risk.moat", 0.05);
    valueStock(db, stock, "2025-06-01");
    valueStock(db, stock, "2025-06-15");
    expect(computeValuation(db, stock, "2025-07-01").review).toEqual({
      assessedOn: "2025-06-01",
      overdue: false,
      changes: [],
      calcChanged: false,
      priceDrop: null,
      estimateShift: null,
    });

    // Neue Abschlüsse: Der freie Cashflow trägt nur noch 2,50 statt 3,00 je Aktie.
    db.saveFundamentals(
      stock.id,
      steadyYears((y) => (y.freeCashFlow = 250)),
      "eodhd",
    );
    const later = computeValuation(db, stock, "2026-06-02").review;
    expect(later.changes).toEqual(["Rückflussniveau 3,00 → 2,50 (−17 %)"]);
    expect(later.overdue).toBe(true);
    db.close();
  });

  it("misst den Kursrückgang am Kurs vom Tag der Bewertung und hält einen Split nicht für einen Sturz", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2025-05-30", close: 40 }]);
    assess(db, stock, [{ key: "risk.moat", value: 0.05 }], "2025-06-01");

    db.saveRawCloses(stock.id, [{ date: "2025-06-20", close: 28 }]);
    const fallen = computeValuation(db, stock, "2025-06-21").review;
    expect(fallen.priceDrop).toBeCloseTo(0.3);
    expect(needsReview(fallen)).toBe(true);

    // Split 2:1 nach der Bewertung: 40 von damals sind 20 in heutiger Stückelung, 19 heute also kein Sturz.
    db.saveSplits(stock.id, [{ date: "2025-06-25", ratio: 2 }]);
    db.saveRawCloses(stock.id, [{ date: "2025-06-26", close: 19 }]);
    expect(computeValuation(db, stock, "2025-06-27").review.priceDrop).toBeNull();
    db.close();
  });

  it("liest die Verschiebung der Gewinnschätzung aus der gespeicherten Rohantwort", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    assess(db, stock, [{ key: "risk.moat", value: 0.05 }], "2025-06-01");
    expect(computeValuation(db, stock, "2025-07-15").review.estimateShift).toBeNull();

    vi.setSystemTime(new Date("2025-07-15T09:00:00Z"));
    const trend = { period: "0y", earningsEstimateNumberOfAnalysts: "12.0000", epsTrendCurrent: "3.5", epsTrend30daysAgo: "5.0" };
    db.saveRawDocument(stock.id, "eodhd-fundamentals", JSON.stringify({ Earnings: { Trend: { "2025-12-31": trend } } }));
    const review = computeValuation(db, stock, "2025-07-15").review;
    expect(review.estimateShift).toEqual({ shift: expect.closeTo(-0.3, 9), days: 30 });
    expect(needsReview(review)).toBe(true);
    db.close();
  });

  it("nimmt ohne früheren Tagesstand den ersten nach der Bewertung", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.setManualInput(stock.id, "growth", 0.01);
    expect(db.valuationDetailsAsOf(stock.id, "2025-06-01")).toBeNull();
    valueStock(db, stock, "2025-06-03");
    expect(storedBaseline(db.valuationDetailsAsOf(stock.id, "2025-06-01"))?.basis.payoutLevel).toBeCloseTo(3);
    db.close();
  });
});

describe("Bewerten mit Eingaben von Hand", () => {
  afterEach(() => vi.useRealTimers());

  it("speichert mit jeder Eingabe den Prüfstand, auch beim Löschen", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    assess(db, stock, [{ key: "risk.moat", value: 0.05, note: "Marke" }], "2025-06-01");
    expect(db.manualInputs(stock.id)).toMatchObject([{ key: "risk.moat", value: 0.05, note: "Marke" }]);
    expect(storedBaseline(db.valuationDetailsAsOf(stock.id, "2025-06-01"))?.calcVersion).toBe(CALC_VERSION);

    // Ohne neue Notiz bleibt die alte stehen.
    assess(db, stock, [{ key: "risk.moat", value: 0.06 }], "2025-06-01");
    expect(db.manualInputs(stock.id)[0]?.note).toBe("Marke");
    // Eine automatische Notiz gehört zum Wert: Ändert ein Mensch den Wert, fällt sie weg.
    assess(db, stock, [{ key: "risk.moat", value: 0.06, note: "Opus-Einschätzung vom 2025-06-01" }], "2025-06-01");
    assess(db, stock, [{ key: "risk.moat", value: 0.06 }], "2025-06-01");
    expect(db.manualInputs(stock.id)[0]?.note).toBe("Opus-Einschätzung vom 2025-06-01");
    assess(db, stock, [{ key: "risk.moat", value: 0.07 }], "2025-06-01");
    expect(db.manualInputs(stock.id)[0]?.note).toBe("");
    assess(db, stock, [{ key: "risk.moat", value: null }], "2025-06-02");
    expect(db.manualInputs(stock.id)).toEqual([]);
    db.close();
  });

  it("sagt dazu, wenn der Prüfstand mit einer anderen Rechnung entstanden ist", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00Z"));
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.setManualInput(stock.id, "risk.moat", 0.05);
    // Ein Tagesstand aus einer älteren Rechnung mit anderem Rückfluss.
    const now = computeValuation(db, stock, "2025-06-01").proposals;
    db.saveValuation(stock.id, "2025-06-01", {
      complete: true,
      price: null,
      riskScore: 0,
      innerReturn: null,
      innerReturnCautious: null,
      innerReturnOptimistic: null,
      details: { calcVersion: CALC_VERSION - 1, proposals: { ...now, values: { ...now.values, payoutLevel: 4 } } },
    });
    const review = computeValuation(db, stock, "2025-07-01").review;
    expect(review.calcChanged).toBe(true);
    expect(review.changes).toHaveLength(1);
    db.close();
  });
});

describe("Wachstum in Euro-Kaufkraft", () => {
  const base = { payoutLevel: 3, earningsLevel: 5, numberRisk: 0 };
  const review = (before: number, now: number, inflationGap: number) =>
    reviewOf({
      assessedOn: "2026-01-01",
      today: "2026-06-01",
      before: { ...base, growth: before },
      now: { ...base, growth: now },
      inflationGap,
    });

  it("misst die Verschiebung von einem Punkt in Euro-Kaufkraft", () => {
    // 1,15 Punkte nominal sind bei 17,5 Punkten Abstand weniger als ein Punkt real.
    expect(review(0.1, 0.1115, 0).changes).toHaveLength(1);
    expect(review(0.1, 0.1115, 0.175).changes).toHaveLength(0);
    expect(review(0.1, 0.13, 0.175).changes).toHaveLength(1);
  });
});
