// Lebenszeichen für den Update-Timer im LXC und für Uptime Kuma: Version des Images und Stand des letzten
// Abgleichs. Der Update-Timer gilt eine neue Version erst als gestartet, wenn sie hier ihre Version meldet.

import { database } from "../server.ts";

export const dynamic = "force-dynamic";

export function GET(): Response {
  const version = process.env.INVESTING_VERSION ?? "dev";
  try {
    const sync = database().latestSyncRun();
    return Response.json({ status: "ok", version, lastSync: sync ? { finishedAt: sync.finishedAt, ok: sync.ok } : null });
  } catch (error) {
    // Datenbank nicht lesbar: Der Dienst ist nicht gesund, auch wenn der Server antwortet.
    return Response.json({ status: "error", version, error: error instanceof Error ? error.message : String(error) }, { status: 503 });
  }
}
