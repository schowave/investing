// Ablauf eines Abrufs bei der comdirect (Spezifikation 6.1): verbindet Bank, Vorgang im Speicher und Datenbank.
// Die Server Actions rufen nur diese Funktionen; Abruf und Uhr sind austauschbar, damit sich der Ablauf testen lässt.

import type { Database } from "../data/db.ts";
import { isinOf, searchEodhd } from "../data/eodhdFundamentals.ts";
import { FUNDAMENTALS_KIND } from "../data/eodhdSnapshot.ts";
import { failedIsinsSince } from "../jobs/stockpile.ts";
import {
  activate,
  type ComdirectConfig,
  ComdirectError,
  type ComdirectSession,
  type Depot,
  depotStand,
  depots,
  login,
  pushStatus,
  revoke,
} from "./api.ts";
import { type Listing, previewBestand } from "./bestand.ts";
import { closeVorgang, openVorgang, type Step, type Vorgang } from "./vorgang.ts";

export interface AbrufDeps {
  config: ComdirectConfig;
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Token für die Symbolsuche bei EODHD; ohne ihn werden unbekannte ISINs nicht nachgeschlagen. */
  eodhdToken?: string | null;
  eodhdFetch?: typeof fetch;
}

/** Höchstens so viele ISINs schlägt ein Abruf bei EODHD nach (je ISIN ein Abruf). */
const MAX_ISIN_LOOKUPS = 60;

/**
 * Fünf TAN-Anforderungen ohne Freigabe dazwischen sperren den Zugang zum Online-Banking (Doku 2.3). Die Anwendung hört
 * vorher auf; der Zähler gilt für den Serverprozess und fällt auf 0, sobald eine TAN freigegeben ist.
 */
export const MAX_OPEN_CHALLENGES = 3;
/** So lange wartet ein Klick auf „Weiter“ auf die Bestätigung der pushTAN, bevor die Seite wieder antwortet. */
const PUSH_WAIT_MS = 45_000;
const PUSH_POLL_MS = 2_000;
/** Das Token der Anmeldung gilt 599 Sekunden; danach scheitert die Freigabe der TAN sicher. */
const TAN_VALID_MS = 9 * 60_000;
/** Eine ISIN, deren Aufnahme scheiterte, wird so lange nicht erneut angestoßen. */
const RETRY_IMPORT_DAYS = 30;

const holder = globalThis as { comdirectOpenChallenges?: number };
export const openChallenges = () => holder.comdirectOpenChallenges ?? 0;
export function resetOpenChallenges(): void {
  holder.comdirectOpenChallenges = 0;
}

const clock = (deps: Pick<AbrufDeps, "now">) => (deps.now ?? Date.now)();
const pause = (deps: AbrufDeps, ms: number) => (deps.sleep ?? ((t) => new Promise((resolve) => setTimeout(resolve, t))))(ms);
const sessionOf = (vorgang: Vorgang) => vorgang.secret as ComdirectSession;

/** Führt einen Schritt exklusiv aus: Ein zweiter Klick, während der erste noch wartet, darf die Bank nicht doppelt fragen. */
async function exclusive<T>(vorgang: Vorgang, work: () => Promise<T>): Promise<T> {
  if (vorgang.busy) throw new ComdirectError("Der vorige Schritt läuft noch; bitte kurz warten und die Seite neu laden.");
  vorgang.busy = true;
  try {
    return await work();
  } finally {
    vorgang.busy = false;
  }
}

/** Meldet sich an und fordert die Sitzungs-TAN an. */
export async function startAbruf(portfolioId: number, pin: string, deps: AbrufDeps): Promise<Vorgang> {
  // Die Bank erlaubt auch lange Passwörter mit Buchstaben und Sonderzeichen; geprüft wird nur, dass etwas da ist.
  if (pin.length === 0 || pin.length > 128) throw new ComdirectError("Bitte die PIN bzw. das Passwort zum Online-Banking eingeben.");
  if (openChallenges() >= MAX_OPEN_CHALLENGES) {
    throw new ComdirectError(
      `Schon ${openChallenges()} TAN-Anforderungen ohne Freigabe; bei fünf sperrt die comdirect den Zugang. Bitte einmal im Online-Banking mit TAN anmelden und dann den Zähler zurücksetzen.`,
    );
  }
  const now = clock(deps);
  const countChallenge = () => {
    holder.comdirectOpenChallenges = openChallenges() + 1;
  };
  const { session, challenge } = await login(deps.config, pin, countChallenge, deps.fetchFn, now);
  // Verfällt, ersetzt oder geschlossen: Die Sitzung bei der Bank endet mit, auch ohne dass jemand wartet.
  const dispose = () => void revoke(session, deps.fetchFn, clock(deps));
  return openVorgang(portfolioId, session, { step: "tan", challenge }, dispose, now);
}

