# Spezifikation: Strategie „Rückflussrendite"

Stand: 20.11.2026. Status: abgestimmt.

## 1. Zweck

Privates Entscheidungswerkzeug für eine Handvoll bekannter Nutzer. Es bewertet Aktien einer
gepflegten Watchlist nach ihrer inneren Rendite, stuft ihr Risiko ein, leitet daraus ein
Zielportfolio ab und zeigt die Abweichung zum tatsächlichen Bestand.

Die Anwendung führt keine Orders aus und gibt keine öffentlichen Empfehlungen. Sie ist keine
Anlageberatung; alle Bewertungen beruhen auf den Annahmen der Nutzer.

## 2. Quellen und ihr Gewicht

| Quelle                                                                                                                    | Inhalt                                                                                                                   | Verwendung                                                        |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Folien „Yield Investing" (19.11.2026)                                                                                     | Innere Rendite per invertiertem DCF, Ausfallwahrscheinlichkeit, Ranking, Beispiel Imperial Brands                        | Maßgeblich für Kennzahl und Auswahl                               |
| Buch, Stefan Meißner, „Langfristige Vermögensvermehrung mit wertorientierten Investments" (PDF, Stand 2012), Kap. 5 und 6 | Gewinn- und Dividendenniveau, Wachstum, Risikoraster, Positionslimit, Streuung, Umschichtung                             | Maßgeblich für Eingaben, Risiko und Portfolio-Regeln              |
| Wikifolio-Handelsideen (FocusedYieldInvesting, Global Yield Investing)                                                    | Zwei Portfolio-Profile, Risiko bestimmt Abschlag und Positionsgröße                                                      | Bestätigung, Grundlage der Profile                                |
| Interview mit dem Autor (Podcast „Bulle & Mensch“, Mitschrift in `docs/Interview.md`)                                     | Rückflüsse in zwei Phasen, Auswahl nach Rang ohne Renditeziel, kein Bargeld, Größenordnung der Ausfallwahrscheinlichkeit | Maßgeblich für Abschnitt 4.3 und 7.1                              |
| Gespräch mit dem Autor (Börsenradio, „Wikifolio-Trader der Woche“, Mitschrift in `docs/podcast.md`)                       | Positionen mit Zahlen: Höegh Autoliners, Safe Bulkers, Lion Finance, Stalexport; Risikomerkmale; Tenge-Inflation         | Prüfsteine für Abschnitt 5 (kurze Historie) und 9 (Plausibilität) |

Wo die Quellen keine Zahl nennen, steht eine eigene Annahme. Alle eigenen Annahmen sind in
Abschnitt 12 gesammelt und in der Anwendung als Einstellungen änderbar.

Nicht übernommen wird die Buchmethode „innerer Wert minus Sicherheitsmarge = maximaler
Kaufpreis". Die Folien ersetzen sie durch die innere Rendite.

## 3. Begriffe

| Begriff                       | Bedeutung                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rückflussniveau `R0`          | Für das kommende Jahr erwartete Rückflüsse je Aktie: Dividendenniveau plus Netto-Aktienrückkäufe je Aktie |
| Wachstum `g0`                 | Erwartetes jährliches Wachstum der Rückflüsse je Aktie zu Beginn                                          |
| Dauerwachstum `g∞`            | Wachstum nach der Abschmelzphase, höchstens 3 %                                                           |
| Risikowert                    | Summe der Abzüge aus dem Risikoraster, 0 % (Top-Rating) bis über 100 %                                    |
| Ausfallwahrscheinlichkeit `p` | Jährliche Wahrscheinlichkeit, dass alle künftigen Rückflüsse entfallen; aus dem Risikowert abgeleitet     |
| Innere Rendite `r`            | Zinssatz, bei dem der Barwert der erwarteten Rückflüsse dem aktuellen Kurs entspricht                     |
| Gewinnniveau                  | Um Konjunktur und Einmaleffekte geglätteter Gewinn je Aktie                                               |
| Region                        | Kontinent des Unternehmenssitzes; Japan wird beim Risikofaktor Land wie Europa und Nordamerika behandelt  |
| Bewertung                     | Der Satz aus Annahmen und Risikofaktoren zu einer Aktie, mit Datum der letzten Prüfung                    |

## 4. Rechenmodell: innere Rendite

Eingaben: Kurs `P`, Rückflussniveau `R0`, Wachstum `g0`, Ausfallwahrscheinlichkeit `p`.
Parameter: Abschmelzdauer `n = 15` Jahre, Obergrenze Dauerwachstum `3 %`.

```
g∞  = min(g0, 3 %)
g_t = g0 + (g∞ − g0) · (t − 1) / n          für t = 1 … n   (lineares Abschmelzen)

R_1 = R0                                     (das Niveau gilt für das kommende Jahr)
R_t = R_(t−1) · (1 + g_t)                    für t = 2 … n

q   = (1 + g∞) · (1 − p)

P   = Σ_(t=1…n)  R_t · (1 − p)^t / (1 + r)^t
      +  R_n · (1 − p)^n · q / ( (1 + r − q) · (1 + r)^n )
```

`r` wird numerisch gelöst (Bisektion, `r > q − 1`). Alle Größen je Aktie müssen in der
Währung des Kurses vorliegen; Kurse in Unterwährungen (z. B. Pence in London) werden vorher
umgerechnet.

Sonderfall `g0 ≤ 3 %`: einstufig, geschlossen lösbar:
`r = R0 · (1 − p) / P + q − 1`.

Zusätzlich angezeigt wird die innere Rendite bei alternativen Kursen (wie auf Folie 7), damit
sichtbar ist, wie stark die Rendite am Kurs hängt.

### 4.1 Bandbreite

Jede Aktie wird in drei Fällen gerechnet. Rangfolge, Untergrenze und Zielportfolio
verwenden den Basisfall; die Rangliste zeigt zusätzlich die Spanne. Rückfluss und Gewinnniveau
verschieben sich gemeinsam, die Ausschüttungsquote bleibt.

| Fall         | Rückflussniveau | Wachstum                                                                    |
| ------------ | --------------- | --------------------------------------------------------------------------- |
| vorsichtig   | `R0 · 0,9`      | `g0 − 1 Prozentpunkt`, mindestens 0 % (bei negativem `g0` ohne Untergrenze) |
| Basis        | `R0`            | `g0`                                                                        |
| optimistisch | `R0 · 1,1`      | `g0 + 1 Prozentpunkt`                                                       |

Die Abstände sind Standardwerte und je Aktie übersteuerbar. Die Ausfallwahrscheinlichkeit ist
in allen drei Fällen gleich.

### 4.2 Warnungen ohne Sperrwirkung

- Manuell gesetztes Rückflussniveau liegt über dem Gewinnniveau oder über dem freien Cashflow je Aktie (nicht dauerhaft tragbar).
- Manuell gesetztes `g0` liegt über 8,5 % oder über der Obergrenze aus Einbehaltung (Abschnitt 5).

### 4.3 Steigende Ausschüttungsquote

Wer wächst, behält Gewinn ein. Flacht das Wachstum ab, wird dieser Gewinn frei und fließt zurück. Der Autor rechnet
so (Interview): in der Wachstumsphase nur den ausgeschütteten Teil, danach eine höhere Quote auf den bis dahin
gewachsenen Gewinn. Ohne diese Annahme zählt ein einbehaltener Gewinn nie, und Titel mit niedriger Ausschüttung
(3i, TBC, Adobe) kommen auf Renditen weit unter dem, was ihr Gewinn hergibt.

