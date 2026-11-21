#!/usr/bin/env bash
# typecheck-tests-witness — typecheck every package's TESTS, and hold each package's count of test type errors to its
# recorded ceiling (a ratchet), so no new drift lands while the standing drift burns down.
#
# ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
# `pnpm -r typecheck` (and tools/typecheck-witness.sh) read each package's tsconfig.typecheck.json, which extends a
# tsconfig.json that EXCLUDES tests/. Vitest runs the tests through esbuild, which strips types and checks none. So a
# test that drifted from the code it calls (a renamed field, a widened return, a dropped option) still runs and
# typechecks by nothing: measured 2026-11-11, six stale tests slipped past both gates in one day, and the first walk
# of this witness read ~1800 standing errors across ten packages.
#
# Each package carries a `tsconfig.tests.json` (extends its tsconfig.json, includes tests/, rootDir the repo root)
# and a `typecheck:tests` script over it. This witness walks them, `--pretty false` and grep, as typecheck-witness
# does (a coloured tsc writes ANSI escapes inside "error TS", and a grep for the plain form reads clean), and drops
# TS6059 (rootDir), which the path-mapped workspace emits by design.
#
# ── THE RATCHET (the named report-only mode) ────────────────────────────────────────────────────
# tools/typecheck-tests-baseline.json names, per package, the count of test type errors that stood when the gate
# landed. A package ABOVE its ceiling reads red: new drift. A package AT or BELOW reads green and prints its count;
# one below prints the lower number to record (`--write-baseline`), so the ceiling only moves down. A package absent
# from the baseline holds a ceiling of zero. `--strict` reads every error red (the end state: every ceiling zero).
# The count names no order and no time; it measures the drift standing in the tree as of this walk.
#
# Usage: tools/typecheck-tests-witness.sh [--strict] [--write-baseline] [--list]
#   --list            print every error line, not only the counts
#   --write-baseline  rewrite the baseline to the counts this walk read (lowering only; a rise refuses)
#
# Needs a build first (sibling packages resolve through their dist/ exports), as CI's quick job and `pnpm -r typecheck`.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

strict=0; write=0; list=0
for a in "$@"; do
  case "$a" in
    --strict) strict=1 ;;
    --write-baseline) write=1 ;;
    --list) list=1 ;;
    *) echo "typecheck-tests-witness: unknown argument $a" >&2; exit 2 ;;
  esac
done

baseline="tools/typecheck-tests-baseline.json"
ceiling_of() {
  node -e 'const fs=require("fs");let b={};try{b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch{};const v=b.ceilings?.[process.argv[2]];process.stdout.write(String(Number.isSafeInteger(v)?v:0))' "$baseline" "$1"
}

status=0
walked=0
declare -A count_of=()
for dir in packages/*/; do
  pkg=$(basename "$dir")
  [ -f "$dir/tsconfig.tests.json" ] || continue
  walked=$((walked + 1))
  errs=$( (cd "$dir" && npx tsc --noEmit --pretty false -p tsconfig.tests.json 2>&1) | grep "error TS" | grep -v "TS6059" )
  count=$(printf '%s' "$errs" | grep -c . )
  count_of[$pkg]=$count
  ceiling=$(ceiling_of "$pkg")
  if [ "$strict" -eq 1 ]; then ceiling=0; fi
  if [ "$count" -gt "$ceiling" ]; then
    printf '  %-26s %s error(s), ceiling %s: NEW TEST TYPE DRIFT\n' "$pkg" "$count" "$ceiling"
    status=1
  elif [ "$count" -lt "$ceiling" ]; then
    printf '  %-26s %s error(s), ceiling %s: lower the ceiling (--write-baseline)\n' "$pkg" "$count" "$ceiling"
  elif [ "$count" -eq 0 ]; then
    printf '  %-26s ok\n' "$pkg"
  else
    printf '  %-26s %s error(s), at its ceiling\n' "$pkg" "$count"
  fi
  if [ "$list" -eq 1 ] || { [ "$count" -gt "$ceiling" ] && [ "$count" -le 40 ]; }; then
    [ "$count" -gt 0 ] && printf '%s\n' "$errs" | sed 's/^/      /'
  fi
done

# A RUN THAT CHECKED NOTHING MUST NOT READ AS A RUN THAT FOUND NOTHING (typecheck-witness's floor, held here too).
if [ "$walked" -eq 0 ]; then
  echo "typecheck-tests-witness: NO tsconfig.tests.json FOUND under packages/*/ — nothing was checked, so nothing is clean."
  exit 1
fi

if [ "$write" -eq 1 ]; then
  # A baseline that stands only lowers; the first write (no baseline yet) seeds it from this walk.
  if [ "$status" -ne 0 ] && [ -f "$baseline" ]; then echo "typecheck-tests-witness: a ceiling would rise; the baseline only lowers. Fix the new drift first."; exit 1; fi
  status=0
  args=()
  for pkg in "${!count_of[@]}"; do args+=("$pkg=${count_of[$pkg]}"); done
  node -e '
    const fs = require("fs");
    const out = { "//": "Per-package ceilings of test type errors (tools/typecheck-tests-witness.sh). A ceiling only lowers; the end state reads every ceiling 0 and the witness runs --strict.", ceilings: {} };
    for (const kv of process.argv.slice(1).sort()) { const [k, v] = kv.split("="); if (Number(v) > 0) out.ceilings[k] = Number(v); }
    fs.writeFileSync("tools/typecheck-tests-baseline.json", JSON.stringify(out, null, 2) + "\n");
  ' "${args[@]}"
  echo "typecheck-tests-witness: baseline written ($baseline)"
fi

if [ "$status" -eq 0 ]; then
  echo "typecheck-tests-witness: no package rose above its ceiling ($walked project(s) walked$([ "$strict" -eq 1 ] && echo ", strict"))"
fi
exit "$status"
