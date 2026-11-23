// Gespeicherte Läufe wieder einlesen (für den Vergleich zweier Stände). Die Dateien sind von außen veränderbar, also mit zod geprüft.

import { z } from "zod";
import type { BacktestSummary } from "./report.ts";

const Metrics = z.object({ total: z.number(), cagr: z.number().nullable(), vol: z.number(), maxDrawdown: z.number() });

const Saved = z.object({
  name: z.string(),
  meta: z.record(z.string(), z.unknown()),
  months: z.array(z.string()),
  strategy: z.array(z.number()),
  benchmark: z.array(z.number()).nullable(),
  full: z.object({
    strategy: Metrics.extend({ turnover: z.number(), holdings: z.number() }),
    benchmark: Metrics.nullable(),
  }),
  periods: z.array(
    z.object({ label: z.string(), strategy: z.number(), benchmark: z.number().nullable(), randomMedian: z.number().nullable() }),
  ),
  windows: z.array(
    z.object({
      start: z.string(),
      strategy: z.object({ total: z.number(), vol: z.number(), maxDrawdown: z.number(), turnover: z.number() }),
      benchmark: z.number().nullable(),
      cashRate: z.number().optional(),
    }),
  ),
  random: z
    .object({
      runs: z.number(),
      median: z.array(z.number()),
      p5: z.array(z.number()),
      p95: z.array(z.number()),
      shareBeatingStrategy: z.number(),
      shareBeatingBenchmark: z.number().nullable(),
      turnover: z.number(),
    })
    .nullable(),
  diagnostics: z
    .object({
      skipped: z.record(z.string(), z.number()),
      delistings: z.array(z.string()),
      outliers: z.array(z.object({ month: z.string(), id: z.string(), name: z.string(), monthlyReturn: z.number() })),
      stocksWithBars: z.number(),
      ratesFallback: z.number().optional(),
    })
    .optional(),
});

export function parseSaved(json: unknown): BacktestSummary {
  // JSON kennt kein NaN: Eine nicht berechenbare Rendite p. a. steht als null in der Datei.
  const saved = Saved.parse(json);
  const nan = (m: { total: number; cagr: number | null; vol: number; maxDrawdown: number }) => ({ ...m, cagr: m.cagr ?? Number.NaN });
  return {
    ...saved,
    full: {
      strategy: { ...saved.full.strategy, ...nan(saved.full.strategy) },
      benchmark: saved.full.benchmark && nan(saved.full.benchmark),
    },
  };
}