Mit Gewinnniveau `G0` und `a0 = R0 / G0` (nur wenn `a0 < 1`):

```
a_Ziel = 1 − max(0, g∞ − 2 %) / 10 %         (auch das Dauerwachstum braucht noch Kapital; bei 3 % also 90 %)
e      = (g0 − 2 %) / (1 − a0)               (Rendite der einbehaltenen Gewinne)
w      = min(1, max(0, e / 10 %))            (Anrechnung)
a∞     = a0 + w · (a_Ziel − a0)              (nie unter a0)

a_t = a0 + (a∞ − a0) · (t − 1) / n           für t = 1 … n
R_t = G_t · a_t,   G_1 = G0,   G_t = G_(t−1) · (1 + g_t)
Endwert auf G_n · a∞
```

- Im ersten Jahr gilt die heutige Ausschüttung; ohne Gewinnniveau oder bei `a0 ≥ 1` bleibt die Rechnung aus Abschnitt 4.
- Angerechnet wird nur, was nachweislich Wachstum bringt: Ein Unternehmen, das einbehält und nicht über die
  Preissteigerung hinaus wächst (`g0 ≤ 2 %`), bleibt bei seiner Quote. Das ist die Wertfalle, die der Autor meidet.
  Volle Anrechnung gibt es ab 10 % Rendite auf das Einbehaltene (Buch Kap. 5.5: mindestens 10 % auf einbehaltenes Kapital).
- Das Gewinnniveau kommt aus dem Vorschlag (Abschnitt 5) und lässt sich noch nicht von Hand setzen. Titel ohne
  Gewinnniveau (weniger als zehn Geschäftsjahre) rechnen mit fester Quote.
- Die Aktienseite nennt die angenommene Quote („steigt von 9 % auf 67 %“).

## 5. Eingaben: Vorschlag und Übersteuerung

Jede Eingabe hat einen automatischen Vorschlag und einen optionalen manuellen Wert. Es gilt
der manuelle Wert, wenn er gesetzt ist; die Oberfläche zeigt immer, welcher gilt. Neue
Fundamentaldaten ändern nur den Vorschlag und erzeugen einen Hinweis, sie überschreiben nie
einen manuellen Wert.

Grundlage sind zehn Geschäftsjahre je Aktie (Buch Kap. 5.2). Jüngere Börsenwerte werden aus der kürzeren Reihe bewertet,
sobald fünf Jahre vorliegen (der Autor hält mit Höegh Autoliners und Kaspi solche Titel): Das Wachstum vergleicht dann die
erste mit der letzten Hälfte der Reihe, das Niveau rechnet den Durchschnitt um die halbe Länge der Reihe (abgerundet) hoch. Die
Bewertung nennt die kürzere Reihe. Was Stetigkeit über zehn Jahre belegen soll, entfällt: der Bonus in Faktor 1 und der
Nachlass in Faktor 2.

**Wachstum der Vergangenheit** (für Gewinn, Dividende, Umsatz je Aktie gleich):
`g = (Durchschnitt der letzten 5 Jahre / Durchschnitt der ersten 5 Jahre)^(1/5) − 1`

**Gewinnniveau:**

- Gewinn je Aktie in allen zehn Jahren gestiegen: letzter Gewinn je Aktie.
- sonst: `Zehnjahresdurchschnitt · (1 + g · 5)`, zur Kontrolle `Fünfjahresdurchschnitt · (1 + g · 2)`; es gilt der niedrigere Wert.
- In beiden Fällen höchstens der höchste Gewinn je Aktie der letzten drei Jahre.
- Verwässerter Gewinn je Aktie, sofern verfügbar.

**Dividendenniveau:** letzte Dividende, wenn sie in den letzten zehn Jahren nie gesenkt
wurde; sonst nach derselben Durchschnittsformel wie das Gewinnniveau, höchstens die letzte
Dividende. Sonderdividenden zählen nicht.

**Netto-Rückkäufe je Aktie:** Durchschnitt der letzten fünf Jahre aus (Rückkäufe minus
Ausgabe neuer Aktien minus aktienbasierte Vergütung) geteilt durch die Aktienzahl,
mindestens 0.

**Tragbarer Rückfluss je Aktie:** Durchschnitt des freien Cashflows je Aktie der letzten
fünf Jahre, abzüglich der Tilgung überhöhter Schulden: Liegen die Nettoschulden über dem Dreifachen des EBITDA, wird der Überhang rechnerisch in zehn Jahren getilgt. Bei Banken und Versicherern stattdessen das Gewinnniveau. Bei Immobilienwerten (Branche „Real Estate“, auch nach GICS; der Anbieter führt Anleihen von Versorgern ebenfalls als REIT) tritt der operative Cashflow an die Stelle des freien: Sie kaufen Objekte aus dem laufenden Geld, der Anbieter zählt das als Investition, und ihr freier Cashflow bleibt dauerhaft negativ, obwohl sie verlässlich ausschütten. Der operative Cashflow steht für das, was sie ausschütten können (ähnlich FFO); die Tilgung überhöhter Schulden wird auch hier abgezogen.

**Rückflussniveau `R0`:** Dividendenniveau plus Netto-Rückkäufe je Aktie, höchstens der
tragbare Rückfluss. Rückkäufe, die nicht aus freiem Cashflow gedeckt sind, zählen damit
nicht. Greift die Deckelung, zeigt die Oberfläche das an.

**Wachstum `g0`:** bei wachsendem Gewinn der kleinste dieser vier Werte, mindestens 0 %:

- Wachstum des Gewinns nach obiger Formel,
- Wachstum des Umsatzes nach derselben Formel (entfällt, wenn nicht bestimmbar),
- 8,5 %,
- `Einbehaltungsquote · Eigenkapitalrendite + 2 %`, mit
  `Einbehaltungsquote = max(0, 1 − R0 / Gewinnniveau)` und
  `Eigenkapitalrendite = Gewinnniveau / Eigenkapital je Aktie`. Die 2 % stehen für
  Preissteigerungen ohne zusätzliches Kapital.

Gewinn und Umsatz werden je Aktie und für das ganze Unternehmen gemessen; es gilt der niedrigere Wert. Rückkäufe stehen schon im Rückfluss und würden im Wachstum je Aktie ein zweites Mal zählen; bei Verwässerung ist der Wert je Aktie der niedrigere.

Schrumpft der Gewinn (historisches Wachstum negativ), ist der Vorschlag das gemessene Wachstum, höchstens bis −5 %. Der
Rückfluss schrumpft dann dauerhaft mit diesem Satz; das ist die vorsichtigste Annahme und trennt Wertfallen von
Gelegenheiten, statt solche Titel ganz auszublenden. Die Oberfläche nennt das Schrumpfen.

Bei negativem Eigenkapital entfällt die Grenze aus Einbehaltung, die Oberfläche weist darauf hin. Ist
das historische Gewinnwachstum nicht bestimmbar (Durchschnitt am Anfang oder Ende der Reihe nicht positiv, meist wegen
Verlustjahren), kommt der Vorschlag aus dem Umsatzwachstum je Aktie (niedrigerer Wert aus je Aktie und Gesamtunternehmen),
begrenzt auf −5 % bis 3 %, das Endwachstum: Die Geschichte sagt dann nichts Verlässliches über überdurchschnittliches
Wachstum, und bei Zyklikern misst der Umsatz oft nur den Weg vom Tief zum Hoch. Liegen die Verluste am Ende der Reihe,
gilt höchstens 0 %, die vorsichtigste Annahme wie beim schrumpfenden Gewinn. Die Grenze aus Einbehaltung gilt weiter.
Nur wenn auch der Umsatz unvollständig ist, gibt es keinen Vorschlag; der Wert muss manuell gesetzt werden.

