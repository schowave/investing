import Link from "next/link";
import { FINANCIAL_STAND_INS } from "../../calc/risk.ts";
import type { RatingGap } from "../../data/db.ts";
import { MAX_PAYOUT_YIELD, MIN_PRICE_TO_EARNINGS } from "../../valuation/valuation.ts";
import { addStocks, setWatched } from "../actions.ts";
import { amount, isoDate, percent } from "../format.ts";
import { stockPath } from "../origin.ts";
import { PendingButton } from "../pendingButton.tsx";
import { database } from "../server.ts";

export const dynamic = "force-dynamic";

const LIMIT = 100;

const GAP_LABELS: Record<RatingGap, { title: string; hint: string }> = {
  "kurs-nicht-abrufbar": {
    title: "Kurs nicht abrufbar",
    hint: "der Abruf bei EODHD ist gescheitert, meist ein eingestellter Titel oder ein unbekanntes Symbol; der Abgleich versucht es höchstens alle 30 Tage",
  },
  "rueckfluss-null": { title: "Rückfluss 0", hint: "keine Dividende, keine Rückkäufe: ohne Rückfluss gibt es keine Rendite" },
  "kein-kurs": { title: "Kein Kurs", hint: "es liegt kein Kurs oder kein Wechselkurs vor" },
  "wachstum-fehlt": { title: "Wachstum unbekannt", hint: "aus den Zahlen ergibt sich kein Vorschlag für das Wachstum" },
  "rueckfluss-fehlt": { title: "Rückfluss unbekannt", hint: "aus den Zahlen ergibt sich kein Vorschlag für den Rückfluss" },
  "keine-loesung": { title: "Keine Lösung", hint: "die Eingaben ergeben keine Rendite" },
};
const GAP_ORDER = Object.keys(GAP_LABELS) as RatingGap[];
const number = (value: number) => value.toLocaleString("de-DE");
const isGap = (value: string | undefined): value is RatingGap => value !== undefined && value in GAP_LABELS;
const RISK_OPTIONS = [
  { value: "", label: "jedes Risiko" },
  { value: "0.2", label: "Risiko bisher bis 20 %" },
  { value: "0.5", label: "Risiko bisher bis 50 %" },
];
const RETURN_OPTIONS = [
  { value: "", label: "jede Rendite" },
  { value: "0.2", label: "Rendite bis 20 %" },
  { value: "0.15", label: "Rendite bis 15 %" },
];

const SOURCE_LABEL = { opus: "Opus", jev: "Jev", hand: "von Hand", vorschlag: "Jev-Vorschlag" } as const;

/** Woher die Werte von Hand stammen; ohne Bewertung ein Strich. */
function AssessmentTag({ value }: { value: { source: keyof typeof SOURCE_LABEL; date: string | null } | undefined }) {
  if (!value) return <span className="meta">–</span>;
  const label = SOURCE_LABEL[value.source];
  if (value.source === "vorschlag")
    return (
      <span className="meta" title="Jev hat eingestuft, übernommen ist nichts">
        {label}
      </span>
    );
  return (
    <span
      className={`tag ${value.source === "opus" ? "ok" : ""}`}
      title={value.date ? `zuletzt gesetzt am ${isoDate(value.date)}` : undefined}
    >
      {label}
      {value.date ? ` ${isoDate(value.date).slice(0, 6)}` : ""}
    </span>
  );
}

