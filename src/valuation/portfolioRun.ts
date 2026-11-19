// Stellt für ein Portfolio aus der Datenbank Ist und Ziel gegenüber.

import type { Profile } from "../calc/index.ts";
import { PROFILE_FOCUSED, PROFILE_GLOBAL, withHurdle } from "../calc/index.ts";
import type { Database, Portfolio, Stock } from "../data/db.ts";
import type { PortfolioView } from "./portfolioView.ts";
import { buildPortfolioView } from "./portfolioView.ts";
import { computeValuation } from "./run.ts";
import { doubtfulNumbers } from "./valuation.ts";

/** Schlüssel der Anleiherendite in den Bezugsgrößen. */
export const BOND_KEY = "bond:EUR10Y";

export interface LoadedPortfolio {
  profile: Profile;
  /** Stückzahlen je Aktie. */
  holdings: Map<string, number>;
  /** Watchlist und zusätzlich gehaltene Titel, die nicht mehr darauf stehen. */
  stocks: Stock[];
  view: PortfolioView;
  /** Titel, deren Zahlen nicht zum Kurs passen, mit Begründung (siehe `doubtfulNumbers`). */
  doubtful: Map<string, string>;
}

export function loadPortfolio(db: Database, portfolio: Portfolio, date: string): LoadedPortfolio {
  const profile = withHurdle(portfolio.profile === "global" ? PROFILE_GLOBAL : PROFILE_FOCUSED, db.referenceRate(BOND_KEY));
  const holdings = db.holdings(portfolio.id);
  const watchlist = db.stocks();
  const extra = [...holdings.keys()].filter((id) => !watchlist.some((s) => s.id === id)).map((id) => db.stock(id)!);
  const stocks = [...watchlist, ...extra];

  const doubtful = new Map<string, string>();
  const view = buildPortfolioView(
    profile,
    portfolio.cashEur,
    stocks.map((stock) => {
      const { valuation, proposals } = computeValuation(db, stock, date);
      const reason = doubtfulNumbers(valuation, proposals);
      if (reason) doubtful.set(stock.id, reason);
      const price = db.latestPrice(stock.id);
      const perEur = db.latestFxRate(stock.priceCurrency);
      return {
        id: stock.id,
        sector: stock.sector,
        region: stock.region,
        innerReturn: valuation.returns?.base ?? null,
        riskScore: valuation.riskScore,
        complete: valuation.complete,
        shares: holdings.get(stock.id) ?? 0,
        priceEur: price && perEur ? price.close / perEur : null,
        doubtful: reason !== null,
      };
    }),
    portfolio.otherEur,
  );
  return { profile, holdings, stocks, view, doubtful };
}
