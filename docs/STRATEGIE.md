# Strategie „Rückflussrendite“

**Version 1.0** vom 22.11.2026

Dieses Dokument beschreibt die Strategie „Rückflussrendite“ vollständig: welche Regeln gelten, mit welchen Werten, warum und
woher sie stammen. Es ist für Regeln und Werte maßgeblich; die Anwendung, die die Strategie rechnet, folgt ihm. Jede Regel
lässt sich mit Geschäftsberichten und einer Tabellenkalkulation nachrechnen.

**Keine Anlageberatung.** Das Dokument beschreibt eine private Rechenmethode. Es ist keine Empfehlung, Wertpapiere zu kaufen
oder zu verkaufen. Die Ergebnisse beruhen auf Annahmen und auf Daten eines Anbieters, die Fehler enthalten können.

Zitierweise: „Strategie 4.5“ meint Abschnitt 4.5 dieses Dokuments. Die Abschnittsnummern bleiben über die Fassungen hinweg
stabil. Jede Änderung, die das Zielportfolio verändern kann, erhöht die Version und steht mit Prüfung, Kennzahlen und
Entscheidung im Änderungsprotokoll; reine Textänderungen erhöhen sie nicht.

Aufbau jeder Regel: **Regel** (mit Formel), **Begründung**, **Herkunft** (Quelle nach Abschnitt 9.1 oder „eigene Setzung“) und
**Schwächen**. Die Zahlenwerte der Regeln stehen nicht im Fließtext, sondern in Tabellen: die Stufen der Zahlenfaktoren in 6.2,
alle übrigen Werte in Abschnitt 10. Der Fließtext verweist darauf; Zahlen stehen dort nur in Formeln und Beispielen.

## 1. Kurzfassung

Eine Aktie ist ein Anspruch auf das Geld, das ein Unternehmen seinen Eigentümern über die Jahre zurückgibt: Dividenden und
Aktienrückkäufe. Die Strategie schätzt keinen fairen Wert und setzt keine Kursziele. Sie fragt umgekehrt: Welche jährliche
Rendite steckt im heutigen Kurs, wenn die Rückflüsse so kommen wie angenommen und das Unternehmen mit einer bestimmten
Wahrscheinlichkeit ausfällt? Diese **innere Rendite** macht Aktien aus verschiedenen Branchen, Ländern und Währungen
vergleichbar. Gekauft wird, was nach Abzug des Risikos am meisten verspricht.

Die Rechnung hat fünf Schritte:

1. **Rückfluss (Abschnitt 3).** Aus den Abschlüssen der letzten 10 Jahre wird abgeleitet, was das Unternehmen im kommenden
   Jahr voraussichtlich zurückgibt: Dividendenniveau plus Netto-Rückkäufe (Rückkäufe abzüglich neu ausgegebener Aktien und
   Vergütung in Aktien). Mehr, als der freie Cashflow nach Abzug der Vergütung in Aktien und der Tilgung hoher Schulden
   hergibt, zählt nicht. Bei Zyklikern zählt der Cashflow über den ganzen Zyklus.
2. **Wachstum (Abschnitt 4).** Das Wachstum der Rückflüsse ist der kleinste Wert aus dem bisherigen Gewinnwachstum, dem
   Umsatzwachstum, dem Wachstum, das sich aus einbehaltenen Gewinnen finanzieren lässt, und 8,5 %. Es schmilzt über 15 Jahre
   auf höchstens 3 % ab. Wer heute Gewinn einbehält und damit nachweislich wächst, schüttet später mehr aus.
3. **Risiko (Abschnitt 6).** Ein Raster aus 15 Faktoren, 9 aus Zahlen und 6 aus Urteil, ergibt den Risikowert. Daraus folgt
   eine jährliche Ausfallwahrscheinlichkeit von 0,5 % plus 5 % des Risikowerts, die direkt in die Rendite eingeht. Ab einem
   Risikowert von 75 % scheidet eine Aktie aus.
4. **Innere Rendite (Abschnitt 5).** Der Zinssatz, bei dem der Barwert der erwarteten Rückflüsse dem Kurs entspricht. Renditen
   in Währungen mit höherer Inflation als der Euro werden um den Inflationsabstand gekürzt.
5. **Portfolio (Abschnitt 7).** Es gibt kein Renditeziel. Die vollständig bewerteten Aktien werden nach innerer Rendite gereiht
   und der Reihe nach aufgenommen, bis das Portfolio voll ist. Einzige Hürde ist die Rendite der zehnjährigen
   Euro-Staatsanleihe. Je riskanter eine Aktie, desto kleiner ihre Position. Getauscht wird nur, wenn eine neue Aktie eine
   gehaltene um mehr als die Tauschschwelle schlägt. Zwei Profile: fokussiert (etwa 6 bis 12 Titel) und global (etwa 20 bis
   25 Titel).

Urteil gehört zur Methode. Sechs Risikofaktoren lassen sich nur beurteilen, nicht ausrechnen, und jede Eingabe einer Aktie
(Rückflussniveau, Wachstum, jeder Risikofaktor) kann von Hand gesetzt werden, wenn die Herleitung aus den Zahlen das
Unternehmen verfehlt. Jede Bewertung trägt ein Datum und wird geprüft, wenn sie alt wird oder sich die Zahlen verschieben.

Die Strategie setzt keine Stop-Loss-Marken, prognostiziert keine Währungen und berücksichtigt keine Steuern. Fällt ein Kurs
bei unveränderten Aussichten, steigt die innere Rendite; das ist ein Grund nachzukaufen, nicht zu verkaufen.

Ein Rückblick über Oktober 2016 bis November 2026 (Abschnitt 8) ergibt für das fokussierte Profil nach Kosten +562 %
gegenüber +215 % für den MSCI World; im Median der rollenden Dreijahresfenster +67 %. Diese Zahlen sind stark nach oben
verzerrt (vor allem, weil gescheiterte Unternehmen in den Daten fehlen) und keine Renditeerwartung.

## 2. Begriffe

Die Begriffe gelten im ganzen Dokument in genau dieser Bedeutung. Alle Größen „je Aktie“ stehen in der Berichtswährung des
Unternehmens.

| Begriff                       | Bedeutung                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rückfluss                     | Geld, das ein Unternehmen in einem Jahr an seine Eigentümer gibt: Dividende plus Netto-Rückkäufe, je Aktie                                                                                                                                         |
| Netto-Rückkäufe               | Aktienrückkäufe abzüglich der Ausgabe neuer Aktien und der Vergütung in Aktien (aktienbasierte Vergütung), je Aktie (3.5)                                                                                                                          |
| Dividendenniveau              | Regelmäßige Dividende je Aktie, die für das kommende Jahr als gesichert gilt, ohne Sonderdividenden (3.4)                                                                                                                                          |
| Ausschüttungsniveau `A`       | Dividendenniveau plus Netto-Rückkäufe: was das Unternehmen heute zurückgibt, bevor geprüft wird, ob es das dauerhaft kann                                                                                                                          |
| Rückflussdeckel `D`           | Höchstens tragbarer Rückfluss je Aktie aus dem Cashflow, nach Abzug der Vergütung in Aktien und der Tilgung hoher Schulden (3.6). Früher: „tragbarer Rückfluss“ (so im Änderungsprotokoll)                                                         |
| Rückflussniveau `R0`          | Der Rückfluss, mit dem die Rendite rechnet: das Ausschüttungsniveau, höchstens der Rückflussdeckel (3.7); erwartet für das kommende Jahr                                                                                                           |
| Gewinnniveau `G0`             | Um Konjunktur und Einmaleffekte geglätteter Gewinn je Aktie (3.3)                                                                                                                                                                                  |
| Ausschüttungsquote            | Ausschüttungsniveau geteilt durch Gewinnniveau (bei einem Rückflussniveau von Hand: dieses geteilt durch das Gewinnniveau)                                                                                                                         |
| Wachstum `g0`                 | Erwartetes jährliches Wachstum der Rückflüsse je Aktie zu Beginn (4.1 bis 4.3)                                                                                                                                                                     |
| Dauerwachstum `g∞`            | Wachstum nach der Abschmelzphase (4.4)                                                                                                                                                                                                             |
| Inflationsabstand `a`         | Erwartete Inflation der Berichtswährung minus die erwartete Inflation des Euro (5.3); für den Euro 0                                                                                                                                               |
| Euro-Kaufkraft                | Ein Wachstum oder eine Grenze, ausgedrückt so, als rechne das Unternehmen in Euro; in einer anderen Währung um den Inflationsabstand verschoben (4.6)                                                                                              |
| Risikowert                    | Summe der Abzüge und Boni aus dem Risikoraster, mindestens 0 (6.1)                                                                                                                                                                                 |
| Ausfallwahrscheinlichkeit `p` | Jährliche Wahrscheinlichkeit, dass alle künftigen Rückflüsse entfallen; aus dem Risikowert abgeleitet (6.5)                                                                                                                                        |
| Innere Rendite `r`            | Zinssatz, bei dem der Barwert der erwarteten Rückflüsse dem Kurs entspricht (5.1); in Fremdwährung mit dem Euro vergleichbar gemacht (5.3)                                                                                                         |
| Bewertung                     | Der Satz aus Eingaben einer Aktie (Rückflussniveau, Wachstum, 15 Risikofaktoren), jeweils als Vorschlag aus den Zahlen oder als Wert von Hand, mit dem Datum der letzten Prüfung. Vollständig, wenn jede Eingabe einen Wert hat                    |
| Vorschlag                     | Wert einer Eingabe, der sich nach den Regeln dieses Dokuments aus den Abschlüssen ergibt                                                                                                                                                           |
| Wert von Hand                 | Wert einer Eingabe, den ein Mensch setzt; er geht dem Vorschlag vor (3.8)                                                                                                                                                                          |
| Prüfung der Bewertung         | Der Vorgang, eine Bewertung erneut anzusehen und zu bestätigen oder zu ändern (7.5)                                                                                                                                                                |
| Watchlist, beobachtete Titel  | Die Aktien, die ein Mensch ausgewählt hat und vollständig bewertet; nur sie kommen ins Zielportfolio. „Beobachtete Titel“ meint dasselbe                                                                                                           |
| Datenbestand                  | Alle Aktien, deren Abschlüsse vorliegen (Bestandteile von rund 30 Indizes weltweit und einzelne Börsen), auch ohne Bewertung durch einen Menschen. Aus ihm werden Titel für die Watchlist gesucht; Rückblick und Vorwärtsprotokoll rechnen auf ihm |
| Finanzwert                    | Unternehmen des Sektors Finanzdienstleistungen: Banken, Versicherer, aber auch Zahlungsdienste, Vermögensverwalter und Beteiligungsgesellschaften (6.4)                                                                                            |
| Immobilienwert                | Unternehmen des Sektors Immobilien (3.6)                                                                                                                                                                                                           |
| Region                        | Herkunftsgebiet nach dem Sitz des Unternehmens: Europa, Nordamerika, Japan, Asien (ohne Japan), Südamerika, Afrika, Ozeanien                                                                                                                       |
| Hürde                         | Mindestrendite, die eine Aktie im Basisfall erreichen muss, um Kandidat zu sein: die Rendite der zehnjährigen Euro-Staatsanleihe (7.1)                                                                                                             |
| Kandidat                      | Aktie, die ins Zielportfolio aufgenommen werden darf (7.1)                                                                                                                                                                                         |
| Basislimit, Positionslimit    | Höchstgewicht einer Aktie ohne Risiko; Positionslimit = Basislimit · (1 − Risikowert) (7.2)                                                                                                                                                        |
| Tauschschwelle                | Vorsprung in Prozentpunkten innerer Rendite, den eine neue Aktie vor einer gehaltenen haben muss (7.4)                                                                                                                                             |
| Zielportfolio                 | Gewichte, die sich aus den Kandidaten nach Abschnitt 7 ergeben; der Rest ist Bargeld („Bargeld im Ziel“)                                                                                                                                           |
| Bestand, Depot                | Bestand: was ein Portfolio heute hält, Stückzahlen je Aktie, Barbestand und sonstige Anlagen („Ist“). Depot: das Konto bei der Bank, aus dem der Bestand eines Portfolios übernommen werden kann                                                   |

Prozentpunkte und Prozent: Eine Rendite von 7 % liegt 2 Prozentpunkte über einer von 5 %. „Punkte“ meint immer Prozentpunkte.

## 3. Rückfluss: was zählt und wie er hergeleitet wird

### 3.1 Datengrundlage

**Regel.** Grundlage sind die Jahresabschlüsse der letzten Geschäftsjahre, so viele wie `reihe.jahre` (10.1). Liegen weniger
vor, aber mindestens `reihe.mindestjahre`, wird aus der kürzeren Reihe gerechnet; darunter gibt es keinen Vorschlag. Gewinn je
Aktie ist der Jahresüberschuss geteilt durch die Aktienzahl des Jahres. Alle Größen je Aktie rechnen mit der Aktienzahl ihres
Jahres. Fehlen in einem Jahr Gewinn oder Aktienzahl, gibt es keinen Vorschlag; nicht gemeldete Dividenden, Rückkäufe,
Aktienausgaben und Vergütungen in Aktien zählen als 0.

Bei einer kürzeren Reihe entfällt alles, was Stetigkeit über die volle Reihe belegen soll: der Bonus für stetig steigende
Gewinne in Faktor 1 und der Nachlass für stetige Gewinne in Faktor 2 (6.2). Die Bewertung weist auf die kürzere Reihe hin.

**Begründung.** Die volle Reihe deckt in der Regel einen Konjunkturzyklus ab. Junge Börsenwerte ganz auszuschließen hieße,
Titel zu verlieren, die der Autor des Vorbilds selbst hält.

**Herkunft.** Volle Reihe: Buch Kap. 5.2. Mindestlänge: eigene Setzung, weil der Autor jüngere Börsenwerte wie Höegh
Autoliners und Kaspi hält (Gespräch Börsenradio).

**Schwächen.** Eine kürzere Reihe deckt einen Zyklus womöglich nicht ab (11.6).

### 3.2 Wachstum über die Reihe

**Regel.** Das Wachstum einer Reihe (Gewinn, Dividende, Umsatz) vergleicht den Durchschnitt ihrer ersten mit dem ihrer letzten
Hälfte. Bei `n` Jahren und `h = ⌊n / 2⌋`:

```
g = ( Ø der letzten h Jahre / Ø der ersten h Jahre ) ^ ( 1 / (n − h) ) − 1
```

Bei zehn Jahren also `(Ø der letzten 5 / Ø der ersten 5)^(1/5) − 1`. Bei ungerader Länge bleibt das mittlere Jahr außen vor.
Ist einer der beiden Durchschnitte nicht positiv, ist das Wachstum nicht bestimmbar.

**Begründung.** Durchschnitte über eine halbe Reihe dämpfen einzelne Ausreißer an den Enden.

**Herkunft.** Buch Kap. 5.2 (Beispiel BASF aus dem Gewinn je Aktie 2002 bis 2011). Die Übertragung auf kürzere Reihen ist
eigene Setzung.

**Schwächen.** Keine bekannt über die der Reihenlänge (3.1) hinaus.

### 3.3 Gewinnniveau

