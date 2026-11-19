import Link from "next/link";
import { notFound } from "next/navigation";
import { loadPortfolio } from "../../../valuation/portfolioRun.ts";
import type { Share } from "../../../valuation/portfolioView.ts";
import { deletePortfolio, saveHoldings } from "../../actions.ts";
import { amount, fieldValue, isoDate, percent } from "../../format.ts";
import { database, today } from "../../server.ts";

export const dynamic = "force-dynamic";

const euro = (value: number | null) => (value === null ? "–" : `${amount(value, 0)} €`);

function Distribution({ title, shares }: { title: string; shares: Share[] }) {
  const largest = Math.max(0.0001, ...shares.flatMap((s) => [s.held, s.target]));
  return (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>{title.replace("Verteilung nach ", "")}</th>
            <th className="num">Ist</th>
            <th className="num">Ziel</th>
            <th aria-hidden="true"></th>
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

  const { profile, holdings, stocks, view } = loadPortfolio(db, portfolio, today());
  const names = new Map(stocks.map((s) => [s.id, s.name]));
  const history = db.portfolioSnapshots(portfolio.id, 30);
  const targetCount = view.rows.filter((r) => r.targetWeight > 0).length;

  return (
    <>
      <h1>{portfolio.name}</h1>
      <p className="meta">
        Profil {portfolio.profile} · Basislimit {percent(profile.baseLimit)} · Mindestposition {percent(profile.minPosition, 0)} ·
        Mindestrendite {percent(profile.minReturn)} · Tauschschwelle {percent(profile.swapThreshold, 0)}
      </p>

      <dl className="figures">
        <div className="figure">
          <dt>Wert</dt>
          <dd>{euro(view.totalEur)}</dd>
          <span className="sub">davon bar {euro(portfolio.cashEur)}</span>
        </div>
        <div className="figure">
          <dt>Positionen</dt>
          <dd>{holdings.size}</dd>
          <span className="sub">Ziel {targetCount}</span>
        </div>
        <div className="figure">
          <dt>Baranteil</dt>
          <dd>{percent(view.cashWeight)}</dd>
          <span className="sub">Ziel {percent(view.targetCashWeight)}</span>
        </div>
      </dl>

      {query.fehler && <div className="notice error">Nicht gespeichert: {query.fehler}</div>}
      {query.gespeichert && <div className="notice ok">Bestand gespeichert.</div>}
      {view.unpriced.length > 0 && (
        <div className="notice">Ohne Kurs und deshalb nicht im Wert enthalten: {view.unpriced.map((s) => names.get(s)).join(", ")}.</div>
      )}
      {targetCount === 0 && (
        <div className="notice">
          Das Zielportfolio ist leer. Kandidat wird eine Aktie erst, wenn ihre Bewertung vollständig ist, der Risikowert
          unter 75 % liegt und die innere Rendite mindestens {percent(profile.minReturn)} beträgt.
        </div>
      )}

      <h2>Ist gegen Ziel</h2>
      {view.rows.length === 0 ? (
        <p className="meta">Noch keine Positionen und keine Kandidaten.</p>
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
                    <Link className="name" href={`/aktie/${encodeURIComponent(row.id)}`}>
                      {names.get(row.id)}
                    </Link>
                    <small>{row.id}</small>
                  </td>
                  <td className="num">{row.shares > 0 ? euro(row.valueEur) : "–"}</td>
                  <td className="num">{percent(row.heldWeight)}</td>
                  <td className="num">{percent(row.targetWeight)}</td>
                  <td>
                    {row.action === "kaufen" && (
                      <span className="buy">
                        kaufen +{percent(row.change)}
                        {view.totalEur > 0 ? ` (${euro(row.changeEur)})` : ""}
                      </span>
                    )}
                    {row.action === "verkaufen" && (
                      <span className="sell">
                        verkaufen {percent(row.change)} ({euro(-row.changeEur)})
                      </span>
                    )}
                    {row.action === "halten" && "halten"}
                  </td>
                  <td>{row.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="columns">
        <Distribution title="Verteilung nach Branche" shares={view.sectors} />
        <Distribution title="Verteilung nach Region" shares={view.regions} />
      </div>
      <p className="meta legend">
        <span>Ist</span>
        <span className="target">Ziel</span>
      </p>

      <h2>Bestand pflegen</h2>
      <p className="meta">Stückzahlen je Aktie der Watchlist und Barbestand in Euro. Ein leeres Feld bedeutet 0.</p>
      <form action={saveHoldings.bind(null, portfolio.id)}>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th className="num">Stück bzw. Euro</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <label htmlFor="cash">Barbestand in Euro</label>
                </td>
                <td className="num">
                  <input id="cash" name="cash" type="text" inputMode="decimal" autoComplete="off" defaultValue={fieldValue(portfolio.cashEur || undefined, false)} />
                </td>
              </tr>
              {stocks.map((stock) => (
                <tr key={stock.id}>
                  <td>
                    <label htmlFor={`shares:${stock.id}`}>{stock.name}</label>
                  </td>
                  <td className="num">
                    <input
                      id={`shares:${stock.id}`}
                      name={`shares:${stock.id}`}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      defaultValue={fieldValue(holdings.get(stock.id), false)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button type="submit">Bestand speichern</button>
        </div>
      </form>

      {history.length > 0 && (
        <>
          <h2>Verlauf</h2>
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
        </>
      )}

      <h2>Portfolio löschen</h2>
      <form action={deletePortfolio.bind(null, portfolio.id)}>
        <label className="row meta">
          <input type="checkbox" name="confirm" required /> Ja, mit allen Positionen löschen
        </label>
        <button className="quiet danger" type="submit">
          Portfolio „{portfolio.name}" endgültig löschen
        </button>
      </form>
    </>
  );
}
