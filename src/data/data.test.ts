import { describe, expect, it } from "vitest";
import { Database, expectedFiscalYear, type FundamentalsYear } from "./db.ts";
import { parseEcbRates } from "./ecb.ts";
import { parseFundamentalsCsv } from "./fundamentalsCsv.ts";
import { START_WATCHLIST } from "./seed.ts";

function emptyDatabase(): Database {
  const db = new Database(":memory:");
  START_WATCHLIST.forEach((s) => {
    db.addStockIfMissing(s);
  });
  return db;
}

describe("Datenbank", () => {
  it("legt die Start-Watchlist an und überschreibt vorhandene Stammdaten nicht", () => {
    const db = emptyDatabase();
    db.addStockIfMissing({ ...START_WATCHLIST[0]!, name: "geändert" });
    expect(db.stocks()).toHaveLength(6);
    expect(db.stocks().find((s) => s.id === "IMB.LSE")!.name).toBe("Imperial Brands");
    expect(db.stocks().find((s) => s.id === "HSBK.LSE")!.isFinancial).toBe(true);
  });

  it("rechnet Londoner Kurse von Pence in Pfund um und liefert den jüngsten Kurs", () => {
    const db = emptyDatabase();
    db.saveRawCloses("IMB.LSE", [
      { date: "2026-11-17", close: 2800 },
      { date: "2026-11-18", close: 2849 },
    ]);
    db.saveRawCloses("IMB.LSE", [{ date: "2026-11-18", close: 2850 }]);
    expect(db.latestPrice("IMB.LSE")).toEqual({ date: "2026-11-18", close: 28.5 });
    expect(db.latestPrice("BAS.XETRA")).toBeNull();
  });

  it("speichert Wechselkurse und kennt den Euro ohne Eintrag", () => {
    const db = emptyDatabase();
    db.saveFxRates("2026-11-18", { USD: 1.1, GBP: 0.85 });
    expect(db.latestFxRate("GBP")).toBe(0.85);
    expect(db.latestFxRate("EUR")).toBe(1);
    expect(db.latestFxRate("KZT")).toBeNull();
  });

  it("speichert Fundamentaldaten je Geschäftsjahr und ersetzt ein Jahr beim erneuten Import", () => {
    const db = emptyDatabase();
    const [y2024, y2025] = parseFundamentalsCsv("fiscal_year,eps_diluted\n2024,4.96\n2025,6.74");
    db.saveFundamentals("BAS.XETRA", [y2024!, y2025!], "csv");
    db.saveFundamentals("BAS.XETRA", [{ ...(y2025 as FundamentalsYear), epsDiluted: 5 }], "manuell");
    const stored = db.fundamentals("BAS.XETRA");
    expect(stored.map((y) => [y.fiscalYear, y.epsDiluted])).toEqual([
      [2024, 4.96],
      [2025, 5],
    ]);
    expect(stored[0]!.revenue).toBeNull();
  });
});

describe("EZB-Kurse", () => {
  it("liest Datum und Kurse aus dem XML", () => {
    const xml = `<Cube><Cube time='2026-11-18'><Cube currency='USD' rate='1.0892'/><Cube currency='GBP' rate='0.8431'/></Cube></Cube>`;
    expect(parseEcbRates(xml)).toEqual({ date: "2026-11-18", perEur: { USD: 1.0892, GBP: 0.8431 } });
    expect(() => parseEcbRates("<Cube/>")).toThrow();
  });
});

describe("CSV-Import", () => {
  it("liest Komma-CSV mit leeren Zellen", () => {
    const rows = parseFundamentalsCsv("fiscal_year,eps_diluted,total_assets\n2024,1.5,\n2025,2.25,1000");
    expect(rows[0]).toMatchObject({ fiscalYear: 2024, epsDiluted: 1.5, totalAssets: null, revenue: null });
    expect(rows[1]).toMatchObject({ fiscalYear: 2025, totalAssets: 1000 });
  });

  it("liest Semikolon-CSV mit Dezimalkomma und Tausenderpunkt", () => {
    const rows = parseFundamentalsCsv("fiscal_year;eps_diluted;revenue\n2025;2,25;1.234.567,5");
    expect(rows[0]).toMatchObject({ epsDiluted: 2.25, revenue: 1234567.5 });
  });

  it("weist unbekannte Spalten, doppelte Jahre und Nichtzahlen zurück", () => {
    expect(() => parseFundamentalsCsv("fiscal_year,gewinn\n2025,1")).toThrow(/Unbekannte Spalte/);
    expect(() => parseFundamentalsCsv("fiscal_year,eps_diluted\n2025,1\n2025,2")).toThrow(/doppelt/);
    expect(() => parseFundamentalsCsv("fiscal_year,eps_diluted\n2025,abc")).toThrow(/keine Zahl/);
    expect(() => parseFundamentalsCsv("eps_diluted\n1")).toThrow(/fiscal_year/);
  });
});

