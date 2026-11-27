#!/usr/bin/env bash
# floor-owes-witness — the seam table still covers the tree it guards (research/corpus-seams, the census). Every tracked path
# rides through the `floor-owes` fold by the checkout's own table: a path no MOVES, CONFIG or FREE row places reads UNMAPPED
# (a lane touching it would draw the ticket's refusal), an e2e file or VESSEL tool test no seam's GUARDS row names reads
# UNDECLARED (no ticket would ever owe it by seam), and a GUARDS or VESSEL row naming no tracked file reads DEAD. The fold
# lives in `packages/lararium-tw5/src/floor-owes.ts`; `tools/floor-owes.mjs --census` gathers the paths and asks it.
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/floor-owes.mjs --census
exit $?
