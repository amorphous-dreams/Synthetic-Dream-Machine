#!/usr/bin/env bash
# ahu-pair-parity-witness — the ahu pairs scanAhu cuts, against the pairs the carrier grammar parses.
#
# Two readers of one structure stand in two languages: `scanAhu` (TypeScript, the decomposer) and the
# tree-sitter carrier grammar (C scanner + grammar.js, the editor's and the fold hosts' reader). Each
# passes its own tests while the seam between them goes unread; this witness reads the seam.
#
# Exit 0 = every scanAhu pair, at every depth, stands in the grammar's tree, and no bags/ carrier parses
# in error. Grammar-only pairs (hoike, kue, moolelo …) and scanAhu balance faults are reported, never
# refused. Exit 2 = a missing or stale shore (tw5 dist, grammar wasm), with its cure.
# Self-test: node --test tools/ahu-pair-parity.test.mjs
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/ahu-pair-parity.mjs
