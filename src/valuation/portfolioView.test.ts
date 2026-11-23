import { describe, expect, it } from "vitest";
import { PROFILE_FOCUSED } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import type { PortfolioItem } from "./portfolioView.ts";
import { buildPortfolioView } from "./portfolioView.ts";

const item = (id: string, change: Partial<PortfolioItem> = {}): PortfolioItem => ({
  id,
  sector: "Chemie",
  region: "Europa",
  innerReturn: 0.1,
  riskScore: 0.2,
  complete: true,
  shares: 0,
  priceEur: 10,
  ...change,
});

describe("buildPortfolioView", () => {
  it("stellt Ist und Ziel gegenüber und schlägt Käufe und Verkäufe in Euro vor", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 5000, [
      item("GUT", { innerReturn: 0.12 }),
      item("HALTEN", { shares: 300, innerReturn: 0.1 }),
      // Unter der Untergrenze des Profils (ohne geladene Anleiherendite 3 %).
      item("SCHWACH", { shares: 200, innerReturn: 0.02 }),
      item("OFFEN", { complete: false }),
    ]);
    expect(view.totalEur).toBe(10000);
    expect(view.cashWeight).toBe(0.5);

    const row = (id: string) => view.rows.find((r) => r.id === id)!;
    // Limit 15 % · (1 − 0,2) = 12 %
    expect(row("GUT")).toMatchObject({ action: "kaufen", heldWeight: 0, reason: null });
    expect(row("GUT").targetWeight).toBeCloseTo(0.12);
    expect(row("GUT").changeEur).toBeCloseTo(1200);
    // Die gehaltene Position liegt mit 30 % über dem Limit und wird nicht gekürzt.
    expect(row("HALTEN")).toMatchObject({ action: "halten", change: 0 });
    expect(row("HALTEN").targetWeight).toBeCloseTo(0.3);
    expect(row("SCHWACH")).toMatchObject({ action: "verkaufen", targetWeight: 0, reason: "bringt weniger als die Anleihe" });
    expect(row("SCHWACH").changeEur).toBeCloseTo(-2000);
    expect(view.rows.some((r) => r.id === "OFFEN")).toBe(false);
    expect(view.targetCashWeight).toBeCloseTo(0.58);
    expect(view.sectors).toEqual([{ name: "Chemie", held: 0.5, target: expect.closeTo(0.42) }]);
  });

  it("schlägt für einen gehaltenen, unvollständig bewerteten Titel keinen Verkauf vor", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 1000, [item("OFFEN", { shares: 100, complete: false })]);
    expect(view.rows[0]).toMatchObject({ action: "bewerten", change: 0, changeEur: 0, reason: "Bewertung unvollständig" });
  });

  it("zählt sonstige Anlagen zum Gesamtwert und zieht sie im Ziel vom Barbestand ab", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 1000, [item("GUT", { shares: 100 })], 2000);
    expect(view.totalEur).toBe(4000);
    expect(view.otherWeight).toBe(0.5);
    expect(view.rows[0]!.heldWeight).toBe(0.25);
    // Ziel: 25 % bleiben in der Aktie, 75 % wären bar; davon sind 50 Punkte durch sonstige Anlagen belegt.
    expect(view.targetCashWeight).toBeCloseTo(0.25);
  });

  it("nennt gehaltene Titel ohne Kurs und rechnet sie nicht in die Summe", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 1000, [item("OHNE", { shares: 10, priceEur: null })]);
    expect(view.totalEur).toBe(1000);
    expect(view.unpriced).toEqual(["OHNE"]);
    expect(view.rows[0]!.valueEur).toBeNull();
  });

  it("mittelt die innere Rendite des Bestands und des Ziels nach Gewicht, ohne Bargeld", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 5000, [
      item("A", { shares: 300, innerReturn: 0.15 }),
      item("B", { shares: 100, innerReturn: 0.07 }),
      item("OHNE", { shares: 100, innerReturn: null }),
      // Zahlen passen nicht zum Kurs: Die Rendite ist nicht belastbar.
      item("ZWEIFEL", { shares: 100, innerReturn: 0.9, doubtful: true }),
    ]);
    // 3000 Euro zu 15 % und 1000 Euro zu 7 %.
    expect(view.heldReturn).toBeCloseTo(0.13);
    expect(view.heldWithoutReturn).toEqual(["OHNE", "ZWEIFEL"]);
    // Ziel: A bleibt bei 30 %, B wird auf das Limit von 12 % aufgestockt.
    expect(view.targetReturn).toBeCloseTo((0.3 * 0.15 + 0.12 * 0.07) / 0.42);
    expect(buildPortfolioView(PROFILE_FOCUSED, 1000, []).heldReturn).toBeNull();
  });

  it("übergeht Kandidaten, die das Portfolio nicht kaufen kann, und rückt den nächsten nach (Strategie 7.1)", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 10000, [
      item("BESTER", { innerReturn: 0.2, tradable: false }),
      item("ZWEITER", { innerReturn: 0.15 }),
      // Gehalten zählt als handelbar: Was im Portfolio liegt, lässt sich verkaufen.
      item("GEHALTEN", { innerReturn: 0.12, shares: 10, tradable: false }),
      // Kein Kandidat: taucht nicht als übergangen auf.
      item("SCHWACH", { innerReturn: 0.01, tradable: false }),
    ]);
    const ids = view.rows.filter((r) => r.targetWeight > 0).map((r) => r.id);
    expect(ids).toContain("ZWEITER");
    expect(ids).toContain("GEHALTEN");
    expect(ids).not.toContain("BESTER");
    expect(view.untradable).toEqual(["BESTER"]);
  });

  it("zeigt bei leerem Portfolio nur Zielgewichte", () => {
    const view = buildPortfolioView(PROFILE_FOCUSED, 0, [item("GUT")]);
    expect(view.rows[0]).toMatchObject({ action: "kaufen", changeEur: 0 });
    expect(view.rows[0]!.targetWeight).toBeCloseTo(0.12);
  });
});

