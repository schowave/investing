import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortfolio } from "../../../valuation/portfolioRun.ts";
import type { Share } from "../../../valuation/portfolioView.ts";
import { deletePortfolio, saveHoldings } from "../../actions.ts";
import { amount, isoDate, percent } from "../../format.ts";
import { stockPath } from "../../origin.ts";
import { database, today } from "../../server.ts";

export const dynamic = "force-dynamic";

const euro = (value: number | null) => (value === null ? "–" : `${amount(value, 0)} €`);
const fieldNumber = (value: number | undefined) => (value ? String(Math.round(value * 10000) / 10000) : "");

function Distribution({ title, column, shares }: { title: string; column: string; shares: Share[] }) {
  const largest = Math.max(0.0001, ...shares.flatMap((s) => [s.held, s.target]));
  return (
    <section className="card">
      <div className="card-head">
        <h2>{title}</h2>
        <p className="legend">
          <span>
            <i className="l-held" />
            Ist
          </span>
          <span>
            <i className="l-target" />
            Ziel
          </span>
        </p>
      </div>
      {shares.length === 0 ? (
        <p className="empty">Noch keine Positionen.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>{column}</th>
                <th className="num">Ist</th>
                <th className="num">Ziel</th>
                <th>
                  <span className="sr-only">Balken Ist und Ziel</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shares.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="num">{percent(s.held)}</td>
                  <td className="num">{percent(s.target)}</td>
                  <td aria-hidden="true">
                    <div className="bars">
                      <div className="bar" style={{ width: `${(s.held / largest) * 100}%` }} />
                      <div className="bar target" style={{ width: `${(s.target / largest) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function PortfolioPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fehler?: string; gespeichert?: string }>;
}) {
  const id = Number((await props.params).id);
  const query = await props.searchParams;
  const db = database();
  const portfolio = Number.isInteger(id) ? db.portfolio(id) : null;
  if (!portfolio) notFound();

  const { profile, holdings, stocks, view, doubtful } = loadPortfolio(db, portfolio, today());
  const here = `/portfolio/${portfolio.id}`;
  const names = new Map(stocks.map((s) => [s.id, s.name]));
  const history = db.portfolioSnapshots(portfolio.id, 12);
  const targetCount = view.rows.filter((r) => r.targetWeight > 0).length;
  const buys = view.rows.filter((r) => r.action === "kaufen");
  const sells = view.rows.filter((r) => r.action === "verkaufen");
  const empty = holdings.size === 0 && portfolio.cashEur === 0 && portfolio.otherEur === 0;
  const unrated = view.rows.filter((r) => r.action === "bewerten").length;

  let finding: string;
  if (empty) finding = "Noch kein Bestand eingetragen. Trag unten Stückzahlen und Barbestand ein, dann erscheinen hier die Vorschläge.";
  else if (sells.length + buys.length === 0)
    finding =
      targetCount === 0
        ? "Kein Titel ist derzeit Kandidat; das Zielportfolio besteht nur aus Barbestand."
        : "Bestand und Ziel stimmen überein, es gibt nichts zu tun.";
  else {
    const parts = [];
    if (sells.length > 0)
      parts.push(
        `${sells.length === 1 ? "ein Verkauf" : `${sells.length} Verkäufe`} über ${euro(-sells.reduce((sum, r) => sum + r.changeEur, 0))}`,
      );
    if (buys.length > 0)
      parts.push(`${buys.length === 1 ? "ein Kauf" : `${buys.length} Käufe`} über ${euro(buys.reduce((sum, r) => sum + r.changeEur, 0))}`);
    finding = `Vorgeschlagen: ${parts.join(" und ")}.`;
  }
  if (!empty && unrated > 0)
    finding += ` ${unrated === 1 ? "Eine gehaltene Position ist" : `${unrated} gehaltene Positionen sind`} noch nicht vollständig bewertet.`;

  return (
    <>
      <Link className="crumb" href="/portfolio">
        ← Portfolios
      </Link>
      <div className="title-row">
        <div>
          <h1>{portfolio.name}</h1>
          <p className="finding">{finding}</p>
          <p className="meta">
            Profil {portfolio.profile} · Basislimit {percent(profile.baseLimit)} · Mindestposition {percent(profile.minPosition, 0)} ·
            Untergrenze {percent(profile.minReturn)} (Anleiherendite) · Tauschschwelle {profile.swapThreshold * 100} Punkte
          </p>
        </div>
        <div className="title-actions">
          <a className="button quiet" href="#bestand">
            Bestand pflegen
          </a>
        </div>
      </div>

      {query.fehler && <div className="notice error">Nicht gespeichert: {query.fehler}</div>}
      {query.gespeichert && <div className="notice ok">Bestand gespeichert.</div>}
      {view.unpriced.length > 0 && (
        <div className="notice">Ohne Kurs und deshalb nicht im Wert enthalten: {view.unpriced.map((s) => names.get(s)).join(", ")}.</div>
      )}

      <dl className="card figures">
        <div className="figure">
          <dt>Wert</dt>
          <dd className={view.totalEur === 0 ? "muted-value" : ""}>{euro(view.totalEur)}</dd>
          <span className="sub">
            davon bar {euro(portfolio.cashEur)}
            {portfolio.otherEur > 0 ? `, sonstige Anlagen ${euro(portfolio.otherEur)}` : ""}
          </span>
        </div>
        <div className="figure">
          <dt>Positionen</dt>
          <dd className={holdings.size === 0 ? "muted-value" : ""}>{holdings.size}</dd>
          <span className="sub">im Zielportfolio {targetCount}</span>
        </div>
        <div className="figure">
          <dt>Innere Rendite im Schnitt</dt>
          <dd className={view.heldReturn === null ? "muted-value" : ""}>{percent(view.heldReturn)}</dd>
          <span className="sub">
            gehaltene Aktien nach Wert gewichtet; im Zielportfolio {percent(view.targetReturn)}
            {view.heldWithoutReturn.length > 0 ? `; ohne ${view.heldWithoutReturn.length} Titel ohne belastbare Rendite` : ""}
          </span>
        </div>
        <div className="figure">
          <dt>Baranteil</dt>
          <dd>{percent(view.cashWeight)}</dd>
          <span className="sub">im Zielportfolio {percent(view.targetCashWeight)}</span>
        </div>
      </dl>

      <section className="card">
        <div className="card-head">
          <h2>Ist gegen Ziel</h2>
          <span className="meta">
            Kandidat wird ein Titel mit vollständiger Bewertung, Risikowert unter 75 % und mehr als {percent(profile.minReturn)} innerer
            Rendite; aufgenommen werden die besten zuerst
          </span>
        </div>
        {view.rows.length === 0 ? (
          <p className="empty">
            Keine Positionen und keine Kandidaten. Bewerte Titel in der Rangliste vollständig, damit ein Zielportfolio entsteht.
          </p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Aktie</th>
                  <th className="num">Wert</th>
                  <th className="num">Ist</th>
                  <th className="num">Ziel</th>
                  <th>Vorschlag</th>
                  <th>Grund</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="name" href={stockPath(row.id, here)}>
                        {names.get(row.id)}
                      </Link>
                      <small>{row.id}</small>
                    </td>
                    <td className="num">{row.shares > 0 ? euro(row.valueEur) : <span className="meta">–</span>}</td>
                    <td className="num">{percent(row.heldWeight)}</td>
                    <td className="num">{percent(row.targetWeight)}</td>
                    <td>
                      {row.action === "kaufen" && (
                        <span className="buy">
                          kaufen +{percent(row.change)}
                          {view.totalEur > 0 ? `, ${euro(row.changeEur)}` : ""}
                        </span>
                      )}
                      {row.action === "verkaufen" && (
                        <span className="sell">
                          verkaufen {percent(row.change)}, {euro(-row.changeEur)}
                        </span>
                      )}
                      {row.action === "halten" && <span className="meta">halten</span>}
                      {row.action === "bewerten" && (
                        <Link className="tag warn" href={stockPath(row.id, here, {}, "#urteil")}>
                          erst bewerten
                        </Link>
                      )}
                    </td>
                    <td>
                      {row.reason ?? ""}
                      {doubtful.has(row.id) && <small className="unsure">Zahlen prüfen: {doubtful.get(row.id)}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="halves">
        <Distribution title="Nach Branche" column="Branche" shares={view.sectors} />
        <Distribution title="Nach Region" column="Region" shares={view.regions} />
      </div>

      <div className="columns">
        <form className="card" id="bestand" action={saveHoldings.bind(null, portfolio.id)}>
          <div className="card-head">
            <h2>Bestand pflegen</h2>
            <span className="meta">ein leeres Feld bedeutet 0</span>
          </div>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th className="num">Menge</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <label htmlFor="cash" className="factor">
                      Barbestand
                    </label>
                  </td>
                  <td className="num">
                    <span className="field">
                      <input
                        id="cash"
                        name="cash"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={fieldNumber(portfolio.cashEur)}
                      />
                      <span className="unit">€</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>
                    <label htmlFor="other" className="factor">
                      Sonstige Anlagen
                    </label>
                    <span className="hint">Fonds, Anleihen und ETF, die die Strategie nicht bewertet; zählen zum Gesamtwert</span>
                  </td>
                  <td className="num">
                    <span className="field">
                      <input
                        id="other"
                        name="other"
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        autoComplete="off"
                        defaultValue={fieldNumber(portfolio.otherEur)}
                      />
                      <span className="unit">€</span>
                    </span>
                  </td>
                </tr>
                {stocks.map((stock) => (
                  <tr key={stock.id}>
                    <td>
                      <label htmlFor={`shares:${stock.id}`} className="factor">
                        {stock.name}
                      </label>
                    </td>
                    <td className="num">
                      <span className="field">
                        <input
                          id={`shares:${stock.id}`}
                          name={`shares:${stock.id}`}
                          type="number"
                          min={0}
                          step="any"
                          inputMode="decimal"
                          autoComplete="off"
                          defaultValue={fieldNumber(holdings.get(stock.id))}
                        />
                        <span className="unit">St.</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="savebar">
            <button type="submit">Bestand speichern</button>
            <span className="meta">Titel, die hier fehlen, nimmst du im Datenvorrat auf die Watchlist.</span>
          </div>
        </form>

        <div className="stack">
          {history.length > 1 && (
            <section className="card">
              <div className="card-head">
                <h2>Verlauf</h2>
              </div>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th className="num">Wert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.date}>
                        <td>{isoDate(h.date)}</td>
                        <td className="num">{euro(h.totalEur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="card">
            <div className="card-head">
              <h2>Portfolio löschen</h2>
            </div>
            <form className="card-body" action={deletePortfolio.bind(null, portfolio.id)}>
              <label className="row meta" style={{ marginBottom: 12 }}>
                <input type="checkbox" name="confirm" required /> Ja, „{portfolio.name}" mit allen Positionen löschen
              </label>
              <button className="danger" type="submit">
                Endgültig löschen
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
