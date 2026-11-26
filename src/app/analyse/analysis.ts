// Rechnungen für die Analyse-Ansicht: Kursreihen, Zeiträume, Wachstumsraten, Dividenden je Jahr, Kennzahlen je Geschäftsjahr
// und Achsen der Diagramme. Reine Funktionen, damit die Seite nur noch zeichnet.

import type { FundamentalsYear } from "../../data/db.ts";

export interface PricePoint {
  /** Tag des Monatsschlusses (JJJJ-MM-TT). */
  date: string;
  /** Kurs, um spätere Splits bereinigt, in der Währung der Notiz (Pence schon in Pfund). */
  price: number;
  /** Kurs mit wieder angelegten Dividenden laut Anbieter, in derselben Einheit; zum heutigen Tag gleich dem Kurs. */
  total: number;
}

/**
 * Monatsschlusskurse in eine Reihe für die Diagramme: Rohkurs durch spätere Splits geteilt, damit es keine Sprünge gibt,
 * und Gesamtrendite aus dem bereinigten Schlusskurs des Anbieters. Der Teiler macht aus Pence Pfund.
 */
export function priceSeries(
  monthly: readonly { date: string; close: number; adjustedClose: number }[],
  splits: readonly { date: string; ratio: number }[],
  divisor: number,
): PricePoint[] {
  const valid = splits.filter((s) => s.ratio > 0 && Number.isFinite(s.ratio));
  return monthly
    .filter((m) => m.close > 0 && m.adjustedClose > 0)
    .map((m) => {
      // Der Anbieter datiert den Monat auf den ersten Handelstag, der Kurs ist aber der Schluss am Monatsende: Ein Split im
      // selben Monat steckt schon darin, nur Splits aus späteren Monaten werden herausgerechnet.
      const month = m.date.slice(0, 7);
      const factor = valid.filter((s) => s.date.slice(0, 7) > month).reduce((f, s) => f * s.ratio, 1);
      return { date: m.date, price: m.close / factor / divisor, total: m.adjustedClose / divisor };
    });
}

export const PERIODS = [
  { key: "1j", label: "1 J.", years: 1 },
  { key: "3j", label: "3 J.", years: 3 },
  { key: "5j", label: "5 J.", years: 5 },
  { key: "10j", label: "10 J.", years: 10 },
  { key: "20j", label: "20 J.", years: 20 },
  { key: "max", label: "Max.", years: null },
] as const;

export function periodOf(raw: string | undefined): (typeof PERIODS)[number] {
  return PERIODS.find((p) => p.key === raw) ?? PERIODS[3];
}

/** Punkte ab dem Stichtag `years` Jahre vor dem letzten Punkt; `null` heißt alles. */
export function sinceYears<T extends { date: string }>(points: readonly T[], years: number | null): T[] {
  const last = points.at(-1);
  if (!last || years === null) return [...points];
  const [y, m, d] = last.date.split("-");
  const start = `${Number(y) - years}-${m}-${d}`;
  return points.filter((p) => p.date >= start);
}

/** Jahre zwischen zwei Tagen, auf Tage genau. */
export function yearsBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / (365.25 * 24 * 3600 * 1000);
}

/** Jährliche Wachstumsrate; `null` ohne positiven Anfangs- und Endwert oder ohne Zeitspanne. */
export function cagr(first: number, last: number, years: number): number | null {
  if (!(first > 0) || !(last > 0) || !(years > 0)) return null;
  return (last / first) ** (1 / years) - 1;
}

