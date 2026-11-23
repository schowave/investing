# Änderungsprotokoll der Strategie „Rückflussrendite“

Hier steht jede geprüfte Änderung an der Strategie (`docs/STRATEGIE.md`), angenommen oder verworfen, die jüngste zuerst. Ein
Eintrag nennt Datum, Version, die betroffene Regel (Abschnitt der Strategie), was vorher und nachher galt, die Kennzahlen der
Prüfung und die Entscheidung. Kennzahlen stammen aus dem Rückblick (Strategie 8) im Vergleich mit der damals geltenden
Fassung; wo keine Prüfung stattfand, steht das so da.

Ablauf einer Änderung: Die Anregung wird als prüfbare Vermutung unter „Offene Fragen“ (Strategie 11) eingetragen, mit dem
Rückblick gegen die geltende Fassung geprüft und hier festgehalten. Wird sie angenommen, ändern sich Strategie, Rechenmodul
und Tests im selben Schritt, und die Version steigt.

Die Einträge vor Version 1.0 sind rückwirkend aus der Entwicklungsgeschichte zusammengestellt. Sie nennen nur Kennzahlen, die
damals festgehalten wurden; Abschnittsnummern beziehen sich auf Version 1.0.

## 23.11.2026 · verworfen · Schlussdividende dem Vorjahr zuordnen, Sonderdividenden nach Höhe

- **Anlass:** Die Opus-Bewertung von 150 Titeln fand als häufigste Datenfehler Dividenden nach Zahlungsjahr (29 Titel) und
  unmarkierte Sonder- und Zusatzdividenden (27 Titel).
- **Regel:** Strategie 3.4 (Dividendenniveau), offene Fragen 11.21 und 11.22.
- **Geprüft:** (a) Eine Zahlung der Art „Final“ aus dem ersten Halbjahr zählt zum Vorjahr; (b) eine Zahlung über dem
  2,5-Fachen des Medians aller Zahlungen des Titels zählt als Sonderdividende und fällt aus dem Dividendenniveau.
- **Kennzahlen:** Rückblick vom 23.11.2026, Profil fokussiert, 2016-10 bis 2026-11, nach Kosten, gegen den Stand
  (Fenstermedian +67 %, Güte 0,77, im schwachen Viertel 0,35, Umschlag 68 %, größter Rückgang −34 %).
  - (a): Fenstermedian +73 %, besser in 45 % der Fenster (Median der Differenz −1,1 Punkte), Güte 0,72, im schwachen Viertel
    0,29, Umschlag 69 %, größter Rückgang −37 %.
  - (b): Fenstermedian +52 %, besser in 14 % der Fenster (Median der Differenz −24,5 Punkte), Güte 0,54, im schwachen Viertel
    −0,02, Umschlag 63 %, größter Rückgang −33 %.
- **Entscheidung:** beide verworfen. (a) bringt einen Vorsprung nur im Median, nicht in der Mehrheit der Fenster und nicht im
  schwachen Viertel (Strategie 8.3); (b) ist durchweg schlechter. Beide Muster bleiben Hinweise der Anwendung ohne Wirkung auf
  die Rechnung (Spezifikation 4.1).

## 23.11.2026 · verworfen · Mengenprobe bei Rückkäufen, Sprung der Aktienzahl im Rückblick

- **Anlass:** Die Opus-Bewertung der oberen 50 des Datenvorrats fand bei vielen Titeln Rückkäufe, die keine sind (Tilgungen bei
  Stabilus, Rücknahmen von Vorzugsaktien bei Hua Xia, PGAS) und Sprünge der Aktienzahl ohne Split (XYF, NLB, Yancoal).
- **Regel:** Strategie 3.5 und Plausibilitätsprüfung im Rückblick (Strategie 11.20).
- **Vorher:** Netto-Rückkäufe zählen unabhängig von der Aktienzahl; ein Sprung der Aktienzahl ist kein Ausschluss.
  **Geprüft:** (a) Rückkäufe zählen nur, wenn die Aktienzahl vom Jahr vor dem Fünfjahresfenster bis zu seinem Ende um
  mindestens 0,5 % sinkt; (b) zusätzlich gilt ein Sprung der Aktienzahl um das 1,8-Fache ohne passenden Split als unplausibel.
- **Kennzahlen:** Rückblick vom 23.11.2026, Profil fokussiert, 2016-10 bis 2026-11, nach Kosten, gegen den geltenden Stand
  (Fenstermedian +67 %, Güte 0,77, im schwachen Viertel 0,35, Umschlag 68 %, größter Rückgang −34 %).
  - (a) allein: Fenstermedian +67 %, besser in 14 % der Fenster (Median der Differenz −10,6 Punkte), Güte 0,65, im schwachen
    Viertel 0,18, Umschlag 67 %, größter Rückgang −41 %.
  - (a) und (b): Fenstermedian +52 %, besser in 14 % der Fenster (Median der Differenz −16,9 Punkte), Güte 0,60, im schwachen
    Viertel 0,12, Umschlag 65 %, größter Rückgang −41 %.
