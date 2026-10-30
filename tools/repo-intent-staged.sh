#!/usr/bin/env bash
# repo-intent-staged — refuse a commit whose index stands off the checkout's declared intent.
#
# Every commit lands only while `lares repo read --staged` reads the INDEX aligned: each seed link a
# link, CLAUDE.md's import, the scouts' projections of the staged seed, the seedless files, the Codex
# cap, the rule exclude. The memegraph writes the seed without a build, so this is the moment that
# catches a seed staged ahead of its scouts. FAIL CLOSED: a commit with no built CLI to read it refuses.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` runs this script)
#   witness:  tools/repo-intent-witness.sh, packages/lares-cli/tests/intent-engine.test.ts
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARES="${LARES_BIN:-$HERE/packages/lares-cli/dist/src/bin/lares.js}"
if [ ! -f "$LARES" ]; then
  echo "[repo-intent-staged] REFUSED — no built CLI at $LARES to read the staged seat" >&2
  echo "  build it (pnpm build, or tools/provision-worktree.mjs for a lane) and commit again." >&2
  exit 1
fi
if ! out="$(node "$LARES" repo read --staged --json)"; then
  echo "[repo-intent-staged] REFUSED — the staged checkout stands off its declared intent:" >&2
  printf '%s\n' "$out" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{for(const r of JSON.parse(s).data.rows)if(r.state!=="aligned"&&r.state!=="absent")console.error(`  ${r.state} ${r.id}: ${r.detail}`)}catch{console.error(s)}})'
  echo "  run lares repo tend, stage what it wrote, and commit again." >&2
  exit 1
fi
exit 0