/** Größter Rückgang vom bisherigen Höchststand, als negative Zahl (−0,35 = 35 % unter dem Hoch); 0 ohne Rückgang. */
export function maxDrawdown(values: readonly number[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let worst = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    if (peak > 0) worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

export interface PeriodStats {
  from: string;
  to: string;
  priceReturn: number | null;
  totalReturn: number | null;
  /** Gesamtrendite (mit Dividenden) pro Jahr; unter einem Jahr die einfache Rendite. */
  totalPerYear: number | null;
  drawdown: number;
}

export function periodStats(points: readonly PricePoint[]): PeriodStats | null {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || first === last) return null;
  const years = yearsBetween(first.date, last.date);
  const totalReturn = last.total / first.total - 1;
  return {
    from: first.date,
    to: last.date,
    priceReturn: last.price / first.price - 1,
    totalReturn,
    totalPerYear: years >= 1 ? cagr(first.total, last.total, years) : totalReturn,
    drawdown: maxDrawdown(points.map((p) => p.total)),
  };
}

export interface DividendYear {
  year: number;
  sum: number;
  payments: number;
  /** Laufendes Jahr: noch nicht alle Zahlungen da. */
  partial: boolean;
}

/**
 * Dividenden je Kalenderjahr in einer Währung (Zahlungen in anderen Währungen fallen weg, sonst stimmen die Summen nicht).
 * Jahre ohne Zahlung zwischen der ersten und der letzten bleiben mit 0 stehen, damit Kürzungen sichtbar sind.
 */
export function dividendsByYear(
  payments: readonly { date: string; value: number; currency: string }[],
  currency: string,
  today: string,
): DividendYear[] {
  const sums = new Map<number, { sum: number; payments: number }>();
  for (const p of payments) {
    if (p.currency !== currency || !(p.value > 0)) continue;
    const year = Number(p.date.slice(0, 4));
    const entry = sums.get(year) ?? { sum: 0, payments: 0 };
    entry.sum += p.value;
    entry.payments += 1;
    sums.set(year, entry);
  }
  if (sums.size === 0) return [];
  const years = [...sums.keys()];
  const currentYear = Number(today.slice(0, 4));
  const out: DividendYear[] = [];
  for (let year = Math.min(...years); year <= Math.max(...years); year++) {
    const entry = sums.get(year) ?? { sum: 0, payments: 0 };
    out.push({ year, ...entry, partial: year >= currentYear });
  }
  return out;
}

/** Summe der Dividenden der letzten zwölf Monate bis `today` in einer Währung. */
export function trailingDividends(
  payments: readonly { date: string; value: number; currency: string }[],
  currency: string,
  today: string,
): number {
  const [y, m, d] = today.split("-");
  const start = `${Number(y) - 1}-${m}-${d}`;
  return payments.filter((p) => p.currency === currency && p.date > start && p.date <= today).reduce((s, p) => s + p.value, 0);
}

/** Wachstum der Dividende pro Jahr über `years` volle Jahre bis zum letzten vollständigen Jahr. */
export function dividendGrowth(years: readonly DividendYear[], span: number): number | null {
  const complete = years.filter((y) => !y.partial);
  const last = complete.at(-1);
  const first = complete.find((y) => last && y.year === last.year - span);
  return last && first ? cagr(first.sum, last.sum, span) : null;
}

/** Jahre in Folge ohne Kürzung bis zum letzten vollständigen Jahr (gleich hoch zählt mit). */
export function yearsWithoutCut(years: readonly DividendYear[]): number {
  const complete = years.filter((y) => !y.partial);
  let count = 0;
  for (let i = complete.length - 1; i > 0; i--) {
    const cur = complete[i]!;
    const prev = complete[i - 1]!;
    if (cur.sum <= 0 || cur.sum < prev.sum * 0.999) break;
    count++;
  }
  return count;
}

/** Letzter Kurs eines Kalenderjahres (Dezember oder letzter Monat davor). */
export function yearEndPrice(points: readonly PricePoint[], year: number): number | null {
  const end = `${year}-12-31`;
  let found: PricePoint | null = null;
  for (const p of points) if (p.date <= end && p.date >= `${year}-01-01`) found = p;
  return found?.price ?? null;
}

export interface YearMultiple {
  year: number;
  /** Kurs zum Jahresende geteilt durch den Gewinn je Aktie; `null` bei Verlust. */
  pe: number | null;
  /** Dividende des Jahres geteilt durch den Kurs zum Jahresende. */
  dividendYield: number | null;
}

/**
 * KGV und Dividendenrendite zum Ende jedes Geschäftsjahres. Gewinn und Kurs müssen in derselben Währung stehen, sonst
 * gibt es kein KGV; die Dividendenrendite kommt aus den Zahlungen in Kurswährung und braucht das nicht.
 */
export function yearMultiples(
  fundamentals: readonly FundamentalsYear[],
  points: readonly PricePoint[],
  dividends: readonly DividendYear[],
  sameCurrency: boolean,
): YearMultiple[] {
  const years = new Set<number>([...fundamentals.map((f) => f.fiscalYear), ...dividends.filter((d) => !d.partial).map((d) => d.year)]);
  const out: YearMultiple[] = [];
  for (const year of [...years].sort((a, b) => a - b)) {
    const price = yearEndPrice(points, year);
    if (price === null) continue;
    const eps = fundamentals.find((f) => f.fiscalYear === year)?.epsDiluted ?? null;
    const dividend = dividends.find((d) => d.year === year && !d.partial)?.sum ?? null;
    out.push({
      year,
      pe: sameCurrency && eps !== null && eps > 0 ? price / eps : null,
      dividendYield: dividend !== null ? dividend / price : null,
    });
  }
  return out;
}

export type Unit = "amount" | "big" | "percent" | "times";

export interface FundamentalSeries {
  key: string;
  label: string;
  unit: Unit;
  /** Kurze Erklärung unter dem Diagramm. */
  hint: string;
  values: { year: number; value: number | null }[];
}

const ratio = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b);

