// Euro-Referenzkurse der EZB (Einheiten der Fremdwährung je Euro).

export interface EcbRates {
  date: string;
  perEur: Record<string, number>;
}

const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export function parseEcbRates(xml: string): EcbRates {
  const date = /time=['"](\d{4}-\d{2}-\d{2})['"]/.exec(xml)?.[1];
  if (!date) throw new Error("EZB-Kurse: kein Datum gefunden");
  const perEur: Record<string, number> = {};
  for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
    perEur[match[1]!] = Number(match[2]);
  }
  if (Object.keys(perEur).length === 0) throw new Error("EZB-Kurse: keine Kurse gefunden");
  return { date, perEur };
}

export async function fetchEcbRates(fetchFn: typeof fetch = fetch): Promise<EcbRates> {
  const response = await fetchFn(ECB_DAILY_URL);
  if (!response.ok) throw new Error(`EZB-Kurse: HTTP ${response.status}`);
  return parseEcbRates(await response.text());
}
