import type { Job } from "../../data/db.ts";
import { estimateCalls, isJobKind, JOB_KINDS } from "../../jobs/registry.ts";
import { cancelJob, setAutoSync, startHistory, startIndexImport, startRefreshAll, startSync } from "../actions.ts";
import { AutoRefresh } from "../autoRefresh.tsx";
import { eodhdBudget } from "../budget.ts";
import { amount, isoDate } from "../format.ts";
import { PendingButton } from "../pendingButton.tsx";
import { database } from "../server.ts";

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

const calls = (n: number) => `${amount(n, 0)} ${n === 1 ? "Abruf" : "Abrufe"}`;

function Confirm({ cost }: { cost: string }) {
  return (
    <label className="row">
      <input type="checkbox" name="bestaetigt" required /> Mir ist klar: {cost} vom Tagesbudget, bei großen Läufen über mehrere Tage
    </label>
  );
}

export default async function Sync(props: { searchParams: Promise<{ lauf?: string; fehler?: string }> }) {
  const query = await props.searchParams;
  const db = database();
  const active = db.activeJobs();
  const running = active.find((job) => job.status === "running");
  const waiting = active.filter((job) => job.status === "queued");
  const recent = db.jobs(30).filter((job) => job.status !== "queued" && job.status !== "running");
  const budget = await eodhdBudget();
  const free = budget ? Math.max(0, budget.dailyRateLimit - budget.requestsToday) : null;
  const requested = query.lauf ? db.job(Number(query.lauf)) : null;
  const self = "/abgleich";
  const auto = db.autoSync();

  return (
    <>
      <AutoRefresh active={active.length > 0} />
      <div className="title-row">
        <div>
          <h1>Abgleich</h1>
          <p className="finding">
            {running
              ? `Läuft gerade: ${label(running)}${running.progressTotal ? ` (${running.progressDone ?? 0} von ${running.progressTotal})` : ""}.`
              : auto
                ? "Kein Lauf aktiv. Der Abgleich läuft jede Nacht um 1:15 Uhr (im Sommer 2:15 Uhr) von selbst, nachdem EODHD das Tageslimit zurückgesetzt hat; hier startest du ihn und größere Läufe von Hand."
                : "Kein Lauf aktiv. Der nächtliche Abgleich ist ausgeschaltet: Kurse und Bewertungen kommen nur, wenn du ihn hier von Hand startest."}
          </p>
        </div>
        <div className="title-actions">
          <form action={setAutoSync}>
            <input type="hidden" name="automatisch" value={auto ? "aus" : "an"} />
            <PendingButton
              className="quiet"
              label={auto ? "Nächtlichen Abgleich ausschalten" : "Nächtlichen Abgleich einschalten"}
              pendingLabel="Wird gespeichert …"
            />
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

      <dl className="figures">
        <div className="figure">
          <dt>EODHD heute frei</dt>
          <dd>{free === null ? "–" : amount(free, 0)}</dd>
          <span className="sub">
            {budget
              ? `${amount(budget.requestsToday, 0)} von ${amount(budget.dailyRateLimit, 0)} verbraucht, Tarif ${budget.subscription}`
              : "Konto nicht erreichbar oder kein Token gesetzt"}
          </span>
        </div>
        <div className="figure">
          <dt>Abgleich jetzt</dt>
          <dd>{calls(estimateCalls(db, "sync"))}</dd>
          <span className="sub">höchstens, je Watchlist-Titel mit altem Kurs einer</span>
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
          <h2>Große Läufe</h2>
          <span className="meta">brauchen viele Abrufe; am Tageslimit hören sie auf, ein neuer Start setzt fort</span>
        </div>
        <div className="card-body stack">
          <form className="stack" action={startHistory}>
            <strong>Historie laden</strong>
            <span className="hint">
              Dividenden, Splits und Monatskurse für alle gespeicherten Titel, denen sie noch fehlen (je Titel 3 Abrufe). Braucht einen
              Tarif mit Kursdaten.
            </span>
            <label className="row">
              <input type="checkbox" name="neu" /> Auch vorhandene neu laden
            </label>
            <Confirm cost={`fehlende: ${calls(estimateCalls(db, "history"))}`} />
            <PendingButton label="Historie laden" pendingLabel="Wird eingestellt …" className="quiet" />
          </form>
          <form className="stack" action={startIndexImport}>
            <strong>Indizes oder Börsen in den Datenvorrat laden</strong>
            <span className="hint">
              Neue Titel aus Indizes (z. B. GSPC.INDX STOXX.INDX) oder alle Stammaktien einer Börse (z. B. IL); je Titel 10 Abrufe.
            </span>
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
            <Confirm cost="je neuem Titel 10 Abrufe" />
            <PendingButton label="Laden" pendingLabel="Wird eingestellt …" className="quiet" />
          </form>
          <form className="stack" action={startRefreshAll}>
            <strong>Alle Titel auffrischen</strong>
            <span className="hint">Lädt die Abschlüsse aller gespeicherten Titel neu, z. B. vor einer Kündigung des Tarifs.</span>
            <Confirm cost={calls(estimateCalls(db, "refresh-all"))} />
            <PendingButton label="Alle auffrischen" pendingLabel="Wird eingestellt …" className="quiet" />
          </form>
        </div>
      </section>

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
