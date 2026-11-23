// Bewertungen von außen (etwa eines Modells wie Opus) als Datei: Dossier je Aktie zum Lesen, Ergebnisdatei zum Setzen.
// Skripte: pnpm run bewertung:dossier, pnpm run bewertung:setzen; Ablauf im Skill .claude/skills/opus-bewertung.

import { z } from "zod";
import type { Database } from "../data/db.ts";
import { computeValuation } from "./run.ts";
import { INPUT_KEYS, type InputKey, parseManualInput } from "./valuation.ts";

/** Alles, was zur Bewertung einer Aktie gehört, in einer Form, die ein Mensch oder ein Modell lesen kann. */
export function dossier(db: Database, stockId: string, date: string): unknown {
  const stock = db.stock(stockId);
  if (!stock) throw new Error(`Unbekannte Aktie ${stockId}`);
  const { valuation: v, proposals } = computeValuation(db, stock, date);
  const judgement = db.judgement(stockId);
  return {
    stock,
    date,
    price: db.latestPrice(stockId),
    valuation: {
      inputs: v.inputs,
      manual: v.manual,
      missing: v.missing,
      complete: v.complete,
      riskScore: v.riskScore,
      riskClass: v.riskClass,
      price: v.price,
      returns: v.returns,
      localReturn: v.localReturn,
      inflationGap: v.inflationGap,
      payoutRatio: v.payoutRatio,
    },
    proposals,
    manualInputs: db.manualInputs(stockId),
    jev: judgement
      ? {
          model: judgement.jevModel,
          createdAt: judgement.createdAt,
          levelsVersion: judgement.levelsVersion,
          proposals: judgement.proposals,
        }
      : null,
    research: judgement
      ? { model: judgement.researchModel, at: judgement.researchedAt, text: judgement.research, sources: judgement.sources }
      : null,
    fundamentals: db.fundamentals(stockId).slice(-12),
    dividends: (db.dividends(stockId) ?? []).slice(-24),
  };
}

const Entry = z.object({ value: z.number().finite() });
/** Ergebnisdatei je Aktie; Begründungen und Quellen dürfen dabei stehen, gesetzt werden nur die Werte. */
const AssessmentFile = z.looseObject({
  stockId: z.string().min(1),
  reportingCurrency: z.string().min(3),
  judgement: z.record(z.string(), Entry),
  payoutLevel: Entry.nullish(),
  growth: Entry.nullish(),
});

export interface ParsedAssessment {
  stockId: string;
  /** Eingabe und Wert, wie ihn die Aktienseite als Text annimmt (Prozent für Faktoren und Wachstum). */
  fields: { key: InputKey; value: number }[];
  errors: string[];
}

const percentText = (value: number) => String(Math.round(value * 100 * 1e6) / 1e6);

/**
 * Prüft eine Ergebnisdatei und übersetzt sie in Werte von Hand. Die Berichtswährung muss zur Aktie passen, sonst stimmt das
 * Rückflussniveau nicht; jeder Wert geht durch dieselbe Prüfung wie auf der Aktienseite.
 */
export function parseAssessment(raw: unknown, reportingCurrency: string, inflationGap: number): ParsedAssessment {
  const parsed = AssessmentFile.safeParse(raw);
  if (!parsed.success)
    return { stockId: "", fields: [], errors: [`Datei hat nicht die erwartete Form: ${parsed.error.issues[0]?.message}`] };
  const file = parsed.data;
  const errors: string[] = [];
  if (file.reportingCurrency !== reportingCurrency) {
    errors.push(`Berichtswährung ${file.reportingCurrency} passt nicht zur Aktie (${reportingCurrency}).`);
  }
  const texts: [string, string][] = Object.entries(file.judgement).map(([factor, e]) => [`risk.${factor}`, percentText(e.value)]);
  if (file.payoutLevel) texts.push(["payoutLevel", String(file.payoutLevel.value)]);
  if (file.growth) texts.push(["growth", percentText(file.growth.value)]);
  const fields: ParsedAssessment["fields"] = [];
  for (const [key, text] of texts) {
    if (!(INPUT_KEYS as readonly string[]).includes(key)) {
      errors.push(`${key}: unbekannte Eingabe`);
      continue;
    }
    const result = parseManualInput(key as InputKey, text, inflationGap);
    if ("error" in result) errors.push(`${key}=${text}: ${result.error}`);
    else fields.push({ key: key as InputKey, value: result.value });
  }
  return { stockId: file.stockId, fields, errors };
}
