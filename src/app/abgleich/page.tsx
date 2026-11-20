import type { ReactNode } from "react";
import { expectedFiscalYear, type Job } from "../../data/db.ts";
import { FUNDAMENTALS_KIND } from "../../data/eodhdSnapshot.ts";
import { CONFIRM_CALLS, estimateHistory, estimateRefresh, isJobKind, JOB_KINDS, refreshIds } from "../../jobs/registry.ts";
import { SYNC_RESERVE } from "../../jobs/reserve.ts";
import { FUNDAMENTALS_CALLS } from "../../jobs/stockpile.ts";
import { planPrices } from "../../sync/dailySync.ts";
import { cancelJob, setAutoSync, startHistory, startIndexImport, startRecompute, startRefresh, startSync } from "../actions.ts";
import { AutoRefresh } from "../autoRefresh.tsx";
import { eodhdBudget } from "../budget.ts";
import { amount, isoDate } from "../format.ts";
import { PendingButton } from "../pendingButton.tsx";
import { database, today } from "../server.ts";

export const dynamic = "force-dynamic";

const label = (job: Job) => (isJobKind(job.kind) ? JOB_KINDS[job.kind].label : job.kind);

const STATUS: Record<Job["status"], { text: string; tag: string }> = {
  queued: { text: "wartet", tag: "" },
  running: { text: "läuft", tag: "warn" },
  done: { text: "fertig", tag: "ok" },
  failed: { text: "gescheitert", tag: "bad" },
  cancelled: { text: "abgebrochen", tag: "" },
};

function when(iso: string | null): string {
  if (!iso) return "–";
  const date = new Date(iso);
  return `${isoDate(iso.slice(0, 10))} ${date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })}`;
}

function duration(job: Job): string {
  if (!job.startedAt) return "–";
  const ms = new Date(job.finishedAt ?? Date.now()).getTime() - new Date(job.startedAt).getTime();
  const minutes = Math.floor(ms / 60_000);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
    : minutes > 0
      ? `${minutes} min`
      : `${Math.round(ms / 1000)} s`;
}

const n = (value: number) => amount(value, 0);
const calls = (value: number) => `${n(value)} ${value === 1 ? "Abruf" : "Abrufe"}`;

/** Kosten eines Laufs; ab vielen Abrufen als Häkchen, das bestätigt werden muss. */
function Cost({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (value <= CONFIRM_CALLS) {
    return (
      <span className="meta">
        {calls(value)}
        {suffix}
      </span>
    );
  }
  return (
    <label className="meta confirm">
      <input type="checkbox" name="bestaetigt" required /> {calls(value)}
      {suffix} bestätigen
    </label>
  );
}

/** Startknopf für einen Lauf mit seinen Kosten; ohne offene Abrufe nur ein Vermerk. */
function Run(props: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string>;
  cost: number;
  suffix?: string;
  label: string;
  primary?: boolean;
}) {
  if (props.cost === 0) return <span className="meta">{props.label}: nichts offen</span>;
  return (
    <form action={props.action}>
      {Object.entries(props.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Cost value={props.cost} suffix={props.suffix} />
      <PendingButton className={props.primary ? "" : "quiet"} label={props.label} pendingLabel="Wird eingestellt …" />
    </form>
  );
}

/** Nächster Lauf des Timers im LXC: täglich 00:15 UTC. */
function nextScheduledRun(now: Date): Date {
  const run = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 15));
  if (run <= now) run.setUTCDate(run.getUTCDate() + 1);
  return run;
}

/** Eine Zeile im Plan: was die Daten leisten, wie der Stand ist, was ein Abruf kostet. */
function Step(props: { title: string; purpose: string; state: ReactNode; recommended?: boolean; children: ReactNode }) {
  return (
    <div className={`step${props.recommended ? " recommended" : ""}`}>
      <div>
        <h3>
          {props.title}
          {props.recommended && <span className="tag ok">empfohlen</span>}
        </h3>
        <p className="hint">{props.purpose}</p>
        <p className="state">{props.state}</p>
      </div>
      <div className="step-action">{props.children}</div>
    </div>
  );
}

