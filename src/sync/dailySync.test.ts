import { describe, expect, it } from "vitest";
import type { FundamentalsYear, Stock } from "../data/db.ts";
import { Database } from "../data/db.ts";
import { looksImplausible, runDailySync, syncSucceeded } from "./dailySync.ts";

const ECB = `<Cube><Cube time="2026-11-19"><Cube currency="USD" rate="1.25"/><Cube currency="GBP" rate="0.8"/></Cube></Cube>`;
const NOW = new Date("2026-11-19T22:15:00Z");

const stock = (id: string, change: Partial<Stock> = {}): Stock => ({
  id,
  name: id,
  sector: "Chemie",
  region: "Europa",
  country: "DE",
  reportingCurrency: "EUR",
  priceCurrency: "EUR",
  priceDivisor: 1,
  foundedYear: 1950,
  isFinancial: false,
  watched: true,
  ...change,
});

const years: FundamentalsYear[] = Array.from({ length: 10 }, (_, i) => ({
  fiscalYear: 2016 + i,
  epsDiluted: 5 + i * 0.1,
  dividendPerShare: 2,
  shares: 100,
  repurchases: 0,
  issuance: 0,
  stockBasedCompensation: 0,
  revenue: 5000 * 1.03 ** i,
  ebit: 750,
  totalAssets: 30e9,
  equity: 18e9,
  currentAssets: 2000,
  currentLiabilities: 1000,
  longTermDebt: 0,
  cash: 0,
  operatingCashFlow: 600,
  freeCashFlow: 400,
  netDebt: 0,
  interestExpense: 0,
  ebitda: 900,
}));

interface Fake {
  closes?: Record<string, { date: string; close: number }[] | number>;
  /** Antworten der Symbolsuche: letzter Schlusskurs je Symbol. */
  search?: Record<string, number>;
  ecbOk?: boolean;
  /** Antworten des Sammelabrufs je Symbol; ohne Angabe ist er gesperrt. */
  bulk?: Record<string, number>;
  /** Tageslimit und bisheriger Verbrauch laut Konto. */
  account?: { limit: number; used: number };
  extraRates?: Record<string, number>;
  /** Rendite der zehnjährigen Anleihe in Prozent. */
  bondYield?: number;
  /** Inflationsprognose in Prozent je IWF-Ländercode. */
  inflation?: Record<string, number>;
}

