#!/usr/bin/env bash
# empty-room-witness — a carrier another carrier CITES answers when the reader arrives.
set -uo pipefail
cd "$(dirname "$0")/.."
REPO="$PWD" node tools/empty-room.mjs
