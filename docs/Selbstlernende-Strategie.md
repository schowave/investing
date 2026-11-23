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
- **Grenzen:** Survivorship-Bias, nur Zahlenfaktoren ohne Urteile, heutige Werte für Hürde und Inflationsabstand, Abschlüsse in
  heutiger Fassung, eine Annahme für eingestellte Titel (Verlust von 50 %, auch bei Übernahmen).

### Stufe 2: Vorwärtsprotokoll

- **Was:** Der Abgleich schreibt zum Monatsanfang das Zielportfolio mit dem Kurs von damals in `forward_log`, in zwei Armen:
  „zahlen" (Datenvorrat, nur Zahlenfaktoren, ohne Eingaben von Hand) und „urteil" (Watchlist mit allen Risikofaktoren, so wie die
  Anwendung vorschlägt). `pnpm run forward` zeigt die Kursrendite seit dem Eintrag und die Überschneidung der Arme.
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
- **Wann:** Wenn die Ergebnisse der Stufen 1 bis 5 eine Entscheidung tragen sollen, für die der Bias zählt. Offen ist die Quelle.

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
