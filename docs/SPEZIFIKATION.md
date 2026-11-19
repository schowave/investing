# Spezifikation: Yield-Investing-Werkzeug

Stand: 19.11.2026. Status: abgestimmt.

## 1. Zweck

Privates Entscheidungswerkzeug für eine Handvoll bekannter Nutzer. Es bewertet Aktien einer
gepflegten Watchlist nach ihrer inneren Rendite, stuft ihr Risiko ein, leitet daraus ein
Zielportfolio ab und zeigt die Abweichung zum tatsächlichen Bestand.

Die Anwendung führt keine Orders aus und gibt keine öffentlichen Empfehlungen. Sie ist keine
Anlageberatung; alle Bewertungen beruhen auf den Annahmen der Nutzer.

## 2. Quellen und ihr Gewicht

| Quelle | Inhalt | Verwendung |
|---|---|---|
| Folien „Yield Investing" (15.11.2026) | Innere Rendite per invertiertem DCF, Ausfallwahrscheinlichkeit, Ranking, Beispiel Imperial Brands | Maßgeblich für Kennzahl und Auswahl |
| Buch, Stefan Meißner, „Langfristige Vermögensvermehrung mit wertorientierten Investments" (PDF, Stand 2012), Kap. 5 und 6 | Gewinn- und Dividendenniveau, Wachstum, Risikoraster, Positionslimit, Streuung, Umschichtung | Maßgeblich für Eingaben, Risiko und Portfolio-Regeln |
| Wikifolio-Handelsideen (FocusedYieldInvesting, Global Yield Investing) | Zwei Portfolio-Profile, Risiko bestimmt Abschlag und Positionsgröße | Bestätigung, Grundlage der Profile |

Wo die Quellen keine Zahl nennen, steht eine eigene Annahme. Alle eigenen Annahmen sind in
Abschnitt 12 gesammelt und in der Anwendung als Einstellungen änderbar.

Nicht übernommen wird die Buchmethode „innerer Wert minus Sicherheitsmarge = maximaler
Kaufpreis". Die Folien ersetzen sie durch die innere Rendite.

## 3. Begriffe

| Begriff | Bedeutung |
|---|---|
| Rückflussniveau `R0` | Für das kommende Jahr erwartete Rückflüsse je Aktie: Dividendenniveau plus Netto-Aktienrückkäufe je Aktie |
| Wachstum `g0` | Erwartetes jährliches Wachstum der Rückflüsse je Aktie zu Beginn |
| Dauerwachstum `g∞` | Wachstum nach der Abschmelzphase, höchstens 3 % |
| Risikowert | Summe der Abzüge aus dem Risikoraster, 0 % (Top-Rating) bis über 100 % |
| Ausfallwahrscheinlichkeit `p` | Jährliche Wahrscheinlichkeit, dass alle künftigen Rückflüsse entfallen; aus dem Risikowert abgeleitet |
| Innere Rendite `r` | Zinssatz, bei dem der Barwert der erwarteten Rückflüsse dem aktuellen Kurs entspricht |
| Gewinnniveau | Um Konjunktur und Einmaleffekte geglätteter Gewinn je Aktie |
| Region | Kontinent des Unternehmenssitzes; Japan wird beim Risikofaktor Land wie Europa und Nordamerika behandelt |
| Bewertung | Der Satz aus Annahmen und Risikofaktoren zu einer Aktie, mit Datum der letzten Prüfung |

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
sichtbar ist, ab welchem Kurs ein Titel die Mindestrendite erreicht.

### 4.1 Bandbreite

Jede Aktie wird in drei Fällen gerechnet. Rangfolge, Mindestrendite und Zielportfolio
verwenden den Basisfall; die Rangliste zeigt zusätzlich die Spanne.

| Fall | Rückflussniveau | Wachstum |
|---|---|---|
| vorsichtig | `R0 · 0,9` | `g0 − 1 Prozentpunkt`, mindestens 0 % |
| Basis | `R0` | `g0` |
| optimistisch | `R0 · 1,1` | `g0 + 1 Prozentpunkt` |

Die Abstände sind Standardwerte und je Aktie übersteuerbar. Die Ausfallwahrscheinlichkeit ist
in allen drei Fällen gleich.

### 4.2 Warnungen ohne Sperrwirkung

