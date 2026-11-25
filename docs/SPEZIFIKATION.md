# Spezifikation: Anwendung zur Strategie „Rückflussrendite“

Stand: 23.11.2026.

## 1. Zweck und Verhältnis zur Strategie

Privates Entscheidungswerkzeug für eine Handvoll bekannter Nutzer. Es bewertet Aktien einer gepflegten Watchlist nach ihrer
inneren Rendite, stuft ihr Risiko ein, leitet daraus ein Zielportfolio ab und zeigt die Abweichung zum tatsächlichen Bestand.
Die Anwendung führt keine Orders aus und gibt keine öffentlichen Empfehlungen. Sie ist keine Anlageberatung; alle
Bewertungen beruhen auf den Annahmen der Nutzer.

Was die Strategie tut und warum, steht in [`docs/STRATEGIE.md`](STRATEGIE.md); verwiesen wird darauf als „Strategie 4.5“.
Dieses Dokument beschreibt, wie die Anwendung die Strategie umsetzt: Daten und Anbieter, Vorschlag und Übersteuerung in der
Oberfläche, Vorschläge für die Urteilsfaktoren, Arbeitsablauf, Prüfungen, Betrieb und Werkzeuge. Es wiederholt die Regeln
der Strategie nicht.

- **Maßgeblich:** Für Regeln und Werte gilt `STRATEGIE.md`; der Code folgt. Keine Regeländerung ohne Änderung an
  `STRATEGIE.md` im selben Commit, mit Eintrag in [`docs/STRATEGIE-AENDERUNGEN.md`](STRATEGIE-AENDERUNGEN.md).
- **Parameter je Version fest:** Die Werte aus Strategie 10 sind Konstanten im Rechenmodul (`src/calc`, `src/valuation`), nicht
  je Nutzer einstellbar. Die Tabelle `settings` hält nur Betriebszustand (nächtlicher Abgleich an oder aus, erledigte Einträge
  des Vorwärtsprotokolls). Übersteuerbar sind nur die Eingaben je Aktie (Abschnitt 2).
- **Zwei Versionsnummern:** `STRATEGY_VERSION` (`src/valuation/run.ts`) ist die Version im Kopf von `STRATEGIE.md`; sie steigt
  bei jeder Änderung mit Wirkung auf das Zielportfolio und steht auf der Seite „Strategie“ und im Vorwärtsprotokoll.
  `CALC_VERSION` daneben ist der technische Auslöser fürs Neurechnen gespeicherter Tagesstände; sie steigt auch bei Änderungen
  ohne Wirkung auf das Zielportfolio.
- **Abgleich von Dokument und Code:** `src/valuation/strategyDocument.test.ts` liest alle Tabellen mit den Spalten
  „Schlüssel“ und „Wert“ (Strategie 6.2, 10.1, 10.3), das Risikoraster (6.1), die Stufen der Urteilsfaktoren (6.3), die Profile
  (7.3), die Faktoren der Bandbreite (5.2), die Zahlen der Kurzfassung (1) und die Version und vergleicht sie mit den Konstanten
  und dem Verhalten des Rechenmoduls; der jüngste Eintrag im Änderungsprotokoll muss zur Version gehören. Je Schlüssel ist die
  Einheit festgelegt („12 Jahre“ statt „12 Monate“ scheitert). Fenster („die letzten n Jahre“) werden in beide Richtungen
  geprüft, mit Testreihen, bei denen n − 1, n und n + 1 verschiedene Ergebnisse geben. Jedes Feld der Parameterobjekte
  (`DEFAULT_GROWTH_PARAMS`, `DEFAULT_RETURN_PARAMS`, `DEFAULT_DEBT_PARAMS`, `DEFAULT_SCENARIO_SPREAD`,
  `DEFAULT_PROBABILITY_PARAMS`, `FINANCIAL_STAND_INS`, `DEFAULT_OPTIONS` des Rückblicks, Profile) muss einem Schlüssel
  zugeordnet sein. Außerdem dürfen die Absätze „Regel“ in Strategie 3 bis 7 keine Zahlen mit Einheit enthalten (sie verweisen
  auf die Tabellen), und jeder Unterabschnitt dort hat alle vier Rubriken. **Nicht geprüft:** Zahlen in Formeln und Beispielen,
  die Formeln selbst (dafür die Abnahmefälle in Abschnitt 7), ausgeschriebene Zahlwörter, Begründung, Herkunft und Schwächen,
  Abschnitte 8, 9 und 11 sowie Stützpunkte, die im Code nur als Teil einer Formel stehen (Hochrechnung um die halbe Reihe, die
  Kontrolle über fünf Jahre und die Obergrenze aus drei Jahren beim Gewinnniveau).
- **Abdruck je Version:** Was der Abgleich nicht sieht (geänderte Logik ohne neuen Wert, geänderte Werte ohne neue Version),
  fängt `src/valuation/strategyImprint.test.ts`. Er rechnet elf Beispielaktien (ruhig, wachsend, schrumpfend, gedeckelt,
  verschuldet, zyklisch in Fremdwährung, Bank, jung, Dividendenkürzung, ohne Ausschüttung) durch Vorschlag, Bewertung und das
  Zielportfolio beider Profile mit und ohne bindende Hürde und vergleicht Ergebnis und alle Parameter auf zwölf Stellen mit
  `src/valuation/imprints/strategie-<Version>.json`. Eine neue Version schreibt ihren Abdruck mit `mise run strategy:imprint`;
  ändert sich der Abdruck einer bestehenden Version, ist das eine Änderung ohne Wirkung auf das Zielportfolio und wird im Commit
  so gekennzeichnet (nächster Punkt).
- **Prüfung beim Commit:** Der Hook `commit-msg` (`scripts/check-commit.ts`, Regeln in `src/repo/commitDocs.ts`) lehnt einen
  Commit ab, der Regel-Code ändert (`src/calc`, `src/judgement/factors.ts`, die Regel-Dateien in `src/valuation` bis zum Abgleich
  von Bestand und Ziel), ohne `STRATEGIE.md` mitzuändern, oder Werkzeuge (`src/backtest`, Vorwärtsprotokoll, `scripts/backtest.ts`,
  `scripts/forward.ts`) ohne `STRATEGIE.md` oder diese Spezifikation – es sei denn, die Nachricht enthält eine Zeile „Strategie:
  ohne Wirkung“. Steigt `STRATEGY_VERSION`, verlangt er außerdem das Änderungsprotokoll, den Abdruck genau dieser Version und
  die Kennzahlen des Rückblicks (Median, Anteil besserer Fenster, Güte, Umschlag, größter Rückgang) in der Nachricht. Gelöschte
  Abdrücke lehnt er ab. Bei `--amend` prüft er den ganzen neuen Commit; Merges und `fixup!`/`squash!` lässt er durch.
  Ob der Inhalt der Dokumente stimmt, prüft der Hook nicht; er erinnert nur.
- **Quellen der Strategie und ihre Dateien:** Strategie 9.1 nennt die Quellen für Leser ohne Zugang zum Repository; hier die
  Ablage: Interview im Podcast „Bulle & Mensch“ → `docs/Interview.md`; Gespräch Börsenradio → `docs/podcast.md`; Webinar → `docs/webinar.md`; Quelle R
  (eigene Recherche) → `docs/Recherche-Bewertungsansatz.md` (Abschnittsnummern wie in Strategie zitiert). Folien „Yield Investing“ (Stand 23.11.2026), Buch und
  Wikifolios liegen nicht im Repository.

## 2. Eingaben in der Anwendung: Vorschlag und Übersteuerung

Jede Eingabe einer Aktie (Rückflussniveau, Wachstum, 15 Risikofaktoren) hat einen automatischen Vorschlag nach Strategie 3,
4 und 6 und einen optionalen Wert von Hand (Strategie 3.8). Es gilt der Wert von Hand, wenn er gesetzt ist; die Oberfläche
zeigt immer, welcher gilt. Neue Fundamentaldaten ändern nur den Vorschlag und erzeugen einen Hinweis, sie überschreiben nie
einen Wert von Hand.

- **Eingabeformat:** Rückflussniveau als Betrag je Aktie in Berichtswährung, alles andere in Prozent (Komma erlaubt).
  Risikofaktoren innerhalb von Bonus und Höchstabzug. Wachstum von −20 bis 30 % in Euro-Kaufkraft, in der Berichtswährung nach
  Strategie 4.6 verschoben und nach innen auf Zehntel gerundet (`growthInputBounds`).
