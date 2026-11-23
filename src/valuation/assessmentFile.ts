// Bewertungen von außen (etwa eines Modells wie Opus) als Datei: Dossier je Aktie zum Lesen, Ergebnisdatei zum Setzen.
// Skripte: pnpm run bewertung:dossier, bewertung:vorfilter, bewertung:setzen; Ablauf im Skill .claude/skills/bewertung.

import { z } from "zod";
import { EXCLUSION_SCORE } from "../calc/index.ts";
import { type Database, type Stock, sourceOfNote } from "../data/db.ts";
import { assess, computeValuation, inflationGapOf } from "./run.ts";
import { INPUT_KEYS, type InputKey, parseManualInput, type Valuation } from "./valuation.ts";

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
  // Faktoren dürfen mit dem Schlüssel aus dem Dossier kommen (`risk.moat`) oder ohne Vorsilbe (`moat`); Modelle schreiben beides.
  const texts: [string, string][] = [];
  for (const [factor, e] of Object.entries(file.judgement)) {
    const key = factor.startsWith("risk.") ? factor : `risk.${factor}`;
    if (texts.some(([k]) => k === key)) errors.push(`${key}: doppelt angegeben`);
    else texts.push([key, percentText(e.value)]);
  }
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

/**
 * Puffer über dem Ausschluss, ab dem der Vorfilter einen Titel verwirft, ohne dass Opus ihn sieht. Im Vergleich vom 23.11.2026
 * (30 Titel) zog Haiku mehr ab als Opus, bei einzelnen Titeln um 20 Punkte; ohne Puffer fielen Titel heraus, die Opus behält.
 */
export const PREFILTER_RISK_MARGIN = 0.1;

export interface PrefilterResult {
  verdict: "verworfen" | "opus";
  reason: string;
  /** Risikowert ohne Ersatzabzüge (`riskFloor`), gegen den der Ausschluss auf der Watchlist prüft (Strategie 6.4). */
  riskFloor: number | null;
  innerReturn: number | null;
}

type Update = { key: InputKey; value: number | null; note?: string };

/** Haiku-Werte, die die Datei nicht überschreibt; sie fallen weg, damit kein alter Haiku-Wert neben einer neuen Bewertung steht. */
function staleHaikuInputs(db: Database, stockId: string, keys: ReadonlySet<InputKey>): Update[] {
  return db
    .manualInputs(stockId)
    .filter((input) => sourceOfNote(input.note) === "haiku" && !keys.has(input.key as InputKey))
    .map((input) => ({ key: input.key as InputKey, value: null }));
}

/**
 * Änderungen für eine Ergebnisdatei von Opus: alle Werte der Datei mit Notiz, dazu das Löschen der Haiku-Werte, die die Datei
 * nicht überschreibt. Sonst bliebe etwa ein Wachstum von Haiku stehen, das Opus bewusst offen lässt.
 */
export function assessmentUpdates(db: Database, stockId: string, fields: ParsedAssessment["fields"], note: string): Update[] {
  return [...fields.map((f) => ({ ...f, note })), ...staleHaikuInputs(db, stockId, new Set(fields.map((f) => f.key)))];
}

/**
 * Änderungen für eine Ergebnisdatei des Vorfilters: nur Werte, die fehlen oder schon von Haiku stammen. Eigene Werte, übernommene
 * Jev-Vorschläge und von einem Menschen geänderte Haiku-Werte (deren Notiz beim Ändern wegfällt) bleiben stehen.
 */
export function prefilterUpdates(db: Database, stockId: string, fields: ParsedAssessment["fields"], note: string): Update[] {
  const existing = new Map(db.manualInputs(stockId).map((input) => [input.key, sourceOfNote(input.note)]));
  const writable = fields.filter((f) => !existing.has(f.key) || existing.get(f.key) === "haiku");
  return [...writable.map((f) => ({ ...f, note })), ...staleHaikuInputs(db, stockId, new Set(fields.map((f) => f.key)))];
}

/** Ob ein Titel schon mit Opus bewertet ist; der Vorfilter lässt solche Titel ganz aus. */
export function hasOpusAssessment(db: Database, stockId: string): boolean {
  return db.manualInputs(stockId).some((input) => sourceOfNote(input.note) === "opus");
}

/**
 * Urteil des Vorfilters über eine Bewertung mit den Werten des billigen Modells: verworfen, wenn der Risikowert ohne
 * Ersatzabzüge auch mit Puffer über dem Ausschluss liegt, sonst an Opus. Ohne Ersatzabzüge, weil der Ausschluss auf der
 * Watchlist so prüft (Strategie 6.4): Ein offener Faktor eines Finanzwerts soll keinen Titel verwerfen, den ein Urteil retten
 * kann. Die Rendite filtert nicht: Hier lag das billige Modell in beide Richtungen weit daneben (Wachstum der Zykliker).
 */
export function prefilterVerdict(v: Pick<Valuation, "riskFloor" | "complete" | "missing" | "returns">): PrefilterResult {
  const limit = EXCLUSION_SCORE + PREFILTER_RISK_MARGIN;
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
  const result = { riskFloor: v.riskFloor, innerReturn: v.returns?.base ?? null };
  if (v.riskFloor >= limit) return { ...result, verdict: "verworfen", reason: `Risikowert ${pct(v.riskFloor)} ab ${pct(limit)}` };
  const reason = v.complete ? `Risikowert ${pct(v.riskFloor)} unter ${pct(limit)}` : `unvollständig: ${v.missing.join(", ")}`;
  return { ...result, verdict: "opus", reason };
}

export type PrefilterOutcome = PrefilterResult | { verdict: "übersprungen"; reason: string };

/**
 * Vorfilter für einen Titel: setzt die Werte der Haiku-Datei (`prefilterUpdates`) und urteilt über die Bewertung damit. Titel mit
 * Opus-Bewertung bleiben unberührt. Eine fehlerhafte Datei setzt nichts und schickt den Titel an Opus; Haiku-Werte eines früheren
 * Laufs bleiben dann stehen, bis Opus sie ersetzt.
 */
export function prefilterStock(db: Database, stock: Stock, raw: unknown, date: string, note: string): PrefilterOutcome {
  if (hasOpusAssessment(db, stock.id)) return { verdict: "übersprungen", reason: "schon mit Opus bewertet" };
  const { fields, errors } = parseAssessment(raw, stock.reportingCurrency, inflationGapOf(db, stock).gap);
  if (errors.length > 0) return { verdict: "opus", reason: `Datei fehlerhaft: ${errors.join("; ")}`, riskFloor: null, innerReturn: null };
  const updates = prefilterUpdates(db, stock.id, fields, note);
  const { valuation } = updates.length > 0 ? assess(db, stock, updates, date) : computeValuation(db, stock, date);
  return prefilterVerdict(valuation);
}
