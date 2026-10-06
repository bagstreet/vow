#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
echo "node $(node -v)"
node --check apps/cli/vow.mjs
node --check apps/cli/vow-http.mjs
node --check src/http/server.mjs
echo "doctor: syntax ok. HTTP demo is local bearer only, not production OAuth."
echo "start: VOW_DEMO_TOKEN=... node apps/cli/vow-http.mjs"
echo "docker (not run here): docker build -t vow-demo . && docker run --rm -p 8788:8788 -e VOW_DEMO_TOKEN=demo-vow -e PORT=8788 vow-demo"