- **Entscheidung:** beide verworfen; schlechter in der großen Mehrheit der Fenster und im schwachen Viertel (Grenzen aus
  Strategie 8.3). Vermutlich führt der Anbieter die Aktienzahl oft über Jahre unverändert, sodass die Probe echte Rückkäufe
  streicht. Als Warnung der Anwendung (Spezifikation 4.1), ohne Wirkung auf Rückblick und Zielportfolio, bleiben: eine
  Aktienzahl, die zeitweise die Stückelung wechselt (Sprung um mindestens das Dreifache und später zurück; die Fassung mit
  dem 1,8-Fachen traf fast die Hälfte des Datenvorrats, meist echte Kapitalmaßnahmen), ein Split nach dem letzten Abschluss
  und ein Kurs älter als 30 Tage.

## 22.11.2026 · Version 1.0 · Ausgangsfassung

- **Regel:** alle. Erste Fassung von `STRATEGIE.md`, zusammengeführt aus der bisherigen Spezifikation, der Seite „Strategie“
  der Anwendung und dem Rechenmodul. Keine Regel und kein Wert wurde dabei geändert; wo die Quellen sich widersprachen,
  beschreibt das Dokument, was die Rechnung tut.
- **Kennzahlen:** Rückblick vom 22.11.2026, Profil fokussiert, Oktober 2016 bis November 2026, nach Kosten: +562 % (MSCI World
  +215 %, Zufallsauswahl im Median +156 %), 20,7 % pro Jahr, Schwankung 25 %, größter Rückgang −34 %, Umschlag 68 % je
  Umschichtung; Median der Dreijahresfenster +67 %, schlägt den Index in 69 % der Fenster; Güte gesamt 0,68 (Index 0,65), im
  Fenstermedian 0,72, im schwachen Viertel 0,30. Einzelheiten und Grenzen in Strategie 8.
- **Redaktionelle Berichtigungen ohne Wirkung:** Die Spezifikation nannte für den Vergleich der Tauschschwellen „etwa sieben“
  unabhängige Dreijahreszeiträume; bei rund zehn Jahren Daten sind es etwa drei, wie der Stufenplan sagt. Das Dokument nennt
  „etwa drei“ (Strategie 7.4, 8.3).
- **Entscheidung:** angenommen als Ausgangsfassung.
- **Vorbehalt Vorwärtsprotokoll:** Das Vorwärtsprotokoll führt die Strategieversion ab dieser Fassung. Einträge, die vor dem
  22.11.2026 entstanden sind, tragen nachträglich die Version 1.0. Sie können unter leicht anderen Regeln entstanden sein; die
  technische Rechenversion, die bei jedem Eintrag mitgespeichert ist, zeigt den tatsächlichen Stand.

## 20.11.2026 · rückwirkend, vor der Versionierung · Tauschschwelle im fokussierten Profil

- **Regel:** Strategie 7.3 und 7.4.
- **Vorher:** 1 Prozentpunkt. **Nachher:** 3 Prozentpunkte. Das globale Profil bleibt bei 2 Punkten.
- **Kennzahlen:** Rückblick 2016 bis 2026 mit 0, 1, 2, 3 und 5 Punkten, 29 rollende Dreijahresfenster. 3 Punkte lagen in 76 %
  der Fenster über 1 Punkt (Median der Differenz +5,9 Punkte) und waren bei 7 von 8 Startjahren die beste Schwelle; die mediane
  Dreijahresrendite ist fast gleich (+67 % gegen +66 %), der Vorsprung kommt aus dem Mittel (+90 % gegen +67 %). Der Umschlag
  sank von 95 auf 74 % je Quartal. Nachträglich mit dem Gütemaß des Werkzeugs (Läufe ohne Zufall und Index, 2016-10 bis
  2026-11):

  | Tauschschwelle | Gesamtrendite | Güte gesamt | Güte Fenstermedian | Güte schwaches Viertel | Rendite je Rückgang (Fenstermedian) | Umschlag |
  | -------------- | ------------- | ----------- | ------------------ | ---------------------- | ----------------------------------- | -------- |
  | 0 Punkte       | +313 %        | 0,47        | 0,61               | 0,13                   | 0,66                                | 90 %     |
  | 1 Punkt        | +356 %        | 0,51        | 0,62               | 0,21                   | 0,73                                | 84 %     |
  | 2 Punkte       | +422 %        | 0,57        | 0,68               | 0,24                   | 0,85                                | 76 %     |
  | 3 Punkte       | +562 %        | 0,68        | 0,72               | 0,30                   | 1,05                                | 68 %     |
  | 5 Punkte       | +472 %        | 0,61        | 0,58               | 0,15                   | 0,91                                | 58 %     |

  Die Umschlagszahlen der ersten Läufe (95 und 74 % je Quartal) und des Werkzeugs (84 und 68 % je Umschichtung) stammen aus
  verschiedenen Rechnungen und sind nicht direkt vergleichbar.
