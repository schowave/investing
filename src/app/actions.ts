"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { INPUT_KEYS, parseManualInput } from "../valuation/valuation.ts";
import { database, today } from "./server.ts";

/** Speichert alle Eingabefelder einer Aktie. Ein leeres Feld löscht den manuellen Wert, dann gilt der Vorschlag. */
export async function saveInputs(stockId: string, form: FormData): Promise<void> {
  const db = database();
  const page = `/aktie/${encodeURIComponent(stockId)}`;
  if (!db.stocks({ includeStockpile: true }).some((s) => s.id === stockId)) redirect("/");

  const updates: { key: string; value: number | null }[] = [];
  for (const key of INPUT_KEYS) {
    const text = String(form.get(key) ?? "").trim();
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

const decimal = (value: FormDataEntryValue | null) => Number(String(value ?? "").trim().replace(",", "."));

/** Nimmt eine Aktie auf die Watchlist oder legt sie zurück in den Datenvorrat. */
export async function setWatched(stockId: string, watched: boolean, returnTo: string): Promise<void> {
  database().setWatched(stockId, watched);
  revalidatePath("/");
  redirect(returnTo);
}

/** Trägt einen Kurs von Hand ein (Hauptwährung, Datum heute). */
export async function saveManualPrice(stockId: string, form: FormData): Promise<void> {
  const page = `/aktie/${encodeURIComponent(stockId)}`;
  const price = decimal(form.get("price"));
  if (!Number.isFinite(price) || price <= 0) redirect(`${page}?fehler=${encodeURIComponent("Der Kurs muss eine Zahl über 0 sein.")}`);
  database().saveManualPrice(stockId, today(), price);
  revalidatePath("/");
  redirect(`${page}?gespeichert=1`);
}

export async function createPortfolio(form: FormData): Promise<void> {
  const name = String(form.get("name") ?? "").trim();
  if (name === "") redirect(`/portfolio?fehler=${encodeURIComponent("Bitte einen Namen angeben.")}`);
  const id = database().createPortfolio(name, form.get("profile") === "global" ? "global" : "fokussiert");
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
    const text = String(form.get(name) ?? "").trim();
    const value = text === "" ? 0 : decimal(text);
    if (!Number.isFinite(value) || value < 0) redirect(`${page}?fehler=${encodeURIComponent(`${label}: bitte eine Zahl ab 0 eintragen.`)}`);
    return value;
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
