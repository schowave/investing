// Richtet den täglichen Abgleich als macOS-Hintergrunddienst (launchd) ein.
// Aufruf: npm run schedule -- an       täglich um 23:15 Uhr; war der Rechner aus, beim nächsten Aufwachen
//         npm run schedule -- aus      Dienst entfernen
//         npm run schedule -- status   zeigt, ob der Dienst eingerichtet ist

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { join } from "node:path";

const LABEL = "de.schowave.investing.sync";
const plistPath = join(homedir(), "Library", "LaunchAgents", `${LABEL}.plist`);
const domain = `gui/${userInfo().uid}`;
const project = process.cwd();

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const launchctl = (...args: string[]) => {
  try {
    execFileSync("launchctl", args, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

const command = process.argv[2];
if (process.platform !== "darwin") {
  console.error("Dieser Befehl ist nur für macOS. Auf einem Server gehört `npm run sync` in einen Cron-Eintrag.");
  process.exit(1);
}

if (command === "an") {
  mkdirSync(join(project, "data"), { recursive: true });
  mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true });
  const log = join(project, "data", "sync.log");
  writeFileSync(
    plistPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>WorkingDirectory</key><string>${xml(project)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>--env-file-if-exists=.env.local</string>
    <string>scripts/sync.ts</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>23</integer><key>Minute</key><integer>15</integer></dict>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict>
</plist>
`,
  );
  launchctl("bootout", domain, plistPath);
  if (!launchctl("bootstrap", domain, plistPath)) {
    console.error("launchd hat den Dienst nicht angenommen.");
    process.exit(1);
  }
  console.log(`Eingerichtet: täglich 23:15 Uhr. Protokoll: ${log}`);
  console.log(`Verwendet ${process.execPath}. Nach einem Node-Update bitte erneut "npm run schedule -- an" ausführen.`);
} else if (command === "aus") {
  launchctl("bootout", domain, plistPath);
  rmSync(plistPath, { force: true });
  console.log("Dienst entfernt.");
} else if (command === "status") {
  const loaded = launchctl("print", `${domain}/${LABEL}`);
  console.log(existsSync(plistPath) && loaded ? "Eingerichtet: täglich 23:15 Uhr." : "Nicht eingerichtet.");
} else {
  console.error('Aufruf: npm run schedule -- an | aus | status');
  process.exit(1);
}
