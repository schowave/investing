---

name: opus-bewertung
description: Aktien mit Opus nach der Strategie bewerten und die Werte setzen – Urteilsfaktoren, Rückflussniveau, Wachstum. Use when der Nutzer Titel bewerten lassen will (Depot, Portfolio, Watchlist, obere N des Datenvorrats), Jev- oder Gemini-Werte überschreiben oder Opus mit Jev vergleichen will.
---

# Opus-Bewertung

Bewertet Aktien mit parallelen Agenten und setzt das Ergebnis als Werte von Hand. Die Agenten lesen nur; gesetzt wird erst im
letzten Schritt über `pnpm run bewertung:setzen`, mit derselben Prüfung wie auf der Aktienseite.

## Schritte

1. **Titel festlegen.** Liste der Notizen (EODHD-Symbole). Für die oberen N des Datenvorrats `db.screening({}, N, 0)`; schon
   mit Opus bewertete Titel (Notiz „Opus-Einschätzung“ in `manual_inputs`) auslassen. Zweitnotizen desselben Unternehmens
   mit derselben Berichtswährung je Aktie bekommen die Datei der ersten (`bewertung:setzen <dir> ZWEIT:ERST`), statt neu bewertet
   zu werden. Fertig, wenn jede Notiz genau einer Gruppe oder einer Kopie zugeordnet ist.
2. **Dossiers schreiben:** `pnpm run bewertung:dossier <scratchpad>/bewertung <ID> …`. Fertig, wenn jede ID `ok` meldet.
3. **Agenten starten.** Gruppen zu 4–5 Titeln nach Art (Banken, Kohle, BDC, Holdings …), je Gruppe ein Agent im Hintergrund,
   alle in einer Nachricht. Prompt: „Bewerte Aktien nach der Anleitung in `.claude/skills/opus-bewertung/AGENT.md` (zuerst
   vollständig lesen); Dossiers und Ergebnisse in `<dir>`. Deine Titel: … (je Titel ein Satz zu Besonderheiten:
   Hinterlegungsschein, Abspaltung, Zyklus).“ Fertig, wenn zu jeder ID eine `<ID>.opus.json` vorliegt.
4. **Setzen**, nach einer Sicherung (`mise run db:backup`): `pnpm run bewertung:setzen <dir> --alle`. Das Skript prüft
   Berichtswährung und Grenzen und rechnet danach Datenvorrat und Portfolios neu. Abgewiesene Titel (meist Wachstum unter der
   Untergrenze, etwa bei auslaufendem Geschäft) dem Nutzer mit Vorschlag vorlegen, nicht stillschweigend anpassen. Fertig,
   wenn jede ID `ok` meldet oder vorgelegt ist.
5. **Berichten:** Tabelle Urteil Jev → Opus, Risikowert und Rendite vorher → nachher, Rückflussniveau vorher → nachher; dazu
   die Datenfehler, die die Agenten gemeldet haben (`dataIssues`), gesammelt nach Muster.

Die Werte gelten je Aktie für alle Portfolios. Gesetzt wird in der lokalen Datenbank; in den LXC nur auf Ansage des Nutzers,
nach `mise run lxc:snapshot`.