- **Gewinnniveau:** kommt immer aus dem Vorschlag und lässt sich nicht von Hand setzen.
- **Splits:** Ein Rückflussniveau von Hand, das vor einem Aktiensplit gesetzt wurde, wird durch dessen Verhältnis geteilt; die
  Aktienseite nennt die Bereinigung.
- **Hinweise der Bewertung:** Die Aktienseite nennt, wenn der Rückflussdeckel greift (mit Ausschüttungsniveau und Deckel), wenn
  er erst durch den Abzug der Vergütung in Aktien greift, wenn die Zyklusregel den Median nimmt (mit beiden Werten), wenn die
  Reihe kürzer als zehn Jahre ist (bei Zyklikern mit dem Hinweis, dass der Zyklus womöglich nicht abgedeckt ist), wenn der
  Gewinn schrumpft, wenn das Wachstum aus dem Umsatz kommt, wenn das Eigenkapital negativ ist, wenn hohe Schulden getilgt
  werden, wenn eine Inflationsprognose fehlt, und die nach Strategie 4.6 verschobenen Grenzen.
- **Ausschüttungsquote:** Die Aktienseite nennt die angenommene Quote („steigt von 9 % auf 67 %“). Greift ein Deckel, nennt
  sie dazu das Ausschüttungsniveau, auf das sich die Quote bezieht, und sagt, dass das gedeckelte Rückflussniveau im selben
  Verhältnis mitwächst. Intern rechnet die Quote dann mit einem im Verhältnis gedeckelt zu ungedeckelt gekürzten Gewinnniveau
  (`payoutEarningsLevel`), was dieselbe Quote ergibt wie Strategie 4.5.
- **Rendite bei alternativen Kursen:** Die Aktienseite zeigt die innere Rendite im Basisfall bei Kursen über und unter dem
  heutigen (wie auf Folie 7 des Vorbilds), damit sichtbar ist, wie stark die Rendite am Kurs hängt.
- **Bandbreite:** Die Rangliste zeigt neben dem Basisfall die Spanne aus vorsichtigem und optimistischem Fall.
- **Gleicher Abstand überall:** Vorschlag für das Wachstum, Rendite mit Bandbreite, Rendite bei alternativen Kursen,
  steigende Quote, Screening im Datenvorrat und Neuberechnung verwenden denselben Inflationsabstand.
- **Warnungen ohne Sperrwirkung (geplant, nicht umgesetzt):** ein Rückflussniveau von Hand über dem Gewinnniveau oder über dem
  freien Cashflow je Aktie (nicht dauerhaft tragbar); ein Wachstum von Hand über 8,5 % oder über der Grenze aus Einbehaltung
  (in Fremdwährung verschoben). Heute prüft die Oberfläche nur den erlaubten Bereich.
- **Tag der Bewertung (Strategie 7.5):** der Tag, an dem zuletzt ein Wert von Hand gespeichert wurde. Speichern ohne Änderung
  bestätigt die Bewertung mit dem heutigen Datum und hält die Vorschläge dieses Tages als Tagesstand fest. Rangliste,
  Aktienseite und der Zähler in der Navigation zeigen den Hinweis „prüfen“; die Aktienseite nennt, was sich verschoben hat, und
  sagt dazu, wenn die Rechnung (`CALC_VERSION`) sich seither geändert hat. Für den Kursrückgang (`pruefung.kursrueckgang`)
  vergleicht sie den Kurs des Tagesstands vom Tag der Bewertung, um spätere Splits bereinigt, mit dem heutigen, beide in der
  Berichtswährung; bei Titeln mit Kurs in anderer Währung steckt der Wechselkurs mit darin. Die Gewinnschätzungen
  (`pruefung.schaetzung`) stehen in der gespeicherten Fundamentals-Antwort des Anbieters (`Earnings.Trend`, Zeiträume `0y` und
  `+1y`, Stand heute und vor 7, 30, 60, 90 Tagen); „heute“ ist der Tag des Abrufs, neue Abrufe braucht der Auslöser nicht. Er
  wird nur für Titel mit einer Bewertung von Hand gelesen.
- **Unvollständig bewertete gehaltene Titel:** bekommen keinen Verkaufsvorschlag, sondern den Hinweis „erst bewerten“, außer
  der Risikowert aus den gesetzten Faktoren erreicht auch nach Abzug der größtmöglichen Urteilsboni noch den Ausschluss
  (`MAX_JUDGEMENT_BONUS` in `src/valuation/portfolioView.ts`; Strategie 7.4).

## 3. Urteilsfaktoren: Vorschläge von Jev

Für die Faktoren 5, 7, 10, 11, 13 und 15 kann auf der Aktienseite oder mit `pnpm run judge` ein Vorschlag geholt werden. Die
Stufen und der Maßstab stehen in Strategie 6.3; im Code stehen sie auf Englisch in `src/judgement/factors.ts`, weil Jev und
die Unterlagen englisch sind.

1. **Recherche (optional):** Claude (`claude-opus-5-5` mit Websuche) sammelt datierte Belege zu den sechs Faktoren, ohne sie
   zu bewerten. Ohne `ANTHROPIC_API_KEY` bricht `pnpm run judge` ab; ohne Recherche einstufen ist eine bewusste Wahl
   (`--ohne-recherche`).
2. **Mitteilungen an die SEC:** Bei Titeln mit CIK (US-Werte, aus den Rohdaten von EODHD) holt `src/judgement/edgar.ts` die
   Mitteilungen der letzten zwölf Monate von EDGAR, kostenlos und ohne Sprachmodell (User-Agent `SEC_USER_AGENT`). Genommen
   werden 8-Ks mit ausgeschriebenen Punkten und Formulare mit außergewöhnlichem Inhalt (Berichtigungen, verspätete Abschlüsse,
   13D, Übernahmeangebote, Delisting). Von bis zu acht 8-Ks mit gewichtigen Punkten (z. B. 1.02, 4.02, 5.02, 8.01) geht der
   Anfang des Textes mit. Fällt EDGAR aus, wird ohne eingestuft.
3. **Einstufung:** Jev von TypeSafe AI (`jev-latest`, Schlüssel `TYPESAFE_API_KEY`) bekommt Stammdaten und Beschreibung, zehn
   Geschäftsjahre, die Insidergeschäfte der letzten drei Jahre, die Mitteilungen an die SEC und die Recherche. Die
   Gewinnüberraschungen des Anbieters gehen nicht mit: Außerhalb der USA mischen sie Einheiten und sehen dann wie grobe
   Verfehlungen aus. Je Faktor wählt Jev unter den festen Stufen und nennt für jede eine Wahrscheinlichkeit.
4. **Vorschlag:** der mit diesen Wahrscheinlichkeiten gewichtete Abzug, gerundet auf 0,5 Prozentpunkte und auf Bonus und
   Höchstabzug begrenzt, dazu die Sicherheit laut Jev. Der gewichtete Abzug liegt über der wahrscheinlichsten Stufe, weil die
   Abzüge größer sind als die Boni.

Regeln:

- Ein Jev-Vorschlag ist kein Urteil. Er füllt das Eingabefeld vor, die Bewertung bleibt aber unvollständig, bis gespeichert
  wird. Ein unverändert übernommener Vorschlag wird in der Notiz vermerkt.
- Die Stufen haben eine Fassung (`LEVELS_VERSION`). Nach einer Änderung gelten gespeicherte Vorschläge der alten Fassung nicht
  mehr; die Aktienseite bittet um eine neue Einstufung, `pnpm run judge --offen` holt sie nach. Eine Änderung der Stufen ist
  eine Änderung der Strategie (Strategie 6.3) und erhöht auch `STRATEGY_VERSION`.
- Ob der Nutzer die Branche versteht (Faktor 5), beurteilt Jev nicht.
- Je Aktie gilt die jüngste Einstufung; Recherche und Quellen bleiben gespeichert.
- Für die Faktoren 2, 8 und 9 bei Finanzwerten gibt es keinen Jev-Vorschlag.
- Die Aktienseite rät, die Lage selbst zu prüfen, wenn der Kurs mindestens 40 % unter dem 52-Wochen-Hoch liegt, zwei der letzten
  vier Quartale mehr als 15 % unter der Gewinnschätzung lagen oder der Umsatz des letzten Quartals mindestens 15 % unter dem
  Vorjahresquartal liegt (nicht bei Finanzwerten). Das ist nur ein Hinweis, kein Abzug und nicht Teil der Strategie
  (`src/judgement/situation.ts`).
