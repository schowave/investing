// Bewertet eine Aktie aus der Datenbank, speichert den Tagesstand und nimmt die Eingaben von Hand entgegen.
//
// Der Tagesstand ist zugleich der Prüfstand: „Bewertung prüfen“ vergleicht die Vorschläge von heute mit denen vom Tag
// der Bewertung. Sein Format steht deshalb nur hier, geschrieben in `valueStock`, gelesen in `computeValuation`.

import { z } from "zod";
import { type Database, type Stock, sourceOfNote } from "../data/db.ts";
import { currentProposals } from "../judgement/factors.ts";
import { dataWarnings } from "./dataChecks.ts";
import type { Basis, Review } from "./review.ts";
import { basisOf, reviewOf } from "./review.ts";
import type { InputKey, InputValues, Proposals, Valuation } from "./valuation.ts";
import { dividendsByYear, evaluate, INPUT_KEYS, priceInReportingCurrency, proposeInputs, shareJump, splitBasis } from "./valuation.ts";

/**
 * Version der Rechnung. Erhöhen, wenn sich Vorschläge oder Bewertung für gespeicherte Daten ändern: Der Worker
 * rechnet dann alle gespeicherten Stände neu (`recomputeAll`), und „Bewertung prüfen“ sagt dazu, dass Verschiebungen
 * seit der Bewertung auch aus der neuen Rechnung kommen können. Ältere Tagesstände im Verlauf bleiben, wie sie gerechnet
 * wurden; an der Versionsgrenze kann der Verlauf deshalb springen.
 */
export const CALC_VERSION = 10;

/**
 * Version der Strategie, wie sie im Kopf von `docs/STRATEGIE.md` steht (ein Test vergleicht beide). Steigt bei jeder Änderung,
 * die das Zielportfolio verändern kann, im selben Commit wie das Dokument und der Eintrag in `docs/STRATEGIE-AENDERUNGEN.md`;
 * reine Textänderungen lassen sie stehen. `CALC_VERSION` bleibt der technische Auslöser fürs Neurechnen.
 */
export const STRATEGY_VERSION = "1.0";

/** Gespeicherter Tagesstand; nur `calcVersion` und die Vorschläge werden wieder gelesen. */
const StoredDetails = z.object({
  // Fehlt bei Tagesständen, die vor der Einführung der Version gespeichert wurden.
  calcVersion: z.number().int().default(1),
  proposals: z.object({
    values: z.record(z.string(), z.number()),
    details: z.object({ earningsLevel: z.number().nullable().optional() }),
  }),
});

/** Prüfstand aus einem gespeicherten Tagesstand; `null`, wenn er die Vorschläge nicht enthält. */
export function storedBaseline(details: unknown): { basis: Basis; calcVersion: number } | null {
  const parsed = StoredDetails.safeParse(details);
  return parsed.success ? { basis: basisOf(parsed.data.proposals), calcVersion: parsed.data.calcVersion } : null;
}

export interface StockValuation {
  stock: Stock;
  priceDate: string | null;
  proposals: Proposals;
  valuation: Valuation;
  /** Alter der Bewertung und was sich seither an den Vorschlägen verschoben hat. */
  review: Review;
}

/**
 * Erwartete Inflation der Berichtswährung minus die des Euro (IWF-Prognose, Strategie 5.3). Sie macht die Rendite mit
 * dem Euro vergleichbar und verschiebt die Wachstumsgrenzen (Strategie 4.6). Für den Euro und ohne Prognose 0; fehlt die
 * Prognose einer Fremdwährung, ist `missing` gesetzt.
 */
export function inflationGapOf(db: Database, stock: Stock): { gap: number; missing: boolean } {
  if (stock.reportingCurrency === "EUR") return { gap: 0, missing: false };
  const local = db.referenceRate(`inflation:${stock.reportingCurrency}`);
  const euro = db.referenceRate("inflation:EUR");
  return local !== null && euro !== null ? { gap: local - euro, missing: false } : { gap: 0, missing: true };
}

/**
 * Rechnet die Bewertung, ohne etwas zu speichern. @param date ISO-Datum der Bewertung, z. B. 2026-11-19.
 * @param options.manual `false` lässt die Eingaben von Hand (und damit die übernommenen Jev-Urteile) weg: nur Zahlen.
 */
