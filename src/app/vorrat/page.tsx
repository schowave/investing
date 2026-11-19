import Link from "next/link";
import { setWatched } from "../actions.ts";
import { amount, isoDate, percent } from "../format.ts";
import { database } from "../server.ts";

export const dynamic = "force-dynamic";

const LIMIT = 100;
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

export default async function Stockpile(props: { searchParams: Promise<{ q?: string; region?: string; risiko?: string; rendite?: string; alle?: string }> }) {
  const params = await props.searchParams;
  const query = (params.q ?? "").trim();
  const region = params.region ?? "";
  const maxRisk = RISK_OPTIONS.some((o) => o.value === params.risiko) && params.risiko ? Number(params.risiko) : undefined;
  const maxReturn = RETURN_OPTIONS.some((o) => o.value === params.rendite) && params.rendite ? Number(params.rendite) : undefined;
  const db = database();

  const includeImplausible = params.alle === "1";
  const ranked = db.screening({ query: query || undefined, region: region || undefined, maxRisk, maxReturn, includeImplausible }, LIMIT);
  // Titel ohne berechenbare Rendite (kein Kurs, zu wenige Jahre) erscheinen nur bei einer Suche.
  const rankedIds = new Set(ranked.map((r) => r.stock.id));
  const others = query.length >= 2 ? db.searchStocks(query, 40).filter((h) => !rankedIds.has(h.stock.id)) : [];
  const returnTo = `/vorrat?${new URLSearchParams({ q: query, region, risiko: params.risiko ?? "", rendite: params.rendite ?? "", alle: params.alle ?? "" })}`;

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Datenvorrat</h1>
          <p className="finding">
            Alle gespeicherten Titel nach vorläufiger innerer Rendite, gerechnet allein aus den Vorschlägen. Dein Urteil
            fehlt noch, der Risikowert ist deshalb eine Untergrenze.
          </p>
        </div>
      </div>
      <form className="card card-body row" action="/vorrat" style={{ paddingTop: 16 }}>
        <input type="search" name="q" defaultValue={query} placeholder="Name oder Symbol" aria-label="Suche" />
        <select name="region" defaultValue={region} aria-label="Region">
          <option value="">alle Regionen</option>
          {db.regions().map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select name="risiko" defaultValue={params.risiko ?? ""} aria-label="Risiko">
          {RISK_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select name="rendite" defaultValue={params.rendite ?? ""} aria-label="Rendite">
          {RETURN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <label className="meta">
          <input type="checkbox" name="alle" value="1" defaultChecked={includeImplausible} /> auch Titel mit unplausiblen Zahlen
        </label>
        <button type="submit">Anzeigen</button>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>{query ? `Treffer für „${query}"` : "Höchste vorläufige Rendite"}</h2>
          <span className="meta">
        {ranked.length === 0
          ? "Keine Titel mit berechenbarer Rendite. Der Datenvorrat wird beim täglichen Abgleich bewertet."
          : ranked.length === LIMIT
            ? `Die ${LIMIT} Titel mit der höchsten vorläufigen Rendite.`
            : `${ranked.length} Titel.`}
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
                <th>Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ stock, row }) => (
                <tr key={stock.id}>
                  <td>
                    <Link className="name" href={`/aktie/${encodeURIComponent(stock.id)}`}>
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
      <p className="meta" style={{ marginTop: 10 }}>
        Ausgeblendet sind Titel, deren Rückfluss über 20 % des Kurses oder deren Kurs unter dem Dreifachen des
        Gewinnniveaus liegt, und Titel mit unbereinigtem Aktiensplit. Das sind meist Datenfehler.
      </p>

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
                      <Link className="name" href={`/aktie/${encodeURIComponent(stock.id)}`}>
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
