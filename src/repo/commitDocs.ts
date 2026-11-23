// Prüfung beim Commit (Hook `commit-msg`, Spezifikation 1): Wer Regel-Code ändert, zieht die Dokumente nach oder sagt
// ausdrücklich, dass die Änderung ohne Wirkung ist. Inhaltlich prüfen `strategyDocument.test.ts` und `strategyImprint.test.ts`;
// dieser Hook erinnert an das, was ein Test nicht sehen kann: ob STRATEGIE.md oder SPEZIFIKATION.md mitgeändert wurde und ob
// die Commit-Nachricht die Kennzahlen des Rückblicks nennt.

interface StagedFile {
  path: string;
  /** Status aus `git diff --name-status`: A, M, D … */
  status: string;
}

export interface CommitInput {
  files: readonly StagedFile[];
  message: string;
  /** Neuer Wert von `STRATEGY_VERSION`, wenn der Commit ihn ändert; sonst `null`. */
  newVersion: string | null;
  /** Kommentarzeichen von Git (`core.commentChar`), Standard `#`. */
  commentChar?: string;
  /** Der Commit schließt einen Merge ab (`MERGE_HEAD` vorhanden). */
  merge?: boolean;
}

/** Kennzeichnung im Commit für Änderungen am Regel-Code ohne Wirkung auf das Zielportfolio. */
export const NO_EFFECT_TRAILER = "Strategie: ohne Wirkung";

const STRATEGY = "docs/STRATEGIE.md";
const SPECIFICATION = "docs/SPEZIFIKATION.md";
const CHANGELOG = "docs/STRATEGIE-AENDERUNGEN.md";

/** Code, dessen Regeln in STRATEGIE.md stehen: Rechenmodell, Urteilsstufen, Auswahl, Profile, Bestand gegen Ziel. */
const STRATEGY_CODE = [
  /^src\/calc\//,
  /^src\/judgement\/factors\.ts$/,
  /^src\/valuation\/(valuation|run|universe|review|ranking|portfolioRun|portfolioView)\.ts$/,
];

/** Werkzeuge, die in SPEZIFIKATION.md beschrieben sind (Rückblick, Vorwärtsprotokoll); eines der beiden Dokumente genügt. */
const TOOL_CODE = [/^src\/backtest\//, /^src\/valuation\/(forwardLog|forwardReport)\.ts$/, /^scripts\/(backtest|forward)\.ts$/];

/** Kennzahlen aus dem Rückblick, die eine neue Version in der Commit-Nachricht nennt (AGENTS.md). */
const BACKTEST_FIGURES = ["Median", "besser", "Güte", "Umschlag", "Rückgang"];

const IMPRINT = /^src\/valuation\/imprints\/strategie-.+\.json$/;
const imprintOf = (version: string) => `src/valuation/imprints/strategie-${version}.json`;

const matches = (patterns: readonly RegExp[], path: string) => !/\.test\.ts$/.test(path) && patterns.some((p) => p.test(path));

export function isStrategyCode(path: string): boolean {
  return matches(STRATEGY_CODE, path);
}

export function isToolCode(path: string): boolean {
  return matches(TOOL_CODE, path);
}

/** Nachricht ohne Kommentarzeilen, wie Git sie speichert. */
function withoutComments(message: string, commentChar: string): string {
  const scissors = message.indexOf(`${commentChar} ------------------------ >8 ------------------------`);
  return (scissors >= 0 ? message.slice(0, scissors) : message)
    .split("\n")
    .filter((line) => !line.startsWith(commentChar))
    .join("\n");
}

/** Gründe, warum der Commit so nicht durchgeht; leer, wenn alles passt. */
export function commitProblems({ files, message, newVersion, commentChar = "#", merge = false }: CommitInput): string[] {
  const text = withoutComments(message, commentChar);
  // Merges übernehmen geprüfte Commits; fixup!/squash! werden mit ihrem Ziel zusammengelegt.
  if (merge || /^(fixup|squash)! /.test(text.trimStart())) return [];
  const noEffect = text.split("\n").some((line) => line.trim().startsWith(NO_EFFECT_TRAILER));
  const paths = new Set(files.map((f) => f.path));
  const problems: string[] = [];
  const exemption = `oder, wenn die Änderung ohne Wirkung auf Regeln und Werkzeuge ist, eine Zeile „${NO_EFFECT_TRAILER}“ in die Nachricht.`;

  const strategyCode = files.filter((f) => isStrategyCode(f.path)).map((f) => f.path);
  if (strategyCode.length > 0 && !paths.has(STRATEGY) && !noEffect)
    problems.push(`Regel-Code geändert (${strategyCode.join(", ")}), aber nicht ${STRATEGY}. Strategie nachziehen ${exemption}`);

  const toolCode = files.filter((f) => isToolCode(f.path)).map((f) => f.path);
  if (toolCode.length > 0 && !paths.has(STRATEGY) && !paths.has(SPECIFICATION) && !noEffect)
    problems.push(`Werkzeug geändert (${toolCode.join(", ")}), aber weder ${STRATEGY} noch ${SPECIFICATION}. Nachziehen ${exemption}`);

  const removed = files.filter((f) => IMPRINT.test(f.path) && f.status.startsWith("D")).map((f) => f.path);
  if (removed.length > 0) problems.push(`Abdruck ${removed.join(", ")} gelöscht; alte Abdrücke bleiben liegen.`);

  if (newVersion !== null) {
    for (const doc of [STRATEGY, CHANGELOG])
      if (!paths.has(doc)) problems.push(`STRATEGY_VERSION geändert, aber ${doc} nicht (Version im Kopf, Eintrag im Protokoll).`);
    if (!files.some((f) => f.path === imprintOf(newVersion) && f.status.startsWith("A")))
      problems.push(
        `STRATEGY_VERSION ist jetzt ${newVersion}, aber ${imprintOf(newVersion)} ist nicht neu (\`mise run strategy:imprint\`).`,
      );
    const absent = BACKTEST_FIGURES.filter((word) => !text.includes(word));
    if (absent.length > 0)
      problems.push(`Neue Strategieversion: Die Nachricht nennt nicht alle Kennzahlen des Rückblicks (es fehlt ${absent.join(", ")}).`);
  } else {
    const rewritten = files.filter((f) => IMPRINT.test(f.path) && f.status.startsWith("M")).map((f) => f.path);
    if (rewritten.length > 0 && !noEffect)
      problems.push(
        `Abdruck ${rewritten.join(", ")} neu geschrieben, ohne dass die Version steigt. Regeländerung: Version erhöhen; ` +
          `sonst „${NO_EFFECT_TRAILER}“ in die Nachricht.`,
      );
  }
  return problems;
}

/** Neuer Wert von `STRATEGY_VERSION` aus dem Diff von `src/valuation/run.ts`; `null`, wenn die Zeile gleich bleibt. */
export function newVersionFromDiff(diff: string): string | null {
  return /^\+export const STRATEGY_VERSION = "([^"]+)"/m.exec(diff)?.[1] ?? null;
}
