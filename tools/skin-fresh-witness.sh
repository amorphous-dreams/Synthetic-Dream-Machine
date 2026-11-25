#!/usr/bin/env bash
# skin-fresh-witness — the TRACKED skin bundles equal what the plugin pipeline builds from the tree's sources today.
# genesis-parity compares the tracked bundles with genesis, never with a fresh build; this reads the other side.
# Usage: tools/skin-fresh-witness.sh [--root <tree>] [--build "<command>"]
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/skin-fresh.mjs "$@"
