import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import type { RiskFactorId } from "../../../calc/index.ts";
import {
  EXCLUSION_SCORE,
  MANUAL_FOR_FINANCIALS,
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
  positionLimit,
  RISK_FACTOR_IDS,
  RISK_FACTORS,
} from "../../../calc/index.ts";
import type { FundamentalsYear } from "../../../data/db.ts";
import { storedSnapshot } from "../../../data/eodhdSnapshot.ts";
import { currentProposals, LEVELS_VERSION } from "../../../judgement/factors.ts";
import { researchAvailable } from "../../../judgement/research.ts";
import { situationSignals } from "../../../judgement/situation.ts";
import { rankingHurdle } from "../../../valuation/ranking.ts";
import { needsReview, REVIEW_MONTHS } from "../../../valuation/review.ts";
import { computeValuation } from "../../../valuation/run.ts";
import type { InputKey } from "../../../valuation/valuation.ts";
import { doubtfulNumbers, priceSensitivity } from "../../../valuation/valuation.ts";
import { refreshStockData, requestJudgement, saveInputs, saveManualPrice, setWatched } from "../../actions.ts";
import { amount, isoDate, percent } from "../../format.ts";
import { originLabel, safeOrigin, stockPath } from "../../origin.ts";
import { ReturnRange, scaleFor } from "../../parts.tsx";
import { PendingButton } from "../../pendingButton.tsx";
import { database, today, watchlistRanking } from "../../server.ts";

export const dynamic = "force-dynamic";

const PRICE_STEPS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2];

/** Was ein Faktor verlangt; 0 % heißt erfüllt. */
const REQUIREMENT: Record<RiskFactorId, string> = {
  earnings: "Gewinn und Umsatz weitgehend konstant, keine starken Einbrüche",
  financing: "Schulden im Verhältnis zur Ertragskraft tragbar, Zinsen gut gedeckt",
  size: "Bilanzsumme über 20 Mrd. Euro",
  age: "besteht seit über 20 Jahren",
  sector: "nicht subventioniert, nicht schnelllebig, von dir verstanden",
  country: "Sitz in Europa, Nordamerika oder Japan",
  moat: "mindestens durchschnittliche Wettbewerbsvorteile; Bonus bei starkem Burggraben",
  returnOnCapital: "Rendite auf das eingesetzte Kapital über 10 %",
  ebitMargin: "EBIT-Marge über 10 %",
  management: "keine Hinweise auf schlechtes oder unredliches Management; Bonus bei hervorragendem",
  forecast: "Prognosen des Unternehmens weitgehend zuverlässig",
  cashFlow: "erzielt freien Cashflow und schüttet verlässlich aus",
  dependencies: "nicht von einem Rohstoff, Lieferanten oder Kunden abhängig",
  currency: "berichtet in Euro, Dollar, Franken, Pfund oder Yen",
  situation: "keine Krise im Unternehmen",
};

type Series = { label: string; value: (year: FundamentalsYear) => number | null; asPercent?: boolean };
const perShare = (pick: (y: FundamentalsYear) => number | null) => (y: FundamentalsYear) => {
  const total = pick(y);
  return total === null || !y.shares ? null : total / y.shares;
};
const SERIES: Series[] = [
  { label: "Gewinn je Aktie", value: (y) => y.epsDiluted },
  { label: "Dividende je Aktie", value: (y) => y.dividendPerShare },
  { label: "Rückkäufe je Aktie", value: perShare((y) => y.repurchases) },
  { label: "Freier Cashflow je Aktie", value: perShare((y) => y.freeCashFlow) },
  { label: "Umsatz je Aktie", value: perShare((y) => y.revenue) },
  { label: "Eigenkapital je Aktie", value: perShare((y) => y.equity) },
  { label: "EBIT-Marge", value: (y) => (y.ebit === null || !y.revenue ? null : y.ebit / y.revenue), asPercent: true },
  { label: "Nettoschulden zum EBITDA", value: (y) => (y.netDebt === null || !y.ebitda || y.ebitda <= 0 ? null : y.netDebt / y.ebitda) },
  { label: "Aktien in Mio.", value: (y) => (y.shares === null ? null : y.shares / 1e6) },
];