- Manuell gesetztes Rückflussniveau liegt über dem Gewinnniveau oder über dem freien Cashflow je Aktie (nicht dauerhaft tragbar).
- Manuell gesetztes `g0` liegt über 8,5 % oder über der Obergrenze aus Einbehaltung (Abschnitt 5).

## 5. Eingaben: Vorschlag und Übersteuerung

Jede Eingabe hat einen automatischen Vorschlag und einen optionalen manuellen Wert. Es gilt
der manuelle Wert, wenn er gesetzt ist; die Oberfläche zeigt immer, welcher gilt. Neue
Fundamentaldaten ändern nur den Vorschlag und erzeugen einen Hinweis, sie überschreiben nie
einen manuellen Wert.

Grundlage sind zehn Geschäftsjahre je Aktie (Buch Kap. 5.2).

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
fünf Jahre. Bei Banken und Versicherern stattdessen das Gewinnniveau.

**Rückflussniveau `R0`:** Dividendenniveau plus Netto-Rückkäufe je Aktie, höchstens der
tragbare Rückfluss. Rückkäufe, die nicht aus freiem Cashflow gedeckt sind, zählen damit
nicht. Greift die Deckelung, zeigt die Oberfläche das an.

**Wachstum `g0`:** der kleinste dieser vier Werte, mindestens 0 %:
- Wachstum des Gewinns je Aktie nach obiger Formel,
- Wachstum des Umsatzes je Aktie nach derselben Formel (entfällt, wenn nicht bestimmbar),
- 8,5 %,
- `Einbehaltungsquote · Eigenkapitalrendite + 2 %`, mit
  `Einbehaltungsquote = max(0, 1 − R0 / Gewinnniveau)` und
  `Eigenkapitalrendite = Gewinnniveau / Eigenkapital je Aktie`. Die 2 % stehen für
  Preissteigerungen ohne zusätzliches Kapital.

Bei negativem Eigenkapital entfällt die dritte Grenze, die Oberfläche weist darauf hin. Ist
das historische Wachstum negativ oder nicht bestimmbar, gibt es keinen Vorschlag; der Wert
muss manuell gesetzt werden.

## 6. Risikobewertung

### 6.1 Raster (Buch Kap. 5.8, Abb. 32)

Start beim Top-Rating (0 %). Je Faktor wird ein Abzug zwischen 0 und dem Höchstwert
vergeben, bei einigen Faktoren ein Bonus. Der Risikowert ist die Summe, mindestens 0 %.

| # | Faktor | Anforderung | Höchstabzug | Bonus | Herkunft |
|---|---|---|---|---|---|
| 1 | Gewinn- und Umsatzentwicklung | weitgehend konstant, keine starken Einbrüche | 50 % | 10 % | Vorschlag |
| 2 | Finanzierung | EK-Quote > 50 %, kurzfr. Verbindlichkeiten < Umlaufvermögen, langfr. Fremdkapital ≤ 3 × operativer Cashflow | 50 % | – | Vorschlag (Finanzwerte: manuell) |
| 3 | Größe | Bilanzsumme > 20 Mrd. € | 40 % | – | Vorschlag |
| 4 | Existenzdauer | über 20 Jahre | 30 % | – | Vorschlag |
| 5 | Branche | nicht subventioniert, nicht schnelllebig, verstanden | 25 % | – | manuell |
| 6 | Land | Sitz in Europa, Nordamerika oder Japan | 25 % | – | Vorschlag |
| 7 | Wettbewerbsvorteile | mindestens durchschnittlich | 20 % | 20 % | manuell |
| 8 | Rendite auf eingesetztes Kapital | > 10 % | 15 % | 5 % | Vorschlag (Finanzwerte: manuell) |
| 9 | EBIT-Marge | > 10 % | 15 % | 5 % | Vorschlag (Finanzwerte: manuell) |
| 10 | Management | keine Hinweise auf schlechtes oder korruptes Management | 100 % | 10 % | manuell |
| 11 | Zuverlässigkeit der Prognosen | weitgehend zuverlässig | 40 % | – | manuell |
| 12 | Free Cashflow und Ausschüttung | erzielt freien Cashflow, schüttet verlässlich aus | 25 % | – | Vorschlag |
| 13 | Abhängigkeiten | keine von einem Rohstoff, Lieferanten oder Kunden | 20 % | – | manuell |
| 14 | Währung | EUR, USD, CHF, GBP, JPY | 10 % | – | Vorschlag |
| 15 | Aktuelle Situation | keine Krise | 30 % | – | manuell |

