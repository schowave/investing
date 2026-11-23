import Link from "next/link";
import { notFound } from "next/navigation";
import { MAX_OPEN_CHALLENGES, openChallenges } from "../../../../comdirect/abruf.ts";
import { comdirectConfig } from "../../../../comdirect/api.ts";
import type { Preview, RowStatus } from "../../../../comdirect/bestand.ts";
import { findVorgang, VORGANG_MINUTES } from "../../../../comdirect/vorgang.ts";
import {
  applyComdirect,
  cancelComdirect,
  chooseComdirectDepot,
  confirmComdirectTan,
  retryComdirect,
  startComdirect,
} from "../../../comdirectActions.ts";
import { amount } from "../../../format.ts";
import { PendingButton } from "../../../pendingButton.tsx";
import { database } from "../../../server.ts";

export const dynamic = "force-dynamic";

const euro = (value: number | null) => (value === null ? "–" : `${amount(value, 2)} €`);
const pieces = (value: number) => (value === 0 ? "–" : amount(value, value % 1 === 0 ? 0 : 4));
const STATUS: Record<RowStatus, { text: string; tag: string }> = {
  neu: { text: "neu", tag: "ok" },
  geändert: { text: "geändert", tag: "warn" },
  weg: { text: "fällt weg", tag: "bad" },
  gleich: { text: "gleich", tag: "" },
  "ohne ISIN": { text: "bleibt, ohne ISIN", tag: "warn" },
};