- **Grenzen:** fehlende gescheiterte Unternehmen, nur Zahlenfaktoren, überlappende Fenster, heutige Hürde und
  Inflationsprognose; die Schwelle wurde nach einem ersten Dreijahrestest ausgewählt. Gestützt ist allenfalls „höher als 0 bis
  1 Punkt“.
- **Entscheidung:** angenommen. **Verworfen** im selben Vergleich: 0, 2 und 5 Punkte (Kennzahlen oben).

## 20.11.2026 · rückwirkend, vor der Versionierung · Weitere Varianten der Auswahl

- **Regel:** Strategie 7.
- **Geprüft:** eine Grenze bei 20 % innerer Rendite, eine Auswahl ohne Asien, jährliches statt vierteljährliches Umschichten,
  ein Lauf mit dem globalen Profil.
- **Kennzahlen:** nicht festgehalten. (Die damalige Spezifikation nannte das globale Profil „nicht getestet“; der Stufenplan
  zählt einen Lauf mit ihm zu den probierten Varianten.)
- **Entscheidung:** nicht übernommen. Die Läufe zählen als bereits gesehene Varianten für spätere Parametersuchen.

## 20.11.2026 · rückwirkend, vor der Versionierung · Ersatzabzug für Finanzwerte

- **Regel:** Strategie 6.4.
- **Vorher:** Bei Finanzwerten zählten die offenen Faktoren 2, 8 und 9 in der vorläufigen Rechnung als 0. **Nachher:**
  Ersatzabzug 10 %, 5 % und 2,5 %, bis ein Urteil gesetzt ist; der Ausschluss ab 75 % prüft ohne ihn.
- **Kennzahlen:** an einer Kopie des Datenbestands: Finanzwerte unter den 200 höchsten Renditen 82 → 64; Mittel der
  Finanzdienstleister 5,3 % → 4,4 %, Risikowert 27,5 % → 45 %. Kein Rückblick.
- **Entscheidung:** angenommen.

## 20.11.2026 · rückwirkend, vor der Versionierung · Wachstumsgrenzen in Euro-Kaufkraft, Zyklusregel, Vergütung im Deckel

- **Regel:** Strategie 3.5, 3.6, 3.7, 4.6.
- **Vorher:** Wachstumsgrenzen nominal in jeder Währung; Rückflussdeckel immer aus dem Fünfjahresdurchschnitt; Vergütung in
  Aktien nicht abgezogen; Einbehaltung mit dem gedeckelten Rückfluss. **Nachher:** Grenzen in Euro-Kaufkraft, je Währung
  verschoben; bei einem Abzug in Faktor 1 der niedrigere Wert aus Fünfjahresdurchschnitt und Median der ganzen Reihe;
  Vergütung vom Deckel und in den Netto-Rückkäufen abgezogen; Einbehaltung mit dem Ausschüttungsniveau.
- **Kennzahlen:** mittlere Rendite je Berichtswährung vorher → nachher: Euro 2,96 % → 2,96 %, Franken 3,61 % → 2,83 %, Tenge
  7,51 % → 9,65 %, argentinischer Peso −4,29 % → 5,63 %. Zyklusregel: Energie unter den 200 höchsten Renditen 20 → 17, Rohstoffe
  14 → 13; einzelne Titel sinken stark (Olin 26,6 % → 7,6 %, Evergreen Marine 20,2 % → 10,0 %). Einbehaltung mit dem
  Ausschüttungsniveau: 394 Titel, im Mittel −1,1 Punkte. Insgesamt sinkt die mittlere Rendite der Nicht-Finanzwerte im
  Datenbestand von 3,7 % auf 3,2 %; das Zielportfolio der Watchlist bleibt unverändert, 12 von 22 Titeln wechseln den Rang.
  Kein Rückblick.
- **Entscheidung:** angenommen. **Verworfen:** der zuerst gebaute Zehnjahresdurchschnitt statt des Medians, weil einzelne Jahre
  mit Buchungseffekten ihn zerstören.

## 20.11.2026 · rückwirkend, vor der Versionierung · Wachstum aus dem Umsatz

- **Regel:** Strategie 4.3.
- **Vorher:** Bei nicht bestimmbarem Gewinnwachstum kein Vorschlag. **Nachher:** Vorschlag aus dem Umsatzwachstum, begrenzt auf
  −5 % bis 3 %, bei Verlusten am Ende höchstens 0 %.
