"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { INPUT_KEYS, parseManualInput } from "../valuation/valuation.ts";
import { database } from "./server.ts";

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
