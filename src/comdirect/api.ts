// Lesender Zugriff auf die REST-API der comdirect (Spezifikation 6.1): Anmeldung mit Sitzungs-TAN, Depots, Positionen,
// Salden. Antworten werden mit zod geprüft. PIN, Tokens und Secret erscheinen nie in Fehlermeldungen.
// Grundlage: Schnittstellenspezifikation der comdirect (PDF, Stand April 2020) und Swagger 20.04; das Abfragen der pushTAN
// über `link.href` steht nicht in der Doku, nutzen aber alle verbreiteten Clients.

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { isinOf } from "../data/eodhdFundamentals.ts";
import type { DepotPosition } from "./bestand.ts";

type Fetch = typeof fetch;

const BASE = "https://api.comdirect.de";
/** Verfahren, die die Oberfläche abschließen kann. mobileTAN und andere lehnt sie mit Hinweis ab. */
const SUPPORTED_TAN = ["P_TAN_PUSH", "P_TAN"] as const;
type TanType = (typeof SUPPORTED_TAN)[number];
/** Tokens der Bank gelten 599 Sekunden; vorher erneuern, damit kein Abruf mitten im Vorgang scheitert. */
const REFRESH_AFTER_MS = 7 * 60_000;
const TIMEOUT_MS = 20_000;

export interface ComdirectConfig {
  clientId: string;
  clientSecret: string;
  /** Zugangsnummer zum Online-Banking. */
  username: string;
}

/** Zugangsdaten aus der Umgebung; `null`, wenn eins fehlt (dann bietet die Oberfläche den Abruf nicht an). */
export function comdirectConfig(env: Record<string, string | undefined> = process.env): ComdirectConfig | null {
  const clientId = env.COMDIRECT_CLIENT_ID?.trim();
  const clientSecret = env.COMDIRECT_CLIENT_SECRET?.trim();
  const username = env.COMDIRECT_USERNAME?.trim();
  // Ein Wert wie "$(creds read …)" ist ein Shell-Befehl, den Next.js und Docker nicht ausführen; die Bank wiese ihn ab.
  const plain = [clientId, clientSecret, username].every((v) => v && !v.includes("$("));
  return plain && clientId && clientSecret && username ? { clientId, clientSecret, username } : null;
}

export class ComdirectError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "ComdirectError";
  }
}

interface Tokens {
  access: string;
  refresh: string;
  obtainedAt: number;
}

/** Sitzung bei der Bank. Enthält Geheimnisse; bleibt im Speicher des Servers. */
export interface ComdirectSession {
  /** 32 Hexzeichen, für alle Abrufe derselben Sitzung gleich (Doku 1.2.2). */
  sessionId: string;
  /** Kennung der Sitzung bei der Bank, für TAN und Aktivierung. */
  identifier: string;
  tokens: Tokens;
  /** Erst nach der TAN: Tokens mit Zugriff auf Konten und Depot. */
  activated: boolean;
  lastRequestId: number;
}

export interface SessionChallenge {
  id: string;
  typ: TanType;
  /** photoTAN-Grafik als Base64-PNG; bei pushTAN `null`. */
  image: string | null;
  /** Pfad, unter dem die Bank meldet, ob die pushTAN bestätigt ist. */
  statusPath: string | null;
}

export interface Depot {
  id: string;
  /** Depotnummer, wie sie im Online-Banking steht. */
  displayId: string;
  /** Verrechnungskonto des Depots (zuerst das Standardkonto). */
  settlementAccountIds: string[];
}

export interface DepotStand {
  positions: DepotPosition[];
  /** Saldo des Verrechnungskontos in Euro; `null`, wenn keins gefunden wurde. */
  cashEur: number | null;
  /** `false`: Die Bank meldet mehr Positionen, als sie geliefert hat. Dann darf nichts übernommen werden. */
  complete: boolean;
  warnings: string[];
}