describe("Rohantworten", () => {
  it("bewahrt je Aktie und Art die jüngste Antwort auf", () => {
    const db = emptyDatabase();
    db.saveRawDocument("BAS.XETRA", "eodhd-fundamentals", '{"a":1}');
    db.saveRawDocument("BAS.XETRA", "eodhd-fundamentals", '{"a":2}');
    expect(db.rawDocument("BAS.XETRA", "eodhd-fundamentals")!.body).toBe('{"a":2}');
    expect(db.rawDocument("IMB.LSE", "eodhd-fundamentals")).toBeNull();
  });

  it("erwartet das Vorjahr erst nach der Berichtssaison", () => {
    expect(expectedFiscalYear("2027-01-15")).toBe(2025);
    expect(expectedFiscalYear("2027-05-31")).toBe(2025);
    expect(expectedFiscalYear("2027-06-01")).toBe(2026);
    const db = emptyDatabase();
    db.saveRawDocument("IMB.LSE", "eodhd-fundamentals", "{}");
    db.saveFundamentals("IMB.LSE", parseFundamentalsCsv("fiscal_year,eps_diluted\n2025,5"), "eodhd");
    // Im Januar fehlt 2026 noch überall: nicht veraltet. Im Juni schon.
    expect(db.staleFundamentals("eodhd-fundamentals", "2027-01-15")).toEqual([]);
    expect(db.staleFundamentals("eodhd-fundamentals", "2027-06-15")).toEqual(["IMB.LSE"]);
  });

  it("blättert im Datenvorrat und zählt, warum Renditen fehlen", () => {
    const db = emptyDatabase();
    const ids = START_WATCHLIST.map((stock) => stock.id);
    const row = (stockId: string, values: Partial<Parameters<Database["saveScreening"]>[0][number]>) => ({
      stockId,
      date: "2026-11-18",
      priceDate: "2026-11-18",
      price: 10,
      payoutLevel: 1,
      growth: 0.05,
      riskScore: 0.1,
      innerReturn: null,
      implausible: false,
      ...values,
    });
    db.saveScreening([
      row(ids[0]!, { innerReturn: 0.12 }),
      row(ids[1]!, { innerReturn: 0.08 }),
      row(ids[2]!, { innerReturn: 0.05 }),
      row(ids[3]!, { price: null }),
      row(ids[4]!, { payoutLevel: 0 }),
      row(ids[5]!, { growth: null }),
    ]);

    expect(db.countScreening({})).toBe(3);
    expect(db.screening({}, 2).map((r) => r.stock.id)).toEqual([ids[0], ids[1]]);
    expect(db.screening({}, 2, 2).map((r) => r.stock.id)).toEqual([ids[2]]);

    db.recordPriceFailure(ids[3]!, "HTTP 404", "2026-11-18");
    expect(db.ratingGaps({})).toEqual({
      "kurs-nicht-abrufbar": 1,
      "kein-kurs": 0,
      "rueckfluss-fehlt": 0,
      "rueckfluss-null": 1,
      "wachstum-fehlt": 1,
      "keine-loesung": 0,
    });
    expect(db.unrated("rueckfluss-null", {}, 10).map((r) => r.stock.id)).toEqual([ids[4]]);
    expect(db.unrated("kurs-nicht-abrufbar", {}, 10).map((r) => r.stock.id)).toEqual([ids[3]]);
    expect(db.unrated("kein-kurs", {}, 10)).toEqual([]);
  });
});
