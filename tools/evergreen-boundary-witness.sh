#!/usr/bin/env bash
# evergreen-boundary-witness — authored version fields, clock readings that flow into ids, gates and durable
# fields, and comments that narrate history, each counted in `packages/*/src` and `tools/` against a ceiling that
# only comes down. Named exceptions carry their reasons in `tools/evergreen-boundary.mjs`; its self-test plants a
# red of each rule and a lawful control (`tools/evergreen-boundary.test.mjs`).
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/evergreen-boundary.mjs
