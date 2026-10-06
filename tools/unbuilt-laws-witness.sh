#!/usr/bin/env bash
# unbuilt-laws-witness — run the red register with its skips stripped, and report any red that GREENED.
#
# ── THE FAILURE THIS CLOSES ─────────────────────────────────────────────────────────────────────
# Three deferrals expired unnoticed in one session. Keyhive's GroupId private constructor, the
# Keyhive-native membership surface, and the bag-tier reader were each written down as "when X lands"
# — and X had landed, in one case months earlier. Nothing ever asked. A comment naming a wait is not
# an instrument, because no instrument reads comments.
#
# `tests/unbuilt-laws.test.ts` holds the laws these models imply and nothing enforces, each SKIPPED so
# the suite stays honest about its own gaps. A skipped test is inert in exactly the way a comment is,
# so this runs them.
#
# ── WHAT A FAILURE MEANS HERE, AND IT IS THE OPPOSITE OF USUAL ──────────────────────────────────
# Every red MUST fail. A red that PASSES means the law it names has been built and the test is now a
# green nobody is running — so this exits non-zero and says UNSKIP, naming it. Success is "still red".
#
# It also fails when the register runs EMPTY: a file that lost its tests would otherwise report the
# cleanest possible run, and that is the shape of every witness this house has had to repair.
set -uo pipefail
cd "$(dirname "$0")/.."

SRC="packages/lararium-mesh/tests/unbuilt-laws.test.ts"
TMP="packages/lararium-mesh/tests/.unbuilt-laws-collide.test.ts"
[ -f "$SRC" ] || { echo "unbuilt-laws: the register is missing at $SRC"; exit 1; }

# Strip the skips so every recorded law RUNS.
sed 's/test\.skip(/test(/g' "$SRC" > "$TMP"
trap 'rm -f "$TMP"' EXIT

# The register carries BOTH: skipped reds, and unskipped tests standing as the floor they sit on.
declared=$(grep -c 'test\.skip(' "$SRC")
floor=$(grep -cE '^\s+test\("' "$SRC")

if [ "$declared" -eq 0 ]; then
  echo "unbuilt-laws: the register declares NO reds — a file that lost its tests reports the cleanest run"
  exit 1
fi

# PLAIN TEXT, whatever the host. Under `CI=true` vitest colours its summary, the `Tests` line then opens
# with an escape byte instead of whitespace, the grep below matches nothing, and an unread summary
# counts as zero reds: every law reports GREENED on a run where all of them failed. NO_COLOR asks for
# plain text and the sed strips any escape that still slips through.
out=$(cd packages/lararium-mesh && NO_COLOR=1 FORCE_COLOR=0 npx vitest run "tests/$(basename "$TMP")" --reporter=verbose 2>&1 \
  | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g')
# THE `Tests` SUMMARY LINE, never the first "N failed" in the stream — `Test Files  1 failed` matches
# that pattern too, and reading it reported one red standing where seventeen did.
summary=$(printf '%s' "$out" | grep -E "^\s+Tests " | tail -1)
failed=$(printf '%s' "$summary" | grep -oE '[0-9]+ failed' | grep -oE '[0-9]+')
passed=$(printf '%s' "$summary" | grep -oE '[0-9]+ passed' | grep -oE '[0-9]+')
failed=${failed:-0}
passed=${passed:-0}

# EVERY TEST IN THE REGISTER RAN, OR THE COUNT MEANS NOTHING. A suite that failed to import reports
# `Tests  no tests`, an unread summary reports nothing at all, and both read as zero reds. The verdict
# below counts as a verdict only when the reds and the floor together account for every test declared.
if [ $((failed + passed)) -ne $((declared + floor)) ]; then
  echo "unbuilt-laws: the register did not run — $((declared + floor)) test(s) declared, ${failed} failed + ${passed} passed read"
  echo "  summary: ${summary:-<no Tests line in the vitest output>}"
  printf '%s\n' "$out" | tail -30 | sed 's/^/  /'
  exit 1
fi

if [ "$failed" -lt "$declared" ]; then
  echo "unbuilt-laws: $declared red(s) declared · $failed still red · $((declared - failed)) GREENED"
  echo
  echo "  A law below now holds. UNSKIP it — a green nobody runs is how the last three waits expired."
  echo "  ($floor test(s) in the register stand unskipped as the floor, and pass by design.)"
  printf '%s' "$out" | grep -E "^\s+✓" | tail -n "+$((floor + 1))" | sed 's/^/  /'
  exit 1
fi

echo "unbuilt-laws: $declared red(s) declared · $failed still red · 0 greened · $floor standing as floor"
