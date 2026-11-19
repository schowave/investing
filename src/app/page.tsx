import Link from "next/link";
import { EXCLUSION_SCORE, PROFILE_FOCUSED, positionLimit } from "../calc/index.ts";
import type { SyncReport } from "../sync/dailySync.ts";
import { BOND_KEY } from "../valuation/portfolioRun.ts";
import { needsReview } from "../valuation/review.ts";
import { startSync } from "./actions.ts";
import { amount, isoDate, percent } from "./format.ts";
import { stockPath } from "./origin.ts";
import { RangeLegend, ReturnRange, scaleFor } from "./parts.tsx";
import { PendingButton } from "./pendingButton.tsx";
import { database, watchlistRanking } from "./server.ts";

export const dynamic = "force-dynamic";

function syncProblem(report: SyncReport): string {
  const parts: string[] = [];
  if (report.fxError) parts.push("Wechselkurse fehlen");
  if (report.priceErrors?.length) parts.push(`${report.priceErrors.length} Kurse nicht geladen`);
  if (report.pricesDeferred?.length) parts.push(`${report.pricesDeferred.length} Kurse folgen beim nächsten Lauf`);
  return parts.join(", ");
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function Ranking() {
  const db = database();
  const bondYield = db.referenceRate(BOND_KEY);
  const { hurdle, rows, candidates, incomplete, promising, toReview, next, firstBelow } = watchlistRanking();
  const priceDates = rows
    .map((r) => r.priceDate)
    .filter((d): d is string => d !== null)
    .sort();
  const lastSync = db.latestSyncRun();
  const problem = lastSync && !lastSync.ok ? syncProblem(lastSync.report as SyncReport) : "";
  const scaleMax = scaleFor(
    rows.filter((r) => !r.doubtful).map((r) => r.valuation.returns?.optimistic ?? null),
    hurdle,
  );

  let finding: string;
  if (rows.length === 0) finding = "Die Watchlist ist leer. Im Datenvorrat findest du Titel zum Aufnehmen.";
  else if (candidates.length > 0) {
    finding = `${plural(candidates.length, "Titel ist", "Titel sind")} vollständig bewertet und ${candidates.length === 1 ? "schlägt" : "schlagen"} die Anleiherendite; ins Portfolio kommen die mit der höchsten inneren Rendite.`;
  } else if (incomplete.length > 0) {
    finding = `Noch kein Titel ist Kandidat fürs Portfolio: ${plural(incomplete.length, "Bewertung wartet", "Bewertungen warten")} auf dein Urteil${promising.length > 0 ? `, ${promising.length === 1 ? "eine davon liegt" : `${promising.length} davon liegen`} vorläufig über der Anleiherendite` : ""}.`;
  } else finding = "Alle Titel sind bewertet, keiner schlägt die Anleiherendite.";
  if (toReview.length > 0) {
    finding += ` ${plural(toReview.length, "Bewertung ist", "Bewertungen sind")} zu prüfen: überfällig oder die Zahlen haben sich seither verschoben.`;
  }

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Rangliste</h1>
          <p className="finding">{finding}</p>
        </div>
        <div className="title-actions">
          {next && (
            <Link className="button" href={stockPath(next.stock.id, "/", {}, "#urteil")}>
              {next.stock.name} bewerten
            </Link>
          )}
          <Link className="button quiet" href="/vorrat">
            Titel aufnehmen
          </Link>
          <form action={startSync.bind(null, "/abgleich")}>
            <PendingButton className="quiet" label="Jetzt abgleichen" pendingLabel="Wird eingestellt …" />
          </form>
        </div>
      </div>

      <dl className="card figures">
        <div className="figure">
          <dt>Anleiherendite</dt>
          <dd>{percent(hurdle)}</dd>
          <span className="sub">
            {bondYield === null
              ? "fester Wert, keine Anleiherendite geladen"
              : "zehnjährige Euro-Staatsanleihe; was darunter liegt, lohnt nicht"}
          </span>
        </div>
        <div className="figure">
          <dt>Kandidaten fürs Portfolio</dt>
          <dd className={candidates.length === 0 ? "muted-value" : ""}>
            {candidates.length} von {rows.length}
          </dd>
          <span className="sub">vollständig bewertet, Basisfall über der Anleiherendite</span>
        </div>
        <div className="figure">
          <dt>Offene Bewertungen</dt>
          <dd className={incomplete.length === 0 ? "muted-value" : ""}>{incomplete.length}</dd>
          <span className="sub">
            {incomplete.length === 0 ? "nichts zu tun" : "Urteil zu Branche, Management und weiteren Faktoren fehlt"}
            {toReview.length > 0 ? `; ${toReview.length} ältere zu prüfen` : ""}
          </span>
        </div>
        <div className="figure">
          <dt>Kurse vom</dt>
          <dd>{isoDate(priceDates.at(-1) ?? null)}</dd>
          <span className="sub">{problem || (lastSync ? "letzter Abgleich vollständig" : "noch kein Abgleich gelaufen")}</span>
        </div>
      </dl>

      <section className="card">
        <div className="card-head">
          <h2>Watchlist nach innerer Rendite</h2>
          <RangeLegend />
        </div>
        {rows.length === 0 ? (
          <p className="empty">Noch keine Titel auf der Watchlist.</p>
        ) : (
          <div className="scroll">
            <table className="ranking">
              <thead>
                <tr>
                  <th>Aktie</th>
                  <th className="num">Innere Rendite</th>
                  <th className="wide-only">Bandbreite, 0 bis {percent(scaleMax, 0)}</th>
                  <th className="num wide-only">Kurs</th>
                  <th className="num wide-only">Rückfluss</th>
                  <th className="num wide-only">Wachstum</th>
                  <th className="num">Risiko</th>
                  <th className="num wide-only">Limit</th>
                  <th>Stand</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const { stock, valuation: v, review } = row;
                  const suspect = row.doubtful;
                  const base = v.returns?.base ?? null;
                  const excluded = v.riskScore >= EXCLUSION_SCORE;
                  const link = stockPath(stock.id);
                  return [
                    index === firstBelow && firstBelow > 0 ? (
                      <tr className="threshold" key="threshold">
                        <td colSpan={9}>Darunter liegt der Basisfall unter der Anleiherendite von {percent(hurdle)}</td>
                      </tr>
                    ) : null,
                    <tr key={stock.id} className={base !== null && base >= hurdle && !suspect ? "" : "below"}>
                      <td>
                        <Link className="name" href={link}>
                          {stock.name}
                        </Link>
                        <small>
                          {stock.sector} · {stock.region}
                        </small>
                      </td>
                      <td className="num">
                        <span className="return">{percent(base)}</span>
                        {suspect ? (
                          <small>Zahlen passen nicht zum Kurs</small>
                        ) : (
                          Math.abs(v.inflationGap) >= 0.005 && <small>nach {percent(v.inflationGap)} Währungsabzug</small>
                        )}
                      </td>
                      <td className="wide-only">
                        {suspect ? (
                          <span className="meta">nicht belastbar</span>
                        ) : (
                          <ReturnRange
                            cautious={v.returns?.cautious ?? null}
                            base={base}
                            optimistic={v.returns?.optimistic ?? null}
                            hurdle={hurdle}
                            scaleMax={scaleMax}
                          />
                        )}
                      </td>
                      <td className="num wide-only">
                        {amount(v.price)}
                        <small>{stock.reportingCurrency}</small>
                      </td>
                      <td className="num wide-only">{amount(v.inputs.payoutLevel)}</td>
                      <td className="num wide-only">{percent(v.inputs.growth)}</td>
                      <td className="num">
                        {percent(v.riskScore, 0)}
                        <small>{v.riskClass}</small>
                      </td>
                      <td className="num wide-only">{excluded ? "–" : percent(positionLimit(PROFILE_FOCUSED.baseLimit, v.riskScore))}</td>
                      <td>
                        {excluded ? (
                          <span className="tag bad">ausgeschlossen</span>
                        ) : v.complete ? (
                          row.clears && !suspect ? (
                            <span className="tag ok">Kandidat</span>
                          ) : (
                            <span className="tag">unter der Anleiherendite</span>
                          )
                        ) : (
                          <Link className="tag warn" href={`${link}#urteil`}>
                            {v.missing.length > 0 ? `${v.missing.length} offen, bewerten` : "Kurs fehlt"}
                          </Link>
                        )}
                        {v.complete && needsReview(review) && (
                          <Link
                            className="tag warn"
                            href={`${link}#urteil`}
                            title={review.overdue ? "Bewertung älter als ein Jahr" : review.changes.join("; ")}
                          >
                            prüfen
                          </Link>
                        )}
                        {v.complete && review.assessedOn && <small>bewertet am {isoDate(review.assessedOn)}</small>}
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="meta" style={{ marginTop: 10 }}>
        Limit: höchstes Gewicht im fokussierten Profil. Solange Eingaben offen sind, ist die Rendite vorläufig und der Risikowert eine
        Untergrenze.
      </p>
    </>
  );
}