const Amount = z.object({ value: z.string(), unit: z.string() });
const TokenAnswer = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1) });
const SessionsAnswer = z.array(z.looseObject({ identifier: z.string().min(1) })).min(1);
const ChallengeHeader = z.looseObject({
  id: z.string().min(1),
  typ: z.string(),
  challenge: z.string().nullish(),
  availableTypes: z.array(z.string()).catch([]),
  link: z.looseObject({ href: z.string().regex(/^\/api\//) }).nullish(),
});
const PushStatus = z.looseObject({ status: z.string() });
const DepotRow = z.looseObject({
  depotId: z.string().min(1),
  depotDisplayId: z.string().catch(""),
  defaultSettlementAccountId: z.string().nullish(),
  settlementAccountIds: z.array(z.string()).nullish(),
});
const Paging = z.looseObject({ matches: z.number().int() }).nullish();
const DepotsAnswer = z.looseObject({ values: z.array(DepotRow) });
const PositionRow = z.looseObject({
  wkn: z.string().catch(""),
  quantity: Amount,
  currentValue: Amount.nullish(),
  instrument: z
    .looseObject({
      isin: z.string().nullish(),
      name: z.string().nullish(),
      shortName: z.string().nullish(),
      staticData: z.looseObject({ instrumentType: z.string().nullish() }).nullish(),
    })
    .nullish(),
});
const PositionsAnswer = z.looseObject({ paging: Paging, values: z.array(PositionRow) });
const BalanceRow = z.looseObject({
  accountId: z.string(),
  account: z.looseObject({ accountDisplayId: z.string().nullish() }).nullish(),
  balanceEUR: Amount.nullish(),
});
const BalancesAnswer = z.looseObject({ values: z.array(BalanceRow) });
/** Fehler der API (`code`, `messages`) oder des OAuth-Servers (`error`, `error_description`). */
const ErrorAnswer = z.looseObject({
  code: z.string().nullish(),
  messages: z.array(z.looseObject({ message: z.string() })).nullish(),
  error: z.string().nullish(),
  error_description: z.string().nullish(),
});

/** Betrag der Bank als Zahl: Dezimalpunkt, ohne Tausendertrennung (Doku 3.4.1). */
function decimal(value: string, label: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new ComdirectError(`Unerwarteter Betrag in ${label}.`);
  return Number(value);
}

/** Neun Ziffern, je Sitzung eindeutig (Doku 1.2.2: Zeitstempel HHmmssSSS). */
function nextRequestId(session: Pick<ComdirectSession, "lastRequestId">, now: number): string {
  const date = new Date(now);
  const stamp = date.getUTCHours() * 10_000_000 + date.getUTCMinutes() * 100_000 + date.getUTCSeconds() * 1000 + date.getUTCMilliseconds();
  session.lastRequestId = stamp > session.lastRequestId ? stamp : session.lastRequestId + 1;
  return String(session.lastRequestId % 1_000_000_000).padStart(9, "0");
}

/** Kurzer Grund aus einer Fehlerantwort der Bank; nie der Inhalt der Anfrage. */
async function failure(response: Response, what: string): Promise<ComdirectError> {
  let detail = "";
  const body = await response.text().catch(() => "");
  // Für die Fehlersuche im Serverprotokoll: nur die Antwort der Bank, nie die Anfrage (PIN, Secret, Tokens).
  console.warn(
    `comdirect: ${what} HTTP ${response.status}, ${response.headers.get("content-type") ?? "ohne Inhaltstyp"}, ${response.headers.get("x-http-response-info") ?? ""} ${body.slice(0, 500).replaceAll(/\s+/g, " ")}`,
  );
  try {
    const parsed = ErrorAnswer.safeParse(JSON.parse(body));
    if (parsed.success) {
      const { code, messages, error, error_description } = parsed.data;
      detail = [code ?? error, messages?.map((m) => m.message).join(" ") || error_description].filter(Boolean).join(": ");
    }
  } catch {
    // Kein JSON; der Status genügt.
  }
  const hint =
    (response.status === 401 || response.status === 403) && what === "Anmeldung"
      ? " Zugangsnummer oder PIN stimmt nicht, oder der API-Zugang ist für diese Zugangsnummer nicht freigeschaltet. Nicht mehrmals mit derselben PIN versuchen: Falsche PINs sperren den Zugang."
      : response.status === 429
        ? " Zu viele Anfragen, bitte kurz warten."
        : "";
  return new ComdirectError(
    `comdirect: ${what} fehlgeschlagen (HTTP ${response.status})${detail ? `: ${detail}` : ""}.${hint}`,
    response.status,
  );
}

async function send(fetchFn: Fetch, url: string, init: RequestInit, what: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ComdirectError(`comdirect: ${what} nicht erreichbar.`);
  }
  if (!response.ok) throw await failure(response, what);
  return response;
}

async function parsed<T>(response: Response, schema: z.ZodType<T>, what: string): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ComdirectError(`comdirect: ${what} lieferte kein JSON.`);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new ComdirectError(`comdirect: ${what} lieferte eine unerwartete Antwort.`);
  return result.data;
}

async function token(config: ComdirectConfig, fields: Record<string, string>, fetchFn: Fetch, what: string, now: number): Promise<Tokens> {
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...fields });
  const response = await send(
    fetchFn,
    `${BASE}/oauth/token`,
    { method: "POST", headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body },
    what,
  );
  const answer = await parsed(response, TokenAnswer, what);
  return { access: answer.access_token, refresh: answer.refresh_token, obtainedAt: now };
}

