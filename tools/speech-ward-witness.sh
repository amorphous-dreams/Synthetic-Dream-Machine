#!/usr/bin/env bash
# speech-ward-witness — the L-Prime ward over the speech the system emits (refusals, hand acts, usage, human CLI lines,
# MCP tool descriptions and error text), held per package to a ceiling that only lowers. The walk, its exemptions and
# its ratchet live in tools/speech-ward-witness.mjs; this entry enrols it in tools/witness-all.sh by name.
# Law: lar:///ha.ka.ba/lares/api/mu/l-prime#/system-speech
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
exec node tools/speech-ward-witness.mjs "$@"