Regeln:
- Manuelle Faktoren haben keinen Standardwert. Solange einer fehlt, gilt die Bewertung als unvollständig und die Aktie kommt nicht ins Zielportfolio.
- Bei Banken und Versicherern gibt es für die Faktoren 2, 8 und 9 keinen Vorschlag; sie müssen manuell gesetzt werden.
- Auch Vorschlagsfaktoren können manuell übersteuert werden.

### 6.2 Vorschlagsregeln für die Zahlenfaktoren

Zwischen den Stützpunkten wird linear interpoliert.

| # | Regel |
|---|---|
| 1 | Zehn Jahre Gewinn je Aktie: 3 oder mehr Verlustjahre 50 %; 1 bis 2 Verlustjahre 25 %; kein Verlust, aber ein Rückgang um mehr als 50 % in einem Jahr 12,5 %; jedes Jahr gestiegen Bonus 10 %; sonst 0 % |
| 2 | 1 Prozentpunkt Abzug je fehlendem Prozentpunkt EK-Quote unter 50 % (unter 40 %, wenn Faktor 1 den Bonus erhält); plus 10 %, wenn kurzfr. Verbindlichkeiten > Umlaufvermögen; plus 10 %, wenn langfr. Fremdkapital > 3 × operativer Cashflow; höchstens 50 % |
| 3 | Bilanzsumme ≥ 20 Mrd. € 0 %; ≤ 20 Mio. € 40 %; dazwischen linear im Logarithmus (2 Mrd. € ergeben rund 13 %) |
| 4 | ≥ 20 Jahre 0 %; ≤ 3 Jahre 30 % |
| 6 | Sitz in Europa, Nordamerika, Japan 0 %; sonst 12,5 % als Ausgangswert zur manuellen Anpassung |
| 8 | ≥ 10 % 0 %; ≤ 5 % 15 %; ≥ 20 % Bonus 5 % (EBIT / (Bilanzsumme − Zahlungsmittel)) |
| 9 | ≥ 10 % 0 %; ≤ 5 % 15 %; ≥ 20 % Bonus 5 % |
| 12 | Freier Cashflow in mindestens 8 von 10 Jahren positiv und Ausschüttung (Dividende oder Netto-Rückkäufe) ohne Kürzung 0 %; mit Dividendenkürzung in den letzten 10 Jahren 5 %; weder freier Cashflow noch Ausschüttung 25 %; alle übrigen Fälle 12,5 % |
| 14 | Berichtswährung EUR, USD, CHF, GBP, JPY 0 %; sonst 10 % |

### 6.3 Klassen und Ausfallwahrscheinlichkeit

| Risikowert | Klasse | Folge |
|---|---|---|
| 0 bis 20 % | hervorragend | |
| über 20 bis 50 % | durchschnittlich | |
| über 50 bis unter 75 % | riskant | |
| ab 75 % | Spekulation | ausgeschlossen |

`p = 0,5 % + 5 % · Risikowert` pro Jahr (Risikowert 0 % ergibt 0,5 %, 26 % ergeben 1,8 %,
50 % ergeben 3,0 %). Die Zuordnung ist linear und einstellbar.

## 7. Zielportfolio

### 7.1 Zulässige Kandidaten

Eine Aktie ist Kandidat, wenn alle Punkte gelten:
- Bewertung vollständig (alle Eingaben und alle 15 Risikofaktoren gesetzt),
- Risikowert unter 75 %,
- innere Rendite mindestens die Mindestrendite des Portfolios (Standard 8,5 %).

Überfällige Bewertungen (älter als zwölf Monate) bleiben zulässig, werden aber markiert.

### 7.2 Verfahren

1. Kandidaten absteigend nach innerer Rendite sortieren. Bereits gehaltene Titel erhalten für die Sortierung einen Aufschlag in Höhe der Tauschschwelle.
2. Der Reihe nach jedem Kandidaten das Gewicht `min(Limit, freier Rest, freier Raum in Branche und Region)` zuteilen, mit `Limit = Basislimit · (1 − Risikowert)`.
3. Neue Kandidaten überspringen, deren zuteilbares Gewicht unter der Mindestposition liegt oder die die Regel „höchstens 2 Titel je Branche und Kontinent" verletzen würden. Gehaltene Titel, die Kandidat bleiben, behalten mindestens ihr aktuelles Gewicht.
4. Was übrig bleibt, ist Cash.

