# investing

Bewertung und Watchlist für Dividendenaktien: Next.js-Oberfläche, Skripte für Abgleich und Import, SQLite in `data/`.
Fachliche Grundlage: `docs/SPEZIFIKATION.md`.

## Befehle

Werkzeuge (Node, pnpm, lefthook, actionlint) und Tasks kommen aus `mise.toml`; `mise tasks` zeigt alle.

| Befehl                          | Was er tut                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mise run setup`                | Frischer Klon -> lauffähig: Werkzeuge, Pakete, Git-Hooks, Datenbank migrieren                         |
| `mise run check`                | Vor jedem Commit (Hook) und im CI: Biome, Typen, Tests mit Abdeckungsschwellen, knip, Schema-Drift    |
| `mise run fmt`                  | Formatieren und sichere Lint-Korrekturen (Biome)                                                      |
| `mise run dev`                  | Oberfläche auf http://localhost:3000                                                                  |
| `mise run sync`                 | Täglicher Abgleich, vorher Sicherung nach `data/backups` (braucht `.env.local` mit `EODHD_API_TOKEN`) |
| `pnpm run <skript> <argumente>` | Einzelne Skripte aus `package.json`; Argumente **ohne** `--`, pnpm reicht es sonst ans Skript weiter  |

## Regeln für Änderungen

- Versionen sind exakt festgelegt (`package.json`, `mise.toml`, Actions per Digest); Renovate hebt sie an.
  pnpm lehnt Pakete ab, die jünger als einen Tag sind – dann eine ältere Version nehmen, die Sperre nicht lockern.
- Daten von außen (EODHD, EZB, IWF, Formulare der Server Actions) mit zod prüfen, bevor sie weiterverarbeitet werden.
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

## Worktrees

Ein neuer Worktree bekommt `.env.local` und eine eigene Kopie von `data/investing.sqlite`:
Claude Code kopiert sie über `.worktreeinclude`, Orca über das Setup in `orca.yaml`, sonst `mise run worktree:init`.
Danach `mise trust && mise run setup`. Änderungen an der Kopie bleiben im Worktree, die Daten im Haupt-Checkout nicht.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
