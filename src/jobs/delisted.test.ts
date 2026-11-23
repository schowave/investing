import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import type { DelistedCandidate } from "../data/delisted.ts";
import { fakeEodhd, fundamentalsAnswer, status, testContext } from "../test/eodhd.ts";
import { stock } from "../test/fixtures.ts";
import { CALLS_PER_DELISTED, delistedTodo, importDelisted } from "./delisted.ts";
import { importStockpile } from "./stockpile.ts";

const candidate = (code: string, lastDate = "2022-06-30"): DelistedCandidate => ({
  id: `${code}.US`,
  name: `${code} Inc`,
  exchange: "NYSE",
  lastDate,
  turnover: 1e8,
  bars: [
    { date: "2022-05-31", close: 10, adjustedClose: 9 },
    { date: lastDate, close: 8, adjustedClose: 7 },
  ],
});

const routes = (codes: string[]) =>
  Object.fromEntries(
    codes.flatMap((c) => [
      [`fundamentals/${c}.US`, fundamentalsAnswer(`${c} Inc`)],
      [`div/${c}.US`, []],
      [`splits/${c}.US`, []],
    ]),
  );

describe("importDelisted", () => {
  it("legt den Titel an, kennzeichnet ihn, speichert Kurse, Dividenden und Splits und hält ihn aus dem Datenvorrat", async () => {
    const db = new Database(":memory:");
    const fetchFn = fakeEodhd({ ...routes(["AAA"]), "div/AAA.US": [{ date: "2022-02-01", value: 1, currency: "USD" }] });
    const { ctx } = testContext(db, fetchFn);
    const result = await importDelisted(ctx, [candidate("AAA")]);
    expect(result).toMatchObject({ ok: true, summary: expect.stringContaining("1 eingestellte Titel geladen") });
    expect(db.stock("AAA.US")).toMatchObject({ delistedOn: "2022-06-30", watched: false });
    expect(db.monthlyPrices("AAA.US").map((r) => r.month)).toEqual(["2022-05", "2022-06"]);
    expect(db.dividends("AAA.US")).toHaveLength(1);
    expect(db.fundamentals("AAA.US").length).toBeGreaterThan(0);
    // Abgleich und Bewertung sehen ihn nicht, der Rückblick schon.
    expect(db.stocks({ includeStockpile: true }).map((s) => s.id)).not.toContain("AAA.US");
    expect(db.stocks({ includeStockpile: true, includeDelisted: true }).map((s) => s.id)).toContain("AAA.US");
    expect(db.searchStocks("AAA", 5)).toEqual([]);
    expect(fetchFn.calls).toEqual(["fundamentals/AAA.US", "div/AAA.US", "splits/AAA.US"]);
  });

  it("bewahrt die Rohantwort nicht auf", async () => {
    const db = new Database(":memory:");
    await importDelisted(testContext(db, fakeEodhd(routes(["AAA"]))).ctx, [candidate("AAA")]);
    expect(db.rawDocument("AAA.US", "eodhd-fundamentals")).toBeNull();
  });

  it("überspringt ein Symbol, das einem lebenden Titel gehört, und lädt es nicht", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "AAA.US", watched: false });
    const fetchFn = fakeEodhd(routes(["AAA"]));
    const result = await importDelisted(testContext(db, fetchFn).ctx, [candidate("AAA")]);
    expect(fetchFn.calls).toEqual([]);
    expect(result.summary).toContain("0 eingestellte Titel geladen");
    expect(delistedTodo({ db }, [candidate("AAA")]).taken).toBe(1);
  });

  it("merkt sich Titel ohne Abschlüsse und lädt sie nicht noch einmal", async () => {
    const db = new Database(":memory:");
    const fetchFn = fakeEodhd({ "fundamentals/NOPE.US": { General: { Name: "Nope", Type: "Common Stock" }, Financials: {} } });
    const first = await importDelisted(testContext(db, fetchFn).ctx, [candidate("NOPE")]);
    expect(first.summary).toContain("1 ohne Abschlüsse");
    expect(db.stock("NOPE.US")).toBeNull();
    await importDelisted(testContext(db, fetchFn).ctx, [candidate("NOPE")]);
    expect(fetchFn.calls).toEqual(["fundamentals/NOPE.US"]);
  });

  it("setzt einen halb geladenen Titel fort, ohne die Abschlüsse neu zu holen", async () => {
    const db = new Database(":memory:");
    const broken = fakeEodhd({ ...routes(["AAA"]), "div/AAA.US": status(500) });
    const first = await importDelisted(testContext(db, broken).ctx, [candidate("AAA")]);
    expect(first.ok).toBe(false);
    // Der Titel ist trotzdem gekennzeichnet, aber ohne Dividenden.
    expect(db.stock("AAA.US")!.delistedOn).toBe("2022-06-30");
    expect(delistedTodo({ db }, [candidate("AAA")]).todo).toHaveLength(1);
    const fixed = fakeEodhd(routes(["AAA"]));
    const second = await importDelisted(testContext(db, fixed).ctx, [candidate("AAA")]);
    expect(second.ok).toBe(true);
    expect(fixed.calls).toEqual(["div/AAA.US", "splits/AAA.US"]);
  });

  it("beachtet die Höchstzahl und bricht am Tageslimit ab", async () => {
    const db = new Database(":memory:");
    const fetchFn = fakeEodhd(routes(["AAA", "BBB", "CCC"]));
    await importDelisted(testContext(db, fetchFn).ctx, [candidate("AAA"), candidate("BBB"), candidate("CCC")], 2);
    expect(db.stock("AAA.US")).not.toBeNull();
    expect(db.stock("CCC.US")).toBeNull();

    const limited = new Database(":memory:");
    const result = await importDelisted(testContext(limited, fakeEodhd({ "fundamentals/*": status(402) })).ctx, [candidate("AAA")]);
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("Rest offen");
  });

  it("lädt keine Abschlüsse eines anderen Unternehmens, wenn das Kürzel neu vergeben ist, und merkt es sich", async () => {
    const db = new Database(":memory:");
    const fetchFn = fakeEodhd({ "fundamentals/AAA.US": fundamentalsAnswer("Völlig Anders AG") });
    const first = await importDelisted(testContext(db, fetchFn).ctx, [candidate("AAA")]);
    expect(first.summary).toContain("1 mit abweichendem Namen");
    expect(db.stock("AAA.US")).toBeNull();
    await importDelisted(testContext(db, fetchFn).ctx, [candidate("AAA")]);
    expect(fetchFn.calls).toEqual(["fundamentals/AAA.US"]);
  });

  it("holt fehlende Monatskurse eines angelegten Titels nach", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "AAA.US", watched: false });
    db.setDelistedOn("AAA.US", "2022-06-30");
    db.saveDividends("AAA.US", []);
    db.saveSplits("AAA.US", []);
    expect(delistedTodo({ db }, [candidate("AAA")]).todo).toHaveLength(1);
    const fetchFn = fakeEodhd({});
    await importDelisted(testContext(db, fetchFn).ctx, [candidate("AAA")]);
    expect(fetchFn.calls).toEqual([]);
    expect(db.monthlyPrices("AAA.US")).toHaveLength(2);
  });

  it("hält eingestellte Titel aus Regionen, Abdeckung und Titelsuche heraus, nennt sie aber für den Stockpile-Import", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "LIVE.US", region: "Nordamerika", watched: false });
    db.addStockIfMissing({ ...stock, id: "GONE.US", region: "Antarktis", country: "AQ", watched: false });
    db.setDelistedOn("GONE.US", "2022-06-30");
    expect(db.regions()).not.toContain("Antarktis");
    expect(db.coverage().reduce((n, g) => n + g.stocks, 0)).toBe(1);
    expect(db.delistedStockIds()).toEqual(new Set(["GONE.US"]));
  });

  it("lässt den Stockpile-Import ein Kürzel eines eingestellten Titels nicht überschreiben", async () => {
    const db = new Database(":memory:");
    db.addStockIfMissing({ ...stock, id: "GONE.US", watched: false });
    db.setDelistedOn("GONE.US", "2022-06-30");
    const fetchFn = fakeEodhd({ "fundamentals/GONE.US": fundamentalsAnswer("Neues Unternehmen") });
    await importStockpile(testContext(db, fetchFn).ctx, {
      indices: [],
      symbols: ["GONE.US"],
      exchanges: [],
      refreshAll: false,
      watch: false,
    });
    expect(fetchFn.calls).toEqual([]);
    expect(db.fundamentals("GONE.US")).toEqual([]);
  });

  it("rechnet zwölf Abrufe je Titel", () => {
    expect(CALLS_PER_DELISTED).toBe(12);
  });
});
