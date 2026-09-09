#!/usr/bin/env bash
# call-reach — every call the corpus writes, rendered, and asked whether it ARRIVED.
#
# The grammar fails gracefully: a call reaching no definition renders the reader's own text rather
# than an error. That forgiveness is why a carrier survives a stranger — and it makes a broken call
# and a working one agree in every observable. This witness reads the difference the only way it can
# be read: by rendering the call and comparing against the echo it would produce.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
node tools/call-reach.mjs