**Regel.** Ist der Gewinn je Aktie in jedem Jahr der Reihe gegenüber dem Vorjahr gestiegen, ist das Gewinnniveau der letzte
Gewinn je Aktie. Sonst gilt mit dem Wachstum `g` des Gewinns je Aktie (3.2) der niedrigste dieser drei Werte:

```
G0 = min(  Ø der ganzen Reihe · (1 + g · h),
           Ø der letzten 5 Jahre · (1 + g · 2),
           höchster Gewinn je Aktie der letzten 3 Jahre )
```

Ist `g` nicht bestimmbar, gibt es kein Gewinnniveau.

**Begründung.** Der Durchschnitt glättet Konjunktur und Einmaleffekte; die Hochrechnung bringt ihn auf den heutigen Stand.
Die Kontrolle über fünf Jahre und die Obergrenze aus den letzten drei Jahren verhindern, dass nach einem schwachen ersten
Jahrfünft ein Niveau über jedem erzielten Gewinn herauskommt.

**Herkunft.** Buch Kap. 5.2 (Durchschnitt der Reihe mit Hochrechnung, Kontrolle über fünf Jahre; Beispiele BASF und Wal-Mart).
Die Obergrenze aus den letzten drei Jahren ist eigene Setzung.

**Schwächen.** Das Gewinnniveau rechnet mit unbereinigten Gewinnen; das Buch verwendet bereinigte.

### 3.4 Dividendenniveau

**Regel.** Grundlage ist die regelmäßige Dividende je Aktie jedes Geschäftsjahrs, ohne Sonderdividenden. Als Kürzung gilt ein
Rückgang gegenüber dem Vorjahr um mehr als `dividende.kuerzungstoleranz` (10.1). Wurde die Dividende in der Reihe nie
gekürzt, ist das Dividendenniveau die letzte Dividende. Sonst gilt, mit dem Wachstum `g_D` der Dividende (3.2):

```
Dividendenniveau = max( 0, min( Ø der ganzen Reihe · (1 + g_D · h),  letzte Dividende ) )
```

Ist `g_D` nicht bestimmbar, tritt der einfache Durchschnitt der Reihe an die Stelle der Hochrechnung.

**Begründung.** Eine Dividende, die nie gekürzt wurde, gilt als gesichert. Nach einer Kürzung zählt höchstens die heutige
Dividende, und auch die nur, soweit sie der Durchschnitt trägt. Kleine Rückgänge durch Rundung, Aktienzahl und Wechselkurse
sind keine Kürzung.

**Herkunft.** Buch Kap. 5.2 (Dividendenniveau analog zum Gewinnniveau). Toleranz: eigene Setzung.

**Schwächen.** Anders als beim Gewinnniveau gibt es keine Kontrolle über fünf Jahre und keine Obergrenze aus den letzten drei
Jahren; nach einer Kürzung begrenzt allein die letzte Dividende.

### 3.5 Netto-Rückkäufe

**Regel.** Für jedes der letzten `rueckkaeufe.jahre` Jahre (10.1): Rückkäufe minus Ausgabe neuer Aktien minus Vergütung in
Aktien, geteilt durch die Aktienzahl des Jahres. Die Netto-Rückkäufe sind der Durchschnitt dieser Werte, mindestens 0. Ein
Jahr ohne verwertbare Angabe zur Vergütung zählt hier mit 0 Vergütung (zur Verwertbarkeit siehe 3.6). Das gilt auch für
Finanzwerte.

**Begründung.** Rückkäufe geben Geld an die Eigentümer zurück wie Dividenden. Was das Unternehmen über neue Aktien und
Vergütung in Aktien wieder ausgibt, verwässert die Eigentümer und kommt deshalb davon ab. Ein Durchschnitt über mehrere Jahre
glättet einzelne große Programme.

**Herkunft.** Die Folien zählen Rückkäufe zum Rückfluss, nennen aber keine Methode. Netto-Rechnung und Durchschnitt sind eigene
Setzung.

**Schwächen.** Ob zurückgekaufte Aktien die Aktienzahl tatsächlich senken, prüft die Regel nicht.

### 3.6 Rückflussdeckel

**Regel.** Der Rückflussdeckel ist

```
D = max( 0,  C − V − T )
```

- `C` **Cashflow je Aktie:** Durchschnitt des freien Cashflows je Aktie (operativer Cashflow minus Investitionen) der letzten
  `cashflow.jahre` Jahre (10.1). Fehlt einer dieser Werte, gibt es keinen Vorschlag.
- **Immobilienwerte:** Der operative Cashflow tritt an die Stelle des freien.
- **Zyklusregel:** Zeigt der Vorschlag für Faktor 1 einen Abzug (ein Verlustjahr oder einen Einbruch, 6.2), gilt für `C` der
  niedrigere Wert aus dem Durchschnitt oben und dem **Median** der ganzen Reihe, sofern die Reihe mehr Jahre mit Wert hat als
  das Durchschnittsfenster, mindestens `zyklus.mindestjahre` (10.1). Für den Median wird der Wert des Jahres, das `k` Jahre vor
  dem letzten liegt, mit `(1 + a)^k` hochgerechnet: In einer Währung mit höherer Inflation sind ältere Jahre nominal zu klein.
  Fehlen einzelne ältere Jahre, gilt der Median der vorhandenen. Maßgeblich ist der Vorschlag für Faktor 1, nicht ein Wert von
  Hand.
- `V` **Vergütung in Aktien:** Durchschnitt der aktienbasierten Vergütung je Aktie über die Jahre, aus denen `C` stammt (beim
  Median ebenso hochgerechnet), soweit für sie ein verwertbarer Wert vorliegt; liegt keiner vor, ist `V = 0`. Nicht verwertbar
  sind fehlende und negative Angaben sowie ein Jahr, das mehr als das `verguetung.ausreisser`-fache des Medians der positiven
  Jahre beträgt, sofern es mindestens `verguetung.ausreisser_mindestjahre` positive Jahre gibt (10.1). Das erkennt nur grobe
  Fehler in den Daten, keine kleinen.
- `T` **Tilgung hoher Schulden:** Liegen die Nettoschulden des letzten Jahres über dem `schulden.ebitda_vielfaches`-fachen des
  EBITDA, wird der Überhang rechnerisch über `schulden.tilgungsjahre` Jahre (10.1) getilgt:
  `T = (Nettoschulden − Vielfaches · max(0, EBITDA)) / Tilgungsjahre / Aktienzahl`. Ohne Überhang ist `T = 0`.
- **Finanzwerte:** `D` ist das Gewinnniveau, ohne Zyklusregel, ohne Abzug der Vergütung (sie steht im Gewinn schon als
  Aufwand) und ohne Tilgung.

**Begründung.** Ausschüttungen auf Pump sind nicht dauerhaft. Immobilienwerte kaufen Objekte aus dem laufenden Geld; das zählt
als Investition, und ihr freier Cashflow bleibt dauerhaft negativ, obwohl sie verlässlich ausschütten. Der operative Cashflow
steht für das, was sie ausschütten können (ähnlich den Funds from Operations). Fünf Jahre im Hoch überschätzen bei Rohstoff-
und Schifffahrtswerten, was das Unternehmen über den Zyklus abwirft. Der Median statt des Durchschnitts, weil einzelne stark
negative Jahre, die kein Zyklus sind (Buchungseffekte wie bei der Finanzsparte von Mercedes-Benz 2016 bis 2018 oder bei
Archer-Daniels-Midland 2018 bis 2020 bei stets positivem Gewinn), den Durchschnitt zerstören. Der operative Cashflow rechnet die
Vergütung in Aktien als nicht zahlungswirksamen Aufwand wieder hinzu; sie kostet die Eigentümer aber Verwässerung. Doppelt
gezählt wird sie nicht: Übersteigen die Rückkäufe die Vergütung, steht sie auf beiden Seiten des Vergleichs (Ausschüttungsniveau
`Dividende + Rückkäufe − Vergütung`, Deckel `Cashflow − Vergütung`), und das Ergebnis ist dasselbe wie ohne sie; decken die
Rückkäufe die Vergütung nicht, sind die Netto-Rückkäufe 0, und nur der Deckel trägt die Vergütung. Die Tilgung gehört den
Gläubigern; hohe Schulden dürfen einen Titel nicht attraktiver machen.

**Herkunft.** Eigene Setzungen. Die Zyklusregel folgt der eigenen Recherche (Quelle R, Abschnitt 4.2); die Erkennung eines
Zyklus über Faktor 1 ist keine Quelle. Der Abzug der Vergütung ist an den Abschlüssen von Adobe, Salesforce, Meta, Alphabet und
SAP nachgerechnet (Quelle R, Abschnitt 4.5).

**Schwächen.** Der Deckel ist zu hart, wo der freie Cashflow niedrig ist, weil investiert wird, oder eine Finanzsparte ihn
verzerrt (11.7); die Tilgungsregel trifft dauerhaft hoch verschuldete Geschäftsmodelle (11.8); die Zyklusregel greift nur,
wo Faktor 1 einen Abzug zeigt, und kennt keinen Trend (11.6, 11.10). Datenfehler bei der Vergütung, die kleiner sind als die
Ausreißergrenze, bleiben unerkannt.

### 3.7 Rückflussniveau

**Regel.**

```
A  = Dividendenniveau + Netto-Rückkäufe
R0 = min( A, D )
```

Ohne Rückflussdeckel (fehlender Cashflow, bei Finanzwerten fehlendes Gewinnniveau) gibt es keinen Vorschlag. Ist das
Rückflussniveau 0, lässt sich keine innere Rendite rechnen. Das Rückflussniveau gilt für das kommende Jahr.

Was ausgezahlt wird, kann nicht zugleich einbehalten sein. Für alles, was von der Einbehaltung abhängt (die Grenze aus
Einbehaltung beim Wachstum, 4.1, und die steigende Ausschüttungsquote, 4.5), zählt deshalb das Ausschüttungsniveau `A`, nicht
das gedeckelte `R0`, gleich welcher Teil des Deckels greift.

**Begründung.** Rückkäufe, die nicht aus dem Cashflow gedeckt sind, zählen nicht. Ein Deckel heißt, dass das Geld nicht da
ist, nicht, dass es einbehalten wird; sonst würden Wachstum und Rendite durch einen niedrigeren Rückfluss steigen. So erhöht
ein niedrigeres Rückflussniveau die Rendite eines Titels nie.

**Herkunft.** Rückfluss aus Dividenden und Rückkäufen: Folien. Deckel und Einbehaltung mit dem Ausschüttungsniveau: eigene
Setzungen.

**Schwächen.** Ein Deckel kann nicht mehr durch „einbehaltenen Gewinn“ ausgeglichen werden, auch wenn der Cashflow nur niedrig
ist, weil das Unternehmen investiert (11.7).

### 3.8 Eingaben von Hand

**Regel.** Jede Eingabe einer Aktie, also das Rückflussniveau, das Wachstum und jeder der 15 Risikofaktoren, kann von Hand
gesetzt werden. Der Wert von Hand geht dem Vorschlag vor; neue Abschlüsse ändern nur den Vorschlag. Das Gewinnniveau folgt
immer der Herleitung. Bei einem Rückflussniveau von Hand ist die Ausschüttungsquote dieser Wert geteilt durch das
Gewinnniveau. Das Wachstum folgt einem Rückflussniveau von Hand nicht; wer es setzt, prüft das Wachstum selbst.

Die Parameter dieses Dokuments (Abschnitt 10) sind je Version fest und gelten für alle Aktien gleich; sie sind keine
Einstellungen, die je Nutzer oder je Aktie geändert werden.

**Begründung.** Die Herleitung aus den Abschlüssen verfehlt manche Unternehmen: Sondereffekte, Umbrüche, Datenfehler,
Geschäftsmodelle, für die die Regeln nicht gemacht sind. Das Urteil ist Teil der Methode, nicht eine Ausnahme von ihr: Die
Regeln liefern einen begründeten Ausgangspunkt, kein Ergebnis, das ohne Ansehen des Unternehmens gilt.

**Herkunft.** Vorgehen des Autors (Interview): Er bewertet jedes Unternehmen selbst und setzt Niveau und Wachstum nach eigenem
Urteil. Die Regel, dass das Gewinnniveau nicht von Hand gesetzt wird, ist eigene Setzung.

**Schwächen.** Ein Rückflussniveau von Hand in Höhe eines gedeckelten Vorschlags ergibt eine höhere Rendite als der Vorschlag
(11.9).

## 4. Wachstum, Abschmelzen, steigende Ausschüttungsquote

Alle Wachstumsgrenzen in diesem Abschnitt gelten in Euro-Kaufkraft. Für Berichtswährungen mit anderer Inflation als der Euro
werden sie nach 4.6 verschoben. Die Formeln bleiben, wie sie stehen; ihre Zahlen sind die Werte aus 10.1.

### 4.1 Wachstumsvorschlag bei wachsendem Gewinn

**Regel.** Gemessen werden (3.2):

- das Gewinnwachstum `g_G`: der niedrigere Wert aus dem Wachstum des Gewinns je Aktie und dem des Jahresüberschusses,
- das Umsatzwachstum `g_U`: der niedrigere Wert aus dem Wachstum des Umsatzes je Aktie und dem des Gesamtumsatzes; es entfällt,
  wenn der Umsatz in einem Jahr fehlt oder sein Wachstum nicht bestimmbar ist.

Wächst der Gewinn (`g_G` mindestens 0), ist der Vorschlag

```
g0 = min( g_G,  max(0, g_U),  8,5 %,  E )             (8,5 % = wachstum.obergrenze)

E  = Einbehaltungsquote · Eigenkapitalrendite + 2 %   (2 % = wachstum.preissteigerung)
     Einbehaltungsquote  = max( 0, 1 − A / G0 )
     Eigenkapitalrendite = G0 / Eigenkapital je Aktie (letztes Jahr)
```

Die Preissteigerung steht für Wachstum, das kein zusätzliches Kapital braucht. Die Grenze `E` entfällt, wenn das Gewinnniveau
fehlt oder nicht positiv ist oder das Eigenkapital nicht positiv ist. Ohne Vorschlag für das Rückflussniveau oder ohne Angabe
zum Eigenkapital gibt es keinen Wachstumsvorschlag.

**Begründung.** Wachstum wird vorsichtig angesetzt. Gewinn kann auf Dauer nicht schneller wachsen als der Umsatz. Hohe
Ausschüttung und hohes Wachstum schließen sich aus: Was ausgeschüttet wird, steht nicht für Investitionen bereit. Gewinn und
Umsatz werden je Aktie und am ganzen Unternehmen gemessen, und es gilt der niedrigere Wert: Rückkäufe lassen den Gewinn je
Aktie steigen, stehen aber schon im Rückfluss und würden sonst zweimal zählen; gibt ein Unternehmen laufend neue Aktien aus,
ist der Wert je Aktie der niedrigere.

**Herkunft.** Obergrenze: Buch, das bei BASF und Wal-Mart diesen Wert statt der historischen ansetzt. Grenze aus Umsatz und
Einbehaltung, Messung am ganzen Unternehmen und Preissteigerung: eigene Setzungen.

**Schwächen.** Keine bekannt; ob die Obergrenze für alle Branchen passt, ist nicht geprüft.

### 4.2 Schrumpfender Gewinn

