# Selbstlernende Verbesserung der Strategie: Aufbau in Stufen

Stand: 20.11.2026. Status: Entwurf zum Verproben.

Ziel ist, die Strategie „Rückflussrendite" (`docs/STRATEGIE.md`) kontrolliert zu verbessern, ohne sie an Zufall und
Rückschaufehler anzupassen. Die Anwendung schlägt weiter nur vor; jede Änderung geht durch `STRATEGIE.md`, das
Änderungsprotokoll (`docs/STRATEGIE-AENDERUNGEN.md`) und die Tests, nach dem Kreislauf in `AGENTS.md`.

Grundsatz: Erst die Messung vertrauenswürdig machen, dann Parameter suchen, erst zuletzt maschinell lernen. Mit den heutigen
Daten (rund zehn Jahre Abschlüsse, nur etwa drei unabhängige Dreijahreszeiträume) würde ein Lernverfahren vor allem Zufall und
Verzerrungen lernen.

## Entscheidungen

| Entscheidung                                                                         | Stand          | Begründung                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rückblick als eingechecktes, getestetes Werkzeug, zur Prüfung von Änderungen         | beschlossen    | Änderungen an Rechenmodell und Profilen werden vor dem Commit mit `pnpm run backtest` gegen den Stand von `main` verglichen                                                                                      |
| Survivorship-Bias (gescheiterte und übernommene Firmen fehlen) vorerst nicht angehen | zurückgestellt | Aufwand und Datenquelle offen; alle Rückblick-Ergebnisse tragen den Hinweis, dass sie zu gut ausfallen können                                                                                                    |
| Vorwärtsprotokoll aufbauen                                                           | beschlossen    | Einzige Lernbasis ohne Rückschaufehler, besonders für Jev und Webrecherche (die sich rückwirkend nicht prüfen lassen)                                                                                            |
| Maschinelles Lernen des Rankings                                                     | später         | Erst nach den Stufen 1 bis 4; das Signal ist schwach (Auswertung vom 20.11.2026: etwa 1,5 Punkte Folgerendite je Quartal zwischen bestem und schlechtestem Dezil; diese Auswertung ist nicht Teil des Werkzeugs) |

## Stufen

Jede Stufe hat ein Kriterium, an dem sich verproben lässt, ob sie trägt. Fällt es durch, wird die Stufe überarbeitet, bevor die
nächste beginnt.

### Stufe 1: Rückblick als Werkzeug

- **Was:** `pnpm run backtest` rechnet die Strategie rückwirkend (Zielportfolio je Quartal, Euro, Kosten, Vergleich mit
  MSCI World und mit einer Zufallsauswahl) und vergleicht zwei Läufe, etwa `main` gegen eine Änderung. Beschreibung in
  Spezifikation Abschnitt 8.1; Ergebnisse der geltenden Fassung in Strategie 8.
- **Verproben:** Derselbe Stand liefert bei zweimaligem Lauf dieselben Zahlen. Lauf vom 20.11.2026 (Tauschschwelle 3 Punkte, Oktober 2016
  bis November 2026, nach Kosten, Start 100): Strategie +562 %, 20,7 % p. a., Schwankung 25 %, größter Rückgang −34 %, Median der
  Dreijahresfenster +67 %; Zufallsauswahl (Median) +179 %, keiner von 50 Läufen schlägt die Strategie; MSCI World +217 % (Kurse bis zum
  20.11.; bis zum 18.11. waren es +227 %). Die ersten Ad-hoc-Läufe kamen auf +541 %: Das Werkzeug reproduzierte sie zunächst exakt, bis zwei
  Regeländerungen aus dem Review sie verschoben haben (Titel mit einem Split zwischen letztem Abschluss und Stichtag fallen weg; der
  Einstellungsabschlag gilt nur, wenn auch die Tageskurse aufhören). Abnahme für künftige Stände: Abweichungen von diesen Zahlen sind zu
  erklären (Regeländerung, anderer Datenstand), nicht zu tolerieren.
- **Zusätzlicher Schutz:** Der Vergleich zweier Läufe bricht ab, wenn Zeitraum, Enddatum oder Fensterlänge abweichen, und warnt, wenn
  Kosten, Hürde oder Datenbasis abweichen. Beide Läufe gehören in denselben Checkout, mit derselben Datenbank, am selben Tag.
