import { describe, expect, it } from "vitest";
import { fetchEcbRates, parseEcbRates, rateAt } from "./rates.ts";

const csv = [
  "KEY,FREQ,TIME_PERIOD,OBS_VALUE,TITLE_COMPL",
  'YC.x,B,2016-01-05,0.70,"Euro area, Government bond"',
  'YC.x,B,2016-01-04,-0.10,"Euro area, Government bond"',
  'YC.x,B,2016-01-06,,"Euro area, Government bond"',
].join("\n");

describe("parseEcbRates", () => {
  it("liest Prozent als Anteil, sortiert und überspringt leere Werte", () => {
    const series = parseEcbRates(csv);
    expect(series.map((p) => p.date)).toEqual(["2016-01-04", "2016-01-05"]);
    expect(series[0]!.rate).toBeCloseTo(-0.001, 10);
    expect(series[1]!.rate).toBeCloseTo(0.007, 10);
  });
  it("wirft bei fehlenden Spalten, Datenmüll und leerer Reihe", () => {
    expect(() => parseEcbRates("a,b\n1,2")).toThrow("unerwartete");
    expect(() => parseEcbRates("TIME_PERIOD,OBS_VALUE\nheute,1")).toThrow();
    expect(() => parseEcbRates("TIME_PERIOD,OBS_VALUE")).toThrow("keine Werte");
  });
});

describe("rateAt", () => {
  const series = parseEcbRates(csv);
  it("nimmt den letzten Wert am Tag oder davor", () => {
    expect(rateAt(series, "2016-01-05")).toBeCloseTo(0.007, 10);
    expect(rateAt(series, "2016-01-09")).toBeCloseTo(0.007, 10);
  });
  it("lässt genau zehn Tage Alter zu, elf nicht", () => {
    expect(rateAt(series, "2016-01-15")).not.toBeNull();
    expect(rateAt(series, "2016-01-16")).toBeNull();
  });
  it("gibt null vor dem Beginn und bei zu altem Wert", () => {
    expect(rateAt(series, "2016-01-03")).toBeNull();
    expect(rateAt(series, "2016-03-01")).toBeNull();
  });
});

describe("fetchEcbRates", () => {
  it("fragt die Laufzeit und den Beginn ab und wirft bei HTTP-Fehlern", async () => {
    let url = "";
    const ok = async (u: string | URL | Request) => {
      url = String(u);
      return new Response(csv);
    };
    expect(await fetchEcbRates("SR_3M", "2016-01-01", ok as typeof fetch)).toBe(csv);
    expect(url).toContain("SR_3M?startPeriod=2016-01-01");
    await expect(fetchEcbRates("SR_10Y", "2016-01-01", (async () => new Response("", { status: 500 })) as typeof fetch)).rejects.toThrow(
      "HTTP 500",
    );
  });
});
