#!/usr/bin/env bash
# Einmalige Einrichtung im LXC (Debian mit Docker). Aufruf im LXC als root:  bash install.sh
# Danach übernimmt investing-update.timer alle Updates und investing-sync.timer den nächtlichen Abgleich.
set -euo pipefail
src="$(cd "$(dirname "$0")" && pwd)"
install -d -m 755 /opt/investing
install -d -m 750 -o 10001 -g 10001 /opt/investing/data
install -m 644 "$src/compose.yaml" /opt/investing/compose.yaml
install -m 755 "$src/investing-update.sh" /opt/investing/investing-update.sh
install -m 644 "$src"/investing-update.{service,timer} "$src"/investing-sync.{service,timer} /etc/systemd/system/
command -v curl >/dev/null || { apt-get update && apt-get install -y curl; }
systemctl daemon-reload
systemctl enable --now investing-update.timer investing-sync.timer
systemctl start investing-update.service
systemctl --no-pager status investing-update.service | tail -5 || true # oneshot meldet danach "inactive" (Code 3)
