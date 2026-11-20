import { describe, expect, it } from "vitest";
import type { Stock } from "../data/db.ts";
import { Database } from "../data/db.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { logForward, MIN_MARKET_CAP_EUR } from "./forwardLog.ts";
import { recomputeAll } from "./recompute.ts";
import type { StockValuation } from "./run.ts";
import { assess, computeValuation } from "./run.ts";

const DATE = "2026-11-19";
/** Schlusskurs, bei dem die Beispielzahlen die Mindestrendite beider Profile übertreffen. */
const CLOSE = 40;
/** Aktienzahl, bei der dieser Kurs weit über der Marktwertgrenze liegt. */
const SHARES = 1e9;

function addStock(db: Database, id: string, extra: Partial<Stock> = {}, shares = SHARES, close = CLOSE) {
  const s: Stock = { ...stock, id, watched: false, ...extra };
  db.addStockIfMissing(s);
  // Die Aktienzahl wächst, die absoluten Posten mit ihr; je Aktie bleibt alles beim Alten (steadyYears hat 100 Aktien).
  const f = shares / 100;
  db.saveFundamentals(
    id,
    steadyYears((y) => {
      y.shares = shares;
      for (const field of [
        "revenue",
        "ebit",
        "ebitda",
        "totalAssets",
        "equity",
        "currentAssets",
        "currentLiabilities",
        "operatingCashFlow",
        "freeCashFlow",
        "repurchases",
      ] as const)
        y[field] = (y[field] ?? 0) * f;
    }),
    "eodhd",
  );
  db.saveRawCloses(id, [{ date: "2026-11-18", close }]);
  return s;
}

function valueAll(db: Database): Map<string, StockValuation> {
  return new Map(db.stocks({ includeStockpile: true }).map((s) => [s.id, computeValuation(db, s, DATE)]));
}