## 6. Risikobewertung

### 6.1 Raster (Buch Kap. 5.8, Abb. 32)

Start beim Top-Rating (0 %). Je Faktor wird ein Abzug zwischen 0 und dem Höchstwert
vergeben, bei einigen Faktoren ein Bonus. Der Risikowert ist die Summe, mindestens 0 %.

| #   | Faktor                           | Anforderung                                                                                                 | Höchstabzug | Bonus | Herkunft                         |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ----- | -------------------------------- |
| 1   | Gewinn- und Umsatzentwicklung    | weitgehend konstant, keine starken Einbrüche                                                                | 50 %        | 10 %  | Vorschlag                        |
| 2   | Finanzierung                     | EK-Quote > 50 %, kurzfr. Verbindlichkeiten < Umlaufvermögen, langfr. Fremdkapital ≤ 3 × operativer Cashflow | 50 %        | –     | Vorschlag (Finanzwerte: manuell) |
| 3   | Größe                            | Bilanzsumme > 20 Mrd. €                                                                                     | 40 %        | –     | Vorschlag                        |
| 4   | Existenzdauer                    | über 20 Jahre                                                                                               | 30 %        | –     | Vorschlag                        |
| 5   | Branche                          | nicht subventioniert, nicht schnelllebig, verstanden                                                        | 25 %        | –     | manuell                          |
| 6   | Land                             | Sitz in Europa, Nordamerika oder Japan                                                                      | 25 %        | –     | Vorschlag                        |
| 7   | Wettbewerbsvorteile              | mindestens durchschnittlich                                                                                 | 20 %        | 20 %  | manuell                          |
| 8   | Rendite auf eingesetztes Kapital | > 10 %                                                                                                      | 15 %        | 5 %   | Vorschlag (Finanzwerte: manuell) |
| 9   | EBIT-Marge                       | > 10 %                                                                                                      | 15 %        | 5 %   | Vorschlag (Finanzwerte: manuell) |
| 10  | Management                       | keine Hinweise auf schlechtes oder korruptes Management                                                     | 100 %       | 10 %  | manuell                          |
| 11  | Zuverlässigkeit der Prognosen    | weitgehend zuverlässig                                                                                      | 40 %        | –     | manuell                          |
| 12  | Free Cashflow und Ausschüttung   | erzielt freien Cashflow, schüttet verlässlich aus                                                           | 25 %        | –     | Vorschlag                        |
| 13  | Abhängigkeiten                   | keine von einem Rohstoff, Lieferanten oder Kunden                                                           | 20 %        | –     | manuell                          |
| 14  | Währung                          | EUR, USD, CHF, GBP, JPY                                                                                     | 10 %        | –     | Vorschlag                        |
| 15  | Aktuelle Situation               | keine Krise                                                                                                 | 30 %        | –     | manuell                          |

Regeln:

- Manuelle Faktoren haben keinen Standardwert. Solange einer fehlt, gilt die Bewertung als unvollständig und die Aktie kommt nicht ins Zielportfolio.
- Bei Banken und Versicherern gibt es für die Faktoren 2, 8 und 9 keinen Vorschlag; sie müssen manuell gesetzt werden.
- Auch Vorschlagsfaktoren können manuell übersteuert werden.

### 6.2 Vorschlagsregeln für die Zahlenfaktoren

Zwischen den Stützpunkten wird linear interpoliert.

| #   | Regel                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Zehn Jahre Gewinn je Aktie: 3 oder mehr Verlustjahre 50 %; 1 bis 2 Verlustjahre 25 %; kein Verlust, aber ein Einbruch unter die Hälfte des Mittels (Median) der drei Vorjahre 12,5 %; jedes Jahr gestiegen Bonus 10 %; sonst 0 %. Verlust und Einbruch zählen nur, wenn das operative Ergebnis sie bestätigt: Ein Verlust bei positivem EBIT zählt nicht als Verlustjahr, sondern höchstens als Einbruch; ein Einbruch braucht ein EBIT, das negativ ist oder mehr als 30 % unter dem Mittel seiner drei Vorjahre liegt. Fehlt das EBIT, entscheidet der Gewinn allein. Grund: Das Buch rechnet mit bereinigten Gewinnen, der Anbieter liefert unbereinigte (US-Steuerreform 2017 bei Coca-Cola und Charter) |
| 2   | Nettoschulden zum operativen Cashflow (Mittel der letzten drei Jahre; Maß des Buchs): bis 3 kein Abzug, ab 6 der Abzug von 30 %; Zinsdeckung (EBIT zu Zinsaufwand): ab 8 kein Abzug, bis 2 der Abzug von 20 %. Beide messen dieselbe Last, es gilt der höhere Abzug. Plus 10 %, wenn kurzfr. Verbindlichkeiten > Umlaufvermögen. Stetige Gewinne tragen mehr Schulden (Buch: „abhängig von Kontinuität der Gewinne und Cashflows“, Wal-Mart 5 % statt 14 %): Bei Faktor 1 ohne Abzug zählen 70 %, bei stetig steigendem Gewinn 40 %. Eigene Regel statt der Eigenkapitalquote des Buchs, weil Rückkäufe das Eigenkapital schrumpfen lassen, ohne die Zahlungsfähigkeit zu ändern                             |
| 3   | Bilanzsumme ≥ 20 Mrd. € 0 %; ≤ 20 Mio. € 40 %; dazwischen linear im Logarithmus (2 Mrd. € ergeben rund 13 %)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 4   | ≥ 20 Jahre 0 %; ≤ 3 Jahre 30 %                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | Sitz in Europa, Nordamerika, Japan 0 %; sonst 12,5 % als Ausgangswert zur manuellen Anpassung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | ≥ 10 % 0 %; ≤ 5 % 15 %; ≥ 20 % Bonus 5 % (EBIT / (Bilanzsumme − Zahlungsmittel))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 9   | ≥ 10 % 0 %; ≤ 5 % 15 %; ≥ 20 % Bonus 5 %                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 12  | Freier Cashflow in mindestens 8 von 10 Jahren (bei kürzerer Reihe in 80 % der Jahre) positiv und Ausschüttung (Dividende oder Netto-Rückkäufe) ohne Kürzung 0 %; mit Dividendenkürzung in den letzten 10 Jahren 5 %; weder freier Cashflow noch Ausschüttung 25 %; alle übrigen Fälle 12,5 %. Bei Banken und Versicherern zählen statt des freien Cashflows die Gewinnjahre                                                                                                                                                                                                                                                                                                                                  |
| 14  | Berichtswährung EUR, USD, CHF, GBP, JPY 0 %; sonst 10 %                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### 6.3 Klassen und Ausfallwahrscheinlichkeit

| Risikowert             | Klasse           | Folge          |
| ---------------------- | ---------------- | -------------- |
| 0 bis 20 %             | hervorragend     |                |
| über 20 bis 50 %       | durchschnittlich |                |
| über 50 bis unter 75 % | riskant          |                |
| ab 75 %                | Spekulation      | ausgeschlossen |

`p = 0,5 % + 5 % · Risikowert` pro Jahr (Risikowert 0 % ergibt 0,5 %, 26 % ergeben 1,8 %,
50 % ergeben 3,0 %). Die Zuordnung ist linear und einstellbar.

