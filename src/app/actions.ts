"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { JOB_KINDS, type JobKind } from "../jobs/registry.ts";
import { isinsIn } from "../jobs/stockpile.ts";
import { judgeStock } from "../judgement/judge.ts";
import { assess, type InputUpdate } from "../valuation/run.ts";
import { INPUT_KEYS, parseManualInput } from "../valuation/valuation.ts";
import { safeOrigin, stockPath } from "./origin.ts";
import { database, today } from "./server.ts";

/** Speichert alle Eingabefelder einer Aktie. Ein leeres Feld löscht den manuellen Wert, dann gilt der Vorschlag. */
export async function saveInputs(stockId: string, form: FormData): Promise<void> {
  const db = database();
  const von = safeOrigin(form.get("von"));
  const page = stockPath(stockId, von);
  const stock = db.stock(stockId);
  if (!stock) redirect("/");

  const updates: InputUpdate[] = [];
  for (const key of INPUT_KEYS) {
    const text = field(form.get(key));
    if (text === "") {
      updates.push({ key, value: null });
      continue;
    }
    const parsed = parseManualInput(key, text);
    if ("error" in parsed) redirect(stockPath(stockId, von, { fehler: parsed.error }));
    updates.push({ key, value: parsed.value });
  }
  assess(db, stock, updates, today());
  revalidatePath("/");
  revalidatePath(`/aktie/${encodeURIComponent(stockId)}`);
  redirect(stockPath(stockId, von, { gespeichert: "1" }));
}

/** Holt Vorschläge für die Urteilsfaktoren von Jev, auf Wunsch mit Recherche im Netz. */
export async function requestJudgement(stockId: string, form: FormData): Promise<void> {
  const db = database();
  const von = safeOrigin(form.get("von"));
  const stock = db.stock(stockId);
  if (!stock) redirect("/");
  let failure: string | null = null;
  try {
    await judgeStock(db, stock, today(), { research: form.get("research") !== "off" });
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }
  // redirect() wirft absichtlich und darf deshalb nicht im try-Block stehen.
  if (failure !== null) redirect(stockPath(stockId, von, { fehler: failure }));
  revalidatePath(`/aktie/${encodeURIComponent(stockId)}`);
  redirect(stockPath(stockId, von, {}, "#urteil"));
}

/** Formularfelder: Text, deutsches Dezimalkomma erlaubt. Ein leeres Feld ist `null`. */
const field = (value: FormDataEntryValue | null) => (typeof value === "string" ? value.trim() : "");
const Decimal = z
  .string()
  .regex(/^-?\d+(?:[.,]\d+)?$/)
  .transform((text) => Number(text.replace(",", ".")))
  .pipe(z.number().finite());
const Amount = Decimal.pipe(z.number().min(0));
const Price = Decimal.pipe(z.number().positive());
const PortfolioForm = z.object({
  name: z.string().trim().min(1),
  profile: z.enum(["fokussiert", "global"]).catch("fokussiert"),
});
/** Nur Rücksprünge innerhalb der Anwendung, nie auf fremde Seiten. */
const LocalPath = z.string().regex(/^\/(?![/\\])/);

/** Nimmt eine Aktie auf die Watchlist oder legt sie zurück in den Datenvorrat. */
export async function setWatched(stockId: string, watched: boolean, returnTo: string): Promise<void> {
  database().setWatched(stockId, watched);
  revalidatePath("/");
  redirect(LocalPath.safeParse(returnTo).success ? returnTo : "/");
}

/** Trägt einen Kurs von Hand ein (Hauptwährung, Datum heute). */
export async function saveManualPrice(stockId: string, form: FormData): Promise<void> {
  const von = safeOrigin(form.get("von"));
  const price = Price.safeParse(field(form.get("price")));
  if (!price.success) redirect(stockPath(stockId, von, { fehler: "Der Kurs muss eine Zahl über 0 sein." }));
  database().saveManualPrice(stockId, today(), price.data);
  revalidatePath("/");
  redirect(stockPath(stockId, von, { gespeichert: "1" }));
}

export async function createPortfolio(form: FormData): Promise<void> {
  const parsed = PortfolioForm.safeParse({ name: field(form.get("name")), profile: form.get("profile") });
  if (!parsed.success) redirect(`/portfolio?fehler=${encodeURIComponent("Bitte einen Namen angeben.")}`);
  const id = database().createPortfolio(parsed.data.name, parsed.data.profile);
  redirect(`/portfolio/${id}`);
}

export async function deletePortfolio(id: number): Promise<void> {
  database().deletePortfolio(id);
  redirect("/portfolio");
}

