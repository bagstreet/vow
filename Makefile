# Vow — Makefile
# The offline path (test, demo, audit) needs no network, wallet, or API key.

NODE ?= node

.PHONY: help test demo mutation secret-scan evidence audit tamper mcp clean coverage coverage-core e2e jury setup presets

help:
	@echo "Vow targets:"
	@echo "  make test         full offline test suite (no keys/network)"
	@echo "  make presets      local medication and NutriMind preset tests"
	@echo "  make demo         vow -> check-ins -> tamper caught -> honest correction"
	@echo "  make mutation     the prompt-contract mutation test only"
	@echo "  make secret-scan  scan tracked content for secret shapes"
	@echo "  make evidence     receipt/evidence invariants"
	@echo "  make audit        example: a clean ledger verifies (intact, exit 0)"
	@echo "  make tamper       example: a rewritten ledger is caught (tampered, exit 1)"
	@echo "  make mcp          start the MCP server on stdio (needs: npm install)"

test:
	$(NODE) --test

presets:
	$(NODE) --test tests/presets-medication.test.mjs tests/presets-nutrimind.test.mjs

mutation:
	$(NODE) --test tests/prompt-contract.test.mjs

secret-scan:
	$(NODE) --test tests/secret-scan.test.mjs

evidence:
	$(NODE) --test tests/evidence.test.mjs

demo:
	$(NODE) demo/demo.mjs

# A clean ledger verifies (exit 0).
audit:
	@rm -f /tmp/vow-audit-demo.json
	@VOW_STORE=/tmp/vow-audit-demo.json $(NODE) bin/vow.mjs make --id vow:run-3x --title "Run 3x a week" --cadence weekly >/dev/null
	@VOW_STORE=/tmp/vow-audit-demo.json $(NODE) bin/vow.mjs checkin --vow vow:run-3x --date 2026-09-25 --status done >/dev/null
	@VOW_STORE=/tmp/vow-audit-demo.json $(NODE) bin/vow.mjs checkin --vow vow:run-3x --date 2026-09-26 --status done >/dev/null
	VOW_STORE=/tmp/vow-audit-demo.json $(NODE) bin/vow.mjs audit

# Rewrite a stored check-in, then audit: the tamper is caught (exit 1).
tamper:
	@rm -f /tmp/vow-tamper-demo.json
	@VOW_STORE=/tmp/vow-tamper-demo.json $(NODE) bin/vow.mjs make --id vow:run-3x --title "Run 3x a week" >/dev/null
	@VOW_STORE=/tmp/vow-tamper-demo.json $(NODE) bin/vow.mjs checkin --vow vow:run-3x --date 2026-09-25 --status done >/dev/null
	@VOW_STORE=/tmp/vow-tamper-demo.json $(NODE) bin/vow.mjs checkin --vow vow:run-3x --date 2026-09-26 --status missed >/dev/null
	@VOW_STORE=/tmp/vow-tamper-demo.json $(NODE) demo/tamper.mjs
	-VOW_STORE=/tmp/vow-tamper-demo.json $(NODE) bin/vow.mjs audit
	@echo "(a non-zero exit above is the point: the rewrite was caught)"

coverage:
	$(NODE) --test --experimental-test-coverage --test-coverage-include='src/**' \
	  --test-coverage-lines=95 --test-coverage-branches=85 --test-coverage-functions=95

coverage-core:
	$(NODE) --test --experimental-test-coverage \
	  --test-coverage-include='src/ledger/audit.mjs' --test-coverage-include='src/ledger/chain.mjs' \
	  --test-coverage-include='src/ledger/screen.mjs' --test-coverage-include='src/ledger/summary.mjs' \
	  --test-coverage-include='src/companion.mjs' --test-coverage-include='src/keys.mjs' \
	  --test-coverage-lines=100 --test-coverage-functions=100

e2e:
	$(NODE) --test tests/e2e.test.mjs

jury:
	./scripts/jury.sh

setup:
	./scripts/setup.sh

mcp:
	$(NODE) mcp/server.mjs

clean:
	rm -rf node_modules