### 6.4 Vorschläge für die Urteilsfaktoren (Jev)

Für die Faktoren 5, 7, 10, 11, 13 und 15 kann auf der Aktienseite oder mit `pnpm run judge` ein
Vorschlag geholt werden.

1. **Recherche (optional):** Claude (`claude-opus-5-5` mit Websuche) sammelt datierte Belege zu den
   sechs Faktoren, ohne sie zu bewerten. Ohne `ANTHROPIC_API_KEY` bricht `pnpm run judge` ab; ohne Recherche
   einstufen ist eine bewusste Wahl (`--ohne-recherche`).
2. **Mitteilungen an die SEC:** Bei Titeln mit CIK (US-Werte, aus den Rohdaten von EODHD) holt
   `src/judgement/edgar.ts` die Mitteilungen der letzten zwölf Monate von EDGAR, kostenlos und
   ohne Sprachmodell (User-Agent `SEC_USER_AGENT`). Genommen werden 8-Ks mit ausgeschriebenen
   Punkten und Formulare mit außergewöhnlichem Inhalt (Berichtigungen, verspätete Abschlüsse,
   13D, Übernahmeangebote, Delisting). Von bis zu acht 8-Ks mit gewichtigen Punkten (z. B. 1.02,
   4.02, 5.02, 8.01) geht der Anfang des Textes mit. Fällt EDGAR aus, wird ohne eingestuft.
3. **Einstufung:** Jev von TypeSafe AI (`jev-latest`, Schlüssel `TYPESAFE_API_KEY`) bekommt
   Stammdaten und Beschreibung, zehn Geschäftsjahre, die Insidergeschäfte der letzten drei Jahre,
   die Mitteilungen an die SEC und die Recherche. Die Gewinnüberraschungen des Anbieters gehen nicht
   mit: Außerhalb der USA mischen sie Einheiten und sehen dann wie grobe Verfehlungen aus. Je Faktor
   wählt Jev unter festen Stufen (`src/judgement/factors.ts`) und nennt für jede eine Wahrscheinlichkeit.
4. **Vorschlag:** der mit diesen Wahrscheinlichkeiten gewichtete Abzug, gerundet auf 0,5
   Prozentpunkte, dazu die Sicherheit laut Jev.

Regeln:

- Ein Jev-Vorschlag ist kein Urteil. Er füllt das Eingabefeld vor, die Bewertung bleibt aber
  unvollständig, bis gespeichert wird. Ein unverändert übernommener Vorschlag wird in der Notiz vermerkt.
- Maßstab der Stufen ist das Buch (Kap. 5.8): Wer die Anforderung erfüllt, bekommt 0 %. Ein Abzug braucht einen
  benannten Befund; fehlende Information ist keiner. Was andere Faktoren schon messen, zählt nicht noch einmal:
  Die Branche (Faktor 5) bewertet nur Wandel und Subventionen, nicht Regulierung, Zyklik oder Verschuldung. Die
  Prognosen (Faktor 11) meinen, wie gut sich Gewinnniveau und Wachstum bestimmen lassen (Buch: bei Wal-Mart leichter
  als bei BASF; Patentabläufe), nicht die Treffsicherheit von Analysten. Das Interview des Autors
  (`docs/Interview.md`) stützt beides: Planbarkeit trennt für ihn Coca-Cola von SpaceX, und ein Wechsel im Vorstand
  ist für sich kein Befund (Adobe).
- Geeicht sind die Stufen an Titeln, die das Buch selbst einstuft, und an Qualitätswerten: Die sechs Faktoren
  ergeben zusammen bei Wal-Mart, Coca-Cola und Nestlé etwa 0 % (Buch für Wal-Mart: 5 % Bonus), bei BASF 22 %
  (Buch: 5 %). Der gewichtete Abzug liegt über der wahrscheinlichsten Stufe, weil die Abzüge größer sind als die Boni.
- Die Stufen haben eine Fassung (`LEVELS_VERSION`). Nach einer Änderung gelten gespeicherte Vorschläge der alten
  Fassung nicht mehr; die Aktienseite bittet um eine neue Einstufung, `pnpm run judge --offen` holt sie nach.
- Ob der Nutzer die Branche versteht (Faktor 5), beurteilt Jev nicht.
- Je Aktie gilt die jüngste Einstufung; Recherche und Quellen bleiben gespeichert.
- Für die Faktoren 2, 8 und 9 bei Finanzwerten gibt es keinen Jev-Vorschlag.
- Die Aktienseite rät, die Lage selbst zu prüfen, wenn der Kurs mindestens 40 % unter dem
  52-Wochen-Hoch liegt, zwei der letzten vier Quartale mehr als 15 % unter der Gewinnschätzung
  lagen oder der Umsatz des letzten Quartals mindestens 15 % unter dem Vorjahresquartal liegt
  (nicht bei Finanzwerten). Das ist nur ein Hinweis, kein Abzug (`src/judgement/situation.ts`).

## 7. Zielportfolio

### 7.1 Zulässige Kandidaten

Eine Aktie ist Kandidat, wenn alle Punkte gelten:

- Bewertung vollständig (alle Eingaben und alle 15 Risikofaktoren gesetzt),
- Risikowert unter 75 %,
- innere Rendite im Basisfall über der Untergrenze.

Es gibt kein Renditeziel (Interview: „Ich habe nicht so eine klare Zielrendite“). Ausgewählt wird nach Rang, bis das Portfolio voll ist; Bargeld bleibt nur, wenn die Kandidaten ausgehen. Die Untergrenze ist die Rendite der zehnjährigen Euro-Staatsanleihe bester Bonität (EZB-Zinsstrukturkurve): Was sie nicht schlägt, lohnt das Risiko nicht. Ohne geladene Anleiherendite gelten 3 %. Aufschlag und Mindestwert der Untergrenze sind Parameter und stehen auf 0.

Die frühere Regel (Anleiherendite plus 5 Punkte, mindestens 7 %, und das schon im vorsichtigen Fall) ist gestrichen: Sie ließ im Depot des Autors nur einen von 18 Titeln zu und hielt drei Viertel bar. Das Risiko steckt bereits zweimal in der Rechnung, in der Ausfallwahrscheinlichkeit und im Positionslimit.

Renditen in Fremdwährung werden vor dem Vergleich um den Unterschied zwischen der erwarteten Inflation der Berichtswährung und der des Euro gekürzt (`(1 + r) / (1 + Abstand) − 1`). Grundlage ist das Mittel der IWF-Prognosen für die vier Folgejahre. Fehlt die Prognose, bleibt die Rendite unverändert und die Bewertung weist darauf hin.

Überfällige Bewertungen (älter als zwölf Monate) bleiben zulässig, werden aber markiert.

### 7.2 Verfahren

1. Kandidaten absteigend nach innerer Rendite sortieren. Bereits gehaltene Titel erhalten für die Sortierung einen Aufschlag in Höhe der Tauschschwelle.
2. Der Reihe nach jedem Kandidaten das Gewicht `min(Limit, freier Rest, freier Raum in Branche und Region)` zuteilen, mit `Limit = Basislimit · (1 − Risikowert)`.
3. Neue Kandidaten überspringen, deren zuteilbares Gewicht unter der Mindestposition liegt oder die die Regel „höchstens 2 Titel je Branche und Kontinent" verletzen würden. Gehaltene Titel, die Kandidat bleiben, behalten mindestens ihr aktuelles Gewicht.
4. Was übrig bleibt, ist Cash.

