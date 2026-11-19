import Link from "next/link";
import { createPortfolio } from "../actions.ts";
import { amount } from "../format.ts";
import { loadPortfolio } from "../../valuation/portfolioRun.ts";
import { database, today } from "../server.ts";

export const dynamic = "force-dynamic";

export default async function Portfolios(props: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await props.searchParams;
  const db = database();
  const portfolios = db.portfolios().map((p) => ({ portfolio: p, ...loadPortfolio(db, p, today()) }));

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Portfolios</h1>
          <p className="finding">
            {portfolios.length === 0
              ? "Noch kein Portfolio angelegt. Ein Portfolio stellt deinen Bestand dem Zielportfolio der Strategie gegenüber."
              : "Jedes Portfolio stellt deinen Bestand dem Zielportfolio seines Profils gegenüber."}
          </p>
        </div>
      </div>
      {fehler && <div className="notice error">{fehler}</div>}

      {portfolios.length > 0 && (
        <section className="card">
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Portfolio</th>
                  <th>Profil</th>
                  <th className="num">Wert</th>
                  <th className="num">Positionen</th>
                  <th className="num">Vorschläge</th>
                </tr>
              </thead>
              <tbody>
                {portfolios.map(({ portfolio, holdings, view }) => {
                  const actions = view.rows.filter((r) => r.action === "kaufen" || r.action === "verkaufen").length;
                  return (
                    <tr key={portfolio.id}>
                      <td>
                        <Link className="name" href={`/portfolio/${portfolio.id}`}>
                          {portfolio.name}
                        </Link>
                      </td>
                      <td>{portfolio.profile}</td>
                      <td className="num">{amount(view.totalEur, 0)} €</td>
                      <td className="num">{holdings.size}</td>
                      <td className="num">{actions === 0 ? <span className="meta">keine</span> : actions}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Neues Portfolio</h2>
          <span className="meta">fokussiert: wenige große Positionen · global: viele kleine mit Grenzen je Branche und Region</span>
        </div>
        <form className="card-body row" action={createPortfolio}>
          <input className="wide" type="text" name="name" placeholder="Name, z. B. Depot" aria-label="Name" autoComplete="off" required />
          <select name="profile" aria-label="Profil" defaultValue="fokussiert">
            <option value="fokussiert">fokussiert</option>
            <option value="global">global</option>
          </select>
          <button type="submit">Anlegen</button>
        </form>
      </section>
    </>
  );
}
