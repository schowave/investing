import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Database } from "../data/db.ts";
import { FUNDAMENTALS_KIND as RAW_KIND } from "../data/eodhdSnapshot.ts";
import { fakeEodhd, fundamentalsAnswer, status, testContext } from "../test/eodhd.ts";
import { steadyYears, stock } from "../test/fixtures.ts";
import { consoleContext, eachParallel, reason, requireToken } from "./context.ts";
import { ingestFundamentals, refreshFundamentals, refreshStock } from "./fundamentals.ts";
import { historyTodo, loadHistory } from "./history.ts";
import { estimateHistory, estimateRefresh, isJobKind, runJob } from "./registry.ts";
import { addByIsin, failedIsinsSince, importStockpile, isinsIn, reparseArchive } from "./stockpile.ts";

const fresh = () => {
  const db = new Database(":memory:");
  db.addStockIfMissing(stock);
  return db;
};

describe("Kontext", () => {
  it("verlangt einen Token und nennt Gründe ohne ihn", async () => {
    const { ctx } = testContext(fresh(), fakeEodhd({}), { token: null });
    expect(() => requireToken(ctx)).toThrow(/EODHD_API_TOKEN fehlt/);
    const { EodhdError } = await import("../data/eodhd.ts");
    expect(reason(new EodhdError(402, "x"))).toMatch(/Tageslimit/);
    expect(reason(new EodhdError(403, "x"))).toMatch(/Tarif/);
    expect(reason("text")).toBe("text");
    const cli = consoleContext(fresh());
    expect(cli.shouldStop()).toBe(false);
    cli.progress(1, 2);
  });

  it("hört bei Abbruch und am Tageslimit auf", async () => {
    const { EodhdError } = await import("../data/eodhd.ts");
    let stop = false;
    const { ctx, log } = testContext(fresh(), fakeEodhd({}), { shouldStop: () => stop });
    const seen: number[] = [];
    const stopped = await eachParallel(ctx, [1, 2, 3], 1, async (n) => {
      seen.push(n);
      stop = n === 2;
    });
    expect(stopped).toMatchObject({ done: 2, stopped: true });
    expect(log.at(-1)).toMatch(/Abgebrochen nach 2 von 3/);
    stop = false;
    const limited = await eachParallel(ctx, [1, 2, 3], 1, async (n) => {
      if (n === 2) throw new EodhdError(402, "x");
    });
    expect(limited).toMatchObject({ done: 1, limitReached: true });
  });
});

describe("Fundamentaldaten", () => {
  it("lädt Abschlüsse, bewahrt die Rohantwort und meldet Fehler je Aktie", async () => {
    const db = fresh();
    db.addStockIfMissing({ ...stock, id: "KAPUTT.US" });
    const fetchFn = fakeEodhd({ "fundamentals/TEST.US": fundamentalsAnswer(), "fundamentals/KAPUTT.US": status(500) });
    const { ctx, log } = testContext(db, fetchFn);
    const result = await refreshFundamentals(ctx, db.stocks());
    expect(result).toEqual({ summary: "1 von 2 Aktien geladen, 1 fehlgeschlagen", ok: false });
    expect(db.fundamentals("TEST.US").map((y) => y.fiscalYear)).toEqual([2023, 2024, 2025]);
    expect(db.rawDocument("TEST.US", RAW_KIND)).not.toBeNull();
    expect(log.join("\n")).toMatch(/Währung USD statt EUR/);

    const archive = await refreshFundamentals(testContext(db, fakeEodhd({}), { token: null }).ctx, [db.stock("TEST.US")!], true);
    expect(archive.ok).toBe(true);
    expect((await refreshFundamentals(ctx, [db.stock("KAPUTT.US")!], true)).ok).toBe(false);
  });

  it("hört am Tageslimit und bei Abbruch auf", async () => {
    const db = fresh();
    const limited = await refreshFundamentals(testContext(db, fakeEodhd({ "*": status(402) })).ctx, db.stocks());
    expect(limited.summary).toMatch(/Tageslimit/);
    const stopped = await refreshFundamentals(testContext(db, fakeEodhd({}), { shouldStop: () => true }).ctx, db.stocks());
    expect(stopped.summary).toMatch(/abgebrochen/);
  });

  it("aktualisiert eine Aktie samt Historie und Bewertung", async () => {
    const db = fresh();
    const fetchFn = fakeEodhd({
      "fundamentals/TEST.US": fundamentalsAnswer(),
      "div/TEST.US": [{ date: "2025-05-02", value: 2, currency: "USD" }],
      "splits/TEST.US": [],
      "eod/TEST.US": [{ date: "2025-01-31", close: 40 }],
    });
    const result = await refreshStock(testContext(db, fetchFn).ctx, "TEST.US");
    expect(result.ok).toBe(true);
    expect(db.dividends("TEST.US")).toHaveLength(1);
    expect(db.latestValuation("TEST.US")?.date).toBe("2026-11-19");

    // Ohne Kurs-Tarif fehlt nur die Historie, die Aktualisierung gelingt trotzdem.
    const { ctx, log } = testContext(db, fakeEodhd({ "fundamentals/TEST.US": fundamentalsAnswer(), "div/*": status(403) }));
    expect((await refreshStock(ctx, "TEST.US")).ok).toBe(true);
    expect(log.join("\n")).toMatch(/Historie: HTTP 403/);
    await expect(refreshStock(ctx, "FEHLT.US")).rejects.toThrow(/Unbekannte Aktie/);
    expect((await refreshStock(testContext(db, fakeEodhd({ "*": status(500) })).ctx, "TEST.US")).ok).toBe(false);
  });
});

