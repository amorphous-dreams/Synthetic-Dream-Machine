#!/usr/bin/env bash
# test-credential-witness — no carrier under bags/ or wikis/ carries a test credential literal (the published test
# passphrases and the fixture's), read from their own sources. Canon relays to the page, and the K2 spy hunts those
# literals there, so a canon line quoting one reads as a key moving when none did (tools/test-credential-witness.mjs).
#
# Usage:  tools/test-credential-witness.sh          (exits non-zero on any carrier that carries one)
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
node tools/test-credential-witness.mjs
