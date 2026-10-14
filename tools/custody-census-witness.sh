#!/usr/bin/env bash
# custody-census-witness — every private file a founded vessel keeps at rest answers to one row of the carrier table.
#
# ── WHY A WITNESS AND NOT A UNIT TEST ───────────────────────────────────────────────────────────
# The carrier table (`packages/lararium-node/src/vault-carriers.ts`) names the files; the writers across the node
# package land them. A unit test over the table passes while a writer lands a private file no row names, and that
# file then stays behind under a retired key at the next rotation and rides no reading a person sees. Only a real
# founding, a real stand and a real unlock put every writer's file on disk beside the table that claims them.
#
# ── WHAT IT READS ───────────────────────────────────────────────────────────────────────────────
# `lares vault status --json`, the command's own answer: one reading of each standing file, derived from the table,
# and every private file outside it. The witness refuses a row at fault, a bare row that names no law, an owner-only
# file, a file under the vessel key's seal and a sidecar that no row names. It plants each kind of stray and reads
# it named before it trusts a clean reading, and it carries the rotation through the same table: an unlisted sealed
# file refuses an unbind that rotates and leaves the slot bound; the same act completes once the file leaves
# (`tools/custody-census-witness.mjs`).
#
# It founds under a marked scratch root in a temp dir, through the test custody doors, so it never touches a vessel
# anyone keeps.
#
# Usage:  tools/custody-census-witness.sh          (exits non-zero on any breach)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO=$PWD

# DIST-FRESHNESS PREFLIGHT. A witness builds nothing: `vessel found` rides `--skip-build`, so the witness asks
# freshness itself of the CLI it drives and of the node entry it stands, and a stale build refuses here.
node "$REPO/tools/corpus-read.mjs" --assert-fresh "$REPO/packages/lares-cli/dist/src/bin/lares.js" "$REPO/packages/lararium-node/dist/src/main.js"
if [ $? -ne 0 ]; then exit 2; fi

echo "custody-census-witness: founding a scratch vessel with the built tree"
node "$REPO/tools/custody-census-witness.mjs"
