import Link from "next/link";
import { isoDate, percent } from "../format.ts";
import { stockPath } from "../origin.ts";
import { database, today, watchlistRanking } from "../server.ts";
import {
  dividendGrowth,
  dividendsByYear,
  formatUnit,
  fundamentalSeries,
  PERIODS,
  periodOf,
  periodStats,
  preferLog,
  priceSeries,
  recentYears,
  sinceYears,
  trailingDividends,
  trendText,
  yearMultiples,
  yearsBetween,
  yearsWithoutCut,
} from "./analysis.ts";
import { BarChart, LineChart } from "./charts.tsx";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "kurs", label: "Kurs" },
  { key: "vergleich", label: "Kurs und Dividenden" },
] as const;
type View = (typeof VIEWS)[number]["key"];

/** Jahre in den kleinen Diagrammen der Abschlüsse. */
const FUNDAMENTAL_YEARS = 15;

function Figure(props: { label: string; value: string; sub?: string; lead?: boolean; tone?: "neg" | "muted" }) {
  return (
    <div className="figure">
      <dt>{props.label}</dt>
      <dd className={props.lead ? "lead" : props.tone === "neg" ? "negative" : props.tone === "muted" ? "muted-value" : undefined}>
        {props.value}
      </dd>
      {props.sub && <span className="sub">{props.sub}</span>}
    </div>
  );
}

