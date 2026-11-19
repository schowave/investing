"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { INPUT_KEYS, parseManualInput } from "../valuation/valuation.ts";
import { database, today } from "./server.ts";

/** Speichert alle Eingabefelder einer Aktie. Ein leeres Feld löscht den manuellen Wert, dann gilt der Vorschlag. */
export async function saveInputs(stockId: string, form: FormData): Promise<void> {
  const db = database();
  const page = `/aktie/${encodeURIComponent(stockId)}`;
  if (!db.stock(stockId)) redirect("/");

  const updates: { key: string; value: number | null }[] = [];
  for (const key of INPUT_KEYS) {
    const text = field(form.get(key));
    if (text === "") {
      updates.push({ key, value: null });
      continue;
    }
    const parsed = parseManualInput(key, text);
    if ("error" in parsed) redirect(`${page}?fehler=${encodeURIComponent(parsed.error)}`);
    updates.push({ key, value: parsed.value });
  }

  const notes = new Map(db.manualInputs(stockId).map((input) => [input.key, input.note]));
  for (const { key, value } of updates) {
    if (value === null) db.clearManualInput(stockId, key);
    else db.setManualInput(stockId, key, value, notes.get(key) ?? "");
  }
  revalidatePath("/");
  revalidatePath(page);
  redirect(`${page}?gespeichert=1`);
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
  const page = `/aktie/${encodeURIComponent(stockId)}`;
  const price = Price.safeParse(field(form.get("price")));
  if (!price.success) redirect(`${page}?fehler=${encodeURIComponent("Der Kurs muss eine Zahl über 0 sein.")}`);
  database().saveManualPrice(stockId, today(), price.data);
  revalidatePath("/");
  redirect(`${page}?gespeichert=1`);
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
