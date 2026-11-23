import { describe, expect, it } from "vitest";
import { parseDelistedLines, selectDelisted } from "./delisted.ts";

const line = (code: string, lastDate: string, close: number, volume: number | null, months = 14, extra: object = {}) =>
  JSON.stringify({
    code,
    name: `${code} Inc`,
    exchange: "NYSE",
    isin: null,
    bars: Array.from({ length: months }, (_, i) => [
      i === months - 1 ? lastDate : `2015-${String((i % 12) + 1).padStart(2, "0")}-28`,
      close,
      null,
      volume,
    ]),
    ...extra,
  });

describe("parseDelistedLines", () => {
  it("liest Symbol, letzten Kurstag, Umsatz der letzten zwölf Monate und setzt den bereinigten Kurs ein", () => {
    const [c] = parseDelistedLines(line("AAA", "2020-05-29", 10, 2_000_000));
    expect(c).toMatchObject({ id: "AAA.US", name: "AAA Inc", lastDate: "2020-05-29", turnover: 20_000_000 });
    expect(c!.bars[0]).toEqual({ date: "2015-01-28", close: 10, adjustedClose: 10 });
  });

  it("zählt fehlendes Volumen als 0 und lässt Titel ohne Kurse weg", () => {
    const text = [line("NOVOL", "2020-01-31", 10, null), line("EMPTY", "2020-01-31", 1, 1, 0)].join("\n");
    const result = parseDelistedLines(text);
    expect(result.map((c) => c.id)).toEqual(["NOVOL.US"]);
    expect(result[0]!.turnover).toBe(0);
  });

  it("wirft mit Zeilennummer bei Zeilen in fremder Form", () => {
    expect(() => parseDelistedLines(`${line("OK", "2020-01-31", 1, 1)}\n{"code":"X"}`)).toThrow("Zeile 2");
    expect(() =>
      parseDelistedLines(JSON.stringify({ code: "X", name: "", exchange: "", isin: null, bars: [["kein Datum", 1, 1, 1]] })),
    ).toThrow("Zeile 1");
  });
});

describe("selectDelisted", () => {
  const all = parseDelistedLines(
    [
      line("BIG", "2021-03-31", 100, 1_000_000), // 100 Mio.
      line("MID", "2019-03-31", 10, 1_000_000), // 10 Mio.
      line("OLD", "2014-03-31", 100, 1_000_000), // zu früh beendet
      line("SMALL", "2022-03-31", 1, 1_000_000), // 1 Mio.
      line("SHORT", "2022-03-31", 100, 1_000_000, 6), // zu kurze Reihe
    ].join("\n"),
  );

  it("wählt nach Ende der Reihe, Umsatz und Länge und ordnet nach fallendem Umsatz", () => {
    const ids = (min: number, max?: number) =>
      selectDelisted(all, { endedSince: "2016-01-01", minTurnover: min, maxTurnover: max }).map((c) => c.id);
    expect(ids(0)).toEqual(["BIG.US", "MID.US", "SMALL.US"]);
    expect(ids(10e6)).toEqual(["BIG.US", "MID.US"]);
    // Obergrenze ausschließlich: Stufen überschneiden sich nicht.
    expect(ids(10e6, 100e6)).toEqual(["MID.US"]);
    expect(selectDelisted(all, { endedSince: "2016-01-01", minTurnover: 0, minMonths: 6 }).map((c) => c.id)).toContain("SHORT.US");
  });
});
