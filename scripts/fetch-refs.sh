#!/usr/bin/env bash
# Recreates ref/ (git-ignored): reference material the agent may grep, never read whole.
# Usage: scripts/fetch-refs.sh [jellyfin-server-url]   (default: server in static/config.local.json)
set -euo pipefail
cd "$(dirname "$0")/.."
server="${1:-$(node -e "console.log(JSON.parse(require('fs').readFileSync('static/config.local.json','utf8')).server)")}"
mkdir -p ref && cd ref
curl -sf -m 30 -o jellyfin-openapi.json "$server/api-docs/openapi.json"
[ -d jellyfin-webos ] || git clone -q --depth 1 https://github.com/jellyfin/jellyfin-webos.git
[ -d jellyfin-androidtv ] || git clone -q --depth 1 https://github.com/jellyfin/jellyfin-androidtv.git
if [ ! -d Lightning ]; then
  git clone -q --depth 1 --filter=blob:none --sparse https://github.com/rdkcentral/Lightning.git
  (cd Lightning && git sparse-checkout set docs >/dev/null)
fi
du -sh ./*