/** Wert für ein Zahlenfeld: Punkt als Dezimalzeichen, höchstens zwei Nachkommastellen. */
const fieldNumber = (value: number | undefined, asPercent: boolean) =>
  value === undefined ? "" : String(Math.round((asPercent ? value * 100 : value) * 100) / 100);
const allowed = (id: RiskFactorId) => {
  const factor = RISK_FACTORS[id];
  return {
    min: -factor.bonus * 100,
    max: factor.maxDeduction * 100,
    text: `${factor.bonus > 0 ? `−${factor.bonus * 100}` : "0"} bis ${factor.maxDeduction * 100} %`,
  };
};

export default async function StockPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; gespeichert?: string; lauf?: string; von?: string }>;
}) {
  const id = decodeURIComponent((await props.params).id);
  const query = await props.searchParams;
  const db = database();
  const stock = db.stock(id);
  if (!stock) notFound();

  const { proposals, valuation: v, priceDate, review } = computeValuation(db, stock, today());
  const doubtful = doubtfulNumbers(v, proposals);
  const years = db.fundamentals(stock.id).slice(-10);
  const history = db.valuationHistory(stock.id, 12);
  const d = proposals.details;
  const hurdle = rankingHurdle(db);
  const excluded = v.riskScore >= EXCLUSION_SCORE;
  const { payoutLevel, growth } = v.inputs;
  const currency = stock.reportingCurrency;
  const von = safeOrigin(query.von);
  const self = stockPath(stock.id, von);
  const backLabel = originLabel(von, (portfolioId) => db.portfolio(portfolioId)?.name);
  // Wer von der Rangliste kommt, kann sie Titel für Titel durchgehen, ohne jedes Mal zurückzuspringen.
  const ranked = von === "/" ? watchlistRanking().rows : [];
  const position = ranked.findIndex((entry) => entry.stock.id === stock.id);
  const previous = position > 0 ? ranked[position - 1] : undefined;
  const following = position >= 0 ? ranked[position + 1] : undefined;
  const origin = <input type="hidden" name="von" value={von} />;
  const judgement = db.judgement(stock.id);
  // Eine Einstufung nach älteren Stufen bleibt mit Recherche und Quellen sichtbar, schlägt aber nichts mehr vor.
  const outdated = judgement !== null && judgement.levelsVersion !== LEVELS_VERSION;
  const jevProposals = currentProposals(judgement);
  const jevFor = (key: InputKey) => jevProposals[key.replace(/^risk\./, "")];
  const canResearch = researchAvailable();
  const secFilings = judgement?.sources.filter((source) => source.kind === "sec") ?? [];
  const webSources = judgement?.sources.filter((source) => source.kind !== "sec") ?? [];
  // Das 52-Wochen-Hoch von EODHD steht in der Börseneinheit (z. B. Pence), der gespeicherte Kurs ist schon umgerechnet.
  const latestClose = db.latestPrice(stock.id)?.close ?? null;
  const signals = situationSignals({
    snapshot: storedSnapshot(db, stock.id),
    price: latestClose === null ? null : latestClose * stock.priceDivisor,
    isFinancial: stock.isFinancial,
  });

  // Urteil: Faktoren ohne Vorschlag aus Zahlen. Bei Finanzwerten gehören drei weitere dazu.
  const isJudgement = (factorId: RiskFactorId) =>
    RISK_FACTORS[factorId].manual || (stock.isFinancial && MANUAL_FOR_FINANCIALS.includes(factorId));
  const judged = RISK_FACTOR_IDS.filter(isJudgement);
  const computed = RISK_FACTOR_IDS.filter((factorId) => !isJudgement(factorId));
  const openJudgements = judged.filter((factorId) => v.inputs[`risk.${factorId}`] === undefined).length;
  const openWithJev = judged.filter((factorId) => v.inputs[`risk.${factorId}`] === undefined && jevFor(`risk.${factorId}`)).length;
  const computedSum = computed.reduce((sum, factorId) => sum + (v.inputs[`risk.${factorId}`] ?? 0), 0);
  const computedNeedsAttention = computed.some(
    (factorId) => v.inputs[`risk.${factorId}`] === undefined || v.manual.includes(`risk.${factorId}`),
  );
  const cautious = v.returns?.cautious ?? null;
  const base = v.returns?.base ?? null;

  let finding: ReactNode;
  if (excluded)
    finding = `Ausgeschlossen: Der Risikowert liegt bei ${percent(v.riskScore, 0)}, ab ${percent(EXCLUSION_SCORE, 0)} gilt ein Titel als Spekulation.`;
  else if (base === null) {
    // Die Rendite braucht Kurs, einen Rückfluss über 0 und Wachstum; die Urteile (Risiko) sind dafür nicht nötig.
    const reasons: { key: string; text: string; anchor?: string }[] = [];
    if (v.price === null) reasons.push({ key: "price", text: "kein Kurs" });
    if (v.inputs.payoutLevel === undefined) {
      reasons.push({ key: "payout", text: "Rückfluss je Aktie fehlt", anchor: "#payoutLevel" });
    } else if (v.inputs.payoutLevel <= 0) {
      reasons.push({
        key: "payout",
        text: "Rückfluss je Aktie ist 0",
        anchor: "#payoutLevel",
      });
    }
    if (v.inputs.growth === undefined) reasons.push({ key: "growth", text: "Wachstum zu Beginn fehlt", anchor: "#growth" });
    finding = (
      <>
        Keine Rendite rechenbar:{" "}
        {reasons.map((reason, index) => (
          <Fragment key={reason.key}>
            {index > 0 && "; "}
            {reason.anchor ? <a href={reason.anchor}>{reason.text}</a> : reason.text}
          </Fragment>
        ))}
        {reasons.length === 0 && "Eingaben ohne Lösung"}
      </>
    );
  } else if (!v.complete) {
    finding = `Vorläufig ${percent(base)}. ${v.missing.length === 1 ? "Eine Eingabe fehlt" : `${v.missing.length} Eingaben fehlen`}, bevor der Titel Kandidat fürs Portfolio werden kann.`;
  } else if (base >= hurdle)
    finding = `Kandidat mit ${percent(base)} innerer Rendite (vorsichtig ${percent(cautious)}). Ob er ins Portfolio kommt, entscheidet sein Rang.`;
  else finding = `Bringt mit ${percent(base)} weniger als die Anleihe (${percent(hurdle)}).`;

  const numberRow = (
    key: InputKey,
    label: string,
    hint: string,
    opts: { min: number; max: number; step: number; unit: string; asPercent: boolean; range: string },
  ) => {
    const show = opts.asPercent ? percent : amount;
    const isManual = v.manual.includes(key);
    const isOpen = v.inputs[key] === undefined;
    // Pflicht: ohne diesen Wert gibt es keine innere Rendite (Rückfluss über 0, Wachstum). Urteile sind keine Pflicht dafür.
    const required =
      base === null && ((key === "payoutLevel" && (isOpen || (v.inputs.payoutLevel ?? 0) <= 0)) || (key === "growth" && isOpen));
    // Jev-Vorschläge gibt es nur für Urteilsfaktoren; sie füllen das leere Feld vor, gelten aber erst nach dem Speichern.
    const jev = isOpen ? jevFor(key) : undefined;
    const prefill = isManual ? fieldNumber(v.inputs[key], opts.asPercent) : jev ? fieldNumber(jev.value, true) : "";
    return (
      <tr key={key} className={required ? "required" : isOpen ? "open" : isManual ? "manual" : ""}>
        <td>
          <label htmlFor={key} className="factor">
            {label}
          </label>
          <span className="hint">{hint}</span>
        </td>
        <td className="num wide-only">{opts.range}</td>
        <td className="num wide-only">
          {jev ? (
            <>
              {show(jev.value)}
              <small className={jev.confidence < 0.5 ? "unsure" : ""} title="Vorschlag von Jev und wie sicher Jev sich ist">
                Jev · {percent(jev.confidence, 0)}
              </small>
            </>
          ) : proposals.values[key] === undefined ? (
            <span className="meta">keiner</span>
          ) : (
            show(proposals.values[key])
          )}
        </td>
        <td className="num">
          <span className="field">
            <input
              id={key}
              name={key}
              type="number"
              inputMode="decimal"
              min={opts.min}
              max={opts.max}
              step={opts.step}
              autoComplete="off"
              defaultValue={prefill}
              placeholder={isOpen ? "offen" : "Vorschlag"}
            />
            <span className="unit">{opts.unit}</span>
          </span>
        </td>
        <td className="num">
          {isOpen ? (
            <span className={`tag ${required ? "bad" : "warn"}`}>{required ? "Pflicht" : "offen"}</span>
          ) : (
            <>
              <strong>{show(v.inputs[key])}</strong>
              {required && <span className="tag bad">über 0 nötig</span>}
            </>
          )}
        </td>
      </tr>
    );
  };
  const riskRow = (factorId: RiskFactorId) => {
    const range = allowed(factorId);
    return numberRow(`risk.${factorId}`, RISK_FACTORS[factorId].label, REQUIREMENT[factorId], {
      min: range.min,
      max: range.max,
      step: 0.5,
      unit: "%",
      asPercent: true,
      range: range.text,
    });
  };
  const head = (
    <thead>
      <tr>
        <th>Eingabe</th>
        <th className="num wide-only">Erlaubt</th>
        <th className="num wide-only">Vorschlag</th>
        <th className="num">Dein Wert</th>
        <th className="num">Es gilt</th>
      </tr>
    </thead>
  );

  return (
    <>
      <div className="crumbs">
        <Link className="crumb" href={von}>
          ← {backLabel}
        </Link>
        {(previous || following) && (
          <span className="steps">
            {previous && (
              <Link className="crumb" href={stockPath(previous.stock.id)} title={previous.stock.name}>
                ← Vorheriger in der Rangliste
              </Link>
            )}
            {following && (
              <Link className="crumb" href={stockPath(following.stock.id)} title={following.stock.name}>
                Nächster in der Rangliste →
              </Link>
            )}
          </span>
        )}
      </div>
      <div className="title-row">
        <div>
          <h1>{stock.name}</h1>
          <p className="finding">{finding}</p>
          <p className="meta">
            {stock.id} · {stock.sector} · {stock.region} · berichtet in {currency}
            {stock.isFinancial ? " · Finanzwert" : ""}
            {stock.watched ? "" : " · im Datenvorrat, nicht auf der Watchlist"}
          </p>
        </div>
        <div className="title-actions">
          <form action={refreshStockData.bind(null, stock.id)}>
            {origin}
            <PendingButton className="quiet" label="Daten aktualisieren" pendingLabel="Wird eingestellt …" />
          </form>
          <form action={setWatched.bind(null, stock.id, !stock.watched, self)}>
            <button className={stock.watched ? "quiet" : ""} type="submit">
              {stock.watched ? "Von der Watchlist nehmen" : "Auf die Watchlist"}
            </button>
          </form>
        </div>
      </div>

      {query.fehler && <div className="notice error">Nicht gespeichert: {query.fehler}</div>}
      {query.gespeichert && <div className="notice ok">Gespeichert.</div>}
      {doubtful && (
        <div className="notice error">
          <strong>Zahlen passen nicht zum Kurs.</strong> {doubtful} Meist bezieht sich ein Hinterlegungsschein auf eine andere Stückelung
          oder Währung. Die Rendite ist so nicht verwertbar; setze das Rückflussniveau von Hand passend zum Kurs.
        </div>
      )}
      {v.complete && needsReview(review) && (
        <div className="notice">
          <strong>Bewertung prüfen.</strong>{" "}
          {review.overdue && `Sie ist vom ${isoDate(review.assessedOn)} und damit älter als ${REVIEW_MONTHS} Monate. `}
          {review.changes.length > 0 &&
            `Seit dem ${isoDate(review.assessedOn)} haben sich die Vorschläge aus den Zahlen verschoben: ${review.changes.join("; ")}. `}
          {review.changes.length > 0 &&
            review.calcChanged &&
            "Die Rechnung hat sich seither geändert; ein Teil der Verschiebung kann daher kommen statt aus neuen Zahlen. "}
          Sieh dir Rückfluss, Wachstum und dein Urteil noch einmal an. Speichern bestätigt die Bewertung mit dem heutigen Datum.
        </div>
      )}
      {query.lauf && (
        <div className="notice ok">
          Abschlüsse und Historie werden im Hintergrund neu geladen (13 Abrufe), danach neu bewertet. Stand auf der Seite{" "}
          <Link href="/abgleich">Abgleich</Link>; diese Seite zeigt die neuen Zahlen nach dem Neuladen.
        </div>
      )}

      <dl className="card figures">
        <div className="figure">
          <dt>Innere Rendite{v.complete ? "" : ", vorläufig"}</dt>
          <dd className={base !== null && base >= hurdle ? "lead" : ""}>{percent(base)}</dd>
          <span className="sub">
            {v.returns
              ? `${percent(cautious)} bis ${percent(v.returns.optimistic)}, Anleiherendite ${percent(hurdle)}`
              : "nicht berechenbar"}
          </span>
          {v.returns && (
            <ReturnRange
              cautious={cautious}
              base={base}
              optimistic={v.returns.optimistic}
              hurdle={hurdle}
              scaleMax={scaleFor([v.returns.optimistic], hurdle)}
            />
          )}
          {v.payoutRatio && (
            <span className="sub">
              Ausschüttungsquote steigt in der Rechnung von {percent(v.payoutRatio.now, 0)} auf {percent(v.payoutRatio.terminal, 0)}, wenn
              das Wachstum abflacht
            </span>
          )}
          {Math.abs(v.inflationGap) >= 0.005 && v.localReturn !== null && (
            <span className="sub">
              in {currency} {percent(v.localReturn)}, Inflationsabstand zum Euro {percent(v.inflationGap)}
            </span>
          )}
        </div>
        <div className="figure">
          <dt>Kurs</dt>
          <dd className={v.price === null ? "muted-value" : ""}>{amount(v.price)}</dd>
          <span className="sub">{v.price === null ? "kein Kurs oder kein Wechselkurs" : `${currency}, ${isoDate(priceDate)}`}</span>
        </div>
        <div className="figure">
          <dt>Risikowert{openJudgements > 0 ? ", Untergrenze" : ""}</dt>
          <dd>{percent(v.riskScore, 0)}</dd>
          <span className="sub">
            {v.riskClass}, Ausfall {percent(v.defaultProbability)} pro Jahr
          </span>
        </div>
        <div className="figure">
          <dt>Positionslimit</dt>
          <dd className={excluded ? "muted-value" : ""}>
            {excluded ? "–" : percent(positionLimit(PROFILE_FOCUSED.baseLimit, v.riskScore))}
          </dd>
          <span className="sub">
            {excluded ? "ausgeschlossen" : `fokussiert; global ${percent(positionLimit(PROFILE_GLOBAL.baseLimit, v.riskScore))}`}
          </span>
        </div>
      </dl>

      <div className="columns">
        <form className="card" id="urteil" action={saveInputs.bind(null, stock.id)}>
          {origin}
          <div className="card-head">
            <h2>Bewertung</h2>
            <span className="meta">
              {v.missing.length === 0 ? "alle Eingaben gesetzt" : `${v.missing.length} offen`}
              {review.assessedOn ? `, zuletzt gespeichert am ${isoDate(review.assessedOn)}` : ""}
            </span>
          </div>

          <p className="section-label">Dein Urteil</p>
          <span className="hint">
            Diese Faktoren lassen sich nicht aus Zahlen ablesen. 0 heißt: Anforderung erfüllt. Je schlechter, desto höher der Abzug; ein
            Bonus ist negativ.
            {openWithJev > 0 &&
              " Felder mit Jev-Vorschlag sind vorausgefüllt und gelten erst, wenn du speicherst. Ob du die Branche verstehst, kann Jev nicht beurteilen."}
          </span>
          {signals.length > 0 && (
            <div className="notice" style={{ marginTop: 12 }}>
              <strong>Lage selbst prüfen.</strong> {signals.map((signal) => signal.text).join(" ")} Lies die jüngsten Meldungen, bevor du
              die aktuelle Situation einschätzt{judgement ? "; Jev sieht Nachrichten nur, soweit sie in den Unterlagen stehen" : ""}.
            </div>
          )}
          <div className="scroll">
            <table>
              {head}
              <tbody>{judged.map(riskRow)}</tbody>
            </table>
          </div>

          <p className="section-label">Rückfluss und Wachstum</p>
          <span className="hint">
            Ein leeres Feld übernimmt den Vorschlag aus den Zahlen der letzten {d.fiscalYears.length || 10} Jahre.
          </span>
          <div className="scroll">
            <table>
              {head}
              <tbody>
                {numberRow("payoutLevel", "Rückfluss je Aktie", "Dividende plus Netto-Rückkäufe, wie du sie fürs kommende Jahr erwartest", {
                  min: 0,
                  max: 1e9,
                  step: 0.01,
                  unit: "",
                  asPercent: false,
                  range: currency,
                })}
                {numberRow("growth", "Wachstum zu Beginn", "schmilzt über 15 Jahre auf höchstens 3 % ab", {
                  min: -20,
                  max: 30,
                  step: 0.1,
                  unit: "%",
                  asPercent: true,
                  range: "−20 bis 30 %",
                })}
              </tbody>
            </table>
          </div>

          <details className="more" open={computedNeedsAttention}>
            <summary>
              Risikofaktoren aus Zahlen: zusammen {percent(computedSum, 0)}
              {computed.some((factorId) => v.inputs[`risk.${factorId}`] === undefined) ? ", einer ohne Vorschlag" : ""}
            </summary>
            <div className="scroll">
              <table>
                {head}
                <tbody>{computed.map(riskRow)}</tbody>
              </table>
            </div>
          </details>

          <div className="savebar">
            <button type="submit">Bewertung speichern</button>
            <span className="meta">
              {openWithJev > 0
                ? `Speichern übernimmt ${openWithJev === 1 ? "den vorausgefüllten Jev-Vorschlag" : `${openWithJev} vorausgefüllte Jev-Vorschläge`}.`
                : openJudgements > 0
                  ? `${openJudgements === 1 ? "Ein Urteil fehlt" : `${openJudgements} Urteile fehlen`} noch.`
                  : "Leere Felder übernehmen den Vorschlag."}
            </span>
          </div>
        </form>

        <div className="stack">
          <section className="card">
            <div className="card-head">
              <h2>Vorschläge von Jev</h2>
              {judgement && <span className="meta">{isoDate(judgement.createdAt.slice(0, 10))}</span>}
            </div>
            <div className="card-body">
              <p className="meta">
                {judgement
                  ? judgement.research
                    ? `Eingestuft von ${judgement.jevModel} nach einer Recherche im Netz (${judgement.researchModel}, ${webSources.length} Quellen)${secFilings.length > 0 ? ` und ${secFilings.length} Mitteilungen an die SEC` : ""}.`
                    : `Eingestuft von ${judgement.jevModel} aus den gespeicherten Daten${secFilings.length > 0 ? ` und ${secFilings.length} Mitteilungen an die SEC` : ""}, ohne Recherche im Netz.`
                  : "Jev stuft die sechs Urteilsfaktoren ein. Vorher sucht Claude im Netz nach Belegen zu Management, Prognosen und aktueller Lage."}
                {outdated && " Die Stufen wurden seitdem neu gefasst; diese Vorschläge gelten nicht mehr. Bitte neu einstufen."}
                {!canResearch && " Für die Recherche fehlt ANTHROPIC_API_KEY in .env.local."}
              </p>
              <form className="row" action={requestJudgement.bind(null, stock.id)} style={{ marginTop: 12 }}>
                {origin}
                {canResearch ? <input type="hidden" name="research" value="on" /> : <input type="hidden" name="research" value="off" />}
                <PendingButton
                  className={judgement && !outdated ? "quiet" : ""}
                  label={judgement ? "Neu einstufen" : "Vorschläge holen"}
                  pendingLabel={canResearch ? "Recherchiere, bis zu drei Minuten …" : "Stufe ein …"}
                />
              </form>
              {judgement?.research && (
                <details className="research-details">
                  <summary>Recherche lesen</summary>
                  <p className="research">{judgement.research}</p>
                  {webSources.length > 0 && (
                    <ul className="notes">
                      {webSources.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.title || source.url}
                          </a>
                          {source.pageAge && <span className="meta"> · {source.pageAge}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              )}
              {secFilings.length > 0 && (
                <details className="research-details">
                  <summary>Mitteilungen an die SEC lesen</summary>
                  <ul className="notes">
                    {secFilings.map((filing) => (
                      <li key={filing.url}>
                        {filing.pageAge && <span className="meta">{isoDate(filing.pageAge)} · </span>}
                        <a href={filing.url} target="_blank" rel="noreferrer">
                          {filing.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </section>

          {proposals.notes.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>Hinweise</h2>
              </div>
              <div className="card-body">
                <ul className="notes">
                  {proposals.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {v.price !== null && payoutLevel !== undefined && growth !== undefined && (
            <section className="card">
              <div className="card-head">
                <h2>Rendite bei anderen Kursen</h2>
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="num">Kurs in {currency}</th>
                      <th className="num">Abstand</th>
                      <th className="num">Innere Rendite</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priceSensitivity(v, PRICE_STEPS).map(({ step, price, innerReturn: value }) => (
                      <tr key={step}>
                        <td className="num">{amount(price)}</td>
                        <td className="num">{step === 0 ? "heute" : `${step > 0 ? "+" : ""}${percent(step, 0)}`}</td>
                        <td className="num">
                          <strong>{percent(value)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head">
              <h2>Herleitung der Vorschläge</h2>
            </div>
            <div className="scroll">
              <table className="plain">
                <tbody>
                  <tr>
                    <td>Gewinnniveau je Aktie</td>
                    <td className="num">{amount(d.earningsLevel)}</td>
                  </tr>
                  <tr>
                    <td>
                      Dividendenniveau, {d.dividendsFromHistory ? "aus der Dividendenhistorie" : "aus gezahlter Summe und Aktienzahl"}
                    </td>
                    <td className="num">{amount(d.dividendLevel)}</td>
                  </tr>
                  <tr>
                    <td>Netto-Rückkäufe je Aktie, fünf Jahre</td>
                    <td className="num">{amount(d.netBuybacksPerShare)}</td>
                  </tr>
                  <tr>
                    <td>Tilgung überhöhter Schulden je Aktie</td>
                    <td className="num">{amount(d.debtRepaymentPerShare)}</td>
                  </tr>
                  <tr>
                    <td>Tragbarer Rückfluss je Aktie</td>
                    <td className="num">{amount(d.sustainablePayout)}</td>
                  </tr>
                  <tr>
                    <td>Wachstum Gewinn je Aktie</td>
                    <td className="num">{percent(d.earningsGrowthPerShare)}</td>
                  </tr>
                  <tr>
                    <td>Wachstum Gewinn des Unternehmens</td>
                    <td className="num">{percent(d.earningsGrowthTotal)}</td>
                  </tr>
                  <tr>
                    <td>Wachstum Umsatz, das niedrigere aus beiden</td>
                    <td className="num">{percent(d.revenueGrowth)}</td>
                  </tr>
                  <tr>
                    <td>Wachstumsgrenze aus Einbehaltung</td>
                    <td className="num">{percent(d.retentionCap)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Kurs von Hand</h2>
            </div>
            <form className="card-body row" action={saveManualPrice.bind(null, stock.id)}>
              {origin}
              <label htmlFor="price" className="meta">
                Schlusskurs in {stock.priceCurrency}
              </label>
              <input id="price" name="price" className="amount" type="text" inputMode="decimal" autoComplete="off" />
              <button className="quiet" type="submit">
                Eintragen
              </button>
            </form>
          </section>
        </div>
      </div>

      <section className="card" style={{ marginTop: 12 }}>
        <div className="card-head">
          <h2>Zehn Geschäftsjahre</h2>
          <span className="meta">Beträge in {currency}</span>
        </div>
        {years.length === 0 ? (
          <p className="empty">Keine Abschlüsse gespeichert.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Kennzahl</th>
                  {years.map((y) => (
                    <th className="num" key={y.fiscalYear}>
                      {y.fiscalYear}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SERIES.map((series) => (
                  <tr key={series.label}>
                    <td>{series.label}</td>
                    {years.map((y) => {
                      const value = series.value(y);
                      return (
                        <td key={y.fiscalYear} className={`num${value !== null && value < 0 ? " negative" : ""}`}>
                          {series.asPercent ? percent(value) : amount(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {history.length > 1 && (
        <section className="card">
          <div className="card-head">
            <h2>Verlauf der Bewertung</h2>
            <span className="meta">die letzten {history.length} Tagesstände</span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th className="num">Kurs</th>
                  <th className="num">Risikowert</th>
                  <th className="num">Innere Rendite</th>
                  <th>Stand</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.date}>
                    <td>{isoDate(h.date)}</td>
                    <td className="num">{amount(h.price)}</td>
                    <td className="num">{percent(h.riskScore, 0)}</td>
                    <td className="num">{percent(h.innerReturn)}</td>
                    <td>{h.complete ? "vollständig" : "vorläufig"}</td>
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
