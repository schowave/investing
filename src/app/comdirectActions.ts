"use server";

// Server Actions für den Abruf des Bestands bei der comdirect (Spezifikation 6.1). Jede Aktion landet auf der Seite
// /portfolio/<id>/comdirect; Fehler stehen dort, nie die PIN.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  type AbrufDeps,
  applyVorschau,
  cancelAbruf,
  chooseDepot,
  confirmTan,
  queuedIsins,
  resetOpenChallenges,
  retryLoad,
  startAbruf,
} from "../comdirect/abruf.ts";
import { ComdirectError, comdirectConfig } from "../comdirect/api.ts";
import { findVorgang, type Vorgang } from "../comdirect/vorgang.ts";
import { JOB_KINDS } from "../jobs/registry.ts";
import { database } from "./server.ts";

/** PIN oder Passwort fürs Online-Banking: beliebige Zeichen, nicht getrimmt (Leerzeichen können dazugehören). */
const Pin = z.string().min(1).max(128);
const Tan = z.string().regex(/^\d{6}$/);
const DepotId = z.string().min(1).max(64);

const page = (portfolioId: number) => `/portfolio/${portfolioId}/comdirect`;
const withQuery = (path: string, query: Record<string, string>) => `${path}?${new URLSearchParams(query)}`;
const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");

function deps(portfolioId: number): AbrufDeps {
  const config = comdirectConfig();
  if (!config) redirect(withQuery(page(portfolioId), { fehler: "Zugangsdaten für die comdirect fehlen in der Umgebung." }));
  return { config, eodhdToken: process.env.EODHD_API_TOKEN ?? null };
}

/** Grund für den Nutzer: eigene Meldungen wörtlich, alles andere ohne Einzelheiten (könnte Interna enthalten). */
function reasonOf(error: unknown): string {
  if (error instanceof ComdirectError) return error.message;
  console.error("comdirect:", error instanceof Error ? error.name : "unbekannter Fehler");
  return "Unerwarteter Fehler beim Abruf. Bitte neu starten.";
}

/**
 * Führt einen Schritt aus; Fehler führen zurück auf die Seite des Abrufs, mit dem Vorgang, solange er noch lebt (sonst
 * kostete der nächste Versuch eine neue TAN). `redirect()` steht bewusst außerhalb des try.
 */
async function step(portfolioId: number, vorgangId: string | null, work: () => Promise<string>): Promise<never> {
  let target: string;
  try {
    target = await work();
  } catch (error) {
    const alive = vorgangId !== null && findVorgang(vorgangId, portfolioId) !== null;
    target = withQuery(page(portfolioId), { ...(alive ? { vorgang: vorgangId } : {}), fehler: reasonOf(error) });
  }
  redirect(target);
}

function vorgangOf(portfolioId: number, vorgangId: string): Vorgang {
  const vorgang = findVorgang(vorgangId, portfolioId);
  if (!vorgang) redirect(withQuery(page(portfolioId), { fehler: "Der Abruf ist abgelaufen. Bitte neu starten." }));
  return vorgang;
}

/** Meldet sich mit der PIN an und fordert die Sitzungs-TAN an. Die PIN wird nur weitergereicht, nie gespeichert. */
export async function startComdirect(portfolioId: number, form: FormData): Promise<void> {
  const portfolio = database().portfolio(portfolioId);
  if (!portfolio) redirect("/portfolio");
  if (portfolio.wikifolio) {
    redirect(
      withQuery(`/portfolio/${portfolioId}`, {
        fehler: "Der Bestand kommt aus wikifolio und lässt sich nicht aus der comdirect übernehmen.",
      }),
    );
  }
  const d = deps(portfolioId);
  if (form.get("zaehler") === "on") resetOpenChallenges();
  const raw = form.get("pin");
  const pin = Pin.safeParse(typeof raw === "string" ? raw : "");
  if (!pin.success) redirect(withQuery(page(portfolioId), { fehler: "Bitte die PIN bzw. das Passwort zum Online-Banking eingeben." }));
  await step(portfolioId, null, async () => {
    const vorgang = await startAbruf(portfolioId, pin.data, d);
    return withQuery(page(portfolioId), { vorgang: vorgang.id });
  });
}