- **Grenzen:** Survivorship-Bias, nur Zahlenfaktoren ohne Urteile, heutiger Inflationsabstand (Hürde und Bargeldzins folgen seit 23.11.2026 dem EZB-Zinsverlauf), Abschlüsse in
  heutiger Fassung, eine Annahme für eingestellte Titel (Verlust von 50 %, auch bei Übernahmen).

### Stufe 2: Vorwärtsprotokoll

- **Was:** Der Abgleich schreibt zum Monatsanfang das Zielportfolio mit dem Kurs von damals in `forward_log`, in zwei Armen:
  „zahlen" (Datenvorrat, nur Zahlenfaktoren, ohne Eingaben von Hand) und „urteil" (Watchlist mit allen Risikofaktoren, so wie die
  Anwendung vorschlägt), und je Arm in `forward_ranking` die Rangliste der besten 100 Kandidaten. `pnpm run forward` zeigt die
  Rendite seit dem Eintrag (Kurs und mit Ausschüttungen) neben dem MSCI World, die Überschneidung der Arme und die Rendite je
  Rangbereich (1 bis 10, 11 bis 30, 31 bis 100).
- **Verproben:** Nach dem ersten Abgleich eines Monats stehen je Arm und Profil Einträge; ein zweiter Abgleich im selben Monat
  ändert nichts. Nach drei Monaten ist der Vergleich der Arme lesbar.
- **Stand 20.11.2026:** Ausgeliefert (Version 882df8a im LXC, Tabelle `forward_log` angelegt, Protokoll noch leer); der erste Eintrag entsteht
  mit dem nächsten nächtlichen Abgleich.
- **Aussagekraft:** Mit zehn bis zwölf Titeln bleibt auch das ein Indiz. Erst nach etwa zwei Jahren ist ein Unterschied der Arme
  mehr als Rauschen; bis dahin dient das Protokoll dem Sammeln, nicht dem Entscheiden.

### Stufe 3: Ziel und Gütemaß festlegen

- **Was:** Ein Gütemaß, das nicht auf einen Rohstoffzyklus passt: Rendite über Bargeld je Schwankung und Rendite je größtem Rückgang,
  nach Kosten, über die rollenden Fenster (Median und schwaches Viertel). Der Bericht stellt es neben Index und Zufallsauswahl
  (die Läufe der Tabelle unten sind ohne beide gerechnet). Es steht im Bericht und im Vergleich
  von `pnpm run backtest` (Spezifikation 8.1, `quality` in `src/backtest/report.ts`) und wird aus den gespeicherten Läufen gerechnet.
- **Verproben (20.11.2026, Läufe ohne Zufall und Index, 2016-10 bis 2026-11):** Das Maß setzt die bekannten Fälle in die erwartete
  Reihenfolge, 5 Punkte fallen im schwachen Viertel und im Fenstermedian zurück:

  | Tauschschwelle | Gesamtrendite | Güte gesamt | Güte Fenstermedian | Güte schwaches Viertel | Rendite/Rückgang (Fenstermedian) | Umschlag |
  | -------------- | ------------- | ----------- | ------------------ | ---------------------- | -------------------------------- | -------- |
  | 0 Punkte       | +313 %        | 0,47        | 0,61               | 0,13                   | 0,66                             | 90 %     |
  | 1 Punkt        | +356 %        | 0,51        | 0,62               | 0,21                   | 0,73                             | 84 %     |
  | 2 Punkte       | +422 %        | 0,57        | 0,68               | 0,24                   | 0,85                             | 76 %     |
  | 3 Punkte       | +562 %        | 0,68        | 0,72               | 0,30                   | 1,05                             | 68 %     |
  | 5 Punkte       | +472 %        | 0,61        | 0,58               | 0,15                   | 0,91                             | 58 %     |

- **Grenzen:** Das Maß misst auf derselben Reihe, an der die Tauschschwelle gewählt wurde; es bestätigt die Wahl nicht, es macht sie nur
  lesbar. Die Fenster überlappen, und Sharpe-artige Zahlen mit drei Jahren Monatswerten sind unsicher. Es ist ein Maßstab zum Vergleichen
  zweier Stände, kein Beleg für eine Renditeerwartung.