/** Speichert Barbestand und Stückzahlen. Ein leeres Feld bedeutet 0. */
export async function saveHoldings(id: number, form: FormData): Promise<void> {
  const db = database();
  const page = `/portfolio/${id}`;
  if (!db.portfolio(id)) redirect("/portfolio");

  const read = (name: string, label: string): number => {
    const text = field(form.get(name));
    if (text === "") return 0;
    const value = Amount.safeParse(text);
    if (!value.success) redirect(`${page}?fehler=${encodeURIComponent(`${label}: bitte eine Zahl ab 0 eintragen.`)}`);
    return value.data;
  };
  const cash = read("cash", "Barbestand");
  const other = read("other", "Sonstige Anlagen");
  const ids = new Set([...db.stocks().map((stock) => stock.id), ...db.holdings(id).keys()]);
  const entries = [...ids].map((stockId) => ({ id: stockId, shares: read(`shares:${stockId}`, stockId) }));

  db.setCash(id, cash);
  db.setOtherAssets(id, other);
  for (const entry of entries) db.setHolding(id, entry.id, entry.shares);
  redirect(`${page}?gespeichert=1`);
}

// --- Hintergrundläufe (Seite „Abgleich“, Aktienseite, Datenvorrat) ---------------------------------------------

/** Stellt einen Lauf ein und kehrt mit seiner Nummer zurück; ungültige Parameter landen als Fehler auf der Seite. */
function enqueue(kind: JobKind, args: unknown, returnTo: string): never {
  const back = LocalPath.safeParse(returnTo).success ? returnTo : "/abgleich";
  const separator = back.includes("?") ? "&" : "?";
  const parsed = JOB_KINDS[kind].args.safeParse(args);
  if (!parsed.success) {
    redirect(`${back}${separator}fehler=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Ungültige Angaben.")}`);
  }
  const { id } = database().enqueueJob(kind, parsed.data);
  revalidatePath("/abgleich");
  redirect(`${back}${separator}lauf=${id}`);
}

/** Läufe mit tausenden Abrufen brauchen ein Häkchen, damit niemand sie versehentlich startet. */
function requireConfirmation(form: FormData, returnTo: string): void {
  if (form.get("bestaetigt") !== "on") {
    redirect(`${returnTo}?fehler=${encodeURIComponent("Bitte bestätigen, dass der Lauf viele Abrufe kostet.")}`);
  }
}

export async function startSync(returnTo: string): Promise<void> {
  enqueue("sync", {}, returnTo);
}

/** Bewertungen, Screening und Portfolios aus den gespeicherten Daten neu rechnen, ohne Abruf. */
export async function startRecompute(returnTo: string): Promise<void> {
  enqueue("recompute", {}, returnTo);
}

const AutoSyncForm = z.enum(["an", "aus"]);

/** Schaltet den nächtlichen Abgleich ein oder aus; von Hand lässt er sich immer starten. */
export async function setAutoSync(form: FormData): Promise<void> {
  const parsed = AutoSyncForm.safeParse(form.get("automatisch"));
  if (!parsed.success) redirect(`/abgleich?fehler=${encodeURIComponent("Unbekannte Einstellung für den Abgleich.")}`);
  database().setAutoSync(parsed.data === "an");
  revalidatePath("/abgleich");
  redirect("/abgleich");
}

export async function refreshStockData(stockId: string, form: FormData): Promise<void> {
  if (!database().stock(stockId)) redirect("/");
  enqueue("stock-refresh", { id: stockId }, stockPath(stockId, safeOrigin(form.get("von"))));
}

/** ISINs und Symbole (mit Börse, z. B. KAP.IL) aus einem Textfeld; eine kopierte Depotliste geht auch. */
export async function addStocks(form: FormData): Promise<void> {
  const text = field(form.get("titel"));
  const isins = isinsIn(text);
  const symbols = [...new Set(text.toUpperCase().split(/[\s,;]+/))].filter((token) => token.includes(".") && !isins.includes(token));
  enqueue("add-stocks", { isins, symbols }, "/vorrat");
}

export async function startHistory(form: FormData): Promise<void> {
  requireConfirmation(form, "/abgleich");
  enqueue("history", { refresh: form.get("neu") === "on" }, "/abgleich");
}

export async function startIndexImport(form: FormData): Promise<void> {
  requireConfirmation(form, "/abgleich");
  const words = (name: string) =>
    field(form.get(name))
      .toUpperCase()
      .split(/[\s,;]+/)
      .filter(Boolean);
  enqueue("index-import", { indices: words("indizes"), exchanges: words("boersen") }, "/abgleich");
}

export async function startRefreshAll(form: FormData): Promise<void> {
  requireConfirmation(form, "/abgleich");
  enqueue("refresh-all", {}, "/abgleich");
}

export async function cancelJob(id: number): Promise<void> {
  database().requestJobCancel(id);
  revalidatePath("/abgleich");
  redirect("/abgleich");
}