/** Schließt die TAN ab: pushTAN ohne Eingabe, photoTAN mit der eingetippten TAN. */
export async function confirmComdirectTan(portfolioId: number, vorgangId: string, form: FormData): Promise<void> {
  const d = deps(portfolioId);
  const vorgang = vorgangOf(portfolioId, vorgangId);
  // Doppelt abgeschickt: Die TAN ist schon freigegeben, die Seite zeigt den nächsten Schritt.
  if (vorgang.state.step !== "tan") redirect(withQuery(page(portfolioId), { vorgang: vorgangId }));
  const typed = text(form.get("tan"));
  if (vorgang.state.challenge.typ === "P_TAN" && !Tan.safeParse(typed).success) {
    redirect(withQuery(page(portfolioId), { vorgang: vorgangId, hinweis: "Die TAN hat sechs Ziffern." }));
  }
  await step(portfolioId, vorgangId, async () => {
    const done = await confirmTan(database(), vorgang, typed === "" ? null : typed, d);
    return withQuery(page(portfolioId), done ? { vorgang: vorgangId } : { vorgang: vorgangId, hinweis: "Noch nicht bestätigt." });
  });
}

export async function chooseComdirectDepot(portfolioId: number, vorgangId: string, form: FormData): Promise<void> {
  const d = deps(portfolioId);
  const vorgang = vorgangOf(portfolioId, vorgangId);
  const depotId = DepotId.safeParse(text(form.get("depot")));
  if (!depotId.success) redirect(withQuery(page(portfolioId), { vorgang: vorgangId, hinweis: "Bitte ein Depot wählen." }));
  await step(portfolioId, vorgangId, async () => {
    await chooseDepot(database(), vorgang, depotId.data, d);
    return withQuery(page(portfolioId), { vorgang: vorgangId });
  });
}

/** Lädt Depots und Bestand erneut, wenn das nach der Freigabe der TAN scheiterte; braucht keine neue TAN. */
export async function retryComdirect(portfolioId: number, vorgangId: string): Promise<void> {
  const d = deps(portfolioId);
  const vorgang = vorgangOf(portfolioId, vorgangId);
  await step(portfolioId, vorgangId, async () => {
    await retryLoad(database(), vorgang, d);
    return withQuery(page(portfolioId), { vorgang: vorgangId });
  });
}

/** Übernimmt die Vorschau in den Bestand und stößt die Aufnahme unbekannter Aktien an (Datenvorrat, nicht Watchlist). */
export async function applyComdirect(portfolioId: number, vorgangId: string): Promise<void> {
  deps(portfolioId); // prüft nur, dass der Abruf eingerichtet ist
  const vorgang = vorgangOf(portfolioId, vorgangId);
  await step(portfolioId, vorgangId, async () => {
    const db = database();
    const missing = await applyVorschau(db, vorgang);
    revalidatePath(`/portfolio/${portfolioId}`);
    revalidatePath("/portfolio");
    const query: Record<string, string> = { gespeichert: "comdirect" };
    // ISINs, die schon in einem offenen Lauf stehen, nicht ein zweites Mal einstellen.
    const queued = queuedIsins(db);
    const fresh = missing.filter((isin) => !queued.has(isin));
    if (fresh.length > 0) {
      const args = JOB_KINDS["add-stocks"].args.parse({ isins: fresh.slice(0, 200), symbols: [], watch: false });
      query.lauf = String(db.enqueueJob("add-stocks", args).id);
      revalidatePath("/abgleich");
    }
    return withQuery(`/portfolio/${portfolioId}`, query);
  });
}

export async function cancelComdirect(portfolioId: number, vorgangId: string): Promise<void> {
  const vorgang = findVorgang(vorgangId, portfolioId);
  if (vorgang) cancelAbruf(vorgang);
  redirect(`/portfolio/${portfolioId}`);
}
