#!/usr/bin/env bash
# turn-parity-witness — the turn harvester's reading answers to the wiki's own parse and render.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/turn-parity.mjs
