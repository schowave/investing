import Link from "next/link";
import type { CoverageRow } from "../../../data/db.ts";
import { database } from "../../server.ts";

export const dynamic = "force-dynamic";

/** Namen der Börsen nach der Endung des EODHD-Symbols; unbekannte erscheinen mit ihrem Kürzel. */
const EXCHANGES: Record<string, string> = {
  US: "USA (NYSE, Nasdaq)",
  TO: "Toronto",
  V: "Toronto Venture",
  LSE: "London",
  IL: "London International (Hinterlegungsscheine)",
  XETRA: "Xetra",
  F: "Frankfurt",
  STU: "Stuttgart",
  MU: "München",
  BE: "Berlin",
  DU: "Düsseldorf",
  HM: "Hamburg",
  PA: "Paris",
  AS: "Amsterdam",
  BR: "Brüssel",
  LS: "Lissabon",
  IR: "Dublin",
  MC: "Madrid",
  SW: "Schweiz (SIX)",
  VI: "Wien",
  ST: "Stockholm",
  HE: "Helsinki",
  CO: "Kopenhagen",
  OL: "Oslo",
  IC: "Island",
  WAR: "Warschau",
  PR: "Prag",
  BUD: "Budapest",
  AU: "Australien (ASX)",
  KO: "Korea (KOSPI)",
  KQ: "Korea (KOSDAQ)",
  SA: "São Paulo",
  MX: "Mexiko",
  TA: "Tel Aviv",
  JSE: "Johannesburg",
};

const number = (value: number) => value.toLocaleString("de-DE");
const countryNames = new Intl.DisplayNames(["de"], { type: "region" });
/** Kürzere Namen, wo die Standardbezeichnung die Tabelle sprengt. */
const SHORT_COUNTRY_NAMES: Record<string, string> = { HK: "Hongkong", MO: "Macau" };
function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code || "unbekannt";
  if (SHORT_COUNTRY_NAMES[code]) return SHORT_COUNTRY_NAMES[code];
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

interface Group {
  key: string;
  stocks: number;
  rated: number;
  countries: Map<string, number>;
}

/** Fasst die Zeilen nach Börse oder Region zusammen, größte Gruppe zuerst. */
function groupBy(rows: readonly CoverageRow[], key: (row: CoverageRow) => string): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const k = key(row);
    const group = groups.get(k) ?? { key: k, stocks: 0, rated: 0, countries: new Map() };
    group.stocks += row.stocks;
    group.rated += row.rated;
    group.countries.set(row.country, (group.countries.get(row.country) ?? 0) + row.stocks);
    groups.set(k, group);
  }
  return [...groups.values()].sort((a, b) => b.stocks - a.stocks || a.key.localeCompare(b.key));
}

/** Die häufigsten Sitzländer einer Gruppe, der Rest als Anzahl. */
function topCountries(countries: Map<string, number>, limit = 4): string {
  const sorted = [...countries.entries()].sort((a, b) => b[1] - a[1]);
  const shown = sorted.slice(0, limit).map(([code, n]) => `${countryName(code)} ${number(n)}`);
  const rest = sorted.length - limit;
  return rest > 0 ? `${shown.join(", ")} und ${rest} weitere` : shown.join(", ");
}

const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)} %` : "–");

export default function Markets() {
  const rows = database().coverage();
  const regions = groupBy(rows, (r) => r.region);
  const exchanges = groupBy(rows, (r) => r.exchange);
  const total = rows.reduce((sum, r) => sum + r.stocks, 0);
  const rated = rows.reduce((sum, r) => sum + r.rated, 0);

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Abgedeckte Märkte</h1>
          <p className="finding">
            {number(total)} Stammaktien im Datenvorrat, {number(rated)} davon mit vorläufiger Rendite. Die Region richtet sich nach dem
            Firmensitz, nicht nach der Börse: Ausländische Unternehmen mit Notiz in den USA oder London zählen zu ihrem Heimatland.
          </p>
        </div>
        <Link href="/vorrat">← Zum Datenvorrat</Link>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Nach Region des Firmensitzes</h2>
          <span className="meta">„Mit Rendite“ ohne Titel mit unplausiblen Zahlen</span>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Region</th>
                <th className="num">Titel</th>
                <th className="num">Mit Rendite</th>
                <th className="num">Anteil</th>
                <th>Häufigste Länder</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((g) => (
                <tr key={g.key}>
                  <td>
                    <Link className="name" href={`/vorrat?${new URLSearchParams({ region: g.key })}`}>
                      {g.key}
                    </Link>
                  </td>
                  <td className="num">{number(g.stocks)}</td>
                  <td className="num">{number(g.rated)}</td>
                  <td className="num">{share(g.rated, g.stocks)}</td>
                  <td>{topCountries(g.countries)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Nach Börse</h2>
          <span className="meta">Welche Börsen und Indizes geladen sind; das Kürzel ist die Endung des Symbols</span>
        </div>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Börse</th>
                <th className="num">Titel</th>
                <th className="num">Mit Rendite</th>
                <th className="num">Anteil</th>
                <th>Sitzländer</th>
              </tr>
            </thead>
            <tbody>
              {exchanges.map((g) => (
                <tr key={g.key}>
                  <td>
                    {EXCHANGES[g.key] ?? g.key}
                    <small>{g.key}</small>
                  </td>
                  <td className="num">{number(g.stocks)}</td>
                  <td className="num">{number(g.rated)}</td>
                  <td className="num">{share(g.rated, g.stocks)}</td>
                  <td>{topCountries(g.countries)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-body">
        <h2>Was fehlt</h2>
        <p>
          Tokio, Hongkong, Mailand, Tel Aviv und die indischen Börsen führt der Anbieter nicht. Mailänder Titel kommen über ihre deutsche
          Notiz; japanische, israelische und indische nur, soweit sie in den USA oder London notieren. Ägypten liefert keine Abschlüsse, die
          Philippinen keinen freien Cashflow. Weitere Indizes und Börsen lassen sich auf der Seite <Link href="/abgleich">Abgleich</Link>{" "}
          laden, solange der Tarif Fundamentaldaten enthält (rund 10 Abrufe je Titel).
        </p>
      </section>
    </>
  );
}
