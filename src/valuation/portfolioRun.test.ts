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

  it("nimmt das Profil des Portfolios und setzt die Anleiherendite als Untergrenze", () => {
    const db = prepared();
    const id = db.createPortfolio("Welt", "global");
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-19").profile).toEqual(PROFILE_GLOBAL);
    db.setReferenceRate(BOND_KEY, 0.034, "2026-11-18");
    const withBond = loadPortfolio(db, db.portfolio(id)!, "2026-11-19").profile;
    expect(withBond.minReturn).toBeCloseTo(0.034);
    expect(withBond.baseLimit).toBe(PROFILE_GLOBAL.baseLimit);
  });

  it("markiert Titel, deren Zahlen nicht zum Kurs passen", () => {
    const db = prepared();
    const id = db.createPortfolio("Depot", "fokussiert");
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-19").doubtful.size).toBe(0);
    // Ein Kurs weit unter den Zahlen: typisch für einen Hinterlegungsschein mit anderer Stückelung.
    db.saveManualPrice(stock.id, "2026-11-20", 1);
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-20").doubtful.get(stock.id)).toMatch(/^Rückfluss ist \d+ % des Kurses\.$/);
    // Wer das Rückflussniveau von Hand setzt, hat Kurs und Zahlen angesehen: keine Warnung mehr.
    db.setManualInput(stock.id, "payoutLevel", 0.05);
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-20").doubtful.size).toBe(0);
  });

  it("nimmt mit der Auswahl „bestand“ nur gehaltene Titel ins Ziel", () => {
    const db = prepared();
    db.addStockIfMissing({ ...stock, id: "HALT.US" });
    db.setWatched("HALT.US", false);
    const id = db.createPortfolio("Wikifolio", "fokussiert");
    db.setHolding(id, "HALT.US", 1);
    const all = loadPortfolio(db, db.portfolio(id)!, "2026-11-19");
    expect(all.stocks.map((s) => s.id)).toEqual([stock.id, "HALT.US"]);
    db.setSelection(id, "bestand");
    expect(db.portfolio(id)!.selection).toBe("bestand");
    const own = loadPortfolio(db, db.portfolio(id)!, "2026-11-19");
    expect(own.stocks.map((s) => s.id)).toEqual(["HALT.US"]);
    expect(own.view.rows.map((r) => r.id)).toEqual(["HALT.US"]);
  });

  it("führt gehaltene Titel ohne Kurs als nicht bewertet", () => {
    const db = prepared();
    db.addStockIfMissing({ ...stock, id: "OHNE.US", watched: false });
    const id = db.createPortfolio("Depot", "fokussiert");
    db.setHolding(id, "OHNE.US", 3);
    expect(loadPortfolio(db, db.portfolio(id)!, "2026-11-19").view.unpriced).toEqual(["OHNE.US"]);
  });
});
