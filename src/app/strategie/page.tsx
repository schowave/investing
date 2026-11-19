import {
  DEFAULT_GROWTH_PARAMS, DEFAULT_PROBABILITY_PARAMS, DEFAULT_RETURN_PARAMS, DEFAULT_SCENARIO_SPREAD, EXCLUSION_SCORE,
  PROFILE_FOCUSED, PROFILE_GLOBAL, RISK_FACTORS, RISK_FACTOR_IDS,
} from "../../calc/index.ts";
import { STRATEGY_CLAIM, STRATEGY_NAME } from "../brand.ts";
import { percent } from "../format.ts";

const whole = (value: number) => percent(value, 0);
const share = (value: number | null) => (value === null ? "keine Grenze" : whole(value));

export default function Strategy() {
  const p = DEFAULT_PROBABILITY_PARAMS;
  const judged = RISK_FACTOR_IDS.filter((id) => RISK_FACTORS[id].manual).length;
  const example = (score: number) => percent(p.base + p.perScore * score);
  const profiles = [
    { label: "Basislimit je Titel", pick: (x: typeof PROFILE_FOCUSED) => percent(x.baseLimit) },
    { label: "Mindestposition", pick: (x: typeof PROFILE_FOCUSED) => whole(x.minPosition) },
    { label: "Mindestrendite", pick: (x: typeof PROFILE_FOCUSED) => percent(x.minReturn) },
    { label: "Tauschschwelle", pick: (x: typeof PROFILE_FOCUSED) => `${x.swapThreshold * 100} Prozentpunkte` },
    { label: "Neue Titel je Branche und Region", pick: (x: typeof PROFILE_FOCUSED) => (x.maxPerSectorAndRegion === null ? "keine Grenze" : `höchstens ${x.maxPerSectorAndRegion}`) },
    { label: "Höchstanteil je Branche", pick: (x: typeof PROFILE_FOCUSED) => share(x.maxSectorShare) },
    { label: "Höchstanteil je Region", pick: (x: typeof PROFILE_FOCUSED) => share(x.maxRegionShare) },
  ];

  return (
    <div className="prose">
      <h1>Die Strategie {STRATEGY_NAME}</h1>
      <p className="claim">{STRATEGY_CLAIM}</p>

      <h2>Grundgedanke</h2>
      <p>
        Eine Aktie ist ein Anspruch auf das Geld, das ein Unternehmen seinen Eigentümern über die Jahre zurückgibt. Die
        Strategie schätzt keinen fairen Wert und setzt keine Kursziele. Sie fragt umgekehrt: Welche Rendite steckt im
        heutigen Kurs, wenn die Rückflüsse so kommen wie angenommen? Diese innere Rendite macht Aktien aus
        verschiedenen Branchen und Ländern vergleichbar. Gekauft wird, was nach Abzug des Risikos am meisten verspricht.
      </p>

      <h2>Was als Rückfluss zählt</h2>
      <ul>
        <li>die Dividende auf ihrem tragfähigen Niveau, ohne Sonderzahlungen,</li>
        <li>
          dazu Aktienrückkäufe, aber nur netto: abgezogen werden neu ausgegebene Aktien und die Vergütung von
          Mitarbeitern in Aktien,
        </li>
        <li>
          beides zusammen höchstens so viel, wie das Unternehmen an freiem Cashflow verdient. Ausschüttungen auf Pump
          zählen nicht.
        </li>
      </ul>

      <h2>Wachstum</h2>
      <p>
        Das Wachstum der Rückflüsse wird vorsichtig angesetzt. Es gilt der kleinste dieser Werte: das Wachstum des
        Gewinns je Aktie der letzten zehn Jahre, das Wachstum des Umsatzes je Aktie, das Wachstum, das sich aus
        einbehaltenen Gewinnen finanzieren lässt (zuzüglich {whole(DEFAULT_GROWTH_PARAMS.inflationAllowance)} für
        Preissteigerungen), und {percent(DEFAULT_GROWTH_PARAMS.maxGrowth)} als feste Obergrenze. Über{" "}
        {DEFAULT_RETURN_PARAMS.fadeYears} Jahre schmilzt es auf höchstens {whole(DEFAULT_RETURN_PARAMS.maxTerminalGrowth)}{" "}
        ab, denn kein Unternehmen wächst auf Dauer schneller als die Wirtschaft.
      </p>

      <h2>Risiko</h2>
      <p>
        Jede Aktie durchläuft ein Raster aus {RISK_FACTOR_IDS.length} Faktoren. {RISK_FACTOR_IDS.length - judged} davon
        ergeben sich aus den Zahlen der letzten zehn Jahre, {judged} sind ein Urteil und werden von Hand gesetzt. Die Abzüge summieren sich
        zum Risikowert. Ab {whole(EXCLUSION_SCORE)} gilt eine Aktie als Spekulation und scheidet aus.
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
        Ein Risikowert von 0 % ergibt {example(0)} pro Jahr, 25 % ergeben {example(0.25)}, 50 % ergeben {example(0.5)}.
        Diese Wahrscheinlichkeit geht direkt in die Rendite ein. Ein riskanter Titel muss also mehr abwerfen, um vor
        einem sicheren zu stehen.
      </p>

      <h2>Bandbreite statt Punktwert</h2>
      <p>
        Die Annahmen sind unsicher. Deshalb steht neben jeder inneren Rendite eine Spanne: einmal mit{" "}
        {whole(DEFAULT_SCENARIO_SPREAD.payoutFactor)} weniger Rückfluss und {DEFAULT_SCENARIO_SPREAD.growthPoints * 100}{" "}
        Prozentpunkt weniger Wachstum, einmal mit entsprechend mehr. Liegt der vorsichtige Wert unter der Mindestrendite,
        ist der Titel kein klarer Fall.
      </p>

      <h2>Vom Rang zum Portfolio</h2>
      <ul>
        <li>Aufgenommen werden nur vollständig bewertete Titel über der Mindestrendite, die besten zuerst.</li>
        <li>Je riskanter ein Titel, desto kleiner seine Position:</li>
      </ul>
      <p className="formula">Positionslimit = Basislimit × (1 − Risikowert)</p>
      <ul>
        <li>
          Getauscht wird nur, wenn ein neuer Titel den gehaltenen um mehr als die Tauschschwelle schlägt. Das hält die
          Umschichtungen und ihre Kosten niedrig.
        </li>
        <li>
          Es gibt keine Stop-Loss-Marken. Fällt ein Kurs bei unveränderten Aussichten, steigt die innere Rendite; das
          ist ein Grund nachzukaufen, nicht zu verkaufen.
        </li>
        <li>Limits gelten beim Kauf. Eine Position, die durch Kursgewinne wächst, wird nicht gekürzt.</li>
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
          Die Zahlen kommen von einem Datenanbieter und enthalten Fehler, vor allem bei Hinterlegungsscheinen und nach
          Aktiensplits. Vor einem Kauf gehören sie gegen den Geschäftsbericht geprüft.
        </li>
        <li>Die Zuordnung von Risikowert zu Ausfallwahrscheinlichkeit ist gesetzt, nicht an historischen Ausfällen geeicht.</li>
        <li>Die Strategie ist nicht rückwirkend getestet. Der tägliche Verlauf wird gespeichert, um sie mit der Zeit zu prüfen.</li>
        <li>Währungen werden nicht prognostiziert, Steuern beim Tausch nicht berücksichtigt.</li>
      </ul>

      <h2>Herkunft</h2>
      <p>
        Die Strategie steht in der Tradition wertorientierten Investierens. Den Gedanken, Aktien über ihre innere
        Rendite zu ordnen und das Risiko über ein Raster von Abzügen zu fassen, verdankt sie Stefan Meißners Buch
        „Langfristige Vermögensvermehrung mit wertorientierten Investments" und seinem Ansatz „Yield Investing". Eigene
        Regeln sind: die Begrenzung der Rückflüsse auf den freien Cashflow, der Abzug der Vergütung in Aktien, die
        Wachstumsgrenzen aus Umsatz und Einbehaltung, das Abschmelzen des Wachstums, die Umrechnung des Risikowerts in
        eine Ausfallwahrscheinlichkeit, die Bandbreite und die Tauschschwelle. Diese Seite ist kein Angebot dieses
        Autors und nicht mit ihm abgestimmt.
      </p>
    </div>
  );
}