describe("Historie", () => {
  const all = { refresh: false, scope: "alle", monthly: true } as const;

  it("lädt nur Fehlendes, Watchlist zuerst, und setzt nach dem Tageslimit fort", async () => {
    const db = fresh();
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    expect(historyTodo({ db }, all).map((t) => t.id)).toEqual(["TEST.US", "TEST.US", "TEST.US", "VORRAT.US", "VORRAT.US", "VORRAT.US"]);
    let calls = 0;
    const limited = fakeEodhd({ "*": () => (++calls > 2 ? new Response("", { status: 402 }) : Response.json([])) });
    const first = await loadHistory(testContext(db, limited).ctx, all);
    expect(first.summary).toMatch(/Rest offen/);
    expect(historyTodo({ db }, all).length).toBeLessThan(6);
    expect(historyTodo({ db }, { ...all, refresh: true })).toHaveLength(6);
  });

  it("lädt ohne Monatskurse und nur für den gewählten Umfang", () => {
    const db = fresh();
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    db.addStockIfMissing({ ...stock, id: "RECHENBAR.US", watched: false });
    db.saveScreening([
      {
        stockId: "RECHENBAR.US",
        date: "2026-11-18",
        priceDate: "2026-11-18",
        price: 10,
        payoutLevel: 1,
        growth: 0.05,
        riskScore: 0.1,
        innerReturn: 0.1,
        implausible: false,
      },
    ]);
    const ids = (scope: "watchlist" | "rechenbar" | "alle") =>
      historyTodo({ db }, { refresh: false, scope, monthly: false }).map((t) => `${t.id} ${t.kind}`);
    expect(ids("watchlist")).toEqual(["TEST.US dividends", "TEST.US splits"]);
    expect(ids("rechenbar")).toEqual(["TEST.US dividends", "TEST.US splits", "RECHENBAR.US dividends", "RECHENBAR.US splits"]);
    expect(ids("alle")).toHaveLength(6);
  });

  it("lässt die Reserve für den nächtlichen Abgleich übrig", async () => {
    const db = fresh();
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    // 100.000 Abrufe am Tag, 96.998 verbraucht: Nach der Reserve von 3.000 bleiben 2 Abrufe.
    const fetchFn = fakeEodhd({
      user: { dailyRateLimit: 100_000, apiRequests: 96_998, subscriptionType: "all-in-one" },
      "*": [],
    });
    const { ctx, log } = testContext(db, fetchFn);
    const result = await loadHistory(ctx, { refresh: false, scope: "alle", monthly: false });
    expect(fetchFn.calls).toHaveLength(2);
    expect(result.summary).toMatch(/Rest offen/);
    expect(log.join("\n")).toMatch(/Reserve|nächtlichen Abgleich/);
  });
});