function headers(session: ComdirectSession, now: number, extra: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.tokens.access}`,
    "x-http-request-info": JSON.stringify({ clientRequestId: { sessionId: session.sessionId, requestId: nextRequestId(session, now) } }),
    ...extra,
  };
}

async function validate(session: ComdirectSession, fetchFn: Fetch, now: number, typ?: string) {
  const response = await send(
    fetchFn,
    `${BASE}/api/session/clients/user/v1/sessions/${encodeURIComponent(session.identifier)}/validate`,
    {
      method: "POST",
      headers: headers(session, now, typ ? { "x-once-authentication-info": JSON.stringify({ typ }) } : {}),
      body: JSON.stringify({ identifier: session.identifier, sessionTanActive: true, activated2FA: true }),
    },
    "TAN-Anforderung",
  );
  let header: unknown;
  try {
    header = JSON.parse(response.headers.get("x-once-authentication-info") ?? "");
  } catch {
    throw new ComdirectError("comdirect: TAN-Anforderung ohne Angaben zur TAN.");
  }
  const challenge = ChallengeHeader.safeParse(header);
  if (!challenge.success) throw new ComdirectError("comdirect: TAN-Anforderung mit unerwarteten Angaben zur TAN.");
  return challenge.data;
}

const isSupported = (typ: string): typ is TanType => (SUPPORTED_TAN as readonly string[]).includes(typ);

/**
 * Anmeldung mit Zugangsnummer und PIN und Anforderung der Sitzungs-TAN. Bietet die Bank zuerst ein Verfahren an, das die
 * Oberfläche nicht kann, fordert sie einmal pushTAN oder photoTAN an (jede Anforderung zählt bei der Bank mit).
 * @param onChallenge wird vor jeder TAN-Anforderung gerufen, auch wenn sie danach scheitert (die Bank zählt sie mit).
 */
export async function login(
  config: ComdirectConfig,
  pin: string,
  onChallenge: () => void,
  fetchFn: Fetch = fetch,
  now = Date.now(),
): Promise<{ session: ComdirectSession; challenge: SessionChallenge }> {
  const tokens = await token(config, { grant_type: "password", username: config.username, password: pin }, fetchFn, "Anmeldung", now);
  const session: ComdirectSession = {
    sessionId: randomUUID().replaceAll("-", ""),
    identifier: "",
    tokens,
    activated: false,
    lastRequestId: 0,
  };
  const sessions = await parsed(
    await send(fetchFn, `${BASE}/api/session/clients/user/v1/sessions`, { method: "GET", headers: headers(session, now) }, "Sitzung"),
    SessionsAnswer,
    "Sitzung",
  );
  session.identifier = sessions[0]!.identifier;

  onChallenge();
  let answer = await validate(session, fetchFn, now);
  if (!isSupported(answer.typ)) {
    const other = SUPPORTED_TAN.find((typ) => answer.availableTypes.includes(typ));
    if (!other) {
      throw new ComdirectError(
        `comdirect: Das TAN-Verfahren ${answer.typ} wird hier nicht unterstützt; bitte pushTAN oder photoTAN im Online-Banking einrichten.`,
      );
    }
    onChallenge();
    answer = await validate(session, fetchFn, now, other);
    if (!isSupported(answer.typ)) throw new ComdirectError(`comdirect: Das TAN-Verfahren ${answer.typ} wird hier nicht unterstützt.`);
  }
  const challenge: SessionChallenge = {
    id: answer.id,
    typ: answer.typ as TanType,
    image: answer.typ === "P_TAN" ? (answer.challenge ?? null) : null,
    statusPath: answer.link?.href ?? null,
  };
  if (challenge.typ === "P_TAN" && !challenge.image) throw new ComdirectError("comdirect: photoTAN ohne Grafik.");
  return { session, challenge };
}

/** Fragt, ob die pushTAN in der App bestätigt ist. `pending`: noch nicht; `failed`: abgelehnt oder verfallen. */
export async function pushStatus(
  session: ComdirectSession,
  challenge: SessionChallenge,
  fetchFn: Fetch = fetch,
  now = Date.now(),
): Promise<"pending" | "confirmed" | "failed"> {
  // Ohne Pfad kann nur der Versuch der Aktivierung zeigen, ob bestätigt ist.
  if (!challenge.statusPath) return "confirmed";
  const answer = await parsed(
    await send(fetchFn, `${BASE}${challenge.statusPath}`, { method: "GET", headers: headers(session, now) }, "Status der pushTAN"),
    PushStatus,
    "Status der pushTAN",
  );
  if (answer.status === "AUTHENTICATED") return "confirmed";
  return answer.status === "PENDING" ? "pending" : "failed";
}

/**
 * Aktiviert die Sitzungs-TAN und holt die Tokens für Konten und Depot. Bei pushTAN ohne `tan` (Doku 2.4), bei photoTAN
 * mit der eingetippten TAN. Nie mit derselben TAN wiederholen: Drei falsche TANs sperren den Zugang.
 */
export async function activate(
  config: ComdirectConfig,
  session: ComdirectSession,
  challenge: SessionChallenge,
  tan: string | null,
  fetchFn: Fetch = fetch,
  now = Date.now(),
): Promise<void> {
  const extra: Record<string, string> = { "x-once-authentication-info": JSON.stringify({ id: challenge.id }) };
  if (challenge.typ !== "P_TAN_PUSH") {
    if (!tan || !/^\d{6}$/.test(tan)) throw new ComdirectError("Die TAN hat sechs Ziffern.");
    extra["x-once-authentication"] = tan;
  }
  await send(
    fetchFn,
    `${BASE}/api/session/clients/user/v1/sessions/${encodeURIComponent(session.identifier)}`,
    {
      method: "PATCH",
      headers: headers(session, now, extra),
      body: JSON.stringify({ identifier: session.identifier, sessionTanActive: true, activated2FA: true }),
    },
    "Freigabe der TAN",
  );
  session.tokens = await token(config, { grant_type: "cd_secondary", token: session.tokens.access }, fetchFn, "Freischaltung", now);
  session.activated = true;
}

/** Erneuert die Tokens, wenn sie bald ablaufen. */
async function fresh(config: ComdirectConfig, session: ComdirectSession, fetchFn: Fetch, now: number): Promise<void> {
  if (!session.activated) throw new ComdirectError("comdirect: Die Sitzung ist noch nicht mit einer TAN freigegeben.");
  if (now - session.tokens.obtainedAt < REFRESH_AFTER_MS) return;
  session.tokens = await token(
    config,
    { grant_type: "refresh_token", refresh_token: session.tokens.refresh },
    fetchFn,
    "Verlängerung",
    now,
  );
}

async function get<T>(session: ComdirectSession, path: string, schema: z.ZodType<T>, what: string, fetchFn: Fetch, now: number) {
  return parsed(await send(fetchFn, `${BASE}${path}`, { method: "GET", headers: headers(session, now) }, what), schema, what);
}

export async function depots(
  config: ComdirectConfig,
  session: ComdirectSession,
  fetchFn: Fetch = fetch,
  now = Date.now(),
): Promise<Depot[]> {
  await fresh(config, session, fetchFn, now);
  const answer = await get(session, "/api/brokerage/clients/user/v3/depots", DepotsAnswer, "Depotliste", fetchFn, now);
  return answer.values.map((row) => ({
    id: row.depotId,
    displayId: row.depotDisplayId,
    settlementAccountIds: [
      ...new Set([row.defaultSettlementAccountId, ...(row.settlementAccountIds ?? [])].filter((id): id is string => Boolean(id))),
    ],
  }));
}

/** Positionen und Saldo des Verrechnungskontos eines Depots. */
export async function depotStand(
  config: ComdirectConfig,
  session: ComdirectSession,
  depot: Depot,
  fetchFn: Fetch = fetch,
  now = Date.now(),
): Promise<DepotStand> {
  await fresh(config, session, fetchFn, now);
  const warnings: string[] = [];
  const answer = await get(
    session,
    `/api/brokerage/v3/depots/${encodeURIComponent(depot.id)}/positions?with-attr=instrument`,
    PositionsAnswer,
    "Depotbestand",
    fetchFn,
    now,
  );
  const complete = !answer.paging || answer.paging.matches <= answer.values.length;
  if (!complete) {
    warnings.push(
      `Die Bank meldet ${answer.paging!.matches} Positionen, geliefert hat sie ${answer.values.length}. Unvollständig lässt sich nichts übernehmen.`,
    );
  }
  const positions = answer.values.map((row): DepotPosition => {
    const name = row.instrument?.name || row.instrument?.shortName || `WKN ${row.wkn}`;
    return {
      isin: isinOf(row.instrument?.isin),
      wkn: row.wkn,
      name,
      kind: row.instrument?.staticData?.instrumentType === "SHARE" ? "aktie" : "sonstiges",
      quantity: decimal(row.quantity.value, "der Stückzahl"),
      valueEur: row.currentValue?.unit === "EUR" ? decimal(row.currentValue.value, "dem Kurswert") : null,
    };
  });

  const balances = await get(session, "/api/banking/clients/user/v2/accounts/balances", BalancesAnswer, "Kontostände", fetchFn, now);
  // Die Doku lässt offen, ob das Depot das Konto mit seiner Kennung oder seiner Kontonummer nennt; beides passt.
  const settlement = depot.settlementAccountIds
    .map((id) => balances.values.find((b) => b.accountId === id || b.account?.accountDisplayId === id))
    .find((b) => b !== undefined);
  let cashEur: number | null = null;
  if (settlement?.balanceEUR) cashEur = decimal(settlement.balanceEUR.value, "dem Kontostand");
  return { positions, cashEur, complete, warnings };
}

/** Beendet die Sitzung bei der Bank; Fehler dabei sind egal, die Tokens verfallen ohnehin. */
export async function revoke(session: ComdirectSession, fetchFn: Fetch = fetch, now = Date.now()): Promise<void> {
  try {
    await fetchFn(`${BASE}/oauth/revoke`, {
      method: "DELETE",
      headers: headers(session, now),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Nicht erreichbar: Die Tokens laufen nach zehn Minuten ab.
  }
}
