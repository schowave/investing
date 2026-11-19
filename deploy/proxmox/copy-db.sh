#!/usr/bin/env bash
# Spielt eine Datenbankdatei in den LXC ein (als root auf pve). Vom Mac aus: mise run deploy:db
#   bash copy-db.sh /tmp/investing-import.sqlite
# Hält investing an, sichert die vorhandene Datenbank als investing.sqlite.vor-import und startet neu.
set -euo pipefail
CTID="${CTID:-108}"
src="${1:?Aufruf: copy-db.sh <datei.sqlite>}"
data=/opt/investing/data

pct exec "$CTID" -- bash -euc "cd /opt/investing && docker compose stop investing"
pct exec "$CTID" -- bash -euc "
  if [ -f $data/investing.sqlite ]; then mv $data/investing.sqlite $data/investing.sqlite.vor-import; fi
  rm -f $data/investing.sqlite-wal $data/investing.sqlite-shm
"
pct push "$CTID" "$src" "$data/investing.sqlite" --user 10001 --group 10001 --perms 640
pct exec "$CTID" -- bash -euc "cd /opt/investing && docker compose up -d investing"
for _ in $(seq 1 60); do
  if pct exec "$CTID" -- curl -sf http://localhost:3000/healthz; then echo; exit 0; fi
  sleep 2
done
echo "investing antwortet nach dem Einspielen nicht" >&2
exit 1
