# Anleitung für den bewertenden Agenten

Arbeite nur lesend: keine Änderungen am Repo, keine Datenbankzugriffe, nichts committen. Schreibe nur die Ergebnisdateien
unten, in das Verzeichnis, das dir genannt wird.

## Grundlage (zuerst lesen)

`docs/STRATEGIE.md`, Abschnitte 2 (Begriffe), 3 (Rückfluss, besonders 3.4–3.8), 4 (Wachstum, Zykliker 11.5/11.6/11.11),
6.1 (Raster), 6.3 (Stufen der Urteilsfaktoren – maßgeblich), 6.4 (Finanzwerte: dort sind auch Faktoren 2, 8, 9 Urteil),
10.1 (Parameter).

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

Je Titel eine Datei `<ID>.opus.json` im selben Verzeichnis, genau so:

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

Am Ende antworte mit einer kurzen Tabelle je Titel: Summe der Urteilsfaktoren, Rückflussniveau Opus vs. Vorschlag, wichtigster
Befund in einem Satz, gefundene Datenfehler. Auf Deutsch.
