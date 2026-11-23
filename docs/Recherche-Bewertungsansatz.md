# Recherche: Bewertungsansatz im Spiegel der Primärquellen

Stand: 20.11.2026. Grundlage: `docs/SPEZIFIKATION.md` vom selben Tag, Rechnung in `src/calc/`. Abschnittsnummern der
Spezifikation beziehen sich auf diese Fassung. Seit dem 22.11.2026 stehen die Regeln in `docs/STRATEGIE.md`, die Umsetzung in
der neu nummerierten Spezifikation. Umrechnung alt → neu: 2 → Strategie 9.1, 10; 3 → Strategie 2; 4 → Strategie 5.1;
4.1 → Strategie 5.2; 4.2 → Spezifikation 2; 4.3 → Strategie 4.5; 4.4 → Strategie 4.6; 5 → Strategie 3.1 bis 3.8 und 4.1 bis
4.3 (Datenbehandlung: Spezifikation 4); 6.1 → Strategie 6.1, 6.4; 6.2 → Strategie 6.2; 6.3 → Strategie 6.5; 6.4 → Strategie
6.3 und Spezifikation 3; 7.1 → Strategie 7.1, 5.3; 7.2 → Strategie 7.2; 7.3 → Strategie 7.3, 7.4; 7.4 → Strategie 7.4;
8 → Spezifikation 5; 8.1 → Strategie 7.5; 9 → Spezifikation 4 (Plausibilität 4.1); 9.1 → Spezifikation 4.2; 10 →
Spezifikation 6; 11 → Spezifikation 7; 12 → Strategie 10; 13 → Strategie 11 und Spezifikation 9; 14 → Spezifikation 10;
15 → Spezifikation 8 und Strategie 8. Abschnittsnummern ohne „Spezifikation“ in diesem Dokument (etwa „4.3“ bei der
Untergrenze) meinen die Abschnitte dieser Recherche.

Zweck: belegtes Material für Verbesserungsvorschläge. Die Datei nennt, was die Primärquellen zu den Bausteinen des
Ansatzes sagen, was die Spezifikation tut und wo beides auseinanderliegt. Die Vorschläge daraus stehen in Abschnitt 4.

Kennzeichnung der Belege:

- **[geprüft]**: Aussage oder Zahl im Original gesehen (Volltext geladen und durchsucht). Wörtliche Zitate stehen in
  Anführungszeichen und sind kurz gehalten.
- **[indirekt]**: Original nicht erreichbar, Angabe aus einer anderen Primärquelle, die es wiedergibt.
- **[nicht verifiziert]**: aus dem Gedächtnis oder nur aus Sekundärquellen; nicht als Beleg verwenden.

Briefe an die Aktionäre von Berkshire Hathaway sind als „Brief JJJJ“ zitiert (Geschäftsjahr, nicht Erscheinungsjahr),
Hauptversammlungen als „HV JJJJ“ nach der Mitschrift im Archiv von CNBC. URLs im Quellenverzeichnis (Abschnitt 3).

## 1. Kurzfassung

- Gedeckt: Barwert von Zahlungen als Maß und Rangfolge (Buffett, Damodaran), Rückkäufe als Rückfluss, Glättung über
  zehn Jahre (Graham, Shiller), Abschmelzen, Inflationskorrektur der Währung, kein Stop-Loss.
- Konstantes `p` ist rechnerisch ein Zinsaufschlag: `1 + r = (1 + r_ohne) · (1 − p)`, also 0,5 bis 4,7 Punkte.
  Buffett lehnt gestaffelte Risikosätze ab; für Damodaran bleibt danach noch die Risikoprämie zu verdienen (2.1).
- Der Sockel `p = 0,5 %` entspricht Rating BBB−/BB+; A-Schuldner fallen mit rund 0,1 % pro Jahr aus. Die Spanne
  (Faktor 8,5) ist enger als in den Daten (Faktor 25 zwischen A und B), die Jahresrate dort nicht konstant (2.6).
- Keine Sicherheitsmarge und Untergrenze = Anleiherendite widersprechen Buffett (Marge, 10 % Schwelle) und Graham
  (Gleichstand ist keine Marge); `p` deckt den Ausfall, nicht den Schätzfehler (2.7).
- Die Quellen bewerten, was ausschüttbar ist (Owner Earnings, FCFE), wir, was ausgeschüttet wird; der Wert von
  Rückkäufen hängt bei Buffett am Preis, Vergütung in Aktien gehört vom Gewinn abgezogen (2.2, 2.3).
- Historisches Gewinnwachstum und Einbehaltung · Eigenkapitalrendite haben kaum Prognosewert (Chan u. a., Base Rate
  Book, Arnott/Asness); Überrenditen schmelzen schneller als in 15 Jahren, und abhängig vom Burggraben (2.4).
- „2 % Wachstum ohne Kapital“ und 10 % als feste Renditeschwelle sind nicht gedeckt; Maßstab der Quellen sind
  Kapitalkosten und Kapitalbedarf (2.3, 2.5, 2.8). Länder- und Währungsfaktor weichen von Damodaran ab (2.8).
- Positionsgröße: Kelly/Thorp, Munger und Buffett lassen Rendite **und** Risiko eingehen, wir nur das Risiko (2.9).

## 2. Bausteine

### 2.1 Kennzahl und Diskontierung

**Buffett.**

- Innerer Wert ist der Barwert der Zahlungen, die sich dem Unternehmen über seine restliche Lebensdauer entnehmen
  lassen: „the discounted value of the cash that can be taken out of a business during its remaining life“ (Owner's
  Manual, Abschnitt „Intrinsic Value“) [geprüft]. Brief 1992 führt das auf John Burr Williams zurück; die Formel sei
  für Aktien und Anleihen dieselbe, nur müsse der Analyst die „Kupons“ der Aktie selbst schätzen [geprüft].
- Gekauft wird, was diese Rechnung als am billigsten ausweist, gleich ob das Unternehmen wächst, ob seine Gewinne
  schwanken oder wie hoch Kurs-Gewinn- und Kurs-Buchwert-Verhältnis sind; zeigt die Rechnung Anleihen als günstiger,
  werden Anleihen gekauft (Brief 1992) [geprüft]. Brief 2000 („bird in the hand“): Mit den richtigen Zahlen lasse sich
  die Attraktivität aller Kapitalverwendungen in eine Rangfolge bringen („rank the attractiveness of all possible uses
  of capital“) [geprüft].
- Diskontsatz: Brief 2000 nennt als dritte Größe neben Sicherheit und Zeitpunkt der Zahlungen den risikolosen Zins,
  „the yield on long-term U.S. bonds“ [geprüft]. Auf der HV 1996 (Vormittag, Kapitel „Discount rate for estimating
  intrinsic value“) lehnt Buffett Risikoaufschläge auf den Zins ausdrücklich ab: „we don't put the risk factor in, per
  se“; ein Aufschlag von etwa 6 Punkten sei „mathematical gibberish“. Stattdessen: bei verstandenen Unternehmen bleiben,
  mit dem Staatsanleihezins rechnen, und erst am Ende einen Abschlag auf den Preis verlangen („a significant
  discount“). Bei sehr niedrigen Zinsen würde er „a little higher rate“ ansetzen [geprüft].
