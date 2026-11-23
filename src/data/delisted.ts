// Eingestellte Titel für den Rückblick (Survivorship): Monatskurse aus `monthly-prices.jsonl` (Schritt A, siehe
// docs/Selbstlernende-Strategie.md, Stufe 6) und die Auswahl der Titel, deren Abschlüsse sich zu laden lohnen.

import { z } from "zod";
import { IsoDate } from "./eodhd.ts";

/** Ein Monatsbalken: Datum, Schlusskurs, bereinigter Schlusskurs, Volumen. */
const Bar = z.tuple([IsoDate, z.number().finite(), z.number().finite().nullable(), z.number().finite().nullable()]);

const Line = z.object({
  code: z.string().min(1),
  name: z.string(),
  exchange: z.string(),
  isin: z.string().nullable(),
  bars: z.array(Bar),
});

export interface DelistedCandidate {
  /** EODHD-Symbol, z. B. SIVB.US. */
  id: string;
  name: string;
  exchange: string;
  /** Letzter Kurstag. */
  lastDate: string;
  /** Mittlerer Monatsumsatz in USD (Schlusskurs mal Volumen) der letzten zwölf Monate. */
  turnover: number;
  bars: { date: string; close: number; adjustedClose: number }[];
}

/** Mittlerer Monatsumsatz der letzten zwölf Balken; fehlendes Volumen zählt als 0. */
function turnoverOf(bars: readonly z.infer<typeof Bar>[]): number {
  const last = bars.slice(-12);
  return last.reduce((sum, [, close, , volume]) => sum + close * (volume ?? 0), 0) / Math.max(1, last.length);
}

/** Liest die Zeilen der Datei; wirft bei einer Zeile in fremder Form, statt sie still zu überspringen. */
export function parseDelistedLines(text: string, suffix = "US"): DelistedCandidate[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line, i) => {
      const parsed = Line.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`Zeile ${i + 1}: ${parsed.error.issues[0]?.message ?? "unlesbar"}`);
      const { code, name, exchange, bars } = parsed.data;
      if (bars.length === 0) return [];
      return [
        {
          id: `${code}.${suffix}`,
          name,
          exchange,
          lastDate: bars.at(-1)![0],
          turnover: turnoverOf(bars),
          bars: bars.map(([date, close, adjusted]) => ({ date, close, adjustedClose: adjusted ?? close })),
        },
      ];
    });
}

export interface Selection {
  /** Reihe endet an oder nach diesem Tag (ISO). */
  endedSince: string;
  /** Mindestumsatz je Monat in USD (einschließlich). */
  minTurnover: number;
  /** Obergrenze (ausschließlich), um Stufen abzugrenzen. */
  maxTurnover?: number;
  /** Mindestzahl Monatsbalken. */
  minMonths?: number;
}

/** Auswahl nach fallendem Umsatz, bei Gleichstand nach Symbol. */
export function selectDelisted(all: readonly DelistedCandidate[], s: Selection): DelistedCandidate[] {
  return all
    .filter(
      (c) =>
        c.lastDate >= s.endedSince &&
        c.turnover >= s.minTurnover &&
        (s.maxTurnover === undefined || c.turnover < s.maxTurnover) &&
        c.bars.length >= (s.minMonths ?? 12),
    )
    .sort((a, b) => b.turnover - a.turnover || a.id.localeCompare(b.id));
}
