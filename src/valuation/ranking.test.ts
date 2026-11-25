import { describe, expect, it } from "vitest";
import { EXCLUSION_SCORE } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { BOND_KEY } from "./portfolioRun.ts";
import { rank, rankingHurdle, rankWatchlist } from "./ranking.ts";
import type { StockValuation } from "./run.ts";
import { evaluate, priceSensitivity } from "./valuation.ts";

/** Bewerteter Titel mit gegebener Rendite im Basisfall; Rückfluss 1 je Aktie, damit der Kurs plausibel bleibt. */
function valued(
  id: string,
  base: number | null,
  options: { complete?: boolean; riskScore?: number; riskFloor?: number; review?: boolean; payoutLevel?: number } = {},
): StockValuation {
  const returns = base === null ? null : { cautious: base - 0.01, base, optimistic: base + 0.01 };
  return {
    stock: { ...stock, id },
    priceDate: "2026-11-18",
    proposals: { values: {}, details: {}, notes: [] },
    valuation: {
      ...evaluate({}, {}, null),
      inputs: { payoutLevel: options.payoutLevel ?? 1 },
      price: 40,
      complete: options.complete ?? true,
      riskScore: options.riskScore ?? 0.1,
      riskFloor: options.riskFloor ?? options.riskScore ?? 0.1,
      returns,
    },
    review: { assessedOn: "2026-01-01", overdue: options.review ?? false, changes: [], calcChanged: false, priceDrop: null },
  } as unknown as StockValuation;
}

describe("rank", () => {
  it("ordnet nach Rendite, zweifelhafte Titel hinter die belastbaren, und teilt in Gruppen", () => {
    const ranking = rank(
      [
        valued("LOW", 0.02),
        valued("TOP", 0.09),
        // Rückfluss bei 60 % des Kurses: Die Zahlen passen nicht zum Kurs.
        valued("ZWEIFEL", 0.3, { payoutLevel: 24 }),
        valued("OFFEN", 0.07, { complete: false }),
        valued("RISKANT", 0.12, { riskScore: EXCLUSION_SCORE }),
        valued("ALT", 0.06, { review: true }),
        valued("LEER", null, { complete: false }),
      ],
      0.05,
    );
    const ids = (rows: readonly StockValuation[]) => rows.map((r) => r.stock.id);
    expect(ids(ranking.rows)).toEqual(["RISKANT", "TOP", "OFFEN", "ALT", "LOW", "ZWEIFEL", "LEER"]);
    expect(ids(ranking.candidates)).toEqual(["TOP", "ALT"]);
    expect(ids(ranking.incomplete)).toEqual(["OFFEN", "LEER"]);
    expect(ids(ranking.promising)).toEqual(["OFFEN"]);
    expect(ids(ranking.toReview)).toEqual(["ALT"]);
    expect(ranking.next?.stock.id).toBe("OFFEN");
    expect(ranking.firstBelow).toBe(4);
    expect(ranking.open).toBe(3);
    expect(ranking.rows.find((r) => r.stock.id === "ZWEIFEL")).toMatchObject({ doubtful: true, clears: true });
  });

  it("schließt einen offenen Finanzwert nicht wegen seines Ersatzabzugs aus", () => {
    // Risikowert mit Ersatzabzug über 75 %, ohne ihn darunter: Das Urteil entscheidet, er bleibt aussichtsreich.
    const bank = valued("BANK", 0.08, { complete: false, riskScore: 0.8, riskFloor: 0.625 });
    const lost = valued("VERLOREN", 0.08, { complete: false, riskScore: 0.8, riskFloor: 0.8 });
    const ranking = rank([bank, lost], 0.05);
    expect(ranking.promising.map((r) => r.stock.id)).toEqual(["BANK"]);
    expect(ranking.incomplete.map((r) => r.stock.id)).toEqual(["BANK"]);
  });

  it("schlägt ohne aussichtsreiche Bewertung die erste unvollständige vor", () => {
    const ranking = rank([valued("A", 0.01, { complete: false }), valued("B", null, { complete: false })], 0.05);
    expect(ranking.next?.stock.id).toBe("A");
    expect(rank([], 0.05)).toMatchObject({ rows: [], next: undefined, firstBelow: -1, open: 0 });
  });

  it("bewertet die Watchlist aus der Datenbank mit der Anleiherendite als Hürde", () => {
    const db = new Database(":memory:");
    db.addStockIfMissing(stock);
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    db.saveFundamentals(stock.id, steadyYears(), "eodhd");
    db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 40 }]);
    const without = rankingHurdle(db);
    db.setReferenceRate(BOND_KEY, 0.06, "2026-11-18");
    expect(rankingHurdle(db)).toBeGreaterThan(without);
    const ranking = rankWatchlist(db, "2026-11-19");
    expect(ranking.hurdle).toBe(rankingHurdle(db));
    expect(ranking.rows.map((r) => r.stock.id)).toEqual([stock.id]);
    db.close();
  });
});

describe("priceSensitivity", () => {
  it("rechnet die Rendite bei anderen Kursen wie evaluate", () => {
    const inputs = { payoutLevel: 2, growth: 0.03 };
    const today = evaluate(inputs, {}, 40, 0.01);
    const rows = priceSensitivity(today, [-0.1, 0, 0.1]);
    expect(rows.map((r) => r.price)).toEqual([36, 40, 44]);
    expect(rows[1]!.innerReturn).toBeCloseTo(today.returns!.base!);
    expect(rows[0]!.innerReturn).toBeCloseTo(evaluate(inputs, {}, 36, 0.01).returns!.base!);
    expect(rows[0]!.innerReturn!).toBeGreaterThan(rows[2]!.innerReturn!);
  });

  it("bleibt ohne Kurs oder Rückfluss leer", () => {
    expect(priceSensitivity(evaluate({ payoutLevel: 2, growth: 0.03 }, {}, null), [0])).toEqual([]);
    expect(priceSensitivity(evaluate({ growth: 0.03 }, {}, 40), [0])).toEqual([]);
  });
});
