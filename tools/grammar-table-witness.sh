#!/usr/bin/env bash
# grammar-table-witness — derive the sigil table from the SharktoothSigil tiddlers
# (packages/lararium-tw5/tiddlers/sigil-*.tid) and diff it against the HAND-KEPT
# node-side lists (scanner.ts BOOTSTRAP_SCANS, builder.ts CANONICAL_SIGILS,
# meme-normalize.ts DEFINITION_HEAD), printing every disagreement grouped by kind.
#
# The tiddlers are the source of record (grammar-cache.ts already reads them for the
# live wiki); this witness measures how far the node-side hand copies have drifted.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
exec npx tsx packages/lararium-tw5/scripts/grammar-table-witness.ts
