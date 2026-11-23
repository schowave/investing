# Standards für das Review

Ermessensfragen, die keine automatische Prüfung ersetzt. Was sich mechanisch prüfen lässt, gehört in Biome, Tests oder
`mise run check`, nicht hierher.

## Altdaten

Eine neue Spalte oder ein neues Feld ist für vorhandene Zeilen leer. Prüfe für jede solche Änderung:

- Wie verhält sich der Code mit den **Altdaten**, also mit Zeilen, die das Feld nie bekommen haben? Gibt es eine Nachpflege
  (Backfill aus gespeicherten Rohdaten, Lauf, Migration) oder einen Ersatzweg?
- Deckt ein Test genau diesen Fall ab, mit dem Feld leer, nicht nur mit sauber befüllten Fixtures?

Anlass: Die ISIN an `stocks` war für fast alle Aktien leer; die erste Übernahme aus der comdirect hätte gehaltene Titel als
weggefallen gelöscht, und die Notlösung dafür zählte sie doppelt.

## Daten von außen

Anbieterdaten (EODHD, Banken) sind oft formal gültig und inhaltlich falsch: Werte je Hinterlegungsschein statt je Aktie,
Dividenden nach Zahlungsjahr, Tilgungen als Rückkäufe. zod prüft die Form; prüfe im Review, ob eine neue Herleitung einen
solchen Fehler stillschweigend weiterrechnet oder ihn erkennt und benennt.
