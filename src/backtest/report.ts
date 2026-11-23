// Kennzahlen, rollende Fenster und Textausgabe des Rückblicks. Reine Rechnung.

export interface Metrics {
  /** Gesamtrendite, 0.5 = +50 %. */
  total: number;
  cagr: number;
  /** Schwankung der Monatsrenditen, hochgerechnet auf ein Jahr. */
  vol: number;
  /** Größter Rückgang vom jeweils letzten Höchststand, auf Monatsbasis (negativ). */
  maxDrawdown: number;
}

export function yearsBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / (365.25 * 864e5);
}

export function metrics(values: readonly number[], years: number): Metrics {
  const first = values[0] ?? 100;
  const last = values.at(-1) ?? first;
  const returns = values.slice(1).map((v, i) => v / values[i]! - 1);
  const mean = returns.reduce((a, b) => a + b, 0) / Math.max(1, returns.length);
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, returns.length - 1);
  let peak = 0;
  let maxDrawdown = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    maxDrawdown = Math.min(maxDrawdown, v / peak - 1);
  }
  return {
    total: last / first - 1,
    cagr: years > 0 ? (last / first) ** (1 / years) - 1 : Number.NaN,
    vol: Math.sqrt(variance) * Math.sqrt(12),
    maxDrawdown,
  };
}

export function quantile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? Number.NaN;
}

export function median(values: readonly number[]): number {
  return quantile(values, 0.5);
}

/** Gleichverteilte Zufallszahlen in [0, 1) aus einem Startwert; derselbe Startwert liefert dieselbe Folge. */
export function seededRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Zufallswerte in [0, 1) je Titel und Jahr aus einem Startwert, für die Zufallsgegenprobe. Innerhalb eines Kalenderjahres bleibt der
 * Wert eines Titels gleich, damit die gewürfelte Rangfolge nicht jedes Quartal neu gemischt wird (sonst hätte sie unnatürlich hohen
 * Umschlag und Kosten, die die Strategie nicht trägt).
 */
export function randomScores(seed: number): (id: string, month: string) => number {
  const cache = new Map<string, number>();
  return (id, month) => {
    const key = `${id}|${month.slice(0, 4)}`;
    let value = cache.get(key);
    if (value === undefined) {
      let hash = 2166136261 ^ seed;
      for (const ch of key) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
      value = seededRandom(hash)();
      cache.set(key, value);
    }
    return value;
  };
}

/** Startindizes rollender Fenster: alle `step` Monate, solange das Fenster von `windowMonths` Monaten in die Reihe passt. */
export function windowStarts(length: number, windowMonths: number, step = 3): number[] {
  const starts: number[] = [];
  for (let s = 0; s + windowMonths <= length - 1; s += step) starts.push(s);
  return starts;
}

/** Drei gleich lange Zeiträume der Reihe als Indexpaare (Anfang, Ende). */
export function thirds(length: number): [number, number][] {
  const last = length - 1;
  const a = Math.round(last / 3);
  const b = Math.round((2 * last) / 3);
  return [
    [0, a],
    [a, b],
    [b, last],
  ];
}

/** Gütemaß eines Laufs: Rendite über Bargeld je Einheit Schwankung (Sharpe-artig) und Rendite je größtem Rückgang (Calmar-artig). */
export interface Quality {
  /** Gesamter Zeitraum: (Rendite p. a. − Bargeldzins) / Schwankung; `NaN`, wenn die Schwankung 0 ist. */
  sharpe: number;
  /** Gesamter Zeitraum: Rendite p. a. / Betrag des größten Rückgangs (mindestens 1 %, damit ein ruhiger Verlauf nichts sprengt). */
  calmar: number;
  /** Median der Sharpe-Werte über die rollenden Fenster; `null` ohne Fenster. */
  windowSharpe: number | null;
  /** Schwaches Viertel der Fenster (25 %-Quantil des Sharpe-Werts): wie schlecht es in ungünstigen Zeiträumen wird. */
  windowSharpeWeak: number | null;
  /** Median der Calmar-Werte über die Fenster. */
  windowCalmar: number | null;
}

const MIN_DRAWDOWN = 0.01;

function sharpeOf(cagr: number, vol: number, cashRate: number): number {
  return vol > 0 ? (cagr - cashRate) / vol : Number.NaN;
}

function calmarOf(cagr: number, maxDrawdown: number): number {
  return cagr / Math.max(Math.abs(maxDrawdown), MIN_DRAWDOWN);
}

