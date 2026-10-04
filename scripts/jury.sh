#!/usr/bin/env bash
# Vow — jury quick-check.
# Runs the headline use-cases against the REAL CLI and reports PASS/FAIL per scenario,
# including a live tamper-evidence check. Fully offline: no keys/wallet/network.
# Exits 0 iff every scenario passes.
#
#   ./scripts/jury.sh      (or:  make jury)
set -uo pipefail
cd "$(dirname "$0")/.."
NODE="${NODE:-node}"
STORE="$(mktemp -d)/jury.json"; export VOW_STORE="$STORE"
pass=0; fail=0
grn() { printf '\033[32m%s\033[0m' "$1"; }; red() { printf '\033[31m%s\033[0m' "$1"; }
run() { OUT="$("$NODE" bin/vow.mjs "$@" 2>&1)"; ACT=$?; }
check() { if [ "$ACT" = "$2" ] && printf '%s' "$OUT" | grep -qE "$3"; then
    printf '  %s %s\n' "$(grn ✓)" "$1"; pass=$((pass+1))
  else printf '  %s %s  (exit=%s want=%s; /%s/)\n' "$(red ✗)" "$1" "$ACT" "$2" "$3"; fail=$((fail+1)); fi; }

echo "── Vow · jury use-case checks ────────────────────────────────"

run make --id vow:run-3x --title "Run 3x a week" --cadence weekly --target 3
check "seed the vow (receipt)" 0 "receipt|vow:run-3x|made"
run checkin --vow vow:run-3x --date 2026-09-28 --status done --note "5k"
check "check-in #1 links onto the chain" 0 "receipt|ci-1|checkin|done"
run checkin --vow vow:run-3x --date 2026-09-29 --status done --note "6k"
check "check-in #2 links onto the chain" 0 "receipt|ci-2|checkin|done"

# UC1 — the append-only chain audits INTACT (exit 0).
run audit
check "UC1  honest chain audits INTACT (exit 0)" 0 "intact"

# UC2 — the honest streak is reported for the vow (exit 0).
run status --vow vow:run-3x
check "UC2  status reports the streak (exit 0)" 0 "."

# UC3 — the memory passport rebuilds on a fresh client (exit 0).
run restore
check "UC3  restore rebuilds the chain (exit 0)" 0 "restored [0-9]+/[0-9]+"

# UC4 — TAMPER-EVIDENCE: silently rewrite a stored check-in; the audit must catch it (exit 1).
sed -i 's/5k/9k-silently-edited/' "$STORE" 2>/dev/null || sed -i '' 's/5k/9k-silently-edited/' "$STORE"
run audit
check "UC4  a silent edit is DETECTED → tampered (exit 1)" 1 "tampered"

echo "──────────────────────────────────────────────────────────────"
printf 'Result: %s passed, %s failed\n' "$(grn "$pass")" "$([ "$fail" -eq 0 ] && grn 0 || red "$fail")"
[ "$fail" -eq 0 ] && echo "ALL USE-CASES PASS ✅" || { echo "SOME USE-CASES FAILED ❌"; exit 1; }
