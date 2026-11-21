#!/usr/bin/env bash
# law-mutants-witness — the CLI's laws kill every named mutant (packages/lares-cli/tests/laws/mutants.json).
#
# A suite that reads green proves its cases pass; it never proves they could fail. Each named mutant
# breaks one decision the laws guard, and the laws must read red against it. A mutant whose find text
# the source does not hold reads STALE, so a refactor that moves the code moves the catalog with it.
#
# Usage:  tools/law-mutants-witness.sh
# Exit:   0 every mutant killed · 1 a mutant survived, a mutant went stale, or the clean source reads red
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
node tools/law-mutants.mjs packages/lares-cli vitest.law-mutants.config.ts