export function computeValuation(db: Database, stock: Stock, date: string, options: { manual?: boolean } = {}): StockValuation {
  const reportingPerEur = db.latestFxRate(stock.reportingCurrency);
  const payments = db.dividends(stock.id);
  const history = {
    dividendsByYear: payments === null ? null : dividendsByYear(payments, stock.reportingCurrency, date),
    splits: db.splits(stock.id),
  };
  // Fremdwährung: Inflationsunterschied zum Euro verschiebt die Wachstumsgrenzen und wird von der Rendite abgezogen.
  const { gap: inflationGap, missing: noForecast } = inflationGapOf(db, stock);
  const fundamentals = db.fundamentals(stock.id);
  const proposals = proposeInputs(stock, fundamentals, reportingPerEur, Number(date.slice(0, 4)), history, inflationGap);
  // Split nach dem letzten Abschluss: Der Kurs gilt schon nach dem Split, ob die Abschlüsse bereinigt sind, zeigt erst der
  // nächste. Bis dahin passen Werte je Aktie und Kurs womöglich nicht zusammen (Sandisk 2026: Faktor 8). Der Rückblick
  // überspringt solche Monate selbst (src/backtest/candidates.ts).
  // Warnungen nur der Anwendung (Spezifikation 4.1), nicht für Rückblick und Vorwärtsprotokoll (`manual: false`), weil sie dort
  // das Ergebnis verschlechterten (Strategie 11.20). Zeitweise andere Stückelung der Aktienzahl:
  const appChecks = options.manual !== false;
  if (appChecks) proposals.details.shareJump = shareJump(fundamentals.slice(-10));
  // Split ab dem Beginn des letzten Geschäftsjahrs, ohne Beleg, dass die Zahlen bereinigt sind. Ab Jahresbeginn statt
  // Jahresende, weil das Geschäftsjahr nicht im Dezember enden muss; einen Split im Jahr selbst erkennt splitBasis als bereinigt.
  const lastYear = fundamentals.at(-1)?.fiscalYear;
  if (appChecks && !proposals.details.unadjustedSplit && lastYear !== undefined) {
    const later = history.splits.find(
      (s) => Math.abs(s.ratio - 1) >= 0.2 && s.date >= `${lastYear}-01-01` && s.date <= date && splitBasis(fundamentals, s) !== "adjusted",
    );
    if (later) {
      proposals.details.unadjustedSplit = later;
      proposals.notes.push(
        `Aktiensplit vom ${later.date} liegt nach dem letzten Abschluss (${lastYear}); ob dessen Zahlen je Aktie schon bereinigt sind, zeigt erst der nächste.`,
      );
    }
  }
  if (noForecast)
    proposals.notes.push(`Keine Inflationsprognose für ${stock.reportingCurrency}; die Rendite ist nicht mit Euro-Titeln vergleichbar.`);

  const manual: InputValues = {};
  // Jedes Speichern der Bewertung setzt das Datum aller Eingaben von Hand neu; das jüngste ist der Tag der Bewertung.
  let assessedOn: string | null = null;
  for (const input of options.manual === false ? [] : db.manualInputs(stock.id)) {
    if (!(INPUT_KEYS as string[]).includes(input.key)) continue;
    manual[input.key as InputKey] = input.value;
    const setOn = input.updatedAt.slice(0, 10);
    if (assessedOn === null || setOn > assessedOn) assessedOn = setOn;
    // Ein Betrag je Aktie, der vor einem Split gesetzt wurde, passt danach nicht mehr zum Kurs.
    if (input.key === "payoutLevel") manual.payoutLevel = afterSplits(input, history.splits, proposals.notes);
  }

  const latest = db.latestPrice(stock.id);
  const price = latest ? priceInReportingCurrency(latest.close, db.latestFxRate(stock.priceCurrency), reportingPerEur) : null;
  const valuation = evaluate(
    proposals.values,
    manual,
    price,
    inflationGap,
    proposals.details.earningsLevel,
    proposals.details.payoutEarningsLevel ?? null,
    proposals.standIns,
  );

  // Verdächtige Anbieterdaten als Hinweis, nur in der Anwendung (Spezifikation 4.1); sie ändern keine Rechnung.
  if (appChecks) {
    proposals.notes.push(
      ...dataWarnings({
        stock,
        years: fundamentals.slice(-10),
        payments,
        netBuybacksPerShare: proposals.details.netBuybacksPerShare,
        price,
        splits: history.splits,
      }),
    );
  }

  // Verglichen wird mit dem Tagesstand vom Tag der Bewertung. Ihn speichern der Abgleich und das Speichern der Bewertung.
  const before = assessedOn === null ? null : storedBaseline(db.valuationDetailsAsOf(stock.id, assessedOn));
  const review = reviewOf({
    assessedOn,
    today: date,
    before: before?.basis ?? null,
    now: basisOf(proposals),
    inflationGap,
    calcChanged: before !== null && before.calcVersion !== CALC_VERSION,
  });

  return { stock, priceDate: latest?.date ?? null, proposals, valuation, review };
}

