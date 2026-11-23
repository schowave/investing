# investing

Bewertung und Watchlist für Dividendenaktien: Next.js-Oberfläche, Skripte für Abgleich und Import, SQLite in `data/`.
Fachliche Grundlage: `docs/STRATEGIE.md` (was die Strategie tut und warum; maßgeblich für Regeln und Werte) und
`docs/SPEZIFIKATION.md` (wie die Anwendung sie umsetzt). Ermessensregeln fürs Review: `CODING_STANDARDS.md`.

## Befehle

Werkzeuge (Node, pnpm, lefthook, actionlint) und Tasks kommen aus `mise.toml`; `mise tasks` zeigt alle.

| Befehl                          | Was er tut                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mise run setup`                | Frischer Klon -> lauffähig: Werkzeuge, Pakete, Git-Hooks, Datenbank migrieren                         |
| `mise run check`                | Vor jedem Commit (Hook) und im CI: Biome, Typen, Tests mit Abdeckungsschwellen, knip, Schema-Drift    |
| `mise run fmt`                  | Formatieren und sichere Lint-Korrekturen (Biome)                                                      |
| `mise run dev`                  | Oberfläche auf http://localhost:3000 und Worker für Läufe; lädt `.env.local` vorher in der Shell      |
| `mise run sync`                 | Täglicher Abgleich, vorher Sicherung nach `data/backups` (braucht `.env.local` mit `EODHD_API_TOKEN`) |
| `pnpm run backtest`             | Rückblick auf die Strategie, auch zum Vergleich zweier Stände (`--vergleich`); Spezifikation 8.1      |
| `pnpm run forward`              | Vorwärtsprotokoll: was die Anwendung vorgeschlagen hätte und was daraus wurde; Spezifikation 8.2      |
| `pnpm run <skript> <argumente>` | Einzelne Skripte aus `package.json`; Argumente **ohne** `--`, pnpm reicht es sonst ans Skript weiter  |

## Regeln für Änderungen

- Versionen sind exakt festgelegt (`package.json`, `mise.toml`, Actions per Digest); Renovate hebt sie an.
  pnpm lehnt Pakete ab, die jünger als einen Tag sind – dann eine ältere Version nehmen, die Sperre nicht lockern.
- Daten von außen (EODHD, EZB, IWF, Formulare der Server Actions) mit zod prüfen, bevor sie weiterverarbeitet werden.
- `docs/STRATEGIE.md` ist für Regeln und Werte maßgeblich, der Code folgt. Keine Regeländerung ohne Änderung an `STRATEGIE.md` im
  selben Commit. `src/valuation/strategyDocument.test.ts` vergleicht die Tabellen mit Schlüsseln (6.2, 10.1, 10.3), Raster, Stufen,
  Profile, Bandbreite, Kurzfassung und Version mit dem Code; Zahlen in Formeln, Beispielen und Begründungen prüft er nicht
  (Liste in Spezifikation 1). Neue Werte gehören in eine dieser Tabellen, nicht in den Regeltext.
- `src/valuation/strategyImprint.test.ts` rechnet feste Beispielaktien bis zum Zielportfolio und vergleicht mit
  `src/valuation/imprints/strategie-<Version>.json`. Bricht er, hat sich die Rechnung geändert: Regeländerung → Version erhöhen
  (Kreislauf unten), dann `mise run strategy:imprint`; bewusst ohne Wirkung → `mise run strategy:imprint` und im Commit eine
  Zeile `Strategie: ohne Wirkung`. Alte Abdrücke bleiben liegen.
- Der Hook `commit-msg` (`scripts/check-commit.ts`) lehnt Commits ab, die Regel-Code (`src/calc`, `src/judgement/factors.ts`,
  Regel-Dateien in `src/valuation`) ohne `STRATEGIE.md` ändern oder Werkzeuge (`src/backtest`, Vorwärtsprotokoll,
  `scripts/backtest.ts`, `scripts/forward.ts`) ohne `STRATEGIE.md` oder `SPEZIFIKATION.md`, außer mit `Strategie: ohne Wirkung`;
  bei neuer `STRATEGY_VERSION` verlangt er Änderungsprotokoll, den neuen Abdruck und die Kennzahlen des Rückblicks (Median,
  Anteil besserer Fenster, Güte, Umschlag, größter Rückgang) in der Nachricht. Nicht mit `--no-verify` umgehen.
- Kreislauf für Änderungen an der Strategie: (1) Anregung als prüfbare Vermutung unter „Offene Fragen“ (Strategie 11) eintragen;
  (2) mit dem Rückblick gegen `main` prüfen (nächster Punkt); (3) Ergebnis in `docs/STRATEGIE-AENDERUNGEN.md` festhalten (Datum,
  Version, betroffene Regel, vorher/nachher, Kennzahlen, Entscheidung), auch verworfene Versuche; (4) bei Annahme `STRATEGIE.md`,
  Code und Tests in einem Commit, `STRATEGY_VERSION` (`src/valuation/run.ts`) und die Version im Kopf des Dokuments erhöhen.
  Reine Textänderungen erhöhen die Version nicht. Der Stufenplan dazu steht in `docs/Selbstlernende-Strategie.md`.
- Änderungen, die das Zielportfolio ändern sollen (Rechenmodell, Profile, Auswahl), vor dem Commit mit dem Rückblick prüfen: auf `main`
  `pnpm run backtest --name main`, auf dem Zweig `pnpm run backtest --name aenderung --vergleich main` (derselbe Checkout, dieselbe
  Datenbank, derselbe Tag; mehrere Minuten, beim ersten Mal mit Netz für EZB und Yahoo; `--zufall 0 --ohne-index` ist die schnelle
  Fassung). Median der Fenster, Anteil besserer Fenster, Güte (auch im schwachen Viertel), Umschlag und größten Rückgang in die
  Commit-Nachricht und ins Änderungsprotokoll, dazu die Grenzen aus Strategie 8.3. Ein Vorsprung nur im Mittel oder in einem
  Zeitraum trägt keine Änderung. Refactorings ohne Wirkung brauchen das nicht.
- Neue Logik bekommt Tests; `mise run check` bricht, wenn die Abdeckung unter die Schwellen in `vitest.config.ts` fällt.
- `!` (Non-Null-Assertion) ist erlaubt: `noUncheckedIndexedAccess` ist an, `!` markiert geprüfte Stellen.

## Datenbank und Migrationen (Drizzle)

- Quelle der Wahrheit ist `src/data/schema.ts`. Nie Tabellen im Code anlegen oder ändern, nie rohes SQL für
  Schemaänderungen schreiben.
- Ablauf: Schema ändern, `mise run db:generate <name>` erzeugt `db/migrations/<zeitstempel>_<name>/`, beides committen.
  `mise run db:check` (Teil von `check`) bricht, wenn das Schema eine Änderung ohne Migration enthält.
- `Database` (`src/data/db.ts`) wendet offene Migrationen beim Öffnen selbst an (`src/data/migrate.ts`), auch für
  `:memory:` in Tests. Buchführung in `__drizzle_migrations`.
- Eine angewendete Migration nie ändern, sondern eine neue erzeugen. Es gibt kein Zurückrollen: zurück geht es über
  eine Sicherung aus `data/backups` (`mise run db:backup` legt eine an).
- SQLite kann Spaltentypen nur durch Neuaufbau ändern; drizzle-kit erzeugt dafür `__new_<tabelle>` mit Umkopieren.
  Bei großen Tabellen (`raw_documents`) vorher sichern und danach `mise run db:compact`.
- Pfad der Datenbank: `INVESTING_DB` (Standard `data/investing.sqlite`).

## Betrieb

- Läuft im LXC 108 auf dem Proxmox (`deploy/`). Jeder grüne Push auf `main` baut das Image (`.github/workflows/ci.yml`,
  Job `image`) und veröffentlicht es als `ghcr.io/schowave/investing:latest`; der LXC holt es binnen fünf Minuten.
  Ein Push auf `main` ist also ein Deployment.
- Das Image muss mit leerer Datenbank starten und `/healthz` mit seiner Version melden (`mise run docker:smoke`),
  sonst rollt der LXC zurück. Pfade im Container: Datenbank `/data/investing.sqlite`, Arbeitsverzeichnis `/app`
  (schreibgeschützt für den App-Benutzer). Skripte schreiben nur neben `INVESTING_DB`, nie relativ zu `data/`.
- Der nächtliche Abgleich läuft im LXC (`investing-sync.timer`), nicht auf dem Mac.
- `.env.local` darf Werte als `"$(creds read …)"` enthalten; nur die Shell führt sie aus (`mise run dev` lädt die Datei so),
  Next.js, `node --env-file` und Docker nicht. In `/opt/investing/.env` im LXC stehen deshalb die Werte selbst.
- Maßgeblich ist die Datenbank im LXC; `data/investing.sqlite` ist eine Kopie. Skripte gegen die deployte Datenbank:
  erst `mise run lxc:snapshot <name>`, dann `mise run lxc:exec node scripts/<skript>.ts …` (Stapel per `sh -s` und Heredoc).
  Zum Durchrechnen ohne Schreibzugriff: `INVESTING_DB=<testdatei> mise run db:pull`, dann lokal gegen die Testdatei.

## Worktrees

Ein neuer Worktree bekommt `.env.local` und eine eigene Kopie von `data/investing.sqlite`:
Claude Code kopiert sie über `.worktreeinclude`, Orca über das Setup in `orca.yaml`, sonst `mise run worktree:init`.
Danach `mise trust && mise run setup`. Änderungen an der Kopie bleiben im Worktree, die Daten im Haupt-Checkout nicht.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
