import Link from "next/link";
import { createPortfolio } from "../actions.ts";
import { database } from "../server.ts";

export const dynamic = "force-dynamic";

export default async function Portfolios(props: { searchParams: Promise<{ fehler?: string }> }) {
  const { fehler } = await props.searchParams;
  const db = database();
  const portfolios = db.portfolios();

  return (
    <>
      <h1>Portfolios</h1>
      <p className="lede">
        Jedes Portfolio folgt einem Profil: „fokussiert" mit wenigen großen Positionen oder „global" mit vielen kleinen
        und Grenzen je Branche und Region.
      </p>
      {fehler && <div className="notice error">{fehler}</div>}

      {portfolios.length > 0 && (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Portfolio</th>
                <th>Profil</th>
                <th className="num">Positionen</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link className="name" href={`/portfolio/${p.id}`}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.profile}</td>
                  <td className="num">{db.holdings(p.id).size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Neues Portfolio</h2>
      <form className="row" action={createPortfolio}>
        <input className="wide" type="text" name="name" placeholder="Name" aria-label="Name" autoComplete="off" />
        <select name="profile" aria-label="Profil" defaultValue="fokussiert">
          <option value="fokussiert">fokussiert</option>
          <option value="global">global</option>
        </select>
        <button type="submit">Anlegen</button>
      </form>
    </>
  );
}