/** Jahresrendite eines Fensters aus seiner Gesamtrendite. */
function windowCagr(total: number, windowMonths: number): number {
  return (1 + total) ** (12 / windowMonths) - 1;
}

function optionNumber(r: BacktestSummary, key: string, fallback: number): number {
  const value = ((r.meta.optionen ?? {}) as Record<string, unknown>)[key];
  return typeof value === "number" ? value : fallback;
}

/** Gütemaß der Strategie eines Laufs. Der Bargeldzins ist der des Laufs (`cashRate`), damit zwei Läufe gleich gemessen werden. */
export function quality(r: BacktestSummary): Quality {
  const cash = optionNumber(r, "cashRate", 0);
  const windowMonths = optionNumber(r, "windowMonths", 36);
  const f = r.full.strategy;
  const sharpes = r.windows
    .map((w) => sharpeOf(windowCagr(w.strategy.total, windowMonths), w.strategy.vol, w.cashRate ?? cash))
    .filter(Number.isFinite);
  // Der Calmar-Wert braucht keine Schwankung und zählt daher alle Fenster; der Sharpe-Wert nur die mit Schwankung.
  const calmars = r.windows.map((w) => calmarOf(windowCagr(w.strategy.total, windowMonths), w.strategy.maxDrawdown));
  return {
    sharpe: sharpeOf(f.cagr, f.vol, cash),
    calmar: calmarOf(f.cagr, f.maxDrawdown),
    windowSharpe: sharpes.length > 0 ? median(sharpes) : null,
    windowSharpeWeak: sharpes.length > 0 ? quantile(sharpes, 0.25) : null,
    windowCalmar: calmars.length > 0 ? median(calmars) : null,
  };
}

export interface WindowResult {
  start: string;
  strategy: { total: number; vol: number; maxDrawdown: number; turnover: number };
  benchmark: number | null;
  /** Mittlerer Bargeldzins im Fenster, wenn der Lauf den Zinsverlauf nutzt; sonst gilt `cashRate` der Optionen. */
  cashRate?: number;
}

export interface Diagnostics {
  /** Warum Titel an Stichtagen übersprungen wurden, nach Grund. */
  skipped: Record<string, number>;
  /** Titel mit Einstellungsabschlag ("Symbol Monat"); die Annahme färbt das Ergebnis, auch bei Übernahmen. */
  delistings: string[];
  /** Positionen mit einer Monatsrendite über +100 % oder unter −60 %. */
  outliers: { month: string; id: string; name: string; monthlyReturn: number }[];
  /** Titel, die mindestens einmal Kandidat waren. */
  stocksWithBars: number;
  /** Monate, in denen eine Zinsreihe keinen Wert hatte und der feste Wert galt (nur mit Zinsverlauf). */
  ratesFallback?: number;
}

export interface BacktestSummary {
  name: string;
  /** Wofür der Lauf steht: Optionen, Rechenversion, Datenstand. */
  meta: Record<string, unknown>;
  months: string[];
  strategy: number[];
  benchmark: number[] | null;
  full: { strategy: Metrics & { turnover: number; holdings: number }; benchmark: Metrics | null };
  periods: { label: string; strategy: number; benchmark: number | null; randomMedian: number | null }[];
  windows: WindowResult[];
  random: {
    runs: number;
    median: number[];
    p5: number[];
    p95: number[];
    shareBeatingStrategy: number;
    shareBeatingBenchmark: number | null;
    /** Mittlerer Umschlag der Zufallsläufe je Umschichtung (zweiseitig). */
    turnover: number;
  } | null;
  diagnostics?: Diagnostics;
}