**Regel.** Schrumpft der Gewinn (`g_G` unter 0), ist der Vorschlag das gemessene Wachstum, höchstens bis zur Untergrenze:
`g0 = max(g_G, wachstum.untergrenze)`. Die Grenzen aus 4.1 gelten hier nicht. Der Rückfluss schrumpft dann dauerhaft mit
diesem Satz; im vorsichtigen Fall der Bandbreite (5.2) gibt es keine Untergrenze bei 0.

**Begründung.** Das ist die vorsichtigste Annahme. Sie trennt Wertfallen von Gelegenheiten, statt schrumpfende Unternehmen
ganz auszublenden.

**Herkunft.** Eigene Setzung. Das Buch rechnet nur wachsende Titel; ein dauerhafter starker Rückgang ist kein Dauerzustand.

**Schwächen.** Keine bekannt.

### 4.3 Nicht bestimmbares Gewinnwachstum

**Regel.** Ist das Gewinnwachstum nicht bestimmbar (der Durchschnitt am Anfang oder am Ende der Reihe ist nicht positiv,
meist wegen Verlustjahren), kommt der Vorschlag aus dem Umsatzwachstum:

```
g0 = max( −5 %,  min( g_U,  3 %,  E ) )     (−5 % = wachstum.untergrenze, 3 % = wachstum.obergrenze_umsatz)
```

Liegen die Verluste am Ende der Reihe (der Durchschnitt des Gewinns je Aktie über die letzte Hälfte ist nicht positiv), tritt
0 an die Stelle der Obergrenze. Ist auch das Umsatzwachstum nicht bestimmbar, gibt es keinen Vorschlag; der Wert muss von Hand
gesetzt werden.

**Begründung.** Die Geschichte sagt dann nichts Verlässliches über überdurchschnittliches Wachstum, und bei Zyklikern misst
der Umsatz oft nur den Weg vom Tief zum Hoch. Die Obergrenze entspricht dem Dauerwachstum. Ohne diese Regel bliebe gut ein
Drittel der Titel ohne Rendite.

**Herkunft.** Eigene Setzung.

**Schwächen.** Ob das Wachstum bei Zyklikern damit zu günstig oder zu streng wegkommt, ist offen (11.5).

### 4.4 Abschmelzen auf das Dauerwachstum

**Regel.** Das Wachstum schmilzt über `n` Jahre linear auf das Dauerwachstum ab:

```
n   = 15                                   (wachstum.abschmelzjahre)
g∞  = min( g0, 3 % )                       (3 % = wachstum.dauerwachstum)
g_t = g0 + (g∞ − g0) · (t − 1) / n         für t = 1 … n
```

**Begründung.** Kein Unternehmen wächst auf Dauer schneller als die Wirtschaft.

**Herkunft.** Eigene Setzung nach dem Buch: höchstens 15 Jahre überdurchschnittliches Wachstum; die einfache Formel der
ewigen Rente nur bis zu einem Wachstum in Höhe des Dauerwachstums.

**Schwächen.** Keine bekannt; der lineare Verlauf ist eine Vereinfachung.

### 4.5 Steigende Ausschüttungsquote

**Regel.** Mit der heutigen Ausschüttungsquote `a0 = A / G0` (bei einem Rückflussniveau von Hand `R0 / G0`), nur wenn `a0 < 1`:

```
a_Ziel = 1 − max( 0, g∞ − 2 % ) / 10 %       (2 % = wachstum.preissteigerung, 10 % = quote.rendite_einbehalten)
e      = ( g0 − 2 % ) / ( 1 − a0 )           (Rendite der einbehaltenen Gewinne)
w      = min( 1, max( 0, e / 10 % ) )        (Anrechnung)
a∞     = a0 + w · ( a_Ziel − a0 ),  falls a_Ziel > a0;  sonst a∞ = a0

a_t    = a0 + ( a∞ − a0 ) · (t − 1) / n      für t = 1 … n
R_t    = R0 · ( a_t / a0 ) · Π_(s=2…t) (1 + g_s)
```

Im ersten Jahr gilt das heutige Rückflussniveau; der Endwert (5.1) rechnet mit `a∞`. Greift der Rückflussdeckel, wächst das
gedeckelte Rückflussniveau im selben Verhältnis wie die Quote. Ohne Gewinnniveau oder bei `a0 ≥ 1` bleibt die Quote, wie sie ist.
Auch das Dauerwachstum braucht noch Kapital; deshalb liegt die Zielquote unter 1, sobald `g∞` die Preissteigerung übersteigt.

**Begründung.** Wer wächst, behält Gewinn ein. Flacht das Wachstum ab, wird dieser Gewinn frei und fließt zurück. Ohne diese
Annahme zählt ein einbehaltener Gewinn nie, und Titel mit niedriger Ausschüttung (3i, TBC, Adobe) kommen auf Renditen weit unter
dem, was ihr Gewinn hergibt. Angerechnet wird nur, was nachweislich Wachstum bringt: Ein Unternehmen, das einbehält und nicht
über die Preissteigerung hinaus wächst, bleibt bei seiner Quote. Das ist die Wertfalle, die der Autor meidet. Was nie
zurückfließt, hat keinen Wert.

**Herkunft.** Das Prinzip (Rückflüsse in zwei Phasen: erst nur der ausgeschüttete Teil, danach eine höhere Quote auf den
gewachsenen Gewinn) nennt der Autor im Interview, ohne Zahlen. Volle Anrechnung ab der Rendite `quote.rendite_einbehalten`:
Buch Kap. 5.5 (Mindestrendite auf einbehaltenes Kapital). Linearer Anstieg und Zielquote: eigene Setzungen.

**Schwächen.** Ein Rückflussniveau von Hand in Höhe des gedeckelten Vorschlags ergibt eine höhere Rendite als der Vorschlag
selbst (11.9).

### 4.6 Wachstumsgrenzen in Euro-Kaufkraft

**Regel.** Das Modell rechnet in der Berichtswährung; die Rendite wird danach mit dem Inflationsabstand `a` vergleichbar
gemacht (5.3). Deshalb gelten alle Wachstumsgrenzen in Euro-Kaufkraft und werden je Aktie verschoben:

```
Grenze_lokal = (1 + Grenze) · (1 + a) − 1
```

Verschoben werden das Dauerwachstum, die Preissteigerung, die Obergrenze des Vorschlags, die Untergrenze bei schrumpfendem
Gewinn, die Obergrenze aus dem Umsatz und alle Schwellen bei 0: Nominales Wachstum unter `a` gilt als Schrumpfen (4.2),
„höchstens 0“ bei Verlusten am Ende und die Untergrenze 0 des Umsatzwachstums bedeuten lokal `a`. Wo eine Formel das Wachstum
über die Preissteigerung hinaus braucht (Zielquote und Rendite des Einbehaltenen in 4.5), wird dieser Überschuss durch `1 + a`
geteilt. Die Grenze aus Einbehaltung ist lokal `Einbehaltungsquote · Eigenkapitalrendite + (1 + Preissteigerung) · (1 + a) − 1`;
die Eigenkapitalrendite ist schon nominal in der Berichtswährung und wird nicht verschoben. Die gemessenen Werte (historisches
Wachstum, Eigenkapitalrendite) bleiben nominal. Bei `a = 0` ist alles wie ohne Verschiebung. Bei negativem `a` (Franken) sinken
die Grenzen.

**Begründung.** Würden die Grenzen nominal und für jede Währung gleich gelten, würde das Wachstum bei hoher Inflation erst
gedeckelt und dann die volle Inflation abgezogen; Währungen mit niedriger Inflation hätten einen Vorteil. Beispiel:

```
Rückfluss 5 % des Kurses, Wachstum 8,5 %, Ausfallwahrscheinlichkeit 2 %
Euro:                                         7,4 %
türkische Lira, Abstand 17,5 Punkte, nominal: −8,6 %
türkische Lira, Grenzen verschoben:           7,4 %
```

**Herkunft.** Eigene Setzung (Quelle R, Abschnitt 4.1).

**Schwächen.** Der Inflationsabstand ist eine Prognose für die kommenden Jahre und gilt vereinfachend auch für die Jahre, in
denen das historische Wachstum gemessen wurde. Bindet die Grenze aus Einbehaltung, kommt ein gleiches Unternehmen in zwei
Währungen nicht ganz auf dieselbe vergleichbare Rendite, weil die Eigenkapitalrendite nominal bleibt.

## 5. Innere Rendite: Formel, Bandbreite, Währungsvergleich

### 5.1 Formel

**Regel.** Eingaben sind der Kurs `P`, das Rückflussniveau `R0`, das Wachstum `g0` und die Ausfallwahrscheinlichkeit `p`
(6.5). Der Kurs wird zum aktuellen Wechselkurs in die Berichtswährung umgerechnet (Kurse in Unterwährungen wie Pence vorher in
die Hauptwährung). Mit fester Ausschüttungsquote:

```
R_1 = R0                                   (das Niveau gilt für das kommende Jahr)
R_t = R_(t−1) · (1 + g_t)                  für t = 2 … n      (g_t nach 4.4)

q   = (1 + g∞) · (1 − p)

P   = Σ_(t=1…n)  R_t · (1 − p)^t / (1 + r)^t
      +  R_n · (1 − p)^n · q / ( (1 + r − q) · (1 + r)^n )
```

Mit steigender Ausschüttungsquote gilt `R_t` aus 4.5, der Endwert rechnet mit `R_n · a∞ / a_n`. Gesucht ist `r` mit
`r > q − 1`; es wird numerisch gelöst. Bleibt die Quote fest und ist `g0` nicht größer als das Dauerwachstum, ist die Rechnung
einstufig und geschlossen lösbar: `r = R0 · (1 − p) / P + q − 1`.

**Begründung.** Die innere Rendite ist ein invertiertes Discounted-Cashflow-Modell: Statt mit einem gewählten Zinssatz einen
Wert zu rechnen, wird der Zinssatz gesucht, den der Kurs hergibt. Die Ausfallwahrscheinlichkeit kürzt jeden künftigen Rückfluss
um die Wahrscheinlichkeit, dass das Unternehmen bis dahin ausgefallen ist.

**Herkunft.** Innere Rendite und Ausfallwahrscheinlichkeit: Folien (Beispiel Imperial Brands). Die Zahlungskonvention (Niveau
im kommenden Jahr, Wachstum ab dem zweiten) ist eigene Setzung; sie trifft das Beispiel der Folien (10,6 % bei 30 GBP, 12,7 %
bei 25 GBP) auf 0,1 Prozentpunkte.

**Schwächen.** Die genaue Zahlungskonvention des Autors ist nicht veröffentlicht; die Folienwerte lassen sich nicht exakt
treffen.

### 5.2 Bandbreite

**Regel.** Jede Aktie wird in drei Fällen gerechnet. Rang, Hürde und Zielportfolio verwenden den Basisfall; die Spanne zeigt,
wie stark er von den Annahmen abhängt. Die Abstände sind `bandbreite.rueckfluss` und `bandbreite.wachstum` (10.1):

| Fall         | Rückflussniveau und Gewinnniveau | Wachstum                                                                  |
| ------------ | -------------------------------- | ------------------------------------------------------------------------- |
| vorsichtig   | `· 0,9`                          | `g0 − 1 Prozentpunkt`, mindestens 0 (bei negativem `g0` ohne Untergrenze) |
| Basis        | unverändert                      | `g0`                                                                      |
| optimistisch | `· 1,1`                          | `g0 + 1 Prozentpunkt`                                                     |

Rückflussniveau und Gewinnniveau verschieben sich gemeinsam; die Ausschüttungsquote bleibt. Die Ausfallwahrscheinlichkeit ist
in allen drei Fällen gleich. Der Abstand beim Wachstum und die Untergrenze 0 gelten in Euro-Kaufkraft: In einer Währung mit
Inflationsabstand `a` wird `g0` in Euro-Kaufkraft umgerechnet, verschoben und zurückgerechnet.

**Begründung.** Die Annahmen sind unsicher. Die Spanne macht sichtbar, ob ein Rang an einer knappen Annahme hängt.

**Herkunft.** Eigene Setzung.

**Schwächen.** Keine bekannt; die Abstände sind gesetzt, nicht aus der Streuung früherer Schätzfehler abgeleitet.

### 5.3 Vergleich über Währungen

**Regel.** Die innere Rendite in der Berichtswährung wird mit dem Inflationsabstand vergleichbar gemacht:

```
r_vergleichbar = (1 + r) / (1 + a) − 1
a = erwartete Inflation der Berichtswährung − erwartete Inflation des Euroraums
```

Die erwartete Inflation ist der Durchschnitt der Prognosen des Internationalen Währungsfonds für die Jahre nach dem laufenden,
so viele wie `waehrung.prognosejahre` (10.1). Fehlt die Prognose für eine Währung, gilt `a = 0`, und die Bewertung weist darauf
hin, dass die Rendite nicht mit Euro-Titeln vergleichbar ist. Rang, Hürde und alle drei Fälle der Bandbreite verwenden die
vergleichbare Rendite.

**Begründung.** Eine Rendite in einer Währung mit hoher Inflation sieht größer aus, als sie ist: Die Inflation steckt im
Wachstum und geht über die Abwertung wieder verloren. Die Strategie prognostiziert keine Wechselkurse; sie unterstellt, dass
sich der Inflationsunterschied auf Dauer im Wechselkurs niederschlägt.

**Herkunft.** Eigene Setzung (Quelle R, Abschnitt 2.8).

**Schwächen.** Kaufkraftparität gilt nur auf lange Sicht; über einige Jahre können Wechselkurse weit davon abweichen.

## 6. Risiko: Raster, Stufen, Ausfallwahrscheinlichkeit

### 6.1 Raster

**Regel.** Start ist das Top-Rating mit 0. Je Faktor gibt es einen Abzug zwischen 0 und dem Höchstabzug, bei einigen Faktoren
stattdessen einen Bonus. Der Risikowert ist die Summe, mindestens 0. Neun Faktoren werden aus den Zahlen vorgeschlagen (6.2),
sechs sind ein Urteil (6.3). Auch ein Vorschlag aus Zahlen kann von Hand übersteuert werden, innerhalb von Bonus und
Höchstabzug.

| #   | Faktor                           | Anforderung nach dem Buch                                                                                                                                     | Höchstabzug | Bonus | Art    |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----- | ------ |
| 1   | Gewinn- und Umsatzentwicklung    | weitgehend konstant, keine starken Einbrüche                                                                                                                  | 50 %        | 10 %  | Zahlen |
| 2   | Finanzierung                     | Eigenkapitalquote über 50 %, kurzfristige Verbindlichkeiten unter Umlaufvermögen, langfristiges Fremdkapital höchstens das Dreifache des operativen Cashflows | 50 %        | –     | Zahlen |
| 3   | Größe                            | Gesamtkapital über 20 Mrd. €                                                                                                                                  | 40 %        | –     | Zahlen |
| 4   | Existenzdauer                    | über 20 Jahre                                                                                                                                                 | 30 %        | –     | Zahlen |
| 5   | Branche                          | nicht subventioniert, nicht schnelllebig, verstanden                                                                                                          | 25 %        | –     | Urteil |
| 6   | Land                             | Sitz in Europa, Nordamerika oder Japan                                                                                                                        | 25 %        | –     | Zahlen |
| 7   | Wettbewerbsvorteile              | mindestens durchschnittlich                                                                                                                                   | 20 %        | 20 %  | Urteil |
| 8   | Rendite auf eingesetztes Kapital | über 10 %                                                                                                                                                     | 15 %        | 5 %   | Zahlen |
| 9   | EBIT-Marge                       | über 10 %                                                                                                                                                     | 15 %        | 5 %   | Zahlen |
| 10  | Management                       | keine Hinweise auf schlechtes oder korruptes Management                                                                                                       | 100 %       | 10 %  | Urteil |
| 11  | Zuverlässigkeit der Prognosen    | weitgehend zuverlässig                                                                                                                                        | 40 %        | –     | Urteil |
| 12  | Free Cashflow und Ausschüttung   | erzielt freien Cashflow, schüttet verlässlich aus                                                                                                             | 25 %        | –     | Zahlen |
| 13  | Abhängigkeiten                   | keine von einem Rohstoff, Lieferanten oder Kunden                                                                                                             | 20 %        | –     | Urteil |
| 14  | Währung                          | Euro, US-Dollar, Franken, Pfund, Yen                                                                                                                          | 10 %        | –     | Zahlen |
| 15  | Aktuelle Situation               | keine Krise                                                                                                                                                   | 30 %        | –     | Urteil |

