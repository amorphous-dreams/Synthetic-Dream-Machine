#!/usr/bin/env bash
# source-pointer-witness — a carrier that names the code it documents must name code that EXISTS.
# The anchor check alone: a meme whose pointer dangles is unfalsifiable, and an unfalsifiable meme's
# claims stand unchallenged however far they have drifted. Cheapest drift to catch, and the leading
# indicator for the expensive kind.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/source-pointer.mjs
