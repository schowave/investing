// Warnsignale für den Faktor "Aktuelle Situation": Zahlen, nach denen es sich lohnt, selbst nach Nachrichten zu sehen.
// Sie setzen keinen Abzug und gehen nicht in die Bewertung ein; sie sagen nur, wann ein Blick nötig ist.

import type { EodhdSnapshot } from "../data/eodhdSnapshot.ts";

/** Kurs mindestens so weit unter dem 52-Wochen-Hoch. */
const DRAWDOWN = 0.4;
/** So viele der letzten vier gemeldeten Quartale lagen deutlich unter der Schätzung … */
const MISSES = 2;
/** … und zwar um mindestens so viel. */
const MISS = 0.15;
/** Umsatz des letzten Quartals mindestens so weit unter dem Vorjahresquartal. */
const REVENUE_DROP = 0.15;

export interface SituationSignal {
  kind: "drawdown" | "misses" | "revenue";
  /** Satz für die Aktienseite. */
  text: string;
}

const pct = (value: number) => `${Math.round(value * 100)} %`;

/**
 * @param snapshot Momentaufnahme aus der Rohantwort von EODHD, sofern gespeichert.
 * @param price Letzter Schlusskurs in der Einheit von EODHD (z. B. Pence bei der LSE), wie das 52-Wochen-Hoch.
 * @param isFinancial Bei Finanzwerten sagt der Umsatz wenig (Bewertungsgewinne, Zinsergebnis); er wird nicht geprüft.
 */
export function situationSignals(args: { snapshot: EodhdSnapshot | null; price: number | null; isFinancial: boolean }): SituationSignal[] {
  if (!args.snapshot) return [];
  const signals: SituationSignal[] = [];

  const high = args.snapshot.week52High;
  if (args.price !== null && args.price > 0 && high !== null && high > 0) {
    const drawdown = 1 - args.price / high;
    if (drawdown >= DRAWDOWN) signals.push({ kind: "drawdown", text: `Der Kurs liegt ${pct(drawdown)} unter dem 52-Wochen-Hoch.` });
  }

  const quarters = args.snapshot.earnings
    .filter((q) => q.epsActual !== null && q.epsEstimate !== null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);
  const misses = quarters.filter((q) => q.surprisePercent !== null && q.surprisePercent <= -MISS * 100);
  if (misses.length >= MISSES) {
    const worst = Math.min(...misses.map((q) => q.surprisePercent!));
    signals.push({
      kind: "misses",
      text: `${misses.length} der letzten ${quarters.length} Quartale lagen mehr als ${pct(MISS)} unter der Gewinnschätzung, zuletzt bis zu ${pct(-worst / 100)}.`,
    });
  }

  const revenue = args.snapshot.quarterlyRevenueGrowth;
  if (!args.isFinancial && revenue !== null && revenue <= -REVENUE_DROP) {
    signals.push({ kind: "revenue", text: `Der Umsatz des letzten Quartals lag ${pct(-revenue)} unter dem Vorjahresquartal.` });
  }
  return signals;
}