Urteilsfaktoren haben keinen Standardwert. Solange einer fehlt, ist die Bewertung unvollständig, und die Aktie kommt nicht ins
Zielportfolio. Bei Finanzwerten sind auch die Faktoren 2, 8 und 9 ein Urteil (6.4).

**Begründung.** Das Raster fasst zusammen, was ein Unternehmen verlässlich macht. Es bestimmt über die
Ausfallwahrscheinlichkeit die Rendite und über das Positionslimit die Größe der Position.

**Herkunft.** Faktoren, Anforderungen, Höchstabzüge und Boni: Buch Kap. 5.8, Abb. 32. Die Stufen der Vorschläge (6.2, 6.3)
sind eigene Setzungen; das Buch gibt Höchstabzüge und Beispiele, keine vollständigen Stufen.

**Schwächen.** Die Abzüge addieren sich, auch wo Faktoren verwandt sind (Zyklik in Faktor 1 und im Rückflussdeckel, 11.11).

### 6.2 Stufen der Zahlenfaktoren

**Regel.** Die Vorschläge der neun Zahlenfaktoren folgen den Tabellen unten. Wo eine Tabelle zwei Stützpunkte nennt („ohne
Abzug“, „voller Abzug“), wird dazwischen linear interpoliert; alle anderen Übergänge sind Sprünge. Höchstabzug und Bonus stehen
im Raster (6.1).

**Faktor 1, Gewinn- und Umsatzentwicklung.** Grundlage ist der Gewinn je Aktie aller Jahre der Reihe, bestätigt durch das EBIT
derselben Jahre. Verglichen wird jedes Jahr mit dem Median seiner Vorjahre (so viele wie `faktor1.vorjahre`, am Anfang der Reihe
weniger).

- Ein **Verlustjahr** ist ein Jahr mit negativem Gewinn, in dem auch das EBIT negativ ist oder fehlt. Ein Verlust bei positivem
  EBIT zählt höchstens als Einbruch, und nur, wenn das EBIT unter dem Anteil `faktor1.einbruch_ebit` des Medians seiner Vorjahre
  liegt.
- Ein **Einbruch** ist ein Jahr, dessen Gewinn unter dem Anteil `faktor1.einbruch` des Medians der Vorjahresgewinne liegt. Er
  zählt nur, wenn das EBIT ihn bestätigt: Es ist negativ oder liegt unter dem Anteil `faktor1.einbruch_ebit` des Medians seiner
  Vorjahre. Fehlt das EBIT des Jahres oder seiner Vorjahre, entscheidet der Gewinn allein.
- Stufen (Sprünge): ab `faktor1.verlustjahre_hoch` Verlustjahren der Höchstabzug; weniger, aber mindestens ein Verlustjahr
  `faktor1.abzug_verlust`; kein Verlust, aber ein Einbruch `faktor1.abzug_einbruch`; Gewinn in jedem Jahr gestiegen der Bonus
  (nur bei voller Reihe); sonst 0.

| Merkmal                                              | Wert    | Schlüssel                   |
| ---------------------------------------------------- | ------- | --------------------------- |
| Vorjahre im Vergleich                                | 3 Jahre | `faktor1.vorjahre`          |
| Verlustjahre für den Höchstabzug                     | 3 Jahre | `faktor1.verlustjahre_hoch` |
| Abzug bei ein oder mehr Verlustjahren darunter       | 25 %    | `faktor1.abzug_verlust`     |
| Abzug bei einem Einbruch ohne Verlust                | 12,5 %  | `faktor1.abzug_einbruch`    |
| Einbruch: Gewinn unter diesem Anteil des Medians     | 50 %    | `faktor1.einbruch`          |
| Bestätigung: EBIT unter diesem Anteil seines Medians | 70 %    | `faktor1.einbruch_ebit`     |

**Faktor 2, Finanzierung.** Gemessen an der Ertragskraft statt an der Eigenkapitalquote des Buchs.

- Nettoschulden des letzten Jahres zum operativen Cashflow (Durchschnitt der letzten `faktor2.cashflow_jahre` Jahre): bis
  `faktor2.schulden_ohne_abzug` kein Abzug, ab `faktor2.schulden_voller_abzug` der volle Schuldenabzug, linear dazwischen.
  Nettoschulden bei nicht positivem operativem Cashflow: voller Schuldenabzug. Nettoguthaben: kein Abzug. Fehlt der operative
  Cashflow, steht das EBITDA für ihn, ohne EBITDA das EBIT; fehlen die Nettoschulden, gelten langfristige Schulden minus
  Zahlungsmittel.
- Zinsdeckung (EBIT zu Zinsaufwand des letzten Jahres): ab `faktor2.zinsdeckung_ohne_abzug` kein Abzug, bis
  `faktor2.zinsdeckung_voller_abzug` der volle Zinsabzug, linear dazwischen. Ohne Zinsaufwand kein Abzug.
- Es gilt der höhere der beiden Abzüge, nicht die Summe.
- Zusätzlich `faktor2.abzug_kurzfristig` (Sprung), wenn die kurzfristigen Verbindlichkeiten das Umlaufvermögen übersteigen.
- Nachlass für stetige Gewinne (Sprung): Zeigt Faktor 1 weder Abzug noch Bonus, zählt der Anteil `faktor2.anteil_stetig`
  des Abzugs, bei stetig steigendem Gewinn (Bonus in Faktor 1) `faktor2.anteil_steigend`. Bei einer kürzeren Reihe gibt es
  keinen Nachlass.
- Der Vorschlag erreicht damit höchstens Schulden- oder Zinsabzug plus Zusatzabzug; der darüber liegende Höchstabzug im Raster
  bleibt dem Urteil vorbehalten.

| Merkmal                                              | Wert    | Schlüssel                          |
| ---------------------------------------------------- | ------- | ---------------------------------- |
| Jahre im Durchschnitt des operativen Cashflows       | 3 Jahre | `faktor2.cashflow_jahre`           |
| Nettoschulden zu operativem Cashflow ohne Abzug bis  | 3-fach  | `faktor2.schulden_ohne_abzug`      |
| Nettoschulden zu operativem Cashflow voller Abzug ab | 6-fach  | `faktor2.schulden_voller_abzug`    |
| Voller Schuldenabzug                                 | 30 %    | `faktor2.abzug_schulden`           |
| Zinsdeckung ohne Abzug ab                            | 8-fach  | `faktor2.zinsdeckung_ohne_abzug`   |
| Zinsdeckung voller Abzug bis                         | 2-fach  | `faktor2.zinsdeckung_voller_abzug` |
| Voller Zinsabzug                                     | 20 %    | `faktor2.abzug_zinsdeckung`        |
| Zusatzabzug kurzfristige Verbindlichkeiten           | 10 %    | `faktor2.abzug_kurzfristig`        |
| Anteil des Abzugs bei stetigem Gewinn                | 70 %    | `faktor2.anteil_stetig`            |
| Anteil des Abzugs bei stetig steigendem Gewinn       | 40 %    | `faktor2.anteil_steigend`          |

**Faktor 3, Größe.** Bilanzsumme des letzten Jahres in Euro, linear im Logarithmus der Bilanzsumme zwischen den Stützpunkten.
Das Buch nennt „Gesamtkapital“; es ist als Bilanzsumme ausgelegt.

| Merkmal                      | Wert      | Schlüssel              |
| ---------------------------- | --------- | ---------------------- |
| Bilanzsumme ohne Abzug ab    | 20 Mrd. € | `faktor3.ohne_abzug`   |
| Bilanzsumme voller Abzug bis | 20 Mio. € | `faktor3.voller_abzug` |

**Faktor 4, Existenzdauer.** Jahre seit dem früheren aus Gründungsjahr und erstem vorliegendem Geschäftsjahr, linear zwischen
den Stützpunkten. Ist das Gründungsjahr unbekannt und reichen die Abschlüsse nicht bis zum Stützpunkt „ohne Abzug“ zurück, gibt
es keinen Vorschlag.

| Merkmal                        | Wert     | Schlüssel              |
| ------------------------------ | -------- | ---------------------- |
| Existenzdauer ohne Abzug ab    | 20 Jahre | `faktor4.ohne_abzug`   |
| Existenzdauer voller Abzug bis | 3 Jahre  | `faktor4.voller_abzug` |

**Faktor 6, Land.** Sitz in Europa, Nordamerika oder Japan: 0; sonst ein Ausgangswert (Sprung), den das Urteil nach dem Land
anpasst.

| Merkmal                                | Wert   | Schlüssel              |
| -------------------------------------- | ------ | ---------------------- |
| Ausgangswert außerhalb dieser Regionen | 12,5 % | `faktor6.ausgangswert` |

**Faktor 8, Rendite auf eingesetztes Kapital, und Faktor 9, EBIT-Marge.** Durchschnitt der letzten `faktor8_9.jahre` Jahre von
EBIT zu (Bilanzsumme minus Zahlungsmittel) bzw. von EBIT zu Umsatz. Zwischen „voller Abzug“ und „ohne Abzug“ linear; von „ohne
Abzug“ bis unter „Bonus ab“ kein Abzug; ab „Bonus ab“ springt der Wert auf den vollen Bonus. Fehlt ein Jahr, gibt es keinen
Vorschlag.

| Merkmal               | Wert    | Schlüssel                |
| --------------------- | ------- | ------------------------ |
| Jahre im Durchschnitt | 5 Jahre | `faktor8_9.jahre`        |
| Ohne Abzug ab         | 10 %    | `faktor8_9.ohne_abzug`   |
| Voller Abzug bis      | 5 %     | `faktor8_9.voller_abzug` |
| Bonus ab              | 20 %    | `faktor8_9.bonus_ab`     |

**Faktor 12, Free Cashflow und Ausschüttung.** Stufen (Sprünge):

- Freier Cashflow in mindestens dem Anteil `faktor12.positive_jahre` der Jahre der Reihe positiv und Ausschüttung
  (Dividendenniveau oder Netto-Rückkäufe über 0): 0, mit einer Dividendenkürzung in der Reihe (3.4) `faktor12.abzug_kuerzung`.
- In keinem Jahr positiver freier Cashflow und keine Ausschüttung: der Höchstabzug.
- alle übrigen Fälle: `faktor12.abzug_teilweise`.
- Rückkäufe gelten dabei wie Dividenden. Bei Finanzwerten zählen statt der Jahre mit positivem freiem Cashflow die
  Gewinnjahre.

| Merkmal                                 | Wert   | Schlüssel                  |
| --------------------------------------- | ------ | -------------------------- |
| Anteil der Jahre mit positivem Cashflow | 80 %   | `faktor12.positive_jahre`  |
| Abzug bei Dividendenkürzung             | 5 %    | `faktor12.abzug_kuerzung`  |
| Abzug in allen übrigen Fällen           | 12,5 % | `faktor12.abzug_teilweise` |

**Faktor 14, Währung.** Berichtswährung in der Liste: 0; sonst der Höchstabzug (Sprung).

| Merkmal              | Wert                    | Schlüssel                  |
| -------------------- | ----------------------- | -------------------------- |
| Währungen ohne Abzug | EUR, USD, CHF, GBP, JPY | `faktor14.hauptwaehrungen` |

**Begründung.** Faktor 1: Das Buch rechnet mit bereinigten Gewinnen, die Abschlüsse liefern unbereinigte. Steuereffekte und
Abschreibungen unterhalb des EBIT (etwa die US-Steuerreform 2017 bei Coca-Cola und Charter) sind keine Schwäche des Geschäfts.
Der Median der Vorjahre sorgt dafür, dass das Jahr nach einem einmaligen Sondergewinn nicht als Einbruch gilt. Faktor 2:
Rückkäufe lassen das Eigenkapital schrumpfen, ohne die Zahlungsfähigkeit zu ändern; Schulden- und Zinslast messen dasselbe;
stetige Gewinne tragen mehr Schulden. Faktoren 8 und 9: Der Durchschnitt verhindert, dass ein Ausreißerjahr entscheidet.

**Herkunft.** Anforderungen: Buch Kap. 5.8. Faktor 2: Das Buch misst Fremdkapital am operativen Cashflow und macht die
Anforderung von der Stetigkeit der Gewinne abhängig (Wal-Mart), nennt aber keine Stufen. Alle Stufen sind eigene Setzung.

**Schwächen.** Bei Immobilienwerten zählt Faktor 12 den freien Cashflow, obwohl ihr Rückflussdeckel aus dem operativen kommt
(11.16). Zykliker mit kurzer Reihe kommen allein aus Zahlen auf sehr hohe Risikowerte (11.11). Der Sprung auf den Bonus in den
Faktoren 8 und 9 belohnt einen kleinen Unterschied an der Schwelle stark.

### 6.3 Stufen der Urteilsfaktoren

**Regel.** Für die sechs Urteilsfaktoren gibt es feste Stufen. Wer beurteilt, wählt die Stufe, die die Belege am besten
trifft, oder einen Wert zwischen zwei Stufen, wenn die Belege zwischen ihnen liegen. Maßstab ist das Buch: Wer die
Anforderung erfüllt, bekommt 0. Ein Abzug braucht einen benannten Befund; fehlende Information ist keiner. Was andere
Faktoren schon messen, zählt nicht noch einmal: Die Branche bewertet nur Wandel und Subventionen, nicht Regulierung, Zyklik
oder Verschuldung. Die Prognosen meinen, wie gut sich Gewinnniveau und Wachstum bestimmen lassen (Buch: bei Wal-Mart leichter
als bei BASF; Patentabläufe), nicht die Treffsicherheit von Analysten. Ob der Beurteilende die Branche versteht (Teil von
Faktor 5), entscheidet er selbst.

Faktor 5, Branche:

| Stufe | Abzug | Merkmal                                                                                                                                                                     |
| ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 0 %   | Gewöhnliche Branche: Produkte und Geschäftsmodell ändern sich langsam, keine Abhängigkeit von Subventionen                                                                  |
| 2     | 8 %   | Schneller wechselnde oder trendabhängige Branche, aber mehrere Produkte und eine Stellung, die frühere Umbrüche überstanden hat                                             |
| 3     | 15 %  | Schnelllebige Branche, in der Marktführer regelmäßig verdrängt werden (Hardware, Halbleiter, Unterhaltungselektronik, Mode), oder wesentliche Abhängigkeit von Subventionen |
| 4     | 25 %  | Im Wesentlichen ein Produkt in einer schnelllebigen Branche, oder ein Geschäft, das es ohne Subventionen nicht gäbe                                                         |