- **Kennzahlen:** Vorher blieb gut ein Drittel der Titel ohne Wachstum, Rendite und Rang. Kein Rückblick.
- **Entscheidung:** angenommen.

## 20.11.2026 · rückwirkend, vor der Versionierung · Immobilienwerte, schrumpfender Gewinn

- **Regel:** Strategie 3.6, 4.2, 5.2.
- **Vorher:** Rückflussdeckel bei Immobilienwerten aus dem freien Cashflow. **Nachher:** aus dem operativen Cashflow. Bei
  schrumpfendem Gewinn ist der Vorschlag das gemessene Wachstum bis −5 %; im vorsichtigen Fall der Bandbreite keine
  Untergrenze bei 0.
- **Kennzahlen:** nicht festgehalten.
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Kurze Historie, Prüfung der Bewertungen

- **Regel:** Strategie 3.1, 7.5.
- **Vorher:** Vorschläge nur bei zehn Geschäftsjahren. **Nachher:** ab fünf Jahren aus der kürzeren Reihe, ohne Bonus und
  Nachlass für stetige Gewinne. Neu: Prüfung der Bewertung nach zwölf Monaten oder bei Verschiebungen über die Bandbreite.
- **Kennzahlen:** nicht festgehalten. Anlass: Der Autor hält jüngere Börsenwerte (Höegh Autoliners, Kaspi).
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Zahlenfaktoren am Buch geeicht

- **Regel:** Strategie 6.2 (Faktoren 1, 2 und 12).
- **Vorher:** Faktor 1 aus dem Gewinn allein; Faktor 2 aus Nettoschulden zum EBITDA ab dem Einfachen, Schulden und
  Zinsdeckung addiert; Faktor 12 bei Banken und Versicherern aus dem freien Cashflow. **Nachher:** Verlust und Einbruch nur
  mit Bestätigung durch das EBIT, Vergleich mit dem Median der drei Vorjahre; Nettoschulden zum operativen Cashflow (3- bis
  6-fach), höherer statt addierter Abzug, Nachlass bei stetigen Gewinnen; Gewinnjahre bei Finanzwerten.
- **Kennzahlen:** nicht festgehalten. Anlass: Die US-Steuerreform 2017 machte Coca-Cola und Charter zu Titeln mit halbiertem
  Gewinn; Buch: Wal-Mart 5 % statt 14 % in der Finanzierung.
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Urteilsstufen, steigende Ausschüttungsquote, Auswahl nach Rang

- **Regel:** Strategie 4.5, 6.3, 7.1.
- **Vorher:** Hürde Anleiherendite plus 5 Punkte, mindestens 7 %, schon im vorsichtigen Fall; feste Ausschüttungsquote;
  Urteilsstufen ohne Eichung am Buch. **Nachher:** Auswahl nach Rang mit der Anleiherendite als Hürde ohne Aufschlag im
  Basisfall; steigende Ausschüttungsquote, soweit einbehaltene Gewinne Wachstum gebracht haben; Urteilsstufen nach dem Buch
  (erfüllte Anforderung 0 %, ein Abzug braucht einen benannten Befund; Prognosen meinen Planbarkeit).
- **Kennzahlen:** Anlass: Im Depot des Autors standen 17 von 18 Titeln auf „verkaufen“; die alte Hürde ließ nur einen von
  18 Titeln zu und hielt drei Viertel bar. Kein Rückblick.
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Rückkäufe, Währung, Schulden

- **Regel:** Strategie 3.6, 4.1, 5.3, 6.2, 7.1.
- **Nachher:** Wachstum auch am Gesamtunternehmen gemessen, damit Rückkäufe nicht doppelt zählen; Renditen in Fremdwährung um
  den Inflationsabstand gekürzt; Tilgung überhöhter Schulden vom Rückfluss abgezogen; Finanzierung an der Ertragskraft
  gemessen; Hürde folgt der Anleiherendite (mit Aufschlag, im vorsichtigen Fall; später geändert, siehe oben).
- **Kennzahlen:** nicht festgehalten.
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Grenzen für Wachstum und Gewinnniveau

- **Regel:** Strategie 3.3, 4.1.
- **Nachher:** Wachstum höchstens das Umsatzwachstum; Gewinnniveau höchstens der höchste Gewinn der letzten drei Jahre.
- **Kennzahlen:** nicht festgehalten.
- **Entscheidung:** angenommen.

## 19.11.2026 · rückwirkend, vor der Versionierung · Erste Fassung

- **Regel:** alle. Erste Spezifikation und Rechnung nach Folien und Buch: innere Rendite, Eingabevorschläge, Risikoraster,
  Zielportfolio.
- **Kennzahlen:** keine; geprüft an den Abnahmefällen der Spezifikation (Imperial Brands, BASF, Wal-Mart).
- **Entscheidung:** angenommen.