- Bewertungen von außen, etwa durch ein Modell wie Opus: `pnpm run bewertung:dossier` schreibt je Aktie alles, was zur
  Bewertung gehört, als JSON; `pnpm run bewertung:setzen` übernimmt Ergebnisdateien als Werte von Hand (Notiz
  „Opus-Einschätzung“; ändert ein Mensch den Wert, fällt die Notiz weg), mit derselben Prüfung wie die Aktienseite und passender Berichtswährung, und rechnet danach Datenvorrat
  und Portfolios neu (`src/valuation/assessmentFile.ts`; Ablauf im Skill `.claude/skills/bewertung`). Davor kann ein billigeres
  Modell vorfiltern: `pnpm run bewertung:vorfilter` setzt dessen Ergebnisdateien als Werte von Hand (Notiz
  „Haiku-Einschätzung“), nur wo kein anderer Wert von Hand steht und nicht bei Titeln mit Opus-Einschätzung, und verwirft Titel,
  deren Risikowert ohne Ersatzabzüge den Ausschluss plus 10 Punkte erreicht; nur der Rest wird mit Opus bewertet. Eine
  fehlerhafte Datei setzt nichts. Die Listen stehen zusätzlich in `vorfilter.json` im Verzeichnis der Dateien. Setzt Opus einen
  Titel, fallen dessen übrige Haiku-Werte weg. Der Datenvorrat zeigt die Herkunft „Haiku“ und filtert nach „nur von Haiku
  vorgefilterte“ (Titel ohne Opus-Einschätzung); die Aktienseite zeigt je Wert, ob er von Opus, Haiku, Jev, von Hand oder aus den
  Zahlen stammt, und in der Karte „Wer bewertet hat“ eine Übersicht.
- Die Rangliste nimmt ausgewählte Titel gesammelt aus der Watchlist (Kästchen je Zeile, eines für alle im Kopf); sie gehen
  zurück in den Datenvorrat, ihre Werte von Hand bleiben.

## 4. Daten

- **Fundamentaldaten:** EODHD, Tarif „Fundamentals“, für einen Monat gebucht. Geladen werden alle verfügbaren Geschäftsjahre;
  die vollständige Antwort des Anbieters wird je Aktie unverändert und gepackt aufbewahrt, damit sich weitere Kennzahlen später
  ohne neuen Abruf gewinnen lassen. Von Hand gepflegt wird nichts. Nach Ablauf des Monats gibt es keine neuen Fundamentaldaten
  und keine neuen Titel; die Datenbankdatei ist dann die einzige Kopie (4.2).
- **Felder je Aktie und Geschäftsjahr:** Gewinn je Aktie, Dividende je Aktie, Aktienzahl, Rückkäufe und Ausgabe von Aktien,
  aktienbasierte Vergütung, Umsatz, EBIT, EBITDA, Zinsaufwand, Nettoschulden, Bilanzsumme, Eigenkapital, Umlaufvermögen,
  kurzfristige Verbindlichkeiten, langfristiges Fremdkapital, Zahlungsmittel, operativer Cashflow, freier Cashflow.
- **Gewinn und Dividende je Aktie** werden aus Jahresüberschuss bzw. gezahlter Dividendensumme und Aktienzahl gerechnet (das
  Feld heißt im Code `epsDiluted`, ist aber nicht verwässert). Die fertigen Felder des Anbieters mischen außerhalb der USA
  Einheiten. Die so gerechnete Dividende schwankt leicht; daher die Toleranz in Strategie 3.4.
- **Fehlende Werte:** Nicht gemeldete Dividenden, Rückkäufe, Aktienausgaben und aktienbasierte Vergütung zählen als 0. Fehlt
  die Aktienzahl in der Bilanz eines Jahres, gilt die gemeldete Aktienzahl desselben Jahres (`outstandingShares`), sonst die des
  nächsten Jahres mit Bilanzangabe, höchstens zwei Jahre entfernt (eine einzelne Lücke sperrte sonst die ganze Reihe). Fehlen
  danach Gewinn oder Aktienzahl in einem der Jahre, gibt es keinen Vorschlag. Fehlen die Nettoschulden, stehen für Faktor 2
  langfristiges Fremdkapital minus Zahlungsmittel; fehlt der operative Cashflow der letzten drei Jahre, steht das EBITDA (sonst
  das EBIT) für ihn.
- **Aktienbasierte Vergütung, Datenfehler:** Kein verwertbarer Wert sind fehlende, negative (Vorzeichenfehler des Anbieters,
  etwa Eni) und grob überhöhte Jahre: Ein Jahr über dem Hundertfachen des Medians der positiven Jahre (bei mindestens drei) gilt
  als Datenfehler (Murphy Oil meldet 2021 und 2022 das Tausendfache), die Bewertung nennt das. Erkannt werden nur grobe Fehler;
  ein Fehler um das Zehn- oder Fünfzigfache bleibt unentdeckt. Im Rückflussdeckel zählt ein Jahr ohne verwertbaren Wert nicht
  mit, in den Netto-Rückkäufen als 0 (dort wird je Jahr gerechnet). Ein Vergleich mit dem Umsatz taugt nicht: Unternehmen ohne
  Umsatz (Biotechnik) zahlen real mehr Vergütung, als sie einnehmen.
- **Dividendenhistorie, Splits, Monatskurse:** Mit einem Tarif, der Kursdaten enthält, kommen sie dazu
  (`pnpm run import:history`, drei Abrufe je Aktie; Monatsschlusskurse seit 1990). Die Bewertung nimmt die Dividenden dann aus
  der Historie (ohne Sonderzahlungen, nach Kalenderjahr des Ex-Tags), sofern sie zur Rechnung aus gezahlter Summe und Aktienzahl
  passt (Abstand höchstens Faktor 2). Passt sie nicht und entspricht der Abstand einem Aktiensplit, gelten die Zahlen je Aktie
  als nicht bereinigt, und der Titel wird im Screening ausgeblendet. Die Monatskurse nutzt der Rückblick (Abschnitt 8).
- **Kurse:** Tagesschlusskurse von EODHD. Sperrt der Tarif die Kurshistorie (Tarif „Fundamentals“), liefert die Symbolsuche den
  letzten Schlusskurs; das kostet ebenfalls einen Abruf je Aktie. Mit großem Tagesbudget holt der Abgleich die Schlusskurse je
  Börse in einem Sammelabruf (zählt als 100 Abrufe), sobald dort mindestens 150 Titel anstehen. Ein Kurs kann je Aktie von Hand
  eingetragen werden, solange der Anbieter keinen liefert. Der Kurs wird über die Euro-Referenzkurse in die Berichtswährung
  umgerechnet; Kurse in Unterwährungen (Pence, Agorot, Cent) vorher in die Hauptwährung.
- **Wechselkurse:** EZB-Referenzkurse. Währungen, die die EZB nicht führt (Tenge bei Halyk), kommen von open.er-api.com (frei
  mit Quellenangabe). Portfolios werden in Euro geführt.
- **Bezugsgrößen:** Inflationsprognosen des IWF (World Economic Outlook, `src/data/reference.ts`) je Währung und die Rendite
  der zehnjährigen Euro-Staatsanleihe bester Bonität aus der Zinsstrukturkurve der EZB, beide in `reference_rates`.
- **Stammdaten:** Branche (und GICS-Sektor), Land und Kontinent des Sitzes, Berichts- und Kurswährung, Gründungsjahr. Im
  Datenvorrat kommen sie ungeprüft vom Anbieter (das Land ist bei Hinterlegungsscheinen das der Börse). Das Gründungsjahr wird
  aus dem Beschreibungstext gelesen. Finanzwert ist, was der Anbieter unter „Financial Services“ führt; Immobilienwert, was er
  unter „Real Estate“ führt, sofern der GICS-Sektor nicht widerspricht (der Anbieter führt Anleihen von Versorgern ebenfalls als
  REIT).
- **Datenvorrat:** Neben der Watchlist liegen die Fundamentaldaten der Bestandteile von rund 30 Indizes in der Datenbank (USA
  mit Russell 1000 und 2000 und NYSE Composite, Europa mit STOXX 600, FTSE All-Share, HDAX, SDAX, CAC All Shares und den
  nordischen und polnischen Gesamtindizes, dazu Kanada, Australien, Korea, Brasilien und Mexiko). Seit dem 20.11.2026 kommen
  Taiwan (Taiwan Weighted), China (CSI 300), Thailand (SET) und Indonesien (Jakarta Composite) dazu sowie alle Stammaktien der
  Börsen in Johannesburg, Kuala Lumpur, Athen, Prag, Budapest, Bukarest, Santiago, Lima und Buenos Aires. Die Börsen in
  Mailand, Tokio, Hongkong, Tel Aviv und Indien führt der Anbieter nicht (für die Bestandteile von TA-125 und NIFTY 50 gibt es
  weder Abschlüsse noch Kurse); Mailänder Titel werden über ihre deutsche Notiz geladen, israelische und indische nur über
  Notizen in den USA oder London. Welche Märkte tatsächlich abgedeckt sind, zeigt die Seite „Abgedeckte Märkte“ im
  Datenvorrat. Titel der Watchlist und gehaltene Titel bekommen einen Tagesstand mit Verlauf, der Datenvorrat nur eine
  Momentaufnahme für das Screening.