Faktor 7, Wettbewerbsvorteile:

| Stufe | Abzug         | Merkmal                                                                                                                                 |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | −20 % (Bonus) | Außergewöhnlicher Vorteil und Preissetzungsmacht: keine echte Konkurrenz oder seit vielen Jahren dominant, mit dauerhaft hohen Renditen |
| 2     | −10 % (Bonus) | Dauerhafter Vorteil, deutlich stärker als die Wettbewerber                                                                              |
| 3     | 0 %           | Durchschnittliches Unternehmen, vergleichbar mit typischen Wettbewerbern                                                                |
| 4     | 10 %          | Schwächer als die Wettbewerber: dauerhaft niedrigere Margen oder stetiger Verlust von Marktanteilen                                     |
| 5     | 20 %          | Deutlich unterdurchschnittlich: kein Vorteil, Preisnehmer in einem rohstoffähnlichen Geschäft, leicht ersetzbar                         |

Faktor 10, Management:

| Stufe | Abzug         | Merkmal                                                                                                                                                                     |
| ----- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | −10 % (Bonus) | Belegt außergewöhnlich fähiges und engagiertes Management: lange Bilanz hervorragender Kapitalverwendung, Gründer oder Manager mit großem Anteil                            |
| 2     | 0 %           | Keine Hinweise auf schlechtes oder unredliches Management                                                                                                                   |
| 3     | 15 %          | Konkrete Hinweise auf schlechtes Management: wiederholt wertvernichtende Übernahmen oder strategische Fehlschläge, Gewinne, die nie bei den Eigentümern ankommen            |
| 4     | 40 %          | Ernste Hinweise: Geschäfte zugunsten von Insidern statt der Eigentümer, Sanktionen für dem Management zurechenbares Fehlverhalten, irreführende Aussagen gegenüber Anlegern |
| 5     | 100 %         | Verdacht auf Unredlichkeit oder Korruption: Betrug, manipulierte oder berichtigte Abschlüsse, Anklagen gegen die Führung                                                    |

Routinemäßige Verkäufe von Insidern, übliche Vergütung, ein ausscheidender Vorstand, ein schwaches Jahr und gewöhnliche
Rechtsstreitigkeiten eines großen Unternehmens sind keine Hinweise.

Faktor 11, Zuverlässigkeit der Prognosen:

| Stufe | Abzug | Merkmal                                                                                                                                                                                          |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | 0 %   | Weitgehend zuverlässig: stetige Entwicklung und kein bekanntes Ereignis, das künftige Gewinne in Frage stellt                                                                                    |
| 2     | 5 %   | Etwas schwerer zu schätzen: zyklische oder sprunghafte Gewinne, aber das Niveau über einen Zyklus ist klar                                                                                       |
| 3     | 12 %  | Merkliche Unsicherheit: ein bekannter Umbruch oder ein bevorstehendes Ereignis bewegt die Gewinne, aber in begrenztem Rahmen (etwa ein langsam schrumpfendes Kerngeschäft mit stabilem Cashflow) |
| 4     | 25 %  | Hohe Unsicherheit: Geschäft im Umbruch mit offenem Ausgang, kurze oder gebrochene Historie, oder ein Ereignis, das einen großen Teil der Gewinne wegnehmen kann                                  |
| 5     | 40 %  | Große Unsicherheit über den Wert: Das künftige Gewinnniveau lässt sich nicht verlässlich schätzen                                                                                                |

Faktor 13, Abhängigkeiten:

| Stufe | Abzug | Merkmal                                                                                                                                        |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 0 %   | Keine Abhängigkeit: kein einzelner Kunde, Lieferant oder Rohstoff fällt stark ins Gewicht                                                      |
| 2     | 10 %  | Merkliche Abhängigkeit: ein Kunde, Lieferant, Partner oder Rohstoff steht für einen großen Teil von Umsatz oder Kosten                         |
| 3     | 20 %  | Starke Abhängigkeit: Das Geschäft hängt an einem Rohstoffpreis, Kunden, Lieferanten, einer Lizenz oder Konzession; ihr Verlust wäre verheerend |

Abhängigkeit von einem Land, von Regulierung oder von der Konjunktur zählt hier nicht; sie steckt in anderen Faktoren.

Faktor 15, Aktuelle Situation:

| Stufe | Abzug | Merkmal                                                                                                                                  |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | 0 %   | Keine Krise: gewöhnlicher Geschäftsverlauf, auch mit üblichem Gegenwind                                                                  |
| 2     | 10 %  | Ernste Schwierigkeiten: stark gefallene Ergebnisse oder eine erhebliche ungelöste rechtliche, regulatorische oder strategische Bedrohung |
| 3     | 20 %  | Krise: Verluste, erzwungene Restrukturierung, Probleme mit Kreditauflagen oder Refinanzierung                                            |
| 4     | 30 %  | Schwere Krise: Das Überleben oder das Kerngeschäft steht auf dem Spiel                                                                   |

Ein schwächeres Jahr, Kostendruck, ein schwacher Markt, ein gefallener Kurs oder ein gewöhnlicher Rechtsstreit sind keine Krise.

**Begründung.** Feste Stufen machen Urteile vergleichbar und nachprüfbar. Geeicht sind sie an Titeln, die das Buch selbst
einstuft, und an Qualitätswerten: Die sechs Faktoren ergeben zusammen bei Wal-Mart, Coca-Cola und Nestlé etwa 0 % (Buch für
Wal-Mart: 5 % Bonus), bei BASF 22 % (Buch: 5 %).

**Herkunft.** Anforderungen und Höchstabzüge: Buch Kap. 5.8. Die Stufen sind eigene Setzung. Das Interview stützt die
Auslegung: Planbarkeit trennt für den Autor Coca-Cola von SpaceX, und ein Wechsel im Vorstand ist für sich kein Befund (Adobe).

**Schwächen.** Die Stufen sind nicht an späteren Ergebnissen geeicht; ob die Urteilsfaktoren die Auswahl verbessern, ist offen
(11.17).

### 6.4 Finanzwerte

**Regel.** Als Finanzwert gilt jedes Unternehmen des Sektors Finanzdienstleistungen. Bei ihnen

- sind die Faktoren 2 (Finanzierung), 8 (Kapitalrendite) und 9 (EBIT-Marge) ein Urteil,
- rechnen vorläufige Rendite und Risikowert, solange diese Faktoren offen sind, mit einem Ersatzabzug je Faktor
  (`finanzwerte.ersatz_*`, 10.1). Die Faktoren bleiben offen und die Bewertung unvollständig; ein gesetzter Wert ersetzt den
  Ersatzabzug. Für die Watchlist prüft der Ausschluss (6.5) ohne Ersatzabzug, weil ein Urteil den Abzug wieder senken kann,
- ist der Rückflussdeckel das Gewinnniveau (3.6), und Faktor 12 zählt die Gewinnjahre.

Der Ersatzabzug wirkt bei beobachteten Titeln nur auf die vorläufige Reihung unvollständig bewerteter Titel; ins Zielportfolio
kommen nur vollständige Bewertungen. Im Rückblick und im Vorwärtsprotokoll (Arm „zahlen“) gilt er dagegen auch für Ausschluss
und Positionslimit (8.1).

**Begründung.** Bilanzstruktur, Kapitalrendite und Marge einer Bank sind nicht mit denen eines Industrieunternehmens
vergleichbar. Fehlende Information soll nicht wie das beste Ergebnis zählen. Die Ersatzabzüge entsprechen etwa dem mittleren
Abzug der Nicht-Finanzwerte mit berechenbarer, plausibler Rendite (Stand 20.11.2026: 9,9 %, 4,7 %, 2,7 %; über alle
Nicht-Finanzwerte 16,5 %, 9,1 %, 6,5 %), also der Titel, mit denen ein Finanzwert in der Rangliste konkurriert.

**Herkunft.** Eigene Setzung.

**Schwächen.** Der Sektor umfasst auch Zahlungsdienste, Vermögensverwalter und Beteiligungsgesellschaften, bei denen das
Gewinnniveau als Deckel eine erwartete Kürzung der Ausschüttung nicht erkennt (11.15).

### 6.5 Risikoklassen und Ausfallwahrscheinlichkeit

**Regel.** Die Klassen grenzen `risiko.grenze_hervorragend`, `risiko.grenze_durchschnittlich` und `risiko.ausschluss` ab
(10.1); die obere Grenze gehört jeweils noch zur Klasse, der Ausschluss gilt ab seinem Wert.

| Risikowert                            | Klasse           | Folge          |
| ------------------------------------- | ---------------- | -------------- |
| 0 bis Grenze „hervorragend“           | hervorragend     |                |
| darüber bis Grenze „durchschnittlich“ | durchschnittlich |                |
| darüber bis unter den Ausschluss      | riskant          |                |
| ab Ausschluss                         | Spekulation      | ausgeschlossen |

```
p = 0,5 % + 5 % · Risikowert          (pro Jahr; ausfall.sockel, ausfall.je_risikowert)
Beispiele: Risikowert 0 % → 0,5 %;  26 % → 1,8 %;  50 % → 3,0 %
```

Die Ausfallwahrscheinlichkeit geht direkt in die innere Rendite ein (5.1); ein riskanter Titel muss mehr abwerfen, um vor einem
sicheren zu stehen.

**Begründung.** Das Risiko wirkt zweimal: in der Rendite über `p` und in der Positionsgröße über das Positionslimit (7.2).

**Herkunft.** Klassen und Ausschluss: Buch Kap. 5.8. Die Zuordnung zur Ausfallwahrscheinlichkeit ist eigene Setzung; die
Quellen nennen keine Zahl. Imperial Brands (1,8 % in den Folien) läge bei 26 % Risikowert.

**Schwächen.** Die Zuordnung ist gesetzt, nicht an historischen Ausfällen geeicht (11.1).

## 7. Portfolio: Kandidaten, Verfahren, Profile, Tausch, Prüfung

### 7.1 Kandidaten

**Regel.** Eine Aktie ist Kandidat, wenn

- ihre Bewertung vollständig ist (Rückflussniveau, Wachstum und alle 15 Risikofaktoren haben einen Wert, ein Kurs liegt vor und
  die innere Rendite ist berechenbar),
- ihr Risikowert unter dem Ausschluss liegt und
- ihre vergleichbare innere Rendite im Basisfall mindestens die Hürde erreicht.

Die Hürde ist die Rendite der zehnjährigen Euro-Staatsanleihe bester Bonität (Zinsstrukturkurve der Europäischen
Zentralbank) plus `huerde.aufschlag`, mindestens `huerde.mindestwert`; liegt keine Anleiherendite vor, gilt
`huerde.ersatzwert` (10.1). Überfällige Bewertungen (7.5) bleiben zulässig.

Es gibt kein Renditeziel. Ausgewählt wird nach Rang, bis das Portfolio voll ist; Bargeld bleibt nur, wenn die Kandidaten
ausgehen.

**Begründung.** Was die Staatsanleihe nicht schlägt, lohnt das Risiko nicht. Das Risiko steckt bereits zweimal in der
Rechnung, in der Ausfallwahrscheinlichkeit und im Positionslimit; ein weiterer Aufschlag würde es dreifach zählen. Bargeld
bringt nichts.

**Herkunft.** Interview: „Ich habe nicht so eine klare Zielrendite“, aber Aktien müssen Anleihen schlagen; kein Bargeld.
Anleiherendite als Hürde ohne Aufschlag: eigene Setzung. Die frühere Regel (Anleiherendite plus 5 Punkte, mindestens 7 %, und
das schon im vorsichtigen Fall) ist gestrichen: Sie ließ im Depot des Autors nur einen von 18 Titeln zu und hielt drei Viertel
bar.

**Schwächen.** Die Hürde enthält keine Sicherheitsmarge für den eigenen Schätzfehler (11.2).

### 7.2 Verfahren

**Regel.**

1. Die Kandidaten werden absteigend nach vergleichbarer innerer Rendite sortiert. Gehaltene Titel erhalten für die
   Sortierung einen Aufschlag in Höhe der Tauschschwelle.
2. Der Reihe nach erhält jeder Kandidat das Gewicht
   `min( Positionslimit, freier Rest, freier Raum in Branche, freier Raum in Region )` mit
   `Positionslimit = Basislimit · (1 − Risikowert)`.
3. Ein neuer Kandidat wird übersprungen, wenn sein Gewicht unter der Mindestposition läge oder er die Höchstzahl je Branche
   und Region überschreiten würde. Gehaltene Titel, die Kandidat bleiben, behalten mindestens ihr aktuelles Gewicht, soweit
   der freie Rest reicht, auch über Positionslimit und Höchstanteile hinaus; sie zählen bei der Höchstzahl je Branche und Region
   mit.
4. Was übrig bleibt, ist Bargeld.

Folge: Ein neuer Titel kann nur aufgenommen werden, wenn sein Positionslimit die Mindestposition erreicht. Im globalen Profil
schließt das neue Titel mit einem Risikowert über `1 − Mindestposition / Basislimit` aus (mit den Werten aus 7.3 etwa 69 %).

**Begründung.** Die beste Rendite zuerst; das Risiko begrenzt die Größe, Branchen- und Regionengrenzen die Klumpen.

**Herkunft.** Positionslimit nach Risiko, Streuung und Umschichtung: Buch Kap. 6; Bestätigung durch die Wikifolios des Autors
(Risiko bestimmt Abschlag und Positionsgröße). Die Ausgestaltung ist eigene Setzung.

**Schwächen.** Jede Position wird bis zum Limit gefüllt; der Autor füllt nur die oberen auf (11.4).

### 7.3 Profile

**Regel.** Die Regeln gelten je Portfolio; es gibt zwei Profile.

| Regel                            | fokussiert      | global          | Herkunft                                                                           |
| -------------------------------- | --------------- | --------------- | ---------------------------------------------------------------------------------- |
| Basislimit                       | 15 %            | 6,5 %           | eigene Setzung; das Buch nennt 12,5 % und 15 %, die Wikifolios nur Positionszahlen |
| Mindestposition                  | 3 %             | 2 %             | eigene Setzung; das Buch nennt einen Mindestanteil ohne Zahl                       |
| Neue Titel je Branche und Region | keine Grenze    | höchstens 2     | Buch                                                                               |
| Höchstanteil je Branche          | keine Grenze    | 20 %            | eigene Setzung                                                                     |
| Höchstanteil je Region           | keine Grenze    | 40 %            | eigene Setzung; das Buch nennt nur „ausgewogen“                                    |
| Tauschschwelle                   | 3 Prozentpunkte | 2 Prozentpunkte | Buch („kein Tausch wegen 5 bis 10 %“); fokussiert nach Rückblick angehoben (7.4)   |

Das fokussierte Profil führt erfahrungsgemäß etwa 6 bis 12 Titel, das globale etwa 20 bis 25. Beide verwenden dieselbe Hürde.

**Begründung.** Die Profile bilden die beiden Wikifolios des Autors nach: ein konzentriertes Depot mit wenigen, großen
Positionen und ein breit gestreutes.

**Herkunft.** Wikifolio-Handelsideen „FocusedYieldInvesting“ und „Global Yield Investing“.