/** Kennzahlen je Geschäftsjahr für die kleinen Diagramme; Reihen ohne einen einzigen Wert fallen weg. */
export function fundamentalSeries(years: readonly FundamentalsYear[]): FundamentalSeries[] {
  const series = (
    key: string,
    label: string,
    unit: Unit,
    hint: string,
    pick: (y: FundamentalsYear) => number | null,
  ): FundamentalSeries => ({
    key,
    label,
    unit,
    hint,
    values: years.map((y) => {
      const v = pick(y);
      return { year: y.fiscalYear, value: v !== null && Number.isFinite(v) ? v : null };
    }),
  });
  const all = [
    series("revenue", "Umsatz", "big", "Erlöse des Geschäftsjahres", (y) => y.revenue),
    series("ebit", "Operatives Ergebnis (EBIT)", "big", "Gewinn vor Zinsen und Steuern", (y) => y.ebit),
    series("eps", "Gewinn je Aktie", "amount", "verwässert", (y) => y.epsDiluted),
    series("dps", "Dividende je Aktie", "amount", "laut Abschluss", (y) => y.dividendPerShare),
    series("fcf", "Freier Cashflow", "big", "operativer Cashflow abzüglich Investitionen", (y) => y.freeCashFlow),
    series("margin", "EBIT-Marge", "percent", "EBIT geteilt durch Umsatz", (y) => ratio(y.ebit, y.revenue)),
    series("payout", "Ausschüttungsquote", "percent", "Dividende je Aktie geteilt durch Gewinn je Aktie", (y) =>
      y.epsDiluted !== null && y.epsDiluted > 0 ? ratio(y.dividendPerShare, y.epsDiluted) : null,
    ),
    series("roe", "Eigenkapitalrendite", "percent", "Gewinn geteilt durch Eigenkapital", (y) =>
      y.equity !== null && y.equity > 0 && y.epsDiluted !== null && y.shares !== null ? (y.epsDiluted * y.shares) / y.equity : null,
    ),
    series("leverage", "Nettoschulden zum EBITDA", "times", "Jahre, die das EBITDA zum Tilgen bräuchte", (y) =>
      y.ebitda !== null && y.ebitda > 0 ? ratio(y.netDebt, y.ebitda) : null,
    ),
    series("shares", "Aktienanzahl", "big", "sinkt bei Rückkäufen, steigt bei Ausgaben", (y) => y.shares),
    series("buybacks", "Rückkäufe netto", "big", "Rückkäufe abzüglich ausgegebener Aktien", (y) =>
      y.repurchases === null ? null : Math.abs(y.repurchases) - Math.abs(y.issuance ?? 0),
    ),
    series("equityRatio", "Eigenkapitalquote", "percent", "Eigenkapital geteilt durch Bilanzsumme", (y) => ratio(y.equity, y.totalAssets)),
  ];
  return all.filter((s) => s.values.some((v) => v.value !== null));
}

