// Offizielle Trading-API von wikifolio (https://trading-api.wikifolio.com, ADR 0002). Zugang nur mit Schlüsseln, die
// wikifolio nach schriftlicher Zustimmung ausgibt. Schlüssel und Sitzung erscheinen nie in Fehlermeldungen.
// Antworten werden mit zod geprüft, bevor sie weiterverarbeitet werden.

import { z } from "zod";

type Fetch = typeof fetch;

const WIKIFOLIO_API = "https://trading-api.wikifolio.com";

export interface WikifolioCredentials {
  clientApiKey: string;
  userApiKey: string;
}

/** Schlüssel aus der Umgebung; `null`, wenn einer fehlt (dann bleibt das Wikifolio beim Bestand von Hand). */
export function wikifolioCredentials(env: Record<string, string | undefined>): WikifolioCredentials | null {
  const clientApiKey = env.WIKIFOLIO_CLIENT_API_KEY?.trim();
  const userApiKey = env.WIKIFOLIO_USER_API_KEY?.trim();
  return clientApiKey && userApiKey ? { clientApiKey, userApiKey } : null;
}

/** Symbol eines Wikifolios, wie wikifolio es vergibt (z. B. WFSHYSEL); Groß- und Kleinschreibung egal. */
export const WikifolioSymbol = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^WF[A-Z0-9]{1,12}$/, "Symbol des Wikifolios, z. B. WF0SHYSEL");

export class WikifolioError extends Error {
  readonly status: number;
  constructor(status: number, what: string, detail?: string) {
    super(`wikifolio ${what}: HTTP ${status}${detail ? ` (${detail})` : ""}`);
    this.status = status;
  }
}

const Logon = z.object({ sessionToken: z.string().min(1) });
const ApiError = z.object({ errorCode: z.number().optional(), errorMessage: z.string().nullish() });

const Position = z.object({
  /** ISIN des Wertpapiers. */
  underlying: z.string().min(1),
  quantity: z.number().finite(),
  averagePurchasePrice: z.number().finite().nullish(),
});

const WikifolioAnswer = z.object({
  wikifolioSymbol: z.string().nullish(),
  wikifolioStatus: z.string(),
  cashAccountCurrentBalance: z.number().finite(),
  totalValue: z.number().finite(),
  baseCurrency: z.string().nullish(),
  positions: z.array(Position).nullish(),
});

const UnderlyingPage = z.object({
  results: z.array(z.object({ isin: z.string().nullish() })).nullish(),
  pageNumber: z.number().int(),
  totalPages: z.number().int(),
});

export interface WikifolioPosition {
  isin: string;
  quantity: number;
  /** Durchschnittlicher Kaufkurs in der Basiswährung; `null`, wenn wikifolio keinen nennt. */
  averagePurchasePrice: number | null;
}

export interface WikifolioSnapshot {
  symbol: string;
  /** Test, Published, Investable … */
  status: string;
  baseCurrency: string;
  cash: number;
  totalValue: number;
  positions: WikifolioPosition[];
}

/** Eine angemeldete Sitzung. `close()` meldet ab; der Abgleich ruft es auch im Fehlerfall auf. */
export class WikifolioSession {
  readonly #token: string;
  readonly #fetch: Fetch;

  private constructor(token: string, fetchFn: Fetch) {
    this.#token = token;
    this.#fetch = fetchFn;
  }

  static async open(credentials: WikifolioCredentials, fetchFn: Fetch = fetch): Promise<WikifolioSession> {
    const response = await fetchFn(`${WIKIFOLIO_API}/sessions`, {
      method: "POST",
      headers: { clientApiKey: credentials.clientApiKey, userApiKey: credentials.userApiKey, accept: "application/json" },
    });
    if (!response.ok) throw await failure(response, "Anmeldung");
    const parsed = Logon.safeParse(await response.json());
    if (!parsed.success) throw new Error("wikifolio Anmeldung: unerwartete Antwort");
    return new WikifolioSession(parsed.data.sessionToken, fetchFn);
  }

  async close(): Promise<void> {
    await this.#fetch(`${WIKIFOLIO_API}/sessions`, { method: "DELETE", headers: { sessionToken: this.#token } }).catch(() => {});
  }

  async #get(path: string, what: string): Promise<unknown> {
    const response = await this.#fetch(`${WIKIFOLIO_API}${path}`, {
      headers: { sessionToken: this.#token, accept: "application/json" },
    });
    if (!response.ok) throw await failure(response, what);
    return response.json();
  }

  /** Bargeld, Gesamtwert und Positionen eines Wikifolios. */
  async wikifolio(symbol: string): Promise<WikifolioSnapshot> {
    const what = `wikifolios/${symbol}`;
    const parsed = WikifolioAnswer.safeParse(await this.#get(`/wikifolios/${encodeURIComponent(symbol)}`, what));
    if (!parsed.success) throw new Error(`${what}: unerwartete Antwort`);
    const data = parsed.data;
    return {
      symbol: data.wikifolioSymbol ?? symbol,
      status: data.wikifolioStatus,
      baseCurrency: (data.baseCurrency ?? "EUR").toUpperCase(),
      cash: data.cashAccountCurrentBalance,
      totalValue: data.totalValue,
      positions: (data.positions ?? []).map((p) => ({
        isin: p.underlying.trim().toUpperCase(),
        quantity: p.quantity,
        averagePurchasePrice: p.averagePurchasePrice ?? null,
      })),
    };
  }

  /**
   * Alle ISINs im Anlageuniversum, seitenweise (höchstens 1000 je Abruf). Ein großes Universum kostet Hunderte Abrufe;
   * `maxPages` begrenzt das, damit ein Fehler nicht das Wochenlimit aufbraucht.
   */
  async underlyings(symbol: string, maxPages = 2000): Promise<Set<string>> {
    const isins = new Set<string>();
    const what = `wikifolios/${symbol}/underlyings`;
    for (let page = 1; page <= maxPages; page++) {
      const parsed = UnderlyingPage.safeParse(
        await this.#get(`/wikifolios/${encodeURIComponent(symbol)}/underlyings?pageNumber=${page}`, what),
      );
      if (!parsed.success) throw new Error(`${what}: unerwartete Antwort auf Seite ${page}`);
      for (const row of parsed.data.results ?? []) if (row.isin) isins.add(row.isin.trim().toUpperCase());
      if (page >= parsed.data.totalPages) return isins;
    }
    throw new Error(`${what}: mehr als ${maxPages} Seiten, abgebrochen`);
  }
}

async function failure(response: Response, what: string): Promise<WikifolioError> {
  let detail: string | undefined;
  try {
    const parsed = ApiError.safeParse(await response.json());
    if (parsed.success && parsed.data.errorMessage) detail = parsed.data.errorMessage.slice(0, 200);
  } catch {
    // Kein JSON im Fehlerfall: Dann genügt der Status.
  }
  return new WikifolioError(response.status, what, detail);
}