**Schwächen.** Die Basislimits passen nicht genau zu den Wikifolios (11.4); die Tauschschwelle des globalen Profils ist nicht
im Rückblick geprüft (11.18).

### 7.4 Tausch, Halten und Verkaufen

**Regel.**

- **Tausch:** Eine neue Aktie verdrängt eine gehaltene nur, wenn ihre Rendite die der gehaltenen um mehr als die
  Tauschschwelle übersteigt und das Portfolio voll ist.
- **Limits gelten beim Kauf.** Eine Position, die durch Kursgewinne über ihr Limit wächst, wird nicht gekürzt.
- **Keine Stop-Loss-Marken.** Fällt ein Kurs bei unveränderten Aussichten, steigt die innere Rendite; das führt eher zu einem
  Nachkauf als zu einem Verkauf.
- **Kauf:** Titel im Zielportfolio, deren heutiges Gewicht darunter liegt.
- **Verkauf:** Ein gehaltener Titel ist kein Kandidat mehr (Risikowert ab dem Ausschluss, Rendite unter der Hürde), oder er
  fällt trotz Aufschlag aus dem Zielportfolio. Eine unvollständige Bewertung ist für sich kein Verkaufsgrund: Erst wird
  bewertet, dann entschieden. Ausnahme: Erreicht der Risikowert aus den schon gesetzten Faktoren auch nach Abzug der
  größtmöglichen Boni der Urteilsfaktoren (Faktoren 7 und 10) noch den Ausschluss, kann kein Urteil den Titel retten, und er
  wird zum Verkauf vorgeschlagen.
- Alle Änderungen sind Vorschläge; ausgeführt wird nichts automatisch.

**Begründung.** Umschichtungen kosten Gebühren, Spreads und gegebenenfalls Steuern; kleine Renditeunterschiede liegen
innerhalb der Unsicherheit der Annahmen (5.2).

**Herkunft.** Buch Kap. 6 (Umschichtung, „kein Tausch wegen 5 bis 10 %“; Limits beim Kauf). Die Tauschschwelle als Aufschlag
in Prozentpunkten ist eigene Setzung. Herkunft der Tauschschwelle im fokussierten Profil: Rückblick vom 20.11.2026 mit 0, 1, 2,
3 und 5 Punkten (Euro, vierteljährlich umgeschichtet, Kosten je Handelsumsatz wie in 10.3, ohne Steuern). Grundlage waren 29
rollende Dreijahresfenster mit Starts von Oktober 2016 bis Oktober 2023 und die Läufe von jedem Startjahr bis heute. Die
Fenster überlappen stark; es sind nur etwa drei unabhängige Dreijahreszeiträume.

- 0 Punkte waren in allen 29 Fenstern schlechter als 1 Punkt.
- 3 Punkte lagen in 76 % der Fenster über 1 Punkt (Median der Differenz +5,9 Punkte) und waren bei 7 von 8 Startjahren,
  gerechnet bis heute, die beste der fünf Schwellen. Die mediane Dreijahresrendite ist aber fast gleich (+67 % gegen +66 %);
  der Vorsprung kommt aus dem Mittel (+90 % gegen +67 %) und den guten Fenstern.
- 5 Punkte lagen bei den Starts 2018 bis 2020 vorn, davor und danach hinten (Median der Dreijahresrendite +44 %). Die
  Rangfolge ist darüber hinaus nicht stabil.
- Der Umschlag sank von 95 auf 74 % je Quartal. Die Kostenersparnis erklärt davon nur etwa 0,2 Punkte Rendite im Jahr. Dass
  der Rest vom längeren Halten gestiegener Titel kommt, ist eine Vermutung und nicht geprüft.

Die Umschlagzahlen dieses ersten Laufs stammen aus einer eigenen Auswertung vor dem heutigen Werkzeug, mit anderer Zählung
und vor zwei Regeländerungen im Rückblick (Titel mit Split zwischen Abschluss und Stichtag fallen weg; Abschlag für
eingestellte Titel nur ohne weitere Tageskurse). Sie sind deshalb nicht mit dem Umschlag in 8.2 vergleichbar; das Werkzeug
ergibt für 1 und 3 Punkte 84 % und 68 % je Umschichtung (Änderungsprotokoll).

**Schwächen.** Die Evidenz ist schwach: fehlende gescheiterte Unternehmen, nur Zahlenfaktoren ohne Urteile, heutige Werte für
den Inflationsabstand, und die Schwelle wurde nach einem ersten Dreijahrestest ausgewählt. Gestützt ist allenfalls
„höher als 0 bis 1 Punkt“; die genaue Zahl ist nicht belegt. Steuern beim Tausch bleiben unberücksichtigt (11.3).

### 7.5 Prüfung der Bewertungen

**Regel.** Jede Bewertung trägt das Datum, an dem zuletzt ein Wert von Hand gesetzt oder bestätigt wurde. An diesem Tag werden
auch die Vorschläge aus den Zahlen festgehalten. Eine vollständige Bewertung ist zu prüfen, wenn

- sie älter ist als `pruefung.monate` (10.1), oder
- sich die Vorschläge seither über die Bandbreite (5.2) hinaus verschoben haben: Rückflussniveau oder Gewinnniveau um mehr als
  `bandbreite.rueckfluss` ihres Betrags, Wachstum um mehr als `bandbreite.wachstum` (in Euro-Kaufkraft, für beide Stände mit dem
  heutigen Inflationsabstand), die Summe der Zahlenfaktoren um mehr als `pruefung.risiko`, oder ein Vorschlag ist neu
  hinzugekommen oder weggefallen. Auch eine geänderte Rechenregel verschiebt Vorschläge und löst die Prüfung aus.

Der Titel bleibt bis zur Prüfung Kandidat. Analystenschätzungen gehen nicht ein.

**Begründung.** Kleinere Verschiebungen deckt die Bandbreite ab; was über sie hinausgeht, deckt die Bewertung nicht mehr.

**Herkunft.** Der Autor versieht jede Bewertung mit einem Datum und gleicht monatlich ab, ob sich die Zahlen seither
verschoben haben: Bei wenigen Prozent bleibt sie stehen, bei mehr sieht er sich das Unternehmen im Ganzen wieder an
(Interview). Jährliche Prüfung: Buch, ohne Folge bei Überfälligkeit. Die Schwellen sind eigene Setzung; das Interview nennt
„plus minus wenige Prozent“.

**Schwächen.** Keine bekannt; der Abgleich stützt sich nur auf Abschlüsse, nicht auf neue Schätzungen (11.13).

## 8. Rückblick: Ergebnisse und ihre Grenzen

### 8.1 Aufbau

Der Rückblick rechnet, was das Zielportfolio des fokussierten Profils seit Oktober 2016 gebracht hätte. Er dient dazu, eine
Änderung an der Strategie vor der Übernahme zu prüfen; er sagt nichts über künftige Renditen. Seine Einstellungen stehen in
10.3; sie gehören zum Werkzeug, nicht zu den Regeln der Strategie.

- Alle drei Monate wird zum Monatsschluss umgeschichtet. Bewertet werden alle Titel des Datenbestands mit denselben Regeln wie
  in diesem Dokument, aber nur mit dem, was damals bekannt war: Abschlüsse gelten ab Juni des Folgejahres als veröffentlicht,
  dazu Schlusskurs und Wechselkurs des Stichtags und die Dividenden bis dahin.
- **Risikowert ohne Urteil:** Es gibt keine Werte von Hand und keine Urteilsfaktoren. Fehlende Urteilsfaktoren zählen als 0,
  die offenen Faktoren der Finanzwerte mit ihrem Ersatzabzug (6.4), und dieser Risikowert gilt auch für den Ausschluss und das
  Positionslimit. Das weicht von der Anwendung auf die Watchlist ab, wo nur vollständige Bewertungen ins Zielportfolio kommen
  und der Ausschluss ohne Ersatzabzug prüft. Das Ergebnis ist eine unbeurteilte Auswahl, nicht ein Depot, wie es ein Mensch
  geführt hätte.
- **Auswahl:** Ausgeschlossen sind Titel unter dem Mindestmarktwert, Titel mit unbereinigtem Aktiensplit, als Aktie geführte
  Anleihen und Vorzugspapiere, Doppelnotierungen (es bleibt die mit dem größten Marktwert), Währungen ohne Referenzkurs der EZB
  und Titel mit offensichtlich unplausiblen Zahlen: einem Rückflussniveau über dem Anteil `plausibilitaet.rueckfluss` des
  Kurses oder einem Kurs unter dem `plausibilitaet.kurs_gewinn`-fachen des Gewinnniveaus (10.3). Diese Grenzen fangen vor allem
  Hinterlegungsscheine mit Zahlen in anderer Stückelung, treffen aber auch echte Sonderfälle; sie bestimmen mit, welche Titel
  im Rückblick überhaupt vorkommen.
- **Handel:** zum Schlusskurs des Stichtags, mit Kosten je Handelsumsatz; Bargeld wird verzinst. Endet die Kursreihe eines
  Titels, wird im dritten Monat ohne Kurs ein Verlust angesetzt (auch bei Übernahmen gegen bar).
- **Vergleiche:** der iShares Core MSCI World (thesaurierend, in Euro) und eine Zufallsauswahl: dieselben Kandidaten,
  Risikoabzüge, Limits und Kosten, aber eine je Titel und Jahr gewürfelte Reihenfolge, in vielen Läufen. Sie zeigt, was die
  Reihung über Zufall hinaus beiträgt.
- **Fenster und Güte:** Neben dem ganzen Zeitraum werden rollende Dreijahresfenster ausgewertet (Start alle drei Monate). Die
  Güte misst die Rendite über dem Bargeldzins je Einheit Schwankung (ähnlich der Sharpe-Ratio) und die Rendite pro Jahr je
  größtem Rückgang (ähnlich der Calmar-Ratio), für die Fenster als Median und als schwaches Viertel (25-%-Quantil).

### 8.2 Ergebnisse für Version 1.0

Lauf vom 22.11.2026, Strategieversion 1.0, Profil fokussiert, Oktober 2016 bis November 2026, Euro, nach Kosten. Hürde
3,4 % (Anleiherendite vom 19.11.2026, für alle Stichtage). Spätere Läufe nehmen Hürde und Bargeldzins je Stichtag aus der
Zinsstrukturkurve der EZB (Hürde im Mittel 1,3 %); Gesamtrendite (+562 %), Rendite p. a., Schwankung, größter Rückgang und Umschlag blieben bei diesem Lauf gleich
(Nachrechnung vom 23.11.2026), die Hürde bindet also nicht; die Güte stieg von 0,68 auf 0,77, weil weniger Bargeldzins
abgezogen wird. Güte-Werte gelten nur innerhalb gleicher Zinsannahmen.

| Kennzahl                                      | Strategie | MSCI World | Zufallsauswahl (Median aus 200) |
| --------------------------------------------- | --------- | ---------- | ------------------------------- |
| Gesamtrendite                                 | +562 %    | +215 %     | +156 %                          |
| Rendite pro Jahr                              | +20,7 %   | +12,1 %    | –                               |
| Schwankung pro Jahr                           | 25 %      | 13 %       | –                               |
| Größter Rückgang                              | −34 %     | −19 %      | –                               |
| Güte: Rendite über Bargeld je Schwankung      | 0,68      | 0,65       | –                               |
| Güte: Rendite pro Jahr je größtem Rückgang    | 0,62      | 0,65       | –                               |
| Umschlag je Umschichtung (Käufe und Verkäufe) | 68 %      | –          | 59 %                            |
| Titel im Durchschnitt                         | 9,8       | –          | –                               |

Rollende Dreijahresfenster (29):

| Kennzahl                                                     | Wert   |
| ------------------------------------------------------------ | ------ |
| Median der Dreijahresrendite                                 | +67 %  |
| schlechtestes Fenster                                        | +5 %   |
| bestes Fenster                                               | +224 % |
| Anteil der Fenster, in denen die Strategie den Index schlägt | 69 %   |
| Güte (je Schwankung), Median der Fenster                     | 0,72   |
| Güte (je Schwankung), schwaches Viertel der Fenster          | 0,30   |
| Rendite je größtem Rückgang, Median der Fenster              | 1,05   |

Zeiträume: Oktober 2016 bis Februar 2020 +68 % (Index +33 %, Zufall +31 %), Februar 2020 bis Juli 2023 +141 % (Index +53 %,
Zufall +49 %), Juli 2023 bis November 2026 +64 % (Index +55 %, Zufall +31 %). Keiner der 200 Zufallsläufe schlägt die
Strategie; 90 % von ihnen liegen zwischen +69 % und +313 %. 21 Titel wurden mit dem Verlust für eine eingestellte Kursreihe
angesetzt.

Nicht ausgewertet sind die Güte des Index in den Fenstern und der Rückblick für das globale Profil (für Version 1.0 nicht
gerechnet).

### 8.3 Grenzen

Die Zahlen sind ein Maßstab zum Vergleichen zweier Fassungen der Strategie, keine Renditeerwartung.

- **Survivorship-Bias:** Der Datenbestand enthält fast nur Unternehmen, die es heute noch gibt. Gescheiterte und übernommene
  Unternehmen fehlen weitgehend; das hebt jedes Ergebnis, vermutlich stark.
- **Nur Zahlenfaktoren:** Die sechs Urteilsfaktoren und alle Werte von Hand fehlen (8.1). Ob Urteile die Auswahl verbessern oder
  verschlechtern, misst der Rückblick nicht.
- **Heutige Abschlüsse:** Die Abschlüsse liegen in heutiger Fassung vor, nicht in der damals veröffentlichten.
- **Heutige Inflationsprognose:** Für alle Stichtage gelten die Inflationsprognosen von heute. Hürde und Bargeldzins folgen dem Zinsverlauf der EZB; fehlt ein Wert, gelten die festen Zinsen (der Bericht zählt diese Monate).
- **Handel und Steuern:** Gehandelt wird zum Schlusskurs des Entscheidungstags; Steuern fehlen.
- **Eingestellte Titel:** Der angesetzte Verlust ist eine Annahme und trifft auch Übernahmen gegen bar.
- **Wenig unabhängige Zeiträume:** Die Fenster überlappen stark; unabhängig sind nur etwa drei Dreijahreszeiträume. Ein Vorsprung
  kann aus einem einzigen Zyklus stammen.
- **Rückschau bei der Wahl:** Die Tauschschwelle im fokussierten Profil wurde auf derselben Reihe gewählt (7.4); für sie ist der
  Rückblick kein unabhängiger Test mehr.
- **Startzeitpunkt:** Für einen Titel genügt die Mindestlänge der Reihe, der Datenbestand hat Abschlüsse etwa ab 2006; vor 2016
  wird die Auswahl dünn.

### 8.4 Vorwärtsprotokoll

Seit November 2026 hält die Anwendung zu Beginn jedes Monats fest, welches Zielportfolio sie vorgeschlagen hätte, mit den
Kursen von damals und der Strategieversion. Es gibt zwei Arme je Profil: nur aus Zahlen über den ganzen Datenbestand (wie der
Rückblick, 8.1) und mit allen Urteilen über die Watchlist. Das Protokoll ist die einzige Messung ohne Rückschaufehler und die
einzige, an der sich der Nutzen der Urteilsfaktoren zeigen kann. Es sagt noch nichts aus: Mit etwa 6 bis 12 Titeln im
fokussierten und 20 bis 25 im globalen Profil ist ein Unterschied der Arme erst nach etwa zwei Jahren mehr als Rauschen.