describe("logForward", () => {
  it("protokolliert im Arm „zahlen“ je Profil das Zielportfolio mit dem Kurs von heute und lässt den Monat danach in Ruhe", () => {
    const db = new Database(":memory:");
    addStock(db, "A.US");
    addStock(db, "B.US");
    const valued = valueAll(db);

    expect(logForward(db, DATE, valued)).toBeGreaterThan(0);
    const rows = db.forwardLog();
    expect(new Set(rows.map((r) => `${r.arm}|${r.profile}`))).toEqual(new Set(["zahlen|fokussiert", "zahlen|global"]));
    expect(rows.every((r) => r.date === DATE && r.priceEur === CLOSE && r.weight > 0 && r.innerReturn > 0)).toBe(true);

    // Derselbe Monat: nichts Neues, auch nicht an einem anderen Tag.
    expect(logForward(db, "2026-11-25", valued)).toBe(0);
    expect(db.forwardLog().every((r) => r.date === DATE)).toBe(true);
    db.close();
  });

  it("legt im nächsten Monat einen neuen Eintrag an und nimmt den letzten als gehaltenen Bestand", () => {
    const db = new Database(":memory:");
    addStock(db, "A.US");
    const valued = valueAll(db);
    logForward(db, DATE, valued);
    expect(db.forwardLogWeights("zahlen", "fokussiert", "2026-12-01").get("A.US")).toBeGreaterThan(0);
    expect(db.forwardLogWeights("zahlen", "fokussiert", DATE).size).toBe(0);

    expect(logForward(db, "2026-12-01", valued)).toBeGreaterThan(0);
    expect([...new Set(db.forwardLog().map((r) => r.date))]).toEqual([DATE, "2026-12-01"]);
    db.close();
  });

  it("lässt Kleinstwerte, Anleihen als Stammaktie und Mehrfachnotierungen aus dem Arm „zahlen“ heraus", () => {
    const db = new Database(":memory:");
    addStock(db, "GROSS.US");
    addStock(db, "KLEIN.US", {}, MIN_MARKET_CAP_EUR / CLOSE / 2); // halber Mindestwert
    addStock(db, "ANLEIHE.US", { name: "DTE Energy Company 2020 Series G" });
    const valued = valueAll(db);
    logForward(db, DATE, valued);
    const ids = new Set(db.forwardLog().map((r) => r.stockId));
    expect(ids.has("GROSS.US")).toBe(true);
    expect(ids.has("KLEIN.US")).toBe(false);
    expect(ids.has("ANLEIHE.US")).toBe(false);
    db.close();
  });

  it("behält von zwei Notierungen mit gleichen Zahlen nur die mit dem größeren Marktwert", () => {
    const db = new Database(":memory:");
    addStock(db, "HEIM.US", {}, SHARES, CLOSE);
    addStock(db, "ZWEIT.US", {}, SHARES, CLOSE * 0.95);
    logForward(db, DATE, valueAll(db));
    expect(new Set(db.forwardLog().map((r) => r.stockId))).toEqual(new Set(["HEIM.US"]));
    db.close();
  });

  it("protokolliert den Arm „urteil“ nur für beobachtete Titel mit allen Risikofaktoren", () => {
    const db = new Database(":memory:");
    const watched = addStock(db, "URTEIL.US", { watched: true });
    addStock(db, "OHNE.US", { watched: true });
    // Nur dieser Titel bekommt alle offenen Risikofaktoren von Hand.
    const open = computeValuation(db, watched, DATE).valuation.missing;
    assess(
      db,
      watched,
      open.map((key) => ({ key, value: 0.1 })),
      DATE,
    );
    logForward(db, DATE, valueAll(db));
    const judged = db.forwardLog().filter((r) => r.arm === "urteil");
    expect(judged.length).toBeGreaterThan(0);
    expect(new Set(judged.map((r) => r.stockId))).toEqual(new Set(["URTEIL.US"]));
    db.close();
  });

  it("merkt sich einen Monat ohne Kandidaten und rechnet ihn nicht noch einmal", () => {
    const db = new Database(":memory:");
    addStock(db, "OHNE.US", { watched: true });
    expect(logForward(db, DATE, valueAll(db))).toBeGreaterThan(0); // nur der Arm „zahlen“ hat einen Kandidaten
    expect(db.forwardLog().some((r) => r.arm === "urteil")).toBe(false);
    expect(db.setting("forward-log:urteil:fokussiert")).toBe("2026-11");
    db.close();
  });

  it("wird vom Neurechnen der Tagesstände aufgerufen", () => {
    const db = new Database(":memory:");
    addStock(db, "A.US", { watched: true });
    recomputeAll(db, DATE);
    expect(db.forwardLog().length).toBeGreaterThan(0);
    db.close();
  });

  it("rechnet den Arm „zahlen“ ohne Eingaben von Hand, auch für beobachtete Titel", () => {
    const db = new Database(":memory:");
    const watched = addStock(db, "URTEIL.US", { watched: true });
    const plain = computeValuation(db, watched, DATE).valuation.returns!.base!;
    // Ein Urteil von Hand drückt die Rendite unter jede Hürde; der Arm „zahlen“ darf davon nichts merken.
    assess(db, watched, [{ key: "growth", value: -0.5 }], DATE);
    logForward(db, DATE, valueAll(db));
    const numbers = db.forwardLog().filter((r) => r.arm === "zahlen" && r.stockId === "URTEIL.US");
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers.every((r) => Math.abs(r.innerReturn - plain) < 1e-9)).toBe(true);
    db.close();
  });

  it("lässt Titel ohne Wechselkurs aus dem Zielportfolio heraus", () => {
    const db = new Database(":memory:");
    addStock(db, "A.US");
    addStock(db, "YEN.T", { priceCurrency: "JPY" });
    logForward(db, DATE, valueAll(db));
    const rows = db.forwardLog().filter((r) => r.arm === "zahlen" && r.profile === "global");
    expect(rows.map((r) => r.stockId)).toEqual(["A.US"]);
    db.close();
  });

  it("lässt das Neurechnen weiterlaufen, wenn das Protokoll scheitert", () => {
    const db = new Database(":memory:");
    addStock(db, "A.US", { watched: true });
    db.saveForwardLog = () => {
      throw new Error("kaputt");
    };
    const report = recomputeAll(db, DATE);
    expect(report.valuationErrors).toEqual([{ id: "Vorwärtsprotokoll", error: "kaputt" }]);
    expect(db.setting("calc-version")).not.toBeNull();
    db.close();
  });
});
