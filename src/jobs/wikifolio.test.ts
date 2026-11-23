import { describe, expect, it } from "vitest";
import { Database, type Stock } from "../data/db.ts";
import type { Listing } from "../data/listings.ts";
import { testContext } from "../test/eodhd.ts";
import { stock } from "../test/fixtures.ts";
import { runJob } from "./registry.ts";
import { matchPositions, syncWikifolios, UNIVERSE_MAX_AGE_DAYS } from "./wikifolio.ts";

const credentials = { clientApiKey: "c", userApiKey: "u" };
const IMB = "GB0004544929";
const BAT = "GB0002875804";
const ETF = "IE00B4L5Y983";

const listing = (id: string, isin: string, change: Partial<Stock> = {}): Stock => ({ ...stock, id, name: id, isin, ...change });

/** Trading-API mit einem Wikifolio; `universe` sind die Seiten des Anlageuniversums. */
function fakeWikifolio(answer: object, universe: string[][] = [[IMB, BAT]]) {
  const calls: string[] = [];
  const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname === "/sessions") return init?.method === "POST" ? Response.json({ sessionToken: "s" }) : new Response("");
    if (url.pathname === "/wikifolios/WF0SHYSEL") return Response.json(answer);
    if (url.pathname === "/wikifolios/WF0SHYSEL/underlyings") {
      const page = Number(url.searchParams.get("pageNumber"));
      return Response.json({ results: universe[page - 1]!.map((isin) => ({ isin })), pageNumber: page, totalPages: universe.length });
    }
    return new Response("", { status: 404 });
  }) as typeof fetch;
  return { fetchFn, calls };
}

const answer = (positions: object[], cash = 5000) => ({
  wikifolioSymbol: "WF0SHYSEL",
  wikifolioStatus: "Test",
  cashAccountCurrentBalance: cash,
  totalValue: 100_000,
  baseCurrency: "EUR",
  positions,
});

function setup() {
  const db = new Database(":memory:");
  db.addStockIfMissing(listing("IMB.LSE", IMB));
  // Zweite Notiz derselben Aktie im Datenvorrat: Der Abgleich nimmt die auf der Watchlist.
  db.addStockIfMissing(listing("IMB.XETRA", IMB, { watched: false }));
  db.addStockIfMissing(listing("BATS.LSE", BAT));
  const id = db.createPortfolio("Shareholder Yield Select", "fokussiert");
  db.setWikifolio(id, "WF0SHYSEL");
  return { db, id };
}

describe("Positionen zuordnen", () => {
  const notiz = (id: string, watched: boolean): Listing => ({ id, watched, common: true, priced: true });
  const byIsin = new Map([[IMB, [notiz("IMB.XETRA", false), notiz("IMB.LSE", true)]]]);

  it("nimmt die Notiz auf der Watchlist vor der gehaltenen und fasst Stückzahlen zusammen", () => {
    const positions = [
      { isin: IMB, quantity: 100, averagePurchasePrice: 30 },
      { isin: IMB, quantity: 50, averagePurchasePrice: 31 },
    ];
    expect(matchPositions(positions, byIsin, new Map()).holdings).toEqual(new Map([["IMB.LSE", 150]]));
    expect(matchPositions(positions, byIsin, new Map([["IMB.XETRA", 10]])).holdings).toEqual(new Map([["IMB.LSE", 150]]));
    const imDatenvorrat = new Map([[IMB, [notiz("IMB.XETRA", false), notiz("IMB.DE", false)]]]);
    expect(matchPositions(positions, imDatenvorrat, new Map([["IMB.XETRA", 10]])).holdings).toEqual(new Map([["IMB.XETRA", 150]]));
  });

  it("führt unbekannte ISINs mit Einstandswert, leere Positionen gar nicht", () => {
    const { holdings, unmatched } = matchPositions(
      [
        { isin: ETF, quantity: 10, averagePurchasePrice: 80 },
        { isin: ETF, quantity: 5, averagePurchasePrice: 90 },
        { isin: "XX0000000001", quantity: 1, averagePurchasePrice: null },
        { isin: BAT, quantity: 0, averagePurchasePrice: 40 },
      ],
      byIsin,
      new Map(),
    );
    expect(holdings.size).toBe(0);
    expect(unmatched).toEqual([
      { isin: ETF, quantity: 15, valueEur: 1250 },
      { isin: "XX0000000001", quantity: 1, valueEur: null },
    ]);
  });
});