describe("Datenvorrat", () => {
  it("lädt Bestandteile eines Index und weicht bei fehlender Heimatbörse aus", async () => {
    const db = fresh();
    const fetchFn = fakeEodhd({
      "fundamentals/TEST.INDX": {
        Components: { 0: { Code: "NEU", Exchange: "US", Name: "Neu Corp" }, 1: { Code: "ISP", Exchange: "MI", Name: "Intesa Sanpaolo" } },
      },
      "fundamentals/NEU.US": fundamentalsAnswer("Neu Corp"),
      "fundamentals/ISP.MI": status(404),
      "search/*": [{ Code: "IES", Exchange: "XETRA", Name: "Intesa Sanpaolo", Type: "Common Stock" }],
      "fundamentals/IES.XETRA": fundamentalsAnswer("Intesa Sanpaolo"),
      "exchange-symbol-list/IL": [
        { Code: "KAP", Name: "Kaspi", Type: "Common Stock" },
        { Code: "X", Name: "Fonds", Type: "ETF" },
      ],
      "fundamentals/KAP.IL": status(401),
    });
    const { ctx, log } = testContext(db, fetchFn);
    const result = await importStockpile(ctx, { indices: ["TEST.INDX"], symbols: [], exchanges: ["IL"], refreshAll: false, watch: false });
    expect(result).toEqual({ summary: "2 Aktien geladen, 1 fehlgeschlagen", ok: false });
    expect(db.stock("NEU.US")).toMatchObject({
      name: "Neu Corp",
      watched: false,
      region: "Nordamerika",
      gicSector: "Information Technology",
    });
    expect(db.stock("IES.XETRA")).not.toBeNull();
    expect(log.join("\n")).toMatch(/ersatz ISP.MI/);
    expect(reparseArchive(ctx)).toEqual({ summary: "2 Aktien aus dem Archiv neu ausgewertet", ok: true });
  });

  it("markiert ausländische Aktien in Buenos Aires als CEDEAR, damit das Screening sie auslässt", () => {
    const db = fresh();
    const answer = (name: string, country: string) =>
      JSON.stringify({ ...fundamentalsAnswer(name), General: { ...fundamentalsAnswer(name).General, AddressData: { Country: country } } });
    ingestFundamentals(db, "WMT.BA", answer("Walmart", "United States"), { keepRaw: false });
    ingestFundamentals(db, "GGAL.BA", answer("Galicia", "Argentina"), { keepRaw: false });
    const listed = db.coverage().filter((r) => r.exchange === "BA");
    expect(listed).toEqual([expect.objectContaining({ country: "AR", stocks: 1 })]);
  });

  it("nimmt Symbole und ISINs auf die Watchlist", async () => {
    const db = fresh();
    const fetchFn = fakeEodhd({
      "fundamentals/NEU.US": fundamentalsAnswer("Neu Corp"),
      "search/US0000000001": [
        { Code: "ALT", Exchange: "F", Name: "Isin Corp", Type: "Common Stock", ISIN: "US0000000001", isPrimary: false },
        {
          Code: "ISN",
          Exchange: "US",
          Name: "Isin Corp",
          Type: "Common Stock",
          ISIN: "US0000000001",
          isPrimary: true,
          previousClose: 12,
          previousCloseDate: "2026-11-18",
        },
      ],
      "fundamentals/ISN.US": fundamentalsAnswer("Isin Corp"),
      "search/GB0000000002": [],
    });
    const { ctx } = testContext(db, fetchFn);
    const symbols = await importStockpile(ctx, { indices: [], symbols: ["NEU.US"], exchanges: [], refreshAll: false, watch: true });
    expect(symbols.ok).toBe(true);
    expect(db.stock("NEU.US")!.watched).toBe(true);

    expect(isinsIn("Pos. us0000000001 Stück 5; GB0000000002, US0000000001")).toEqual(["US0000000001", "GB0000000002"]);
    const isins = await addByIsin(ctx, ["US0000000001", "GB0000000002"]);
    expect(isins).toEqual({ summary: "1 von 2 Titeln aufgenommen, 1 fehlgeschlagen", ok: false });
    expect(db.stock("ISN.US")).toMatchObject({ watched: true });
    expect(db.latestPrice("ISN.US")).toEqual({ date: "2026-11-18", close: 12 });
    // Schon gespeichert: kein neuer Abruf der Fundamentaldaten.
    const again = fakeEodhd({
      "search/US0000000001": [{ Code: "ISN", Exchange: "US", Name: "Isin Corp", Type: "Common Stock", ISIN: "US0000000001" }],
    });
    expect((await addByIsin(testContext(db, again).ctx, ["US0000000001"])).ok).toBe(true);
    expect(again.calls).toEqual(["search/US0000000001"]);
    expect((await addByIsin(testContext(db, fakeEodhd({}), { shouldStop: () => true }).ctx, ["US0000000001"])).summary).toMatch(
      /abgebrochen/,
    );
    expect((await addByIsin(testContext(db, fakeEodhd({ "*": status(402) })).ctx, ["DE0000000003"])).summary).toMatch(/Tageslimit/);
  });

  it("frischt alle gespeicherten Titel auf", async () => {
    const db = fresh();
    db.saveRawDocument("TEST.US", RAW_KIND, JSON.stringify(fundamentalsAnswer()));
    const fetchFn = fakeEodhd({ "fundamentals/TEST.US": fundamentalsAnswer() });
    const result = await runJob(testContext(db, fetchFn).ctx, "refresh-all", {});
    expect(result.ok).toBe(true);
    expect(fetchFn.calls).toEqual(["fundamentals/TEST.US"]);
  });

  it("nimmt einzelne Titel auch bei knappem Budget auf, große Läufe nicht", async () => {
    const db = fresh();
    // Kleiner Tarif: weit unter der Reserve für den Abgleich.
    const routes = {
      user: { dailyRateLimit: 100, apiRequests: 0, subscriptionType: "free" },
      "fundamentals/*": fundamentalsAnswer("Neu Corp"),
    };
    const added = fakeEodhd(routes);
    const result = await runJob(testContext(db, added).ctx, "add-stocks", { isins: [], symbols: ["NEU.US"] });
    expect(result.ok).toBe(true);
    expect(added.calls).toEqual(["fundamentals/NEU.US"]);

    const refreshed = fakeEodhd(routes);
    const capped = await runJob(testContext(db, refreshed).ctx, "refresh-all", { scope: "alle" });
    expect(refreshed.calls).toEqual([]);
    expect(capped).toMatchObject({ ok: false, summary: expect.stringMatching(/Rest offen/) });
  });

  it("frischt nur Watchlist und Bestand auf, wenn so gewählt", async () => {
    const db = fresh();
    db.addStockIfMissing({ ...stock, id: "VORRAT.US", watched: false });
    db.saveRawDocument("TEST.US", RAW_KIND, JSON.stringify(fundamentalsAnswer()));
    db.saveRawDocument("VORRAT.US", RAW_KIND, JSON.stringify(fundamentalsAnswer()));
    const fetchFn = fakeEodhd({ "fundamentals/*": fundamentalsAnswer() });
    const result = await runJob(testContext(db, fetchFn).ctx, "refresh-all", { scope: "watchlist" });
    expect(result.ok).toBe(true);
    expect(fetchFn.calls).toEqual(["fundamentals/TEST.US"]);
  });
});

