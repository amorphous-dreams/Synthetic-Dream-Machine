#!/usr/bin/env bash
# seed-seat-staged — refuse a commit whose seat parts from its seed.
#
# Every commit lands only while the INDEX still seats the seed. The check reads every surface on each
# commit, since a hand-kept list of the paths that might break the seat drifts from the seat itself: each link stays a link, CLAUDE.md imports it, the Codex cap
# holds it, and each scout carries the staged seed's projection byte for byte. The memegraph writes the seed without a build, so this is the moment that
# catches a seed staged ahead of its scouts. FAIL CLOSED: a check that cannot run never passes.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` runs this script)
#   witness:  tools/seed-seat-witness.sh, tools/seed-seat.test.mjs
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1

if ! out="$(node tools/seed-seat.mjs check --index)"; then
  echo "[seed-seat-staged] REFUSED — the staged seat parts from its seed:" >&2
  printf '%s\n' "$out" | grep -v '^seed-seat: the seat stands$' | sed 's/^/  /' >&2
  echo "  run node tools/seed-seat.mjs project, stage .claude/agents, and commit again." >&2
  exit 1
fi
exit 0
