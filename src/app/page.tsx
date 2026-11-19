import Link from "next/link";
import { EXCLUSION_SCORE, positionLimit, PROFILE_FOCUSED, PROFILE_GLOBAL } from "../calc/index.ts";
import { computeValuation } from "../valuation/run.ts";
import { amount, isoDate, percent } from "./format.ts";
import { database, today } from "./server.ts";

export const dynamic = "force-dynamic";

const MIN_RETURN = PROFILE_FOCUSED.minReturn;

export default function Ranking() {
  const db = database();
  const date = today();
  const rows = db
    .stocks()
    .map((stock) => computeValuation(db, stock, date))
    .sort((a, b) => (b.valuation.returns?.base ?? -1) - (a.valuation.returns?.base ?? -1));
  const firstBelow = rows.findIndex((r) => (r.valuation.returns?.base ?? -1) < MIN_RETURN);
  const lastSync = db.latestSyncRun();
  const priceDates = rows.map((r) => r.priceDate).filter((d): d is string => d !== null).sort();

  return (
    <>
      <h1>Rangliste</h1>
      <p className="lede">
        Watchlist nach innerer Rendite. Solange Eingaben offen sind, ist die Rendite vorläufig und der Risikowert eine
        Untergrenze. Kurse vom {isoDate(priceDates.at(-1) ?? null)}.
      </p>
      <p className="meta">
        {lastSync
          ? `Letzter Abgleich am ${isoDate(lastSync.finishedAt.slice(0, 10))}${lastSync.ok ? "." : ", nicht alle Kurse oder Wechselkurse wurden geladen."}`
          : "Noch kein täglicher Abgleich gelaufen."}
      </p>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Aktie</th>
              <th className="num">Innere Rendite</th>
              <th className="num">Kurs</th>
              <th className="num">Rückfluss</th>
              <th className="num">Wachstum</th>
              <th>Risiko</th>
              <th className="num">Limit fokussiert</th>
              <th className="num">Limit global</th>
              <th>Bewertung</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ stock, valuation: v }, index) => {
              const base = v.returns?.base ?? null;
              const excluded = v.riskScore >= EXCLUSION_SCORE;
              return [
                index === firstBelow && firstBelow > 0 ? (
                  <tr className="threshold" key="threshold">
                    <td colSpan={9}>Darunter: Mindestrendite von {percent(MIN_RETURN)} nicht erreicht</td>
                  </tr>
                ) : null,
                <tr key={stock.id} className={base !== null && base >= MIN_RETURN ? "" : "below"}>
                  <td>
                    <Link className="name" href={`/aktie/${encodeURIComponent(stock.id)}`}>
                      {stock.name}
                    </Link>
                    <small>
                      {stock.id} · {stock.sector} · {stock.region}
                    </small>
                  </td>
                  <td className="num">
                    <span className="yield">{percent(base)}</span>
                    {v.returns && (
                      <small>
                        {percent(v.returns.cautious)} bis {percent(v.returns.optimistic)}
                      </small>
                    )}
                  </td>
                  <td className="num">
                    {amount(v.price)}
                    <small>{stock.reportingCurrency}</small>
                  </td>
                  <td className="num">{amount(v.inputs.payoutLevel)}</td>
                  <td className="num">{percent(v.inputs.growth)}</td>
                  <td>
                    {percent(v.riskScore, 0)}
                    <small>{v.riskClass}</small>
                  </td>
                  <td className="num">{excluded ? "–" : percent(positionLimit(PROFILE_FOCUSED.baseLimit, v.riskScore))}</td>
                  <td className="num">{excluded ? "–" : percent(positionLimit(PROFILE_GLOBAL.baseLimit, v.riskScore))}</td>
                  <td>
                    {excluded ? (
                      <span className="tag bad">ausgeschlossen</span>
                    ) : v.complete ? (
                      <span className="tag">vollständig</span>
                    ) : (
                      <span className="tag warn">{v.missing.length > 0 ? `${v.missing.length} offen` : "Kurs fehlt"}</span>
                    )}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