- **Screening des Datenvorrats:** nur Stammaktien. Ausländische Unternehmen in Buenos Aires notieren als CEDEAR, ein Zertifikat
  mit eigenem Bezugsverhältnis; der Anbieter führt sie als Stammaktie, die Anwendung markiert sie als CEDEAR und lässt sie aus.
- **Einzelne Titel** außerhalb der Indizes werden über ihre ISIN geladen (`pnpm run import:isin`) und kommen auf die Watchlist.
  Die Positionen der Vorbild-Wikifolios (des Buchautors) stehen nur angemeldeten Nutzern offen und lassen sich deshalb nicht
  automatisch abrufen; die Portfolio-Tabelle wird kopiert und als Textdatei übergeben.
- **CSV:** Jede Kennzahl kann per CSV eingetragen und korrigiert werden (`pnpm run import:fundamentals`; bereinigte Gewinne,
  Titel ohne Anbieterdaten).
- **Ist-Positionen:** je Portfolio aus einer Bestandsquelle: von Hand, aus dem Depot bei der comdirect (Abschnitt 6.1) oder aus
  wikifolio. Jede Aktie trägt dazu ihre ISIN aus den Stammdaten des Anbieters oder aus der Aufnahme über die ISIN.
- **wikifolio:** Ein eigenes Wikifolio wird über die offizielle Trading-API angebunden (`src/data/wikifolio.ts`, ADR 0002); die
  Schlüssel (`WIKIFOLIO_CLIENT_API_KEY`, `WIKIFOLIO_USER_API_KEY`) gibt wikifolio nach schriftlicher Zustimmung aus. Das Symbol
  steht am Portfolio; solange es gesetzt ist, lässt sich der Bestand weder von Hand noch aus der comdirect ändern. Der Abgleich
  (`src/jobs/wikifolio.ts`) übernimmt Bargeld und Stückzahlen und ordnet Positionen über die ISIN zu, bei mehreren Notizen nach
  derselben Reihenfolge wie die comdirect (6.1). Positionen ohne passende Aktie stehen mit ihrem Einstandswert unter sonstige
  Anlagen und werden auf der Portfolioseite genannt; aufgenommen werden sie von Hand über den Datenvorrat. Das Anlageuniversum
  (Strategie 7.1) kommt seitenweise mit höchstens 1000 ISINs je Abruf und wird höchstens einmal je Woche geladen; gespeichert
  wird nur die Schnittmenge mit den Aktien der Datenbank. Eine Aktie, die nach dem Laden dazukommt, gilt bis zum nächsten Laden
  als nicht handelbar. Ohne Schlüssel bleibt der letzte Stand stehen. Orders gibt die Anwendung noch nicht auf.
- **Lizenz:** Der Tarif ist ein Privattarif für einen einzelnen Nutzer. Die Daten dürfen lokal gespeichert, aber nicht für
  andere angezeigt werden (9).

### 4.1 Plausibilitätsprüfung

Eine grobe Prüfung, ob Kurs und Fundamentaldaten zusammenpassen (`doubtfulNumbers` in `src/valuation/valuation.ts`). Sie fängt
vor allem Hinterlegungsscheine, deren Zahlen sich auf eine andere Stückelung oder Währung beziehen, trifft aber auch echte
Sonderfälle. Als unplausibel gelten ein Rückflussniveau über 30 % des Kurses, ein Kurs unter dem Doppelten des Gewinnniveaus
und ein Aktiensplit, um den die Zahlen je Aktie offenbar nicht bereinigt sind.

- Im Datenvorrat werden solche Titel ausgeblendet; Rückblick und Vorwärtsprotokoll (Arm „zahlen“) lassen sie aus.
- Titel der Watchlist und gehaltene Titel werden markiert: Die Rangliste stellt sie ans Ende, Aktien- und Portfolioseite nennen
  den Grund, und ihre Rendite zählt nicht in den Schnitt des Portfolios. Aus dem Zielportfolio nimmt die Prüfung sie nicht; das
  Urteil liegt beim Nutzer.
- Nur in der Anwendung, nicht im Rückblick (dort verschlechterte die Prüfung das Ergebnis, Strategie 11.20), gelten zusätzlich
  als unplausibel: eine Aktienzahl, die zeitweise die Stückelung wechselt, also um mindestens das Dreifache springt und später
  ungefähr zurück (Datenfehler; XYF, NLB; echte Kapitalmaßnahmen und Gratisaktien kehren nicht zurück und zählen nicht), und
  ein Split nach dem letzten Abschluss, solange nicht
  erkennbar ist, ob dessen Zahlen bereinigt sind (Sandisk 2026; nur in der Anwendung, der Rückblick überspringt solche Monate
  selbst). Beide bleiben auch bei einem Rückflussniveau von Hand bestehen, weil es die übrigen Werte je Aktie nicht behebt.
  Im Datenvorrat gilt zusätzlich ein Kurs als unbrauchbar, der mehr als 30 Tage hinter dem jüngsten Kurs seiner Börse liegt
  (`plausibilitaet.kursalter`); meist gehört er zu einem umbenannten oder eingestellten Kürzel (ASGN → EFOR). Veralten alle
  Kurse einer Börse gemeinsam (Abgleich ausgesetzt, ältere Kopie der Datenbank), gilt das nicht.
- Hinweise „Daten prüfen“ auf der Aktienseite (`src/valuation/dataChecks.ts`, nur Anwendung, ohne Wirkung auf die Rechnung):
  Berichtswährung passt weder zum Sitzland noch ist sie USD, EUR oder GBP (HDFC in TWD); Finanzwert nach GICS oder ohne Sektor,
  aber nicht als Finanzwert geführt (Kaspi, Bank of Cyprus); Dividendenhistorie endet mehr als ein Jahr vor dem letzten
  Abschluss, obwohl die letzten beiden Abschlüsse gezahlte Dividenden ausweisen (fehlende Zahlungen wie bei Acsion oder ein
  Abschluss, der Zinsen und Minderheiten mitzählt, wie bei chinesischen Titeln); Netto-Rückkäufe über 5 % des Kurses je Jahr bei nicht gesunkener
  Aktienzahl (Stabilus, PGAS); EBIT über dem Umsatz, fehlender operativer Cashflow in mindestens zwei, Schulden ohne
  Zinsaufwand in mindestens zwei der letzten fünf Jahre; eine Dividende der letzten drei Jahre über dem 2,5-Fachen der
  Zahlungen derselben Art im Jahr davor und danach, ohne Kennzeichnung als Sonderzahlung; zwei Schlussdividenden in einem Kalenderjahr der letzten drei Jahre. Ein Split im
  Fenster der Rückkäufe schaltet deren Hinweis ab; Unterwährungen (GBX, ZAC) zählen als Hauptwährung. Die Muster stammen aus der Opus-Bewertung von 150 Titeln; als
  Regeln für die Rechnung sind die beiden Dividendenmuster geprüft und verworfen (Strategie 11.21, 11.22).
- Ist das Rückflussniveau von Hand gesetzt, entfallen die Grenzen für Rückfluss und Kurs-Gewinn-Verhältnis: Wer es setzt, hat
  Kurs und Zahlen angesehen, und ein sehr niedriges KGV kann echt sein, wenn der Markt einen Gewinneinbruch erwartet (FinVolution
  nach dem Zinsdeckel 2025). Ein unbereinigter Split wird weiter gemeldet. Rückblick und Vorwärtsprotokoll rechnen ohne Werte von
  Hand und sind nicht betroffen.
- Aktienseite (bei „Kurs“) und Rangliste zeigen das KGV als Kurs geteilt durch das Gewinnniveau (Strategie 3.3), nicht durch den
  Gewinn eines einzelnen Jahres.
- Die früheren Schwellen (20 % und das Dreifache) trafen, was der Autor als Gelegenheit nennt: Petrobras, Halyk und Stalexport
  mit rund 20 % Ausschüttung, Höegh Autoliners mit über 25 % und einem Kurs beim Dreifachen des Gewinns. Über den heutigen
  Schwellen liegen im Datenvorrat fast nur Vorzugspapiere und Hinterlegungsscheine.