const percent = (value: number, digits = 0) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits).replace(".", ",")} %`;
const ratio = (value: number) => (Number.isFinite(value) ? value.toFixed(2).replace(".", ",") : "–");
const plain = (value: number, digits = 0) => `${(value * 100).toFixed(digits).replace(".", ",")} %`;

const LIMITS = [
  "Grenzen: Survivorship-Bias (fast nur heute geführte Titel), Risiko nur aus Zahlenfaktoren ohne Urteile, Abschlüsse in heutiger",
  "Fassung, Inflationsabstand mit heutigen Werten (Hürde und Bargeldzins je Stichtag nur mit Zinsverlauf). Ein Rückblick ist keine Renditeerwartung.",
];

export function describeResult(r: BacktestSummary): string[] {
  const f = r.full;
  const o = (r.meta.optionen ?? {}) as Record<string, unknown>;
  const setting = [
    o.profile ? `Profil ${o.profile}` : null,
    typeof o.swap === "number" ? `Tauschschwelle ${plain(o.swap)}` : null,
    typeof o.hurdle === "number" ? `Hürde ${o.ratesHistory ? "im Mittel " : ""}${plain(o.hurdle, 1)}` : null,
    o.ratesHistory ? "Zinsen je Stichtag" : null,
    o.every && o.every !== 1 ? `Umschichtung jeden ${o.every}. Stichtag` : null,
  ].filter(Boolean);
  const lines = [
    `Rückblick „${r.name}“: ${r.months[0]} bis ${r.months.at(-1)}, Euro, nach Kosten${setting.length ? ` (${setting.join(", ")})` : ""}`,
    "",
  ];
  const row = (label: string, m: Metrics, extra = "") =>
    `${label.padEnd(24)} ${percent(m.total).padStart(8)}  ${percent(m.cagr, 1).padStart(9)}  ${plain(m.vol).padStart(8)}  ${plain(m.maxDrawdown).padStart(14)}${extra}`;
  lines.push(
    `${"".padEnd(24)} ${"gesamt".padStart(8)}  ${"p. a.".padStart(9)}  ${"Schwank.".padStart(8)}  ${"größter Rückgang".padStart(14)}`,
  );
  lines.push(
    row(
      "Strategie",
      f.strategy,
      `   Umschlag ${plain(f.strategy.turnover)} je Umschichtung (Käufe plus Verkäufe), ${f.strategy.holdings.toFixed(1).replace(".", ",")} Titel`,
    ),
  );
  if (f.benchmark) lines.push(row("Vergleichsindex", f.benchmark));
  if (r.random) {
    const last = r.random.median.length - 1;
    lines.push(
      `${"Zufallsauswahl, Median".padEnd(24)} ${percent(r.random.median[last]! / 100 - 1).padStart(8)}  (5–95 %: ${percent(r.random.p5[last]! / 100 - 1)} bis ${percent(r.random.p95[last]! / 100 - 1)}; ${plain(r.random.shareBeatingStrategy)} der ${r.random.runs} Läufe schlagen die Strategie; Umschlag ${plain(r.random.turnover)})`,
    );
  }
  const q = quality(r);
  const cash = optionNumber(r, "cashRate", 0);
  const bq = f.benchmark ? sharpeOf(f.benchmark.cagr, f.benchmark.vol, cash) : null;
  lines.push(
    "",
    `Güte (Rendite über Bargeld je Schwankung): Strategie ${ratio(q.sharpe)}` +
      (bq === null ? "" : `, Index ${ratio(bq)}`) +
      (q.windowSharpe === null ? "" : `; Fenstermedian ${ratio(q.windowSharpe)}, schwaches Viertel ${ratio(q.windowSharpeWeak!)}`),
    `Rendite je größtem Rückgang: Strategie ${ratio(q.calmar)}` +
      (f.benchmark ? `, Index ${ratio(calmarOf(f.benchmark.cagr, f.benchmark.maxDrawdown))}` : "") +
      (q.windowCalmar === null ? "" : `; Fenstermedian ${ratio(q.windowCalmar)}`),
  );
  lines.push("", "Nach Zeitraum:");
  for (const p of r.periods)
    lines.push(
      `  ${p.label.padEnd(20)} Strategie ${percent(p.strategy).padStart(7)}` +
        (p.benchmark === null ? "" : `, Index ${percent(p.benchmark).padStart(7)}`) +
        (p.randomMedian === null ? "" : `, Zufall (Median) ${percent(p.randomMedian).padStart(7)}`),
    );
  if (r.windows.length > 0) {
    const totals = r.windows.map((w) => w.strategy.total);
    const withBenchmark = r.windows.filter((w) => w.benchmark !== null);
    const beating = withBenchmark.filter((w) => w.strategy.total > w.benchmark!);
    lines.push(
      "",
      `Rollende Fenster (${r.windows.length}, Start alle drei Monate): Median ${percent(median(totals))}, schlechtestes ${percent(Math.min(...totals))}, bestes ${percent(Math.max(...totals))}` +
        (withBenchmark.length > 0 ? `, schlägt den Index in ${plain(beating.length / withBenchmark.length)}` : ""),
    );
  }
  const d = r.diagnostics;
  if (d) {
    const skipped = Object.entries(d.skipped)
      .filter(([, n]) => n > 0)
      .map(([why, n]) => `${why} ${n}`)
      .join(", ");
    lines.push(
      "",
      `Daten: ${d.stocksWithBars} Titel waren mindestens einmal Kandidat; übersprungen (Titel-Monate): ${skipped || "nichts"}.`,
    );
    if (d.ratesFallback) lines.push(`ACHTUNG: In ${d.ratesFallback} Monaten fehlte ein Zinswert; dort gelten die festen Zinsen.`);
    lines.push(
      `Annahme Einstellung: ${d.delistings.length} Abschläge (${d.delistings.slice(0, 5).join(", ")}${d.delistings.length > 5 ? ", …" : ""}).`,
    );
    if (d.outliers.length > 0)
      lines.push(
        `Ausreißer: ${d.outliers.length} Positionsmonate mit Rendite über +100 % oder unter −60 % (oft Datenfehler): ` +
          d.outliers
            .slice(0, 5)
            .map((x) => `${x.name} ${x.month} ${percent(x.monthlyReturn)}`)
            .join("; "),
      );
  }
  lines.push("", ...LIMITS);
  return lines;
}

/** Unterschiede der Einstellungen zweier Läufe; ein Vergleich ist nur sinnvoll, wenn Zeitraum, Fenster und Datenstand stimmen. */
function comparability(a: BacktestSummary, b: BacktestSummary): { abort: string | null; notes: string[] } {
  const oa = (a.meta.optionen ?? {}) as Record<string, unknown>;
  const ob = (b.meta.optionen ?? {}) as Record<string, unknown>;
  const differs = (key: string) => JSON.stringify(oa[key]) !== JSON.stringify(ob[key]);
  const fixed = ["start", "end", "endDate", "windowMonths"].filter(differs);
  if (fixed.length > 0)
    return {
      abort: `Nicht vergleichbar: ${fixed.map((k) => `${k} ${JSON.stringify(oa[k])} gegen ${JSON.stringify(ob[k])}`).join(", ")}. Beide Läufe müssen denselben Zeitraum, dasselbe Enddatum und dieselbe Fensterlänge haben (am besten mit derselben Datenbank am selben Tag rechnen).`,
      notes: [],
    };
  const notes: string[] = [];
  const environment = ["cost", "cashRate", "hurdle", "ratesHistory", "minCapEur", "delistLoss", "randomRuns"].filter(differs);
  if (environment.length > 0)
    notes.push(
      `ACHTUNG: Einstellungen unterscheiden sich (${environment.join(", ")}); ein Teil des Unterschieds kommt nicht von der Änderung.`,
    );
  const unrated = [a, b].filter(
    (r) => !["cashRate", "windowMonths"].every((k) => typeof (r.meta.optionen as Record<string, unknown> | undefined)?.[k] === "number"),
  );
  if (unrated.length > 0)
    notes.push(
      `ACHTUNG: In ${unrated.map((r) => `„${r.name}“`).join(" und ")} fehlen Bargeldzins oder Fensterlänge; die Güte rechnet dann mit 0 % und 36 Monaten.`,
    );
  const changed = ["profile", "swap", "every"].filter(differs);
  if (changed.length > 0)
    notes.push(
      `Geänderte Strategieoptionen: ${changed.map((k) => `${k} ${JSON.stringify(oa[k] ?? null)} → ${JSON.stringify(ob[k] ?? null)}`).join(", ")}.`,
    );
  if (a.meta.rechenversion !== b.meta.rechenversion)
    notes.push(`Rechenversion ${a.meta.rechenversion} → ${b.meta.rechenversion} (bei Änderungen am Rechenmodell zu erwarten).`);
  if (a.diagnostics && b.diagnostics && a.diagnostics.stocksWithBars !== b.diagnostics.stocksWithBars)
    notes.push(
      `Zahl der Kandidatentitel: ${a.diagnostics.stocksWithBars} → ${b.diagnostics.stocksWithBars} (andere Datenbasis oder andere Auswahl).`,
    );
  return { abort: null, notes };
}

/** Vergleicht zwei Läufe (Stand `a` gegen Änderung `b`) über die gemeinsamen rollenden Fenster. */
export function compareResults(a: BacktestSummary, b: BacktestSummary): string[] {
  const check = comparability(a, b);
  if (check.abort) throw new Error(check.abort);
  const byStart = new Map(a.windows.map((w) => [w.start, w]));
  const pairs = b.windows.flatMap((w) => {
    const other = byStart.get(w.start);
    return other ? [{ a: other, b: w }] : [];
  });
  const lines = [`Vergleich: „${a.name}“ (Stand) gegen „${b.name}“ (Änderung)`, ...check.notes, ""];
  lines.push(`${"".padEnd(24)} ${"Stand".padStart(9)} ${"Änderung".padStart(9)}  ${"Differenz".padStart(9)}`);
  lines.push(
    `${"Gesamtrendite".padEnd(24)} ${percent(a.full.strategy.total).padStart(9)} ${percent(b.full.strategy.total).padStart(9)}  ${percent(b.full.strategy.total - a.full.strategy.total).padStart(9)}`,
    `${"Rendite p. a.".padEnd(24)} ${percent(a.full.strategy.cagr, 1).padStart(9)} ${percent(b.full.strategy.cagr, 1).padStart(9)}  ${percent(b.full.strategy.cagr - a.full.strategy.cagr, 1).padStart(9)}`,
    `${"Schwankung p. a.".padEnd(24)} ${plain(a.full.strategy.vol).padStart(9)} ${plain(b.full.strategy.vol).padStart(9)}`,
    `${"größter Rückgang".padEnd(24)} ${plain(a.full.strategy.maxDrawdown).padStart(9)} ${plain(b.full.strategy.maxDrawdown).padStart(9)}`,
    `${"Umschlag (zweiseitig)".padEnd(24)} ${plain(a.full.strategy.turnover).padStart(9)} ${plain(b.full.strategy.turnover).padStart(9)}`,
  );
  const qa = quality(a);
  const qb = quality(b);
  lines.push(
    `${"Güte (Rendite/Schwankung)".padEnd(24)} ${ratio(qa.sharpe).padStart(9)} ${ratio(qb.sharpe).padStart(9)}  ${ratio(qb.sharpe - qa.sharpe).padStart(9)}`,
    `${"Rendite/Rückgang".padEnd(24)} ${ratio(qa.calmar).padStart(9)} ${ratio(qb.calmar).padStart(9)}  ${ratio(qb.calmar - qa.calmar).padStart(9)}`,
  );
  if (qa.windowSharpe !== null && qb.windowSharpe !== null)
    lines.push(
      `${"Güte, Fenstermedian".padEnd(24)} ${ratio(qa.windowSharpe).padStart(9)} ${ratio(qb.windowSharpe).padStart(9)}  ${ratio(qb.windowSharpe - qa.windowSharpe).padStart(9)}`,
      `${"Güte, schwaches Viertel".padEnd(24)} ${ratio(qa.windowSharpeWeak!).padStart(9)} ${ratio(qb.windowSharpeWeak!).padStart(9)}  ${ratio(qb.windowSharpeWeak! - qa.windowSharpeWeak!).padStart(9)}`,
    );
  if (pairs.length > 0) {
    const sharpeIn = (r: BacktestSummary, w: WindowResult) =>
      sharpeOf(
        windowCagr(w.strategy.total, optionNumber(r, "windowMonths", 36)),
        w.strategy.vol,
        w.cashRate ?? optionNumber(r, "cashRate", 0),
      );
    const rated = pairs.filter((p) => Number.isFinite(sharpeIn(a, p.a)) && Number.isFinite(sharpeIn(b, p.b)));
    if (rated.length > 0) {
      const betterQuality = rated.filter((p) => sharpeIn(b, p.b) > sharpeIn(a, p.a)).length;
      lines.push(`Güte besser in ${plain(betterQuality / rated.length)} der Fenster (${rated.length}).`);
    }
    const better = pairs.filter((p) => p.b.strategy.total > p.a.strategy.total).length;
    const diffs = pairs.map((p) => p.b.strategy.total - p.a.strategy.total);
    lines.push(
      "",
      `Rollende Fenster (${pairs.length}): Änderung besser in ${plain(better / pairs.length)}, Median der Differenz ${percent(median(diffs), 1)}, ` +
        `schlechteste Differenz ${percent(Math.min(...diffs))}, beste ${percent(Math.max(...diffs))}`,
      `  Median der Fensterrendite: Stand ${percent(median(pairs.map((p) => p.a.strategy.total)))}, Änderung ${percent(median(pairs.map((p) => p.b.strategy.total)))}`,
    );
  }
  lines.push(
    "",
    "Hinweis: Die Fenster überlappen stark; unabhängig sind nur wenige Zeiträume. Ein Unterschied im Median zählt mehr als einer im Mittel.",
    ...LIMITS,
  );
  return lines;
}
