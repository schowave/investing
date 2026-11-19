// Rangliste der Watchlist: Reihenfolge nach innerer Rendite und was davon Kandidat fürs Portfolio ist, auf ein Urteil
// wartet oder wieder anzusehen ist. Die Seite Rangliste und der Zähler in der Navigation lesen beide hieraus.

import { EXCLUSION_SCORE, PROFILE_FOCUSED, withHurdle } from "../calc/index.ts";
import type { Database } from "../data/db.ts";
import { BOND_KEY } from "./portfolioRun.ts";
import { needsReview } from "./review.ts";
import type { StockValuation } from "./run.ts";
import { computeValuation } from "./run.ts";
import { doubtfulNumbers } from "./valuation.ts";

interface RankedStock extends StockValuation {
  /** Zahlen passen nicht zum Kurs (meist Hinterlegungsscheine); die Rendite ist nicht ernst zu nehmen. */
  doubtful: boolean;
  /** Basisfall mindestens auf der Hürde und Risiko unter dem Ausschluss; ohne Blick auf Vollständigkeit. */
  clears: boolean;
}

export interface Ranking {
  /** Mindestrendite: Anleiherendite plus Aufschlag des Profils „fokussiert“. */
  hurdle: number;
  /** Höchste innere Rendite zuerst; zweifelhafte Titel hinter allen mit belastbarer Rendite. */
  rows: RankedStock[];
  /** Vollständig bewertet, über der Hürde, nicht zweifelhaft. */
  candidates: RankedStock[];
  /** Urteil fehlt noch, Risiko nicht schon aus Zahlen über dem Ausschluss. */
  incomplete: RankedStock[];
  /** Davon die, die vorläufig über der Hürde liegen. */
  promising: RankedStock[];
  /** Fertige Bewertungen, die älter als ein Jahr sind oder deren Zahlen sich seither verschoben haben. */
  toReview: RankedStock[];
  /** Was als Nächstes zu bewerten lohnt. */
  next: RankedStock | undefined;
  /** Index der ersten Zeile unter der Hürde; -1, wenn keine darunter liegt. */
  firstBelow: number;
  /** Offene oder zu prüfende Bewertungen (Zähler in der Navigation). */
  open: number;
}

/** Mindestrendite der Rangliste aus der gespeicherten Anleiherendite. */
export function rankingHurdle(db: Database): number {
  return withHurdle(PROFILE_FOCUSED, db.referenceRate(BOND_KEY)).minReturn;
}

/** Ordnet bewertete Titel. Reine Rechnung. */
export function rank(valued: readonly StockValuation[], hurdle: number): Ranking {
  const ranked = valued.map((r): RankedStock => {
    const base = r.valuation.returns?.base ?? -1;
    return {
      ...r,
      doubtful: doubtfulNumbers(r.valuation, r.proposals) !== null,
      clears: base >= hurdle && r.valuation.riskScore < EXCLUSION_SCORE,
    };
  });
  const order = (r: RankedStock) => (r.doubtful ? -0.5 : (r.valuation.returns?.base ?? -1));
  const rows = ranked.sort((x, y) => order(y) - order(x));

  const candidates = rows.filter((r) => r.valuation.complete && r.clears && !r.doubtful);
  const incomplete = rows.filter((r) => !r.valuation.complete && r.valuation.riskScore < EXCLUSION_SCORE);
  const promising = incomplete.filter((r) => r.clears && !r.doubtful);
  const toReview = rows.filter((r) => r.valuation.complete && needsReview(r.review));
  return {
    hurdle,
    rows,
    candidates,
    incomplete,
    promising,
    toReview,
    next: promising[0] ?? incomplete[0],
    firstBelow: rows.findIndex((r) => order(r) < hurdle),
    open: incomplete.length + toReview.length,
  };
}

/** Bewertet die Watchlist und ordnet sie. */
export function rankWatchlist(db: Database, date: string): Ranking {
  return rank(
    db.stocks().map((stock) => computeValuation(db, stock, date)),
    rankingHurdle(db),
  );
}
