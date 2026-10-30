#!/usr/bin/env bash
# repo-intent-witness — the checkout holds its declared intent (lar:///ha.ka.ba/lares/cli/intent).
#
# `lares repo read` answers every repo item against the carrier's intent: the seed's links, CLAUDE.md's
# import, the scouts, the files Copilot reads beside CLAUDE.md, Codex's doc cap, the rule exclude. It
# exits 0 aligned, 1 drift, 3 foreign bytes; a carrier the engine cannot parse fails it outright.
#
# ── A ZERO PROVES NOTHING WITHOUT A POSITIVE ───────────────────────────────────────────────────
# `--control` stands a scratch clone whose seed link reads as a regular file, the shape a checkout
# under `core.symlinks=false` leaves, and MUST read foreign. A witness green on its own control reads blind.
#
# Usage:  tools/repo-intent-witness.sh             read the checkout
#         tools/repo-intent-witness.sh --control   the known positive: must read red
# Exit:   0 aligned · non-zero off intent (or a control that read green)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
LARES="${LARES_BIN:-packages/lares-cli/dist/src/bin/lares.js}"
[ -f "$LARES" ] || { echo "repo-intent-witness: no built CLI at $LARES (pnpm build)" >&2; exit 1; }

if [ "${1:-}" = "--control" ]; then
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/repo-intent-control-XXXXXX")" || exit 1
  trap 'rm -rf "$scratch"' EXIT
  for f in bags/lares/ha.ka.ba/lares/cli/intent.mem bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem; do
    mkdir -p "$scratch/$(dirname "$f")" && cp "$f" "$scratch/$f"
  done
  mkdir -p "$scratch/.claude" && printf '../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem' > "$scratch/.claude/noosphere-boot"
  state="$(node --input-type=module -e "
    const { read } = await import('$PWD/packages/lares-cli/dist/src/intent/engine.js');
    const { Ledger } = await import('$PWD/packages/lares-cli/dist/src/intent/engine.js');
    const { repoItems } = await import('$PWD/packages/lares-cli/dist/src/intent/catalog.js');
    const row = read(repoItems('$scratch'), new Ledger('$scratch/.ledger')).find((r) => r.id === 'claude.seed-link');
    console.log(row.state);")"
  if [ "$state" = "foreign" ]; then
    echo "repo-intent-witness: the control read red (a linkless checkout names itself)"
    exit 0
  fi
  echo "repo-intent-witness: BLIND — the control's regular-file link read $state" >&2
  exit 1
fi

out="$(node "$LARES" repo read --json)"; code=$?
if [ "$code" -eq 0 ]; then echo "repo-intent-witness: the checkout holds its intent"; exit 0; fi
printf '%s\n' "$out" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{for(const r of JSON.parse(s).data.rows)if(r.state!=="aligned"&&r.state!=="absent")console.error(`  ${r.state} ${r.id}: ${r.detail} (${r.path})`)}catch{console.error(s)}})'
echo "repo-intent-witness: the checkout stands off intent (exit $code) — lares repo tend" >&2
exit "$code"