function Vorschau({ preview }: { preview: Preview }) {
  const changed = preview.rows.filter((r) => r.status !== "gleich").length;
  return (
    <>
      <dl className="card figures">
        <div className="figure">
          <dt>Barbestand</dt>
          <dd>{euro(preview.cash.after)}</dd>
          <span className="sub">bisher {euro(preview.cash.before)}; Saldo des Verrechnungskontos</span>
        </div>
        <div className="figure">
          <dt>Sonstige Anlagen</dt>
          <dd>{euro(preview.other.after)}</dd>
          <span className="sub">bisher {euro(preview.other.before)}; Kurswert laut Bank</span>
        </div>
        <div className="figure">
          <dt>Aktien</dt>
          <dd>{preview.shares.size}</dd>
          <span className="sub">{changed === 0 ? "keine Änderung" : `${changed} ${changed === 1 ? "Änderung" : "Änderungen"}`}</span>
        </div>
      </dl>

      <section className="card">
        <div className="card-head">
          <h2>Aktien im Bestand</h2>
          <span className="meta">zugeordnet über die ISIN</span>
        </div>
        {preview.rows.length === 0 ? (
          <p className="empty">Keine Aktie, die schon in der Datenbank steht.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Aktie</th>
                  <th className="num">bisher</th>
                  <th className="num">neu</th>
                  <th>Änderung</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.stockId}>
                    <td>
                      <span className="name">{row.name}</span>
                      <small>
                        {row.stockId}
                        {row.isin ? ` · ${row.isin}` : ""}
                      </small>
                    </td>
                    <td className="num">{pieces(row.before)}</td>
                    <td className="num">{pieces(row.after)}</td>
                    <td>
                      <span className={`tag ${STATUS[row.status].tag}`}>{STATUS[row.status].text}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {preview.others.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Sonstige Anlagen</h2>
            <span className="meta">Fonds, ETF, Anleihen, Zertifikate und Aktien, die erst aufgenommen werden</span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th className="num">Kurswert</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {preview.others.map((other, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Eine ISIN kann in mehreren Lagerstellen vorkommen.
                  <tr key={index}>
                    <td>
                      <span className="name">{other.name}</span>
                      <small>{other.isin ?? `WKN ${other.wkn}`}</small>
                    </td>
                    <td className="num">{euro(other.valueEur)}</td>
                    <td>
                      {other.pendingImport && <span className="tag warn">wird aufgenommen</span>}
                      {other.notFound && <span className="tag">nicht beim Anbieter</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

export default async function ComdirectPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vorgang?: string; fehler?: string; hinweis?: string }>;
}) {
  const id = Number((await props.params).id);
  const query = await props.searchParams;
  const portfolio = Number.isInteger(id) ? database().portfolio(id) : null;
  if (!portfolio) notFound();
  const configured = comdirectConfig() !== null;
  const vorgang = query.vorgang ? findVorgang(query.vorgang, portfolio.id) : null;
  const state = vorgang?.state ?? null;
  const back = `/portfolio/${portfolio.id}`;
  const blocked = openChallenges() >= MAX_OPEN_CHALLENGES;

  let finding: string;
  if (!configured) finding = "Der Abruf ist nicht eingerichtet: Es fehlen die Zugangsdaten der comdirect in der Umgebung.";
  else if (!state) finding = "Melde dich mit deiner PIN an; danach bestätigst du die Anmeldung mit einer TAN.";
  else if (state.step === "tan")
    finding =
      state.challenge.typ === "P_TAN_PUSH"
        ? "Bestätige die Anmeldung in der App der comdirect und klicke dann auf „Weiter“."
        : "Scanne die photoTAN-Grafik mit der App und tippe die TAN ein.";
  else if (state.step === "freigegeben") finding = "Die TAN ist freigegeben, aber Depot oder Bestand ließen sich nicht laden.";
  else if (state.step === "depot") finding = "Unter deinem Zugang gibt es mehrere Depots. Welches gehört zu diesem Portfolio?";
  else finding = `Vorschau aus Depot ${state.depot.displayId}: Mit „Übernehmen“ ersetzt sie den ganzen Bestand von „${portfolio.name}“.`;

  return (
    <>
      <Link className="crumb" href={back}>
        ← {portfolio.name}
      </Link>
      <div className="title-row">
        <div>
          <h1>Bestand aus der comdirect</h1>
          <p className="finding">{finding}</p>
        </div>
      </div>

      {query.fehler && <div className="notice error">{query.fehler}</div>}
      {query.hinweis && state && <div className="notice">{query.hinweis}</div>}
      {query.vorgang && !vorgang && <div className="notice">Der Abruf ist abgelaufen oder beendet. Bitte neu starten.</div>}

      {!configured && (
        <section className="card">
          <div className="card-body stack">
            <p>
              Den API-Zugang schaltest du einmal im Online-Banking der comdirect frei. Client-ID und Client-Secret sowie deine Zugangsnummer
              gehören dann als <code>COMDIRECT_CLIENT_ID</code>, <code>COMDIRECT_CLIENT_SECRET</code> und <code>COMDIRECT_USERNAME</code> in{" "}
              <code>.env.local</code> (lokal) bzw. <code>/opt/investing/.env</code> (LXC). Die PIN gibst du bei jedem Abruf hier ein.
            </p>
          </div>
        </section>
      )}

      {configured && !state && (
        <form className="card" action={startComdirect.bind(null, portfolio.id)}>
          <div className="card-head">
            <h2>Anmelden</h2>
            <span className="meta">die PIN wird nicht gespeichert</span>
          </div>
          <div className="card-body stack">
            <label className="row">
              <span className="factor">PIN</span>
              <input type="password" name="pin" inputMode="numeric" autoComplete="off" required pattern="\d{4,8}" />
            </label>
            {blocked && (
              <label className="meta confirm">
                <input type="checkbox" name="zaehler" required /> Schon {openChallenges()} TAN-Anforderungen ohne Freigabe; bei fünf sperrt
                die comdirect den Zugang. Ich habe mich seitdem im Online-Banking mit TAN angemeldet.
              </label>
            )}
            <p className="hint">
              Jede Anmeldung fordert eine TAN an. Fünf Anforderungen ohne Freigabe dazwischen oder drei falsche TANs sperren den Zugang zum
              Online-Banking. Ein Abruf verfällt nach {VORGANG_MINUTES} Minuten.
            </p>
            <div>
              <PendingButton label="Anmelden und TAN anfordern" pendingLabel="Melde an …" />
            </div>
          </div>
        </form>
      )}

      {vorgang && state?.step === "tan" && (
        <form className="card" action={confirmComdirectTan.bind(null, portfolio.id, vorgang.id)}>
          <div className="card-head">
            <h2>{state.challenge.typ === "P_TAN_PUSH" ? "pushTAN" : "photoTAN"}</h2>
          </div>
          <div className="card-body stack">
            {state.challenge.typ === "P_TAN" ? (
              <>
                {/* biome-ignore lint/performance/noImgElement: Grafik der Bank als data-URL, nichts zu optimieren. */}
                <img className="phototan" src={`data:image/png;base64,${state.challenge.image}`} alt="photoTAN-Grafik zum Scannen" />
                <label className="row">
                  <span className="factor">TAN</span>
                  <input type="text" name="tan" inputMode="numeric" autoComplete="one-time-code" required pattern="\d{6}" />
                </label>
              </>
            ) : (
              <p className="hint">Nach dem Klick wartet die Seite bis zu 45 Sekunden auf deine Bestätigung in der App.</p>
            )}
            <div className="row">
              <PendingButton
                label="Weiter"
                pendingLabel={state.challenge.typ === "P_TAN_PUSH" ? "Warte auf Bestätigung …" : "Prüfe TAN …"}
              />
            </div>
          </div>
        </form>
      )}

      {vorgang && state?.step === "freigegeben" && (
        <form action={retryComdirect.bind(null, portfolio.id, vorgang.id)}>
          <PendingButton label="Erneut laden (ohne neue TAN)" pendingLabel="Lade …" />
        </form>
      )}

      {vorgang && (state?.step === "depot" || state?.step === "vorschau") && state.depots.length > 1 && (
        <form className="card" action={chooseComdirectDepot.bind(null, portfolio.id, vorgang.id)}>
          <div className="card-head">
            <h2>Depot</h2>
            <span className="meta">das Portfolio merkt sich das Depot bei der Übernahme</span>
          </div>
          <div className="card-body row">
            <select name="depot" aria-label="Depot" defaultValue={state.step === "vorschau" ? state.depot.id : undefined}>
              {state.depots.map((depot) => (
                <option key={depot.id} value={depot.id}>
                  Depot {depot.displayId}
                </option>
              ))}
            </select>
            <PendingButton label={state.step === "vorschau" ? "Anderes Depot laden" : "Weiter"} pendingLabel="Lade …" className="quiet" />
          </div>
        </form>
      )}

      {vorgang && state?.step === "vorschau" && (
        <>
          {state.preview.warnings.length > 0 && (
            <div className="notice">
              {state.preview.warnings.map((w) => (
                <div key={w}>{w}</div>
              ))}
            </div>
          )}
          <Vorschau preview={state.preview} />
          <div className="row">
            {state.stand.complete && (
              <form action={applyComdirect.bind(null, portfolio.id, vorgang.id)}>
                <PendingButton label="Übernehmen" pendingLabel="Übernehme …" />
              </form>
            )}
            {state.preview.missingIsins.length > 0 && (
              <span className="meta">
                {state.preview.missingIsins.length === 1 ? "Eine Aktie wird" : `${state.preview.missingIsins.length} Aktien werden`} danach
                über die ISIN in den Datenvorrat aufgenommen; der nächste Abruf ordnet sie zu.
              </span>
            )}
          </div>
        </>
      )}

      {vorgang && (
        <form action={cancelComdirect.bind(null, portfolio.id, vorgang.id)}>
          <button className="quiet" type="submit">
            Abbrechen
          </button>
        </form>
      )}
    </>
  );
}
