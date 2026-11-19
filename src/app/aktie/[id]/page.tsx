import { notFound } from "next/navigation";
import { EXCLUSION_SCORE, innerReturn, positionLimit, PROFILE_FOCUSED, PROFILE_GLOBAL, RISK_FACTORS } from "../../../calc/index.ts";
import type { RiskFactorId } from "../../../calc/index.ts";
import type { FundamentalsYear } from "../../../data/db.ts";
import { computeValuation } from "../../../valuation/run.ts";
import { INPUT_KEYS } from "../../../valuation/valuation.ts";
import type { InputKey } from "../../../valuation/valuation.ts";
import { saveInputs, saveManualPrice, setWatched } from "../../actions.ts";
import { amount, fieldValue, isoDate, percent } from "../../format.ts";
import { database, today } from "../../server.ts";

export const dynamic = "force-dynamic";

const PRICE_STEPS = [-0.3, -0.2, -0.1, 0, 0.1, 0.2];

function describe(key: InputKey): { label: string; range: string; asPercent: boolean } {
  if (key === "payoutLevel") return { label: "Rückflussniveau je Aktie", range: "Betrag", asPercent: false };
  if (key === "growth") return { label: "Wachstum zu Beginn", range: "in %", asPercent: true };
  const factor = RISK_FACTORS[key.slice(5) as RiskFactorId];
  const bonus = factor.bonus > 0 ? `−${factor.bonus * 100} bis ` : "0 bis ";
  return { label: factor.label, range: `${bonus}${factor.maxDeduction * 100} %`, asPercent: true };
}

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
  { label: "Eigenkapitalquote", value: (y) => (y.equity === null || !y.totalAssets ? null : y.equity / y.totalAssets), asPercent: true },
  { label: "Aktien in Mio.", value: (y) => (y.shares === null ? null : y.shares / 1e6) },
];

