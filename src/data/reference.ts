// Bezugsgrößen für den Vergleich über Währungen und für die Mindestrendite.
// Inflation: Prognosen des IWF (World Economic Outlook). Anleiherendite: Zinsstrukturkurve der EZB.

import { z } from "zod";

/** Prognosen je Ländercode und Jahr in Prozent; fehlende oder unbrauchbare Werte gelten als nicht vorhanden. */
const InflationAnswer = z
  .object({ values: z.object({ PCPIPCH: z.record(z.string(), z.record(z.string(), z.unknown())) }) })
  .catch({ values: { PCPIPCH: {} } });

/** Währung zu IWF-Ländercode. */
const IMF_AREA: Record<string, string> = {
  EUR: "EURO",
  USD: "USA",
  GBP: "GBR",
  GBX: "GBR",
  CHF: "CHE",
  JPY: "JPN",
  SEK: "SWE",
  NOK: "NOR",
  DKK: "DNK",
  ISK: "ISL",
  PLN: "POL",
  CZK: "CZE",
  HUF: "HUN",
  CAD: "CAN",
  AUD: "AUS",
  NZD: "NZL",
  KRW: "KOR",
  CNY: "CHN",
  HKD: "HKG",
  TWD: "TWN",
  SGD: "SGP",
  INR: "IND",
  IDR: "IDN",
  MYR: "MYS",
  PHP: "PHL",
  THB: "THA",
  VND: "VNM",
  PKR: "PAK",
  KZT: "KAZ",
  GEL: "GEO",
  TRY: "TUR",
  ILS: "ISR",
  AED: "ARE",
  BRL: "BRA",
  MXN: "MEX",
  ARS: "ARG",
  CLP: "CHL",
  COP: "COL",
  PEN: "PER",
  ZAR: "ZAF",
  NGN: "NGA",
  EGP: "EGY",
  PGK: "PNG",
  RUB: "RUS",
};

const IMF_INFLATION_URL = "https://www.imf.org/external/datamapper/api/v1/PCPIPCH";
const ECB_BOND_URL = "https://data-api.ecb.europa.eu/service/data/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y?lastNObservations=1&format=csvdata";

/** Erwartete Inflation je Währung als Anteil: Mittel der Prognosen für die vier Jahre nach `year`. */
export function parseInflationForecasts(data: unknown, year: number): Record<string, number> {
  const areas = InflationAnswer.parse(data).values.PCPIPCH;
  const result: Record<string, number> = {};
  for (const [currency, area] of Object.entries(IMF_AREA)) {
    const values = [1, 2, 3, 4]
      .map((offset) => areas[area]?.[String(year + offset)])
      .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    if (values.length > 0) result[currency] = values.reduce((sum, v) => sum + v, 0) / values.length / 100;
  }
  return result;
}

export async function fetchInflationForecasts(year: number, fetchFn: typeof fetch = fetch): Promise<Record<string, number>> {
  // Der IWF weist Abrufe ohne Client-Kennung ab.
  const response = await fetchFn(IMF_INFLATION_URL, { headers: { "User-Agent": "investing-sync/1.0", Accept: "application/json" } });
  if (!response.ok) throw new Error(`IWF-Inflation: HTTP ${response.status}`);
  const forecasts = parseInflationForecasts(await response.json(), year);
  if (forecasts.EUR === undefined) throw new Error("IWF-Inflation: kein Wert für den Euroraum");
  return forecasts;
}

/** Rendite zehnjähriger Euro-Staatsanleihen bester Bonität als Anteil. */
function parseBondYield(csv: string): { date: string; rate: number } {
  const [header, row] = csv.trim().split(/\r?\n/);
  const columns = header?.split(",") ?? [];
  const cells = row?.split(",") ?? [];
  const date = cells[columns.indexOf("TIME_PERIOD")];
  const value = Number(cells[columns.indexOf("OBS_VALUE")]);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(value)) throw new Error("EZB-Anleiherendite: unerwartete Antwort");
  return { date, rate: value / 100 };
}

export async function fetchBondYield(fetchFn: typeof fetch = fetch): Promise<{ date: string; rate: number }> {
  const response = await fetchFn(ECB_BOND_URL, { headers: { Accept: "text/csv" } });
  if (!response.ok) throw new Error(`EZB-Anleiherendite: HTTP ${response.status}`);
  return parseBondYield(await response.text());
}