Neben dem Portfolio hält das Protokoll je Arm die Rangliste der besten 100 Kandidaten nach innerer Rendite fest, und zwar nur
Titel, die auch ins Zielportfolio kommen könnten (über der Hürde, unter der Ausschlussgrenze beim Risiko; Rang, innere
Rendite, Risikowert, Branche, Region, Kurs von damals; die Rangfolge hängt nicht vom Profil ab, gehaltene Titel haben darin keinen
Aufschlag). Damit lässt sich später das Ranking messen und nicht nur die Auswahl, die davon übrig bleibt: Trägt es, liegt die
gleich gewichtete Rendite der Ränge 1 bis 10 über der der Ränge 31 bis 100, über viele Monate und nicht in einem. Die
Auswertung (`pnpm run forward`) rechnet in Euro mit Kurs und Ausschüttungen seit dem Eintrag (nicht wiederangelegt, ohne
Kosten und Steuern, Ausschüttungen zum heutigen Wechselkurs) und stellt den MSCI World daneben; der Indexkurs wird beim Auswerten
bei Yahoo geholt und nicht mitgeschrieben, ebenso die Ausschüttungen, die in der Datenbank stehen.
Splits seit dem Eintrag werden im Kurs von damals berücksichtigt. Kleine Unschärfen bleiben: Der Kurs von damals ist der
letzte gespeicherte Schlusskurs (bei einem Abgleich am frühen Morgen der des Vortags), der Indexkurs der des Eintragstags oder davor;
die Zeiträume können um wenige Tage abweichen, und eine Ausschüttung mit Stichtag am Eintragstag zählt nicht. Der Index
thesauriert, die Ausschüttungen des Portfolios werden nicht wiederangelegt; der Vergleich begünstigt den Index leicht.

## 9. Herkunft und Abweichungen vom Vorbild

### 9.1 Quellen

Im Text wird mit dem Namen der Quelle verwiesen („Buch Kap. 5.8“, „Interview“, „Quelle R, Abschnitt 4.2“).

| Kurzname             | Quelle                                                                                                                                                                                                                                                                                                                                                                              | Inhalt                                                                                                                                         | Verwendung                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Folien               | Folien „Yield Investing“ von Stefan Meißner (Stand 23.11.2026)                                                                                                                                                                                                                                                                                                                      | Innere Rendite per invertiertem Discounted-Cashflow-Modell, Ausfallwahrscheinlichkeit, Reihung, Beispiel Imperial Brands, Depotstände          | maßgeblich für Kennzahl und Auswahl                      |
| Buch                 | Stefan Meißner, „Langfristige Vermögensvermehrung mit wertorientierten Investments“ (Stand 2012), Kap. 5 und 6                                                                                                                                                                                                                                                                      | Gewinn- und Dividendenniveau, Wachstum, Risikoraster, Positionslimit, Streuung, Umschichtung                                                   | maßgeblich für Eingaben, Risiko und Portfolio            |
| Wikifolios           | Wikifolio-Handelsideen „FocusedYieldInvesting“ und „Global Yield Investing“                                                                                                                                                                                                                                                                                                         | zwei Portfolio-Profile; Risiko bestimmt Abschlag und Positionsgröße                                                                            | Bestätigung, Grundlage der Profile                       |
| Interview            | Interview mit dem Autor im Podcast „Bulle & Mensch“ (eigene Mitschrift)                                                                                                                                                                                                                                                                                                             | Rückflüsse in zwei Phasen, Auswahl nach Rang ohne Renditeziel, kein Bargeld, Größenordnung der Ausfallwahrscheinlichkeit, monatlicher Abgleich | maßgeblich für 4.5, 7.1 und 7.5                          |
| Gespräch Börsenradio | Gespräch mit dem Autor, Börsenradio, „Wikifolio-Trader der Woche“ (eigene Mitschrift)                                                                                                                                                                                                                                                                                               | Positionen mit Zahlen: Höegh Autoliners, Safe Bulkers, Lion Finance, Stalexport; Risikomerkmale; Inflation in Kasachstan                       | Prüfsteine für kurze Reihen (3.1) und Sonderfälle        |
| Quelle R             | Eigene Recherche „Bewertungsansatz im Spiegel der Primärquellen“, Stand 20.11.2026. Abschnitte 2.1 bis 2.9: Bausteine mit Belegen (Buffett, Munger, Damodaran, Graham, Mauboussin, Ausfallraten nach Bonitätsklasse); 3: Quellenverzeichnis; 4.1 bis 4.6: Vorschläge (Wachstumsgrenzen in Fremdwährung, Zykliker, Sicherheitsmarge, Ausfallwahrscheinlichkeit, Vergütung in Aktien) | Abgleich der Methode mit Primärquellen                                                                                                         | Grundlage einzelner eigener Setzungen und offener Fragen |

Wo die Quellen keine Zahl nennen, steht eine eigene Setzung. Alle eigenen Setzungen stehen in Abschnitt 10.

### 9.2 Was vom Vorbild stammt

Vom Vorbild übernommen sind der Grundgedanke, Aktien über ihre innere Rendite zu ordnen, die Rechnung mit einer jährlichen
Ausfallwahrscheinlichkeit, die Rückflüsse aus Dividenden und Rückkäufen, die Herleitung von Gewinn- und Dividendenniveau und
Wachstum aus der vollen Reihe, das Risikoraster mit seinen 15 Faktoren, Höchstabzügen und Boni, die Risikoklassen mit dem
Ausschluss, das Positionslimit nach Risiko, die Streuung über Branchen und Regionen, das zurückhaltende Umschichten, die Auswahl
nach Rang ohne Renditeziel und ohne Bargeldquote, die zwei Profile und die datierte, regelmäßig geprüfte Bewertung.

Nicht übernommen ist die Buchmethode „innerer Wert minus Sicherheitsmarge ergibt den höchsten Kaufpreis“. Die Folien ersetzen
sie durch die innere Rendite.

### 9.3 Eigene Regeln und Abweichungen

Eigene Regeln sind: die Begrenzung des Rückflusses auf den Cashflow (bei Zyklikern über den ganzen Zyklus, bei
Immobilienwerten aus dem operativen Cashflow), der Abzug der Vergütung in Aktien, die Netto-Rechnung der Rückkäufe, der Abzug
für die Tilgung hoher Schulden, die Wachstumsgrenzen aus Umsatz und Einbehaltung, die Messung des Wachstums je Aktie und am
ganzen Unternehmen, der Vorschlag bei schrumpfendem und bei nicht bestimmbarem Gewinnwachstum, das lineare Abschmelzen des
Wachstums, das Maß, in dem einbehaltene Gewinne zählen, die Wachstumsgrenzen in Euro-Kaufkraft und der Inflationsabgleich
zwischen Währungen, die Stufen aller Risikofaktoren (darunter die Bewertung der Finanzierung an der Ertragskraft statt an der
Eigenkapitalquote und die Bestätigung von Verlusten durch das EBIT), der Ersatzabzug für Finanzwerte, die Umrechnung des
Risikowerts in eine Ausfallwahrscheinlichkeit, die Anleiherendite als Hürde, die Bandbreite, die Tauschschwelle als
Aufschlag, die Mindesthistorie und die Schwellen für die Prüfung der Bewertungen.

Bekannte Abweichungen vom Vorgehen des Autors: Er stützt Niveau und monatlichen Abgleich auf Analystenschätzungen, die
Strategie rechnet nur aus Abschlüssen (11.13). Er bewertet Unternehmen ohne Ausschüttung über den Gewinn und eine spätere
Ausschüttung, die Strategie rechnet bei einem Rückfluss von 0 keine Rendite (11.12). Er füllt nur die oberen Positionen bis
zum Limit auf, die Strategie jede (11.4).

### 9.4 Hinweis

Dieses Dokument ist kein Angebot von Stefan Meißner und nicht mit ihm abgestimmt. Es gibt seine Methode so wieder, wie sie
sich aus den genannten Quellen erschließt, und ergänzt sie um eigene Regeln. Fehler in der Wiedergabe gehen nicht zu seinen
Lasten.

## 10. Parameter und eigene Setzungen

### 10.1 Parametertabelle

Diese Tabelle nennt die Zahlenwerte der Regeln, soweit sie nicht in den Tabellen von 6.1 (Raster), 6.2 (Stufen der
Zahlenfaktoren), 6.3 (Urteilsstufen) und 7.3 (Profile) stehen. Die Spalte „Schlüssel“ ist der feste Name, unter dem der Text auf
einen Wert verweist; „Herkunft“ bezieht sich auf 9.1, „eigene Setzung“ heißt, dass die Quellen keine Zahl nennen.

Zur Kontrolle vergleicht die Anwendung bei jeder Änderung ihres Programms alle Werte dieser Tabellen (10.1, 10.3, 6.1, 6.2, 6.3,
7.3), ihre Einheiten, die Version im Kopf, die Zahlen der Kurzfassung und die Faktoren in 5.2 mit ihrer Rechnung; jede Abweichung
hält die Änderung auf. Nicht so geprüft sind die Zahlen in Formeln und Beispielen, die Formeln selbst (sie sind durch Rechenbeispiele
belegt, siehe Abnahmefälle der Anwendung), der Fließtext außerhalb der Regeln, ausgeschriebene Zahlwörter und Abschnitt 8 (das
Ergebnis eines Laufs, kein Parameter).

| Schlüssel                            | Wert            | Abschnitt | Herkunft                  | Grund                                                                                                                |
| ------------------------------------ | --------------- | --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `reihe.jahre`                        | 10 Jahre        | 3.1       | Buch                      | Die volle Reihe deckt in der Regel einen Konjunkturzyklus ab                                                         |
| `reihe.mindestjahre`                 | 5 Jahre         | 3.1       | eigene Setzung            | Der Autor hält jüngere Börsenwerte; aus weniger Jahren lassen sich weder Niveau noch Wachstum ablesen                |
| `dividende.kuerzungstoleranz`        | 3 %             | 3.4       | eigene Setzung            | Kleine Rückgänge durch Rundung, Aktienzahl und Wechselkurse sind keine Kürzung                                       |
| `rueckkaeufe.jahre`                  | 5 Jahre         | 3.5       | eigene Setzung            | Die Folien zählen Rückkäufe ohne Methode; mehrere Jahre glätten einzelne Programme                                   |
| `cashflow.jahre`                     | 5 Jahre         | 3.6       | eigene Setzung            | Durchschnitt des Cashflows für den Rückflussdeckel                                                                   |
| `zyklus.mindestjahre`                | 6 Jahre         | 3.6       | eigene Setzung            | Der Median der Reihe gilt nur, wenn sie länger ist als das Durchschnittsfenster                                      |
| `verguetung.ausreisser`              | 100-fach        | 3.6       | eigene Setzung            | Erkennt grobe Datenfehler (Murphy Oil meldet zwei Jahre das Tausendfache); kleinere bleiben unerkannt                |
| `verguetung.ausreisser_mindestjahre` | 3 Jahre         | 3.6       | eigene Setzung            | Ohne genug positive Jahre gibt es keinen verlässlichen Median                                                        |
| `schulden.ebitda_vielfaches`         | 3-fach          | 3.6       | eigene Setzung            | Nettoschulden bis zu diesem Vielfachen des EBITDA gelten als tragbar                                                 |
| `schulden.tilgungsjahre`             | 10 Jahre        | 3.6       | eigene Setzung            | Zeitraum, in dem ein Überhang rechnerisch getilgt wird                                                               |
| `wachstum.obergrenze`                | 8,5 %           | 4.1       | Buch                      | Das Buch setzt bei BASF und Wal-Mart diesen Wert statt der historischen an                                           |
| `wachstum.preissteigerung`           | 2 %             | 4.1, 4.5  | eigene Setzung            | Wachstum aus Preissteigerungen, das kein einbehaltenes Kapital braucht                                               |
| `wachstum.untergrenze`               | −5 %            | 4.2, 4.3  | eigene Setzung            | Das Buch rechnet nur wachsende Titel; ein dauerhafter starker Rückgang ist kein Dauerzustand                         |
| `wachstum.obergrenze_umsatz`         | 3 %             | 4.3       | eigene Setzung            | Ohne bestimmbares Gewinnwachstum nicht mehr als das Dauerwachstum                                                    |
| `wachstum.abschmelzjahre`            | 15 Jahre        | 4.4       | Buch, eigene Setzung      | Buch: höchstens so lange überdurchschnittliches Wachstum; das lineare Abschmelzen ist eigene Setzung                 |
| `wachstum.dauerwachstum`             | 3 %             | 4.4       | Buch, eigene Setzung      | Die einfache Formel der ewigen Rente nur bis hierher; kein Unternehmen wächst dauerhaft schneller als die Wirtschaft |
| `quote.rendite_einbehalten`          | 10 %            | 4.5       | Buch                      | Kap. 5.5: Mindestrendite auf einbehaltenes Kapital; darunter wird das Einbehaltene nur anteilig angerechnet          |
| `waehrung.prognosejahre`             | 4 Jahre         | 5.3       | eigene Setzung            | Mittel der Inflationsprognosen des IWF für die Folgejahre                                                            |
| `bandbreite.rueckfluss`              | 10 %            | 5.2, 7.5  | eigene Setzung            | Macht die Unsicherheit des Rückflusses sichtbar; zugleich Schwelle für die Prüfung der Bewertung                     |
| `bandbreite.wachstum`                | 1 Prozentpunkt  | 5.2, 7.5  | eigene Setzung            | Macht die Unsicherheit des Wachstums sichtbar; zugleich Schwelle für die Prüfung der Bewertung                       |
| `finanzwerte.ersatz_finanzierung`    | 10 %            | 6.4       | eigene Setzung            | Mittlerer Abzug der Nicht-Finanzwerte mit plausibler Rendite                                                         |
| `finanzwerte.ersatz_kapitalrendite`  | 5 %             | 6.4       | eigene Setzung            | Ebenso                                                                                                               |
| `finanzwerte.ersatz_marge`           | 2,5 %           | 6.4       | eigene Setzung            | Ebenso                                                                                                               |
| `risiko.grenze_hervorragend`         | 20 %            | 6.5       | Buch                      | Obergrenze der Klasse „hervorragend“                                                                                 |
| `risiko.grenze_durchschnittlich`     | 50 %            | 6.5       | Buch                      | Obergrenze der Klasse „durchschnittlich“                                                                             |
| `risiko.ausschluss`                  | 75 %            | 6.5, 7.1  | Buch                      | Ab hier Spekulation und ausgeschlossen                                                                               |
| `ausfall.sockel`                     | 0,5 %           | 6.5       | eigene Setzung            | Ausfallwahrscheinlichkeit beim Risikowert 0; Imperial Brands läge damit bei dem Wert der Folien                      |
| `ausfall.je_risikowert`              | 5 %             | 6.5       | eigene Setzung            | Anstieg der Ausfallwahrscheinlichkeit je 100 % Risikowert                                                            |
| `huerde.aufschlag`                   | 0 Prozentpunkte | 7.1       | Interview, eigene Setzung | Aktien müssen Anleihen schlagen; das Risiko steckt schon in Ausfallwahrscheinlichkeit und Positionslimit             |
| `huerde.mindestwert`                 | 0 %             | 7.1       | eigene Setzung            | Keine feste Untergrenze bei sehr niedrigen Zinsen                                                                    |
| `huerde.ersatzwert`                  | 3 %             | 7.1       | eigene Setzung            | Hürde, solange keine Anleiherendite vorliegt                                                                         |
| `pruefung.monate`                    | 12 Monate       | 7.5       | Buch                      | Jährliche Prüfung                                                                                                    |
| `pruefung.risiko`                    | 5 Prozentpunkte | 7.5       | eigene Setzung            | Verschiebung der Zahlenfaktoren, die eine Prüfung auslöst; das Interview nennt „wenige Prozent“                      |