export default async function Sync(props: { searchParams: Promise<{ lauf?: string; fehler?: string }> }) {
  const query = await props.searchParams;
  const db = database();
  const date = today();
  const active = db.activeJobs();
  const running = active.find((job) => job.status === "running");
  const waiting = active.filter((job) => job.status === "queued");
  const recent = db.jobs(30).filter((job) => job.status !== "queued" && job.status !== "running");
  const budget = await eodhdBudget();
  const free = budget ? Math.max(0, budget.dailyRateLimit - budget.requestsToday) : null;
  const requested = query.lauf ? db.job(Number(query.lauf)) : null;
  const self = "/abgleich";
  const auto = db.autoSync();

  // --- Datenstand und was jeder Schritt kostet ---
  const prices = planPrices(db, auto ? nextScheduledRun(new Date()) : new Date(), budget?.dailyRateLimit ?? null);
  const priceCalls = prices.bulkCalls + prices.singleCalls;
  const tracked = refreshIds(db, "watchlist", date);
  const trackedCount = new Set([...db.stocks().map((s) => s.id), ...db.heldStockIds()]).size;
  const stale = new Set(db.staleFundamentals(FUNDAMENTALS_KIND, date));
  const trackedStale = tracked.filter((id) => stale.has(id)).length;
  const withFundamentals = db.stockIdsWithRawDocument(FUNDAMENTALS_KIND).size;
  const historyFor = (scope: "watchlist" | "rechenbar") => estimateHistory(db, { refresh: false, scope, monthly: false });
  const trackedHistory = historyFor("watchlist");
  const ratedHistory = historyFor("rechenbar");
  const rated = db.ratedStockIds().size;
  const monthlyCost = estimateHistory(db, { refresh: false, scope: "alle", monthly: true });
  const monthlyMissing = monthlyCost - estimateHistory(db, { refresh: false, scope: "alle", monthly: false });
  const refreshAll = estimateRefresh(db, "alle", date);
  const importable = free === null ? null : Math.max(0, Math.floor((free - SYNC_RESERVE) / FUNDAMENTALS_CALLS));

  const steps = {
    prices: !auto,
    trackedFundamentals: trackedStale > 0,
    trackedHistory: trackedHistory > 0,
    ratedHistory: ratedHistory > trackedHistory,
    staleFundamentals: stale.size > trackedStale,
  };
  const next = steps.prices
    ? "den nächtlichen Abgleich einschalten"
    : steps.trackedFundamentals
      ? "Abschlüsse der Watchlist auffrischen"
      : steps.trackedHistory
        ? "Dividenden und Splits der Watchlist laden"
        : steps.ratedHistory
          ? "Dividenden und Splits der rechenbaren Titel laden"
          : steps.staleFundamentals
            ? "veraltete Abschlüsse im Datenvorrat auffrischen"
            : null;

  return (
    <>
      <AutoRefresh active={active.length > 0} />
      <div className="title-row">
        <div>
          <h1>Abgleich</h1>
          <p className="finding">
            {running
              ? `Läuft gerade: ${label(running)}${running.progressTotal ? ` (${running.progressDone ?? 0} von ${running.progressTotal})` : ""}.`
              : next
                ? `Als Nächstes: ${next}.`
                : auto
                  ? "Alles auf dem Stand. Kurse kommen jede Nacht um 1:15 Uhr (im Sommer 2:15 Uhr)."
                  : "Alles auf dem Stand."}
          </p>
        </div>
        <div className="title-actions">
          <form action={startRecompute.bind(null, self)}>
            <PendingButton className="quiet" label="Neu rechnen" pendingLabel="Wird eingestellt …" />
          </form>
          <form action={startSync.bind(null, self)}>
            <PendingButton label="Jetzt abgleichen" pendingLabel="Wird eingestellt …" />
          </form>
        </div>
      </div>
      {query.fehler && <div className="notice error">{query.fehler}</div>}
      {requested && (
        <div className="notice ok">
          {label(requested)} ist eingestellt (Lauf {requested.id}). Es läuft immer nur ein Lauf; weitere warten der Reihe nach.
        </div>
      )}

      <dl className="card figures">
        <div className="figure">
          <dt>EODHD heute frei</dt>
          <dd>{free === null ? "–" : n(free)}</dd>
          <span className="sub">
            {budget
              ? `${n(budget.requestsToday)} von ${n(budget.dailyRateLimit)} verbraucht, Tarif ${budget.subscription}`
              : "Konto nicht erreichbar oder kein Token gesetzt"}
          </span>
        </div>
        <div className="figure">
          <dt>Nächster Abgleich</dt>
          <dd>{calls(priceCalls)}</dd>
          <span className="sub">
            Kurse für {n(prices.stale)} Titel
            {prices.bulkCalls > 0 ? " mit Sammelabruf je Börse" : ""}
            {prices.stragglers > 0 ? `, dazu bis zu ${n(prices.stragglers)} Nachzügler einzeln` : ""}
            {prices.stockpileSkipped > 0 ? `; ${n(prices.stockpileSkipped)} im Datenvorrat bleiben ohne Kurs (Budget zu klein)` : ""}
          </span>
        </div>
        <div className="figure">
          <dt>Warteschlange</dt>
          <dd>{active.length}</dd>
          <span className="sub">
            {active.length === 0 ? "leer" : `${running ? "einer läuft" : "keiner läuft"}, ${waiting.length} warten`}
          </span>
        </div>
      </dl>

      {active.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Aktuell</h2>
            <span className="meta">aktualisiert sich alle drei Sekunden</span>
          </div>
          <div className="card-body stack">
            {active.map((job) => (
              <div key={job.id}>
                <div className="row">
                  <strong>{label(job)}</strong>
                  <span className={`tag ${STATUS[job.status].tag}`}>{STATUS[job.status].text}</span>
                  <span className="meta">
                    Lauf {job.id}
                    {job.startedAt ? `, seit ${when(job.startedAt)} (${duration(job)})` : `, eingestellt ${when(job.createdAt)}`}
                  </span>
                  {(job.status === "queued" || (isJobKind(job.kind) && JOB_KINDS[job.kind].cancellable)) && !job.cancelRequested && (
                    <form action={cancelJob.bind(null, job.id)}>
                      <button type="submit" className="small quiet">
                        Abbrechen
                      </button>
                    </form>
                  )}
                  {job.cancelRequested && <span className="meta">hört beim nächsten Titel auf</span>}
                </div>
                {job.progressTotal ? (
                  <progress value={job.progressDone ?? 0} max={job.progressTotal} aria-label={`Fortschritt ${label(job)}`} />
                ) : null}
                {job.log && <pre className="research">{job.log.split("\n").slice(-15).join("\n")}</pre>}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Was die Rangliste braucht</h2>
          <span className="meta">in dieser Reihenfolge; große Läufe lassen {n(SYNC_RESERVE)} Abrufe für den Abgleich übrig</span>
        </div>

        <Step
          title="Kurse"
          purpose="Ohne Kurs keine Rendite. Jede Nacht, nachdem EODHD das Tageslimit zurückgesetzt hat."
          recommended={steps.prices}
          state={
            <>
              {n(prices.current)} aktuell, {n(prices.stale)} veraltet
              {prices.neverPriced > 0 ? `, davon ${n(prices.neverPriced)} noch nie ein Kurs` : ""}
              {prices.paused > 0 ? `; ${n(prices.paused)} pausiert, weil der Abruf wiederholt scheiterte` : ""}.{" "}
              {auto ? "Nächtlicher Abgleich ist an." : "Nächtlicher Abgleich ist aus."}
            </>
          }
        >
          <span className="meta">{calls(priceCalls)} je Nacht</span>
          <form action={setAutoSync}>
            <input type="hidden" name="automatisch" value={auto ? "aus" : "an"} />
            <PendingButton
              className={auto ? "quiet" : ""}
              label={auto ? "Nachts ausschalten" : "Nachts einschalten"}
              pendingLabel="Wird gespeichert …"
            />
          </form>
        </Step>

        <Step
          title="Abschlüsse von Watchlist und Bestand"
          purpose="Rückfluss, Wachstum und Risiko kommen aus den Jahresabschlüssen. Einmal nach der Berichtssaison (März bis Mai) auffrischen."
          recommended={steps.trackedFundamentals}
          state={
            trackedStale > 0
              ? `${n(trackedStale)} von ${n(trackedCount)} Titeln mit wahrscheinlich fehlendem Geschäftsjahr ${expectedFiscalYear(date)}.`
              : `${n(trackedCount)} Titel, alle mit aktuellem Geschäftsjahr oder kürzlich geladen.`
          }
        >
          <Run
            action={startRefresh}
            fields={{ umfang: "watchlist" }}
            cost={tracked.length * FUNDAMENTALS_CALLS}
            label="Auffrischen"
            primary={steps.trackedFundamentals}
          />
        </Step>

        <Step
          title="Dividenden und Splits"
          purpose="Prüfen, ob die Zahlen je Aktie zum Kurs passen. Titel mit unbereinigtem Split fallen aus dem Screening, statt mit falscher Rendite oben zu stehen."
          recommended={steps.trackedHistory || steps.ratedHistory}
          state={`Fehlen für Watchlist und Bestand: ${calls(trackedHistory)}; für alle ${n(rated)} Titel mit berechenbarer Rendite: ${calls(ratedHistory)}.`}
        >
          <Run
            action={startHistory}
            fields={{ umfang: "watchlist" }}
            cost={trackedHistory}
            label="Für die Watchlist"
            primary={steps.trackedHistory}
          />
          <Run
            action={startHistory}
            fields={{ umfang: "rechenbar" }}
            cost={ratedHistory}
            label="Für alle rechenbaren"
            primary={!steps.trackedHistory && steps.ratedHistory}
          />
        </Step>

        <Step
          title="Veraltete Abschlüsse im Datenvorrat"
          purpose="Ein Titel, dem das letzte Geschäftsjahr fehlt, rechnet mit alten Zahlen. Nur die, deren letzter Abruf älter als 90 Tage ist."
          recommended={steps.staleFundamentals}
          state={
            stale.size > 0
              ? `${n(stale.size)} von ${n(withFundamentals)} Titeln wahrscheinlich veraltet.`
              : `Keiner von ${n(withFundamentals)} Titeln veraltet.`
          }
        >
          <Run
            action={startRefresh}
            fields={{ umfang: "veraltet" }}
            cost={stale.size * FUNDAMENTALS_CALLS}
            label="Auffrischen"
            primary={steps.staleFundamentals}
          />
        </Step>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Neue Titel in den Datenvorrat</h2>
          <span className="meta">
            je Titel {calls(FUNDAMENTALS_CALLS)}
            {importable !== null ? `; heute passen noch etwa ${n(importable)} Titel` : ""}
          </span>
        </div>
        <form className="card-body stack" action={startIndexImport}>
          <p className="hint">
            Alle Bestandteile eines Index (z. B. GSPC.INDX, STOXX.INDX) oder alle Stammaktien einer Börse (z. B. IL). Eine Börse mit 1.000
            Aktien kostet etwa 10.000 Abrufe. Was heute nicht passt, setzt ein neuer Start morgen fort. Der Algorithmus nutzt nur
            ausschüttende Titel; Nicht-Ausschütter landen in der Gruppe „Rückfluss 0“.
          </p>
          <div className="row">
            <input
              className="wide"
              type="text"
              name="indizes"
              placeholder="Indizes, z. B. GSPC.INDX"
              aria-label="Indizes"
              autoComplete="off"
            />
            <input type="text" name="boersen" placeholder="Börsen, z. B. IL" aria-label="Börsen" autoComplete="off" />
          </div>
          <label className="meta confirm">
            <input type="checkbox" name="bestaetigt" required /> Mir ist klar: je neuem Titel {calls(FUNDAMENTALS_CALLS)}
          </label>
          <div>
            <PendingButton label="Laden" pendingLabel="Wird eingestellt …" className="quiet" />
          </div>
        </form>
      </section>

      <details className="card">
        <summary className="card-head">
          <h2>Selten nötig</h2>
          <span className="meta">für die Rangliste nicht erforderlich</span>
        </summary>
        <Step
          title="Monatskurse"
          purpose="Für einen späteren Rückblick gespeichert; die Bewertung wertet sie nicht aus."
          state={`Fehlen für ${n(monthlyMissing)} Titel.`}
        >
          <Run
            action={startHistory}
            fields={{ umfang: "alle", monatskurse: "on" }}
            cost={monthlyMissing === 0 ? 0 : monthlyCost}
            label="Laden"
            suffix=" mit fehlenden Dividenden und Splits"
          />
        </Step>
        <Step
          title="Alle Abschlüsse neu laden"
          purpose="Nur vor einer Kündigung des Tarifs oder nach einer Änderung beim Anbieter. Neue Kennzahlen gewinnt „Neu rechnen“ ohne Abruf aus den gespeicherten Antworten."
          state={`${n(withFundamentals)} Titel.`}
        >
          <Run action={startRefresh} fields={{ umfang: "alle" }} cost={refreshAll} label="Alle neu laden" suffix=", über mehrere Tage" />
        </Step>
      </details>

      <section className="card">
        <div className="card-head">
          <h2>Letzte Läufe</h2>
        </div>
        {recent.length === 0 ? (
          <p className="empty">Noch keine Läufe über die Warteschlange.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Lauf</th>
                  <th>Status</th>
                  <th className="wide-only">Beginn</th>
                  <th className="num wide-only">Dauer</th>
                  <th>Ergebnis</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((job) => (
                  <tr key={job.id}>
                    <td>
                      {label(job)}
                      <span className="meta"> · {job.id}</span>
                    </td>
                    <td>
                      <span className={`tag ${STATUS[job.status].tag}`}>{STATUS[job.status].text}</span>
                    </td>
                    <td className="wide-only">{when(job.startedAt)}</td>
                    <td className="num wide-only">{duration(job)}</td>
                    <td>
                      {job.log ? (
                        <details className="research-details">
                          <summary>{job.summary ?? "Protokoll"}</summary>
                          <pre className="research">{job.log}</pre>
                        </details>
                      ) : (
                        (job.summary ?? "–")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