- Die Bewertung meldet, wenn der letzte Abschluss älter als zwei Jahre ist.

### 4.2 Betrieb nach der Kündigung des Tarifs

Die Anwendung ist so gebaut, dass sie mit dem kostenlosen Tarif (20 Abrufe am Tag) weiterläuft:

- **Vor der Kündigung:** `pnpm run import:index --auffrischen` lädt alle gespeicherten Titel noch einmal, damit die jüngsten
  Abschlüsse enthalten sind. Danach die Datenbankdatei sichern.
- **Kurse:** Der tägliche Abgleich fragt das Tagesbudget des Kontos ab und hält zwei Abrufe in Reserve. Reicht es nicht für alle
  Titel, kommen zuerst gehaltene Aktien, dann die Watchlist, jeweils die mit dem ältesten Kurs zuerst. Der Rest folgt am
  nächsten Tag; die Rangliste meldet das. Bei 18 Abrufen am Tag sind bis zu 18 Titel täglich aktuell, 36 Titel jeden zweiten
  Tag.
- **Splits:** Für beobachtete Titel mit Rückflussniveau von Hand holt der Abgleich aus dem verbleibenden Budget die Splits (ein
  Abruf je Titel); siehe Abschnitt 2.
- **Datenvorrat:** Er bekommt nur Kurse, wenn das Budget über 500 Abrufen liegt, also in einem bezahlten Tarif. Danach altern
  seine Kurse; das Screening zeigt das Kursdatum. Für einen einzelnen Titel lässt sich der Kurs von Hand eintragen oder der Titel
  auf die Watchlist nehmen.
- **Neue Geschäftsjahre:** einmal im Jahr den Tarif für einen Monat buchen und auffrischen, oder die Zahlen einzelner Titel per
  CSV eintragen.
- **Neue Titel**, die nicht im Datenvorrat liegen, brauchen den bezahlten Tarif oder die CSV-Eingabe.
- **Mehr als etwa 20 Titel mit täglichem Kurs:** Tarif „EOD Historical Data“ für rund 20 € im Monat (100.000 Abrufe am Tag).

## 5. Arbeitsablauf

| Auslöser                             | Was passiert                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Täglich nach Börsenschluss           | Bestand der Wikifolios abgleichen, Kurse, Wechselkurse und Bezugsgrößen laden, Zielportfolios rechnen, Stand speichern  |
| Knopf „Jetzt abgleichen“             | Bestand eines Wikifolios sofort abgleichen, z. B. nach einer ausgeführten Order                                         |
| Erster Abgleich eines Monats         | Eintrag im Vorwärtsprotokoll je Arm und Profil (Abschnitt 8.2)                                                          |
| Neue Fundamentaldaten                | Vorschläge neu rechnen; Hinweis „prüfen“, wenn sie sich seit der Bewertung verschoben haben (Strategie 7.5)             |
| Bewertung älter als 12 Monate        | Hinweis „prüfen“ auf Rangliste und Aktienseite; der Titel bleibt zulässig                                               |
| Fehlender Urteilsfaktor oder Eingabe | Aufgabe „Bewertung unvollständig“                                                                                       |
| Neue `CALC_VERSION`                  | Der Worker rechnet alle gespeicherten Stände neu (`recomputeAll`); ältere Tagesstände im Verlauf bleiben, wie sie waren |

Der tägliche Abgleich läuft mit `mise run sync`, im Betrieb nachts im LXC (`investing-sync.timer`). Er holt Kurse ab dem letzten
gespeicherten Tag (höchstens ein Jahr zurück), sodass nach einer Pause keine Lücke bleibt, und richtet sich nach dem
Tagesbudget des Tarifs (4.2). Auf der Seite „Abgleich“ lässt sich der nächtliche Lauf ausschalten, etwa um das Tagesbudget für
Arbeit an einer lokalen Kopie freizuhalten; von Hand startet er dort weiterhin. Scheitert der Abruf für einen Titel, läuft der
Abgleich weiter und rechnet mit dem letzten bekannten Kurs; die Rangliste zeigt, ob der letzte Lauf vollständig war. Lokal
richtet `mise run schedule an` einen macOS-Dienst ein, der täglich um 23:15 Uhr läuft.

Der tägliche Stand (Annahmen, Risikowert, innere Rendite, Zielportfolio, `CALC_VERSION`) wird dauerhaft gespeichert. Er ist
zugleich der Prüfstand für „Bewertung prüfen“ und Grundlage, um die Risikoeinstufung später an der tatsächlichen Entwicklung
zu prüfen.

## 6. Anwendung

- Nutzer: feste Liste erlaubter E-Mail-Adressen, Anmeldung über einen Identitätsanbieter, keine eigene Passwortverwaltung. Die
  Anmeldung übernimmt Cloudflare Access vor dem Tunnel (ADR 0001); die Anwendung selbst kennt keine Benutzer.
- Bewertungen (Annahmen, Risikofaktoren) sind für alle Nutzer gemeinsam. Portfolios gehören einem Nutzer; jeder kann mehrere
  führen, jedes mit einem der beiden Profile (Strategie 7.3).
- Technik: Next.js und TypeScript, SQLite, ein Container; Betrieb im LXC auf dem Proxmox (`deploy/`).
- Das Rechenmodul (innere Rendite, Vorschläge, Risikowert, Zielportfolio; `src/calc`, rein rechnende Teile von
  `src/valuation`) ist ein eigenes Modul ohne Datenbank- und Netzwerkzugriff.
- Die Oberfläche tritt als eigene Strategie „Rückflussrendite“ auf (Name in `src/app/brand.ts`). Die Seite „Strategie“ zeigt
  `docs/STRATEGIE.md` unverändert, mit Inhaltsverzeichnis und Version, dazu in einem eigenen Kasten die Tageswerte
  (Anleiherendite, Hürde), die nicht ins Dokument gehören. Eine zweite Ansicht zeigt das Änderungsprotokoll. Die Druckansicht
  blendet Navigation und Tageswerte aus und ist die PDF-Fassung für Leser ohne Zugang. Das Markdown wird mit `markdown-it`
  gerendert; rohes HTML im Dokument wird als Text ausgegeben (`src/app/markdown.ts`). Im Image liegen beide Dokumente unter
  `/app/docs`.
- Jede Seite nennt oben ihren Befund in einem Satz und bietet den häufigsten nächsten Schritt als Knopf an (Rangliste: den
  aussichtsreichsten unvollständig bewerteten Titel bewerten). Auf der Aktienseite stehen die Urteilsfaktoren zuerst, die
  Faktoren aus Zahlen sind eingeklappt.
- Oberfläche auf Deutsch mit den Begriffen aus Strategie 2 und einem festen Hinweis, dass die Seite keine Anlageberatung ist.

Seiten:

| Seite       | Inhalt                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rangliste   | Watchlist nach innerer Rendite, mit Spanne, Risikoklasse, Limit und Status der Bewertung                                                                                                                                                                                                                                                                                         |
| Aktie       | Eingaben mit Vorschlag und Übersteuerung, Risikoraster, innere Rendite bei alternativen Kursen, Zehnjahresreihen, Jev-Vorschläge                                                                                                                                                                                                                                                 |
| Portfolio   | Ist gegen Ziel, Kauf- und Verkaufsvorschläge, innere Rendite von Bestand und Ziel im Schnitt (nach Wert gewichtet, ohne Bargeld), Verteilung nach Branche und Region; Bestand als Stückzahl je Aktie und Barbestand in Euro, von Hand, aus der comdirect (6.1) oder aus wikifolio (Knopf „Jetzt abgleichen“); Auswahl der Kandidaten: Watchlist oder nur Bestand (Strategie 7.1) |
| Datenvorrat | Alle gespeicherten Titel nach vorläufiger innerer Rendite, mit Filter und Suche; Herkunft der Bewertung je Titel (Opus, Jev, von Hand, offener Jev-Vorschlag) und Filter nach bewertet, mit Opus bewertet oder unbewertet; Aufnahme in die Watchlist; abgedeckte Märkte                                                                                                          |
| Abgleich    | Läufe (Abgleich, Importe), nächtlicher Abgleich an oder aus                                                                                                                                                                                                                                                                                                                      |
| Aufgaben    | keine eigene Seite: unvollständige und zu prüfende Bewertungen stehen in der Rangliste und im Zähler der Navigation                                                                                                                                                                                                                                                              |
| Strategie   | `docs/STRATEGIE.md` mit Inhaltsverzeichnis, Tageswerte, Druckansicht; Unterseite Änderungsprotokoll                                                                                                                                                                                                                                                                              |

