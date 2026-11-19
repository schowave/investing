import { describe, expect, it } from "vitest";
import { PROFILE_FOCUSED, PROFILE_GLOBAL } from "../calc/index.ts";
import { Database } from "../data/db.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { BOND_KEY, loadPortfolio } from "./portfolioRun.ts";

function prepared() {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock);
  db.saveFundamentals(stock.id, steadyYears(), "eodhd");
  db.saveRawCloses(stock.id, [{ date: "2026-11-18", close: 40 }]);
  // Gehalten, aber nicht mehr auf der Watchlist; Kurs in Dollar.
  db.addStockIfMissing({ ...stock, id: "ALT.US", watched: false, priceCurrency: "USD", reportingCurrency: "USD" });
  db.saveRawCloses("ALT.US", [{ date: "2026-11-18", close: 11 }]);
  db.saveFxRates("2026-11-18", { USD: 1.1 });
  return db;
}

describe("loadPortfolio", () => {
  it("stellt Watchlist und gehaltene Titel mit Euro-Werten zusammen", () => {
    const db = prepared();
    const id = db.createPortfolio("Depot", "fokussiert");
    db.setCash(id, 1000);
    db.setHolding(id, "ALT.US", 10);
    const loaded = loadPortfolio(db, db.portfolio(id)!, "2026-11-19");

    expect(loaded.stocks.map((s) => s.id)).toEqual([stock.id, "ALT.US"]);
    expect([...loaded.holdings]).toEqual([["ALT.US", 10]]);
    expect(loaded.view.totalEur).toBeCloseTo(1000 + (10 * 11) / 1.1);
    expect(loaded.view.unpriced).toEqual([]);
    expect(loaded.profile).toEqual(PROFILE_FOCUSED);
  });

  it("nimmt das Profil des Portfolios und leitet die Mindestrendite aus der Anleiherendite ab", () => {
    const db = prepared();
    const id = db.createPortfolio("Welt", "global");
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-19").profile).toEqual(PROFILE_GLOBAL);
    db.setReferenceRate(BOND_KEY, 0.03, "2026-11-18");
    const withBond = loadPortfolio(db, db.portfolio(id)!, "2026-11-19").profile;
    expect(withBond.minReturn).not.toBe(PROFILE_GLOBAL.minReturn);
    expect(withBond.baseLimit).toBe(PROFILE_GLOBAL.baseLimit);
  });

  it("führt gehaltene Titel ohne Kurs als nicht bewertet", () => {
    const db = prepared();
    db.addStockIfMissing({ ...stock, id: "OHNE.US", watched: false });
    const id = db.createPortfolio("Depot", "fokussiert");
    db.setHolding(id, "OHNE.US", 3);
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-19").view.unpriced).toEqual(["OHNE.US"]);
  });
});
