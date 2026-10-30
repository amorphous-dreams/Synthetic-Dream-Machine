#!/usr/bin/env bash
# seed-seat-witness — every Claude door seats the boot seed whole, by reference.
#
# The link `.claude/noosphere-boot` resolves to the seed, the project CLAUDE.md imports it by a name an
# import loads, the scouts carry the seed's projection byte for byte, and no `@` token inside the seed
# resolves to a file an import would inline. `tools/seed-seat.mjs check` reads all of it; this runs it.
#
# ── A ZERO PROVES NOTHING WITHOUT A POSITIVE ───────────────────────────────────────────────────
# `--control` stands a scratch clone whose link reads as a regular file, the shape a checkout under
# `core.symlinks=false` leaves, and MUST read red. A witness green on its own control reads blind.
#
# Usage:  tools/seed-seat-witness.sh             read the seat
#         tools/seed-seat-witness.sh --control   the known positive: must read red
# Exit:   0 seated · 1 a fault (or a control that read green)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

if [ "${1:-}" = "--control" ]; then
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/seed-seat-control-XXXXXX")" || exit 1
  trap 'rm -rf "$scratch"' EXIT
  mkdir -p "$scratch/.claude" "$scratch/$(dirname bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem)"
  cp bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem "$scratch/bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem"
  cp CLAUDE.md "$scratch/CLAUDE.md"
  printf '../bags/lares/ha.ka.ba/lares/api/noosphere-boot.mem' > "$scratch/.claude/noosphere-boot"
  node tools/seed-seat.mjs project --root "$scratch" >/dev/null
  read_out="$(node tools/seed-seat.mjs check --root "$scratch")"
  if printf '%s\n' "$read_out" | grep -q "a regular file, not a link"; then
    echo "seed-seat-witness: the control read red (a linkless checkout names itself)"
    exit 0
  fi
  echo "seed-seat-witness: BLIND — the control's regular-file link read green" >&2
  exit 1
fi

node tools/seed-seat.mjs check