/**
 * Trägt die ISIN gehaltener und beobachteter Aktien aus der gespeicherten Antwort des Anbieters nach. Ältere Einträge
 * haben noch keine; ohne sie fände der Abruf die eigenen Positionen nicht und würde sie als weggefallen werten.
 */
function backfillIsins(db: Database, ids: readonly string[]): void {
  for (const id of db.stockIdsWithoutIsin(ids)) {
    const raw = db.rawDocument(id, FUNDAMENTALS_KIND);
    if (!raw) continue;
    try {
      const general = (JSON.parse(raw.body) as { General?: { ISIN?: unknown } }).General;
      const isin = isinOf(typeof general?.ISIN === "string" ? general.ISIN : null);
      if (isin) db.setIsin(id, isin);
    } catch {
      // Kaputte Rohantwort: Die Aktie bleibt ohne ISIN; die Suche bei EODHD kann sie noch zuordnen.
    }
  }
}

/**
 * Schlägt Aktien-ISINs aus dem Depot, die in der Datenbank fehlen, in der Symbolsuche von EODHD nach. Liegt eine
 * gefundene Notiz schon in der Datenbank, bekommt sie die ISIN: Die Stammdaten des Anbieters nennen sie oft nicht
 * (z. B. bei US-Aktien und Hinterlegungsscheinen), und ohne sie würde ein gehaltener Titel nicht erkannt.
 * @returns Hinweise, wenn die Suche scheiterte.
 */
async function resolveIsins(db: Database, isins: readonly string[], deps: AbrufDeps): Promise<string[]> {
  const known = db.stockIdsByIsin(isins);
  const open = [...new Set(isins)].filter((isin) => !known.has(isin)).slice(0, MAX_ISIN_LOOKUPS);
  if (open.length === 0 || !deps.eodhdToken) return [];
  let failed = 0;
  for (const isin of open) {
    try {
      const hits = await searchEodhd(isin, deps.eodhdToken, deps.eodhdFetch);
      for (const hit of hits) if (hit.isin === isin && db.stock(hit.symbol)) db.setIsin(hit.symbol, isin);
    } catch {
      failed++;
    }
  }
  return failed > 0
    ? [`${failed} ISINs ließen sich bei EODHD nicht nachschlagen; sie zählen bis zum nächsten Abruf als sonstige Anlagen.`]
    : [];
}

function listingsFor(db: Database, isins: readonly string[]): Map<string, Listing[]> {
  const ids = db.stockIdsByIsin(isins);
  return new Map(
    [...ids].map(([isin, list]) => [
      isin,
      list.map((id) => {
        const stock = db.stock(id);
        const type = stock?.securityType ?? null;
        return {
          id,
          watched: stock?.watched ?? false,
          common: type === null || type === "Common Stock",
          priced: db.latestPrice(id) !== null,
        };
      }),
    ]),
  );
}

/** Holt den Bestand eines Depots und rechnet die Vorschau gegen den heutigen Bestand des Portfolios. */
async function loadVorschau(db: Database, vorgang: Vorgang, depot: Depot, all: Depot[], deps: AbrufDeps): Promise<Step> {
  const portfolio = db.portfolio(vorgang.portfolioId);
  if (!portfolio) throw new ComdirectError("Das Portfolio gibt es nicht mehr.");
  const stand = await depotStand(deps.config, sessionOf(vorgang), depot, deps.fetchFn, clock(deps));
  const shares = db.holdings(portfolio.id);
  backfillIsins(db, [...shares.keys(), ...db.stocks().map((s) => s.id)]);
  const isins = stand.positions.flatMap((p) => (p.kind === "aktie" && p.isin ? [p.isin] : []));
  const lookupWarnings = await resolveIsins(db, isins, deps);
  const preview = previewBestand(
    stand.positions,
    stand.cashEur,
    listingsFor(db, isins),
    {
      cashEur: portfolio.cashEur,
      otherEur: portfolio.otherEur,
      shares,
      names: new Map([...shares.keys()].map((id) => [id, db.stock(id)?.name ?? id])),
    },
    failedIsinsSince(db, new Date(clock(deps) - RETRY_IMPORT_DAYS * 86_400_000).toISOString().slice(0, 10)),
  );
  preview.warnings.unshift(...stand.warnings, ...lookupWarnings);
  return { step: "vorschau", depot, depots: all, stand, preview };
}

/** Nach der Freigabe: gemerktes oder einziges Depot gleich laden, sonst zur Auswahl. */
async function afterActivation(db: Database, vorgang: Vorgang, deps: AbrufDeps): Promise<void> {
  const list = await depots(deps.config, sessionOf(vorgang), deps.fetchFn, clock(deps));
  if (list.length === 0) throw new ComdirectError("Unter diesem Zugang gibt es kein Depot.");
  const remembered = list.find((d) => d.id === db.portfolio(vorgang.portfolioId)?.comdirectDepotId);
  const depot = remembered ?? (list.length === 1 ? list[0]! : null);
  vorgang.state = depot ? await loadVorschau(db, vorgang, depot, list, deps) : { step: "depot", depots: list };
}

