// Hook `commit-msg` (lefthook.yml): node scripts/check-commit.ts <Datei mit der Nachricht>. Regeln in src/repo/commitDocs.ts.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { commitProblems, newVersionFromDiff } from "../src/repo/commitDocs.ts";

const messageFile = process.argv[2];
if (!messageFile) {
  console.error("Aufruf: node scripts/check-commit.ts <Datei mit der Commit-Nachricht>");
  process.exit(2);
}

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const tryGit = (...args: string[]) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

const message = readFileSync(messageFile, "utf8");
// Bei `--amend` ersetzt der Commit HEAD; geprüft wird dann der ganze neue Commit gegen den Vorgänger von HEAD. Git verrät dem
// Hook das Amend nicht; erkannt wird es an der unveränderten ersten Zeile der Nachricht (sonst nur eine strengere Prüfung).
const subject = (text: string) => text.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
const head = tryGit("log", "-1", "--format=%B", "HEAD");
const amend = head !== null && subject(head) === subject(message) && tryGit("rev-parse", "--verify", "-q", "HEAD^") !== null;
const base = amend ? ["HEAD^"] : [];

const files = git("diff", "--cached", "--name-status", "--no-renames", ...base)
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [status, path] = line.split("\t");
    return { status: status!, path: path! };
  });
const newVersion = newVersionFromDiff(git("diff", "--cached", "-U0", ...base, "--", "src/valuation/run.ts"));
const commentChar = tryGit("config", "core.commentChar") || "#";
const merge = existsSync(git("rev-parse", "--git-path", "MERGE_HEAD"));

const problems = commitProblems({ files, message, newVersion, commentChar, merge });
if (problems.length > 0) {
  console.error("Commit abgelehnt (Strategie und Spezifikation, siehe AGENTS.md):");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
