import Link from "next/link";
import { setWatched } from "../actions.ts";
import { database } from "../server.ts";

export const dynamic = "force-dynamic";

const LIMIT = 60;

export default async function Stockpile(props: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await props.searchParams).q ?? "").trim();
  const hits = query.length >= 2 ? database().searchStocks(query, LIMIT) : [];
  const returnTo = `/vorrat?q=${encodeURIComponent(query)}`;

  return (
    <>
      <h1>Datenvorrat</h1>
      <p className="lede">
        Fundamentaldaten zu den Bestandteilen von S&amp;P 500, STOXX Europe 600 und FTSE 100. Titel auf der Watchlist
        erscheinen in der Rangliste. Für Vorratstitel fehlt zunächst der Kurs; er lässt sich auf der Seite der Aktie von
        Hand eintragen.
      </p>
      <form className="row" action="/vorrat">
        <input type="search" name="q" defaultValue={query} placeholder="Name oder Symbol, z. B. Nestle oder NESN" aria-label="Suche" autoFocus />
        <button type="submit">Suchen</button>
      </form>

      {query.length >= 2 && (
        <>
          <p className="meta">
            {hits.length === 0 ? "Keine Treffer." : hits.length === LIMIT ? `Die ersten ${LIMIT} Treffer. Suche eingrenzen, um weitere zu sehen.` : `${hits.length} Treffer.`}
          </p>
          {hits.length > 0 && (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Aktie</th>
                    <th>Branche</th>
                    <th>Region</th>
                    <th className="num">Geschäftsjahre</th>
                    <th>Watchlist</th>
                  </tr>
                </thead>
                <tbody>
                  {hits.map(({ stock, fiscalYears }) => (
                    <tr key={stock.id}>
                      <td>
                        <Link className="name" href={`/aktie/${encodeURIComponent(stock.id)}`}>
                          {stock.name}
                        </Link>
                        <small>{stock.id}</small>
                      </td>
                      <td>{stock.sector}</td>
                      <td>{stock.region}</td>
                      <td className="num">{fiscalYears < 10 ? <span className="tag warn">{fiscalYears}</span> : fiscalYears}</td>
                      <td>
                        <form action={setWatched.bind(null, stock.id, !stock.watched, returnTo)}>
                          <button className="quiet" type="submit">
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
        </>
      )}
    </>
  );
}
