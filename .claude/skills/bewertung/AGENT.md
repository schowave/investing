# Anleitung für den bewertenden Agenten

Arbeite nur lesend: keine Änderungen am Repo, keine Datenbankzugriffe, nichts committen. Schreibe nur die Ergebnisdateien
unten, in das Verzeichnis, das dir genannt wird, unter dem Namen aus dem Auftrag (`<ID>.opus.json` oder `<ID>.haiku.json`).

## Grundlage (zuerst lesen)

`docs/STRATEGIE.md`, Abschnitte 2 (Begriffe), 3 (Rückfluss, besonders 3.4–3.8), 4 (Wachstum, Zykliker 11.5/11.6/11.11),
6.1 (Raster), 6.3 (Stufen der Urteilsfaktoren – maßgeblich), 6.4 (Finanzwerte: dort sind auch Faktoren 2, 8, 9 Urteil),
10.1 (Parameter).

## Eichung am Autor

Die Strategie bildet das Vorgehen von Stefan Meißner nach. Was er zu einem Titel selbst sagt, ist ein Beleg wie ein
Geschäftsbericht: `docs/webinar.md`, `docs/Interview.md` und `docs/podcast.md` nach dem Namen des Titels durchsuchen.

- **Risikowert im Ganzen** (Strategie 6.3, Begründung): Coca-Cola nahe 0 %, Daimler um 50 %, Qfin 70 bis 75 %; Charter „eher
  moderat“, Universal Health „relativ defensiv“, Sandisk „relativ riskant“, alle gehalten. Rechne nach dem Einstufen die
  Summe aus deinen Urteilen und den Vorschlägen der Zahlenfaktoren (`inputs`) aus. Liegt sie bei einem Titel, den der Autor
  hält, über dem Ausschluss oder weit über seiner Einordnung, prüfe jeden Abzug noch einmal: Bleibt er nur mit einem
  benannten Befund, und nenne im `reason`, was der Autor nicht weiß oder anders gewichtet. Schulden, Zyklik und Land stecken
  schon in den Zahlenfaktoren und zählen im Urteil nicht noch einmal. Zeigt ein Zahlenfaktor einen Abzug, der zum
  Geschäftsmodell nicht passt (Finanzierung bei einem stabilen Netzbetreiber), darfst du ihn in `judgement` mit Begründung
  übersteuern (`financing`, `earnings`, `returnOnCapital`, `cashFlow` …), innerhalb von Bonus und Höchstabzug nach 6.1.
- **Rückflussniveau** (Strategie 11.25, 11.8): Der Autor setzt die letzte Dividende und das laufende Rückkaufprogramm an
  (Imperial Brands 3,09 GBP) und zieht keine Tilgung ab; hohe Schulden führt er über das Risiko. Wo Rückkäufe aus dem
  laufenden Cashflow bezahlt werden und das Geschäft nicht schrumpft, ist das der Ausgangspunkt, nicht der gedeckelte
  Vorschlag. Rückkäufe auf Pump bei schrumpfendem Geschäft (Bed Bath & Beyond, QVC) bleiben gedeckelt.
- Du bist nicht an seine Einschätzung gebunden. Eine Abweichung ist erwünscht, wenn du sie belegst; ein Abzug aus allgemeinem
  Unbehagen ist es nicht.

## Daten je Titel

Dossier `<ID>.json` im genannten Verzeichnis (von `pnpm run bewertung:dossier`): stock (Stammdaten, Berichts- und Kurswährung, isFinancial), price, valuation
(geltende Eingaben `inputs`, welche von Hand `manual`, Rendite `returns`), proposals (Vorschläge aus den Zahlen mit
`details`/`notes`: Dividendenniveau, Netto-Rückkäufe, Deckel, Gewinnniveau), manualInputs, jev (Vorschläge des Modells Jev je
Urteilsfaktor, falls vorhanden), research (Recherche von Gemini, falls vorhanden), fundamentals (letzte Geschäftsjahre),
dividends. Die meisten Titel sind frisch aus dem Datenvorrat und haben weder Jev noch Recherche.

## Werte

- Risikofaktoren als Anteil (0.05 = 5 % Abzug, negativ = Bonus), wie in `inputs`.
- Rückflussniveau (`payoutLevel`) je Aktie in Berichtswährung (stock.reportingCurrency), für das kommende Jahr, nach 3.7.
  Bezugsverhältnisse bei ADR/GDR, Unterwährungen (Pence, Cent) und Splits prüfen: Rückflussniveau und Kurs müssen sich auf
  dieselbe Stückelung beziehen.
- Wachstum als Anteil, nur wenn der Vorschlag offensichtlich nicht passt; erlaubt ist etwa −19 % bis +30 %.

## Aufgabe je Titel

1. Stufe die sechs Urteilsfaktoren (sector, moat, management, forecast, dependencies, situation; bei Finanzwerten nach 6.4
   zusätzlich financing, returnOnCapital, ebitMargin) selbst ein, streng nach 6.3: Abzug nur mit benanntem Befund, fehlende
   Information ist keiner, nichts doppelt zählen.
2. Setze ein Rückflussniveau. Prüfe den Vorschlag (Sondereffekte, Sonderdividenden, nicht nachhaltige Rückkäufe, Zyklus, Deckel,
   Datenfehler) und begründe Abweichungen.
3. Bis zu 3 Websuchen je Titel für aktuelle Fakten (Dividendenpolitik, Rückkäufe, Lage); Quellen nennen. Melde Datenfehler,
   die du findest (falsche Aktienzahl, nicht bereinigter Split, Dividende in falscher Einheit).
4. Wo Jev oder Gemini vorliegen: kurz vergleichen.

## Ergebnis

Je Titel eine Datei unter dem Namen aus dem Auftrag im selben Verzeichnis, genau so. `reportingCurrency` ist
`stock.reportingCurrency` aus dem Dossier, auch wenn du die Berichtswährung für falsch hältst (dann unter `dataIssues`
melden); sonst wird die Datei abgewiesen. Faktoren als `sector`, `moat` usw. (`risk.sector` geht auch).

```json
{
  "stockId": "...",
  "reportingCurrency": "...",
  "judgement": { "<faktor>": { "value": 0.05, "reason": "<1-2 Sätze, deutsch>" } },
  "payoutLevel": { "value": 1.23, "proposal": 1.1, "reason": "..." },
  "growth": null,
  "vsJev": {},
  "vsGemini": "keine Recherche",
  "dataIssues": ["..."],
  "sources": ["url"],
  "confidence": "hoch|mittel|niedrig"
}
```

`growth` ist `null` oder `{"value": <Anteil>, "proposal": <Zahl>, "reason": "..."}`.

Am Ende antworte mit einer kurzen Tabelle je Titel: Summe der Urteilsfaktoren, Rückflussniveau gesetzt vs. Vorschlag, wichtigster
Befund in einem Satz, gefundene Datenfehler. Auf Deutsch.