Start-Watchlist: Imperial Brands, Charter Communications, Halyk Savings Bank, 3i Group, Universal Health Services, BASF.

### 6.1 Bestand aus der comdirect

Der Bestand eines Portfolios lässt sich aus einem Depot bei der comdirect übernehmen (REST-API der Bank, im Online-Banking
einmal freizuschalten; Aufrufe, Felder und Grenzen der Bank in `docs/comdirect-api.md`). Es gibt keinen Abruf im Hintergrund: Jede Sitzung bei der Bank braucht eine TAN.

- **Ablauf:** Knopf „Aus comdirect übernehmen“ auf der Portfolioseite, PIN bzw. Passwort des Online-Bankings eingeben (beliebige Zeichen), Sitzungs-TAN bestätigen (pushTAN in der
  App oder photoTAN: Grafik scannen, TAN eintippen; andere Verfahren lehnt die Anwendung mit Hinweis ab), Vorschau, „Übernehmen“.
  Erst dieser Schritt schreibt. Ein Vorgang verfällt nach 15 Minuten, die TAN muss binnen 9 Minuten nach der Anmeldung
  freigegeben sein (so lange gilt das Token der Bank). Ein Schritt läuft je Vorgang nur einmal zur Zeit; eine falsche TAN beendet
  den Vorgang, statt sie zu wiederholen. Fünf TAN-Anforderungen ohne Freigabe sperren bei der Bank den Zugang; die Anwendung
  hört nach drei auf, bis der Nutzer bestätigt, sich inzwischen im Online-Banking mit TAN angemeldet zu haben. Scheitert nach
  der Freigabe das Laden von Depot oder Bestand, lässt es sich ohne neue TAN wiederholen.
- **Zugangsdaten:** Client-ID, Client-Secret und Zugangsnummer stehen in der Umgebung (`COMDIRECT_CLIENT_ID`,
  `COMDIRECT_CLIENT_SECRET`, `COMDIRECT_USERNAME` in `.env.local` bzw. `/opt/investing/.env`). Die PIN wird bei jedem Abruf
  eingegeben und nie gespeichert, auch nicht im Protokoll; die Tokens der Bank liegen nur für die Dauer des Vorgangs im Speicher
  des Servers und werden am Ende widerrufen.
- **Depot:** Jedes Portfolio merkt sich höchstens ein Depot. Beim ersten Abruf (oder wenn das gemerkte Depot fehlt) wählt der
  Nutzer es aus der Liste der Bank; mehrere Portfolios aus einem Depot gibt es nicht.
- **Zuordnung über die ISIN:** Aktien, deren ISIN bekannt ist, gehen mit ihrer Stückzahl in den Bestand; stehen mehrere Notizen
  mit derselben ISIN in der Datenbank, gewinnt die auf der Watchlist, dann die schon gehaltene, dann eine Stammaktie (kein
  CEDEAR, keine Vorzugsaktie), dann eine mit Kurs. Gehaltenen und beobachteten Aktien ohne gespeicherte ISIN trägt der Abruf sie
  aus der gespeicherten Antwort des Anbieters nach; Aktien-ISINs aus dem Depot, die dann noch fehlen, schlägt er in der
  Symbolsuche des Anbieters nach (ein Abruf je ISIN) und ordnet sie einer Notiz zu, die schon in der Datenbank steht. Das Depot
  ist führend: Gehaltene Aktien, die es nicht führt, fallen weg, auch ohne bekannte ISIN. Aktien, die noch nicht in der Datenbank stehen, werden über die ISIN aufgenommen (Lauf „Titel
  aufnehmen“, nicht auf die Watchlist) und zählen bis dahin mit ihrem Kurswert laut Bank zu den sonstigen Anlagen; der nächste
  Abruf ordnet sie richtig zu. Eine ISIN, deren Aufnahme angestoßen war und keine Notiz brachte, stößt er 30 Tage lang nicht
  erneut an. Fonds, ETF, Anleihen, Zertifikate
  und alles andere, was keine Aktie ist, zählen immer mit dem Kurswert laut Bank zu den sonstigen Anlagen.
- **Barbestand:** der Saldo des Verrechnungskontos, das zum Depot gehört. Tagesgeld und andere Konten zählen nicht.
- **Vorschau:** je Position alte und neue Stückzahl, neue und weggefallene Positionen, Barbestand und sonstige Anlagen alt und
  neu. Die Übernahme ersetzt den ganzen Bestand; zurück geht es von Hand oder über den Tagesstand. Meldet die Bank mehr
  Positionen, als sie liefert, lässt sich nichts übernehmen.
- **Zugriff:** Die Anwendung hat keine eigene Anmeldung; erreichbar ist sie nur über den Cloudflare-Tunnel hinter Cloudflare
  Access (Google). Antworten der Bank werden mit zod geprüft.

## 7. Abnahmetests für das Rechenmodul

| Fall                                                   | Eingaben                                                                                                                 | Erwartet                                                                | Toleranz             |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------- |
| Imperial Brands, Kurs 30,00 GBP (Folie 7)              | R0 = 3,09 (1,59 + 1,50), g0 = 2,3 %, p = 1,8 %                                                                           | 10,6 % (Modell: 10,57 %)                                                | ± 0,2 Prozentpunkte  |
| Imperial Brands, Kurs 25,00 GBP (Folie 7)              | wie oben                                                                                                                 | 12,7 % (Modell: 12,60 %)                                                | ± 0,2 Prozentpunkte  |
| BASF, Wachstum (Buch Kap. 5.2)                         | Gewinn je Aktie 2002 bis 2011                                                                                            | 15,5 %                                                                  | ± 0,1 Prozentpunkte  |
| BASF, Gewinnniveau aus 10 Jahren                       | wie oben                                                                                                                 | 5,42 EUR (Modell: 5,415)                                                | ± 0,01               |
| BASF, Gewinnniveau aus 5 Jahren                        | wie oben                                                                                                                 | 5,38 EUR                                                                | ± 0,01               |
| Wal-Mart, Gewinnniveau aus 10 Jahren                   | Gewinn je Aktie 2002/03 bis 2011/12                                                                                      | 4,60 USD (Modell: 4,58)                                                 | ± 0,05               |
| Positionslimit                                         | Basislimit 12,5 %, Risikowert 40 %                                                                                       | 7,5 %                                                                   | exakt                |
| Deckelung Rückfluss                                    | Dividendenniveau 2,00, Netto-Rückkäufe 3,00, freier Cashflow je Aktie 4,00                                               | R0 = 4,00                                                               | exakt                |
| Obergrenze Wachstum                                    | historisch 7 %, R0 = 3,00, Gewinnniveau 4,00, Eigenkapital je Aktie 20,00                                                | g0 = 7 % (Grenze: 0,25 · 20 % + 2 % = 7 %)                              | exakt                |
| Obergrenze Wachstum bei Vollausschüttung               | historisch 7 %, R0 = 4,00, Gewinnniveau 4,00                                                                             | g0 = 2 %                                                                | exakt                |
| Ausschüttungsquote am Ende, teilweise angerechnet      | R0 = 2,00, Gewinnniveau 10,00, g0 = 8,5 %                                                                                | 76,9 % (Rendite des Einbehaltenen 8,125 %, Anrechnung 81,25 %)          | ± 0,1 Prozentpunkte  |
| Ausschüttungsquote am Ende, voll angerechnet           | R0 = 4,00, Gewinnniveau 10,00, g0 = 8,5 %                                                                                | 90 %                                                                    | exakt                |
| Wertfalle                                              | R0 = 2,00, Gewinnniveau 10,00, g0 = 2 %                                                                                  | Quote bleibt 20 %, Rendite wie ohne Gewinnniveau                        | exakt                |
| Bandbreite                                             | Imperial Brands, Kurs 30,00 GBP                                                                                          | vorsichtig < Basis < optimistisch                                       | –                    |
| Wachstumsgrenzen je Währung                            | Kurs 100, R0 = 5, g0 = 8,5 %, p = 2 %; in Lira (Abstand 17,5 Punkte) R0 = 5,875, g0 = 27,5 %, Grenzen nach Strategie 4.6 | Euro 7,4 %; Lira nach Währungsabgleich 7,4 % (ohne Verschiebung −8,6 %) | ± 0,01 Prozentpunkte |
| Wachstumsvorschlag in Lira                             | Gewinnwachstum 30 %, Abstand 17,5 Punkte, übrige Grenzen nicht bindend                                                   | g0 = 27,5 % (8,5 % in Euro-Kaufkraft)                                   | ± 0,1 Prozentpunkte  |
| Schrumpfen in Lira                                     | Gewinnwachstum 5 % nominal, Abstand 17,5 Punkte                                                                          | schrumpfend; Vorschlag 11,6 % (−5 % in Euro-Kaufkraft)                  | ± 0,1 Prozentpunkte  |
| Abstand 0                                              | alle Fälle oben                                                                                                          | wie ohne Strategie 4.6, bitgleich                                       | exakt                |
| Zykliker, Hoch in den letzten fünf Jahren              | Cashflow je Aktie 1 (fünf Jahre), 8 (fünf Jahre), Verlustjahr in der Reihe                                               | Cashflow für den Deckel 4,5 (Median) statt 8                            | exakt                |
| Zykliker ohne Abzug in Faktor 1                        | wie oben, Gewinn jedes Jahr gestiegen                                                                                    | 8, unverändert                                                          | exakt                |
| Zykliker, kurze Reihe                                  | 1, 1, 1, 1, 8, 8, 8 (sieben Jahre), Verlustjahr                                                                          | Median 1 statt Mittel 5,2 und Hinweis auf nicht abgedeckten Zyklus      | exakt                |
| Zykliker, Buchungsartefakt                             | Cashflow je Aktie −8, −7, −2, 5, 5, 5, 5, 5, 7, 7                                                                        | Median 5 (das Mittel läge bei 2,2); Fünfjahresmittel 5,8; es gilt 5     | exakt                |
| Zykliker in Fremdwährung                               | wie erster Fall, Abstand 5 Punkte                                                                                        | Median der mit `1,05^k` hochgerechneten Werte                           | ± 0,001              |
| Zyklusregel erhöht die Rendite nicht                   | Dividende 3, Rückkäufe 1, Cashflow 0 (fünf Jahre) und 5 (fünf Jahre), Verlustjahr, kleines Eigenkapital                  | R0 2,5 statt 4; Wachstum und Quote wie ohne Regel; Rendite niedriger    | exakt                |
| Deckel erhöht die Rendite nicht                        | Dividende 3, Cashflow 4, Vergütung 1,5 (Deckel 2,5) gegen ohne Vergütung (Rückfluss 3)                                   | R0 2,5 statt 3; Wachstum und Quote wie ohne Abzug; Rendite niedriger    | exakt                |
| Aktienbasierte Vergütung bringt den Deckel zum Greifen | Dividende 3,00, keine Rückkäufe, Cashflow 4,00, Vergütung 1,50                                                           | Deckel 2,50, R0 = 2,50 (ohne Vergütung 3,00) und Hinweis                | exakt                |
| Rückkäufe über der Vergütung                           | Dividende 3,00, Rückkäufe 3,00, Vergütung 1,00, Cashflow 4,00                                                            | Netto-Rückkäufe 2,00, Deckel 3,00, R0 = 3,00, kein Hinweis              | exakt                |

