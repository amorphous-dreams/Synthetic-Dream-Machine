#!/usr/bin/env bash
# seed-seat-staged — refuse a commit whose seat parts from its seed.
#
# A commit that touches any seat surface (the seed, a link, a scout, a host's instructions or config) lands
# only while the INDEX still seats the seed: each link stays a link, CLAUDE.md imports it, the Codex cap
# holds it, and each scout carries the staged seed's projection byte for byte. The memegraph writes the seed without a build, so this is the moment that
# catches a seed staged ahead of its scouts. FAIL CLOSED: a check that cannot run never passes.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` runs this script)
#   witness:  tools/seed-seat-witness.sh, tools/seed-seat.test.mjs
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1

touched="$(git diff --cached --name-only -- \
  bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem .claude/noosphere-boot .claude/agents .claude/settings.json CLAUDE.md AGENTS.md AGENTS.override.md .codex/config.toml .github/copilot-instructions.md)"
[ -z "$touched" ] && exit 0

if ! out="$(node tools/seed-seat.mjs check --index)"; then
  echo "[seed-seat-staged] REFUSED — the staged seat parts from its seed:" >&2
  printf '%s\n' "$out" | grep -v '^seed-seat: the seat stands$' | sed 's/^/  /' >&2
  echo "  run node tools/seed-seat.mjs project, stage .claude/agents, and commit again." >&2
  exit 1
fi
exit 0