- Mindestrendite: Brief 2002 nennt eine Schwelle von „at least 10% pre-tax returns“ für Aktienkäufe, sonst bleibe
  Berkshire an der Seitenlinie [geprüft]. HV 2003 (Nachmittag, Kapitel „Why Berkshire wants at least a 10 percent
  return“): Die Schwelle gelte unabhängig vom kurzfristigen Zins, sie sei willkürlich („it's arbitrary“), und unter
  den Titeln oberhalb der Schwelle werde gekauft, was am attraktivsten sei, in der Praxis das, „we feel the surest
  about“ [geprüft].
- Genauigkeit: Mit genauen Zahlen zu rechnen sei töricht, besser sei eine Spanne von Möglichkeiten (Brief 2000);
  innerer Wert nur als Spanne, nicht als „pseudo-precise figure“ (Brief 1999) [geprüft].

**Weitere Quellen.**

- Damodaran löst für den Gesamtmarkt dieselbe Gleichung wie wir für die einzelne Aktie: Die implizite
  Eigenkapitalrisikoprämie sei „an internal rate of return for stocks“, abzüglich des risikolosen Zinses (Blog,
  „Data Update 2 for 2026“, 23.01.2026) [geprüft]. Zahlungen sind Dividenden plus Rückkäufe, fünf Jahre Wachstum
  nach Analystenschätzung, danach Wachstum in Höhe des risikolosen Zinses (ERP-Papier, Ausgabe 2012) [geprüft].
  Stand 01.11.2026 (S&P 500 bei 7.580, zehnjährige US-Staatsanleihe 4,94 %): implizite Prämie 3,79 % (laufende
  Barrendite) bzw. 4,41 % (bereinigte Ausschüttung), erwartete Rendite 8,73 % in der ersten Variante (Startseite und
  `ERPNov26.xlsx`) [geprüft].
- Damodaran verwendet die Marktrendite nicht als Rangmaß gegen die Anleihe, sondern als Baustein eines
  risikogerechten Diskontsatzes je Unternehmen (ERP-Papier 2012) [geprüft].
- Überlebenswahrscheinlichkeiten in den Zahlungen sind für Damodaran keine Risikoanpassung: „contrary to
  conventional wisdom, this is not a risk adjustment“ („The Cost of Distress“, 2006, S. 7 f.) [geprüft]. Der
  Diskontsatz erfasse das Risiko der Unternehmensfortführung, nicht das Abbruchrisiko („truncation risk“); beides
  im Diskontsatz zu stapeln führe zu Doppelzählung (Blog, „Myth 4.4“, 04.11.2016) [geprüft]. Erwartete Zahlungen
  nach Abbruchrisiko sind danach weiter mit einem risikogerechten Satz zu diskontieren.
- Rappaport/Mauboussin („Expectations Investing“, Online-Tutorial 8) halten die Kapitalkosten fest und lösen nach den
  im Kurs enthaltenen Erwartungen auf, etwa der Länge der Prognoseperiode [geprüft; das Buch selbst nicht gesehen].
  Mauboussin/Callahan, „Market-Expected Return on Investment“ (2021), lösen nach einer Rendite auf, aber der des
  Unternehmens auf seine Investitionen, nicht der des Aktionärs; zum internen Zinsfuß warnen sie, er werde bei
  Zwischenzahlungen wegen der unterstellten Wiederanlage „misleading“ [geprüft].
- Graham nutzt seine Wachstumsformel auch rückwärts, um das im Kurs unterstellte Wachstum abzulesen („The
  Intelligent Investor“, Kap. 11) [geprüft, Volltext der Ausgabe 1973/2003 auf archive.org].

**Spezifikation.** Abschnitt 4: Die innere Rendite ist der Zins, bei dem der Barwert der erwarteten Rückflüsse dem Kurs
entspricht. Es gibt keinen vorgegebenen Diskontsatz und keinen inneren Wert; das Risiko geht als
Überlebensfaktor `(1 − p)^t` in die Zahlungen ein, nicht als Aufschlag auf den Zins. Abschnitt 4.1 rechnet drei Fälle.
Abschnitt 7.1: Rang nach innerer Rendite, Untergrenze ist die Rendite der zehnjährigen Euro-Staatsanleihe.

**Abweichung.**

- **Gedeckt:** Bewertung über diskontierte Zahlungen, Rangfolge aller Möglichkeiten nach derselben Rechnung, Anleihe
  als Vergleich (Buffett 1992, 2000). Auflösen nach der Rendite statt nach dem Wert ist bei Damodaran auf Marktebene
  Standard. Drei Fälle statt einer Punktzahl entsprechen Buffetts „range of possibilities“.
- **Rechnerische Feststellung (eigene Herleitung, keine Quelle):** Bei konstantem `p` und Totalverlust ist der
  Überlebensfaktor mit einem Aufschlag auf den Diskontsatz identisch. Es gilt exakt
  `1 + r = (1 + r_ohne) · (1 − p)`, wobei `r_ohne` die innere Rendite ohne Ausfallwahrscheinlichkeit ist; das gilt
  auch für den Endwert. Bei `r_ohne = 10 %` kürzt `p` die Rendite um 0,55 Punkte (p = 0,5 %), 2,0 Punkte (1,8 %),
  3,3 Punkte (3,0 %) und 4,7 Punkte (4,25 %). Das Raster erzeugt also einen Risikoabschlag je Aktie von rund 0,5 bis
  4,7 Prozentpunkten.
- **Abweichung von Buffett:** Er lehnt je nach Risiko gestaffelte Sätze ab („playing games with numbers“, HV 1996)
  und regelt Unsicherheit über Auswahl (nur Verstandenes) und einen Preisabschlag am Ende. Unser Ansatz staffelt
  fein nach Risiko und bewertet auch Titel bis 75 % Risikowert.
- **Abweichung von Damodaran:** Die innere Rendite nach Überlebensfaktor ist bei ihm eine erwartete Rendite, in der
  das Fortführungsrisiko noch nicht bezahlt ist. Sein Vergleichsmaß wäre risikoloser Zins plus Risikoprämie (für
  den US-Markt am 01.11.2026 rund 8,7 % in Dollar), nicht die Staatsanleihe allein. Umgekehrt mischt unser Raster
  Fortführungsrisiken (Stetigkeit, Land, Branche) in `p`, die bei ihm in den Diskontsatz gehören (siehe 2.6).
- **Nicht gedeckt:** Der interne Zinsfuß als Rangmaß unterstellt Wiederanlage der Rückflüsse zur selben Rendite
  (Mauboussin/Callahan 2021); die Verzerrung wächst mit dem Abstand der Rendite zur realistischen Wiederanlage.

### 2.2 Rückflüsse und Owner Earnings

**Buffett.**

- „Owner Earnings“ (Brief 1986, Anhang „Purchase-Price Accounting Adjustments and the ‚Cash Flow‘ Fallacy“) sind
  (a) ausgewiesener Gewinn plus (b) Abschreibungen und andere nicht zahlungswirksame Aufwendungen minus (c) die
  durchschnittlichen jährlichen Investitionen, die das Unternehmen braucht, um Wettbewerbsposition und Stückzahl voll
  zu halten („to fully maintain its long-term competitive position and its unit volume“), einschließlich zusätzlichen
  Umlaufvermögens, soweit dafür nötig. Diese Größe, nicht der ausgewiesene Gewinn, sei für die Bewertung maßgeblich;
  (c) sei eine Schätzung [geprüft].
- Abgezogen werden also nur die **Erhaltungsinvestitionen**. Wachstumsinvestitionen mindern die Owner Earnings nicht.
  Der freie Cashflow nach allen Investitionen ist damit bei wachsenden Unternehmen kleiner als die Owner Earnings.
  Derselbe Anhang warnt umgekehrt: Liegt (c) über (b), überzeichnet der ausgewiesene Gewinn die Owner Earnings, oft
  erheblich; „Cashflow“ als (a) + (b) ohne (c) sei irreführend [geprüft].
- Zeitraum: (c) lasse sich in einem einzelnen Jahr aufschieben, über fünf bis zehn Jahre müsse investiert werden
  (Brief 1986) [geprüft].
- Was zählt, ist, was sich entnehmen **lässt**, nicht was ausgeschüttet **wird**: Definition im Owner's Manual (oben).
  Berkshire selbst zahlt keine Dividende; auf der HV 2008 (Nachmittag, Kapitel „Buffett's test on when to pay a
  dividend“) nennt Buffett Beteiligungen, die 100 % ausschütten, und solche, die nichts ausschütten [geprüft].
  HV 2007 (Vormittag, Kapitel „Quantitative approach to intrinsic value and investments“): Berkshire habe nie
  ausgeschüttet, aber „it's the ability to distribute cash that gives Berkshire its value“; bewertet werde die
  künftige Fähigkeit, Geld auszuschütten oder, wenn nicht ausgeschüttet wird, es hoch verzinst wieder anzulegen
  [geprüft].
- Aktienbasierte Vergütung ist Aufwand: Bei Unternehmen mit Optionsprogrammen korrigiert Berkshire den ausgewiesenen
  Gewinn nach unten („an appropriate downward adjustment to reported earnings“, Brief 1998) [geprüft]. Buffett zieht
  die Vergütung also vom Gewinn ab, nicht von den Rückkäufen. Rückkäufe zum Ausgleich ausgeübter Optionen nennt er
  „buy high, sell low“; Rückkauf und Ausgabe von Aktien seien getrennt zu beurteilen (Brief 1999) [geprüft].

**Weitere Quellen.**

- Damodaran, „Investment Valuation“ (2. Aufl.), Kap. 13: Rückkäufe werden den Dividenden zugeschlagen („add them on
  to the dividends and compute a modified payout ratio“); weil Rückkäufe unregelmäßig sind, über vier bis fünf Jahre
  mitteln; schuldenfinanzierte Rückkäufe abziehen (Dividenden + Rückkäufe − Aufnahme langfristiger Schulden)
  [geprüft].
- Damodaran, Kap. 14: Auch mit Rückkäufen bewertet ein Ausschüttungsmodell Unternehmen falsch, die dauerhaft weniger
  oder mehr zurückgeben, als sie könnten („we may misvalue firms that consistently return less or more than they can
  afford“). Maßstab ist der freie Cashflow an die Eigentümer (FCFE) nach Investitionen, Umlaufvermögen und
  Nettoschuldenaufnahme, im Blog 2026 „potential dividend“ genannt [geprüft].
- Aktienbasierte Vergütung: Aufwand, nicht zurückzurechnen („closer in spirit to an in-kind compensation than a
  non-cash compensation“); ausstehende Optionen sind ein eigener Anspruch, der vom Eigenkapitalwert abzuziehen ist
  (Damodaran, Blog, 13.02.2014) [geprüft]. Mauboussin/Callahan, „Capital Allocation“ (Ausgabe 05.11.2025): Die
  Vergütung in Aktien sei „essentially a financing activity“; mehr als ein Drittel der Rückkäufe der letzten Jahre
  habe nur die Aktienausgabe aus Vergütung ausgeglichen (S. 41) [geprüft].
- Boudoukh/Michaely/Richardson/Roberts (NBER WP 10651, Fassung 2006; Journal of Finance 2007): Jahresrenditen des
  US-Markts 1926 bis 2003 erklärt die Dividendenrendite mit R² 5,5 %, die Netto-Ausschüttungsrendite (Dividenden
  plus Rückkäufe minus Aktienausgabe) mit 26 % [geprüft im Arbeitspapier; Zeitschriftenfassung nicht verglichen].
  Der Befund gilt für Markt und Portfolios, nicht für die Bewertung einzelner Titel.
- Rückkäufe sind Restgröße, Dividenden nicht: Brav/Graham/Harvey/Michaely (NBER WP 9657; JFE 2005), Befragung von
  384 Finanzvorständen: 94 % der Dividendenzahler wollen Kürzungen vermeiden; Rückkäufe werden aus dem bezahlt, was
  nach Investitionen und Liquiditätsbedarf übrig bleibt [geprüft im Arbeitspapier]. Mauboussin/Callahan 2025:
  Rückkäufe schwankten fast sechsmal so stark wie Dividenden („nearly six times as volatile“) [geprüft].
- Zykliker: Damodaran, „Ups and Downs: Valuing Cyclical and Commodity Companies“ (2009): über den Zyklus
  normalisieren statt den nächsten Zyklus zu prognostizieren; ein Normaljahr sei die Mitte des Zyklus; einfache
  Durchschnitte unterzeichnen gewachsene Unternehmen [geprüft].

**Spezifikation.** Abschnitt 3 und 5: Rückflussniveau `R0` = Dividendenniveau plus Netto-Rückkäufe je Aktie
(Fünfjahresdurchschnitt aus Rückkäufen minus Ausgabe neuer Aktien minus aktienbasierte Vergütung, mindestens 0),
höchstens der tragbare Rückfluss (Fünfjahresdurchschnitt des freien Cashflows je Aktie, abzüglich Tilgung von
Nettoschulden über 3 × EBITDA; bei Banken und Versicherern das Gewinnniveau, bei Immobilienwerten der operative
Cashflow). Bei `R0 = 0` wird keine Rendite gerechnet (Abschnitt 13).

**Abweichung.**

- **Gedeckt:** Dividenden plus Netto-Rückkäufe statt Dividenden allein (Damodaran, Boudoukh u. a.); Mittelung der
  Rückkäufe über fünf Jahre (Damodaran: vier bis fünf); Abzug der Aktienausgabe; keine Anrechnung nicht gedeckter
  Rückkäufe (Damodaran zieht schuldenfinanzierte ab, wir deckeln auf den freien Cashflow).
- **Abweichung von Buffett und Damodaran (Grundsatz):** Beide bewerten, was entnommen werden **kann** (Owner
  Earnings, FCFE), nicht was ausgeschüttet **wird**. Unser `R0` ist die tatsächliche Ausschüttung mit dem freien
  Cashflow als Deckel; nach unten gibt es keine Korrektur. Abschnitt 4.3 gleicht das nur über eine später steigende
  Quote aus, und nur, wenn ein Gewinnniveau vorliegt. Titel ohne Ausschüttung sind nicht bewertbar (Abschnitt 13),
  bei Buffett und Damodaran sind sie es.
- **Abweichung von Buffett (Deckel):** Owner Earnings ziehen nur Erhaltungsinvestitionen ab, der freie Cashflow
  auch Wachstumsinvestitionen. Der Deckel trifft wachsende Unternehmen daher härter als Buffetts Maß; bei
  Unternehmen mit hohem Erhaltungsbedarf decken sich beide.
- **Abweichung bei der Vergütung in Aktien:** Buffett und Damodaran ziehen sie vom Gewinn bzw. Cashflow ab. Wir
  ziehen sie nur von den Rückkäufen ab, mit Untergrenze 0. Übersteigt die Vergütung die Rückkäufe, bleibt der Rest
  unberücksichtigt; der Deckel aus freiem Cashflow enthält die Vergütung üblicherweise als nicht zahlungswirksamen
  Posten weiter [letzter Halbsatz: eigene Folgerung aus der Definition des Anbieters, nicht geprüft]. Ein Abzug
  bereits ausstehender Optionen (Damodaran) fehlt.
- **Abweichung bei der Stetigkeit:** Die Quellen behandeln Rückkäufe als Restgröße mit rund sechsfacher Schwankung
  (Mauboussin, Brav u. a.). Abschnitt 12 setzt sie im Niveau und in Faktor 12 den Dividenden gleich.
- **Abweichung bei Zyklikern:** Fünf Jahre decken einen Zyklus nicht sicher ab (Damodaran: voller Zyklus; Buffett:
  fünf bis zehn Jahre für den Investitionsbedarf). Abschnitt 13 nennt das selbst als offen.

### 2.3 Einbehaltene Gewinne und Rückkäufe

**Buffett.**

- Ein-Dollar-Test: Einbehalten ist nur gerechtfertigt, wenn je einbehaltenem Dollar mindestens ein Dollar Marktwert
  entsteht (Brief 1983, Grundsatz 9; Brief 1984, Abschnitt „Dividend Policy“; Owner's Manual) [geprüft]. Das gelinge
  nur, wenn das einbehaltene Kapital zusätzliche Gewinne bringt, die mindestens dem entsprechen, was Anlegern
  allgemein offensteht („incremental earnings equal to, or above, those generally available to investors“, Brief
  1984) [geprüft]. Maßstab ist also die Rendite auf das **zusätzliche** Kapital im Vergleich zur Marktrendite, keine
  feste Zahl. Das Owner's Manual prüft den Test rollierend über fünf Jahre und hat ihn später umformuliert
  (Buchwertzuwachs über dem S&P 500 und Kurs über Buchwert) [geprüft].
- „Restricted earnings“ (Brief 1984): Ein Teil des ausgewiesenen Gewinns ist bei kapitalintensiven Unternehmen
  durch Inflation gebunden („ersatz“); er kann nicht ausgeschüttet werden, ohne dass Absatzmenge,
  Wettbewerbsposition oder Finanzkraft leiden. Solche Gewinne seien für den Eigentümer oft stark abzuwerten („must
  be discounted heavily“). Beispiel Consolidated Edison: Jeder einbehaltene Dollar wurde zu 25 Cent Marktwert
  [geprüft].
- Wachstum hat nur Wert bei hoher Rendite auf das zusätzliche Kapital: „Growth benefits investors only when the
  business in point can invest at incremental returns that are enticing“; bei niedriger Rendite schadet Wachstum
  (Brief 1992) [geprüft]. Das beste Unternehmen kann über lange Zeit viel zusätzliches Kapital hoch verzinsen; die
  meisten hochrentablen Unternehmen brauchen aber wenig Kapital und sollten ausschütten oder zurückkaufen (Brief
  1992) [geprüft]. Brief 2007 („The Great, the Good and the Gruesome“): See's wuchs in der Menge nur um 2 % pro Jahr
  und brauchte kaum Kapital; das schlechteste Unternehmen wächst schnell, braucht dafür viel Kapital und verdient
  wenig [geprüft].
- Gewinn je Aktie allein belegt nichts: Auch ein Sparbuch zeigt steigende „Gewinne je Aktie“, wenn es wenig
  ausschüttet; Maßstab ist die Rendite auf das eingesetzte Eigenkapital ohne übermäßige Verschuldung (Brief 1979)
  [geprüft].
- Rückkäufe schaffen Wert nur unter zwei Bedingungen: Mittel über den Bedarf des Geschäfts hinaus **und** Kurs unter
  dem vorsichtig gerechneten inneren Wert (Brief 1999; Brief 2011: „a material discount“) [geprüft]. „Buying dollar
  bills for $1.10 is not good business for those who stick around“ (Brief 1999). Brief 2012: „Value is destroyed when
  purchases are made above intrinsic value.“ Brief 2016: ob ein Rückkauf für die verbleibenden Aktionäre Wert schafft
  oder vernichtet, sei „entirely purchase-price dependent“ [alle geprüft]. Dass Verwässerung ausgeglichen werden soll
  oder Geld übrig ist, reicht ausdrücklich nicht als Grund (Brief 2011) [geprüft].
- Wer künftig Netto-Käufer ist, direkt oder über ein zurückkaufendes Unternehmen, profitiert von fallenden Kursen
  (Brief 2011, Beispiel IBM) [geprüft].

**Weitere Quellen.**

- Wachstum ohne Überrendite ist wertlos: Damodaran, Kap. 12: „a return on equity equal to the cost of equity in
  stable growth nullifies the positive effect of growth“; Fußnote: „Growth without excess returns will make a firm
  larger but not more valuable“ [geprüft]. Mauboussin/Callahan (2021): Entspricht die Rendite der zusätzlichen
  Investitionen den Kapitalkosten, fällt der Barwert der Wachstumschancen auf null [geprüft]. Greenwald sagt
  dasselbe (Wachstum hat nur Wert, wenn die Kapitalrendite über den Kapitalkosten liegt, also nur innerhalb eines
  geschützten Geschäfts) [nicht verifiziert im Original; gesehen nur in Vorlesungsfolien von R. Jagannathan,
Kellogg 2006, die sich auf Buch und Notizen Greenwalds berufen].
- Damodaran, Kap. 11: Wachstum des Gewinns je Aktie = Einbehaltungsquote · Eigenkapitalrendite, ohne
  Kapitalerhöhungen [geprüft]. Kap. 13: Rückkäufe senken das Eigenkapital und blähen die Eigenkapitalrendite auf
  [geprüft].
- Empirie gegen „Einbehalten bringt Wachstum“: Arnott/Asness (Financial Analysts Journal 2003), US-Markt 1946 bis
  2001: Auf hohe Ausschüttungsquoten folgte höheres reales Gewinnwachstum über zehn Jahre, auf niedrige
  niedrigeres (Steigung 0,25, bereinigtes R² 54,6 %; 1871 bis 2001: 0,07 und 14,2 %). Nach Quartilen der
  Ausschüttungsquote (1946 bis 1991): −0,4 % im niedrigsten, +4,2 % im höchsten. Die Autoren: Das „contradicts the
  views of many who believe that substantial reinvestment of retained earnings will fuel faster future earnings
  growth“ [geprüft]. Der Befund gilt für den Gesamtmarkt, nicht für Einzelunternehmen.
- Chan/Karceski/Lakonishok (Journal of Finance 2003), Tabelle X: Weder das Kurs-Buchwert-Verhältnis noch die
  „sustainable growth“ (Eigenkapitalrendite · Einbehaltungsquote) sagen künftiges Wachstum verlässlich voraus
  [geprüft].
- Graham, „The Intelligent Investor“, Kap. 20: Einbehaltene Gewinne erhöhen Ertragskraft und Wert der Aktie in
  vielen Fällen nicht entsprechend („fail to add commensurately“) [geprüft].
- Bernstein/Arnott (Financial Analysts Journal 2003): Gewinne und Dividenden je Aktie wuchsen im US-Markt seit 1871
  rund 2 Punkte langsamer als die Wirtschaft; Netto-Verwässerung laut CRSP seit 1926 2,3 % pro Jahr [geprüft].
- Rückkäufe: Mauboussin/Callahan 2025: zurückkaufen „only when its stock is trading below its expected value and
  when no better investment opportunities are available“; ein Rückkauf über oder unter Wert verschiebt Vermögen
  zwischen ausscheidenden und verbleibenden Aktionären [geprüft].

**Spezifikation.** Abschnitt 4.3: Einbehaltene Gewinne zählen über eine Ausschüttungsquote, die linear über 15 Jahre
auf `a∞` steigt. Die Rendite des Einbehaltenen wird als `e = (g0 − 2 %) / (1 − a0)` geschätzt; angerechnet wird
anteilig bis 10 % (`w = min(1, e / 10 %)`), bei `g0 ≤ 2 %` gar nicht. Abschnitt 5: Netto-Rückkäufe zählen wie
Dividenden zum Rückfluss, unabhängig vom Kurs, zu dem zurückgekauft wurde; Deckel ist der freie Cashflow. Abschnitt 5
begrenzt `g0` durch `Einbehaltungsquote · Eigenkapitalrendite + 2 %`.

**Abweichung.**

- **Gedeckt:** Einbehaltenes zählt nur bei nachgewiesenem Wachstum; ohne Wachstum über die Preissteigerung keine
  Anrechnung (Buffett: Ein-Dollar-Test; Graham; Arnott/Asness in der Tendenz). Wachstum und Einbehaltung über
  `Einbehaltungsquote · Eigenkapitalrendite` zu koppeln entspricht Damodarans Grundformel.
- **Abweichung beim Maßstab:** Volle Anrechnung gibt es bei uns ab festen 10 % Rendite auf das Einbehaltene.
  Buffett, Damodaran, Mauboussin (und Greenwald) messen an den Kapitalkosten bzw. an der anderswo erzielbaren
  Rendite. Bei Buffetts eigener Schwelle von 10 % vor Steuern (2.1) schafft ein mit 10 % verzinster Dollar gerade
  einen Dollar Wert, keinen Zuschlag; liegt unsere innere Rendite eines Titels über 10 %, rechnet das Modell
  einbehaltene Gewinne an, die nach dem Ein-Dollar-Test weniger wert sind als eine Ausschüttung.
- **Abweichung bei der Messung:** `e = (g0 − 2 %) / (1 − a0)` leitet die Rendite des Einbehaltenen aus dem
  angenommenen Wachstum ab, das seinerseits durch `Einbehaltungsquote · Eigenkapitalrendite + 2 %` gedeckelt ist.
  Buffett misst am Ergebnis (zusätzlicher Gewinn bzw. Marktwert je einbehaltenem Dollar über fünf Jahre). Die
  Empirie spricht gegen die Verlässlichkeit beider Eingangsgrößen (Chan u. a.; Arnott/Asness).
- **Abweichung „restricted earnings“:** Die Rechnung unterstellt, dass 2 % Wachstum kein Kapital brauchen
  (`g0 − 2 %`, `a_Ziel`). Buffett sagt das Gegenteil für kapitalintensive Unternehmen: Dort bindet Inflation einen
  Teil des Gewinns (Brief 1984); kapitalfrei wächst nur, wer Buffetts doppelten Test besteht (2.8). Siehe auch 2.5.
- **Abweichung bei Rückkäufen:** Für den verbleibenden Aktionär hängt der Wert eines Rückkaufs am Preis im
  Verhältnis zum inneren Wert (Buffett 1999, 2011, 2012, 2016; Mauboussin). Wir zählen jeden gedeckten Rückkauf
  wie eine Dividende. In der Gesamtsicht aller Aktionäre ist das eine Ausschüttung (Damodaran, Boudoukh u. a.);
  eine Prüfung des Rückkaufpreises kennt die Spezifikation nicht.
- **Hinweis zur Eigenkapitalrendite:** Rückkäufe blähen sie auf (Damodaran). Die Grenze
  `Einbehaltungsquote · Eigenkapitalrendite + 2 %` wird dadurch bei Rückkäufern weiter; bei negativem Eigenkapital
  entfällt sie laut Abschnitt 5 ganz.

### 2.4 Wachstum und Abschmelzen

**Buffett.**

- Hohe Wachstumsraten großer Unternehmen halten nicht: Es sei ein Fehler, 15 % Gewinnwachstum pro Jahr
  vorherzusagen; von zehn beliebig gewählten Fortune-500-Unternehmen mit Rekordgewinn würden über 20 Jahre mehr als
  die Hälfte keine 15 % schaffen (HV 2001, Vormittag, Kapitel „No company should predict 15 percent annual growth“)
  [geprüft].
- Wachstum ist kein Wert an sich, sondern eine Größe in der Wertgleichung, „usually a plus, sometimes a minus“ (Brief
  2000); Kennzahlen wie Dividendenrendite, KGV und Wachstumsraten zählen nur als Hinweise auf Höhe und Zeitpunkt der
  Zahlungen (Brief 2000) [geprüft].
- Die Vergangenheit ist nur so weit nützlich, wie sie Einsicht in die Zukunft gibt; bei stabilen Geschäften sei sie
  ein brauchbarer Anhalt, bei anderen nicht (HV 2007, Vormittag, Kapitel „When you don't need a huge margin of
  safety“) [geprüft].
- Dauerhaft hohe Renditen brauchen einen Burggraben; Wettbewerb greift jede hohe Rendite an („competitors will
  repeatedly assault any business ‚castle‘ that is earning high returns“, Brief 2007). Branchen mit schnellem,
  ständigem Wandel scheiden aus [geprüft]. Brief 1987 (Fortune-Studie): Von 1.000 großen Unternehmen kamen 1977 bis
  1986 nur 25 auf durchschnittlich über 20 % Eigenkapitalrendite ohne ein Jahr unter 15 %; nur sechs von 1.000 hatten
  im Zehnjahresmittel über 30 % erreicht [geprüft, Zahlen nach Buffetts Wiedergabe der Fortune-Studie].
- Eine Formel für das Abschmelzen von Wachstum nennt Buffett nicht. [In den durchsuchten Briefen 1977 bis 2024 und
den geladenen HV-Mitschriften nicht gefunden.]

**Weitere Quellen.**

- Basisraten: Mauboussin/Callahan/Majd, „The Base Rate Book“ (Credit Suisse, 26.09.2016; gelesen von einem Spiegel,
  nicht vom Herausgeber). Die 1.000 größten Unternehmen weltweit, 1950 bis 2015, reale Wachstumsraten,
  Unternehmen mit Verlust ausgeschlossen. Zehn Jahre, alle Unternehmen: Jahresüberschuss im Mittel 5,8 %, Median
  5,2 %, Standardabweichung 11,0 %; Umsatz im Mittel 5,8 %, Median 4,9 %, Standardabweichung 8,0 %. Unternehmen mit
  über 25 Mrd. $ Umsatz: Jahresüberschuss Median 4,1 %, Umsatz Median 1,8 % [geprüft]. Rund 28 % erreichten zehn
  Jahre lang 10 % reales Gewinnwachstum oder mehr, rund 24 % schrumpften real [Summe der Tabellenklassen, vom
Rechercheur addiert]. In der Zehnjahresstichprobe fehlen die Unternehmen, die keine zehn Jahre überlebt haben.
- Persistenz: Das Gewinnwachstum einer Periode sagt das der nächsten nicht voraus. Base Rate Book: Korrelation beim
  Jahresüberschuss −0,05 (ein Jahr), bei drei und fünf Jahren um −0,2; beim Umsatz 0,30 (ein Jahr), 0,19 und 0,17
  (drei und fünf Jahre); „Net income growth is not persistent“ [geprüft; Zuordnung der Werte zu drei bzw. fünf
Jahren im Textauszug nicht eindeutig]. Chan/Karceski/Lakonishok (2003): „There is no persistence in long-term
  earnings growth beyond chance“; über dem Median in zehn Jahren in Folge lagen beim Gewinn 0,2 % der Unternehmen
  (Zufall: 0,1 %), beim Umsatz 0,9 %; nur etwa 10 % der Unternehmen wuchsen zehn Jahre lang um mehr als 18 % pro
  Jahr; das mittlere Zehnjahreswachstum entsprach real etwa 3,5 %, dem Wachstum der Wirtschaft [geprüft].
  Damodaran, Kap. 11, zitiert Little (1960): Korrelation des Gewinnwachstums zweier Perioden 0,02; das historische
  Umsatzwachstum sei „a far more useful number“ als das historische Gewinnwachstum [geprüft].
- Abschmelzen der Überrendite: Mauboussin/Callahan, „Competitive Advantage Period: The Neglected Value Driver“
  (14.04.2026), Abb. 11, 1970 bis 2024: Die Überrendite auf das investierte Kapital behält im Mittel 79 % pro Jahr
  (Abschmelzrate 0,21; nach Branchen 0,10 bei Basiskonsum bis 0,30 bei Versorgern). Eine Abschmelzrate von 0,20
  entspreche fünf Jahren voller Überrendite. Die im Kurs unterstellte Dauer des Wettbewerbsvorteils liege meist bei
  5 bis 20 Jahren [geprüft]. „ROIC and the Investment Process“ (2023): Nach drei Jahren sind 48 % der Unternehmen
  des besten Renditefünftels noch dort, 15 % im schlechtesten [geprüft].
- Länge der Wachstumsphase: Damodaran, Kap. 12, nennt keine feste Zahl; sie hänge an Größe, bisherigem Wachstum und
  Wettbewerbsvorteilen. Seine Beispiele rechnen mit fünf oder zehn Jahren; für wachstumsstarke Unternehmen zieht er
  einen allmählichen Übergang vor, bei dem auch Kapitalrendite und Reinvestition angepasst werden [geprüft].
- Greenwald: Bewertung zunächst ohne Wachstum (Earnings Power Value = bereinigter Gewinn / Kapitalkosten); Wachstum
  nur innerhalb eines geschützten Geschäfts [nicht verifiziert im Original, siehe 2.3].
- Gewinnniveau: Graham, „The Intelligent Investor“, Kap. 12: Durchschnitte über „seven to ten years“ zeigen die
  Ertragskraft besser als ein einzelnes Jahr [geprüft]. Campbell/Shiller (1988, 1998/2001) mitteln die **realen**
  Gewinne über zehn Jahre und berufen sich für die Länge allein auf Graham/Dodd [geprüft]. Siegel (Financial
  Analysts Journal 2016): Je höher das reale Gewinnwachstum, desto weiter liegt der Zehnjahresdurchschnitt unter
  dem aktuellen Gewinn [geprüft]. Der Befund zur Glättung ist einer für den Gesamtmarkt.
- Grahams „8,5“ ist kein Wachstumssatz, sondern das Kurs-Gewinn-Verhältnis ohne Wachstum in
  `Wert = Gewinn · (8,5 + 2 · Wachstum)`, mit Wachstum über „the next seven to ten years“ (Kap. 11) [geprüft].
  Ob die 8,5 % des Buchs daher stammen, ist nicht geprüft.

**Spezifikation.** Abschnitt 5: `g0` = kleinster Wert aus historischem Gewinnwachstum (Durchschnitt der letzten fünf
gegen die ersten fünf Jahre), Umsatzwachstum, 8,5 % und `Einbehaltungsquote · Eigenkapitalrendite + 2 %`; mindestens
0 %, bei schrumpfendem Gewinn bis −5 %. Abschnitt 4: lineares Abschmelzen über 15 Jahre auf höchstens 3 %.
Abschnitt 5: Gewinnniveau aus zehn Geschäftsjahren (Zehnjahresdurchschnitt · (1 + g · 5), gedeckelt).

**Abweichung.**

- **Gedeckt:** Abschmelzen überhaupt (Mauboussin, Damodaran); Umsatzwachstum als Grenze und als Ersatz (Umsatz ist
  beständiger als Gewinn: Base Rate Book, Chan u. a., Damodaran); Glättung über zehn Jahre (Graham, Shiller); der
  Minimum-Ansatz wirkt als Deckel, nicht als Prognose, und passt damit zum Befund fehlender Persistenz.
- **Abweichung bei der Aussagekraft:** Zwei der vier Größen im Wachstumsvorschlag haben laut Empirie kaum
  Prognosewert: das historische Gewinnwachstum (Korrelation um 0 oder negativ) und
  `Einbehaltungsquote · Eigenkapitalrendite` (Chan u. a., Tabelle X). Mauboussin empfiehlt, bei Prognosen ab drei
  Jahren überwiegend den Median der Vergleichsgruppe anzusetzen (Base Rate Book, S. 78) [geprüft]. Eine
  Vergleichsgruppe kennt die Spezifikation nicht.
- **Einordnung der 8,5 %:** Nominal 8,5 % sind bei 2 bis 2,5 % Inflation rund 6 bis 6,5 % real und liegen über dem
  realen Zehnjahresmedian (5,2 %; große Unternehmen 4,1 %). Weil das Wachstum sofort abschmilzt, liegt das mittlere
  Wachstum der ersten zehn Jahre bei `g0 = 8,5 %` aber bei rund 6,9 % nominal [eigene Rechnung], also real nahe am
  Median. Der Deckel schneidet den oberen Rand ab, vorsichtig im Sinn „unter dem Median“ ist er nicht.
- **Abweichung bei der Untergrenze:** `g0 ≥ 0 %` bei wachsendem Gewinn; rund ein Viertel der überlebenden
  Großunternehmen schrumpfte real über zehn Jahre.
- **Abweichung bei Dauer und Form:** 15 Jahre lineares Abschmelzen für jede Aktie liegen am oberen Rand der Quellen
  (Mauboussin: Überrendite halbiert sich im Mittel in rund drei Jahren, unterstellte Dauer 5 bis 20 Jahre;
  Damodaran: Beispiele mit 5 und 10 Jahren). Die Quellen machen die Dauer vom Wettbewerbsvorteil abhängig
  (Buffett, Mauboussin, Greenwald, Damodaran); bei uns ist der Burggraben ein Risikofaktor (Faktor 7), aber kein
  Maß für Dauer oder Höhe des Wachstums. Die Branchenunterschiede (Abschmelzrate 0,10 bis 0,30) gehen nicht ein.
- **Abweichung beim Gewinnniveau:** Graham und Shiller verwenden den einfachen Durchschnitt, Shiller in realen
  Größen. Wir mitteln nominale Gewinne und rechnen mit dem Wachstum hoch. Das behebt die Verzerrung, die Siegel
  beschreibt, stützt sich dafür aber auf die Wachstumsschätzung, deren Prognosewert gering ist; der Deckel auf den
  höchsten Gewinn der letzten drei Jahre begrenzt das. Graham verlangt, dass Schätzungen eher zu niedrig ausfallen.

### 2.5 Endwert

**Buffett.** Buffett beschreibt keine Endwertformel. Er spricht von den Zahlungen über die „remaining life“ des
Unternehmens (Owner's Manual, Brief 1992) und davon, dass kein Unternehmen dauerhaft schneller wachsen kann als die
Wirtschaft (HV 2001, oben) [geprüft]. Zum Kapitalbedarf von Wachstum siehe 2.3.

**Weitere Quellen.**

- Obergrenze des Dauerwachstums: Damodaran, Kap. 12: Die Rate „cannot be greater than the overall growth rate of
  the economy“; sie hängt davon ab, ob nominal oder real und in welcher Währung gerechnet wird [geprüft]. Im Blog
  („Myth 5.2“, 30.11.2016) setzt er als Deckel den risikolosen Zins der Bewertungswährung („the risk free rate that
  I have used in the valuation“); als gelockerte Fassung lässt er bis zu einem Punkt darüber gelten [geprüft].
- Mauboussin/Callahan (2026): Für das langfristige Wachstum sei die erwartete Inflation ein sinnvoller Ansatz
  („expected inflation is a sensible way to model long-term growth“); ihr Beispiel rechnet mit 2,5 % [geprüft].
- Langfristiges Wachstum je Aktie: Bernstein/Arnott (2003): reale Aktienkurse seit 1871 +2,48 % pro Jahr gegen
  3,45 % für das Sozialprodukt; Gewinnwachstum je Aktie „really only about 1 percent a year above inflation“.
  Siegel (2016), Tabelle 1: reales Gewinnwachstum je Aktie im US-Markt 1,83 % (1871 bis 2014), 3,07 % (1946 bis
  2014) [geprüft].
- Reinvestition im Endwert: Damodaran, Kap. 12: `Einbehaltungsquote = g / Eigenkapitalrendite` bzw.
  „Reinvestment Rate in stable growth = Stable growth rate / ROC“; die Kopplung mache die Bewertung weniger
  empfindlich gegen die Wachstumsannahme. Überrenditen auf ewig hält er für nicht haltbar und führt die Rendite an
  den Branchendurchschnitt heran [geprüft]. In seinen Formeln steht das nominale Wachstum; einen kapitalfreien
  Inflationsanteil gibt es dort nicht.
- Abbruchrisiko im Endwert: Damodaran kritisiert, dass ein Diskontierungsmodell Zahlungen „in perpetuity“
  unterstellt („The Cost of Distress“, S. 7) [geprüft]. Er wendet die Ausfallwahrscheinlichkeit kumuliert über den
  Bewertungszeitraum an (in den Beispielen zehn Jahre); eine konstante Jahresrate, die durch die ewige Rente
  läuft, wurde bei ihm nicht gefunden.

**Spezifikation.** Abschnitt 4: ewige Rente auf den Rückfluss des Jahres 15 mit `q = (1 + g∞) · (1 − p)`,
`g∞ = min(g0, 3 %)`. Abschnitt 4.3: Im Endwert bleibt eine Einbehaltung von `max(0, g∞ − 2 %) / 10 %`, bei 3 %
also 10 % des Gewinns; ohne Gewinnniveau oder bei `a0 ≥ 1` wächst der Rückfluss im Endwert ohne Einbehaltung.

**Abweichung.**

- **Gedeckt:** Ein Deckel nahe der Inflation bzw. dem langfristigen Wachstum je Aktie; 3 % nominal liegen am
  vorsichtigen Rand dessen, was Bernstein/Arnott und Siegel für den Markt messen (real 1 bis 3 % plus Inflation),
  und knapp über Mauboussins 2,5 %.
- **Rechnerische Feststellung (eigene Herleitung):** Wegen `q = (1 + g∞) · (1 − p)` wachsen die **erwarteten**
  Rückflüsse im Endwert mit `q − 1`: +2,5 % bei p = 0,5 %, +1,1 % bei 1,8 %, −0,1 % bei 3,0 %, −1,4 % bei 4,25 %.
  Das wirksame Dauerwachstum liegt damit immer unter 3 % und ab `p ≈ 2,9 %` unter null.
- **Abweichung bei der Währung:** Damodarans Deckel ist der risikolose Zins der Währung, in der gerechnet wird.
  Unsere 3 % gelten für jede Währung gleich und vor der Inflationskorrektur aus Abschnitt 7.1. In einer Währung
  mit hoher Inflation ist das strenger als sein Maß, in einer mit niedrigem Zins (liegt die Anleiherendite unter
  3 %) lockerer.
- **Abweichung bei der Reinvestition:** Im Endwert bleiben bei 3 % Wachstum 10 % des Gewinns einbehalten, weil
  2 Punkte als kapitalfrei gelten und der Rest 10 % Rendite bringt. Nach Damodarans Formel wären es `g / ROE`, bei
  3 % Wachstum und 10 % Eigenkapitalrendite also 30 %, bei 15 % Rendite 20 %. Ohne Gewinnniveau oder bei
  `a0 ≥ 1` wächst der Rückfluss ganz ohne Einbehaltung; diesen Fall nennt Damodaran als Quelle überhöhter Endwerte.
- **Abweichung beim Abbruchrisiko:** Eine konstante Ausfallrate auf ewig findet sich in den Quellen nicht; die
  Ausfalldaten zeigen für schwache Schuldner eine mit der Zeit fallende Rate (siehe 2.6).

### 2.6 Ausfallwahrscheinlichkeit und Risikoraster

**Buffett.**

- Risiko ist nicht Volatilität: Brief 1993 definiert Risiko als „the possibility of loss or injury“ und lehnt Beta
  ab; das eigentliche Risiko sei, ob die Zahlungen nach Steuern über die Haltedauer mindestens die Kaufkraft erhalten
  plus eine mäßige Verzinsung. Brief 2011 misst Risiko an der „reasoned probability“ eines Kaufkraftverlusts über
  die Haltedauer [geprüft].
- Die fünf Faktoren, nach denen Brief 1993 dieses Risiko beurteilt: (1) wie sicher sich die langfristigen
  wirtschaftlichen Merkmale des Geschäfts beurteilen lassen, (2) wie sicher sich das Management beurteilen lässt
  (Fähigkeit und Kapitalverwendung), (3) ob das Management die Erträge den Aktionären zukommen lässt statt sich
  selbst, (4) **der Kaufpreis**, (5) Steuern und Inflation [geprüft]. Buffett nennt diese Faktoren selbst „fuzzy“ und
  nicht aus einer Datenbank ableitbar.
- Unsicherheit wird nicht eingepreist, sondern ausgesiebt: Was sich nicht schätzen lässt, wird nicht bewertet („you
  may decide you can't estimate it at all“, HV 1996); fast alle Entscheidungen landeten auf dem „too hard pile“
  (Munger, HV 2007, Vormittag, Kapitel „Quantitative approach to intrinsic value and investments“) [geprüft]. Für ein unsicheres Geschäft verlange er keine besonders große Sicherheitsmarge als Ausgleich, sondern
  gehe zu etwas weiter, das er besser versteht (HV 2007, Kapitel „When you don't need a huge margin of safety“)
  [geprüft]. Brief 2000: Wo selbst eine weite Spanne von Schätzungen kein Urteil erlaubt, sei jeder Kapitaleinsatz
  „speculative“ [geprüft].
- Risiko als Wahrscheinlichkeitsrechnung kennt Buffett für Arbitrage und Versicherung: Ein riskantes Einzelgeschäft
  sei vertretbar, wenn der wahrscheinlichkeitsgewichtete Gewinn den gewichteten Verlust deutlich übersteigt und sich
  viele ähnliche, voneinander unabhängige Geschäfte eingehen lassen (Brief 1993; HV 1994, Vormittag, Kapitel zu
  Risiko) [geprüft].
- Verschuldung: „any series of positive numbers […] evaporates when multiplied by a single zero“; Schulden müssten
  gelegentlich wirklich getilgt statt verlängert werden, und dann zähle nur Bargeld (Brief 2010, „Life and Debt“).
  Wirklich gute Unternehmen brauchten meist keine Schulden (Brief 1987) [geprüft].
- Management: Ein „franchise“ verträgt schlechtes Management, ein gewöhnliches Geschäft nicht (Brief 1991, Abschnitt
  zu Medien) [geprüft].
- Länder: Berkshire suche weltweit nach Wert, bevorzuge die USA „slightly“ und habe gegen einzelne Länder starke
  Vorbehalte (HV 2003, Nachmittag, Kapitel zu PetroChina) [geprüft].

**Weitere Quellen: Ausfallwahrscheinlichkeit im Bewertungsmodell.**

- Damodaran, „The Cost of Distress: Survival, Truncation Risk and Valuation“ (2006) und „Valuing Distressed and
  Declining Companies“ (2009): Ein Diskontierungsmodell überbewertet Unternehmen mit merklicher
  Ausfallwahrscheinlichkeit, auch bei richtig geschätzten Zahlungen und Sätzen [geprüft]. Zwei Wege: (a) je Jahr in
  den Zahlungen, mit der kumulierten Überlebenswahrscheinlichkeit als Produkt der Jahreswerte, was er als
  praktisch schwierig bezeichnet; (b) einmal auf den Gesamtwert:
  `Wert = Fortführungswert · (1 − π) + Notverkaufswert · π`, mit π als kumulierter Wahrscheinlichkeit über den
  Bewertungszeitraum [geprüft]. Seine Beispiele verwenden (b).
- Herleitung von π bei Damodaran: aus dem Rating über Tabellen kumulierter Ausfallraten, aus dem Anleihekurs (eine
  konstante Jahresrate, die den Kurs erklärt; Beispiel Global Crossing 13,53 % pro Jahr, also 76,63 % über zehn
  Jahre) oder aus einem Probit-Modell mit Unternehmensmerkmalen [geprüft]. Er räumt ein, dass die konstante Rate
  vereinfacht: Die Ausfallwahrscheinlichkeit sei in frühen Jahren höher und falle später [geprüft]. Seine
  Tabelle (2009, nach Altman, 1971 bis 2007), kumuliert über zehn Jahre: AAA 0,07 %, A 0,66 %, BBB 7,54 %,
  BB 19,63 %, B 36,80 %, CCC 59,02 % [geprüft]. Sein Vorbehalt: Ein Ausfall bedeutet nicht das Ende des
  Unternehmens.
- Erlös für die Aktionäre bei Ausfall: bei Damodaran abgeleitet (Notverkaufswert minus Schulden), im Beispiel null
  („equity investors would receive nothing“), nicht als allgemeine Regel gesetzt [geprüft].

**Weitere Quellen: Ausfallraten nach Ratingklasse.**

S&P Global Ratings, „2024 Annual Global Corporate Default And Rating Transition Study“ (27.03.2025), Daten 1981 bis
2024, Tabellen 24 und 26, weltweite durchschnittliche kumulierte Ausfallraten in Prozent [geprüft, gelesen in der
PDF-Fassung von S&P Maalot]. Die letzte Spalte ist die gleichwertige konstante Jahresrate `1 − (1 − C10)^(1/10)`
[eigene Rechnung]. S&P bereinigt nicht um zurückgezogene Ratings; die Werte liegen deshalb unter denen von Moody's.

| Klasse            | 1 Jahr | 5 Jahre | 10 Jahre | 15 Jahre | Jahresrate (aus 10 Jahren) |
| ----------------- | ------ | ------- | -------- | -------- | -------------------------- |
| AAA               | 0,00   | 0,34    | 0,67     | 0,86     | 0,07                       |
| AA                | 0,02   | 0,28    | 0,65     | 0,90     | 0,07                       |
| A                 | 0,05   | 0,39    | 1,03     | 1,56     | 0,10                       |
| BBB               | 0,14   | 1,36    | 2,86     | 4,01     | 0,29                       |
| BBB−              | 0,21   | 2,40    | 4,50     | 6,13     | 0,46                       |
| BB+               | 0,27   | 2,90    | 5,51     | 7,45     | 0,57                       |
| BB                | 0,56   | 5,75    | 10,44    | 13,05    | 1,10                       |
| BB−               | 0,87   | 8,28    | 14,67    | 17,85    | 1,57                       |
| B+                | 1,83   | 12,88   | 19,62    | 23,14    | 2,16                       |
| B                 | 2,93   | 15,60   | 22,02    | 25,11    | 2,46                       |
| B−                | 5,16   | 22,03   | 27,90    | 30,99    | 3,22                       |
| CCC/C             | 26,12  | 46,53   | 50,43    | 52,30    | 6,78                       |
| Investment Grade  | 0,08   | 0,77    | 1,69     | 2,38     | 0,17                       |
| Speculative Grade | 3,54   | 13,64   | 19,15    | 21,93    | 2,10                       |
| Alle              | 1,50   | 6,00    | 8,67     | 10,07    | 0,90                       |

Moody's, „Corporate Default and Recovery Rates, 1920–2010“ (28.02.2011), Abb. 33 und 34, kumulierte
emittentengewichtete Ausfallraten in Prozent [geprüft; jüngste erreichbare Ausgabe, gelesen von einer fremden
Ablage des Originals; neuere Ausgaben sind zugangsbeschränkt]. Moody's bereinigt um zurückgezogene Ratings.

| Klasse            | 1920–2010: 1 Jahr | 5 Jahre | 10 Jahre | Jahresrate | 1970–2010: 10 Jahre | Jahresrate |
| ----------------- | ----------------- | ------- | -------- | ---------- | ------------------- | ---------- |
| Aaa               | 0,00              | 0,16    | 0,85     | 0,09       | 0,49                | 0,05       |
| Aa                | 0,07              | 0,75    | 2,24     | 0,23       | 0,62                | 0,06       |
| A                 | 0,10              | 1,24    | 3,24     | 0,33       | 2,14                | 0,22       |
| Baa               | 0,29              | 3,06    | 6,91     | 0,71       | 4,90                | 0,50       |
| Ba                | 1,37              | 9,66    | 18,70    | 2,05       | 20,10               | 2,22       |
| B                 | 4,03              | 22,01   | 35,49    | 4,29       | 44,57               | 5,73       |
| Caa–C             | 14,69             | 41,28   | 52,86    | 7,25       | 72,38               | 12,07      |
| Investment Grade  | 0,16              | 1,72    | 4,13     | 0,42       | 2,57                | 0,26       |
| Speculative Grade | 3,91              | 17,84   | 28,46    | 3,29       | 34,45               | 4,13       |
| Alle              | 1,54              | 7,22    | 11,81    | 1,25       | 11,27               | 1,19       |

Einordnung unserer Stufen nach dem Zehnjahreswert [eigene Zuordnung]:

| `p` pro Jahr | kumuliert 10 Jahre | entspricht bei S&P            | entspricht bei Moody's (1920–2010)  |
| ------------ | ------------------ | ----------------------------- | ----------------------------------- |
| 0,5 %        | 4,9 %              | BBB− bis BB+                  | zwischen A und Baa                  |
| 1,8 %        | 16,6 %             | zwischen BB− und B+           | knapp besser als Ba                 |
| 3,0 %        | 26,3 %             | zwischen B und B−             | zwischen Ba und B, nahe Spec. Grade |
| 4,25 %       | 35,2 %             | schlechter als B−, besser CCC | B                                   |

Weitere Befunde aus denselben Studien:

- Schwankung über die Jahre (S&P, Tabelle 1): Die Ausfallrate im Speculative Grade lag zwischen 0,63 % (1981) und
  11,02 % (1991), mit Spitzen 2001 (9,70 %), 2002 (9,35 %) und 2009 (9,89 %); 2024 waren es 3,94 %. Investment
  Grade höchstens 0,42 % (2008) [geprüft]. Moody's, Abb. 31: 15,39 % (1933), 13,14 % (2009) [geprüft].
- Die Jahresrate ist nicht konstant. Aus S&P-Tabelle 24 errechnete bedingte Jahresraten [eigene Rechnung]:
  Speculative Grade 3,5 % im ersten Jahr, 2,1 % im fünften, 1,0 % im zehnten, 0,6 % im fünfzehnten; B 2,9 %, 2,6 %,
  1,2 %, 0,7 %; A dagegen 0,05 %, 0,10 %, 0,13 %, 0,11 %. S&P-Tabelle 10: Bis zum Ausfall vergehen ab dem ersten
  Rating im Mittel 14,7 Jahre bei A, 7,3 bei BB, 5,2 bei B, 2,0 bei CCC/C [geprüft].
- Erlösquoten für Anleihen (Moody's 2011): vorrangig unbesichert 36,7 % nach Kurs 30 Tage nach Ausfall (1982 bis
  2010), 49,2 % endgültig (1987 bis 2010, Nordamerika); nachrangig rund 29 %. Für Aktien nennt Moody's keine
  Erlösquote [geprüft].

**Weitere Quellen: Ausfall der Anleihe ist nicht Verlust der Aktie, und umgekehrt.**

- In der Insolvenz erhielten Aktionäre in älteren US-Stichproben einen kleinen Teil: Eberhart/Moore/Roenfeldt
  (Journal of Finance 1990), 30 Verfahren nach Chapter 11: Abweichungen von der Rangfolge zugunsten der Aktionäre
  im Mittel 7,6 % der Gesamtverteilung [geprüft nur in der Zusammenfassung des Verlags]. Überblick der Federal
  Reserve Bank of Cleveland (Longhofer/Carlstrom, Economic Review 1995 Q4, Tabelle 1): Abweichungen in rund zwei
  Dritteln bis drei Vierteln der Fälle, Umfang je nach Studie 1,6 % bis 9,5 % des Unternehmenswerts [geprüft im
Überblick, die Einzelstudien indirekt]. Capkun/Weiss (222 Verfahren 1993 bis 2004): Aktionäre haben diese
  Zugeständnisse weitgehend verloren [geprüft nur in der Zusammenfassung]. Die Prozentsätze beziehen sich auf den
  Unternehmenswert in der Insolvenz, nicht auf den Kaufkurs.
- Verlust ohne Ausfall: Bessembinder (Journal of Financial Economics 2018): Die Mehrheit der US-Aktien seit 1926
  hat über ihre Lebensdauer weniger gebracht als einmonatige Schatzwechsel; die besten 4 % erklären den gesamten
  Nettozuwachs des Markts [geprüft in der Zusammenfassung des Verlags; Volltext nicht erreichbar]. Laut
  Zusammenfassung der Arizona State University: 58 % unter Schatzwechseln, mittlere Verweildauer (Median) 7,5 Jahre
  [geprüft, institutionelle Zusammenfassung]. Auswertung von Bessembinders veröffentlichter Datei (CRSP 1926 bis
  2025, 29.754 Aktien, 347.434 Aktienjahre) [Datei geprüft, Kennzahlen vom Rechercheur berechnet, nicht aus dem
Papier]: Lebensrendite höchstens −99 % bei 5,6 % der Aktien (0,48 % je Aktienjahr), höchstens −90 % bei 21,9 %
  (1,88 % je Aktienjahr), höchstens −75 % bei 31,9 % (2,73 % je Aktienjahr). Bei über 20 Jahre notierten Aktien
  11,0 % mit höchstens −90 %, bei unter fünf Jahre notierten 22,8 %. Die Raten sind gleichgewichtet und von
  kleinen, jungen US-Unternehmen geprägt.
- Bessembinder/Chen/Choi/Wei (Financial Analysts Journal 2023), 64.000 Aktien weltweit 1990 bis 2020: 55,2 % der
  US-Aktien und 57,4 % der übrigen unter Schatzwechseln [geprüft nur in der Zusammenfassung].
- J.P. Morgan (Cembalest, „The Agony & the Ecstasy“, 02.09.2014; Bankstudie, nicht begutachtet), Russell 3000 von
  1980 bis 2014: 40 % aller Aktien mit „catastrophic loss“ (Rückgang um 70 % oder mehr vom Hoch ohne nennenswerte
  Erholung); nach Branchen 13 % bei Versorgern, 25 % bei Finanzwerten, 26 % bei Basiskonsum, 57 % bei
  Informationstechnik [geprüft].

**Weitere Quellen: Lebensdauer und Delisting.**

- Doidge/Karolyi/Stulz, „The U.S. Listing Gap“ (NBER WP 21181; JFE 2017), CRSP 1975 bis 2012, Tabelle 5: Delisting
  aus wirtschaftlichem Grund („for cause“) 3,25 % der notierten Unternehmen pro Jahr (1975 bis 1996) und 3,50 %
  (1997 bis 2012); durch Übernahme 3,92 % und 5,64 %; insgesamt 7,29 % und 9,49 % [geprüft].
- Mauboussin/Callahan, „Birth, Death, and Wealth Creation“ (2023): Halbwertszeit börsennotierter Unternehmen rund
  zehn Jahre; Delistings seit 1976 zu 58 % durch Übernahme, 39 % aus wirtschaftlichem Grund, 3 % freiwillig;
  rund drei Viertel der Delistings aus wirtschaftlichem Grund waren Insolvenzen; zum Alter widersprechen sich die
  Studien (mehrere finden sinkendes Sterberisiko mit dem Alter, eine findet es „approximately age independent“)
  [geprüft]. Base Rate Book (2016): Etwa die Hälfte aller börsennotierten Unternehmen besteht nach zehn Jahren
  nicht mehr [geprüft].
- Verlust beim Delisting: Shumway/Warther (Journal of Finance 1999) setzen für fehlende Renditen bei Delisting
  wegen schlechter Entwicklung an der Nasdaq −55 % an [geprüft nur in der Zusammenfassung]. Shumway (1997), −30 %
  für NYSE/AMEX [nicht verifiziert]. Fama/French (2004), Überlebensraten neuer Börsenwerte [nicht verifiziert].

**Weitere Quellen: Was Ausfall vorhersagt.**

- Campbell/Hilscher/Szilagyi, „In Search of Distress Risk“ (NBER WP 12362, 2006; Journal of Finance 2008): Ausfall
  („failure“: Insolvenz, Delisting aus wirtschaftlichem Grund oder Rating D) sagen voraus: höhere Verschuldung,
  niedrigere Rentabilität, niedrigere Marktkapitalisierung, niedrigere und stärker schwankende Aktienrenditen,
  weniger Zahlungsmittel, höheres Kurs-Buchwert-Verhältnis, niedriger Aktienkurs [geprüft im Arbeitspapier]. Aus
  Tabelle 1 errechnet: 1,07 % Ausfälle je Unternehmensjahr 1963 bis 2003, in den Jahren 1999 bis 2003 zwischen 1,8 %
  und 3,7 % [eigene Rechnung des Rechercheurs]. Tabelle 6, vorhergesagte Wahrscheinlichkeit nach Gruppen, auf das
  Jahr hochgerechnet: sicherste 5 % rund 0,13 %, mittlere Gruppe rund 0,4 %, riskantestes 1 % rund 9 % [Lesart als
Monatswerte und Hochrechnung durch den Rechercheur]. Aktien mit hoher Ausfallwahrscheinlichkeit brachten
  **niedrigere** Renditen: sicherste 5 % +3,39 % pro Jahr über dem Markt, riskantestes 1 % −16,30 % (1981 bis 2003)
  [geprüft im Arbeitspapier].
- Altman (Z-Score; gelesen in Altmans eigener Neufassung von 2000): Umlaufvermögen netto, einbehaltene Gewinne und
  EBIT je Bilanzsumme, Marktwert des Eigenkapitals je Schulden, Umsatz je Bilanzsumme [geprüft in der Neufassung;
Original 1968 nicht gesehen]. Ohlson (1980) [nicht verifiziert].
- Graham, „The Intelligent Investor“, Kap. 14, sieben Kriterien für den defensiven Anleger: angemessene Größe;
  Umlaufvermögen mindestens das Doppelte der kurzfristigen Verbindlichkeiten und langfristige Schulden nicht über
  dem Netto-Umlaufvermögen; Gewinn in jedem der letzten zehn Jahre; Dividende ununterbrochen seit mindestens 20
  Jahren; Gewinnwachstum von mindestens einem Drittel in zehn Jahren (Dreijahresmittel); Kurs höchstens das 15-Fache
  des Dreijahresgewinns; Kurs höchstens das 1,5-Fache des Buchwerts [geprüft]. Zwei der sieben Kriterien betreffen
  den Preis.
- Branchen: Mauboussin/Callahan (2023), Abb. 16: Beständigkeit der Kapitalrendite über fünf Jahre nach Branchen von
  0,46 (Basiskonsum) bis −0,12 (Versorger) [geprüft]; dazu die Branchenspanne bei J.P. Morgan (oben).

**Spezifikation.** Abschnitt 6: 15 Faktoren mit Höchstabzügen, Summe = Risikowert; `p = 0,5 % + 5 % · Risikowert` pro
Jahr, konstant über alle Jahre und im Endwert; bei Ausfall entfallen alle künftigen Rückflüsse (Abschnitt 3). Ab 75 %
Risikowert ausgeschlossen (`p` dann 4,25 %). Der Kaufpreis ist kein Risikofaktor. Abschnitt 13 nennt die Kalibrierung
an Ausfallraten nach Bonitätsklasse als offen.

Rechnerisch folgt aus konstantem `p` über zehn Jahre ein kumulierter Ausfall von 4,9 % (p = 0,5 %), 16,6 % (1,8 %),
26,3 % (3,0 %) und 35,2 % (4,25 %).

**Abweichung.**

- **Gedeckt (Prinzip):** Ausfall als Wahrscheinlichkeit auf die Zahlungen statt als pauschaler Zinsaufschlag;
  `(1 − p)^t` mit konstantem `p` entspricht Damodarans Überlebensprodukt und seiner Anleiheformel. Kein Erlös für
  Aktionäre im Ausfall ist für die Insolvenz eine vertretbare Vereinfachung (Erlösquoten der Anleihen 37 bis 49 %,
  Aktionäre zuletzt praktisch nichts).
- **Abweichung beim Sockel:** 0,5 % pro Jahr entsprechen einem Rating um BBB−/BB+ (S&P) bzw. zwischen A und Baa
  (Moody's). Unternehmen mit Rating A fallen laut S&P mit rund 0,10 % pro Jahr aus (Moody's 0,22 bis 0,33 %),
  Investment Grade insgesamt mit 0,17 % (Moody's 0,26 bis 0,42 %). Als Ausfallrate ist der Sockel für die besten
  Unternehmen rund fünfmal zu hoch. Deckung hat er nur als Rate für jeden Totalverlust einer beliebigen
  US-Aktie (Bessembinder-Datei: 0,48 % je Aktienjahr mit höchstens −99 %).
- **Mittlerer Bereich gedeckt für den breiten Markt, nicht für Qualitätswerte:** 1,8 % liegen bei Ratings um
  BB−/B+, nahe der Rate für Speculative Grade (S&P 2,10 %) und nahe der Häufigkeit von Verlusten über 90 % im
  US-Gesamtmarkt (1,88 % je Aktienjahr); über alle gerateten Emittenten sind es 0,9 % (S&P) bis 1,25 % (Moody's).
  3,0 % und 4,25 % entsprechen B bis B− bzw. der Delisting-Rate aus wirtschaftlichem Grund (3,25 bis 3,5 %).
- **Abweichung bei der Spanne:** Zwischen bester und schlechtester zulässiger Aktie liegt bei uns Faktor 8,5
  (0,5 % bis 4,25 %). In den Daten liegt zwischen A und B Faktor 25 (S&P, Jahresrate aus zehn Jahren), zwischen den
  sichersten 5 % und dem riskantesten 1 % bei Campbell u. a. rund Faktor 70. Die lineare Zuordnung drückt gute
  Unternehmen nach oben und unterscheidet am riskanten Ende weniger, als die Daten es tun.
- **Abweichung beim Zeitverlauf:** Die gemessene Rate fällt bei schwachen Schuldnern mit den Jahren (Speculative
  Grade von 3,5 % auf 1,0 % im zehnten Jahr) und steigt bei guten leicht. Konstantes `p = 3 %` ergibt nach 15
  Jahren 36,7 % kumuliert, S&P misst für B 25,1 %. Im Endwert wirkt `p` zusätzlich auf ewig (2.5).
- **Abweichung bei der Bedeutung von „Ausfall“:** Die Rating-Daten messen Zahlungsausfall von Schulden; ein Teil
  der Unternehmen besteht danach weiter (Damodaran). Umgekehrt verlieren Aktien viel häufiger dauerhaft den
  Großteil ihres Werts, als Schuldner ausfallen (J.P. Morgan: 40 % der Aktien; Bessembinder). Ein Delisting aus
  wirtschaftlichem Grund ist im Mittel kein Totalverlust am Ereignis (−55 % an der Nasdaq laut Shumway/Warther),
  der größere Teil des Verlusts liegt meist davor. Unser `p` kennt nur „alles weg“ oder „nichts passiert“; die
  dauerhafte Schrumpfung bildet allein ein negatives `g0` ab.
- **Abweichung bei der Herleitung von `p`:** Damodaran leitet die Wahrscheinlichkeit aus Rating, Anleihekurs oder
  einem statistischen Modell ab, Campbell u. a. aus Verschuldung, Rentabilität, Marktkapitalisierung, Volatilität,
  Zahlungsmitteln und Bewertung. Unser Raster ist eine Summe von Abzügen aus dem Buch ohne Eichung an
  Ausfalldaten (Abschnitt 13 nennt das). Von den empirischen Größen enthält es Verschuldung (Faktor 2),
  Rentabilität (8, 9) und Größe (3, an der Bilanzsumme statt an der Marktkapitalisierung); Volatilität,
  Zahlungsmittel und Bewertung fehlen. Zum Alter (Faktor 4, bis 30 %) ist die Evidenz uneinheitlich (Mauboussin
  2023); die Bessembinder-Datei zeigt bei lange notierten Aktien etwa halb so viele Verluste über 90 %.
- **Vermischung zweier Risikoarten:** Damodaran trennt Abbruchrisiko (in die Zahlungen) von Fortführungsrisiko (in
  den Diskontsatz). Unser Raster führt beides in `p`: Land, Währung, Branche, Prognosesicherheit, Burggraben und
  Margen beschreiben überwiegend Schwankung und Höhe künftiger Gewinne, nicht das Ende des Unternehmens.
- **Abweichung von Buffett:** Sein Raster (Brief 1993) hat fünf Punkte, darunter den Kaufpreis und die
  Aktionärsorientierung des Managements; Größe, Alter, Margen und Währung nennt er nicht. Er verrechnet Risiko
  nicht additiv, sondern schließt aus, was er nicht beurteilen kann. Graham führt den Preis ebenfalls unter den
  Sicherheitskriterien (zwei von sieben). Bei uns ist der Preis kein Risikofaktor; er wirkt nur über die Rendite.
- **Gedeckt (Einzelfaktoren):** Gewinnstetigkeit über zehn Jahre, Finanzlage, Größe und Dividendenhistorie stehen
  so bei Graham; Verschuldung und Burggraben bei Buffett; die Branche als Risikomerkmal stützen J.P. Morgan
  (13 % bis 57 %) und Mauboussin. Für die festen Schwellen von 10 % bei Kapitalrendite und EBIT-Marge fand sich
  keine Quelle; die Quellen messen die Kapitalrendite an den Kapitalkosten.
- **Befund gegen die Erwartung:** Bei Campbell u. a. brachten Aktien mit hoher Ausfallwahrscheinlichkeit die
  schlechtesten Renditen. Ein Markt, der Ausfallrisiko nicht mit höherer Rendite bezahlt, spricht dafür, es in der
  Rechnung abzuziehen; ob unser Abzug in der Höhe passt, sagt der Befund nicht.

### 2.7 Sicherheitsmarge und Untergrenze

**Buffett.**

- Sicherheitsmarge beim Kaufpreis ist Pflicht: Liege der gerechnete Wert nur wenig über dem Kurs, „we're not
  interested in buying“; die Sicherheitsmarge sei „the cornerstone of investment success“ (Brief 1992) [geprüft].
- Wie sie angesetzt wird: alle Größen realistisch und eher vorsichtig schätzen, nicht auf jeder Stufe einen Abschlag
  einbauen, und die Marge am Ende anwenden („when you get all through, you apply the margin of safety“, HV 2004,
  Vormittag) [geprüft]. Bei sehr stabilen Geschäften genügt eine kleine Marge („we will buy those […] much closer to
  a dollar on the dollar“, HV 2007) [geprüft].
- Untergrenze: 10 % vor Steuern, unabhängig vom Zinsniveau (Brief 2002, HV 2003; siehe 2.1) [geprüft]. Die Schwelle
  gilt für Berkshire, das auf Gewinne Körperschaftsteuer zahlt (10 % vor Steuern entsprächen 6½ bis 7 % danach,
  Brief 2002) [geprüft].
- Anleihen als Vergleich: Werden Anleihen als attraktiver gerechnet, sind sie zu kaufen (Brief 1992) [geprüft]. Im
  Brief 2011 hält Buffett zugleich fest, dass Anleihen und Geldwerte über lange Zeiträume Kaufkraft vernichtet haben
  und beim damaligen Zins kein angemessener Vergleichsmaßstab für den Verzicht auf Sachwerte waren [geprüft].

**Weitere Quellen.**

- Graham, „The Intelligent Investor“, Kap. 20: Die Sicherheitsmarge liegt in einer erwarteten Ertragskraft
  „considerably above the going rate for bonds“ (Beispiel: 9 % Gewinnrendite gegen 4 % Anleihezins); sie ist
  „always dependent on the price paid“; zwischen Sicherheitsmarge und Streuung bestehe ein enger Zusammenhang
  [geprüft]. In der kommentierten Ausgabe zitiert Zweig Grahams Vortrag von 1972: Ohne Abstand zwischen Gewinnrendite
  und Anleihezins gebe es „no margin of safety“ [geprüft nur als Zitat bei Zweig].
- Damodaran: Vergleichsmaß für eine erwartete Aktienrendite ist risikoloser Zins plus Risikoprämie; die implizite
  Prämie für den US-Markt lag 2026 zwischen 3,8 % und 4,4 % über der zehnjährigen Staatsanleihe (2.1) [geprüft].
- Thorp (2006), Abschnitt 7.3: Schätzungen der Überrendite von Aktien seien eher zu hoch als zu niedrig („more
  likely to be too high than too low“) [geprüft].

**Spezifikation.** Abschnitt 2: Die Buchmethode „innerer Wert minus Sicherheitsmarge“ wird nicht übernommen.
Abschnitt 7.1: kein Renditeziel; Untergrenze ist die Rendite der zehnjährigen Euro-Staatsanleihe ohne Aufschlag, im
Basisfall; die frühere Regel (Anleiherendite plus 5 Punkte, mindestens 7 %, im vorsichtigen Fall) ist gestrichen, mit
der Begründung, das Risiko stecke schon in `p` und im Positionslimit.

**Abweichung.**

- **Abweichung von Buffett und Graham (deutlich):** Beide verlangen einen Abstand zwischen Wert und Preis bzw.
  zwischen Aktienrendite und Anleihezins. Bei Graham ist Gleichstand ausdrücklich keine Sicherheitsmarge. Buffett
  setzt 10 % vor Steuern als feste Schwelle, unabhängig vom Zins. Unsere Untergrenze ist die Anleiherendite ohne
  Aufschlag im Basisfall.
- **Zur Begründung in Abschnitt 7.1** („das Risiko steckt bereits zweimal in der Rechnung“): `p` und Positionslimit
  decken das Risiko, dass das Unternehmen ausfällt. Die Sicherheitsmarge der Quellen deckt etwas anderes, den
  Fehler in der eigenen Schätzung von Niveau und Wachstum (Buffett 1992: „can easily go wrong in estimating future
  ‚coupons‘“; Thorp: Schätzungen eher zu hoch). Diesen Fehler fängt bei uns nur die Bandbreite aus 4.1 ab, die für
  Untergrenze und Rang nicht verwendet wird.
- **Abweichung von Damodaran:** Auch nach Überlebensfaktor wäre sein Maßstab die Anleiherendite plus Risikoprämie,
  2026 für den US-Markt rund 4 Punkte über der Staatsanleihe.
- **Teilweise gedeckt:** Buffett baut die Marge am Ende ein und nicht in jede Größe (HV 2004), und er verlangt bei
  sehr berechenbaren Unternehmen wenig Marge (HV 2007). Eine nach Berechenbarkeit gestufte Marge ist damit
  vereinbar; keine Marge ist es nicht. Dass die frühere Regel drei Viertel des Depots bar hielt, entspricht
  Buffetts eigener Folge der Schwelle (Brief 2002: „we will sit on the sidelines“).
- **Gedeckt:** kein Stop-Loss, Nachkauf bei gefallenem Kurs (Buffett, HV 1998; Brief 2011 zum Netto-Käufer).

### 2.8 Währung, Inflation, Land

**Buffett.**

- Maßstab ist Kaufkraft nach Steuern, nicht der Nominalbetrag (Brief 2011; Brief 1993, Faktor 5) [geprüft].
- Inflationsfest ist ein Unternehmen, das (1) Preise leicht erhöhen kann, ohne Marktanteil oder Menge zu verlieren,
  und (2) mehr nominalen Umsatz mit wenig zusätzlichem Kapital bewältigt (Brief 1981) [geprüft]. Brief 2011
  wiederholt beides als „double-barreled test“ und nennt regulierte Versorger als Gegenbeispiel, weil Inflation
  ihnen hohen Kapitalbedarf auferlegt [geprüft]. Brief 1983 (Anhang „Goodwill and its Amortization“): Ein Geschäft
  mit wenig materiellem Vermögen je Gewinn (See's: 2 Mio. $ Gewinn auf 8 Mio. $ Sachvermögen) muss bei Inflation
  weniger nachinvestieren als eines mit viel Sachvermögen (18 Mio. $ für denselben Gewinn) [geprüft].
- Inflation frisst einbehaltene Gewinne kapitalintensiver Unternehmen („restricted earnings“, Brief 1984; siehe
  2.3) [geprüft].
- Zu Währungsumrechnung oder Inflationsdifferenzen zwischen Währungen in der Bewertung einzelner Aktien findet sich
  in den durchsuchten Briefen keine Methode. [nicht gefunden]

**Weitere Quellen.**

- Währungskonsistenz: Damodaran, „What is the riskfree rate?“ (2008): Zahlungen und Zins müssen in derselben
  Währung stehen; die Umrechnung der Sätze läuft über das Verhältnis der erwarteten Inflation,
  `r_lokal = (1 + r_fremd) · (1 + Inflation_lokal) / (1 + Inflation_fremd) − 1` [geprüft]. Blog (20.01.2017): Ein
  sauber gerechneter Wert sei „currency invariant“ [geprüft].
- Währungsrisiko: „Currencies are measurement mechanisms, not value drivers“; nur unerwartete Kursänderungen seien
  Risiko, und es sei unklar, ob dafür ein Abschlag gehört, zumal das Risiko streubar sei; höhere Sätze in Ländern
  mit schwankender Währung seien dem Länderrisiko zuzuschreiben, nicht der Währung (Damodaran, Blog, 30.07.2015)
  [geprüft].
- Länderrisiko: bei Damodaran ein Aufschlag auf die Risikoprämie (Ausfallspanne des Staats mal relative
  Aktienvolatilität, im Juli 2026 Faktor 1,55), gewichtet danach, wo das Unternehmen tätig ist: Das Risiko komme
  „less from where the company is incorporated and more from where it operates“ (Blog, 15.07.2026; das zugehörige
  Papier 2026 war nicht abrufbar) [geprüft im Blog]. Nur einzelne, abgrenzbare Ereignisse wie Verstaatlichung
  gehörten in Wahrscheinlichkeiten und Zahlungen (ERP-Papier 2012) [geprüft]. Pauschale Abschläge von 10 oder 20 %
  auf die Zahlungen seien vorsichtig, aber keine Risikoanpassung („Measuring Company Exposure to Country Risk“,
  2003) [geprüft].
- Inflation und Wachstum ohne Kapital: Damodarans Wachstumsformeln rechnen nominal (2.5); Bernstein/Arnott und
  Siegel messen je Aktie real 1 bis 3 % (2.5).

**Spezifikation.** Abschnitt 4: Alle Größen in der Währung des Kurses. Abschnitt 7.1: Renditen in Fremdwährung werden
um den Abstand der erwarteten Inflation der Berichtswährung zu der des Euro gekürzt (IWF-Prognosen, Mittel der vier
Folgejahre). Abschnitt 6: Faktor 6 Land (bis 25 %, Vorschlag 12,5 % außerhalb Europa, Nordamerika, Japan, nach dem
Sitz) und Faktor 14 Währung (10 % außerhalb EUR, USD, CHF, GBP, JPY, nach der Berichtswährung). Die „+ 2 %“ in der
Wachstumsgrenze und in Abschnitt 4.3 stehen für Preissteigerungen ohne zusätzliches Kapital.

**Abweichung.**

- **Gedeckt:** Kürzung der Fremdwährungsrendite um den Inflationsabstand in der Verhältnisform
  `(1 + r) / (1 + Abstand) − 1`; das ist Damodarans Umrechnung. Buffetts Maß der Kaufkraft passt dazu.
- **Abweichung beim Währungsfaktor:** Faktor 14 erhöht `p` um 0,5 Punkte für jede Berichtswährung außerhalb von
  fünf Leitwährungen, zusätzlich zur Inflationskorrektur. Damodaran sieht in der Währung kein eigenes Risiko; was
  bleibt, sei Länderrisiko. Währung und Land werden bei uns getrennt und damit teils doppelt belastet.
- **Abweichung beim Länderfaktor:** Faktor 6 ist ein Abzug nach dem Sitz mit zwei Stufen als Vorschlag (0 % und
  12,5 %), der in die Ausfallwahrscheinlichkeit geht (bis 1,25 Punkte). Damodaran misst nach dem Ort der
  Geschäftstätigkeit, stuft nach der Bonität des Staats und führt das Risiko im Diskontsatz; in die
  Wahrscheinlichkeit gehören bei ihm nur abgrenzbare Ereignisse wie Enteignung. Buffett: leichte Bevorzugung des
  Heimatmarkts, starke Vorbehalte gegen einzelne Länder, keine Zahl.
- **Abweichung bei den „+ 2 %“:** Dass 2 % Wachstum kein Kapital brauchen, gilt nach Buffett nur für Unternehmen
  mit Preissetzungsmacht **und** geringem Kapitalbedarf (Briefe 1981, 1983, 2011); bei kapitalintensiven bindet
  gerade die Inflation Gewinn (Brief 1984). Die Spezifikation setzt die 2 % für alle Unternehmen und in jeder
  Währung gleich an, auch dort, wo die erwartete Inflation weit höher liegt.
- **Nicht gedeckt:** Der Deckel des Dauerwachstums von 3 % gilt vor der Inflationskorrektur und unabhängig von der
  Währung (2.5).

### 2.9 Portfolio und Positionsgröße

**Buffett.**

- Konzentration: Wer Unternehmen beurteilen kann und fünf bis zehn vernünftig bewertete mit dauerhaftem
  Wettbewerbsvorteil findet, für den ergebe breite Streuung keinen Sinn; unverständlich sei, Geld in die zwanzigste
  Wahl zu stecken statt in die besten („his 20th favorite rather than simply adding that money to his top choices“,
  Brief 1993) [geprüft]. Konzentration könne das Risiko senken, wenn sie die Gründlichkeit erhöht (Brief 1993)
  [geprüft].
- Breite Streuung ist dagegen richtig, (a) wenn das Einzelgeschäft ein erhebliches Verlustrisiko trägt (Arbitrage,
  Wagniskapital: viele unabhängige Positionen), und (b) für Anleger, die Unternehmen nicht beurteilen können
  (Indexfonds) (Brief 1993; HV 1994, Nachmittag, Kapitel „Diversify if you don't understand businesses“) [geprüft].
- Positionsgröße: In der Partnerschaft habe die Grenze bei etwa 40 % in einem Titel gelegen; ein großer Anteil am
  Vermögen sei vertretbar, wenn das Geschäft sehr gut verstanden ist, Geschäft, Preis und Management zusammen
  „virtually no risk“ ergeben **und** der Titel deutlich attraktiver ist als die zweite bis vierte Wahl (HV 1994,
  Nachmittag) [geprüft]. Die Größe hängt bei Buffett also an Sicherheit und relativer Attraktivität zugleich.
- Auswahl oberhalb der Schwelle: das Attraktivste, in der Praxis das Sicherste (HV 2003; siehe 2.1) [geprüft].
- Halten und Tauschen: Es sei meist töricht, sich von einem verständlichen und dauerhaft hervorragenden Geschäft
  zu trennen, solche Beteiligungen seien „too hard to replace“ (Brief 1993) [geprüft]. Verkauft werde, wenn Geld für
  etwas anderes gebraucht wird; Munger: ideal sei ein Verkauf, wenn man etwas gefunden hat, das man „immensely
  better“ findet (HV 1998, Vormittag, Kapitel „One of the few reasons to sell a stock“) [geprüft].
- Steuern und Umschlag: Brief 1989 rechnet vor, dass ein Dollar, der sich 20 Jahre lang jährlich verdoppelt, bei
  jährlicher Realisierung und 34 % Steuer auf etwa 25.250 $ wächst, bei einmaliger Versteuerung am Ende auf etwa
  692.000 $ [geprüft]. Der Unterschied stammt allein aus dem Zeitpunkt der Steuerzahlung.
- Nachkauf bei gefallenem Kurs: Der ideale Kauf sei, wenn etwas, das man schon mag, zu einem Preis notiert, bei dem
  man mehr kaufen möchte (HV 1998) [geprüft]. Stop-Loss-Marken kommen in den durchsuchten Quellen nicht vor.
- Zum Kelly-Kriterium äußert sich Buffett in den geladenen Mitschriften (HV 1994 bis 2004, 2007, 2008) nicht.
  [nicht gefunden]

- Ergänzend aus den Mitschriften: „Diversification is a protection against ignorance“; 30 bis 50 Aktien zu halten
  sei für jemanden, der Unternehmen beurteilen kann, „crazy“ (HV 1996, Nachmittag). Er habe mehrfach 75 % seines
  Vermögens in einer Sache gehabt; bei einer außergewöhnlichen Gelegenheit nur 20 % einzusetzen, verschenke sie
  (HV 2008, Vormittag) [geprüft].

**Weitere Quellen.**

- Kelly (Bell System Technical Journal 1956): Wer stets alles setzt, maximiert den Erwartungswert und ist mit
  Wahrscheinlichkeit eins ruiniert; zu maximieren sei die Wachstumsrate des Vermögens, der Erwartungswert des
  Logarithmus [geprüft, neu gesetzte Kopie]. Thorp (2006): bei zwei Ausgängen `f* = (b·p − q) / b`; für Anlagen
  mit stetiger Rendite `f* = (m − r) / s²`, also Überrendite geteilt durch Varianz (Gl. 7.3). Weil Schätzungen der
  Überrendite eher zu hoch ausfallen, solle man unter dem errechneten Anteil bleiben; viele wählten „half Kelly“
  und gäben damit ein Viertel der Wachstumsrate auf [geprüft]. Die Positionsgröße hängt hier von erwarteter
  Rendite **und** Risiko ab.
- Munger, „A Lesson on Elementary Worldly Wisdom“ (Vortrag an der USC Business School 1994, Mitschrift bei Farnam
  Street): Vorbild sei der Totalisator an der Rennbahn; „the wise ones bet heavily when the world offers them that
  opportunity. They bet big when they have the odds“ [geprüft in der Mitschrift; genaues Datum und
Erstveröffentlichung dort nicht genannt]. Das Wort „Kelly“ kommt weder dort noch bei Buffett in den geladenen
  Mitschriften als Formel vor.
- Mauboussin, „Size Matters“ (Legg Mason 2006) zum Kelly-Kriterium [nicht verifiziert, nicht abrufbar]. Markowitz:
  Gewichte nach erwarteter Überrendite und Kovarianz [nicht verifiziert, aus dem Gedächtnis].
- Graham, „The Intelligent Investor“, Kap. 5: für den defensiven Anleger „a minimum of ten different issues and a
  maximum of about thirty“ [geprüft]; Streuung als Gegenstück zur Sicherheitsmarge (Kap. 20) [geprüft].
- Konzentration der Erträge: Der gesamte Nettozuwachs des US-Aktienmarkts seit 1926 stammt von rund 4 % der Aktien
  (Bessembinder 2018, 2.6). Das spricht gegen sehr wenige Positionen, wenn die Auswahl nicht treffsicher ist, und
  ist das empirische Gegenstück zu Buffetts Bedingung „wer Unternehmen beurteilen kann“.

**Spezifikation.** Abschnitt 7: Kandidaten nach innerer Rendite sortieren, jedem `Limit = Basislimit · (1 − Risikowert)`
zuteilen, bis das Portfolio voll ist. Basislimit 15 % (fokussiert, etwa 6 bis 12 Positionen) oder 6,5 % (global, etwa
20 bis 25 Positionen, höchstens 20 % je Branche, 40 % je Region). Die Rendite bestimmt nur den Rang, das Risiko nur
die Größe. Tauschschwelle 1 bzw. 2 Prozentpunkte innere Rendite; Steuern beim Tausch sind offen (Abschnitt 13).
Kein Stop-Loss; Limits gelten zum Kaufzeitpunkt (Abschnitt 7.4).

**Abweichung.**

- **Gedeckt:** Rang nach der Bewertungsrechnung (Buffett 2000); Kauf der Besten statt gleichmäßiger Streuung; kein
  Stop-Loss; kleinere Positionen bei höherem Risiko (Buffett 1993 für riskante Einzelgeschäfte; Kelly/Thorp über
  die Varianz). Das globale Profil (20 bis 25 Titel) liegt in Grahams Spanne von 10 bis 30, das fokussierte (6 bis
  12) in Buffetts „five to ten“ und teils unter Grahams Minimum.
- **Abweichung bei der Positionsgröße:** Bei Kelly/Thorp, Munger und Buffett wächst die Größe mit dem erwarteten
  Vorteil **und** sinkt mit dem Risiko. Bei uns bestimmt die Rendite nur die Reihenfolge; ein Titel mit 15 %
  innerer Rendite bekommt bei gleichem Risikowert dasselbe Gewicht wie einer knapp über der Untergrenze.
  Thorps Vorbehalt (Renditeschätzungen sind zu hoch) spricht dafür, die Rendite gedämpft eingehen zu lassen, nicht
  dafür, sie wegzulassen.
- **Abweichung bei der Auswahl oberhalb der Schwelle:** Buffett kauft unter den zulässigen Titeln den, dessen er
  sich am sichersten ist (HV 2003). Unsere Sortierung nimmt die höchste innere Rendite; die Sicherheit geht nur
  über `p` in die Rendite und über das Limit in die Größe ein.
- **Abweichung bei der Bedingung für Konzentration:** Buffett knüpft sie an Verständnis des Geschäfts und an
  „virtually no risk“ (HV 1994) und verlangt breite Streuung, sobald das Einzelgeschäft ein erhebliches
  Verlustrisiko trägt (Brief 1993). Unser fokussiertes Profil lässt Titel bis unter 75 % Risikowert zu, also mit
  bis zu 35 % rechnerischem Ausfall in zehn Jahren, wenn auch mit kleinem Limit (bei 70 % Risikowert 4,5 % statt
  15 %). Bessembinders Befund verschärft den Punkt.
- **Abweichung beim Tausch:** Die Quellen setzen die Hürde für einen Tausch hoch (Buffett 1993: „too hard to
  replace“; Munger 1998: nur für etwas „immensely better“) und rechnen die Steuer ein (Brief 1989). Unsere
  Tauschschwelle beträgt 1 bzw. 2 Punkte innere Rendite ohne Steuer (Abschnitt 13 nennt die Steuer als offen) und
  liegt damit innerhalb der eigenen Bandbreite aus 4.1 (± 10 % Rückfluss, ± 1 Punkt Wachstum).
- **Nicht gedeckt:** Die Formel `Basislimit · (1 − Risikowert)` und die Basislimits selbst stammen aus dem Buch; in
  den hier geprüften Quellen findet sich keine vergleichbare Regel. Kelly und Thorp arbeiten mit Varianz bzw.
  Verlustwahrscheinlichkeit und Auszahlung; aus `p` und der inneren Rendite ließe sich ein solcher Anteil
  rechnen, die Spezifikation tut das nicht.

## 3. Quellenverzeichnis

Abruf aller Quellen am 20.11.2026. „Fremde Ablage“ heißt: Originaldokument, aber nicht vom Herausgeber gehostet.

### 3.1 Warren Buffett, Charlie Munger

- Briefe an die Aktionäre von Berkshire Hathaway, Übersicht: https://www.berkshirehathaway.com/letters/letters.html
  - 1977 bis 1997: `https://www.berkshirehathaway.com/letters/<Jahr>.html`; verwendet: 1979, 1981, 1983 (mit Anhang
    „Goodwill and its Amortization: The Rules and The Realities“), 1984, 1986 (mit Anhang „Purchase-Price Accounting
    Adjustments and the ‚Cash Flow‘ Fallacy“), 1987, 1989, 1991, 1992, 1993, 1996
  - 1998: https://www.berkshirehathaway.com/letters/1998pdf.pdf
  - 1999: https://www.berkshirehathaway.com/letters/final1999pdf.pdf
  - 2000, 2002: https://www.berkshirehathaway.com/letters/2000pdf.pdf, https://www.berkshirehathaway.com/letters/2002pdf.pdf
  - ab 2003: `https://www.berkshirehathaway.com/letters/<Jahr>ltr.pdf`; verwendet: 2007, 2010, 2011, 2012, 2016
- Owner's Manual: https://www.berkshirehathaway.com/ownman.pdf
- Hauptversammlungen, Mitschriften im Warren Buffett Archive von CNBC, Muster
  `https://buffett.cnbc.com/video/<Datum>/<morning|afternoon>-session---<Jahr>-berkshire-hathaway-annual-meeting.html`:
  - 1994 (Datum 1994/04/25), Vormittag und Nachmittag
  - 1996 (1996/05/06), Vormittag und Nachmittag
  - 1998 (1998/05/04), Vormittag
  - 2001 (2001/04/28), Vormittag
  - 2003 (2003/05/03), Nachmittag
  - 2004 (2004/05/01), Vormittag
  - 2007 (2007/05/05), Vormittag
  - 2008 (2008/05/03), Vormittag und Nachmittag
- Munger, „A Lesson on Elementary Worldly Wisdom As It Relates To Investment Management & Business“ (USC, 1994),
  Mitschrift: https://fs.blog/great-talks/a-lesson-on-worldly-wisdom/

### 3.2 Aswath Damodaran

- „Investment Valuation“, 2. Aufl., Kapitel 11 bis 14:
  https://pages.stern.nyu.edu/~adamodar/pdfiles/valn2ed/ch11.pdf (ebenso `ch12.pdf`, `ch13.pdf`, `ch14.pdf`)
- „The Cost of Distress: Survival, Truncation Risk and Valuation“ (2006):
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/distresspaper.pdf
- „Valuing Distressed and Declining Companies“ (2009):
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/NewDistress.pdf
- „Equity Risk Premiums (ERP): Determinants, Estimation and Implications – The 2012 Edition“:
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/ERP2012.pdf (Ausgabe 2026 auf SSRN nicht abrufbar)
- Implizite Risikoprämie, Startseite und Rechenblatt November 2026:
  https://pages.stern.nyu.edu/~adamodar/New_Home_Page/home.htm,
  https://pages.stern.nyu.edu/~adamodar/pc/implprem/ERPNov26.xlsx
- „Measuring Company Exposure to Country Risk: Theory and Practice“ (2003):
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/CountryRisk.pdf
- „What is the riskfree rate? A Search for the Basic Building Block“ (2008):
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/riskfreerate.pdf
- „Ups and Downs: Valuing Cyclical and Commodity Companies“ (2009):
  https://pages.stern.nyu.edu/~adamodar/pdfiles/papers/commodity.pdf
- Blog „Musings on Markets“:
  - „Data Update 2 for 2026“ (23.01.2026): https://aswathdamodaran.blogspot.com/2026/01/data-update-2-for-2026-equities-get.html
  - „Data Update 8 for 2026“ (24.02.2026): https://aswathdamodaran.blogspot.com/2026/02/data-update-8-for-2026-time-for.html
  - „Country Risk: The 2026 Edition“ (15.07.2026): https://aswathdamodaran.blogspot.com/2026/07/country-risk-drivers-measures-and.html
  - „Myth 4.4“ (04.11.2016): https://aswathdamodaran.blogspot.com/2016/11/myth-44-ddiscount-rate-is-receptacle.html
  - „Myth 5.2“ (30.11.2016): https://aswathdamodaran.blogspot.com/2016/11/myth-52-as-g-rto-infinity-and-beyond.html
  - „Cracking the Currency Code“ (20.01.2017): https://aswathdamodaran.blogspot.com/2017/01/january-2017-data-update-3-cracking.html
  - „Decoding Currency Risk“ (30.07.2015): https://aswathdamodaran.blogspot.com/2015/07/decoding-currency-risk-pictures-of.html
  - „Stock-based Employee Compensation“ (13.02.2014): https://aswathdamodaran.blogspot.com/2014/02/stock-based-employee-compensation-value.html

### 3.3 Ausfallraten, Insolvenz, Lebensdauer

- S&P Global Ratings, „Default, Transition, and Recovery: 2024 Annual Global Corporate Default And Rating Transition
  Study“ (27.03.2025), PDF bei S&P Maalot: https://maalot.co.il/Publications/FTS20250331162126.pdf
- Moody's, „Corporate Default and Recovery Rates, 1920–2010“ (28.02.2011), fremde Ablage:
  http://efinance.org.cn/cn/FEben/Corporate%20Default%20and%20Recovery%20Rates,1920-2010.pdf
- Longhofer/Carlstrom, „Absolute Priority Rule Violations in Bankruptcy“, Federal Reserve Bank of Cleveland,
  Economic Review 1995 Q4: https://fraser.stlouisfed.org/files/docs/publications/frbclevreview/rev_frbclev_1995q4.pdf
- Eberhart/Moore/Roenfeldt (1990), Journal of Finance 45(5), Zusammenfassung:
  https://econpapers.repec.org/RePEc:bla:jfinan:v:45:y:1990:i:5:p:1457-69
- Capkun/Weiss, Zusammenfassung: https://econpapers.repec.org/RePEc:hal:journl:halshs-00170589
- Bessembinder (2018), „Do stocks outperform Treasury bills?“, Journal of Financial Economics 129(3), Zusammenfassung:
  https://econpapers.repec.org/RePEc:eee:jfinec:v:129:y:2018:i:3:p:440-457; Zusammenfassung der Arizona State
  University: https://wpcarey.asu.edu/sites/default/files/2021-10/do-stocks-outperform-treasury-bills.pdf; Datei
  1926 bis 2025: https://wpcarey.asu.edu/sites/g/files/litvpz246/files/2026-03/WCandRets.100years_0.xlsx
- Bessembinder/Chen/Choi/Wei (2023), Financial Analysts Journal 79(3), Zusammenfassung:
  https://econpapers.repec.org/RePEc:taf:ufajxx:v:79:y:2023:i:3:p:33-63
- Doidge/Karolyi/Stulz, „The U.S. Listing Gap“, NBER WP 21181:
  https://www.nber.org/system/files/working_papers/w21181/w21181.pdf
- Shumway/Warther (1999), Journal of Finance 54(6), Zusammenfassung:
  https://econpapers.repec.org/RePEc:bla:jfinan:v:54:y:1999:i:6:p:2361-2379
- Campbell/Hilscher/Szilagyi, „In Search of Distress Risk“, NBER WP 12362:
  https://www.nber.org/system/files/working_papers/w12362/w12362.pdf
- Altman, „Predicting Financial Distress of Companies: Revisiting the Z-Score and ZETA Models“ (2000), fremde Ablage:
  https://moodle2.units.it/pluginfile.php/322514/mod_resource/content/0/Zscores.pdf
- J.P. Morgan (Cembalest), „The Agony & the Ecstasy“ (02.09.2014):
  https://www.chase.com/content/dam/privatebanking/en/mobile/documents/eotm/eotm_2014_09_02_agonyescstasy.pdf

### 3.4 Michael Mauboussin

- Mauboussin/Callahan/Majd, „The Base Rate Book“ (Credit Suisse, 26.09.2016), fremde Ablage:
  https://josephnoko.com/wp-content/uploads/2024/04/The-Base-Rate-Book-Michael-Mauboussin.pdf
- Mauboussin/Callahan, Morgan Stanley Counterpoint Global, jeweils unter
  `https://www.morganstanley.com/im/publication/insights/articles/` (gelesen über web.archive.org):
  - „Competitive Advantage Period: The Neglected Value Driver“ (14.04.2026): `article_theneglectedvaluedriver_ltr.pdf`
  - „ROIC and the Investment Process“ (06.06.2023): `article_roicandtheinvestmentprocess.pdf`
  - „Market-Expected Return on Investment“ (14.04.2021): `article_marketexpectedreturnoninvestment_en.pdf`
  - „Birth, Death, and Wealth Creation“ (25.07.2023): `article_birthdeathandwealthcreation.pdf`
  - „Capital Allocation: Results, Analysis, and Assessment“ (05.11.2025): `article_capitalallocation.pdf`
- Rappaport/Mauboussin, „Expectations Investing“, Online-Tutorial 8: https://www.expectationsinvesting.com/online-tutorial-8

### 3.5 Graham, Shiller, Siegel

- Graham, „The Intelligent Investor“ (Text der 4. Aufl. 1973 in der Ausgabe 2003 mit Kommentar von Zweig), Volltext
  einer Nutzerablage: https://archive.org/details/epdf.pub_the-intelligent-investor
- Campbell/Shiller (1988), „Stock Prices, Earnings, and Expected Dividends“, NBER WP 2511:
  https://www.nber.org/system/files/working_papers/w2511/w2511.pdf
- Campbell/Shiller (1998), „Valuation Ratios and the Long-Run Stock Market Outlook“:
  http://www.econ.yale.edu/~shiller/online/jpmalt.pdf; Fortschreibung 2001: NBER WP 8221
- Shiller, Datenseite: http://www.econ.yale.edu/~shiller/data.htm
- Siegel (2016), „The Shiller CAPE Ratio: A New Look“, Financial Analysts Journal 72(3), fremde Ablage:
  https://blog.lgim.com/landg-assets/lgim-blog/pdfs/the-shiller-cape-ratio_a-new-look.pdf

### 3.6 Empirie zu Wachstum und Ausschüttung

- Chan/Karceski/Lakonishok (2003), „The Level and Persistence of Growth Rates“, Journal of Finance 58(2), fremde
  Ablage (Akte einer Regulierungsbehörde):
  https://psc.ky.gov/pscecf/2012-00221/rateintervention@ag.ky.gov/10252012c/Chan_et_al_-_Level_and_Persistance_of_Growth_-_JF_-_2003.pdf
- Arnott/Asness (2003), „Surprise! Higher Dividends = Higher Earnings Growth“, Financial Analysts Journal 59(1):
  https://www.aqr.com/-/media/AQR/Documents/Insights/Journal-Article/Surprise-Higher-Dividends-Equal-Higher-Earnings-Growth.pdf
- Bernstein/Arnott (2003), „Earnings Growth: The Two Percent Dilution“, Financial Analysts Journal 59(5), fremde
  Ablage (Akte einer Regulierungsbehörde):
  https://psc.ky.gov/pscecf/2014-00372/rateintervention@ag.ky.gov/04062015044340/Articles_A-B.pdf
- Boudoukh/Michaely/Richardson/Roberts, „On the Importance of Measuring Payout Yield“, NBER WP 10651:
  https://www.nber.org/system/files/working_papers/w10651/w10651.pdf
- Brav/Graham/Harvey/Michaely, „Payout Policy in the 21st Century“, NBER WP 9657:
  https://www.nber.org/system/files/working_papers/w9657/w9657.pdf

### 3.7 Positionsgröße

- Kelly (1956), „A New Interpretation of Information Rate“, Bell System Technical Journal 35, neu gesetzte Kopie:
  https://www.princeton.edu/~wbialek/rome/refs/kelly_56.pdf
- Thorp (2006), „The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market“, Handbook of Asset and
  Liability Management, Kap. 9, Korrekturfassung:
  https://web.williams.edu/Mathematics/sjmiller/public_html/341/handouts/Thorpe_KellyCriterion2007.pdf

### 3.8 Nur sekundär belegt

- Greenwald (Earnings Power Value): Vorlesungsfolien von R. Jagannathan, Kellogg (23.03.2006), „based on“ Buch und
  Notizen Greenwalds:
  https://kellogg.northwestern.edu/faculty/jagannathan/teaching/practicum/2006/files/Week3/VI_Lecture_3.pdf

### 3.9 Nicht verifiziert

Nicht im Original gesehen und in dieser Datei entsprechend gekennzeichnet oder weggelassen:

- Ausgaben 2026 von Damodarans ERP- und Länderrisiko-Papier (SSRN gesperrt); „The Dark Side of Valuation“.
- Moody's Ausfallstudien nach 2011; S&P-Studie 2025 (erschienen 2026).
- Volltexte von Bessembinder (2018) und Bessembinder u. a. (2023), darunter die Aussage, der häufigste Ausgang sei
  −100 %; Fama/French (2004); Shumway (1997); Volltexte von Eberhart u. a. (1990) und Capkun/Weiss; Altman (1968);
  Ohlson (1980); J.P. Morgan, Fortschreibung 2021.
- Mauboussin: „Size Matters“ (2006), „Competitive Advantage Period“ in der Fassung von 1997, „Death, Taxes and
  Reversion to the Mean“, „Corporate Longevity“ (2017), „Disbursing Cash to Shareholders“ (2014); „Measuring the
  Moat“ (2024) nur überflogen.
- Rappaport/Mauboussin, „Expectations Investing“ (Buchtext); Graham/Dodd, „Security Analysis“ (Mittelungsregel nur
  als Zitat bei Campbell/Shiller); Grahams Vortrag von 1972 (nur als Zitat bei Zweig).
- Lintner (1956; nur über Brav u. a.); Häufigkeit von Dividendenkürzungen (keine Primärzahl gefunden);
  Dimson/Marsh/Staunton zum realen Dividendenwachstum; Markowitz.
- Greenwald/Kahn/Sonkin/van Biema, „Value Investing“ (Buch).
- Aussagen von Buffett oder Munger zum Kelly-Kriterium unter diesem Namen: in den geladenen Quellen nicht gefunden.
- Vom Rechercheur berechnet und nicht von den Autoren angegeben: gleichwertige Jahresraten und bedingte Jahresraten
  aus den Rating-Tabellen, Kennzahlen aus Bessembinders Datei, Summen aus den Klassen des Base Rate Book,
  Hochrechnung der Wahrscheinlichkeiten bei Campbell u. a. auf das Jahr.

## 4. Vorschläge

Abgeleitet aus Abschnitt 2 und einer Gegenrechnung am lokalen Datenvorrat (Stand 19.11.2026, 4.642 Titel mit
Rendite). Reihenfolge nach Wirkung auf die Rangfolge. Zahlen ohne Quellenangabe sind mit `src/calc/innerReturn.ts`
gerechnet.

### 4.1 Wachstumsgrenzen in Fremdwährung (Fehler im Modell)

Die Grenzen 8,5 %, 3 %, 2 % und −5 % gelten nominal in der Berichtswährung; danach kürzt `comparableReturn` die
Rendite um den Inflationsabstand. Bei hoher Inflation wird das Wachstum also erst gedeckelt und dann die volle
Inflation abgezogen. Dasselbe Unternehmen (Rückfluss 5 % des Kurses, `g0` 8,5 %, `p` 2 %) kommt in Euro auf 7,4 %,
in Lira (Abstand 17,5 Punkte) auf −8,6 %. Im Datenvorrat stehen 15 von 17 Titeln in argentinischen Pesos am Deckel,
ihre mittlere Rendite ist −3,9 %; Franken-Titel bekommen umgekehrt einen kleinen Vorteil. Damodaran bindet das
Dauerwachstum an den risikolosen Zins der jeweiligen Währung (2.5, 2.8).

Vorschlag: alle vier Grenzen um den Inflationsabstand der Berichtswährung verschieben (oder real rechnen und die
Inflation des Euro am Ende aufschlagen). Faktor 14 (Währung) bleibt dann der einzige Abzug für die Währung.

### 4.2 Rückflussniveau von Zyklikern

Der tragbare Rückfluss ist der Fünfjahresdurchschnitt des freien Cashflows. Fünf Jahre liegen bei Rohstoffen und
Schifffahrt oft ganz im Hoch. Ein Niveau am Hoch, das doppelt so hoch ist wie über den Zyklus, hebt die Rendite im
Beispiel von 5,1 % auf 13,2 %. Unter den 200 höchsten Renditen des Vorrats sind 23 Energie- und 14 Rohstoffwerte
(Kohle, Eisenerz, Reedereien an der Spitze). Graham verlangt sieben bis zehn Jahre (2.2); die Spezifikation führt
den Punkt unter „Offen“.

Vorschlag: Hat Faktor 1 einen Abzug (Verlustjahr oder Einbruch), gilt als tragbarer Rückfluss der niedrigere Wert aus
Fünf- und Zehnjahresdurchschnitt des freien Cashflows. Bei kürzerer Reihe ein Hinweis statt einer Rendite ohne Vorbehalt.

### 4.3 Untergrenze und Sicherheitsmarge

Die Untergrenze ist die Anleiherendite (3,41 %) im Basisfall. `p` deckt nur den Ausfall, nicht den eigenen
Schätzfehler; Buffett und Graham verlangen dafür eine Marge, Damodaran eine Risikoprämie von rund 4 Punkten (2.1,
2.7). Im Vorrat liegen 2.519 Titel über der Untergrenze, 817 über 8 %. Solange das Portfolio von oben gefüllt wird,
bindet die Grenze selten; sie entscheidet aber, wann ein gehaltener Titel kein Kandidat mehr ist und wann Bargeld
bleibt.

Vorschlag: Kandidat ist, wessen **vorsichtiger** Fall die Anleiherendite schlägt und dessen Basisfall die erwartete
Marktrendite erreicht (Anleihe plus Prämie, Parameter `premium`, Startwert 3 bis 4 Punkte). Das ist der
„Vergleichsmaßstab“ aus Abschnitt 13 der Spezifikation. Vor dem Umstellen am Depot des Autors prüfen: Die frühere,
strengere Regel ließ dort nur einen von 18 Titeln zu.

### 4.4 Ausfallwahrscheinlichkeit

- Die Spanne ist eng: Zwischen bestem und schlechtestem zulässigen Titel liegen bei Imperial Brands 4,2 Punkte Rendite
  (12,0 % bei `p` 0,5 %, 7,8 % bei 4,25 %). In den Ausfalldaten liegt zwischen A und B der Faktor 25, bei uns 8,5 (2.6).
- Der Sockel von 0,5 % ist für die besten Unternehmen etwa fünfmal zu hoch, der mittlere Bereich passt zu den Daten für
  Aktien (Verluste über 90 %: 1,88 % je Aktienjahr).

Vorschlag: Zuordnung konvex statt linear, etwa `p = 0,2 % · 25^(Risikowert / 75 %)` (0 % ergibt 0,2 %, 50 % ergeben
1,7 %, 75 % ergeben 5 %). Gegenargument: `p` steht bei uns auch für Kürzungen, die kein Totalverlust sind, und der
einzige Wert des Autors (Imperial Brands, 1,8 %) läge dann bei einem Risikowert von rund 51 % statt 26 %. Deshalb erst
umstellen, wenn weitere Werte des Autors bekannt sind; bis dahin beide Renditen nebeneinander zeigen.

### 4.5 Aktienbasierte Vergütung

Sie wird nur von den Rückkäufen abgezogen, und die Netto-Rückkäufe enden bei 0. Wer Dividende zahlt, nichts
zurückkauft und viel in Aktien vergütet, bleibt unbelastet; der Deckel aus dem freien Cashflow enthält die Vergütung
als nicht zahlungswirksamen Posten weiter (eigene Folgerung, an den Rohdaten zu prüfen). Buffett und Damodaran ziehen
sie vom Gewinn ab (2.2).

Vorschlag: tragbarer Rückfluss = freier Cashflow minus aktienbasierte Vergütung; Gewinnniveau unverändert (der
berichtete Gewinn enthält sie schon).

### 4.6 Kleinere Punkte

| Punkt                     | Befund                                                                                                       | Vorschlag                                                                                                              | Wirkung                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 2 % Wachstum ohne Kapital | Buffett lässt das nur bei Preissetzungsmacht und geringem Kapitalbedarf gelten; Damodaran verlangt `g / ROE` | Freibetrag nur bei Kapitalrendite ab 20 % (Bonusstufe von Faktor 8), sonst Endquote `1 − g∞ / 10 %`                    | klein: 4,99 % statt 4,73 % im Beispiel KGV 25, Quote 20 % |
| Abschmelzdauer            | Überrenditen halbieren sich im Mittel in rund drei Jahren; die Quellen knüpfen die Dauer an den Burggraben   | 15 Jahre nur mit Bonus in Faktor 7, sonst 10                                                                           | klein: 0,2 Punkte im selben Beispiel                      |
| Wachstumsvorschlag        | Historisches Wachstum sagt wenig voraus; unser kleinster von vier Werten ist bereits vorsichtig              | so lassen; in der Oberfläche den Zehnjahresmedian (real rund 5 %) als Vergleich nennen                                 | keine                                                     |
| Tauschschwelle            | 1 bis 2 Punkte ohne Steuer; Buffett tauscht nur bei großem Abstand                                           | Schwelle um die Steuer auf den aufgelaufenen Gewinn erhöhen (steht unter „Offen“)                                      | je Position                                               |
| Positionsgröße            | Bei Kelly und Buffett bestimmen Rendite und Sicherheit die Größe                                             | so lassen: Die Rendite wirkt über den Rang, das Risiko über das Limit; erst nach 4.3 neu beurteilen                    | –                                                         |
| Finanzwerte               | 69 der 200 höchsten Renditen; ihr Deckel ist das Gewinnniveau, nicht ein Cashflow                            | prüfen, ob die Grenze aus Einbehaltung bei Banken greift; sonst Deckel auf den Durchschnitt der gezahlten Ausschüttung | offen                                                     |

Kein Handlungsbedarf bei den Rückkäufen: Buffetts Einwand (Wert hängt am Preis) trifft den verbleibenden Aktionär. In
einer Rechnung über alle Rückflüsse zählt der Betrag, und das Wachstum wird schon als niedrigerer Wert aus „je Aktie“
und „Gesamtunternehmen“ genommen, sodass Rückkäufe nicht doppelt zählen.

### 4.7 Stand der Umsetzung (20.11.2026)

Umgesetzt und in `docs/SPEZIFIKATION.md` beschrieben:

- **4.1 Wachstumsgrenzen in Fremdwährung:** Alle Grenzen gelten in Euro-Kaufkraft und werden um den Inflationsabstand
  verschoben (Spezifikation 4.4). Mittlere Rendite je Berichtswährung vorher → nachher: EUR 2,96 % → 2,96 %,
  CHF 3,61 % → 2,83 %, KZT 7,51 % → 9,65 %, ARS −4,29 % → 5,63 %. Die Grenze aus Einbehaltung rechnet weiter mit der
  nominalen Eigenkapitalrendite.
- **4.2 Zykliker:** Bei einem Abzug in Faktor 1 gilt der niedrigere Wert aus Fünfjahresmittel und Median der ganzen
  Reihe. Der zuerst gebaute Zehnjahres-Mittelwert wurde verworfen, weil einzelne Jahre mit Buchungseffekten ihn
  zerstören. Die Zusammensetzung der 200 höchsten Renditen ändert sich weniger als erwartet (Energie 20 → 17,
  Rohstoffe 14 → 13); einzelne Titel sinken stark (Olin 26,6 % → 7,6 %, Evergreen Marine 20,2 % → 10,0 %).
- **4.5 Aktienbasierte Vergütung:** An den Rohdaten bestätigt (freier Cashflow = operativer Cashflow minus
  Investitionen, Vergütung als Hinzurechnung; bei Salesforce geht die Überleitung exakt auf). Sie wird vom tragbaren
  Rückfluss abgezogen; negative Werte und grobe Ausreißer des Anbieters werden verworfen, auch in den Netto-Rückkäufen.
- **Neu, aus den Reviews:** Für die Einbehaltung zählt der ungedeckelte Rückfluss (Dividende plus Netto-Rückkäufe).
  Vorher wertete das Modell ausgezahltes Geld als einbehalten, sobald ein Deckel griff, und ein niedrigerer Rückfluss
  konnte die Rendite erhöhen. Die Regel trifft 394 Titel mit im Mittel −1,1 Punkten und macht sichtbar, wo der
  Cashflow-Deckel selbst zu hart ist (investierende Unternehmen, Finanzsparten, Tilgungsregel bei Charter).

Wirkung insgesamt: Im Datenvorrat sinkt die mittlere Rendite der Nicht-Finanzwerte von 3,7 % auf 3,2 %. Das
Zielportfolio der Watchlist bleibt unverändert (gleiche Titel, Gewichte und Vorschläge), 12 von 22 Titeln wechseln
den Rang.

Nicht umgesetzt, als offene Punkte in Spezifikation 13: Untergrenze (4.3, durchgerechnet, Entscheidung offen),
Ausfallwahrscheinlichkeit (4.4), die kleineren Punkte aus 4.6 und die Finanzwerte im Datenvorrat.
