# syntax=docker/dockerfile:1
# Image für den LXC auf dem Proxmox. Node und pnpm kommen wie lokal und im CI aus mise.toml/mise.lock,
# die Pakete strikt aus pnpm-lock.yaml – derselbe Build auf jedem Rechner.

ARG DEBIAN=debian:trixie-slim

# ---------- tools: mise installiert Node und pnpm in den gepinnten Versionen ----------
FROM ${DEBIAN} AS tools
ARG MISE_VERSION
ENV MISE_DATA_DIR=/opt/mise \
    MISE_CACHE_DIR=/tmp/mise-cache \
    MISE_YES=1 \
    MISE_LOCKED=1 \
    MISE_DISABLE_TOOLS=lefthook,actionlint,shellcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl libatomic1 \
 && rm -rf /var/lib/apt/lists/*
RUN test -n "$MISE_VERSION" \
 && curl -fsSL https://mise.run | MISE_VERSION="v${MISE_VERSION}" MISE_INSTALL_PATH=/usr/local/bin/mise sh \
 && mise --version
WORKDIR /app
COPY mise.toml mise.lock ./
# Node an einen festen Ort kopieren: das Laufzeit-Image braucht nur ihn, nicht mise.
RUN mise trust && mise install node pnpm && cp -a "$(mise where node)" /opt/node
ENV PATH="/opt/node/bin:$PATH"

# ---------- build: alle Pakete, Produktions-Build der Oberfläche ----------
FROM tools AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN mise exec -- pnpm install --frozen-lockfile
COPY . .
RUN mise exec -- pnpm run build

# ---------- deps: nur die Laufzeit-Pakete ----------
FROM tools AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN mise exec -- pnpm install --frozen-lockfile --prod

# ---------- runtime ----------
# libatomic1 braucht Node auf arm64 (lokaler Build auf dem Mac); auf amd64 schadet es nicht.
FROM ${DEBIAN}
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="investing" \
      org.opencontainers.image.description="Rückflussrendite: Aktien nach ihrer inneren Rendite bewerten" \
      org.opencontainers.image.source="https://github.com/schowave/investing" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tzdata libatomic1 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --home /app investing
COPY --from=tools /opt/node /opt/node
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json next.config.ts tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY db ./db
# Betriebsdateien für den LXC; investing-update.sh übernimmt sie von hier.
COPY deploy/lxc ./deploy/lxc
ENV PATH="/opt/node/bin:$PATH" \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    TZ=Europe/Berlin \
    INVESTING_DB=/data/investing.sqlite \
    INVESTING_BACKUPS=/data/backups \
    INVESTING_VERSION=${VERSION}
RUN mkdir -p /data && chown investing /data
USER investing
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "node_modules/next/dist/bin/next", "start"]