describe("Fundamentaldaten aufnehmen", () => {
  const described = () => ({
    ...fundamentalsAnswer("Gleich Corp"),
    General: { ...fundamentalsAnswer().General, Name: "Gleich Corp", Description: "Founded in 1901 in Ohio." },
  });

  it("legt auf jedem Weg dieselben Stammdaten an", async () => {
    const answer = described();
    const viaSymbol = new Database(":memory:");
    await importStockpile(testContext(viaSymbol, fakeEodhd({ "fundamentals/GLC.US": answer })).ctx, {
      indices: [],
      symbols: ["GLC.US"],
      exchanges: [],
      refreshAll: false,
      watch: false,
    });
    const viaIsin = new Database(":memory:");
    const search = [{ Code: "GLC", Exchange: "US", Name: "Gleich Corp", Type: "Common Stock", ISIN: "US0000000009" }];
    await addByIsin(testContext(viaIsin, fakeEodhd({ "search/US0000000009": search, "fundamentals/GLC.US": answer })).ctx, [
      "US0000000009",
    ]);
    // Schon bekannt, aber ohne Gründungsjahr und Wertpapierart: Das Auffrischen trägt beides nach.
    const viaRefresh = new Database(":memory:");
    viaRefresh.addStockIfMissing({ ...stock, id: "GLC.US", name: "Gleich Corp", watched: false, foundedYear: null });
    await refreshFundamentals(testContext(viaRefresh, fakeEodhd({ "fundamentals/GLC.US": answer })).ctx, [viaRefresh.stock("GLC.US")!]);

    const row = (db: Database) => {
      const { watched: _, ...rest } = db.stock("GLC.US")!;
      return rest;
    };
    expect(row(viaSymbol)).toMatchObject({ foundedYear: 1901, country: "US", region: "Nordamerika" });
    expect(row(viaIsin)).toEqual(row(viaSymbol));
    expect(row(viaRefresh)).toMatchObject({ foundedYear: 1901, country: "US", region: "Nordamerika" });
  });

  it("behält beim Auffrischen die Abschlüsse, wenn die Antwort keine enthält, und lädt die Historie trotzdem", async () => {
    const db = fresh();
    db.saveFundamentals("TEST.US", steadyYears(), "eodhd");
    const fetchFn = fakeEodhd({
      "fundamentals/TEST.US": fundamentalsAnswer("Test", []),
      "div/TEST.US": [{ date: "2025-05-02", value: 2, currency: "USD" }],
      "splits/TEST.US": [],
      "eod/TEST.US": [],
    });
    const { ctx, log } = testContext(db, fetchFn);
    expect((await refreshStock(ctx, "TEST.US")).ok).toBe(true);
    expect(log.join("\n")).toMatch(/keine Jahresabschlüsse/);
    expect(db.fundamentals("TEST.US")).toHaveLength(10);
    expect(db.dividends("TEST.US")).toHaveLength(1);
  });

  it("nimmt aus Index und Börse nur Einträge in erwarteter Form", async () => {
    const db = new Database(":memory:");
    const fetchFn = fakeEodhd({
      "fundamentals/TEST.INDX": { Components: { "0": { Code: "GUT", Exchange: "US", Name: "Gut" }, "1": { Code: 5, Exchange: "US" } } },
      "exchange-symbol-list/XX": [{ Code: null }, { Code: "B", Name: "B", Type: "Common Stock" }],
      "fundamentals/GUT.US": fundamentalsAnswer("Gut"),
      "fundamentals/B.XX": fundamentalsAnswer("B"),
    });
    const { ctx, log } = testContext(db, fetchFn);
    const result = await importStockpile(ctx, { indices: ["TEST.INDX"], symbols: [], exchanges: ["XX"], refreshAll: false, watch: false });
    expect(result.ok).toBe(true);
    expect(log).toEqual(expect.arrayContaining(["TEST.INDX: 1 Bestandteile", "Börse XX: 1 Stammaktien"]));
    expect(db.stock("GUT.US")).not.toBeNull();
    expect(db.stock("B.XX")).not.toBeNull();
  });

  it("überspringt bei einer ISIN Notizen ohne Jahresabschlüsse", async () => {
    const db = new Database(":memory:");
    const search = [
      { Code: "LEER", Exchange: "US", Name: "Gleich Corp", Type: "Common Stock", ISIN: "US0000000009", isPrimary: true },
      { Code: "GLC", Exchange: "F", Name: "Gleich Corp", Type: "Common Stock", ISIN: "US0000000009" },
    ];
    const fetchFn = fakeEodhd({
      "search/US0000000009": search,
      "fundamentals/LEER.US": fundamentalsAnswer("Leer", []),
      "fundamentals/GLC.F": described(),
    });
    expect((await addByIsin(testContext(db, fetchFn).ctx, ["US0000000009"])).ok).toBe(true);
    expect(db.stock("LEER.US")).toBeNull();
    expect(db.stock("GLC.F")?.watched).toBe(true);
  });
});

