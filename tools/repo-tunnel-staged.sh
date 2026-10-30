#!/usr/bin/env bash
# repo-tunnel-staged — refuse a commit whose index stands off the checkout's declared reality tunnel.
#
# A commit that stages the seat lands only while `lares repo read --staged` reads the INDEX aligned: each seed link a
# link, CLAUDE.md's import, the scouts' projections of the staged seed, the seedless files, the Codex
# cap, the rule exclude. The memegraph writes the seed without a build, so this is the moment that
# catches a seed staged ahead of its scouts. Only a commit that stages one of the seat's own paths (the
# carrier, its seed, each checkout item's file) reads; FAIL CLOSED: such a commit with no built CLI refuses.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` runs this script)
#   witness:  tools/repo-tunnel-witness.sh, packages/lares-cli/tests/reality-tunnel.test.ts
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARES="${LARES_BIN:-$HERE/packages/lares-cli/dist/src/bin/lares.js}"
CARRIER="bags/lares/ha.ka.ba/lares/cli/reality-tunnel.mem"
# The seat's own paths, read from the staged carrier: the carrier, its seed, and every checkout item's file.
# A commit that stages none of them leaves the seat as the last commit held it, so it needs no reading.
seat="$(printf '%s\n' "$CARRIER"; git show ":$CARRIER" 2>/dev/null | awk '
  /^```toml reality-tunnel/ { on = 1; next }
  on && /^```/              { on = 0 }
  !on                       { next }
  /^\[\[/                   { section = $0; next }
  { q = $0; sub(/^[^"]*"/, "", q); sub(/"[^"]*$/, "", q) }
  section == "" && /^seed *=/                 { print q }
  section == "[[repo]]" && /^file *=/         { print q }
')"
staged="$(git diff --cached --name-only --no-renames)"
touched="$(printf '%s\n' "$staged" | grep -Fxf <(printf '%s\n' "$seat" | sed '/^$/d') || true)"
if [ -z "$touched" ]; then
  echo "[repo-tunnel-staged] the commit stages none of the seat's paths — the seat stands as committed"
  exit 0
fi
if [ ! -f "$LARES" ]; then
  echo "[repo-tunnel-staged] REFUSED — no built CLI at $LARES to read the staged seat" >&2
  echo "  build it (pnpm build, or tools/provision-worktree.mjs for a lane) and commit again." >&2
  exit 1
fi
if ! out="$(node "$LARES" repo read --staged --json)"; then
  echo "[repo-tunnel-staged] REFUSED — the staged checkout stands off its declared reality tunnel:" >&2
  printf '%s\n' "$out" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{for(const r of JSON.parse(s).data.rows)if(r.state!=="aligned"&&r.state!=="absent")console.error(`  ${r.state} ${r.id}: ${r.detail}`)}catch{console.error(s)}})'
  echo "  run lares repo tend, stage what it wrote, and commit again." >&2
  exit 1
fi
exit 0
