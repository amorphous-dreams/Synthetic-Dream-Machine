#!/usr/bin/env bash
# sigil-parity-witness — every sigil's named parameters read the same as TiddlyWiki reads them.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/sigil-parity.mjs