describe("Wikifolio abgleichen", () => {
  it("übernimmt Bargeld und Bestand, bucht Unbekanntes unter sonstige Anlagen und lädt das Anlageuniversum", async () => {
    const { db, id } = setup();
    db.setHolding(id, "BATS.LSE", 999);
    const api = fakeWikifolio(
      answer([
        { underlying: IMB, quantity: 300, averagePurchasePrice: 29 },
        { underlying: ETF, quantity: 10, averagePurchasePrice: 80 },
      ]),
    );
    const { ctx, log } = testContext(db, api.fetchFn);
    const result = await syncWikifolios(ctx, { credentials, now: new Date("2026-11-24T06:00:00Z") });

    expect(result).toEqual({ summary: "1 von 1 Wikifolios abgeglichen", ok: true });
    expect(db.holdings(id)).toEqual(new Map([["IMB.LSE", 300]]));
    expect(db.portfolio(id)).toMatchObject({ cashEur: 5000, otherEur: 800, syncedAt: "2026-11-24T06:00:00.000Z" });
    expect(db.unmatchedPositions(id)).toEqual([{ isin: ETF, quantity: 10, valueEur: 800 }]);
    expect(db.tradable(id)).toEqual({
      stockIds: new Set(["IMB.LSE", "IMB.XETRA", "BATS.LSE"]),
      loadedAt: "2026-11-24T06:00:00.000Z",
      isins: 2,
    });
    expect(log.join("\n")).toContain("nicht zugeordnet: IE00B4L5Y983");
    expect(api.calls.at(-1)).toBe("DELETE /sessions");
  });

  it("lädt das Anlageuniversum erst nach einer Woche neu", async () => {
    const { db, id } = setup();
    const api = fakeWikifolio(answer([]));
    const { ctx } = testContext(db, api.fetchFn);
    const sync = (iso: string) => syncWikifolios(ctx, { credentials, now: new Date(iso) });
    await sync("2026-11-24T06:00:00Z");
    await sync("2026-11-30T06:00:00Z");
    expect(api.calls.filter((c) => c.endsWith("underlyings"))).toHaveLength(1);
    await sync(new Date(Date.parse("2026-11-24T06:00:00Z") + UNIVERSE_MAX_AGE_DAYS * 86_400_000).toISOString());
    expect(api.calls.filter((c) => c.endsWith("underlyings"))).toHaveLength(2);
    expect(db.tradable(id)!.loadedAt).toBe("2026-12-01T06:00:00.000Z");
  });

  it("lässt ohne Schlüssel den letzten Stand stehen", async () => {
    const { db, id } = setup();
    db.setCash(id, 42);
    const api = fakeWikifolio(answer([]));
    const { ctx, log } = testContext(db, api.fetchFn);
    expect(await syncWikifolios(ctx, { credentials: null, now: new Date() })).toMatchObject({ ok: true });
    expect(api.calls).toHaveLength(0);
    expect(db.portfolio(id)!.cashEur).toBe(42);
    expect(log.join("\n")).toContain("WIKIFOLIO_CLIENT_API_KEY");
  });

  it("tut nichts ohne Portfolio mit Bestandsquelle wikifolio", async () => {
    const db = new Database(":memory:");
    db.createPortfolio("Depot", "global");
    const api = fakeWikifolio(answer([]));
    const { ctx } = testContext(db, api.fetchFn);
    expect(await syncWikifolios(ctx, { credentials, now: new Date() })).toMatchObject({ ok: true });
    expect(api.calls).toHaveLength(0);
  });

  it("meldet ein Wikifolio in fremder Währung als Fehler und ändert nichts", async () => {
    const { db, id } = setup();
    db.setCash(id, 42);
    const api = fakeWikifolio({ ...answer([]), baseCurrency: "USD" });
    const { ctx, log } = testContext(db, api.fetchFn);
    expect(await syncWikifolios(ctx, { credentials, now: new Date() })).toMatchObject({ ok: false });
    expect(db.portfolio(id)!.cashEur).toBe(42);
    expect(log.join("\n")).toContain("Basiswährung USD");
    expect(api.calls.at(-1)).toBe("DELETE /sessions");
  });

  it("läuft als eigener Lauf und ohne Schlüssel in der Umgebung als übersprungen", async () => {
    const { db } = setup();
    const { ctx } = testContext(db, fakeWikifolio(answer([])).fetchFn);
    const saved = { ...process.env };
    delete process.env.WIKIFOLIO_CLIENT_API_KEY;
    delete process.env.WIKIFOLIO_USER_API_KEY;
    try {
      expect(await runJob(ctx, "wikifolio", {})).toEqual({ summary: "wikifolio übersprungen, Schlüssel fehlen", ok: true });
    } finally {
      process.env = saved;
    }
  });
});

describe("Bestandsquelle wechseln", () => {
  it("vergisst Abgleich, nicht zugeordnete Positionen und Anlageuniversum", async () => {
    const { db, id } = setup();
    const api = fakeWikifolio(answer([{ underlying: ETF, quantity: 1, averagePurchasePrice: 1 }]));
    const { ctx } = testContext(db, api.fetchFn);
    await syncWikifolios(ctx, { credentials, now: new Date() });
    db.setWikifolio(id, null);
    expect(db.portfolio(id)).toMatchObject({ wikifolio: null, syncedAt: null });
    expect(db.unmatchedPositions(id)).toEqual([]);
    expect(db.tradable(id)).toBeNull();
  });
});