/** Stellt EZB, Zusatzkurse und EODHD nach und merkt sich die abgefragten Adressen (ohne Token). */
function fakeFetch(fake: Fake) {
  const calls: string[] = [];
  const fetchFn = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.hostname.includes("data-api.ecb")) {
      return new Response(fake.bondYield === undefined ? "" : `KEY,TIME_PERIOD,OBS_VALUE\nYC,2026-11-18,${fake.bondYield}`, {
        status: fake.bondYield === undefined ? 500 : 200,
      });
    }
    if (url.hostname.includes("imf.org")) {
      const forecast = (value: number) => ({ 2027: value, 2028: value, 2029: value, 2030: value });
      return fake.inflation
        ? Response.json({ values: { PCPIPCH: Object.fromEntries(Object.entries(fake.inflation).map(([k, v]) => [k, forecast(v)])) } })
        : new Response("", { status: 500 });
    }
    if (url.hostname.includes("ecb")) return new Response(ECB, { status: fake.ecbOk === false ? 500 : 200 });
    if (url.hostname.includes("er-api")) return Response.json({ result: "success", rates: fake.extraRates ?? {} });
    const [kind, ...rest] = url.pathname.replace("/api/", "").split("/");
    const symbol = decodeURIComponent(rest.join("/"));
    if (kind === "user") {
      const account = fake.account ?? { limit: 100000, used: 0 };
      return Response.json({ dailyRateLimit: account.limit, apiRequests: account.used, subscriptionType: "test" });
    }
    if (kind === "eod-bulk-last-day") {
      calls.push(`sammel ${symbol}`);
      if (!fake.bulk) return new Response("", { status: 403 });
      return Response.json(
        Object.entries(fake.bulk)
          .filter(([id]) => id.endsWith(`.${symbol}`))
          .map(([id, close]) => ({ code: id.slice(0, id.lastIndexOf(".")), date: "2026-11-18", close })),
      );
    }
    if (kind === "search") {
      calls.push(`suche ${symbol}`);
      const close = fake.search?.[symbol];
      const [Code, Exchange] = symbol.split(".");
      return Response.json(
        close === undefined
          ? []
          : [{ Code, Exchange, Name: symbol, Type: "Common Stock", previousClose: close, previousCloseDate: "2026-11-18" }],
      );
    }
    calls.push(`${symbol} ${url.searchParams.get("from")} ${url.searchParams.get("to")}`);
    const answer = fake.closes?.[symbol] ?? 404;
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
      closes: {
        "A.XETRA": [
          { date: "2026-11-18", close: 39 },
          { date: "2026-11-19", close: 40 },
        ],
        "B.US": [{ date: "2026-11-19", close: 125 }],
        "VORRAT.US": [{ date: "2026-11-19", close: 7 }],
      },
    });

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    expect(syncSucceeded(report)).toBe(true);
    expect(report).toMatchObject({ date: "2026-11-19", fxDate: "2026-11-19", pricesLoaded: 3, valuations: 2, portfolios: 1 });
    // Gehaltene Titel zuerst, dann die Watchlist, dann der Vorrat. Ohne gespeicherten Kurs die längste erlaubte Historie.
    expect(calls).toEqual(["A.XETRA 2025-11-24 2026-11-19", "B.US 2025-11-24 2026-11-19", "VORRAT.US 2025-11-24 2026-11-19"]);
    expect(db.latestPrice("A.XETRA")).toEqual({ date: "2026-11-19", close: 40 });
    expect(db.latestFxRate("USD")).toBe(1.25);
    expect(db.latestValuation("A.XETRA")).toMatchObject({ date: "2026-11-19", price: 40 });
    // Der Vorrat bekommt eine Momentaufnahme, aber keinen Verlauf.
    expect(db.latestValuation("VORRAT.US")).toBeNull();
    expect(db.screening({}, 10).map((r) => r.stock.id)).toEqual(["A.XETRA"]);
    expect(db.portfolioSnapshots(portfolio, 5)).toMatchObject([{ date: "2026-11-19", totalEur: 1400 }]);
    expect(db.latestSyncRun()).toMatchObject({ ok: true });
    db.close();
  });

  it("holt nach einer Pause die Kurse ab dem letzten gespeicherten Tag und überspringt aktuelle", async () => {
    const db = setup();
    db.saveRawCloses("A.XETRA", [{ date: "2026-10-20", close: 38 }]);
    db.saveRawCloses("B.US", [{ date: "2026-11-18", close: 120 }]);
    db.saveRawCloses("VORRAT.US", [{ date: "2026-11-17", close: 7 }]);
    const { fetchFn, calls } = fakeFetch({ closes: { "A.XETRA": [], "VORRAT.US": [] } });
    const report = await runDailySync(db, "geheim", NOW, fetchFn);
    expect(calls).toEqual(["A.XETRA 2026-10-20 2026-11-19", "VORRAT.US 2026-11-09 2026-11-19"]);
    expect(report.pricesCurrent).toBe(1);
    db.close();
  });

  it("hält das Tagesbudget ein: gehaltene Titel zuerst, der Rest wartet, der Vorrat bleibt außen vor", async () => {
    const db = setup();
    db.addStockIfMissing(stock("C.US"));
    const portfolio = db.createPortfolio("Depot", "global");
    db.setHolding(portfolio, "C.US", 5);
    db.saveRawCloses("A.XETRA", [{ date: "2026-11-10", close: 38 }]);
    db.saveRawCloses("B.US", [{ date: "2026-11-12", close: 120 }]);
    // 20 Abrufe am Tag, 16 verbraucht, 2 bleiben in Reserve: Platz für zwei Kurse.
    const { fetchFn, calls } = fakeFetch({ closes: { "A.XETRA": [], "C.US": [], "B.US": [] }, account: { limit: 20, used: 16 } });

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    expect(report.budget).toBe(2);
    expect(calls.map((c) => c.split(" ")[0])).toEqual(["C.US", "A.XETRA"]);
    expect(report.pricesDeferred).toEqual(["B.US"]);
    expect(syncSucceeded(report)).toBe(false);
    db.close();
  });

  it("nimmt bei gesperrter Kurshistorie den Schlusskurs aus der Symbolsuche", async () => {
    const db = setup();
    db.addStockIfMissing(stock("IMB.LSE", { priceCurrency: "GBP", priceDivisor: 100 }));
    const { fetchFn, calls } = fakeFetch({
      closes: { "A.XETRA": 403, "B.US": 403, "IMB.LSE": 403, "VORRAT.US": 403 },
      search: { "A.XETRA": 41, "IMB.LSE": 2849, "VORRAT.US": 7 },
    });

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    // Die Sperre wird einmal festgestellt, danach geht es direkt über die Suche.
    expect(calls.filter((c) => !c.startsWith("suche"))).toHaveLength(1);
    expect(db.latestPrice("A.XETRA")).toEqual({ date: "2026-11-18", close: 41 });
    expect(db.latestPrice("IMB.LSE")).toEqual({ date: "2026-11-18", close: 28.49 });
    expect(report.pricesLoaded).toBe(3);
    expect(report.priceErrors).toEqual([{ id: "B.US", error: "kein Kurs in der Symbolsuche" }]);
    expect(JSON.stringify(report)).not.toContain("geheim");
    db.close();
  });

  it("läuft ohne Wechselkurse und ohne Token weiter und meldet den Lauf als unvollständig", async () => {
    const db = setup();
    db.saveRawCloses("A.XETRA", [{ date: "2026-11-10", close: 39 }]);
    const { fetchFn, calls } = fakeFetch({ ecbOk: false });

    const report = await runDailySync(db, null, NOW, fetchFn);

    expect(calls).toEqual([]);
    expect(syncSucceeded(report)).toBe(false);
    expect(report.fxError).toContain("500");
    expect(report.priceErrors.map((e) => e.id)).toEqual(["B.US", "A.XETRA"]);
    // Die Bewertung wird trotzdem mit dem letzten bekannten Kurs gespeichert.
    expect(db.latestValuation("A.XETRA")).toMatchObject({ date: "2026-11-19", price: 39 });
    expect(db.latestSyncRun()).toMatchObject({ ok: false });
    db.close();
  });

  it("ergänzt Wechselkurse für Währungen, die die EZB nicht führt", async () => {
    const db = setup();
    db.addStockIfMissing(stock("HSBK.LSE", { reportingCurrency: "KZT", priceCurrency: "USD" }));
    const { fetchFn } = fakeFetch({ extraRates: { KZT: 487.5, USD: 9 } });
    await runDailySync(db, null, NOW, fetchFn);
    expect(db.latestFxRate("KZT")).toBe(487.5);
    // Kurse der EZB werden nicht überschrieben.
    expect(db.latestFxRate("USD")).toBe(1.25);
    db.close();
  });
});