export default async function Analysis(props: { searchParams: Promise<{ id?: string; q?: string; zeitraum?: string; ansicht?: string }> }) {
  const params = await props.searchParams;
  const db = database();
  const query = (params.q ?? "").trim();
  const stock = params.id ? db.stock(params.id) : null;
  const hits = query.length >= 2 ? db.searchStocks(query, 30) : [];
  const period = periodOf(params.zeitraum);
  const view: View = params.ansicht === "vergleich" ? "vergleich" : "kurs";
  const here = (extra: Record<string, string>) =>
    `/analyse?${new URLSearchParams({ ...(stock ? { id: stock.id } : {}), zeitraum: period.key, ansicht: view, ...extra })}`;

  const search = (
    <form className="card card-body row" action="/analyse" style={{ paddingTop: 16 }}>
      <input
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Name oder Symbol, z. B. Unilever oder ULVR.LSE"
        aria-label="Aktie suchen"
      />
      <button type="submit">Suchen</button>
      {stock && <span className="meta">angezeigt: {stock.name}</span>}
    </form>
  );

  const hitList =
    query.length >= 2 ? (
      <section className="card">
        <div className="card-head">
          <h2>Treffer für „{query}“</h2>
          <span className="meta">{hits.length === 30 ? "die ersten 30" : `${hits.length} Titel`}</span>
        </div>
        {hits.length === 0 ? (
          <p className="card-body meta">Nichts gefunden. Name oder Symbol mit Börse versuchen, etwa KO.US.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Land</th>
                  <th className="num">Geschäftsjahre</th>
                  <th>Liste</th>
                </tr>
              </thead>
              <tbody>
                {hits.map(({ stock: s, fiscalYears }) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="name" href={here({ id: s.id })}>
                        {s.name}
                      </Link>
                      <small>{s.id}</small>
                    </td>
                    <td>{s.country}</td>
                    <td className="num">{fiscalYears}</td>
                    <td>{s.watched ? <span className="tag ok">Watchlist</span> : <span className="meta">Datenvorrat</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    ) : null;

  if (!stock) {
    const watchlist = watchlistRanking().rows.slice(0, 40);
    return (
      <>
        <div className="title-row">
          <div>
            <h1>Analyse</h1>
            <p className="finding">
              Alles, was zu einer Aktie gespeichert ist, als Diagramm: Kurs mit und ohne Dividenden, Dividende je Jahr, Bewertung über die
              Zeit und die Zahlen der Abschlüsse.
            </p>
          </div>
        </div>
        {params.id && <div className="notice error">Kein Titel mit dem Symbol {params.id}.</div>}
        {search}
        {hitList}
        {!hitList && watchlist.length > 0 && (
          <section className="card">
            <div className="card-head">
              <h2>Aus der Watchlist</h2>
              <span className="meta">nach innerer Rendite</span>
            </div>
            <div className="card-body pick-list">
              {watchlist.map((r) => (
                <Link key={r.stock.id} href={here({ id: r.stock.id })} className="pick">
                  <span>{r.stock.name}</span>
                  <small>{r.stock.id}</small>
                </Link>
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  const day = today();
  const points = priceSeries(db.monthlyPrices(stock.id), db.splits(stock.id), stock.priceDivisor);
  const latest = db.latestPrice(stock.id);
  // Der jüngste Tageskurs ersetzt den Monatsschluss des laufenden Monats, damit die Kennzahlen zum Kurs von heute passen.
  const last = points.at(-1);
  if (latest && last && latest.date > last.date) {
    const scaled = { date: latest.date, price: latest.close, total: last.total * (latest.close / last.price) };
    if (latest.date.slice(0, 7) === last.date.slice(0, 7)) points[points.length - 1] = scaled;
    else points.push(scaled);
  }
  const shown = sinceYears(points, period.years);
  const stats = periodStats(shown);
  const spanYears = shown.length > 1 ? yearsBetween(shown[0]!.date, shown.at(-1)!.date) : 0;
  const log =
    view === "kurs" &&
    preferLog(
      shown.map((p) => p.price),
      spanYears,
    );

  const payments = db.dividends(stock.id) ?? [];
  const divYears = dividendsByYear(payments, stock.priceCurrency, day);
  const trailing = trailingDividends(payments, stock.priceCurrency, day);
  const price = points.at(-1)?.price ?? null;
  const fundamentals = db.fundamentals(stock.id);
  const sameCurrency = stock.reportingCurrency === stock.priceCurrency;
  const multiples = yearMultiples(fundamentals, points, divYears, sameCurrency).slice(-FUNDAMENTAL_YEARS);
  const lastEps = [...fundamentals].reverse().find((f) => f.epsDiluted !== null)?.epsDiluted ?? null;
  const pe = sameCurrency && price !== null && lastEps !== null && lastEps > 0 ? price / lastEps : null;
  const valuation = db.latestValuation(stock.id);
  const series = fundamentalSeries(fundamentals);
  const growth5 = dividendGrowth(divYears, 5);
  const growth10 = dividendGrowth(divYears, 10);
  const streak = yearsWithoutCut(divYears);
  const shownDiv = divYears.slice(-25);

  const indexed = (values: number[]) => values.map((v) => (v / values[0]!) * 100);
  const lineSeries =
    view === "kurs"
      ? [{ label: "Kurs", color: "var(--data)", values: shown.map((p) => p.price) }]
      : [
          { label: "mit Dividenden", color: "var(--data)", values: indexed(shown.map((p) => p.total)) },
          { label: "nur Kurs", color: "var(--muted)", values: indexed(shown.map((p) => p.price)), dashed: true },
        ];

  return (
    <>
      <div className="crumbs">
        <Link className="crumb" href="/analyse">
          ← Andere Aktie
        </Link>
        <Link className="crumb" href={stockPath(stock.id)}>
          Bewertung dieser Aktie →
        </Link>
      </div>
      <div className="title-row">
        <div>
          <h1>{stock.name}</h1>
          <p className="meta">
            {stock.id}
            {stock.isin ? ` · ${stock.isin}` : ""} · {stock.gicSector ?? stock.sector} · {stock.country} · Kurs in {stock.priceCurrency}
            {sameCurrency ? "" : `, Abschlüsse in ${stock.reportingCurrency}`}
            {stock.watched ? "" : " · Datenvorrat"}
          </p>
        </div>
      </div>
      {search}
      {hitList}

      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <dl className="figures six">
          <Figure
            label="Kurs"
            value={price === null ? "–" : `${formatUnit(price, "amount")} ${stock.priceCurrency}`}
            sub={latest ? `am ${isoDate(latest.date)}` : points.length ? `Monatsschluss ${isoDate(points.at(-1)!.date)}` : "kein Kurs"}
          />
          <Figure
            label={`Rendite pro Jahr, ${period.years === null ? "gesamt" : `${period.years} J.`}`}
            value={percent(stats?.totalPerYear ?? null)}
            sub={stats ? `mit Dividenden; nur Kurs ${percent(stats.priceReturn)} gesamt` : undefined}
            tone={stats?.totalPerYear !== null && stats?.totalPerYear !== undefined && stats.totalPerYear < 0 ? "neg" : undefined}
          />
          <Figure
            label="Dividendenrendite"
            value={price && trailing > 0 ? percent(trailing / price) : "–"}
            sub={trailing > 0 ? `${formatUnit(trailing, "amount")} ${stock.priceCurrency} in 12 Monaten` : "keine Zahlung in 12 Monaten"}
          />
          <Figure
            label="Dividendenwachstum"
            value={growth5 === null ? "–" : `${percent(growth5)} p. a.`}
            sub={`über 5 Jahre${growth10 === null ? "" : `, 10 Jahre ${percent(growth10)}`}; ${streak} ${streak === 1 ? "Jahr" : "Jahre"} ohne Kürzung`}
          />
          <Figure
            label="KGV"
            value={pe === null ? "–" : formatUnit(pe, "times").replace("×", "")}
            sub={pe === null ? (sameCurrency ? "kein Gewinn" : "andere Berichtswährung") : "auf den letzten Jahresgewinn"}
          />
          <Figure
            label="Innere Rendite"
            value={percent(valuation?.innerReturn ?? null)}
            sub={
              valuation
                ? `Risiko ${percent(valuation.riskScore, 0)}${valuation.complete ? "" : ", unvollständig"} · ${isoDate(valuation.date)}`
                : "noch nicht berechnet"
            }
            lead={valuation?.innerReturn !== null && valuation?.innerReturn !== undefined}
          />
        </dl>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Kursverlauf</h2>
          <div className="segmented-group">
            <nav className="segmented" aria-label="Ansicht">
              {VIEWS.map((v) => (
                <Link key={v.key} href={here({ ansicht: v.key })} aria-current={v.key === view ? "page" : undefined}>
                  {v.label}
                </Link>
              ))}
            </nav>
            <nav className="segmented" aria-label="Zeitraum">
              {PERIODS.map((p) => (
                <Link key={p.key} href={here({ zeitraum: p.key })} aria-current={p.key === period.key ? "page" : undefined}>
                  {p.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        <div className="card-body">
          <LineChart
            key={`${stock.id}-${period.key}-${view}`}
            dates={shown.map((p) => p.date)}
            series={lineSeries}
            unit={view === "kurs" ? "amount" : "index"}
            log={log}
            baseline={view === "vergleich" ? 100 : undefined}
            label={`Kursverlauf ${stock.name}`}
          />
          {stats && (
            <dl className="stat-line">
              <div>
                <dt>Zeitraum</dt>
                <dd>
                  {isoDate(stats.from)} bis {isoDate(stats.to)}
                </dd>
              </div>
              <div>
                <dt>Kurs</dt>
                <dd className={stats.priceReturn !== null && stats.priceReturn < 0 ? "negative" : undefined}>
                  {percent(stats.priceReturn)}
                </dd>
              </div>
              <div>
                <dt>Mit Dividenden</dt>
                <dd className={stats.totalReturn !== null && stats.totalReturn < 0 ? "negative" : undefined}>
                  {percent(stats.totalReturn)}
                </dd>
              </div>
              <div>
                <dt>Größter Rückgang</dt>
                <dd className="negative">{percent(stats.drawdown)}</dd>
              </div>
            </dl>
          )}
          <p className="meta chart-note">
            Monatsschlusskurse, um Splits bereinigt.
            {log ? " Logarithmische Achse: gleiche Abstände sind gleiche prozentuale Änderungen." : ""}
            {view === "vergleich" ? " Beide Linien starten bei 100; „mit Dividenden“ legt jede Ausschüttung wieder an." : ""}
          </p>
        </div>
      </section>

      <div className="halves">
        <section className="card">
          <div className="card-head">
            <h2>Dividende je Jahr</h2>
            <span className="meta">in {stock.priceCurrency}, nach Zahltag</span>
          </div>
          <div className="card-body">
            {shownDiv.length > 0 ? (
              <BarChart
                labels={shownDiv.map((d) => d.year)}
                values={shownDiv.map((d) => d.sum)}
                partial={shownDiv.map((d) => d.partial)}
                unit="amount"
                height={220}
                label={`Dividende je Jahr ${stock.name}`}
              />
            ) : (
              <p className="meta">Keine Dividenden gespeichert.</p>
            )}
            <p className="meta chart-note">Das laufende Jahr ist heller, weil noch Zahlungen fehlen können.</p>
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Bewertung zum Jahresende</h2>
            <span className="meta">Kurs am Jahresende zu Gewinn und Dividende</span>
          </div>
          <div className="card-body stack">
            {multiples.some((m) => m.pe !== null) && (
              <div>
                <h3 className="chart-title">KGV</h3>
                <BarChart
                  labels={multiples.map((m) => m.year)}
                  values={multiples.map((m) => m.pe)}
                  unit="times"
                  height={150}
                  label="KGV je Jahr"
                />
              </div>
            )}
            {multiples.some((m) => m.dividendYield !== null) && (
              <div>
                <h3 className="chart-title">Dividendenrendite</h3>
                <BarChart
                  labels={multiples.map((m) => m.year)}
                  values={multiples.map((m) => m.dividendYield)}
                  unit="percent"
                  height={150}
                  label="Dividendenrendite je Jahr"
                />
              </div>
            )}
            {multiples.length === 0 && <p className="meta">Dafür fehlen Kurse oder Abschlüsse.</p>}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: "var(--gap)" }}>
        <div className="card-head">
          <h2>Zahlen der Abschlüsse</h2>
          <span className="meta">
            je Geschäftsjahr in {stock.reportingCurrency}, letzte {FUNDAMENTAL_YEARS} Jahre · {fundamentals.length} Jahre gespeichert
            {fundamentals[0] ? ` seit ${fundamentals[0].fiscalYear}` : ""}
          </span>
        </div>
        {series.length === 0 ? (
          <p className="card-body meta">Keine Abschlüsse gespeichert.</p>
        ) : (
          <div className="small-multiples">
            {series.map((s) => {
              const values = recentYears(s.values, FUNDAMENTAL_YEARS);
              const trend = trendText(values, s.unit);
              return (
                <div key={s.key} className="multiple">
                  <h3 className="chart-title">{s.label}</h3>
                  <BarChart
                    labels={values.map((v) => v.year)}
                    values={values.map((v) => v.value)}
                    unit={s.unit}
                    height={150}
                    label={s.label}
                  />
                  <p className="meta chart-note">
                    {s.hint}
                    {trend ? ` · ${trend}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