export default async function StockPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; gespeichert?: string }>;
}) {
  const id = decodeURIComponent((await props.params).id);
  const query = await props.searchParams;
  const db = database();
  const stock = db.stock(id);
  if (!stock) notFound();

  const { proposals, valuation: v, priceDate } = computeValuation(db, stock, today());
  const years = db.fundamentals(stock.id).slice(-10);
  const history = db.valuationHistory(stock.id, 30);
  const d = proposals.details;
  const excluded = v.riskScore >= EXCLUSION_SCORE;
  const { payoutLevel, growth } = v.inputs;
  const currency = stock.reportingCurrency;

  return (
    <>
      <h1>{stock.name}</h1>
      <p className="meta">
        {stock.id} · {stock.sector} · {stock.region} · berichtet in {currency}
        {stock.isFinancial ? " · Finanzwert" : ""}
        {stock.watched ? "" : " · Datenvorrat, nicht auf der Watchlist"}
      </p>

      <div className="row">
        <form action={setWatched.bind(null, stock.id, !stock.watched, `/aktie/${encodeURIComponent(stock.id)}`)}>
          <button className="quiet" type="submit">
            {stock.watched ? "Von der Watchlist nehmen" : "Auf die Watchlist"}
          </button>
        </form>
        <form className="row" action={saveManualPrice.bind(null, stock.id)}>
          <label htmlFor="price" className="meta">
            Kurs von Hand in {stock.priceCurrency}
          </label>
          <input id="price" name="price" type="text" inputMode="decimal" autoComplete="off" />
          <button className="quiet" type="submit">
            Kurs eintragen
          </button>
        </form>
      </div>

      <dl className="figures">
        <div className="figure">
          <dt>Innere Rendite{v.complete ? "" : " (vorläufig)"}</dt>
          <dd className="accent">{percent(v.returns?.base)}</dd>
          <span className="sub">
            {v.returns ? `${percent(v.returns.cautious)} bis ${percent(v.returns.optimistic)}` : "nicht berechenbar"}
          </span>
          {v.inflationGap !== 0 && v.localReturn !== null && (
            <span className="sub">
              in {currency} {percent(v.localReturn)}, Inflationsabstand zum Euro {percent(v.inflationGap)}
            </span>
          )}
        </div>
        <div className="figure">
          <dt>Kurs</dt>
          <dd>{amount(v.price)}</dd>
          <span className="sub">
            {currency}, {isoDate(priceDate)}
          </span>
        </div>
        <div className="figure">
          <dt>Risikowert{v.missing.some((k) => k.startsWith("risk.")) ? " (Untergrenze)" : ""}</dt>
          <dd>{percent(v.riskScore, 0)}</dd>
          <span className="sub">
            {v.riskClass}, Ausfall {percent(v.defaultProbability)} pro Jahr
          </span>
        </div>
        <div className="figure">
          <dt>Positionslimit</dt>
          <dd>{excluded ? "–" : percent(positionLimit(PROFILE_FOCUSED.baseLimit, v.riskScore))}</dd>
          <span className="sub">
            {excluded ? "ab 75 % ausgeschlossen" : `fokussiert; global ${percent(positionLimit(PROFILE_GLOBAL.baseLimit, v.riskScore))}`}
          </span>
        </div>
      </dl>

      {query.fehler && <div className="notice error">Nicht gespeichert: {query.fehler}</div>}
      {query.gespeichert && <div className="notice ok">Eingaben gespeichert.</div>}
      {proposals.notes.length > 0 && (
        <div className="notice">
          <ul>
            {proposals.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <h2>Eingaben</h2>
      <p className="meta">
        Ein leeres Feld übernimmt den Vorschlag. Risikofaktoren ohne Vorschlag müssen gesetzt werden, sonst bleibt die
        Bewertung unvollständig. Abzüge sind positiv, ein Bonus ist negativ.
      </p>
      <form action={saveInputs.bind(null, stock.id)}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Eingabe</th>
                <th className="num">Erlaubt</th>
                <th className="num">Vorschlag</th>
                <th className="num">Von Hand</th>
                <th className="num">Es gilt</th>
              </tr>
            </thead>
            <tbody>
              {INPUT_KEYS.map((key) => {
                const { label, range, asPercent } = describe(key);
                const show = asPercent ? percent : amount;
                const isManual = v.manual.includes(key);
                const isOpen = v.inputs[key] === undefined;
                return (
                  <tr key={key} className={isOpen ? "open" : isManual ? "manual" : ""}>
                    <td>
                      <label htmlFor={key}>{label}</label>
                    </td>
                    <td className="num">{range}</td>
                    <td className="num">{proposals.values[key] === undefined ? "kein Vorschlag" : show(proposals.values[key])}</td>
                    <td className="num">
                      <input
                        id={key}
                        name={key}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={isManual ? fieldValue(v.inputs[key], asPercent) : ""}
                        placeholder={isOpen ? "offen" : ""}
                      />
                    </td>
                    <td className="num">{isOpen ? <span className="tag warn">offen</span> : show(v.inputs[key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button type="submit">Eingaben speichern</button>
          <span className="meta">
            {v.missing.length === 0 ? "Alle Eingaben gesetzt." : `${v.missing.length} Eingaben offen.`}
          </span>
        </div>
      </form>

      <h2>Herleitung der Vorschläge</h2>
      <div className="scroll">
        <table>
          <tbody>
            <tr><td>Gewinnniveau je Aktie</td><td className="num">{amount(d.earningsLevel)}</td></tr>
            <tr><td>Dividendenniveau je Aktie</td><td className="num">{amount(d.dividendLevel)}</td></tr>
            <tr><td>Netto-Rückkäufe je Aktie (fünf Jahre)</td><td className="num">{amount(d.netBuybacksPerShare)}</td></tr>
            <tr><td>Tragbarer Rückfluss je Aktie</td><td className="num">{amount(d.sustainablePayout)}</td></tr>
            <tr><td>Tilgung überhöhter Schulden je Aktie (schon abgezogen)</td><td className="num">{amount(d.debtRepaymentPerShare)}</td></tr>
            <tr><td>Wachstum Gewinn je Aktie</td><td className="num">{percent(d.earningsGrowthPerShare)}</td></tr>
            <tr><td>Wachstum Gewinn des Unternehmens</td><td className="num">{percent(d.earningsGrowthTotal)}</td></tr>
            <tr><td>Wachstum Gewinn, angesetzt (das niedrigere)</td><td className="num">{percent(d.historicalGrowth)}</td></tr>
            <tr><td>Wachstum Umsatz, angesetzt (das niedrigere aus je Aktie und gesamt)</td><td className="num">{percent(d.revenueGrowth)}</td></tr>
            <tr><td>Wachstumsgrenze aus Einbehaltung</td><td className="num">{percent(d.retentionCap)}</td></tr>
          </tbody>
        </table>
      </div>

      {v.price !== null && payoutLevel !== undefined && growth !== undefined && (
        <>
          <h2>Innere Rendite bei anderen Kursen</h2>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Kurs in {currency}</th>
                  {PRICE_STEPS.map((step) => (
                    <th className="num" key={step}>{amount(v.price! * (1 + step))}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Abstand zum heutigen Kurs</td>
                  {PRICE_STEPS.map((step) => (
                    <td className="num" key={step}>{step === 0 ? "heute" : `${step > 0 ? "+" : ""}${percent(step, 0)}`}</td>
                  ))}
                </tr>
                <tr>
                  <td>Innere Rendite</td>
                  {PRICE_STEPS.map((step) => (
                    <td className="num" key={step}>
                      <strong>
                        {percent(innerReturn(v.price! * (1 + step), { payoutLevel, growth, defaultProbability: v.defaultProbability }))}
                      </strong>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2>Verlauf der Bewertung</h2>
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
        </>
      )}

      <h2>Zehn Geschäftsjahre</h2>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>in {currency}</th>
              {years.map((y) => (
                <th className="num" key={y.fiscalYear}>{y.fiscalYear}</th>
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
    </>
  );
}