describe("Sammelabruf", () => {
  it("holt die Kurse einer Börse mit vielen Titeln in einem Abruf und den Rest einzeln", async () => {
    const db = setup();
    const many: Record<string, number> = {};
    for (let i = 0; i < 160; i++) {
      db.addStockIfMissing(stock(`T${i}.US`, { watched: false }));
      many[`T${i}.US`] = 10 + i;
    }
    const { fetchFn, calls } = fakeFetch({
      bulk: many,
      closes: { "A.XETRA": [{ date: "2026-11-18", close: 40 }], "B.US": [{ date: "2026-11-18", close: 5 }], "VORRAT.US": [] },
    });

    const report = await runDailySync(db, "geheim", NOW, fetchFn);

    expect(calls.filter((c) => c.startsWith("sammel"))).toEqual(["sammel US"]);
    // B.US und VORRAT.US stehen nicht im Sammelabruf und werden einzeln geholt, A.XETRA ebenso (zu wenige Titel an der Börse).
    expect(
      calls
        .filter((c) => !c.startsWith("sammel"))
        .map((c) => c.split(" ")[0])
        .sort(),
    ).toEqual(["A.XETRA", "B.US", "VORRAT.US"]);
    expect(db.latestPrice("T7.US")).toEqual({ date: "2026-11-18", close: 17 });
    expect(report.pricesLoaded).toBe(163);
    expect(report.budget).toBe(100000 - 2 - 100);
    db.close();
  });
});

describe("Bezugsgrößen", () => {
  it("speichert Anleiherendite und Inflationsprognosen und behält bei einem Ausfall die alten Werte", async () => {
    const db = setup();
    db.addStockIfMissing(stock("HSBK.LSE", { reportingCurrency: "KZT", priceCurrency: "USD" }));
    const first = await runDailySync(db, null, NOW, fakeFetch({ bondYield: 3.41, inflation: { EURO: 2.25, KAZ: 6.55, USA: 2.2 } }).fetchFn);
    expect(first.referenceErrors).toEqual([]);
    expect(db.referenceRate("bond:EUR10Y")).toBeCloseTo(0.0341);
    expect(db.referenceRate("inflation:KZT")).toBeCloseTo(0.0655);
    expect(db.referenceRate("inflation:EUR")).toBeCloseTo(0.0225);

    const second = await runDailySync(db, null, NOW, fakeFetch({}).fetchFn);
    expect(second.referenceErrors).toHaveLength(2);
    expect(db.referenceRate("bond:EUR10Y")).toBeCloseTo(0.0341);
    db.close();
  });
});

describe("looksImplausible", () => {
  it("meldet Rückflüsse und Gewinne, die nicht zum Kurs passen", () => {
    expect(looksImplausible(28.49, 2.12, 2.99)).toBe(false);
    expect(looksImplausible(16.4, 20.03, 2)).toBe(true);
    expect(looksImplausible(10, 0.5, 5)).toBe(true);
    expect(looksImplausible(null, 5, 5)).toBe(false);
    expect(looksImplausible(10, undefined, null)).toBe(false);
  });
});
