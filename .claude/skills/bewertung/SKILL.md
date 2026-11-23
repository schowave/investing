---

name: bewertung
description: Aktien nach der Strategie bewerten und die Werte setzen – Urteilsfaktoren, Rückflussniveau, Wachstum –, mit Haiku als Vorfilter und Opus für die eigentliche Bewertung. Use when der Nutzer Titel bewerten lassen will (Depot, Portfolio, Watchlist, obere N des Datenvorrats), Jev- oder Gemini-Werte überschreiben oder Opus mit Jev vergleichen will.
---

# Bewertung

Bewertet Aktien mit parallelen Agenten und setzt das Ergebnis als Werte von Hand. Zwei Stufen: Haiku filtert billig vor und
verwirft Titel, die klar über dem Ausschluss liegen; Opus bewertet den Rest und ersetzt dort die Haiku-Werte. Die Agenten lesen
nur; gesetzt wird über `pnpm run bewertung:vorfilter` (Haiku) und `pnpm run bewertung:setzen` (Opus), mit derselben Prüfung wie
auf der Aktienseite.

## Schritte

1. **Titel festlegen.** Liste der Notizen (EODHD-Symbole). Für die oberen N des Datenvorrats `db.screening({}, N, 0)`; schon
   mit Opus bewertete Titel (Notiz „Opus-Einschätzung“ in `manual_inputs`) auslassen. Zweitnotizen desselben Unternehmens
   mit derselben Berichtswährung je Aktie bekommen die Datei der ersten (`bewertung:setzen <dir> ZWEIT:ERST`), statt neu bewertet
   zu werden. Fertig, wenn jede Notiz genau einer Gruppe oder einer Kopie zugeordnet ist.
2. **Dossiers schreiben:** `pnpm run bewertung:dossier <scratchpad>/bewertung <ID> …`. Fertig, wenn jede ID `ok` meldet.
3. **Vorfilter mit Haiku.** Gruppen zu 4–5 Titeln nach Art (Banken, Kohle, BDC, Holdings …), je Gruppe ein Agent mit
   `model: haiku` im Hintergrund, alle in einer Nachricht. Prompt wie in Schritt 5, aber mit „Ergebnisdatei: `<ID>.haiku.json`“.
   Dann, nach einer Sicherung (`mise run db:backup`), `pnpm run bewertung:vorfilter <dir>`: setzt die Haiku-Werte als Werte
   von Hand (Notiz „Haiku-Einschätzung“), aber nur wo kein anderer Wert von Hand steht; Titel mit Opus-Bewertung bleiben ganz
   unberührt („übersprungen“). Es verwirft Titel, deren Risikowert ohne Ersatzabzüge den Ausschluss plus 10 Punkte erreicht
   (`PREFILTER_RISK_MARGIN`); unvollständige Bewertungen gehen an Opus, fehlerhafte Dateien auch, ohne etwas zu setzen (Haiku-Werte
   eines früheren Laufs bleiben dann stehen). Die Listen „verworfen“, „opus“, „übersprungen“ und „unbekannt“ stehen auch in
   `<dir>/vorfilter.json`, bei jedem Lauf aus allen Dateien des Verzeichnisses neu. Fertig, wenn jede ID in einer Liste steht.
4. **Rückfrage beim Nutzer, bevor Opus startet.** Vorlegen: verworfene Titel mit Risikowert und dem wichtigsten Befund aus
   der Haiku-Datei, die Liste für Opus. Der Nutzer kann Titel zurückholen oder streichen. Ohne seine Zustimmung kein Opus-Lauf.
5. **Bewertung mit Opus**, nur für die freigegebenen Titel: Gruppen wie in Schritt 3, je Gruppe ein Agent mit `model: opus`.
   Prompt: „Bewerte Aktien nach der Anleitung in `.claude/skills/bewertung/AGENT.md` (zuerst vollständig lesen); Dossiers
   und Ergebnisse in `<dir>`. Ergebnisdatei: `<ID>.opus.json`. Deine Titel: … (je Titel ein Satz zu Besonderheiten:
   Hinterlegungsschein, Abspaltung, Zyklus).“ Fertig, wenn zu jeder ID eine `<ID>.opus.json` vorliegt.
6. **Setzen**, nach einer Sicherung (`mise run db:backup`): `pnpm run bewertung:setzen <dir> --alle` (liest nur
   `*.opus.json`; Haiku-Werte, die Opus nicht überschreibt, fallen weg). Das Skript prüft Berichtswährung und Grenzen und rechnet danach Datenvorrat und Portfolios neu. Abgewiesene
   Titel (meist Wachstum unter der Untergrenze, etwa bei auslaufendem Geschäft) dem Nutzer mit Vorschlag vorlegen, nicht
   stillschweigend anpassen. Fertig, wenn jede ID `ok` meldet oder vorgelegt ist.
7. **Berichten:** Tabelle Urteil Jev → Opus, Risikowert und Rendite vorher → nachher, Rückflussniveau vorher → nachher; dazu
   die Datenfehler, die die Agenten gemeldet haben (`dataIssues`), gesammelt nach Muster, und wie viele Titel der Vorfilter
   verworfen hat.

Die Werte gelten je Aktie für alle Portfolios. Gesetzt wird in der lokalen Datenbank; in den LXC nur auf Ansage des Nutzers,
nach `mise run lxc:snapshot`.

## Warum Haiku nur filtert

Vergleich vom 23.11.2026, 30 Titel, je ein Lauf: Die großen Positionen des Zielportfolios waren gleich, aber Haiku ließ bei
Zyklikern den Wachstumsvorschlag stehen (Renditen bis 19 % statt −0,3 %), wich beim Rückflussniveau oft weit ab und zog beim
Risiko mehr ab als Opus. Als Filter schadet das wenig: Zu optimistische Titel gehen an Opus, und der Puffer über dem
Ausschluss fängt die strengeren Abzüge. Verworfen wurden 15 von 30, keiner davon stand in einem Zielportfolio von Opus. Die
Schwelle nach den ersten Läufen gegen Opus nachprüfen.
