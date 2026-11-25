#!/usr/bin/env bash
# Holt das neueste Image und startet investing nur neu, wenn es sich geändert hat.
# Übernimmt dabei die Betriebsdateien aus dem Image (compose.yaml, systemd-Units, dieses Skript).
# Kommt die neue Version nicht gesund hoch, läuft wieder die vorherige. Läuft per systemd-Timer.
set -euo pipefail
cd /opt/investing
image="ghcr.io/schowave/investing:latest"
log() { echo "investing-update: $*"; }

before="$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"
docker compose pull --quiet
after="$(docker image inspect --format '{{.Id}}' "$image")"
if [ "$before" = "$after" ] && [ "$(docker compose ps --status running --quiet | wc -l)" -ge 2 ]; then
  exit 0 # nichts Neues, Oberfläche und Worker laufen
fi

# Betriebsdateien aus dem neuen Image übernehmen, damit Änderungen daran ohne Handgriff im LXC ankommen.
# Bash hat dieses Skript schon gelesen; das Ersetzen wirkt ab dem nächsten Lauf.
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cid="$(docker create "$image")"
docker cp "$cid:/app/deploy/lxc/." "$tmp/"
docker rm "$cid" >/dev/null
units_changed=0
for f in compose.yaml investing-update.sh; do
  if ! cmp -s "$tmp/$f" "/opt/investing/$f"; then
    install -m "$([ "$f" = investing-update.sh ] && echo 755 || echo 644)" "$tmp/$f" "/opt/investing/$f"
    log "$f aus dem Image übernommen"
  fi
done
for f in investing-update.service investing-update.timer investing-sync.service investing-sync.timer; do
  if ! cmp -s "$tmp/$f" "/etc/systemd/system/$f"; then
    install -m 644 "$tmp/$f" "/etc/systemd/system/$f"
    units_changed=1
    log "$f aus dem Image übernommen"
  fi
done
if [ "$units_changed" = 1 ]; then systemctl daemon-reload; fi
# Der Timer für den Abgleich kam nach der Erstinstallation dazu; nur install.sh schaltete ihn ein. Ein kopierter, aber
# nicht eingeschalteter Timer läuft nie (so stand der Abgleich vom 20. bis 25.11.2026). An und aus geht über die Seite
# „Abgleich“: Der Timer stellt den Lauf nur ein, wenn der nächtliche Abgleich dort an ist.
if ! systemctl is-enabled --quiet investing-sync.timer; then
  systemctl enable --now investing-sync.timer
  log "investing-sync.timer eingeschaltet"
fi

version="$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.version"}}' "$image")"
log "neue Version $version wird gestartet"
docker compose up -d --remove-orphans

# Beim ersten Start einer neuen Datenbankversion laufen die Migrationen; das darf dauern.
for _ in $(seq 1 60); do
  if curl -sf http://localhost:3000/healthz | grep -q "\"version\":\"$version\""; then
    log "Version $version läuft"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

log "Version $version startet nicht – zurück auf die vorherige"
docker compose logs --tail 30 investing || true
if [ -n "$before" ]; then
  docker tag "$before" "$image"
  docker compose up -d --remove-orphans
fi
exit 1
