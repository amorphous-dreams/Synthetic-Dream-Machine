#!/usr/bin/env bash
# test-reads-source-witness — test files that read production source text (`packages/*/src` or `.mem` canon prose as
# strings, asserting on the letters) stand on a checked-in allowlist that only shrinks: a new reader fails, a listed file
# that stopped reading fails until its row leaves. The rule and the tools/ config exemption live in
# `tools/test-reads-source.mjs`; its self-test plants a red and a lawful control (`tools/test-reads-source.test.mjs`).
set -uo pipefail
cd "$(dirname "$0")/.."
node tools/test-reads-source.mjs
exit $?