### 7.3 Profile

Regeln gelten je Portfolio. Zwei Vorlagen, alle Werte einstellbar:

| Parameter                                  | Fokussiert     | Global          |
| ------------------------------------------ | -------------- | --------------- |
| Basislimit                                 | 15 %           | 6,5 %           |
| Erwartete Positionszahl                    | etwa 6 bis 12  | etwa 20 bis 25  |
| Mindestposition                            | 3 %            | 2 %             |
| Höchstens 2 Titel je Branche und Kontinent | aus            | an              |
| Höchstanteil je Branche                    | –              | 20 %            |
| Höchstanteil je Region                     | –              | 40 %            |
| Tauschschwelle                             | 1 Prozentpunkt | 2 Prozentpunkte |
| Untergrenze                                | Anleiherendite | Anleiherendite  |

### 7.4 Vorschläge zum Ist-Bestand

- Kaufvorschlag: Titel im Zielportfolio, Ist-Gewicht darunter.
- Verkaufsvorschlag: gehaltener Titel ist kein Kandidat mehr, oder er fällt trotz Aufschlag aus dem Zielportfolio.
- Limits gelten zum Kaufzeitpunkt. Eine Position, die durch Kursgewinn über ihr Limit wächst, wird nicht gekürzt.
- Es gibt keine Stop-Loss-Marken. Ein gefallener Kurs erhöht die innere Rendite und führt eher zu einem Nachkaufvorschlag.
- Alle Änderungen sind Vorschläge; nichts wird automatisch umgesetzt.

## 8. Arbeitsablauf

| Auslöser                                         | Was passiert                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Täglich nach Börsenschluss                       | Kurse und Wechselkurse laden, innere Renditen und Zielportfolios neu rechnen, Tagesstand speichern |
| Neue Fundamentaldaten                            | Vorschläge neu rechnen; Hinweis „prüfen“, wenn sie sich seit der Bewertung verschoben haben (8.1)  |
| Bewertung älter als 12 Monate                    | Hinweis „prüfen“ auf Rangliste und Aktienseite; der Titel bleibt zulässig                          |
| Fehlender manueller Faktor oder fehlende Eingabe | Aufgabe „Bewertung unvollständig"                                                                  |

### 8.1 Bewertung prüfen

Der Autor versieht jede Bewertung mit einem Datum und gleicht monatlich ab, ob sich die Zahlen seither verschoben haben:
Bei wenigen Prozent bleibt sie stehen, bei mehr sieht er sich das Unternehmen im Ganzen wieder an (Interview).

- Tag der Bewertung ist der Tag, an dem zuletzt eine Eingabe von Hand gespeichert wurde. Speichern ohne Änderung bestätigt
  die Bewertung mit dem heutigen Datum und hält die Vorschläge dieses Tages als Tagesstand fest.
- Zu prüfen ist eine vollständige Bewertung, wenn sie älter als zwölf Monate ist oder wenn sich die Vorschläge aus den
  Zahlen gegenüber dem Tagesstand vom Tag der Bewertung über die Bandbreite (4.1) hinaus verschoben haben: Rückfluss- oder
  Gewinnniveau um mehr als 10 %, Wachstum um mehr als einen Prozentpunkt, Summe der Risikofaktoren aus Zahlen um mehr als
  fünf Punkte. Auch eine geänderte Rechenregel verschiebt Vorschläge und löst den Hinweis aus.
- Rangliste, Aktienseite und der Zähler in der Navigation zeigen den Hinweis; die Aktienseite nennt, was sich verschoben
  hat. Der Titel bleibt Kandidat.
- Analystenschätzungen gehen nicht ein (Abschnitt 13).

Der tägliche Abgleich läuft mit `mise run sync`. Er holt Kurse ab dem letzten gespeicherten Tag
(höchstens ein Jahr zurück), sodass nach einer Pause keine Lücke bleibt, und richtet sich nach dem
Tagesbudget des Tarifs (Abschnitt 9.1). Auf der Seite „Abgleich“ lässt sich der nächtliche Lauf ausschalten, etwa um das
Tagesbudget für Arbeit an einer lokalen Kopie freizuhalten; von Hand startet er dort weiterhin. Scheitert der Abruf für einen Titel, läuft der Abgleich
weiter und rechnet mit dem letzten bekannten Kurs; die Rangliste zeigt, ob der letzte Lauf
vollständig war. Titel der Watchlist und gehaltene Titel bekommen einen Tagesstand mit Verlauf,
der Datenvorrat nur eine Momentaufnahme für das Screening. Lokal richtet `mise run schedule an`
einen macOS-Dienst ein, der täglich um 23:15 Uhr läuft.

Der tägliche Stand (Annahmen, Risikowert, innere Rendite, Zielportfolio) wird dauerhaft
gespeichert, um die Risikoeinstufung später an der tatsächlichen Entwicklung zu prüfen. Einen
Backtest gibt es nicht.

## 9. Daten