Die Folienwerte lassen sich nicht exakt treffen, weil die Zahlungskonvention des Autors nicht veröffentlicht ist. Die
Wal-Mart-Abweichung stammt aus gerundeten Tabellenwerten im Buch. Dazu kommt der Abgleich von Dokument und Code
(Abschnitt 1).

## 8. Rückblick und Vorwärtsprotokoll

Zwei Werkzeuge prüfen die Strategie und jede Änderung daran. Beide sind Skripte, keine Seiten der Oberfläche. Ergebnisse und
Grenzen der geltenden Fassung stehen in Strategie 8; der Ablauf einer Änderung (Vermutung, Rückblick, Änderungsprotokoll) in
Strategie 11 und `AGENTS.md`. Der Plan, die Werkzeuge zu einer kontrollierten Verbesserung auszubauen, steht in
`docs/Selbstlernende-Strategie.md`.

### 8.1 Rückblick (`pnpm run backtest`)

Rechnet rückwirkend, was das Zielportfolio eines Profils gebracht hätte. Er dient dazu, eine Änderung am Rechenmodell, an den
Profilen oder an den Regeln vor dem Einbau zu prüfen; er sagt nichts über künftige Renditen.

Verfahren:

1. Stichtage sind die Monatsschlüsse im Abstand von drei Monaten ab dem Start (Standard Oktober 2016).
2. Je Stichtag werden alle Titel des Datenvorrats mit demselben Rechenmodell wie in der Anwendung bewertet (`proposeInputs`,
   `evaluate`), aber nur mit dem, was damals bekannt war: Abschlüsse bis zum letzten Geschäftsjahr, das ab Juni des Folgejahres
   als veröffentlicht gilt, Schlusskurs und EZB-Kurs des Monatsschlusses, Dividenden bis zum Stichtag. Splits kennt der
   Rückblick alle: Der Rohkurs des Stichtags wird durch die Splits danach geteilt, damit er zur Basis der (heutigen, bereinigten)
   Abschlüsse passt.
3. Der Risikowert kommt nur aus den Zahlenfaktoren mit den Ersatzabzügen für Finanzwerte (Strategie 6.4); Urteile und Eingaben
   von Hand fehlen. Das Ergebnis ist ein unbeurteiltes Screening, nicht das Depot des Autors.
4. Ausgeschlossen werden: Titel mit einem Marktwert unter 300 Mio. Euro; Titel, bei denen nach dem letzten bekannten Abschluss
   ein Split lag (vor oder nach dem Stichtag) und die Abschlüsse ihn nicht nachweislich abbilden (die Aktienzahl springt nicht);
   Anleihen, die der Anbieter als Stammaktie führt (Namen mit „Series“, „Notes“, „Preferred“); von mehreren Notierungen mit
   gleichen Zahlen alle bis auf die mit dem größten Marktwert; Währungen ohne EZB-Kurs; Titel, deren Zahlen die
   Plausibilitätsprüfung (4.1) verwirft. Die Auswahl (Stammaktie, Anleihen, Marktwert, Doppelnotierung) steht in
   `src/valuation/universe.ts` und gilt ebenso für das Vorwärtsprotokoll.
5. Das Zielportfolio entsteht mit `targetPortfolio` des Profils; gehaltene Titel erhalten den Aufschlag der Tauschschwelle.
   Gehandelt wird zum Monatsschlusskurs des Stichtags. Kosten 0,25 % je Handelsumsatz, Bargeld und Hürde folgen
   der Zinsstrukturkurve der EZB (AAA-Staatsanleihen, Dreimonatszins für das Bargeld, Zehnjahreszins für die Hürde) am jeweiligen
   Stichtag, negative Zinsen gelten als 0; fehlt ein Wert, gelten die festen Werte (Bargeld 3,4 %, Hürde die heutige
   Anleiherendite, ohne sie 3 %). Der Bargeldzins gilt für den Monat ab dem Stichtag davor (kein Vorgriff), die Güte je Fenster zieht den mittleren Bargeldzins des
   Fensters ab. Mit `--feste-zinsen` gelten die festen Werte für alle Stichtage; Monate ohne Zinswert zählt der Bericht. In den Optionen des Laufs steht
   dann `ratesHistory` und das Mittel von `cashRate` und `hurdle`; Läufe mit und ohne Zinsverlauf gelten im Vergleich als
   verschiedene Einstellungen, und die Güte (die den Bargeldzins abzieht) ist zwischen ihnen nicht vergleichbar.
6. Die Rendite je Monat ist die Gesamtrendite aus den um Splits und Dividenden bereinigten Kursen, umgerechnet in Euro. Fehlt
   ein Monatsbalken, gilt der letzte davor. Endet eine Monatsreihe, bevor der Zeitraum zu Ende ist, und laufen auch die
   Tageskurse nicht weiter, wird im dritten Monat ohne Kurs ein Verlust von 50 % angesetzt (Annahme: Einstellung). Eine
   Übernahme gegen bar zählt damit ebenfalls als Verlust; die Zahl der Abschläge steht im Bericht.
   Der Verlust ist mit `--einstellung` einstellbar (0 bis 1). Eingestellte Titel, die `pnpm run import:delisted` geladen hat
   (Spalte `stocks.delisted_on`, Kurse, Abschlüsse, Dividenden und Splits wie bei lebenden Titeln), lädt der Rückblick mit
   (`db.stocks({ includeDelisted: true })`); Abgleich, Bewertung, Suche und Titelsuche im Datenvorrat überspringen sie. Der Import
   liest die Monatskurse aus `survivorship/monthly-prices.jsonl` neben der Datenbank, wählt nach Umsatz und Ende der Reihe
   (`src/data/delisted.ts`), braucht 12 Abrufe je Titel und lässt dem Abgleich die Reserve (`SYNC_RESERVE`).
   Bei eingestellten Titeln schließt der Rückblick Schuld- und Vorzugstitel, Kursfehler (bereinigter Kurs springt über das
   Neunfache; Sprung oder Absturz nur im bereinigten, nicht im rohen Kurs; roher und bereinigter Kurs bewegen sich gemeinsam im
   Verhältnis eines Splits; verglichen werden nur benachbarte Monate) und Umbenennungen
   (Abschlüsse über die Einstellung hinaus) aus (`delistedArtefact`); echte Abstürze bleiben drin. Der Bericht zählt die
   Ausgeschlossenen unter „ausgeschlossen“.