describe("Datenbank: Portfolios, Suche, Handkurs", () => {
  it("führt Portfolios mit Positionen und findet Aktien im Vorrat", () => {
    const db = new Database(":memory:");
    const base = {
      sector: "Tabak",
      region: "Europa",
      country: "GB",
      reportingCurrency: "GBP",
      priceCurrency: "GBP",
      priceDivisor: 100,
      foundedYear: null,
      isFinancial: false,
    };
    db.addStockIfMissing({ ...base, id: "IMB.LSE", name: "Imperial Brands", watched: true });
    db.addStockIfMissing({ ...base, id: "BATS.LSE", name: "British American Tobacco", watched: false });

    expect(db.searchStocks("tobacco", 10).map((h) => h.stock.id)).toEqual(["BATS.LSE"]);
    expect(db.searchStocks("lse", 10).map((h) => h.stock.id)).toEqual(["IMB.LSE", "BATS.LSE"]);
    expect(db.searchStocks("100%", 10)).toEqual([]);
    db.setWatched("BATS.LSE", true);
    expect(db.stocks()).toHaveLength(2);

    db.saveManualPrice("IMB.LSE", "2026-11-19", 28.5);
    expect(db.latestPrice("IMB.LSE")).toEqual({ date: "2026-11-19", close: 28.5 });

    const id = db.createPortfolio("Depot", "global");
    db.setCash(id, 2500);
    db.setHolding(id, "IMB.LSE", 100);
    db.setHolding(id, "BATS.LSE", 50);
    db.setHolding(id, "BATS.LSE", 0);
    db.setOtherAssets(id, 800);
    expect(db.portfolio(id)).toEqual({
      id,
      name: "Depot",
      profile: "global",
      cashEur: 2500,
      otherEur: 800,
      comdirectDepotId: null,
      wikifolio: null,
      syncedAt: null,
    });
    expect([...db.holdings(id)]).toEqual([["IMB.LSE", 100]]);
    db.deletePortfolio(id);
    expect(db.portfolios()).toEqual([]);
    expect(db.holdings(id).size).toBe(0);
    db.close();
  });
});
