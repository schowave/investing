// Wechselkurse für Währungen, die die EZB nicht veröffentlicht (z. B. Tenge). Quelle: open.er-api.com,
// frei nutzbar mit Quellenangabe ("Rates By Exchange Rate API"). Einheiten der Fremdwährung je Euro.

export const FX_SUPPLEMENT_URL = "https://open.er-api.com/v6/latest/EUR";

export async function fetchSupplementRates(currencies: readonly string[], fetchFn: typeof fetch = fetch): Promise<Record<string, number>> {
  const response = await fetchFn(FX_SUPPLEMENT_URL);
  if (!response.ok) throw new Error(`Zusatzkurse: HTTP ${response.status}`);
  const data = (await response.json()) as { result?: string; rates?: Record<string, unknown> };
  if (data.result !== "success" || !data.rates) throw new Error("Zusatzkurse: unerwartete Antwort");
  const perEur: Record<string, number> = {};
  for (const currency of currencies) {
    const rate = data.rates[currency];
    if (typeof rate === "number" && rate > 0) perEur[currency] = rate;
  }
  return perEur;
}