7. Umschlag ist zweiseitig gemessen (Käufe plus Verkäufe, als Anteil des Depots; ein voller Austausch zählt 200 %). Die Kosten
   gelten je Handelsumsatz in diesem Sinn. Der Bericht nennt außerdem die Zahl der Ausreißer (Positionsmonate über +100 % oder
   unter −60 %), die Gründe für übersprungene Titel und die Hürde des Laufs.

Vergleichsgrößen:

- **Index:** SPDR MSCI ACWI IMI (SPYI.DE, thesaurierend, Euro), der Fonds, an dem sich der Autor des Vorbilds misst (Webinar):
  ganzer Markt mit Schwellenländern und kleineren Werten. Bis zum 25.11.2026 war es der iShares Core MSCI World (EUNL.DE);
  ältere Läufe und die Zahlen in Strategie 8.2 beziehen sich auf ihn. Die Kurse kommen von der inoffiziellen Schnittstelle von
  Yahoo Finance; fehlen sie, läuft der Rückblick ohne Vergleich. Die Reihe von SPYI.DE hat 2017 zwei Tage mit Fehlkursen
  (Anfang Juni und Anfang Juli, je rund +13 % und am Folgetag zurück); sie liegen auf keinem Monatsschluss.
- **Zufallsauswahl:** dieselben Kandidaten (nach Hürde und Filtern), Risikoabzüge, Limits und Kosten; die Rangfolge wird je
  Titel und Kalenderjahr gewürfelt (gezogene Rendite 10 bis 30 %, gehaltene Titel behalten den Aufschlag der Tauschschwelle).
  200 Läufe mit festen Startwerten; der Bericht nennt auch deren Umschlag. Sie zeigt, was das Ranking über Zufall hinaus
  beiträgt.
- **Rollende Fenster:** Dreijahresfenster, Start alle drei Monate. Sie überlappen stark; unabhängig sind nur wenige Zeiträume.
- **Güte:** Rendite über dem Bargeldzins des Laufs je Einheit Schwankung (Sharpe-artig) und Rendite p. a. je größtem Rückgang
  (Calmar-artig; der Rückgang zählt mindestens 1 %). Der Bericht nennt beides für den ganzen Zeitraum (Strategie und Index) und
  für die Fenster als Median und als schwaches Viertel (25 %-Quantil); der Vergleich zeigt sie für Stand und Änderung und den
  Anteil der Fenster, in denen die Güte besser ist. Sie bewertet Rendite und Risiko zusammen; sie folgt der Gesamtrendite eng
  und filtert einen Gewinn aus einem einzigen Zyklus nicht heraus, das leistet erst der Blick auf das schwache Viertel der
  Fenster und den Zeitraumvergleich. Das Maß wird aus den gespeicherten Läufen gerechnet; ältere Läufe lassen sich damit weiter
  vergleichen.

Eine Änderung prüfen: auf `main` `pnpm run backtest --name main`, auf dem Zweig
`pnpm run backtest --name aenderung --vergleich main` (beide Läufe im selben Checkout, mit derselben Datenbank und am selben
Tag; die Läufe liegen in `backtest/` neben der Datenbank; der Vergleich bricht ab, wenn Zeitraum, Enddatum oder Fensterlänge
abweichen, und warnt bei abweichenden Kosten, Hürde oder Datenbasis). Schnell geht es mit `--zufall 0 --ohne-index`. Gelesen
wird der Median der Fenster vor dem Mittel, dazu der Anteil der Fenster, in denen die Änderung besser ist, die Güte (auch im
schwachen Viertel), der Umschlag und der größte Rückgang. Ein Vorsprung nur im Mittel oder nur in einem Zeitraum trägt keine
Änderung. Das Ergebnis gehört in die Commit-Nachricht und in das Änderungsprotokoll, zusammen mit den Grenzen (Strategie 8.3).

### 8.2 Vorwärtsprotokoll (`pnpm run forward`)

Der Abgleich schreibt zum ersten Abgleich eines Monats in die Tabelle `forward_log`, welches Zielportfolio die Anwendung
vorgeschlagen hätte, mit dem Euro-Kurs von damals, der Rechenversion (`calc_version`) und der Strategieversion
(`strategy_version`). Einträge vor der Einführung der Strategieversion tragen nachträglich „1.0“ (Vorbehalt im
Änderungsprotokoll). Je Profil gibt es zwei Arme:

- **zahlen:** der ganze Datenvorrat, nur Zahlenfaktoren, ohne Eingaben von Hand (Titel mit Handeingaben werden ohne sie neu
  gerechnet), mit denselben Filtern wie der Rückblick (`src/valuation/universe.ts`: Marktwert, Anleihen, Mehrfachnotierungen)
  und ohne unplausible Titel; die Zahlen kommen zum heutigen Kurs, nicht zu einem Stichtag. Offene Faktoren zählen wie im
  Rückblick mit den Ersatzabzügen beziehungsweise als 0.
- **urteil:** die Watchlist mit allen Risikofaktoren, nur vollständige Bewertungen, so wie die Anwendung vorschlägt.

Gehaltene Titel (Aufschlag der Tauschschwelle) sind die des letzten Eintrags im selben Arm und Profil. `pnpm run forward` zeigt
je Eintrag die Strategieversion, die Kursrendite seit dem Eintrag (ohne Dividenden und Kosten) und die Überschneidung der Arme.
Das Protokoll ist die einzige Grundlage, auf der sich der Nutzen von Jev und Webrecherche ohne Rückschaufehler messen lässt;
mit zehn bis zwölf Titeln ist ein Unterschied der Arme erst nach etwa zwei Jahren mehr als Rauschen.

## 9. Offene Fragen zu Daten, Lizenz und Anwendung

Offene Fragen zur Methode stehen in Strategie 11.

- **Lizenz für mehrere Nutzer:** Die Privattarife der Datenanbieter erlauben keine Anzeige für andere Nutzer. Vor dem
  Freischalten weiterer Nutzer mit EODHD klären.
- **Halyk Savings Bank:** Die Zahlen des Anbieters sind je Hinterlegungsschein und passen damit zum Londoner Kurs. Das ist aus
  der Aktienzahl geschlossen, nicht am Geschäftsbericht geprüft.
- **Gezahlte Dividenden bei Sonderfällen:** Das Feld des Anbieters enthält bei einzelnen Titeln Ausschüttungen an Minderheiten
  (Charter 2016 und 2020).
- **Datenfehler, die die Plausibilitätsprüfung nicht fängt:** gemischte Stückelung in der Reihe (Nova Ljubljanska Banka:
  Aktienzahl springt um den Faktor 5, Rendite 28,6 % statt rund 12 %) und „Rückkäufe“ ohne sinkende Aktienzahl (Hua Xia Bank:
  23,9 % statt 12,8 %). Ein Abgleich der Rückkäufe mit der Aktienzahl und eine Prüfung auf Sprünge der Aktienzahl würden beides
  finden.
- **Treffsicherheit von Jev:** Vorschläge an Titeln prüfen, deren späterer Verlauf bekannt ist; die Sicherheit laut Jev ist
  nicht an echten Ergebnissen geeicht.
- **Warnungen ohne Sperrwirkung:** die in Abschnitt 2 geplanten Warnungen für Werte von Hand umsetzen.
- **Vergleichsmaßstab anzeigen:** Abstand der inneren Rendite zur Anleiherendite und zu einem Weltindex in der Oberfläche
  zeigen (zur Methode: Strategie 11.14).

## 10. Nicht in Version 1

Steuern (Quellensteuer, Abgeltungsteuer), Transaktionskosten in der Anwendung, Screening über den Gesamtmarkt,
Aufträge an die Bank und Orders bei wikifolio (comdirect und wikifolio liefern nur den Bestand, 6.1 und 4), Backtest als Funktion der Oberfläche (als Werkzeug gibt es ihn, Abschnitt 8.1; er setzt Kosten an, die
Anwendung nicht), maximaler Kaufpreis nach Buchmethode, Währungsprognosen, Einstellungen für Strategie-Parameter (Abschnitt 1).