### Stufe 4: Kleine, erklärbare Parametersuche

- **Was:** Fünf bis zehn Stellschrauben absuchen: Tauschschwelle, Basislimit, Mindestposition, Gewichte der Risikoabzüge,
  Marktwertgrenze, Hürde. Ergebnis sind Vorschläge für `STRATEGIE.md` (als offene Frage, Strategie 11), kein automatisches
  Übernehmen.
- **Überanpassung vermeiden:** Walk-forward (auf den Jahren bis t suchen, auf den folgenden prüfen, dann weiterrollen); für Parameter,
  die noch nicht gesehen wurden, bleibt der jüngste Zeitraum (ab Oktober 2023) gesperrt. Er ist für die Tauschschwelle schon verbraucht (sie
  wurde mit Läufen über die ganze Reihe gewählt); ihr ehrlicher Holdout ist allein das Vorwärtsprotokoll; mitzählen, wie viele Varianten schon
  probiert wurden (bisher: Tauschschwelle 0, 1, 2, 3, 5, Grenze bei 20 % Rendite, ohne Asien, globales Profil, jährlich).
- **Verproben:** Eine gefundene Einstellung muss im gesperrten Zeitraum (falls noch ungesehen) und im Vorwärtsprotokoll nicht schlechter
  sein als die bisherige.

### Stufe 5: Jev und Webrecherche prüfen

- **Was:** Die Arme „zahlen" und „urteil" des Vorwärtsprotokolls vergleichen. Rückwirkend lässt sich das nicht prüfen: Die
  Recherche liefert den heutigen Stand, und ein Sprachmodell kennt den weiteren Verlauf.
- **Verproben:** Nach zwei bis drei Jahren: Liegt „urteil" im Risiko (Schwankung, größter Rückgang) und in der Rendite je
  Risikoeinheit über „zahlen"? Wenn nicht, ist die Urteilsschicht ihren Aufwand nicht wert.

### Stufe 6: Survivorship beheben (zurückgestellt)

- **Was:** Kurse und Abschlüsse gescheiterter und übernommener Firmen, historische Indexzugehörigkeit, Abschlüsse in der damaligen
  Fassung mit Veröffentlichungsdatum, historische Anleiherenditen und Inflationsprognosen.
- **Machbarkeit für die Kurs- und Abschlussdaten (geprüft 23.11.2026, nur lesend):** EODHD führt eingestellte Titel getrennt
  (`exchange-symbol-list/US?delisted=1`): 33.453 Stammaktien allein in den USA, davon 16.671 an NYSE, NASDAQ, NYSE MKT; der Rest sind
  Freiverkehr und Pink Sheets. Stichproben (SVB Financial, Activision, First Republic, Twitter, Bed Bath & Beyond) haben Abschlüsse
  über 12 bis 38 Jahre (GuV, Bilanz, Cashflow), Monatskurse bis zum Einstellungstag und ein Einstellungsdatum. Der Abruf läge bei etwa
  10 Aufrufen je Titel für die Abschlüsse; für die 16.671 Titel sind das rund 170.000 Aufrufe, also etwa zwei Tage Tagesbudget (rund
  100.000), dazu knapp 700 KB je Antwort. Nicht geprüft: andere Börsen (Europa, Asien), Titel, die in der Liste fehlen, historische
  Indexzugehörigkeit, Abschlüsse in damaliger Fassung. Ein Einlesen würde die Titelzahl in der Datenbank (13.207) etwa verdoppeln
  und gehört vorher auf einen Plan (Auswahl nach Einstellungsjahr ab 2016, Marktwert, Aufrufbudget neben dem Tagesabgleich).
