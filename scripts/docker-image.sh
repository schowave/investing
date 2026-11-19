#!/usr/bin/env bash
# Baut das Image und pusht es optional (mise run docker:build, auch im CI).
#   VERSION  Version im Image, Standard: dev; im CI der kurze Commit, z. B. 5359b8d
#   IMAGE    Ziel-Repository, Standard: investing (lokal); im CI ghcr.io/schowave/investing
#   PUSH=1   Image nach dem Bauen pushen (docker login vorher nötig; das CI pusht selbst)
# Die mise-Version im Image ist min_version aus mise.toml, nicht die zufällig lokal installierte.
set -euo pipefail
version="${VERSION:-dev}"
image="${IMAGE:-investing}"
mise_version="$(sed -n 's/^min_version = "\([^"]*\)".*/\1/p' mise.toml)"
revision="$(git rev-parse --short HEAD)"
test -n "$mise_version"

# latest ist das, worauf der Update-Timer im LXC hört.
tags=(-t "$image:$version" -t "$image:latest")

docker build \
  --build-arg MISE_VERSION="$mise_version" \
  --build-arg VERSION="$version" \
  --build-arg REVISION="$revision" \
  "${tags[@]}" .

if [ "${PUSH:-0}" = "1" ]; then
  docker push "$image:$version"
  docker push "$image:latest"
fi
