// Tagesbudget des EODHD-Kontos für die Seite „Abgleich“. Kurz zwischengespeichert, weil die Seite sich während
// eines Laufs alle paar Sekunden neu lädt.

import { type EodhdAccount, fetchAccount } from "../data/eodhd.ts";

const TTL_MS = 60_000;
let cached: { at: number; account: EodhdAccount | null } | null = null;

/** `null` ohne Token oder wenn das Konto nicht antwortet. */
export async function eodhdBudget(now = Date.now(), fetchFn: typeof fetch = fetch): Promise<EodhdAccount | null> {
  const token = process.env.EODHD_API_TOKEN;
  if (!token) return null;
  if (cached && now - cached.at < TTL_MS) return cached.account;
  let account: EodhdAccount | null = null;
  try {
    account = await fetchAccount(token, fetchFn);
  } catch {
    account = null;
  }
  cached = { at: now, account };
  return account;
}