- **Plan für den Pilot (Stand 23.11.2026, noch nicht umgesetzt):**
  - **Die Liste hat kein Einstellungsdatum.** Das Datum steht erst in den Abschlüssen (`General.DelistedDate`), die zehn Aufrufe
    kosten. Auswahl nach Einstellungsjahr braucht daher einen billigen ersten Schritt über die Monatskurse.
  - **Schritt A, Kurse (rund 16.600 Aufrufe, eine Nacht):** Für alle Stammaktien der Liste an NYSE, NASDAQ und NYSE MKT (16.618, ohne
    die Anleihen-Namen aus `isCommonShare`) die Monatskurse ab 2005 holen, ein Aufruf je Titel. Daraus folgen das Ende der Reihe und
    der mittlere Monatsumsatz in USD (Schlusskurs mal Volumen) der letzten zwölf Monate.
  - **Auswahl:** Ende der Reihe ab Januar 2016 und mittlerer Monatsumsatz ab 20 Mio. USD. Der Umsatz ersetzt den Marktwert, den es
    vor Schritt B nicht gibt; die Schwelle ist grob und wird am bestehenden Datenvorrat geeicht (Umsatz gegen Marktwert bei den heute
    geführten Titeln um 300 Mio. €). Die endgültige Marktwertprüfung bleibt beim Rückblick.
  - **Stichprobe (200 zufällige Titel, 153 mit Antwort):** 75 % enden ab 2016, 43 % davon mit mindestens 5 Mio. USD Umsatz, 33 % mit
    mindestens 20 Mio. Hochgerechnet bleiben bei 20 Mio. etwa 5.400 Titel (bei 5 Mio. etwa 7.100). Die Enden verteilen sich über alle
    Jahre ab 2016, mit Häufung 2018 und 2021 bis 2023.
  - **Ergebnis von Schritt A (23.11.2026, 16.618 Aufrufe, keine Fehler bei vier parallelen Anfragen):** 3.657 Titel haben keine Kurse ab
    2005. Bei 9.496 endet die Reihe ab Januar 2016. Davon haben 5.529 mindestens 5 Mio. USD Monatsumsatz, 4.732 mindestens 10 Mio.,
    3.853 mindestens 20 Mio. und 2.869 mindestens 50 Mio.; mit 20 Mio. ist die Hochrechnung der Stichprobe (5.400) also zu hoch
    gewesen. Die Enden der ausgewählten 3.853 verteilen sich auf 2016 bis 2026, mit Häufung 2021 (830). Die Kurse liegen in
    `data/survivorship/monthly-prices.jsonl` (37 MB, nicht in Git); sie sind die Grundlage für Schritt B.
  - **Folge für Schritt B:** Mit 20 Mio. USD sind es rund 38.500 Aufrufe, eine Nacht. Die Umsatzschwelle ist noch nicht geeicht: In der
    Datenbank fehlt das Volumen, die Eichung gegen den Marktwert gelingt erst mit den Abschlüssen. Deshalb zuerst eine Zufallsauswahl
    von rund 150 Titeln über alle Umsatzstufen (etwa 1.500 Aufrufe), um zu sehen, ab welchem Umsatz der Marktwert 300 Mio. € erreicht.
  - **Eichung der Umsatzschwelle (23.11.2026, 150 Titel, je 25 aus sechs Umsatzstufen, 1.500 Aufrufe):** 36 % der Titel haben keine
    Bilanz mit Aktienzahl; sie wären im Rückblick ohnehin übersprungen. Marktwert = Aktienzahl mal Kurs, höchster Wert in den letzten
    zwölf Monaten, Schwelle 330 Mio. USD (300 Mio. €). Anteil der Stufe mit Marktwert über der Schwelle (alle 25 im Nenner):
    unter 1 Mio. USD Umsatz 8 %, 1 bis 5 Mio. 28 %, 5 bis 10 Mio. 8 %, 10 bis 20 Mio. 20 %, 20 bis 50 Mio. 32 %, ab 50 Mio. 56 %. Der
    Umsatz ist also nur ein grober Anzeiger (je Stufe 16 bis 18 Titel mit Wert, die Zahlen schwanken stark). Hochgerechnet auf die
    8.230 Titel mit Reihe ab 2016 und mindestens zwölf Monaten Kursen kämen rund 2.400 über die Schwelle; mit 20 Mio. USD als Grenze
    würden etwa 1.700 davon (70 %) mit rund 3.400 Titeln (34.000 Aufrufe) erfasst, mit 1 Mio. etwa 2.200 (93 %) mit rund 6.000 Titeln
    (60.000 Aufrufe). Der Abruf läuft deshalb nach fallendem Umsatz in Stufen und lässt sich nach jeder Stufe beenden.
  - **Pilot mit den 500 umsatzstärksten (23.11.2026, auf einer Kopie der Datenbank, 4.836 Abrufe):** Von 500 Titeln waren 97 Symbole
    schon an lebende Titel vergeben (Umbenennungen und neue Listings; sie fehlen), 89 hatten keine Jahresabschlüsse, 314 wurden
    geladen. Davon wurden im Rückblick 87 Kandidaten und genau einer gekauft (L Brands, ab Oktober 2019, 11,5 %): eine Umbenennung
    (heute Bath & Body Works), keine echte Einstellung. Gesamtrendite +562 % → +592 %, Güte 0,77 → 0,79, Fenstermedian der Rendite
    +67 % → +70 %, Umschlag unverändert. Es gab keinen einzigen Einstellungsabschlag, `--einstellung 0` und `1` liefern daher dasselbe.
    Lesart: Für die umsatzstärksten Einstellungen ist der Survivorship-Effekt in dieser Messung nicht sichtbar, weil die
    Strategie sie nicht auswählte; das ist **kein Beleg für Entwarnung**, denn 87 von 3.374 Titeln der Stufe sind geladen und die
    Abschlüsse vieler Gescheiterter fehlen oder sind unvollständig.
  - **Schritt B, Abschlüsse, Dividenden, Splits (je Titel rund zehn Aufrufe):** In der Reihenfolge fallender Umsatz. Der erste Teil sind
    die 500 größten (rund 5.000 Aufrufe); danach `pnpm run backtest --vergleich` gegen den Stand ohne diese Titel. Der Rest verteilt
    sich auf höchstens 40.000 Aufrufe je Nacht neben dem Tagesabgleich; dessen Verbrauch ist vorher zu messen. Gesamt rund 70.000 bis
    75.000 Aufrufe, also ein bis zwei Tage Budget.
  - **Technik:** Abrufe mit höchstens vier parallelen Anfragen und Wiederholung (bei acht parallelen scheiterten 47 von 200 vorübergehend).
    Ein Skript `scripts/import-delisted.ts`; die Titel erhalten ein Merkmal „eingestellt“ (Schema, Migration), damit der Tagesabgleich
    und die Oberfläche sie überspringen und der Rückblick sie mitlädt.
  - **Offen vor dem Einlesen:** Die Annahme „Verlust von 50 % nach Ende der Reihe“ passt nicht zu echten Kursreihen: bei einer Übernahme
    endet die Reihe auf dem Übernahmepreis, bei einer Pleite nahe null. Zu klären ist, ob der Abschlag für Titel mit eigener Reihe
    entfällt (dann zählt der letzte Kurs) und wie Titel behandelt werden, deren Reihe vor dem Ende ausdünnt. Außerdem fehlt der Grund
    der Einstellung; die Kurse und Abschlüsse zeigen ihn nur indirekt.
  - **Messgröße:** Wie weit sinken Gesamtrendite, Güte und Median der Fenster, wenn die ausgeschiedenen Titel dabei sind? Der Abstand
    zeigt, wie viel vom Vorsprung Survivorship ist.
- **Wann:** Wenn die Ergebnisse der Stufen 1 bis 5 eine Entscheidung tragen sollen, für die der Bias zählt.

### Stufe 7: Maschinelles Lernen des Rankings (später)

- **Was:** Folgerendite aus innerer Rendite, Risikofaktoren, Region und Branche vorhersagen (Ridge-Regression, dann Gradient
  Boosting), walk-forward.
- **Voraussetzung:** Stufen 1 bis 4 stehen und Stufe 6 ist entschieden. Sonst lernt das Modell Rauschen.

## Leitplanken

- Die Anwendung macht Vorschläge; ein Mensch übernimmt sie über `STRATEGIE.md`, das Änderungsprotokoll und die Tests.
- Kein automatischer Push: ein Push auf `main` ist ein Deployment.
- Jede Strategieänderung nennt im Commit den Vergleich des Werkzeugs (Gesamtrendite, Schwankung, größter Rückgang, Güte, Umschlag,
  Anteil der Fenster, in denen sie besser ist) und die bekannten Grenzen.
- Rückblick-Zahlen sind nie eine Renditeerwartung.