export default async function Stockpile(props: {
  searchParams: Promise<{
    q?: string;
    region?: string;
    risiko?: string;
    rendite?: string;
    alle?: string;
    seite?: string;
    luecke?: string;
    lauf?: string;
    fehler?: string;
  }>;
}) {
  const params = await props.searchParams;
  const query = (params.q ?? "").trim();
  const region = params.region ?? "";
  const maxRisk = RISK_OPTIONS.some((o) => o.value === params.risiko) && params.risiko ? Number(params.risiko) : undefined;
  const maxReturn = RETURN_OPTIONS.some((o) => o.value === params.rendite) && params.rendite ? Number(params.rendite) : undefined;
  const db = database();

  const includeImplausible = params.alle === "1";
  const filter = { query: query || undefined, region: region || undefined, maxRisk, maxReturn, includeImplausible };
  const gap = isGap(params.luecke) ? params.luecke : undefined;
  const total = gap ? 0 : db.countScreening(filter);
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const rawPage = Number(params.seite);
  const page = Number.isInteger(rawPage) ? Math.min(Math.max(rawPage, 1), pages) : 1;
  const ranked = gap ? [] : db.screening(filter, LIMIT, (page - 1) * LIMIT);
  const sources = db.assessmentSources(ranked.map((r) => r.stock.id));
  const gaps = db.ratingGaps(filter);
  const gapTotal = GAP_ORDER.reduce((sum, key) => sum + gaps[key], 0);
  const gapPage = gap ? db.unrated(gap, filter, LIMIT, (page - 1) * LIMIT) : [];
  const gapPages = gap ? Math.max(1, Math.ceil(gaps[gap] / LIMIT)) : 1;
  // Titel ohne berechenbare Rendite (kein Kurs, zu wenige Jahre) erscheinen nur bei einer Suche.
  const rankedIds = new Set(ranked.map((r) => r.stock.id));
  const others = query.length >= 2 ? db.searchStocks(query, 40).filter((h) => !rankedIds.has(h.stock.id)) : [];
  const base = { q: query, region, risiko: params.risiko ?? "", rendite: params.rendite ?? "", alle: params.alle ?? "" };
  /** Adresse dieser Seite mit den Filtern; `extra` setzt Seite oder Lücke. */
  const here = (extra: Record<string, string> = {}) => `/vorrat?${new URLSearchParams({ ...base, ...extra })}`;
  const returnTo = here({ ...(gap ? { luecke: gap } : {}), ...(page > 1 ? { seite: String(page) } : {}) });
  const lastPage = gap ? gapPages : pages;
  const first = (page - 1) * LIMIT + 1;
  const pager = (count: number) =>
    lastPage > 1 && (
      <nav className="pager" aria-label="Seiten">
        <span className="meta">
          Treffer {number(first)}–{number(first + count - 1)} von {number(gap ? gaps[gap] : total)}
        </span>
        {page > 1 ? <Link href={here({ ...(gap ? { luecke: gap } : {}), seite: String(page - 1) })}>← Vorherige</Link> : <span />}
        {page < lastPage ? <Link href={here({ ...(gap ? { luecke: gap } : {}), seite: String(page + 1) })}>Weitere →</Link> : <span />}
      </nav>
    );

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Datenvorrat</h1>
          <p className="finding">
            Alle gespeicherten Titel nach vorläufiger innerer Rendite, gerechnet allein aus den Vorschlägen. Dein Urteil fehlt noch, der
            Risikowert ist deshalb eine Untergrenze. Ausnahme Finanzwerte: Für Finanzierung, Kapitalrendite und EBIT-Marge gibt es dort
            keinen Vorschlag, bis zu deinem Urteil zählen sie mit einem Ersatzabzug von zusammen{" "}
            {percent(Object.values(FINANCIAL_STAND_INS).reduce((sum, value) => sum + value, 0))}.
          </p>
        </div>
        <Link href="/vorrat/maerkte">Abgedeckte Märkte →</Link>
      </div>
      {params.fehler && <div className="notice error">{params.fehler}</div>}
      {params.lauf && (
        <div className="notice ok">
          Die Titel werden im Hintergrund geladen und kommen auf die Watchlist. Stand auf der Seite <Link href="/abgleich">Abgleich</Link>.
        </div>
      )}
      <details className="card">
        <summary className="card-head">
          <h2>Titel aufnehmen</h2>
          <span className="meta">über ISIN oder Symbol mit Börse, je Titel rund 11 Abrufe</span>
        </summary>
        <form className="card-body stack" action={addStocks}>
          <textarea
            name="titel"
            rows={4}
            aria-label="ISINs oder Symbole"
            placeholder={"GB0004544929 US16119P1084\noder KAP.IL KSPI.US – eine kopierte Depotliste geht auch"}
          />
          <PendingButton label="Laden und auf die Watchlist" pendingLabel="Wird eingestellt …" />
        </form>
      </details>
      <form className="card card-body row" action="/vorrat" style={{ paddingTop: 16 }}>
        <input type="search" name="q" defaultValue={query} placeholder="Name oder Symbol" aria-label="Suche" />
        <select name="region" defaultValue={region} aria-label="Region">
          <option value="">alle Regionen</option>
          {db.regions().map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select name="risiko" defaultValue={params.risiko ?? ""} aria-label="Risiko">
          {RISK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select name="rendite" defaultValue={params.rendite ?? ""} aria-label="Rendite">
          {RETURN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <label className="meta">
          <input type="checkbox" name="alle" value="1" defaultChecked={includeImplausible} /> auch Titel mit unplausiblen Zahlen
        </label>
        <button type="submit">Anzeigen</button>
      </form>

      {gapTotal > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Ohne berechenbare Rendite</h2>
            <span className="meta">{number(gapTotal)} Titel, die nur über diese Listen oder die Suche zu finden sind</span>
          </div>
          <ul className="gap-list">
            {GAP_ORDER.filter((key) => gaps[key] > 0).map((key) => (
              <li key={key}>
                <Link href={here({ luecke: key })} aria-current={gap === key ? "true" : undefined}>
                  <strong>{GAP_LABELS[key].title}</strong> <span className="num">{number(gaps[key])}</span>
                </Link>
                <span className="meta">{GAP_LABELS[key].hint}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {gap && (
        <section className="card">
          <div className="card-head">
            <h2>
              {GAP_LABELS[gap].title}: {number(gaps[gap])} Titel
            </h2>
            <Link href={here()}>← Zur Rangliste</Link>
          </div>
          <p className="hint" style={{ padding: "4px var(--pad) 0" }}>
            {GAP_LABELS[gap].hint}. Öffne einen Titel und trage selbst einen Wert ein, wenn du ihn trotzdem bewerten willst.
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Aktie</th>
                  <th>Branche</th>
                  <th className="num">Kurs</th>
                  <th>Watchlist</th>
                </tr>
              </thead>
              <tbody>
                {gapPage.map(({ stock, row }) => (
                  <tr key={stock.id}>
                    <td>
                      <Link className="name" href={stockPath(stock.id, returnTo)}>
                        {stock.name}
                      </Link>
                      <small>
                        {stock.id} · {stock.region}
                      </small>
                    </td>
                    <td>{stock.sector}</td>
                    <td className="num">{amount(row.price)}</td>
                    <td>
                      <form action={setWatched.bind(null, stock.id, !stock.watched, returnTo)}>
                        <button className="quiet small" type="submit">
                          {stock.watched ? "Entfernen" : "Aufnehmen"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {gap && pager(gapPage.length)}

      {!gap && (
        <>
          <section className="card">
            <div className="card-head">
              <h2>{query ? `Treffer für „${query}"` : "Höchste vorläufige Rendite"}</h2>
              <span className="meta">
                {ranked.length === 0
                  ? "Keine Titel mit berechenbarer Rendite. Der Datenvorrat wird beim täglichen Abgleich bewertet."
                  : `${number(total)} Titel, höchste vorläufige Rendite zuerst.`}
              </span>
            </div>
            {ranked.length === 0 ? (
              <p className="empty">Nichts gefunden. Ohne Filter erscheinen die Titel mit der höchsten vorläufigen Rendite.</p>
            ) : (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Aktie</th>
                      <th className="num">Innere Rendite</th>
                      <th className="num">Kurs</th>
                      <th className="num">Rückfluss</th>
                      <th className="num">Wachstum</th>
                      <th className="num">Risiko bisher</th>
                      <th>Bewertung</th>
                      <th>Watchlist</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map(({ stock, row }) => (
                      <tr key={stock.id}>
                        <td>
                          <Link className="name" href={stockPath(stock.id, returnTo)}>
                            {stock.name}
                          </Link>
                          <small>
                            {stock.id} · {stock.sector} · {stock.region}
                          </small>
                        </td>
                        <td className="num">
                          <span className="return">{percent(row.innerReturn)}</span>
                          {row.implausible && <small>unplausibel</small>}
                        </td>
                        <td className="num">
                          {amount(row.price)}
                          <small>
                            {stock.reportingCurrency}, {isoDate(row.priceDate)}
                          </small>
                        </td>
                        <td className="num">{amount(row.payoutLevel)}</td>
                        <td className="num">{percent(row.growth)}</td>
                        <td className="num">{percent(row.riskScore, 0)}</td>
                        <td>
                          <AssessmentTag value={sources.get(stock.id)} />
                        </td>
                        <td>
                          <form action={setWatched.bind(null, stock.id, !stock.watched, returnTo)}>
                            <button className="quiet small" type="submit">
                              {stock.watched ? "Entfernen" : "Aufnehmen"}
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {pager(ranked.length)}
          <p className="meta" style={{ marginTop: 10 }}>
            Ausgeblendet sind Titel, deren Rückfluss über {percent(MAX_PAYOUT_YIELD, 0)} des Kurses oder deren Kurs unter dem{" "}
            {MIN_PRICE_TO_EARNINGS}-Fachen des Gewinnniveaus liegt, und Titel mit unbereinigtem Aktiensplit. Das sind meist Datenfehler.
          </p>
        </>
      )}

      {others.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Weitere Treffer ohne berechenbare Rendite</h2>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Aktie</th>
                  <th>Branche</th>
                  <th className="num">Geschäftsjahre</th>
                  <th>Watchlist</th>
                </tr>
              </thead>
              <tbody>
                {others.map(({ stock, fiscalYears }) => (
                  <tr key={stock.id}>
                    <td>
                      <Link className="name" href={stockPath(stock.id, returnTo)}>
                        {stock.name}
                      </Link>
                      <small>
                        {stock.id} · {stock.region}
                      </small>
                    </td>
                    <td>{stock.sector}</td>
                    <td className="num">{fiscalYears < 10 ? <span className="tag warn">{fiscalYears}</span> : fiscalYears}</td>
                    <td>
                      <form action={setWatched.bind(null, stock.id, !stock.watched, returnTo)}>
                        <button className="quiet small" type="submit">
                          {stock.watched ? "Entfernen" : "Aufnehmen"}
                        </button>
                      </form>
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
