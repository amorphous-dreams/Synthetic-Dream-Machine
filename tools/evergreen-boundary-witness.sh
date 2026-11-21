#!/usr/bin/env bash
# evergreen-boundary-witness — authored version fields, clock readings that flow into ids, gates and durable
# fields, comments that narrate history, and readings that recognize an old shape or name an older peer's build, each
# counted in `packages/*/src` and `tools/` against a ceiling that
# only comes down. More classes count the places a past shape lingers: tests that name the house's earlier
# shape, `onupgradeneeded` bodies that delete, history words and dated history lines in live canon, and authored dates in a live canon meta. Named exceptions carry their reasons
# in `tools/evergreen-boundary.mjs`; its self-test plants a red of each rule and a lawful control
# (`tools/evergreen-boundary.test.mjs`).
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/evergreen-boundary.mjs
rc=$?
if [ "$rc" -ne 0 ]; then
  echo 'pono: state what stands without narration, history or a version literal, or lower the ceiling when a burn shrinks the count'
fi
exit "$rc"