/** Manueller Betrag je Aktie, um alle Splits nach seinem Setzen bereinigt; jede Bereinigung steht in den Hinweisen. */
function afterSplits(
  input: { value: number; updatedAt: string },
  splits: readonly { date: string; ratio: number }[],
  notes: string[],
): number {
  const setOn = input.updatedAt.slice(0, 10);
  let value = input.value;
  for (const split of splits.filter((s) => s.date > setOn && s.ratio > 0)) {
    value /= split.ratio;
    notes.push(
      `Rückflussniveau vom ${setOn} um den Split vom ${split.date} (Verhältnis ${split.ratio.toLocaleString("de-DE")}) bereinigt: ${input.value.toLocaleString("de-DE")} wird zu ${value.toLocaleString("de-DE", { maximumFractionDigits: 4 })}.`,
    );
  }
  return value;
}

/** Rechnet die Bewertung und speichert sie als Tagesstand. */
export function valueStock(db: Database, stock: Stock, date: string): StockValuation {
  const result = computeValuation(db, stock, date);
  const { valuation, proposals, priceDate } = result;
  const details = {
    calcVersion: CALC_VERSION,
    priceDate,
    inputs: valuation.inputs,
    manual: valuation.manual,
    missing: valuation.missing,
    proposals,
  };
  // Schreiben und Lesen hängen am selben Format: Ein umbenanntes Feld in `Proposals` bricht hier beim Übersetzen.
  details satisfies z.input<typeof StoredDetails>;
  db.saveValuation(stock.id, date, {
    complete: valuation.complete,
    price: valuation.price,
    riskScore: valuation.riskScore,
    innerReturn: valuation.returns?.base ?? null,
    innerReturnCautious: valuation.returns?.cautious ?? null,
    innerReturnOptimistic: valuation.returns?.optimistic ?? null,
    details,
  });
  return result;
}

/** Neuer Wert von Hand für eine Eingabe; `null` löscht ihn, dann gilt wieder der Vorschlag. */
export interface InputUpdate {
  key: InputKey;
  value: number | null;
  /** Notiz zum Wert; ohne Angabe bleibt die bisherige, oder es wird ein übernommener Jev-Vorschlag vermerkt. */
  note?: string;
}

/**
 * Setzt Eingaben von Hand und speichert den Tagesstand dazu. Das Datum der Eingaben ist der Tag der Bewertung;
 * der Tagesstand hält fest, auf welchen Vorschlägen sie steht, und daran misst sich später, was sich verschoben hat.
 * Oberfläche und Skript gehen beide hier durch, damit kein Weg eine Bewertung ohne Prüfstand hinterlässt.
 */
export function assess(db: Database, stock: Stock, updates: readonly InputUpdate[], date: string): StockValuation {
  const previous = new Map(db.manualInputs(stock.id).map((input) => [input.key, input]));
  const jev = db.judgement(stock.id);
  for (const { key, value, note } of updates) {
    if (value === null) {
      db.clearManualInput(stock.id, key);
      continue;
    }
    const before = previous.get(key);
    // Ein unverändert übernommener Jev-Vorschlag wird als solcher vermerkt.
    const proposal = currentProposals(jev)[key.replace(/^risk\./, "")];
    const fromJev = jev !== null && !before && proposal !== undefined && Math.abs(proposal.value - value) < 1e-9;
    const jevNote = fromJev ? `Jev-Vorschlag vom ${jev.createdAt.slice(0, 10)} übernommen` : null;
    // Eine eigene Notiz bleibt beim Ändern des Werts. Eine automatische („Opus-Einschätzung“, „Haiku-Einschätzung“,
    // „Jev-Vorschlag … übernommen“) gehörte zum alten Wert: Ändert ihn ein Mensch, ist er kein Modell- oder Jev-Wert mehr.
    const automatic = before !== undefined && sourceOfNote(before.note) !== "hand";
    const keptNote = before && (!automatic || Math.abs(before.value - value) < 1e-12) ? before.note : "";
    db.setManualInput(stock.id, key, value, note ?? jevNote ?? keptNote);
  }
  return valueStock(db, stock, date);
}
