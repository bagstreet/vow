#!/usr/bin/env bash
# Vow — one-shot setup & self-check for a developer picking this up cold.
set -euo pipefail
cd "$(dirname "$0")/.."
NODE="${NODE:-node}"
echo "▸ Checking Node.js (need >= 20)…"
command -v "$NODE" >/dev/null || { echo "  ✗ Node.js not found: https://nodejs.org"; exit 1; }
[ "$("$NODE" -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "  ✗ Node $($NODE -v) too old; need >= 20."; exit 1; }
echo "  ✓ $($NODE -v)"
echo "▸ Running the offline test suite (no keys/network)…"
"$NODE" --test >/dev/null && echo "  ✓ tests pass"
echo "▸ Checking business-logic coverage (ledger/app/keys = 100% lines+functions)…"
"$NODE" --test --experimental-test-coverage \
  --test-coverage-include='src/ledger/audit.mjs' --test-coverage-include='src/ledger/chain.mjs' \
  --test-coverage-include='src/ledger/screen.mjs' --test-coverage-include='src/ledger/summary.mjs' \
  --test-coverage-include='src/companion.mjs' --test-coverage-include='src/keys.mjs' \
  --test-coverage-lines=100 --test-coverage-functions=100 >/dev/null && echo "  ✓ business logic fully covered"
cat <<'NEXT'

Setup complete. What next:
  make demo     # the honest-ledger / tamper story (offline)
  make jury     # quick PASS/FAIL over the headline use-cases (incl. tamper-evidence)
  make coverage # full src coverage report with thresholds

Optional (MCP + real Walrus relayer):
  npm install
  make mcp
  MEMWAL_SEAL_SESSION=<session> vow checkin …
NEXT