/** Letzte `count` Jahre mit Wert und alles dazwischen; davor liegende Lücken fallen weg. */
export function recentYears<T extends { value: number | null }>(values: readonly T[], count: number): T[] {
  // Eine 0 am Anfang ist meist ein fehlender Wert des Anbieters (Dividende 0 vor der ersten gemeldeten); sie fällt mit weg.
  const firstWithValue = values.findIndex((v) => v.value !== null && v.value !== 0);
  const trimmed = firstWithValue < 0 ? [] : values.slice(firstWithValue);
  return trimmed.slice(-count);
}

/** Runde Teilstriche für eine Achse von `min` bis `max`, etwa `count` Stück (1, 2, 2,5 oder 5 mal Zehnerpotenz). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return niceTicks(min - pad, max + pad, count);
  }
  const raw = (max - min) / Math.max(1, count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * power >= raw) ?? 10) * power;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v / step) * step);
  if (ticks.at(-1)! < max) ticks.push(ticks.at(-1)! + step);
  return ticks;
}

/** Teilstriche für eine logarithmische Achse: 1, 2, 5 je Zehnerpotenz, höchstens etwa sieben. */
export function logTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > 0)) return [];
  const collect = (factors: readonly number[]) => {
    const ticks: number[] = [];
    for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) {
      for (const f of factors) {
        const v = f * 10 ** p;
        if (v >= min / 1.0001 && v <= max * 1.0001) ticks.push(v);
      }
    }
    return ticks;
  };
  const fine = collect([1, 2, 5]);
  if (fine.length > 7) return collect([1]);
  return fine.length < 4 ? collect([1, 1.5, 2, 3, 5, 7]) : fine;
}

/** Ob eine logarithmische Achse lesbarer ist: über viele Jahre und mehr als das Fünffache zwischen Tief und Hoch. */
export function preferLog(values: readonly number[], years: number): boolean {
  const positive = values.filter((v) => v > 0);
  if (positive.length < 2 || years < 10) return false;
  return Math.max(...positive) / Math.min(...positive) > 5;
}

/** Große Beträge kurz: 1,2 Mrd., 350 Mio., 12.300. */
export function compact(value: number | null): string {
  if (value === null) return "–";
  const abs = Math.abs(value);
  const fmt = (v: number, digits: number) => v.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  if (abs >= 1e12) return `${fmt(value / 1e12, 1)} Bio.`;
  if (abs >= 1e9) return `${fmt(value / 1e9, abs >= 1e11 ? 0 : 1)} Mrd.`;
  if (abs >= 1e6) return `${fmt(value / 1e6, abs >= 1e8 ? 0 : 1)} Mio.`;
  if (abs >= 1e4) return fmt(value, 0);
  return fmt(value, abs >= 100 ? 0 : 2);
}

/** Wert in der Einheit einer Reihe als Text. */
export function formatUnit(value: number | null, unit: Unit): string {
  if (value === null) return "–";
  if (unit === "percent") return `${(value * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`;
  if (unit === "times") return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}×`;
  if (unit === "big") return compact(value);
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Trend einer Reihe in Worten für die Fußzeile: Wachstum pro Jahr über die gezeigten Jahre, sonst Veränderung in Punkten. */
export function trendText(values: readonly { year: number; value: number | null }[], unit: Unit): string | null {
  const known = values.filter((v): v is { year: number; value: number } => v.value !== null);
  const first = known[0];
  const last = known.at(-1);
  if (!first || !last || first === last) return null;
  const span = last.year - first.year;
  if (unit === "percent") {
    const diff = (last.value - first.value) * 100;
    return `${diff >= 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Punkte seit ${first.year}`;
  }
  if (unit === "times") return `${formatUnit(first.value, unit)} → ${formatUnit(last.value, unit)} seit ${first.year}`;
  const growth = cagr(first.value, last.value, span);
  if (growth === null) return null;
  return `${growth >= 0 ? "+" : "−"}${Math.abs(growth * 100).toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} % pro Jahr seit ${first.year}`;
}