/**
 * Schließt die Sitzungs-TAN ab. Bei pushTAN wartet sie eine Weile auf die Bestätigung in der App.
 * @returns `false`, wenn die pushTAN noch nicht bestätigt ist; der Vorgang bleibt dann beim Schritt TAN.
 */
export async function confirmTan(db: Database, vorgang: Vorgang, tan: string | null, deps: AbrufDeps): Promise<boolean> {
  return exclusive(vorgang, async () => {
    if (vorgang.state.step !== "tan") throw new ComdirectError("Die TAN ist schon freigegeben.");
    const { challenge } = vorgang.state;
    const session = sessionOf(vorgang);
    const expired = () => clock(deps) - session.tokens.obtainedAt > TAN_VALID_MS;
    const giveUp = (message: string) => {
      closeVorgang(vorgang);
      return new ComdirectError(message);
    };
    if (challenge.typ === "P_TAN_PUSH") {
      const started = clock(deps);
      for (;;) {
        if (expired()) throw giveUp("Die Anmeldung ist abgelaufen, bevor die pushTAN bestätigt war. Bitte neu starten.");
        const status = await pushStatus(session, challenge, deps.fetchFn, clock(deps));
        if (status === "confirmed") break;
        if (status === "failed") throw giveUp("Die pushTAN wurde abgelehnt oder ist verfallen. Bitte neu starten.");
        if (clock(deps) - started >= PUSH_WAIT_MS) return false;
        await pause(deps, PUSH_POLL_MS);
      }
    }
    if (expired()) throw giveUp("Die Anmeldung ist abgelaufen. Bitte neu starten.");
    try {
      await activate(deps.config, session, challenge, tan, deps.fetchFn, clock(deps));
    } catch (error) {
      // Eine falsche TAN wird nie wiederholt: Der Vorgang endet, ein neuer fordert eine neue TAN an.
      closeVorgang(vorgang);
      throw error;
    }
    resetOpenChallenges();
    // Ab hier ist die TAN verbraucht. Scheitert das Laden, bleibt der Vorgang freigegeben und lässt sich ohne TAN wiederholen.
    vorgang.state = { step: "freigegeben" };
    await afterActivation(db, vorgang, deps);
    return true;
  });
}

/** Lädt Depots und Bestand erneut, nachdem das nach der Freigabe der TAN scheiterte. */
export async function retryLoad(db: Database, vorgang: Vorgang, deps: AbrufDeps): Promise<void> {
  await exclusive(vorgang, async () => {
    if (vorgang.state.step !== "freigegeben") throw new ComdirectError("Hier gibt es nichts neu zu laden.");
    await afterActivation(db, vorgang, deps);
  });
}

/** Wählt ein anderes Depot und rechnet die Vorschau neu. */
export async function chooseDepot(db: Database, vorgang: Vorgang, depotId: string, deps: AbrufDeps): Promise<void> {
  await exclusive(vorgang, async () => {
    const list = vorgang.state.step === "depot" || vorgang.state.step === "vorschau" ? vorgang.state.depots : null;
    const depot = list?.find((d) => d.id === depotId);
    if (!list || !depot) throw new ComdirectError("Dieses Depot gehört nicht zum Vorgang.");
    vorgang.state = await loadVorschau(db, vorgang, depot, list, deps);
  });
}

/**
 * Übernimmt die Vorschau in den Bestand, merkt das Depot und beendet die Sitzung bei der Bank.
 * @returns ISINs der Aktien, die noch nicht in der Datenbank stehen und über die ISIN aufgenommen werden sollen.
 */
export async function applyVorschau(db: Database, vorgang: Vorgang): Promise<string[]> {
  return exclusive(vorgang, async () => {
    if (vorgang.state.step !== "vorschau") throw new ComdirectError("Es gibt noch keine Vorschau zum Übernehmen.");
    const { preview, depot, stand } = vorgang.state;
    if (!stand.complete) throw new ComdirectError("Die Bank hat nicht alle Positionen geliefert; übernommen wird nichts.");
    db.replaceHoldings(vorgang.portfolioId, { cashEur: preview.cash.after, otherEur: preview.other.after, shares: preview.shares });
    db.setComdirectDepot(vorgang.portfolioId, depot.id);
    closeVorgang(vorgang);
    return preview.missingIsins;
  });
}

/** Beendet den Vorgang ohne Übernahme. */
export function cancelAbruf(vorgang: Vorgang): void {
  closeVorgang(vorgang);
}