### 7.3 Profile

Regeln gelten je Portfolio. Zwei Vorlagen, alle Werte einstellbar:

| Parameter | Fokussiert | Global |
|---|---|---|
| Basislimit | 15 % | 6,5 % |
| Erwartete Positionszahl | etwa 6 bis 12 | etwa 20 bis 25 |
| Mindestposition | 3 % | 2 % |
| Höchstens 2 Titel je Branche und Kontinent | aus | an |
| Höchstanteil je Branche | – | 20 % |
| Höchstanteil je Region | – | 40 % |
| Tauschschwelle | 1 Prozentpunkt | 2 Prozentpunkte |
| Mindestrendite | 8,5 % | 8,5 % |

### 7.4 Vorschläge zum Ist-Bestand

- Kaufvorschlag: Titel im Zielportfolio, Ist-Gewicht darunter.
- Verkaufsvorschlag: gehaltener Titel ist kein Kandidat mehr, oder er fällt trotz Aufschlag aus dem Zielportfolio.
- Limits gelten zum Kaufzeitpunkt. Eine Position, die durch Kursgewinn über ihr Limit wächst, wird nicht gekürzt.
- Es gibt keine Stop-Loss-Marken. Ein gefallener Kurs erhöht die innere Rendite und führt eher zu einem Nachkaufvorschlag.
- Alle Änderungen sind Vorschläge; nichts wird automatisch umgesetzt.

## 8. Arbeitsablauf

| Auslöser | Was passiert |
|---|---|
| Täglich nach Börsenschluss | Kurse und Wechselkurse laden, innere Renditen und Zielportfolios neu rechnen, Tagesstand speichern |
| Neue Fundamentaldaten | Vorschläge neu rechnen; Hinweis „Vorschlag hat sich geändert" bei abweichendem Vorschlag |
| Bewertung älter als 12 Monate | Aufgabe „Bewertung überfällig" |
| Fehlender manueller Faktor oder fehlende Eingabe | Aufgabe „Bewertung unvollständig" |

Der tägliche Abgleich läuft mit `npm run sync`. Er holt Kurse ab dem letzten gespeicherten Tag
(höchstens ein Jahr zurück), sodass nach einer Pause keine Lücke bleibt, und richtet sich nach dem
Tagesbudget des Tarifs (Abschnitt 9.1). Scheitert der Abruf für einen Titel, läuft der Abgleich
weiter und rechnet mit dem letzten bekannten Kurs; die Rangliste zeigt, ob der letzte Lauf
vollständig war. Titel der Watchlist und gehaltene Titel bekommen einen Tagesstand mit Verlauf,
der Datenvorrat nur eine Momentaufnahme für das Screening. Lokal richtet `npm run schedule -- an`
einen macOS-Dienst ein, der täglich um 23:15 Uhr läuft.

Der tägliche Stand (Annahmen, Risikowert, innere Rendite, Zielportfolio) wird dauerhaft
gespeichert, um die Risikoeinstufung später an der tatsächlichen Entwicklung zu prüfen. Einen
Backtest gibt es nicht.

## 9. Daten

