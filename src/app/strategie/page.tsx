import {
  DEFAULT_DEBT_PARAMS,
  DEFAULT_GROWTH_PARAMS,
  DEFAULT_PROBABILITY_PARAMS,
  DEFAULT_RETURN_PARAMS,
  DEFAULT_SCENARIO_SPREAD,
  EXCLUSION_SCORE,
  FULL_YEARS,
  hurdleRate,
  MIN_YEARS,
  PROFILE_FOCUSED,
  PROFILE_GLOBAL,
  RISK_FACTOR_IDS,
  RISK_FACTORS,
} from "../../calc/index.ts";
import { BOND_KEY } from "../../valuation/portfolioRun.ts";
import { REVIEW_MONTHS } from "../../valuation/review.ts";
import { STRATEGY_CLAIM, STRATEGY_NAME } from "../brand.ts";
import { percent } from "../format.ts";
import { database } from "../server.ts";

export const dynamic = "force-dynamic";

const whole = (value: number) => percent(value, 0);
const share = (value: number | null) => (value === null ? "keine Grenze" : whole(value));

export default function Strategy() {
  const p = DEFAULT_PROBABILITY_PARAMS;
  const bondYield = database().referenceRate(BOND_KEY);
  const judged = RISK_FACTOR_IDS.filter((id) => RISK_FACTORS[id].manual).length;
  const example = (score: number) => percent(p.base + p.perScore * score);
  const profiles = [
    { label: "Basislimit je Titel", pick: (x: typeof PROFILE_FOCUSED) => percent(x.baseLimit) },
    { label: "Mindestposition", pick: (x: typeof PROFILE_FOCUSED) => whole(x.minPosition) },
    { label: "Tauschschwelle", pick: (x: typeof PROFILE_FOCUSED) => `${x.swapThreshold * 100} Prozentpunkte` },
    {
      label: "Neue Titel je Branche und Region",
      pick: (x: typeof PROFILE_FOCUSED) => (x.maxPerSectorAndRegion === null ? "keine Grenze" : `höchstens ${x.maxPerSectorAndRegion}`),
    },
    { label: "Höchstanteil je Branche", pick: (x: typeof PROFILE_FOCUSED) => share(x.maxSectorShare) },
    { label: "Höchstanteil je Region", pick: (x: typeof PROFILE_FOCUSED) => share(x.maxRegionShare) },
  ];

  return (
    <>
      <div className="title-row">
        <div>
          <h1>Die Strategie {STRATEGY_NAME}</h1>
          <p className="finding">{STRATEGY_CLAIM}</p>
        </div>
      </div>
      <div className="card card-body" style={{ paddingTop: 24 }}>
        <div className="prose">
          <h2>Grundgedanke</h2>
          <p>
            Eine Aktie ist ein Anspruch auf das Geld, das ein Unternehmen seinen Eigentümern über die Jahre zurückgibt. Die Strategie
            schätzt keinen fairen Wert und setzt keine Kursziele. Sie fragt umgekehrt: Welche Rendite steckt im heutigen Kurs, wenn die
            Rückflüsse so kommen wie angenommen? Diese innere Rendite macht Aktien aus verschiedenen Branchen und Ländern vergleichbar.
            Gekauft wird, was nach Abzug des Risikos am meisten verspricht.
          </p>

          <h2>Was als Rückfluss zählt</h2>
          <ul>
            <li>die Dividende auf ihrem tragfähigen Niveau, ohne Sonderzahlungen,</li>
            <li>
              dazu Aktienrückkäufe, aber nur netto: abgezogen werden neu ausgegebene Aktien und die Vergütung von Mitarbeitern in Aktien,
            </li>
            <li>
              beides zusammen höchstens so viel, wie das Unternehmen an freiem Cashflow verdient, nach Abzug der Aktienvergütung (der
              Anbieter rechnet sie im Cashflow zurück, sie kostet die Eigentümer aber Verwässerung). Ausschüttungen auf Pump zählen nicht.
            </li>
            <li>
              Bei Zyklikern, deren Gewinn Verluste oder Einbrüche zeigt, zählt der niedrigere Wert aus dem Mittel des freien Cashflows der
              letzten fünf Jahre und dem Median der ganzen Reihe bis zu zehn Jahren; fünf Jahre im Hoch überschätzen sonst den Rückfluss.
            </li>
            <li>
              Liegen die Nettoschulden über dem {DEFAULT_DEBT_PARAMS.maxDebtToEbitda}-Fachen des EBITDA, wird der Überhang rechnerisch in{" "}
              {DEFAULT_DEBT_PARAMS.repaymentYears} Jahren getilgt. Diese Tilgung gehört den Gläubigern und wird vom Rückfluss abgezogen.
              Hohe Schulden machen einen Titel damit nicht attraktiver.
            </li>
          </ul>

          <h2>Wachstum</h2>
          <p>
            Das Wachstum der Rückflüsse wird vorsichtig angesetzt. Es gilt der kleinste dieser Werte: das Wachstum des Gewinns der letzten
            zehn Jahre, das Wachstum des Umsatzes, das Wachstum, das sich aus einbehaltenen Gewinnen finanzieren lässt (zuzüglich{" "}
            {whole(DEFAULT_GROWTH_PARAMS.inflationAllowance)} für Preissteigerungen), und {percent(DEFAULT_GROWTH_PARAMS.maxGrowth)} als
            feste Obergrenze. Über {DEFAULT_RETURN_PARAMS.fadeYears} Jahre schmilzt es auf höchstens{" "}
            {whole(DEFAULT_RETURN_PARAMS.maxTerminalGrowth)} ab, denn kein Unternehmen wächst auf Dauer schneller als die Wirtschaft.
          </p>
          <p>
            Diese Grenzen und die Schwelle bei 0 gelten in Euro-Kaufkraft. Bei Berichtswährungen mit höherer oder niedrigerer Inflation als
            der Euro werden sie um den Inflationsabstand verschoben, damit die festen Grenzen in jeder Währung dasselbe bedeuten. Die Grenze
            aus Einbehaltung rechnet dagegen mit der gemessenen, nominalen Eigenkapitalrendite; nur die Preissteigerung darin wird
            verschoben. Ein Gewinn, der nominal langsamer wächst als der Abstand, schrumpft real und gilt als schrumpfend. Die Aktienseite
            nennt die verschobenen Werte.
          </p>
          <p>
            Junge Börsenwerte mit weniger als {FULL_YEARS} Geschäftsjahren werden aus der kürzeren Reihe bewertet, sobald mindestens{" "}
            {MIN_YEARS} Jahre vorliegen. Die Aktienseite weist darauf hin; einen Bonus oder Nachlass für stetige Gewinne gibt es dann nicht.
          </p>
          <p>
            Wer wächst, behält Gewinn ein. Flacht das Wachstum ab, wird dieser Gewinn frei: Die Rechnung lässt die Ausschüttungsquote über
            dieselben {DEFAULT_RETURN_PARAMS.fadeYears} Jahre steigen, bis auf den Teil, den das Dauerwachstum noch braucht. Voll
            angerechnet wird das nur, wenn die einbehaltenen Gewinne bisher mindestens {whole(DEFAULT_RETURN_PARAMS.returnOnRetained)}{" "}
            Rendite gebracht haben. Ein Unternehmen, das Gewinne einbehält und trotzdem nicht wächst, bleibt bei seiner heutigen
            Ausschüttung: Was nie zurückfließt, hat keinen Wert.
          </p>
          <p>
            Gewinn und Umsatz werden dabei am ganzen Unternehmen gemessen, nicht je Aktie. Rückkäufe lassen den Gewinn je Aktie steigen,
            stehen aber schon im Rückfluss und dürfen nicht zweimal zählen. Gibt ein Unternehmen dagegen laufend neue Aktien aus, gilt das
            niedrigere Wachstum je Aktie.
          </p>

          <h2>Vergleich über Währungen</h2>
          <p>
            Eine Rendite in einer Währung mit hoher Inflation sieht größer aus, als sie ist: Die Inflation steckt im Wachstum und geht über
            die Abwertung wieder verloren. Deshalb wird von jeder Rendite in Fremdwährung der Unterschied zwischen der erwarteten Inflation
            dieser Währung und der des Euro abgezogen. Grundlage sind die Prognosen des Internationalen Währungsfonds für die nächsten vier
            Jahre.
          </p>

          <h2>Risiko</h2>
          <p>
            Jede Aktie durchläuft ein Raster aus {RISK_FACTOR_IDS.length} Faktoren. {RISK_FACTOR_IDS.length - judged} davon ergeben sich aus
            den Zahlen der letzten zehn Jahre, {judged} sind ein Urteil und werden von Hand gesetzt. Die Abzüge summieren sich zum
            Risikowert. Ab {whole(EXCLUSION_SCORE)} gilt eine Aktie als Spekulation und scheidet aus.
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Faktor</th>
                  <th className="num">Höchstabzug</th>
                  <th className="num">Bonus</th>
                  <th>Herkunft</th>
                </tr>
              </thead>
              <tbody>
                {RISK_FACTOR_IDS.map((id) => {
                  const factor = RISK_FACTORS[id];
                  return (
                    <tr key={id}>
                      <td>{factor.label}</td>
                      <td className="num">{whole(factor.maxDeduction)}</td>
                      <td className="num">{factor.bonus > 0 ? whole(factor.bonus) : "–"}</td>
                      <td>{factor.manual ? "Urteil" : "aus Zahlen"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 14 }}>
            Aus dem Risikowert wird eine jährliche Wahrscheinlichkeit, dass die Rückflüsse dauerhaft ausfallen:
          </p>
          <p className="formula">
            Ausfallwahrscheinlichkeit = {percent(p.base)} + {whole(p.perScore)} × Risikowert
          </p>
          <p>
            Ein Risikowert von 0 % ergibt {example(0)} pro Jahr, 25 % ergeben {example(0.25)}, 50 % ergeben {example(0.5)}. Diese
            Wahrscheinlichkeit geht direkt in die Rendite ein. Ein riskanter Titel muss also mehr abwerfen, um vor einem sicheren zu stehen.
          </p>

          <h2>Bandbreite statt Punktwert</h2>
          <p>
            Die Annahmen sind unsicher. Deshalb steht neben jeder inneren Rendite eine Spanne: einmal mit{" "}
            {whole(DEFAULT_SCENARIO_SPREAD.payoutFactor)} weniger Rückfluss und {DEFAULT_SCENARIO_SPREAD.growthPoints * 100} Prozentpunkt
            weniger Wachstum, einmal mit entsprechend mehr. Rang und Auswahl richten sich nach dem Basisfall; die Spanne zeigt, wie stark er
            von den Annahmen abhängt.
          </p>

          <h2>Vom Rang zum Portfolio</h2>
          <ul>
            <li>
              Es gibt kein Renditeziel. Die vollständig bewerteten Titel werden nach innerer Rendite gereiht und die besten zuerst
              aufgenommen, bis das Portfolio voll ist. Bargeld bringt nichts und bleibt nur übrig, wenn die Kandidaten ausgehen.
            </li>
            <li>
              Einzige Untergrenze ist die Rendite der zehnjährigen Euro-Staatsanleihe: Was sie nicht schlägt, lohnt das Risiko nicht.{" "}
              {bondYield === null
                ? `Solange keine Anleiherendite geladen ist, gelten ${percent(PROFILE_FOCUSED.minReturn)}.`
                : `Derzeit sind das ${percent(hurdleRate(bondYield))}.`}
            </li>
            <li>Je riskanter ein Titel, desto kleiner seine Position:</li>
          </ul>
          <p className="formula">Positionslimit = Basislimit × (1 − Risikowert)</p>
          <ul>
            <li>
              Getauscht wird nur, wenn ein neuer Titel den gehaltenen um mehr als die Tauschschwelle schlägt. Das hält die Umschichtungen
              und ihre Kosten niedrig.
            </li>
            <li>
              Es gibt keine Stop-Loss-Marken. Fällt ein Kurs bei unveränderten Aussichten, steigt die innere Rendite; das ist ein Grund
              nachzukaufen, nicht zu verkaufen.
            </li>
            <li>Limits gelten beim Kauf. Eine Position, die durch Kursgewinne wächst, wird nicht gekürzt.</li>
            <li>
              Eine Bewertung trägt das Datum, an dem sie zuletzt gespeichert wurde. Nach {REVIEW_MONTHS} Monaten ist sie zu prüfen, und
              früher, wenn sich Rückfluss oder Gewinnniveau seither um mehr als {whole(DEFAULT_SCENARIO_SPREAD.payoutFactor)} oder das
              Wachstum um mehr als einen Prozentpunkt verschoben haben. Kleinere Verschiebungen deckt die Bandbreite ab.
            </li>
          </ul>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Regel</th>
                  <th className="num">fokussiert</th>
                  <th className="num">global</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="num">{row.pick(PROFILE_FOCUSED)}</td>
                    <td className="num">{row.pick(PROFILE_GLOBAL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Grenzen</h2>
          <ul>
            <li>Die Rendite ist eine Rechnung aus Annahmen, keine Prognose. Sie taugt zum Vergleichen, nicht als Versprechen.</li>
            <li>
              Die Zahlen kommen von einem Datenanbieter und enthalten Fehler, vor allem bei Hinterlegungsscheinen und nach Aktiensplits. Vor
              einem Kauf gehören sie gegen den Geschäftsbericht geprüft.
            </li>
            <li>Die Zuordnung von Risikowert zu Ausfallwahrscheinlichkeit ist gesetzt, nicht an historischen Ausfällen geeicht.</li>
            <li>Die Strategie ist nicht rückwirkend getestet. Der tägliche Verlauf wird gespeichert, um sie mit der Zeit zu prüfen.</li>
            <li>Währungen werden nicht prognostiziert, Steuern beim Tausch nicht berücksichtigt.</li>
          </ul>

          <h2>Herkunft</h2>
          <p>
            Die Strategie steht in der Tradition wertorientierten Investierens. Den Gedanken, Aktien über ihre innere Rendite zu ordnen und
            das Risiko über ein Raster von Abzügen zu fassen, verdankt sie Stefan Meißners Buch „Langfristige Vermögensvermehrung mit
            wertorientierten Investments" und seinem Ansatz „Yield Investing". Eigene Regeln sind: die Begrenzung der Rückflüsse auf den
            freien Cashflow (bei Zyklikern über den ganzen Zyklus), der Abzug der Vergütung in Aktien, die Wachstumsgrenzen aus Umsatz und
            Einbehaltung, die Messung des Wachstums am ganzen Unternehmen, das Abschmelzen des Wachstums, der Abzug für die Tilgung hoher
            Schulden, die Bewertung der Finanzierung an der Ertragskraft, der Inflationsabgleich zwischen Währungen, die Anleiherendite als
            Untergrenze, das Maß, in dem einbehaltene Gewinne zählen, die Umrechnung des Risikowerts in eine Ausfallwahrscheinlichkeit, die
            Bandbreite und die Tauschschwelle. Diese Seite ist kein Angebot dieses Autors und nicht mit ihm abgestimmt.
          </p>
        </div>
      </div>
    </>
  );
}