- Fundamentaldaten: EODHD, Tarif „Fundamentals", für einen Monat gebucht. Geladen werden alle verfügbaren Geschäftsjahre; die vollständige Antwort des Anbieters wird je Aktie unverändert aufbewahrt, damit sich weitere Kennzahlen später ohne neuen Abruf gewinnen lassen. Von Hand gepflegt wird nichts.
- Datenvorrat: Neben der Watchlist liegen die Fundamentaldaten der Bestandteile von rund 30 Indizes in der Datenbank (USA mit Russell 1000 und 2000 und NYSE Composite, Europa mit STOXX 600, FTSE All-Share, HDAX, SDAX, CAC All Shares und den nordischen und polnischen Gesamtindizes, dazu Kanada, Australien, Korea, Brasilien und Mexiko). Seit dem 20.11.2026 kommen Taiwan (Taiwan Weighted), China (CSI 300), Thailand (SET) und Indonesien (Jakarta Composite) dazu sowie alle Stammaktien der Börsen in Johannesburg, Kuala Lumpur, Athen, Prag, Budapest, Bukarest, Santiago, Lima und Buenos Aires. Die Börsen in Mailand, Tokio, Hongkong, Tel Aviv und Indien führt der Anbieter nicht (für die Bestandteile von TA-125 und NIFTY 50 gibt es weder Abschlüsse noch Kurse); Mailänder Titel werden über ihre deutsche Notiz geladen, israelische und indische nur über Notizen in den USA oder London. Welche Märkte tatsächlich abgedeckt sind, zeigt die Seite „Abgedeckte Märkte“ im Datenvorrat. Die Rohantworten sind gepackt gespeichert.
- Nach Ablauf des Monats gibt es keine neuen Fundamentaldaten und keine neuen Titel. Die Datenbankdatei ist dann die einzige Kopie. Siehe 9.1.
- Kurse: Tagesschlusskurse von EODHD. Sperrt der Tarif die Kurshistorie (Tarif „Fundamentals"), liefert die Symbolsuche den letzten Schlusskurs; das kostet ebenfalls einen Abruf je Aktie.
- Gewinn je Aktie wird aus Jahresüberschuss und Aktienzahl gerechnet, die Dividende je Aktie aus gezahlter Dividendensumme und Aktienzahl. Die fertigen Felder des Anbieters mischen außerhalb der USA Einheiten. Die so gerechnete Dividende schwankt leicht; ein Rückgang bis 3 % gilt nicht als Kürzung.
- Nicht gemeldete Dividenden, Rückkäufe, Aktienausgaben und aktienbasierte Vergütung zählen als 0. Fehlt die Aktienzahl in der Bilanz eines Jahres, gilt die gemeldete Aktienzahl desselben Jahres (`outstandingShares`), sonst die des nächsten Jahres mit Bilanzangabe, höchstens zwei Jahre entfernt. Fehlen danach Gewinn oder Aktienzahl in einem der zehn Jahre, gibt es keinen Vorschlag.
- Titel mit fünf bis neun Geschäftsjahren werden aus der kürzeren Reihe bewertet und markiert (Abschnitt 5); unter fünf Jahren gibt es keinen Vorschlag.
- Wechselkurse: EZB-Referenzkurse. Währungen, die die EZB nicht führt (Tenge bei Halyk), kommen von open.er-api.com (frei mit Quellenangabe). Portfolios werden in Euro geführt. Die innere Rendite enthält keine Währungsprognose.
- Fundamentaldaten je Aktie und Geschäftsjahr: Gewinn je Aktie, Dividende je Aktie, Aktienzahl, Rückkäufe und Ausgabe von Aktien, aktienbasierte Vergütung, Umsatz, EBIT, Bilanzsumme, Eigenkapital, Umlaufvermögen, kurzfristige Verbindlichkeiten, langfristiges Fremdkapital, Zahlungsmittel, operativer Cashflow, freier Cashflow.
- Stammdaten: Branche, Land und Kontinent des Sitzes, Berichts- und Kurswährung, Gründungsjahr. Im Datenvorrat kommen sie ungeprüft vom Anbieter (das Land ist bei Hinterlegungsscheinen das der Börse). Das Gründungsjahr wird aus dem Beschreibungstext gelesen; fehlt es dort und reichen die Abschlüsse 20 Jahre zurück, gilt die Existenzdauer als erfüllt.
- Kapitalrendite und EBIT-Marge (Faktoren 8 und 9) werden als Durchschnitt der letzten fünf Jahre bewertet.
- Jede Kennzahl kann per CSV eingetragen und korrigiert werden (bereinigte Gewinne, Titel ohne Anbieterdaten).
- Ist-Positionen: manuell, keine Broker-Anbindung.
- Ein Kurs kann je Aktie von Hand eingetragen werden, solange der Anbieter keinen liefert.
- Der Tarif ist ein Privattarif für einen einzelnen Nutzer. Die Daten dürfen lokal gespeichert, aber nicht für andere angezeigt werden.

- Einzelne Titel außerhalb der Indizes werden über ihre ISIN geladen (`pnpm run import:isin`) und kommen auf die Watchlist. Die Positionen der Wikifolios stehen nur angemeldeten Nutzern offen und lassen sich deshalb nicht automatisch abrufen; die Portfolio-Tabelle wird kopiert und als Textdatei übergeben.
- Screening des Datenvorrats: nur Stammaktien. Ausländische Unternehmen in Buenos Aires notieren als CEDEAR, ein Zertifikat mit eigenem Bezugsverhältnis; der Anbieter führt sie als Stammaktie, die Anwendung markiert sie als CEDEAR und lässt sie aus. Ausgeblendet werden Titel, deren Rückfluss über 30 % des Kurses oder deren Kurs unter dem Doppelten des Gewinnniveaus liegt. Die früheren Schwellen (20 % und das Dreifache) trafen, was der Autor als Gelegenheit nennt: Petrobras, Halyk und Stalexport mit rund 20 % Ausschüttung, Höegh Autoliners mit über 25 % und einem Kurs beim Dreifachen des Gewinns. Das fängt Hinterlegungsscheine, deren Zahlen sich auf eine andere Stückelung oder Währung beziehen, trifft aber auch echte Sonderfälle. Dieselbe Prüfung markiert Titel der Watchlist und gehaltene Titel: Die Rangliste stellt sie ans Ende, Aktien- und Portfolioseite nennen den Grund.

- Mit einem Tarif, der Kursdaten enthält, kommen dazu (`pnpm run import:history`, drei Abrufe je Aktie): die Dividendenhistorie je Aktie, Aktiensplits und Monatsschlusskurse seit 1990. Die Bewertung nimmt die Dividenden dann aus der Historie (ohne Sonderzahlungen, nach Kalenderjahr des Ex-Tags), sofern sie zur Rechnung aus gezahlter Summe und Aktienzahl passt (Abstand höchstens Faktor 2). Passt sie nicht und entspricht der Abstand einem Aktiensplit, gelten die Zahlen je Aktie als nicht bereinigt und der Titel wird im Screening ausgeblendet. Die Monatskurse sind für einen späteren Rückblick gespeichert und werden noch nicht ausgewertet.
- Mit großem Tagesbudget holt der Abgleich die Schlusskurse je Börse in einem Sammelabruf (zählt als 100 Abrufe), sobald dort mindestens 150 Titel anstehen.

### 9.1 Betrieb nach der Kündigung des Tarifs

Die Anwendung ist so gebaut, dass sie mit dem kostenlosen Tarif (20 Abrufe am Tag) weiterläuft:

- **Vor der Kündigung:** `pnpm run import:index --auffrischen` lädt alle gespeicherten Titel noch einmal, damit die jüngsten Abschlüsse enthalten sind. Danach die Datenbankdatei sichern.
- **Kurse:** Der tägliche Abgleich fragt das Tagesbudget des Kontos ab und hält zwei Abrufe in Reserve. Reicht es nicht für alle Titel, kommen zuerst gehaltene Aktien, dann die Watchlist, jeweils die mit dem ältesten Kurs zuerst. Der Rest folgt am nächsten Tag; die Rangliste meldet das. Bei 18 Abrufen am Tag sind bis zu 18 Titel täglich aktuell, 36 Titel jeden zweiten Tag.
- **Splits:** Für beobachtete Titel mit manuellem Rückflussniveau holt der Abgleich aus dem verbleibenden Budget die Splits (ein Abruf je Titel). Ein Rückflussniveau, das vor einem Split gesetzt wurde, wird durch dessen Verhältnis geteilt; die Aktienseite nennt die Bereinigung.
- **Datenvorrat:** Er bekommt nur Kurse, wenn das Budget über 500 Abrufen liegt, also in einem bezahlten Tarif. Danach altern seine Kurse; das Screening zeigt das Kursdatum. Für einen einzelnen Titel lässt sich der Kurs von Hand eintragen oder der Titel auf die Watchlist nehmen.
- **Neue Geschäftsjahre:** einmal im Jahr den Tarif für einen Monat buchen und auffrischen, oder die Zahlen einzelner Titel per CSV eintragen (`pnpm run import:fundamentals`). Die Bewertung meldet, wenn der letzte Abschluss älter als zwei Jahre ist.
- **Neue Titel**, die nicht im Datenvorrat liegen, brauchen den bezahlten Tarif oder die CSV-Eingabe.
- **Mehr als etwa 20 Titel mit täglichem Kurs:** Tarif „EOD Historical Data" für rund 20 € im Monat (100.000 Abrufe am Tag).

## 10. Anwendung

- Nutzer: feste Liste erlaubter E-Mail-Adressen, Anmeldung über einen Identitätsanbieter, keine eigene Passwortverwaltung.
- Bewertungen (Annahmen, Risikofaktoren) sind für alle Nutzer gemeinsam. Portfolios gehören einem Nutzer; jeder kann mehrere führen.
- Technik: Next.js und TypeScript, SQLite, ein Container; zuerst lokal, später auf einem kleinen Server.
- Das Rechenmodul (innere Rendite, Vorschläge, Risikowert, Zielportfolio) ist ein eigenes Modul ohne Datenbank- und Netzwerkzugriff.
- Die Oberfläche tritt als eigene Strategie „Rückflussrendite" auf (Name in `src/app/brand.ts`). Die Seite „Strategie" erklärt die Regeln in eigenen Worten, nennt die Herkunft und die eigenen Abweichungen und zieht alle Zahlen aus den Parametern des Rechenmoduls.
- Jede Seite nennt oben ihren Befund in einem Satz und bietet den häufigsten nächsten Schritt als Knopf an (Rangliste: den aussichtsreichsten unvollständig bewerteten Titel bewerten). Auf der Aktienseite stehen die Urteilsfaktoren zuerst, die Faktoren aus Zahlen sind eingeklappt. Für einen gehaltenen, unvollständig bewerteten Titel gibt es keinen Verkaufsvorschlag, sondern den Hinweis „erst bewerten".
- Oberfläche auf Deutsch mit den Begriffen aus Abschnitt 3 und einem festen Hinweis, dass die Seite keine Anlageberatung ist.

Seiten:

| Seite         | Inhalt                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rangliste     | Watchlist nach innerer Rendite, mit Risikoklasse, Limit und Status der Bewertung                                                                                                                                            |
| Aktie         | Eingaben mit Vorschlag und Übersteuerung, Risikoraster, innere Rendite bei alternativen Kursen, Zehnjahresreihen                                                                                                            |
| Portfolio     | Ist gegen Ziel, Kauf- und Verkaufsvorschläge, innere Rendite von Bestand und Ziel im Schnitt (nach Wert gewichtet, ohne Bargeld), Verteilung nach Branche und Region; Bestand als Stückzahl je Aktie und Barbestand in Euro |
| Datenvorrat   | Alle gespeicherten Titel nach vorläufiger innerer Rendite, mit Filter und Suche; Aufnahme in die Watchlist                                                                                                                  |
| Aufgaben      | keine eigene Seite: unvollständige und zu prüfende Bewertungen stehen in der Rangliste und im Zähler der Navigation                                                                                                         |
| Strategie     | Regeln, Risikoraster, Profile, Grenzen und Herkunft                                                                                                                                                                         |
| Einstellungen | Profile und alle Parameter aus Abschnitt 12                                                                                                                                                                                 |

Start-Watchlist: Imperial Brands, Charter Communications, Halyk Savings Bank, 3i Group,
Universal Health Services, BASF.

Reihenfolge der Umsetzung: Rechenmodul mit Tests, Datenanbindung, Oberfläche.

## 11. Abnahmetests für das Rechenmodul

| Fall                                              | Eingaben                                                                   | Erwartet                                                       | Toleranz            |
| ------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------- |
| Imperial Brands, Kurs 30,00 GBP (Folie 7)         | R0 = 3,09 (1,59 + 1,50), g0 = 2,3 %, p = 1,8 %                             | 10,6 % (Modell: 10,57 %)                                       | ± 0,2 Prozentpunkte |
| Imperial Brands, Kurs 25,00 GBP (Folie 7)         | wie oben                                                                   | 12,7 % (Modell: 12,60 %)                                       | ± 0,2 Prozentpunkte |
| BASF, Wachstum (Buch Kap. 5.2)                    | Gewinn je Aktie 2002 bis 2011                                              | 15,5 %                                                         | ± 0,1 Prozentpunkte |
| BASF, Gewinnniveau aus 10 Jahren                  | wie oben                                                                   | 5,42 EUR (Modell: 5,415)                                       | ± 0,01              |
| BASF, Gewinnniveau aus 5 Jahren                   | wie oben                                                                   | 5,38 EUR                                                       | ± 0,01              |
| Wal-Mart, Gewinnniveau aus 10 Jahren              | Gewinn je Aktie 2002/03 bis 2011/12                                        | 4,60 USD (Modell: 4,58)                                        | ± 0,05              |
| Positionslimit                                    | Basislimit 12,5 %, Risikowert 40 %                                         | 7,5 %                                                          | exakt               |
| Deckelung Rückfluss                               | Dividendenniveau 2,00, Netto-Rückkäufe 3,00, freier Cashflow je Aktie 4,00 | R0 = 4,00                                                      | exakt               |
| Obergrenze Wachstum                               | historisch 7 %, R0 = 3,00, Gewinnniveau 4,00, Eigenkapital je Aktie 20,00  | g0 = 7 % (Grenze: 0,25 · 20 % + 2 % = 7 %)                     | exakt               |
| Obergrenze Wachstum bei Vollausschüttung          | historisch 7 %, R0 = 4,00, Gewinnniveau 4,00                               | g0 = 2 %                                                       | exakt               |
| Ausschüttungsquote am Ende, teilweise angerechnet | R0 = 2,00, Gewinnniveau 10,00, g0 = 8,5 %                                  | 76,9 % (Rendite des Einbehaltenen 8,125 %, Anrechnung 81,25 %) | ± 0,1 Prozentpunkte |
| Ausschüttungsquote am Ende, voll angerechnet      | R0 = 4,00, Gewinnniveau 10,00, g0 = 8,5 %                                  | 90 %                                                           | exakt               |
| Wertfalle                                         | R0 = 2,00, Gewinnniveau 10,00, g0 = 2 %                                    | Quote bleibt 20 %, Rendite wie ohne Gewinnniveau               | exakt               |
| Bandbreite                                        | Imperial Brands, Kurs 30,00 GBP                                            | vorsichtig < Basis < optimistisch                              | –                   |

Die Folienwerte lassen sich nicht exakt treffen, weil die Zahlungskonvention des Autors nicht
veröffentlicht ist. Die Wal-Mart-Abweichung stammt aus gerundeten Tabellenwerten im Buch.

## 12. Eigene Annahmen (nicht aus den Quellen)

| Annahme                                                                         | Wert                                                                                                                      | Grund                                                                                     |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Zuordnung Risikowert zu Ausfallwahrscheinlichkeit                               | 0,5 % + 5 % · Risikowert                                                                                                  | Quellen nennen keine Zahl; Imperial Brands (1,8 %) läge bei 26 % Risikowert               |
| Zahlungskonvention                                                              | Rückflussniveau gilt für das kommende Jahr, Wachstum ab dem zweiten Jahr                                                  | trifft Folie 7 auf 0,1 Prozentpunkte                                                      |
| Abschmelzen des Wachstums                                                       | linear über 15 Jahre auf höchstens 3 %                                                                                    | Buch: höchstens 15 Jahre überdurchschnittliches Wachstum; einfache DCF-Formel nur bis 3 % |
| Steigende Ausschüttungsquote                                                    | linear über 15 Jahre bis auf den Bedarf des Dauerwachstums, angerechnet nach der Rendite des Einbehaltenen (voll ab 10 %) | Interview nennt das Prinzip (zwei Phasen), keine Zahlen; 10 % nach Buch Kap. 5.5          |
| Untergrenze der inneren Rendite                                                 | Anleiherendite ohne Aufschlag, Basisfall                                                                                  | Interview: kein Renditeziel, aber Aktien müssen Anleihen schlagen                         |
| Obergrenze für den Wachstumsvorschlag                                           | 8,5 %                                                                                                                     | Buch setzt bei BASF und Wal-Mart 8,5 % statt der historischen Werte an                    |
| Untergrenze für den Wachstumsvorschlag bei schrumpfendem Gewinn                 | −5 %                                                                                                                      | Buch rechnet nur wachsende Titel; ein dauerhafter Rückgang über 5 % ist kein Dauerzustand |
| Wachstumsvorschlag bei nicht bestimmbarem Gewinnwachstum                        | Umsatzwachstum je Aktie, −5 % bis 3 %; bei Verlusten am Ende der Reihe höchstens 0 %                                      | sonst bliebe gut ein Drittel der Titel ohne Rendite; 3 % ist das Endwachstum              |
| Tragbarer Rückfluss bei Immobilienwerten                                        | operativer Cashflow statt freier Cashflow, Fünfjahresdurchschnitt                                                         | Objektkäufe gelten beim Anbieter als Investition; Näherung für FFO                        |
| Lücken in der Aktienzahl                                                        | gemeldete Aktienzahl desselben Jahres, sonst Nachbarjahr bis zwei Jahre                                                   | eine einzelne Lücke sperrt sonst die ganze Zehnjahresreihe                                |
| Netto-Rückkäufe als Fünfjahresdurchschnitt, abzüglich aktienbasierter Vergütung | –                                                                                                                         | Folien zählen Rückkäufe als Rückfluss, ohne Methode                                       |
| Deckelung des Rückflussniveaus auf den freien Cashflow je Aktie                 | Fünfjahresdurchschnitt                                                                                                    | schuldenfinanzierte Rückkäufe sind nicht dauerhaft tragbar                                |
| Obergrenze Wachstum aus Einbehaltung                                            | Einbehaltungsquote · Eigenkapitalrendite + 2 %                                                                            | hohe Ausschüttung und hohes Wachstum schließen sich aus                                   |
| Bandbreite                                                                      | ± 10 % Rückfluss, ± 1 Prozentpunkt Wachstum                                                                               | macht die Unsicherheit der Annahmen sichtbar                                              |
| Rückkäufe gelten in Faktor 12 wie Dividenden                                    | –                                                                                                                         | Folgerung aus den Folien                                                                  |
| Vorschlagsregeln in Abschnitt 6.2                                               | –                                                                                                                         | Buch gibt Höchstabzüge und Beispiele, keine vollständigen Stufen                          |
| Einmaleffekte in Faktor 1                                                       | Bestätigung durch das EBIT, Schwelle 30 %; Vergleich mit dem Median der drei Vorjahre                                     | Ersatz für die bereinigten Gewinne des Buchs                                              |
| Nachlass in Faktor 2 für stetige Gewinne                                        | 70 % bzw. 40 % des Abzugs                                                                                                 | Buch nennt das Prinzip und ein Beispiel (Wal-Mart), keine Stufen                          |
| Größe gemessen an der Bilanzsumme                                               | 20 Mio. € bis 20 Mrd. €                                                                                                   | Auslegung von „GK" in Abb. 32 als Gesamtkapital                                           |
| Basislimits der Profile                                                         | 15 % und 6,5 %                                                                                                            | Buch nennt 12,5 % und 15 %; Wikifolios nennen nur Positionszahlen                         |
| Höchstanteil je Region                                                          | 40 %                                                                                                                      | Buch nennt nur „ausgewogen"                                                               |
| Tauschschwelle                                                                  | 1 und 2 Prozentpunkte                                                                                                     | Übersetzung der Buchregel „kein Tausch wegen 5 bis 10 %"                                  |
| Mindestposition                                                                 | 3 % und 2 %                                                                                                               | Buch nennt einen Mindestanteil ohne Zahl                                                  |
| Überfällige Bewertungen bleiben zulässig                                        | –                                                                                                                         | Buch verlangt die jährliche Prüfung, nennt keine Folge                                    |
| Schwellen für „Bewertung prüfen“                                                | Bandbreite aus 4.1, beim Risiko aus Zahlen fünf Punkte                                                                    | Interview nennt „plus minus wenige Prozent“, keine Zahl                                   |
| Mindesthistorie                                                                 | fünf Geschäftsjahre                                                                                                       | Buch verlangt zehn; der Autor hält jüngere Börsenwerte                                    |
| Schwellen der Plausibilitätsprüfung                                             | Rückfluss über 30 % des Kurses, Kurs unter dem Doppelten des Gewinnniveaus                                                | im Datenvorrat liegen darüber fast nur Vorzugspapiere und Hinterlegungsscheine            |
| Stufen der Urteilsfaktoren für Jev                                              | Abschnitt 6.4                                                                                                             | Buch nennt nur Höchstabzug und Anforderung; geeicht an seinen Beispielen                  |

## 13. Offen

- **Lizenz für mehrere Nutzer:** Die Privattarife der Datenanbieter erlauben keine Anzeige für andere Nutzer. Vor dem Freischalten weiterer Nutzer mit EODHD klären.
- **Halyk Savings Bank:** Die Zahlen des Anbieters sind je Hinterlegungsschein und passen damit zum Londoner Kurs. Das ist aus der Aktienzahl geschlossen, nicht am Geschäftsbericht geprüft.
- **Gezahlte Dividenden bei Sonderfällen:** Das Feld des Anbieters enthält bei einzelnen Titeln Ausschüttungen an Minderheiten (Charter 2016 und 2020).
- **Kalibrierung der Ausfallwahrscheinlichkeit** an historischen Ausfallraten nach Bonitätsklasse.
- **Steuern beim Tausch:** Abgeltungsteuer auf realisierte Gewinne in der Tauschschwelle berücksichtigen.
- **Treffsicherheit von Jev:** Vorschläge an Titeln prüfen, deren späterer Verlauf bekannt ist; die Sicherheit laut Jev ist nicht an echten Ergebnissen geeicht.
- **Basislimits gegen die Wikifolios:** Die Folien (Stand 23.11.26) zeigen im globalen Depot drei Positionen über dem Basislimit von 6,5 % (Comcast 8,7 %, Charter 8,3 %, Universal Health 7,8 %) und im fokussierten Charter mit 15,8 %. Mit dem Buchwert von 12,5 % träfe das Limit Comcast und Charter fast genau. Der Autor füllt aber nur die oberen Positionen auf; unser Verfahren füllt jede bis zum Limit und käme dann auf halb so viele Titel.
- **Wachstum aus dem Umsatz:** Bei nicht bestimmbarem Gewinnwachstum (Sandisk, Höegh Autoliners, Safe Bulkers) kommt der Vorschlag aus dem Umsatz, höchstens 3 %. Offen ist, ob Zykliker damit zu günstig oder zu streng wegkommen; ein über den Zyklus gemitteltes Rückflussniveau wäre genauer.
- **Zykliker im Risikoraster:** Safe Bulkers kommt allein aus Zahlen auf 68 % und fiele mit jedem Abzug im Urteil über 75 %; der Autor hält den Titel.
- **Unternehmen ohne Ausschüttung:** Der Autor bewertet sie über den Gewinn und eine spätere Ausschüttung; bei Rückfluss 0 rechnet die Anwendung keine Rendite.
- **Analystenschätzungen:** Der Autor stützt Niveau und monatlichen Abgleich auf Schätzungen; die Anwendung rechnet nur aus Abschlüssen.
- **Vergleichsmaßstab:** Abstand der inneren Rendite zur Anleiherendite und zu einem Weltindex anzeigen.

## 14. Nicht in Version 1

Steuern (Quellensteuer, Abgeltungsteuer), Transaktionskosten, Screening über den Gesamtmarkt,
Broker-Anbindung, Backtest, maximaler Kaufpreis nach Buchmethode, Währungsprognosen.
