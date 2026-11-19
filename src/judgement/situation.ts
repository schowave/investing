// Warnsignale für den Faktor "Aktuelle Situation": Zahlen, nach denen es sich lohnt, selbst nach Nachrichten zu sehen.
// Sie setzen keinen Abzug und gehen nicht in die Bewertung ein; sie sagen nur, wann ein Blick nötig ist.

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

type Row = Record<string, unknown>;
const num = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};
const pct = (value: number) => `${Math.round(value * 100)} %`;

/**
 * @param fundamentalsJson Rohantwort von EODHD (Fundamentals) mit Technicals, Earnings und Highlights.
 * @param price Letzter Schlusskurs in der Einheit von EODHD (z. B. Pence bei der LSE), wie das 52-Wochen-Hoch.
 * @param isFinancial Bei Finanzwerten sagt der Umsatz wenig (Bewertungsgewinne, Zinsergebnis); er wird nicht geprüft.
 */
export function situationSignals(args: { fundamentalsJson: string | null; price: number | null; isFinancial: boolean }): SituationSignal[] {
  if (!args.fundamentalsJson) return [];
  const raw = JSON.parse(args.fundamentalsJson) as Row;
  const signals: SituationSignal[] = [];

  const high = num((raw.Technicals as Row | undefined)?.["52WeekHigh"]);
  if (args.price !== null && args.price > 0 && high !== null && high > 0) {
    const drawdown = 1 - args.price / high;
    if (drawdown >= DRAWDOWN) signals.push({ kind: "drawdown", text: `Der Kurs liegt ${pct(drawdown)} unter dem 52-Wochen-Hoch.` });
  }

  const quarters = Object.values(((raw.Earnings as Row | undefined)?.History ?? {}) as Row)
    .map((q) => q as Row)
    .filter((q) => typeof q.date === "string" && num(q.epsActual) !== null && num(q.epsEstimate) !== null)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 4);
  const misses = quarters.filter((q) => {
    const surprise = num(q.surprisePercent);
    return surprise !== null && surprise <= -MISS * 100;
  });
  if (misses.length >= MISSES) {
    const worst = Math.min(...misses.map((q) => num(q.surprisePercent)!));
    signals.push({
      kind: "misses",
      text: `${misses.length} der letzten ${quarters.length} Quartale lagen mehr als ${pct(MISS)} unter der Gewinnschätzung, zuletzt bis zu ${pct(-worst / 100)}.`,
    });
  }

  const revenue = num((raw.Highlights as Row | undefined)?.QuarterlyRevenueGrowthYOY);
  if (!args.isFinancial && revenue !== null && revenue <= -REVENUE_DROP) {
    signals.push({ kind: "revenue", text: `Der Umsatz des letzten Quartals lag ${pct(-revenue)} unter dem Vorjahresquartal.` });
  }
  return signals;
}
