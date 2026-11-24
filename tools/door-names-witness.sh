#!/usr/bin/env bash
# door-names-witness — every `lares …` command the house writes (a refusal, a hand-act line, a doc comment, a shell
# script, a canon meme) names a door the BUILT CLI answers, read against each row's own verb table; and every door a row
# declares to take arguments branches on no sub-verb. The rule and its roots live in `tools/door-names.mjs`; its
# self-test plants reds and lawful controls on text in memory (`tools/door-names.test.mjs`).
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/door-names.mjs
exit $?