### 10.2 Eigene Setzungen ohne eigenen Zahlenwert

- Zahlungskonvention: Das Rückflussniveau gilt für das kommende Jahr, das Wachstum ab dem zweiten (5.1).
- Lineares Abschmelzen des Wachstums und linearer Anstieg der Ausschüttungsquote über dieselben Jahre bis auf den Bedarf des
  Dauerwachstums (4.4, 4.5).
- Alle Wachstumsgrenzen gelten in Euro-Kaufkraft und werden je Währung um den Inflationsabstand verschoben; die
  Eigenkapitalrendite in der Grenze aus Einbehaltung bleibt nominal (4.6).
- Der Inflationsabstand aus der Prognose der Folgejahre gilt auch zur Beurteilung des historischen Wachstums (4.6).
- Grenze aus Einbehaltung `Einbehaltungsquote · Eigenkapitalrendite + Preissteigerung`, weil hohe Ausschüttung und hohes
  Wachstum sich ausschließen (4.1).
- Einbehaltung und Ausschüttungsquote rechnen mit dem Ausschüttungsniveau, nicht mit dem gedeckelten Rückflussniveau (3.7).
- Rückflussdeckel bei Immobilienwerten aus dem operativen Cashflow (3.6).
- Zyklusregel: bei einem Abzug in Faktor 1 der niedrigere Wert aus Durchschnitt und Median der ganzen Reihe, ältere Jahre um den
  Inflationsabstand hochgerechnet (3.6).
- Abzug der Vergütung in Aktien in den Netto-Rückkäufen (auch bei Finanzwerten, 3.5) und vom Rückflussdeckel (nicht bei
  Finanzwerten, deren Deckel das Gewinnniveau ist, 3.6).
- Wachstum bei nicht bestimmbarem Gewinnwachstum aus dem Umsatz, bei Verlusten am Ende höchstens 0 (4.3).
- Rückkäufe gelten in Faktor 12 wie Dividenden (6.2).
- Bestätigung von Verlusten und Einbrüchen in Faktor 1 durch das EBIT, Vergleich mit dem Median der Vorjahre (6.2).
- Finanzierung an der Ertragskraft statt an der Eigenkapitalquote (6.2).
- Stufen der Urteilsfaktoren (6.3).
- Überfällige Bewertungen bleiben Kandidat; das Buch verlangt die jährliche Prüfung, nennt aber keine Folge (7.1, 7.5).

### 10.3 Werte der Umsetzung und des Rückblicks

Diese Werte gehören nicht zu den Regeln der Strategie, beeinflussen aber, welche Titel die Anwendung und der Rückblick
überhaupt betrachten. Sie werden wie 10.1 geprüft.

| Schlüssel                    | Wert       | Wofür                                                                                                                                                       |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plausibilitaet.rueckfluss`  | 30 %       | Rückflussniveau über diesem Anteil des Kurses gilt als Datenfehler: Ausschluss im Rückblick, Arm „zahlen“ und Datenbestand; Warnung bei beobachteten Titeln |
| `plausibilitaet.kurs_gewinn` | 2-fach     | Kurs unter diesem Vielfachen des Gewinnniveaus gilt als Datenfehler, ebenso                                                                                 |
| `handwert.wachstum_min`      | −20 %      | Kleinstes Wachstum, das von Hand eingegeben werden kann (Euro-Kaufkraft); Eingabeschutz, keine Regel                                                        |
| `handwert.wachstum_max`      | 30 %       | Größtes Wachstum, das von Hand eingegeben werden kann (Euro-Kaufkraft); Eingabeschutz, keine Regel                                                          |
| `rueckblick.marktwert`       | 300 Mio. € | Mindestmarktwert eines Titels im Rückblick und im Arm „zahlen“                                                                                              |
| `rueckblick.kosten`          | 0,25 %     | Kosten je Handelsumsatz im Rückblick                                                                                                                        |
| `rueckblick.bargeldzins`     | 3,4 %      | Verzinsung des Bargelds im Rückblick, wenn kein Zinsverlauf der EZB gilt (`--feste-zinsen` oder fehlender Wert)                                             |
| `rueckblick.einstellung`     | 50 %       | Verlust, der für eine eingestellte Kursreihe angesetzt wird                                                                                                 |
| `rueckblick.zufallslaeufe`   | 200 Läufe  | Läufe der Zufallsauswahl                                                                                                                                    |
| `rueckblick.fenster`         | 36 Monate  | Länge der rollenden Fenster                                                                                                                                 |

## 11. Offene Fragen

Jede offene Frage ist als prüfbare Vermutung formuliert. Geprüft wird mit dem Rückblick gegen die geltende Fassung; das
Ergebnis steht im Änderungsprotokoll, auch wenn die Vermutung verworfen wird. Erst eine angenommene Änderung ändert dieses
Dokument und die Version.

### 11.1 Kalibrierung der Ausfallwahrscheinlichkeit

**Vermutung.** Eine konvexe Zuordnung vom Risikowert zur Ausfallwahrscheinlichkeit, geeicht an historischen Ausfallraten nach
Bonitätsklasse, ordnet besser als die lineare. **Stand.** Quelle R (Abschnitte 2.6 und 4.4) zeigt: Der Sockel liegt für die
besten Unternehmen etwa fünfmal über den Ausfallraten, die Spanne (Faktor 8,5 zwischen Risikowert 0 und dem Ausschluss) ist
enger als in den Daten (Faktor 25 zwischen den Klassen A und B). Eine konvexe Zuordnung passt aber nicht zum einzigen bekannten
Wert des Autors (Imperial Brands in den Folien); deshalb noch nicht geprüft.

### 11.2 Sicherheitsmarge in der Hürde

**Vermutung.** Ein Aufschlag auf die Anleiherendite oder die Bedingung „vorsichtiger Fall schlägt die Anleihe“ verbessert die
Güte, weil die Ausfallwahrscheinlichkeit den Ausfall deckt, nicht den eigenen Schätzfehler (Buffett und Graham verlangen dafür
eine Marge; Quelle R, Abschnitt 2.7). **Stand.** Durchgerechnet am 20.11.2026, ohne Rückblick: Mit 2, 3 oder 4 Punkten Aufschlag
oder mit der Bedingung im vorsichtigen Fall fällt aus der Watchlist jeweils nur Universal Health heraus (Basis 4,2 %,
vorsichtig 3,3 %); das Bargeld im Ziel stiege von 43 % auf 51 %. Im Datenbestand blieben von 2.177 Kandidaten 1.447, 1.105 bzw.
811 (Aufschlag) oder 1.840 (vorsichtiger Fall). Entscheidung offen.

### 11.3 Steuern beim Tausch

**Vermutung.** Eine Tauschschwelle, die die Abgeltungsteuer auf den aufgelaufenen Gewinn der gehaltenen Position einrechnet,
verbessert die Rendite nach Steuern. **Stand.** Nicht geprüft; der Rückblick rechnet ohne Steuern.

### 11.4 Basislimits gegen die Wikifolios

**Vermutung.** Ein Basislimit von 12,5 % (Buch) und Auffüllen nur der oberen Positionen bildet die Depots des Autors genauer ab
als die heutigen Limits. **Stand.** Die Folien (Stand 23.11.2026) zeigen im globalen Depot drei Positionen über dem Basislimit des globalen Profils
(Comcast 8,7 %, Charter 8,3 %, Universal Health 7,8 %) und im fokussierten Charter mit 15,8 %. Mit 12,5 % träfe das Limit
Comcast und Charter fast genau. Der Autor füllt aber nur die oberen Positionen auf; die Strategie füllt jede bis zum Limit und
käme mit 12,5 % auf halb so viele Titel. Nicht geprüft.

### 11.5 Wachstum aus dem Umsatz bei Zyklikern

**Vermutung.** Bei Zyklikern ohne bestimmbares Gewinnwachstum (Sandisk, Höegh Autoliners, Safe Bulkers) ist das Wachstum aus
dem Umsatz zu günstig oder zu streng; Gewinn- und Dividendenniveau wären wie der Cashflow über den Zyklus zu mitteln.
**Stand.** Nicht geprüft.

### 11.6 Reichweite der Zyklusregel

**Vermutung.** Die Zyklusregel erfasst nicht alle Zykliker und ist nicht geeicht: Ein Zykliker ohne Verlust und ohne Einbruch
(etwa ein stetig steigender Gewinn in einem langen Hoch) rechnet weiter mit dem kurzen Durchschnitt; bei kürzeren Reihen (Safe
Bulkers, Höegh Autoliners) ist der Zyklus womöglich nicht abgedeckt; Median und Hochrechnung mit dem Inflationsabstand sind
nicht an Titeln geeicht. Die Regel senkt bei vielen Titeln den Rückfluss unter die Dividende; ob die Dividende bei Zyklikern
ebenfalls auf den Zyklus zu beziehen ist, ist offen. **Stand.** Nicht geprüft.

### 11.7 Deckel bei investierenden Unternehmen und Finanzsparten

**Vermutung.** Der Rückflussdeckel ist zu hart, wo der freie Cashflow niedrig ist, weil investiert wird (Seaboard, Care
Property), oder wo eine Finanzsparte ihn verzerrt (BMW, Mercedes-Benz) oder Buchungseffekte ihn treffen (Archer-Daniels-Midland,
stets positiver Gewinn). Diese Titel sind keine Zykliker im gemeinten Sinn, werden aber von Zyklus- und Tilgungsregel
getroffen. Früher glich die Einbehaltungsrechnung den harten Deckel teilweise aus; seit Einbehaltung und Quote mit dem
Ausschüttungsniveau rechnen (3.7), fällt dieser Ausgleich weg. Bis zu einer Regel hilft ein Rückflussniveau von Hand.
**Stand.** Nicht geprüft.

### 11.8 Tilgungsregel bei dauerhaft hoch verschuldeten Geschäftsmodellen

**Vermutung.** Bei Geschäftsmodellen, die dauerhaft mit hohen Schulden arbeiten (Immobilienwerte, Kabelnetzbetreiber wie
Charter), drückt die Tilgungsregel den Rückfluss zu weit (Charter, Stand 20.11.2026: 4,01 gegen 38,04 je Aktie). **Stand.**
Nicht geprüft.

### 11.9 Rückflussniveau von Hand in Höhe des gedeckelten Vorschlags

**Vermutung.** Ein Rückflussniveau von Hand in Höhe des gedeckelten Vorschlags sollte dieselbe Rendite ergeben wie der
Vorschlag. Heute ergibt es eine höhere, weil die Ausschüttungsquote dann gegen das ungekürzte Gewinnniveau rechnet. **Stand.**
Bekannte Unstimmigkeit, nicht behoben.

### 11.10 Median ohne Trendkorrektur

**Vermutung.** Der Median über die ganze Reihe unterschätzt das heutige Niveau bei Titeln, die trotz eines Einbruchs wachsen;
eine Trendkorrektur würde das beheben. **Stand.** Nicht geprüft.

### 11.11 Zykliker im Risikoraster

**Vermutung.** Das Raster bestraft Zykliker doppelt (Faktor 1 und Zyklusregel). Safe Bulkers kam am 20.11.2026 allein aus Zahlen
auf 68 % und fiele mit jedem Abzug im Urteil über den Ausschluss; der Autor hält den Titel. **Stand.** Nicht geprüft.

### 11.12 Unternehmen ohne Ausschüttung

**Vermutung.** Eine Rendite aus Gewinn und einer später beginnenden Ausschüttung, wie der Autor sie rechnet, erweitert die
Auswahl ohne Schaden. Heute rechnet die Strategie bei einem Rückfluss von 0 keine Rendite. **Stand.** Nicht geprüft.

### 11.13 Analystenschätzungen

**Vermutung.** Gewinnniveau und Prüfung der Bewertung werden mit Analystenschätzungen genauer; der Autor stützt beides darauf.
**Stand.** Nicht geprüft; die Strategie rechnet nur aus Abschlüssen.

### 11.14 Abstand zur Anleiherendite und zum Weltindex

**Vermutung.** Der Abstand der inneren Rendite zur Anleiherendite und zur erwarteten Rendite eines Weltindex ist ein besserer
Maßstab für die Höhe der Investitionsquote als die feste Regel „kein Bargeld“. **Stand.** Nicht geprüft.

### 11.15 Finanzwerte im Datenbestand

**Vermutung.** Als Finanzwert gilt heute der ganze Sektor Finanzdienstleistungen, also auch Zahlungsdienste,
Vermögensverwalter und Beteiligungsgesellschaften. Ohne Cashflow-Deckel schreibt die Strategie bei ihnen die Ausschüttung
fort, auch wo der Markt eine Kürzung erwartet (goeasy, PennantPark: 15 bis 24 % Ausschüttungsrendite). Gegen solche Fälle hilft
der Risikoabzug wenig (höchstens rund 5 Punkte Rendite). Eine niedrigere Plausibilitätsgrenze für die Ausschüttungsrendite von
Finanzwerten oder ein bankspezifischer Vorschlag für die Faktoren 2, 8 und 9 (Eigenkapitalquote, Eigenkapitalrendite) würde die
Reihung im Datenbestand verbessern. **Stand.** Vor dem Ersatzabzug (6.4) standen unter den 200 höchsten Renditen 82 Finanzwerte,
danach 64 (20.11.2026; Mittel der Finanzdienstleister 5,3 % → 4,4 %, Risikowert 27,5 % → 45 %). Die beobachteten Titel sind
nicht betroffen, dort sind die Faktoren beurteilt.

### 11.16 Faktor 12 bei Immobilienwerten

**Vermutung.** Faktor 12 sollte bei Immobilienwerten wie der Rückflussdeckel (3.6) den operativen statt des freien Cashflows
zählen; heute erhalten verlässlich ausschüttende Immobilienwerte wegen ihres negativen freien Cashflows meist den Abzug für
„übrige Fälle“. **Stand.** Bei der Zusammenführung dieses Dokuments bemerkt; nicht geprüft.

### 11.17 Nutzen der Urteilsfaktoren

**Vermutung.** Die sechs Urteilsfaktoren verbessern Rendite je Risiko gegenüber einer Auswahl nur aus Zahlen. **Stand.** Nur
mit dem Vorwärtsprotokoll prüfbar (8.4), frühestens nach etwa zwei bis drei Jahren.

### 11.18 Tauschschwelle des globalen Profils

**Vermutung.** Auch im globalen Profil ist eine höhere Tauschschwelle besser. **Stand.** Nicht geprüft. Ein früher
Rückblick-Lauf mit dem globalen Profil ist zwar gerechnet worden, seine Ergebnisse sind aber nicht festgehalten; die
Tauschschwelle wurde dabei nicht verglichen.
