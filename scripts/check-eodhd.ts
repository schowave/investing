// Prüft, ob der EODHD-Token Kurse für die Start-Watchlist liefert.
// Aufruf: npm run check:eodhd   (Token in .env.local als EODHD_API_TOKEN)

import { EodhdError, fetchAccount, fetchDailyCloses } from "../src/data/eodhd.ts";

const WATCHLIST: [name: string, symbol: string][] = [
  ["Imperial Brands", "IMB.LSE"],
  ["3i Group", "III.LSE"],
  ["Charter Communications", "CHTR.US"],
  ["Universal Health Services", "UHS.US"],
  ["BASF", "BAS.XETRA"],
  ["Halyk Savings Bank (GDR)", "HSBK.LSE"],
];

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

try {
  const account = await fetchAccount(token);
  console.log(`Tarif: ${account.subscription}, heute ${account.requestsToday} von ${account.dailyRateLimit} Abrufen verbraucht`);
} catch (error) {
  console.log(`Kontoabfrage nicht möglich: ${(error as Error).message}`);
}

for (const [name, symbol] of WATCHLIST) {
  try {
    const closes = await fetchDailyCloses(symbol, day(10), day(0), token);
    const last = closes.at(-1);
    console.log(last ? `ok      ${symbol.padEnd(10)} ${name}: ${last.close} am ${last.date}` : `leer    ${symbol.padEnd(10)} ${name}`);
  } catch (error) {
    const reason = error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message;
    console.log(`fehlt   ${symbol.padEnd(10)} ${name}: ${reason}`);
  }
}
