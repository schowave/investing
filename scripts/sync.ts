// Täglicher Abgleich: Start-Watchlist anlegen, Kurse und Wechselkurse laden.
// Aufruf: npm run sync   (ein EODHD-Abruf je Aktie)

import { mkdirSync } from "node:fs";
import { Database } from "../src/data/db.ts";
import { fetchEcbRates } from "../src/data/ecb.ts";
import { EodhdError, fetchDailyCloses } from "../src/data/eodhd.ts";
import { START_WATCHLIST } from "../src/data/seed.ts";

const token = process.env.EODHD_API_TOKEN;
if (!token) {
  console.error("EODHD_API_TOKEN fehlt. Bitte in .env.local eintragen.");
  process.exit(1);
}

mkdirSync("data", { recursive: true });
const db = new Database("data/investing.sqlite");
START_WATCHLIST.forEach((stock) => db.addStockIfMissing(stock));

try {
  const rates = await fetchEcbRates();
  db.saveFxRates(rates.date, rates.perEur);
  console.log(`Wechselkurse vom ${rates.date}: ${Object.keys(rates.perEur).length} Währungen`);
} catch (error) {
  console.log(`Wechselkurse nicht geladen: ${(error as Error).message}`);
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
let failed = 0;
for (const stock of db.stocks()) {
  try {
    db.saveRawCloses(stock.id, await fetchDailyCloses(stock.id, day(10), day(0), token));
    const price = db.latestPrice(stock.id);
    const perEur = db.latestFxRate(stock.priceCurrency);
    const inEur = price && perEur ? ` = ${(price.close / perEur).toFixed(2)} EUR` : "";
    console.log(price ? `ok     ${stock.id.padEnd(10)} ${price.close.toFixed(2)} ${stock.priceCurrency}${inEur} am ${price.date}` : `leer   ${stock.id}`);
  } catch (error) {
    failed++;
    console.log(`fehlt  ${stock.id.padEnd(10)} ${error instanceof EodhdError ? `HTTP ${error.status}` : (error as Error).message}`);
  }
}
db.close();
process.exit(failed > 0 ? 1 : 0);
