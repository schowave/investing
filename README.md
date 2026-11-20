# Rückflussrendite

Ein privates Entscheidungswerkzeug für langfristige Aktienanlage. Es bewertet Unternehmen danach, was sie
ihren Eigentümern auf Dauer zurückgeben, stuft ihr Risiko ein und leitet daraus ein Zielportfolio ab, das es
mit dem tatsächlichen Bestand vergleicht.

> **Keine Anlageberatung.** Die Anwendung gibt Vorschläge auf Grundlage der Annahmen ihrer Nutzer. Sie führt
> keine Orders aus und gibt keine öffentlichen Empfehlungen.

- [Die Strategie](#die-strategie)
- [Was die Anwendung kann](#was-die-anwendung-kann)
- [Schnellstart](#schnellstart)
- [Täglicher Betrieb](#täglicher-betrieb)
- [Entwicklung](#entwicklung)
- [Projektstruktur](#projektstruktur)
- [Daten und Lizenzen](#daten-und-lizenzen)

## Die Strategie

### Grundgedanke

Eine Aktie ist ein Anteil an den künftigen Rückflüssen eines Unternehmens: Dividenden und Aktienrückkäufe.
Wer den Kurs zahlt, kauft diesen Strom von Zahlungen. Die Strategie fragt deshalb nicht „Was ist die Aktie
wert?“, sondern „Welche jährliche Rendite bekomme ich zum heutigen Kurs, wenn die Rückflüsse so wachsen wie
erwartet und das Unternehmen mit einer bestimmten Wahrscheinlichkeit ausfällt?“ Diese Kennzahl heißt
**innere Rendite**. Sie macht Unternehmen aus verschiedenen Branchen, Ländern und Währungen vergleichbar.

### Die innere Rendite

Drei Annahmen je Aktie gehen ein:

| Annahme                                                                         | Woher sie kommt                                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Rückflussniveau** – was das Unternehmen im kommenden Jahr je Aktie zurückgibt | Dividendenniveau plus Netto-Rückkäufe der letzten Jahre, höchstens so viel, wie der freie Cashflow trägt (nach Abzug der Aktienvergütung, bei Zyklikern über den ganzen Zyklus) |
| **Wachstum** der Rückflüsse                                                     | Das kleinste aus Gewinn- und Umsatzwachstum der letzten zehn Jahre, einer festen Obergrenze und dem, was das einbehaltene Kapital hergibt                                       |
| **Ausfallwahrscheinlichkeit** je Jahr                                           | Aus dem Risikowert abgeleitet (siehe unten)                                                                                                                                     |

Das Wachstum schmilzt über 15 Jahre auf ein Dauerwachstum von höchstens 3 % ab, denn kein Unternehmen wächst
ewig schneller als die Wirtschaft. Die innere Rendite ist dann der Zinssatz, bei dem der Barwert aller
erwarteten Rückflüsse genau dem Kurs entspricht.

Wer wächst, behält Gewinn ein. Flacht das Wachstum ab, steigt in der Rechnung die Ausschüttungsquote, soweit die
einbehaltenen Gewinne bisher Wachstum gebracht haben. Wer einbehält und nicht wächst, bleibt bei seiner Ausschüttung.

Jede Aktie wird in drei Fällen gerechnet: **vorsichtig, Basis, optimistisch**. Der Basisfall bestimmt den Rang,
die Spanne zeigt, wie stark er an den Annahmen hängt.

Alle Annahmen haben einen automatischen **Vorschlag** aus zehn Jahren Fundamentaldaten und lassen sich von
Hand **übersteuern**. Ein Handwert gilt, bis man ihn löscht; neue Zahlen ändern nur den Vorschlag.

### Risiko

Ein Raster aus 15 Faktoren ergibt den **Risikowert**: Beständigkeit von Gewinn und Umsatz, Finanzierung,
Größe, Alter, Branche, Land, Wettbewerbsvorteile, Kapitalrendite, Marge, Management, Verlässlichkeit der
Prognosen, freier Cashflow, Abhängigkeiten, Währung und aktuelle Lage. Zahlenfaktoren schlägt die Anwendung
vor, Urteilsfaktoren (etwa Management oder Wettbewerbsvorteile) setzt der Nutzer selbst. Solange ein
Urteilsfaktor fehlt, gilt die Bewertung als unvollständig und der Titel bleibt außen vor.

| Risikowert | Klasse                      |
| ---------- | --------------------------- |
| bis 20 %   | hervorragend                |
| bis 50 %   | durchschnittlich            |
| unter 75 % | riskant                     |
| ab 75 %    | Spekulation, ausgeschlossen |

Der Risikowert wirkt zweimal: als Ausfallwahrscheinlichkeit in der inneren Rendite und als Abschlag auf die
erlaubte Positionsgröße.

### Vom Ranking zum Zielportfolio

1. **Kandidaten** sind vollständig bewertete Titel unter 75 % Risiko, deren innere Rendite über der Rendite
   zehnjähriger Euro-Staatsanleihen liegt. Ein Renditeziel gibt es nicht: Die besten kommen zuerst ins Portfolio,
   bis es voll ist.
2. Renditen in Fremdwährung werden um den erwarteten **Inflationsunterschied** zum Euro gekürzt, damit eine
   hohe Rendite in einer inflationsstarken Währung nicht besser aussieht, als sie ist.
3. Die Kandidaten werden nach innerer Rendite sortiert und der Reihe nach gewichtet:
   `Limit = Basislimit × (1 − Risikowert)`, begrenzt durch Streuungsregeln je Branche und Region.
4. Was übrig bleibt, ist **Cash**. Die Strategie kauft nichts, nur um investiert zu sein.

Zwei Profile stehen bereit: **fokussiert** (etwa 6 bis 12 Titel, Basislimit 15 %) und **global** (etwa 20 bis
25 Titel, Basislimit 6,5 %, strengere Streuung).

Bereits gehaltene Titel bekommen in der Sortierung einen kleinen Aufschlag. So wird nicht für einen
Zehntelprozentpunkt umgeschichtet. Es gibt keine Stop-Loss-Marken: Ein gefallener Kurs erhöht die innere
Rendite und führt eher zu einem Nachkaufvorschlag. Alle Änderungen sind Vorschläge.

Die vollständigen Regeln, Formeln und eigenen Annahmen stehen in
[`docs/SPEZIFIKATION.md`](docs/SPEZIFIKATION.md) und in der Anwendung auf der Seite „Strategie“.

## Was die Anwendung kann

| Seite       | Inhalt                                                                                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rangliste   | Watchlist nach innerer Rendite, mit Spanne, Risikoklasse und Status der Bewertung                                                                                                                   |
| Aktie       | Annahmen mit Vorschlag und Übersteuerung, Risikoraster, Rendite bei anderen Kursen, Zehnjahresreihen; auf Wunsch Vorschläge für die Urteilsfaktoren von Jev, gestützt auf eine Recherche von Claude |
| Portfolio   | Ist gegen Ziel, Kauf- und Verkaufsvorschläge, Verteilung nach Branche und Region                                                                                                                    |
| Datenvorrat | Screening über rund 8.800 gespeicherte Titel aus etwa 30 Indizes, Aufnahme in die Watchlist                                                                                                         |
| Strategie   | Die Regeln in eigenen Worten, mit den Zahlen aus dem Rechenmodul                                                                                                                                    |

Ein nächtlicher Abgleich lädt Kurse, Wechselkurse, Anleiherendite und Inflationsprognosen, rechnet alle
Bewertungen und Zielportfolios neu und speichert den Tagesstand.

## Schnellstart

Voraussetzung ist [mise](https://mise.jdx.dev). Es installiert alle weiteren Werkzeuge in festen Versionen.

```sh
git clone git@github.com:schowave/investing.git
cd investing
mise trust && mise run setup   # Node, pnpm, Pakete, Git-Hooks, Datenbank anlegen
echo 'EODHD_API_TOKEN=…' > .env.local
mise run sync                  # erste Kurse und Bewertungen
mise run dev                   # http://localhost:3000
```

Für Vorschläge zu den Urteilsfaktoren kommen optional `TYPESAFE_API_KEY` (Jev) und `ANTHROPIC_API_KEY`
(Recherche mit Claude) in `.env.local`; ohne sie bleibt die Einstufung von Hand. Ohne Token läuft alles außer dem Kursabruf. Kurse lassen sich je Aktie auch von Hand eintragen.

## Täglicher Betrieb

| Befehl                                  | Zweck                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| `mise run sync`                         | Abgleich: Sicherung, Kurse, Wechselkurse, Bewertungen, Zielportfolios              |
| `mise run schedule an`                  | Abgleich als macOS-Dienst täglich um 23:15 Uhr (`aus`, `status`)                   |
| `mise run evaluate`                     | Rangliste im Terminal, mit Symbol alle Eingaben einer Aktie                        |
| `pnpm run import:isin <ISIN …>`         | Einzelne Titel über ihre ISIN auf die Watchlist laden                              |
| `pnpm run set <Aktie> <Eingabe> <Wert>` | Eine Annahme von Hand setzen, `-` löscht sie                                       |
| `mise run db:backup`                    | Sicherung nach `data/backups` (der Abgleich sichert selbst, die letzten 7 bleiben) |

`mise tasks` zeigt alle Befehle. pnpm-Skripte bekommen ihre Argumente ohne `--`.

## Betrieb auf dem Proxmox

```text
Push auf main ──▶ CI: check, Image bauen, Rauchtest ──▶ ghcr.io/schowave/investing:<commit>, latest
                                                                     │
LXC 108 auf dem Proxmox: investing-update.timer (alle 5 Min) ◀───────┘ holt latest, startet neu,
                         prüft /healthz, bei Fehler zurück auf die vorherige Version
                         investing-sync.timer (täglich 00:15 UTC, nach dem Zurücksetzen des EODHD-Limits):
                         Sicherung und Abgleich im Container
```

- **Nächtlicher Abgleich** lässt sich auf der Seite „Abgleich“ aus- und einschalten (der Timer läuft weiter,
  stellt dann aber nichts ein). Gegen die lokale Kopie gleicht `mise run sync` von Hand ab.
- **Ausrollen passiert von selbst.** Jeder grüne Push auf `main`, auch ein Renovate-Update, landet
  spätestens fünf Minuten später im LXC. Startet eine neue Version nicht gesund, läuft die vorherige weiter.
- **Daten** liegen im LXC unter `/opt/investing/data` (Datenbank, `backups/` mit den letzten drei Tagen).
  Die nächtliche Proxmox-Sicherung enthält den LXC.
- **Zugangsdaten** (`EODHD_API_TOKEN`, optional `TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY`) stehen in
  `/opt/investing/.env`; `mise run deploy:env` kopiert sie aus `.env.local`.
- **Von außen** über den Cloudflare Tunnel (LXC 102) mit Cloudflare Access, Anwendung `familie-dienste`.
  Die App selbst hat keine Anmeldung.

| Befehl (auf dem Mac)                    | Zweck                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `mise run deploy:lxc`                   | LXC einmalig anlegen und einrichten (SSH-Schlüssel `~/.ssh/pve_ed25519`)                   |
| `mise run deploy:env`                   | Zugangsdaten aus `.env.local` in den LXC kopieren                                          |
| `mise run deploy:config`                | Betriebsdateien von `main` neu einspielen (macht sonst der Update-Timer aus dem Image)     |
| `mise run deploy:db`                    | Lokale Datenbank konsistent kopieren und einspielen (die dortige bleibt als `.vor-import`) |
| `mise run lxc:snapshot <name>`          | Konsistente Kopie der Datenbank im LXC anlegen (vor Änderungen von Hand)                   |
| `mise run lxc:exec <befehl>`            | Befehl im Worker-Container ausführen, z. B. `node scripts/set-input.ts …`                  |
| `mise run db:pull`                      | Datenbank aus dem LXC nach lokal holen (die lokale bleibt als `.vor-pull`)                 |
| `mise run deploy:status`                | `/healthz`, Timer und die letzten Updates und Abgleiche                                    |
| `mise run docker:build`, `docker:smoke` | Image lokal bauen und mit leerer Datenbank testen                                          |

## Entwicklung

```sh
mise run check   # Biome, Typen, Tests mit Abdeckung, knip, Schema-Drift – läuft auch vor jedem Commit und im CI
mise run fmt     # formatieren
mise run build   # Produktions-Build
```

- **Stack:** Next.js (App Router, Server Actions), React, TypeScript, SQLite über `node:sqlite` mit
  [Drizzle ORM](https://orm.drizzle.team), zod für Daten von außen, Vitest, Biome, knip.
- **Datenbank:** Das Schema steht in `src/data/schema.ts`. Nach einer Änderung erzeugt
  `mise run db:generate <name>` die Migration. Die Anwendung wendet offene Migrationen beim Start selbst an.
- **Versionen** sind exakt festgelegt (`package.json`, `mise.toml`, Actions per Digest). Renovate hält sie
  aktuell und mergt selbst, sobald das CI grün ist. Ein Update, das etwas bricht, bleibt als offener PR liegen.
- **Worktrees:** Ein neuer Worktree bekommt `.env.local` und eine eigene Kopie der Datenbank, über
  `.worktreeinclude` (Claude Code), `orca.yaml` (Orca) oder `mise run worktree:init`.
- Hinweise für Coding-Agents stehen in [`AGENTS.md`](AGENTS.md).

## Projektstruktur

```text
src/
  calc/        Rechenmodul: innere Rendite, Risikoraster, Zielportfolio (ohne Datenbank und Netz)
  valuation/   Vorschläge aus Fundamentaldaten, Bewertung je Aktie, Portfolio-Sicht
  data/        Datenbank (Drizzle), Migrationen, Anbieter EODHD, EZB, IWF
  sync/        Nächtlicher Abgleich
  app/         Oberfläche (Next.js)
scripts/       Kommandozeile: Abgleich, Importe, Sicherung, Wartung
db/migrations/ Von drizzle-kit erzeugte Migrationen
docs/          Fachliche Spezifikation
data/          Datenbank, Sicherungen, Protokolle (nicht im Repository)
```

## Daten und Lizenzen

- Fundamentaldaten und Kurse kommen von [EODHD](https://eodhd.com) im Privattarif. Sie dürfen lokal
  gespeichert, aber nicht anderen angezeigt werden. Die Datenbank liegt deshalb nur in `data/` und nie im
  Repository.
- Wechselkurse: EZB-Referenzkurse, ergänzt um open.er-api.com für Währungen, die die EZB nicht führt.
- Anleiherendite: EZB-Zinsstrukturkurve. Inflationsprognosen: IWF World Economic Outlook.