describe("Registry", () => {
  it("prüft Parameter und schätzt Abrufe", async () => {
    const db = fresh();
    const { ctx } = testContext(db, fakeEodhd({}));
    expect(isJobKind("sync")).toBe(true);
    expect(isJobKind("toString")).toBe(false);
    await expect(runJob(ctx, "add-stocks", { isins: [], symbols: [] })).rejects.toThrow(/mindestens eine/);
    await expect(runJob(ctx, "index-import", { indices: ["GSPC"], exchanges: [] })).rejects.toThrow();
    expect(estimateHistory(db, { refresh: false, scope: "watchlist", monthly: false })).toBe(2);
    expect(estimateHistory(db, { refresh: false, scope: "watchlist", monthly: true })).toBe(3);
    expect(estimateRefresh(db, "alle", "2026-11-19")).toBe(0);
    db.saveRawDocument("TEST.US", RAW_KIND, "{}");
    expect(estimateRefresh(db, "watchlist", "2026-11-19")).toBe(10);
    // Gerade erst geladen: nicht veraltet, auch wenn das jüngste Geschäftsjahr fehlt.
    expect(estimateRefresh(db, "veraltet", "2026-11-19")).toBe(0);
    expect(estimateRefresh(db, "veraltet", "2027-06-01")).toBe(10);
  });

  it("nimmt Titel über ISIN und Symbol in einem Lauf auf", async () => {
    const db = fresh();
    const fetchFn = fakeEodhd({
      "search/US0000000001": [{ Code: "ISN", Exchange: "US", Name: "Isin Corp", Type: "Common Stock", ISIN: "US0000000001" }],
      "fundamentals/ISN.US": fundamentalsAnswer("Isin Corp"),
      "fundamentals/NEU.US": fundamentalsAnswer("Neu Corp"),
    });
    const result = await runJob(testContext(db, fetchFn).ctx, "add-stocks", { isins: ["US0000000001"], symbols: ["neu.us"] });
    expect(result.ok).toBe(true);
    expect(db.stocks().map((s) => s.id)).toEqual(["ISN.US", "NEU.US", "TEST.US"]);
    expect(db.stockIdsByIsin(["US0000000001"])).toEqual(new Map([["US0000000001", ["ISN.US"]]]));
  });

  it("merkt ISINs, deren Aufnahme scheitert, und vergisst sie, sobald sie gelingt", async () => {
    const db = fresh();
    await addByIsin(testContext(db, fakeEodhd({ "search/DE0000000005": [] })).ctx, ["DE0000000005"]);
    expect(failedIsinsSince(db, "2000-01-01")).toEqual(new Set(["DE0000000005"]));
    expect(failedIsinsSince(db, "2999-01-01")).toEqual(new Set());
    const found = fakeEodhd({
      "search/DE0000000005": [{ Code: "ISN", Exchange: "US", Name: "Isin Corp", Type: "Common Stock", ISIN: "DE0000000005" }],
      "fundamentals/ISN.US": fundamentalsAnswer("Isin Corp"),
    });
    await addByIsin(testContext(db, found).ctx, ["DE0000000005"], { watch: false });
    expect(failedIsinsSince(db, "2000-01-01")).toEqual(new Set());
    // Ein vorübergehender Fehler des Anbieters sperrt die ISIN nicht.
    await addByIsin(testContext(db, fakeEodhd({ "search/DE0000000006": status(503) })).ctx, ["DE0000000006"]);
    expect(failedIsinsSince(db, "2000-01-01")).toEqual(new Set());
    db.setSetting("isins-ohne-notiz", "kein json");
    expect(failedIsinsSince(db, "2000-01-01")).toEqual(new Set());
  });

  it("nimmt Positionen aus dem Depot in den Datenvorrat auf, nicht auf die Watchlist, und merkt die ISIN", async () => {
    const db = fresh();
    const fetchFn = fakeEodhd({
      "search/US0000000001": [{ Code: "ISN", Exchange: "US", Name: "Isin Corp", Type: "Common Stock", ISIN: "US0000000001" }],
      "fundamentals/ISN.US": { ...fundamentalsAnswer("Isin Corp"), General: { ...fundamentalsAnswer().General, ISIN: " us0000000002 " } },
    });
    const result = await runJob(testContext(db, fetchFn).ctx, "add-stocks", { isins: ["US0000000001"], symbols: [], watch: false });
    expect(result.ok).toBe(true);
    expect(db.stock("ISN.US")!.watched).toBe(false);
    // Die gesuchte ISIN gewinnt vor der aus den Stammdaten; die aus den Stammdaten wird beim Einlesen gesäubert.
    expect(db.stockIdsByIsin(["US0000000001", "US0000000002"])).toEqual(new Map([["US0000000001", ["ISN.US"]]]));
    db.setIsin("ISN.US", "US0000000002");
    expect(db.stockIdsByIsin([])).toEqual(new Map());
  });
});

describe("Abgleich als Lauf", () => {
  let dir = "";
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("sichert zuerst und fasst den Bericht zusammen", async () => {
    dir = mkdtempSync(join(tmpdir(), "investing-sync-"));
    vi.stubEnv("INVESTING_BACKUPS", dir);
    vi.stubEnv("INVESTING_BACKUP_KEEP", "2");
    const db = fresh();
    // Ohne Token: nur Wechselkurse und Bezugsgrößen, die hier alle scheitern.
    const { ctx, log } = testContext(db, fakeEodhd({}), { token: null });
    ctx.fetchFn = (async () => new Response("", { status: 503 })) as typeof fetch;
    const result = await runJob(ctx, "sync", {});
    expect(readdirSync(dir)).toEqual(["investing-2026-11-19.sqlite"]);
    expect(log.join("\n")).toMatch(/EODHD_API_TOKEN fehlt/);
    expect(log.join("\n")).toMatch(/Wechselkurse nicht geladen/);
    expect(result).toMatchObject({ ok: false, summary: expect.stringContaining("Wechselkurse fehlen") });
  });
});
