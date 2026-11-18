#!/usr/bin/env bash
# barrier-witness — an absence assertion in the e2e set (nothing happened, the state holds, a count stays zero) must follow a
# named far-side barrier: a sentinel act's answer, a rested count, a tally line, a disconnect event. Counted backlog against a
# ceiling that only comes down; named allowances carry a reason and an owner row. Self-test: tools/barrier-witness.test.mjs.
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/barrier-witness.mjs "$@"
