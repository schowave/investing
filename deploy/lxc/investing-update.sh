#!/usr/bin/env bash
# Holt das neueste Image und startet investing nur neu, wenn es sich geändert hat.
# Kommt die neue Version nicht gesund hoch, läuft wieder die vorherige. Läuft per systemd-Timer.
set -euo pipefail
cd /opt/investing
image="ghcr.io/schowave/investing:latest"
log() { echo "investing-update: $*"; }

before="$(docker image inspect --format '{{.Id}}' "$image" 2>/dev/null || true)"
docker compose pull --quiet
after="$(docker image inspect --format '{{.Id}}' "$image")"
if [ "$before" = "$after" ] && docker compose ps --status running --quiet | grep -q .; then
  exit 0 # nichts Neues, Container läuft
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
