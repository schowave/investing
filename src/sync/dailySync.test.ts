import { describe, expect, it } from "vitest";
import { Database } from "../data/db.ts";
import type { FundamentalsYear, Stock } from "../data/db.ts";
import { runDailySync, syncSucceeded } from "./dailySync.ts";

const ECB = `<Cube><Cube time="2026-11-19"><Cube currency="USD" rate="1.25"/><Cube currency="GBP" rate="0.8"/></Cube></Cube>`;
const NOW = new Date("2026-11-19T22:15:00Z");

const stock = (id: string, change: Partial<Stock> = {}): Stock => ({
  id, name: id, sector: "Chemie", region: "Europa", country: "DE", reportingCurrency: "EUR", priceCurrency: "EUR",
  priceDivisor: 1, foundedYear: 1950, isFinancial: false, watched: true, ...change,
});

const years: FundamentalsYear[] = Array.from({ length: 10 }, (_, i) => ({
  fiscalYear: 2016 + i, epsDiluted: 5 + i * 0.1, dividendPerShare: 2, shares: 100, repurchases: 0, issuance: 0,
  stockBasedCompensation: 0, revenue: 5000 * 1.03 ** i, ebit: 750, totalAssets: 30e9, equity: 18e9, currentAssets: 2000,
  currentLiabilities: 1000, longTermDebt: 0, cash: 0, operatingCashFlow: 600, freeCashFlow: 400,
}));

/** Stellt EZB und EODHD nach und merkt sich die abgefragten Adressen (ohne Token). */
function fakeFetch(closes: Record<string, { date: string; close: number }[] | number>, ecbOk = true) {
  const calls: string[] = [];
  const fetchFn = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname.includes("ecb")) return new Response(ECB, { status: ecbOk ? 200 : 500 });
    const symbol = decodeURIComponent(url.pathname.split("/").at(-1)!);
    calls.push(`${symbol} ${url.searchParams.get("from")} ${url.searchParams.get("to")}`);
    const answer = closes[symbol] ?? 404;
    return typeof answer === "number" ? new Response("", { status: answer }) : Response.json(answer);
  }) as typeof fetch;
  return { fetchFn, calls };
}

function setup() {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock("A.XETRA"));
  db.addStockIfMissing(stock("B.US", { priceCurrency: "USD" }));
  db.addStockIfMissing(stock("VORRAT.US", { watched: false }));
  db.saveFundamentals("A.XETRA", years, "eodhd");
  return db;
}

describe("runDailySync", () => {
  it("lädt Kurse und Wechselkurse und speichert Bewertungen, Portfolios und den Lauf", async () => {
    const db = setup();
    const portfolio = db.createPortfolio("Depot", "fokussiert");
    db.setCash(portfolio, 1000);
    db.setHolding(portfolio, "A.XETRA", 10);
    const { fetchFn, calls } = fakeFetch({
      "A.XETRA": [{ date: "2026-11-18", close: 39 }, { date: "2026-11-19", close: 40 }],
      "B.US": [{ date: "2026-11-19", close: 125 }],
    });

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    expect(syncSucceeded(report)).toBe(true);
    expect(report).toMatchObject({ date: "2026-11-19", fxDate: "2026-11-19", valuations: 2, portfolios: 1 });
    // Ohne gespeicherten Kurs wird die längste erlaubte Historie geholt; der Vorratstitel bleibt außen vor.
    expect(calls).toEqual(["A.XETRA 2025-11-24 2026-11-19", "B.US 2025-11-24 2026-11-19"]);
    expect(db.latestPrice("A.XETRA")).toEqual({ date: "2026-11-19", close: 40 });
    expect(db.latestFxRate("USD")).toBe(1.25);
    expect(db.latestValuation("A.XETRA")).toMatchObject({ date: "2026-11-19", price: 40 });
    expect(db.portfolioSnapshots(portfolio, 5)).toMatchObject([{ date: "2026-11-19", totalEur: 1400 }]);
    expect(db.latestSyncRun()).toMatchObject({ ok: true });
    db.close();
  });

  it("holt nach einer Pause die Kurse ab dem letzten gespeicherten Tag", async () => {
    const db = setup();
    db.saveRawCloses("A.XETRA", [{ date: "2026-10-20", close: 38 }]);
    db.saveRawCloses("B.US", [{ date: "2026-11-18", close: 120 }]);
    const { fetchFn, calls } = fakeFetch({ "A.XETRA": [], "B.US": [] });
    await runDailySync(db, "geheim", NOW, fetchFn);
    expect(calls).toEqual(["A.XETRA 2026-10-20 2026-11-19", "B.US 2026-11-09 2026-11-19"]);
    db.close();
  });

  it("läuft bei gesperrten Kursen weiter und meldet den Lauf als unvollständig", async () => {
    const db = setup();
    db.saveRawCloses("A.XETRA", [{ date: "2026-11-18", close: 39 }]);
    const { fetchFn } = fakeFetch({ "A.XETRA": 403, "B.US": 403 }, false);

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    expect(syncSucceeded(report)).toBe(false);
    expect(report.fxError).toContain("500");
    expect(report.prices[0]).toEqual({ id: "A.XETRA", date: "2026-11-18", error: "HTTP 403 (Tarif enthält keine Kurse)" });
    expect(JSON.stringify(report)).not.toContain("geheim");
    // Die Bewertung wird trotzdem mit dem letzten bekannten Kurs gespeichert.
    expect(db.latestValuation("A.XETRA")).toMatchObject({ date: "2026-11-19", price: 39 });
    expect(db.latestSyncRun()).toMatchObject({ ok: false });
    db.close();
  });

  it("bezieht gehaltene Titel ein, die nicht auf der Watchlist stehen", async () => {
    const db = setup();
    const portfolio = db.createPortfolio("Depot", "global");
    db.setHolding(portfolio, "VORRAT.US", 5);
    const { fetchFn, calls } = fakeFetch({ "A.XETRA": [], "B.US": [], "VORRAT.US": [{ date: "2026-11-19", close: 7 }] });
    const report = await runDailySync(db, "geheim", NOW, fetchFn);
    expect(calls.map((c) => c.split(" ")[0])).toContain("VORRAT.US");
    expect(report.valuations).toBe(3);
    db.close();
  });
});
