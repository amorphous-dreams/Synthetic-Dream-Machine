#!/usr/bin/env bash
# grammar-cut-witness — the kupono grammar cut stands whole across the bags.
#
# Runs tools/grammar-cut.mjs as a dry run with --check: red while any carrier still owes the cut
# (a quoted or positional value, an arrow between values, a spaced at-name, the retired turn frame), and
# red on any of the tool's own reds (an unmapped at-name, an oracle disagreement, a Canon body
# change, a seal that does not verify). Refusals the tool lists for a hand pass print but do not
# red. A run that read no files reads red too: zero scanned never passes for zero owed.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
out=$(node tools/grammar-cut.mjs --check "$@" 2>&1)
code=$?
printf '%s\n' "$out"
if printf '%s\n' "$out" | grep -qE 'dry run: [0-9]+ of 0 file'; then
  echo "grammar-cut-witness: no files scanned" >&2
  exit 1
fi
exit $code