- Fundamentaldaten: EODHD, Tarif „Fundamentals", für einen Monat gebucht. Geladen werden alle verfügbaren Geschäftsjahre; die vollständige Antwort des Anbieters wird je Aktie unverändert aufbewahrt, damit sich weitere Kennzahlen später ohne neuen Abruf gewinnen lassen. Von Hand gepflegt wird nichts.
- Datenvorrat: Neben der Watchlist liegen die Fundamentaldaten der Bestandteile von rund 30 Indizes in der Datenbank (USA mit Russell 1000 und 2000 und NYSE Composite, Europa mit STOXX 600, FTSE All-Share, HDAX, SDAX, CAC All Shares und den nordischen und polnischen Gesamtindizes, dazu Kanada, Australien, Korea, Brasilien, Mexiko, Israel). Die Börsen in Mailand, Tokio und Hongkong führt der Anbieter nicht; Mailänder Titel werden über ihre deutsche Notiz geladen. Die Rohantworten sind gepackt gespeichert.
- Nach Ablauf des Monats gibt es keine neuen Fundamentaldaten und keine neuen Titel. Die Datenbankdatei ist dann die einzige Kopie. Siehe 9.1.
- Kurse: Tagesschlusskurse von EODHD. Sperrt der Tarif die Kurshistorie (Tarif „Fundamentals"), liefert die Symbolsuche den letzten Schlusskurs; das kostet ebenfalls einen Abruf je Aktie.
- Gewinn je Aktie wird aus Jahresüberschuss und Aktienzahl gerechnet, die Dividende je Aktie aus gezahlter Dividendensumme und Aktienzahl. Die fertigen Felder des Anbieters mischen außerhalb der USA Einheiten. Die so gerechnete Dividende schwankt leicht; ein Rückgang bis 3 % gilt nicht als Kürzung.
- Nicht gemeldete Dividenden, Rückkäufe, Aktienausgaben und aktienbasierte Vergütung zählen als 0. Fehlen Gewinn oder Aktienzahl in einem der zehn Jahre, gibt es keinen Vorschlag.
- Titel mit weniger als zehn Geschäftsjahren werden markiert und nicht stillschweigend bewertet.
- Wechselkurse: EZB-Referenzkurse. Währungen, die die EZB nicht führt (Tenge bei Halyk), kommen von open.er-api.com (frei mit Quellenangabe). Portfolios werden in Euro geführt. Die innere Rendite enthält keine Währungsprognose.
- Fundamentaldaten je Aktie und Geschäftsjahr: Gewinn je Aktie, Dividende je Aktie, Aktienzahl, Rückkäufe und Ausgabe von Aktien, aktienbasierte Vergütung, Umsatz, EBIT, Bilanzsumme, Eigenkapital, Umlaufvermögen, kurzfristige Verbindlichkeiten, langfristiges Fremdkapital, Zahlungsmittel, operativer Cashflow, freier Cashflow.
- Stammdaten: Branche, Land und Kontinent des Sitzes, Berichts- und Kurswährung, Gründungsjahr. Im Datenvorrat kommen sie ungeprüft vom Anbieter (das Land ist bei Hinterlegungsscheinen das der Börse). Das Gründungsjahr wird aus dem Beschreibungstext gelesen; fehlt es dort und reichen die Abschlüsse 20 Jahre zurück, gilt die Existenzdauer als erfüllt.
- Kapitalrendite und EBIT-Marge (Faktoren 8 und 9) werden als Durchschnitt der letzten fünf Jahre bewertet.
- Jede Kennzahl kann per CSV eingetragen und korrigiert werden (bereinigte Gewinne, Titel ohne Anbieterdaten).
- Ist-Positionen: manuell, keine Broker-Anbindung.
- Ein Kurs kann je Aktie von Hand eingetragen werden, solange der Anbieter keinen liefert.
- Der Tarif ist ein Privattarif für einen einzelnen Nutzer. Die Daten dürfen lokal gespeichert, aber nicht für andere angezeigt werden.

### 9.1 Betrieb nach der Kündigung des Tarifs

Die Anwendung ist so gebaut, dass sie mit dem kostenlosen Tarif (20 Abrufe am Tag) weiterläuft:

- **Vor der Kündigung:** `npm run import:index -- --auffrischen` lädt alle gespeicherten Titel noch einmal, damit die jüngsten Abschlüsse enthalten sind. Danach die Datenbankdatei sichern.
- **Kurse:** Der tägliche Abgleich fragt das Tagesbudget des Kontos ab und hält zwei Abrufe in Reserve. Reicht es nicht für alle Titel, kommen zuerst gehaltene Aktien, dann die Watchlist, jeweils die mit dem ältesten Kurs zuerst. Der Rest folgt am nächsten Tag; die Rangliste meldet das. Bei 18 Abrufen am Tag sind bis zu 18 Titel täglich aktuell, 36 Titel jeden zweiten Tag.
- **Datenvorrat:** Er bekommt nur Kurse, wenn das Budget über 500 Abrufen liegt, also in einem bezahlten Tarif. Danach altern seine Kurse; das Screening zeigt das Kursdatum. Für einen einzelnen Titel lässt sich der Kurs von Hand eintragen oder der Titel auf die Watchlist nehmen.
- **Neue Geschäftsjahre:** einmal im Jahr den Tarif für einen Monat buchen und auffrischen, oder die Zahlen einzelner Titel per CSV eintragen (`npm run import:fundamentals`). Die Bewertung meldet, wenn der letzte Abschluss älter als zwei Jahre ist.
- **Neue Titel**, die nicht im Datenvorrat liegen, brauchen den bezahlten Tarif oder die CSV-Eingabe.
- **Mehr als etwa 20 Titel mit täglichem Kurs:** Tarif „EOD Historical Data" für rund 20 € im Monat (100.000 Abrufe am Tag).

## 10. Anwendung

- Nutzer: feste Liste erlaubter E-Mail-Adressen, Anmeldung über einen Identitätsanbieter, keine eigene Passwortverwaltung.
- Bewertungen (Annahmen, Risikofaktoren) sind für alle Nutzer gemeinsam. Portfolios gehören einem Nutzer; jeder kann mehrere führen.
- Technik: Next.js und TypeScript, SQLite, ein Container; zuerst lokal, später auf einem kleinen Server.
- Das Rechenmodul (innere Rendite, Vorschläge, Risikowert, Zielportfolio) ist ein eigenes Modul ohne Datenbank- und Netzwerkzugriff.
- Oberfläche auf Deutsch mit den Begriffen aus Abschnitt 3 und einem festen Hinweis, dass die Seite keine Anlageberatung ist.

Seiten:

| Seite | Inhalt |
|---|---|
| Rangliste | Watchlist nach innerer Rendite, mit Risikoklasse, Limit und Status der Bewertung |
| Aktie | Eingaben mit Vorschlag und Übersteuerung, Risikoraster, innere Rendite bei alternativen Kursen, Zehnjahresreihen |
| Portfolio | Ist gegen Ziel, Kauf- und Verkaufsvorschläge, Verteilung nach Branche und Region; Bestand als Stückzahl je Aktie und Barbestand in Euro |
| Datenvorrat | Alle gespeicherten Titel nach vorläufiger innerer Rendite, mit Filter und Suche; Aufnahme in die Watchlist |
| Aufgaben | überfällige und unvollständige Bewertungen, geänderte Vorschläge |
| Einstellungen | Profile und alle Parameter aus Abschnitt 12 |

Start-Watchlist: Imperial Brands, Charter Communications, Halyk Savings Bank, 3i Group,
Universal Health Services, BASF.

Reihenfolge der Umsetzung: Rechenmodul mit Tests, Datenanbindung, Oberfläche.

## 11. Abnahmetests für das Rechenmodul

| Fall | Eingaben | Erwartet | Toleranz |
|---|---|---|---|
| Imperial Brands, Kurs 30,00 GBP (Folie 7) | R0 = 3,09 (1,59 + 1,50), g0 = 2,3 %, p = 1,8 % | 10,6 % (Modell: 10,57 %) | ± 0,2 Prozentpunkte |
| Imperial Brands, Kurs 25,00 GBP (Folie 7) | wie oben | 12,7 % (Modell: 12,60 %) | ± 0,2 Prozentpunkte |
| BASF, Wachstum (Buch Kap. 5.2) | Gewinn je Aktie 2002 bis 2011 | 15,5 % | ± 0,1 Prozentpunkte |
| BASF, Gewinnniveau aus 10 Jahren | wie oben | 5,42 EUR (Modell: 5,415) | ± 0,01 |
| BASF, Gewinnniveau aus 5 Jahren | wie oben | 5,38 EUR | ± 0,01 |
| Wal-Mart, Gewinnniveau aus 10 Jahren | Gewinn je Aktie 2002/03 bis 2011/12 | 4,60 USD (Modell: 4,58) | ± 0,05 |
| Positionslimit | Basislimit 12,5 %, Risikowert 40 % | 7,5 % | exakt |
| Deckelung Rückfluss | Dividendenniveau 2,00, Netto-Rückkäufe 3,00, freier Cashflow je Aktie 4,00 | R0 = 4,00 | exakt |
| Obergrenze Wachstum | historisch 7 %, R0 = 3,00, Gewinnniveau 4,00, Eigenkapital je Aktie 20,00 | g0 = 7 % (Grenze: 0,25 · 20 % + 2 % = 7 %) | exakt |
| Obergrenze Wachstum bei Vollausschüttung | historisch 7 %, R0 = 4,00, Gewinnniveau 4,00 | g0 = 2 % | exakt |
| Bandbreite | Imperial Brands, Kurs 30,00 GBP | vorsichtig < Basis < optimistisch | – |

Die Folienwerte lassen sich nicht exakt treffen, weil die Zahlungskonvention des Autors nicht
veröffentlicht ist. Die Wal-Mart-Abweichung stammt aus gerundeten Tabellenwerten im Buch.

## 12. Eigene Annahmen (nicht aus den Quellen)

| Annahme | Wert | Grund |
|---|---|---|
| Zuordnung Risikowert zu Ausfallwahrscheinlichkeit | 0,5 % + 5 % · Risikowert | Quellen nennen keine Zahl; Imperial Brands (1,8 %) läge bei 26 % Risikowert |
| Zahlungskonvention | Rückflussniveau gilt für das kommende Jahr, Wachstum ab dem zweiten Jahr | trifft Folie 7 auf 0,1 Prozentpunkte |
| Abschmelzen des Wachstums | linear über 15 Jahre auf höchstens 3 % | Buch: höchstens 15 Jahre überdurchschnittliches Wachstum; einfache DCF-Formel nur bis 3 % |
| Obergrenze für den Wachstumsvorschlag | 8,5 % | Buch setzt bei BASF und Wal-Mart 8,5 % statt der historischen Werte an |
| Netto-Rückkäufe als Fünfjahresdurchschnitt, abzüglich aktienbasierter Vergütung | – | Folien zählen Rückkäufe als Rückfluss, ohne Methode |
| Deckelung des Rückflussniveaus auf den freien Cashflow je Aktie | Fünfjahresdurchschnitt | schuldenfinanzierte Rückkäufe sind nicht dauerhaft tragbar |
| Obergrenze Wachstum aus Einbehaltung | Einbehaltungsquote · Eigenkapitalrendite + 2 % | hohe Ausschüttung und hohes Wachstum schließen sich aus |
| Bandbreite | ± 10 % Rückfluss, ± 1 Prozentpunkt Wachstum | macht die Unsicherheit der Annahmen sichtbar |
| Rückkäufe gelten in Faktor 12 wie Dividenden | – | Folgerung aus den Folien |
| Vorschlagsregeln in Abschnitt 6.2 | – | Buch gibt Höchstabzüge und Beispiele, keine vollständigen Stufen |
| Größe gemessen an der Bilanzsumme | 20 Mio. € bis 20 Mrd. € | Auslegung von „GK" in Abb. 32 als Gesamtkapital |
| Basislimits der Profile | 15 % und 6,5 % | Buch nennt 12,5 % und 15 %; Wikifolios nennen nur Positionszahlen |
| Höchstanteil je Region | 40 % | Buch nennt nur „ausgewogen" |
| Tauschschwelle | 1 und 2 Prozentpunkte | Übersetzung der Buchregel „kein Tausch wegen 5 bis 10 %" |
| Mindestposition | 3 % und 2 % | Buch nennt einen Mindestanteil ohne Zahl |
| Überfällige Bewertungen bleiben zulässig | – | Buch verlangt die jährliche Prüfung, nennt keine Folge |

## 13. Offen

- **Lizenz für mehrere Nutzer:** Die Privattarife der Datenanbieter erlauben keine Anzeige für andere Nutzer. Vor dem Freischalten weiterer Nutzer mit EODHD klären.
- **Halyk Savings Bank:** Die Zahlen des Anbieters sind je Hinterlegungsschein und passen damit zum Londoner Kurs. Das ist aus der Aktienzahl geschlossen, nicht am Geschäftsbericht geprüft.
- **Gezahlte Dividenden bei Sonderfällen:** Das Feld des Anbieters enthält bei einzelnen Titeln Ausschüttungen an Minderheiten (Charter 2016 und 2020).
- **Kalibrierung der Ausfallwahrscheinlichkeit** an historischen Ausfallraten nach Bonitätsklasse.
- **Steuern beim Tausch:** Abgeltungsteuer auf realisierte Gewinne in der Tauschschwelle berücksichtigen.
- **Vergleichsmaßstab:** Abstand der inneren Rendite zur Anleiherendite und zu einem Weltindex anzeigen.

## 14. Nicht in Version 1

Steuern (Quellensteuer, Abgeltungsteuer), Transaktionskosten, Screening über den Gesamtmarkt,
Broker-Anbindung, Backtest, maximaler Kaufpreis nach Buchmethode, Währungsprognosen.
