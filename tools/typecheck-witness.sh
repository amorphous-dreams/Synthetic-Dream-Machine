#!/usr/bin/env bash
# typecheck-witness — report every package's REAL type errors, and exit non-zero if any stand.
#
# ── WHY THIS EXISTS ─────────────────────────────────────────────────────────────────────────────
# `tsc` colorizes by default, so its output carries ANSI escapes BETWEEN the word "error" and the
# code: the literal bytes read `error\033[0m\033[90m TS2741`. A reader grepping for "error TS" —
# the obvious thing to grep for — matches NOTHING, and a package with two dozen real errors reports
# clean. The silence is indistinguishable from success, which makes it the worst kind of check: one
# that answers confidently and answers wrong.
#
# So this passes `--pretty false` and greps the plain form. It also drops TS6059 ("not under
# rootDir"), which every package emits by design: they resolve siblings through path mappings into
# source, and that arrangement is the monorepo's, not a fault in the code being checked.
#
# Run it rather than a hand-rolled grep. A check worth trusting is one whose failure mode you have
# seen fail.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

status=0
walked=0
# `tests/` is a workspace project too (the e2e harness); a witness that walks packages/* alone typechecks
# the suites by nothing.
for dir in packages/*/ tests/; do
  pkg=$(basename "$dir")
  [ -f "$dir/tsconfig.json" ] || continue
  walked=$((walked + 1))
  cfg="tsconfig.json"
  [ -f "$dir/tsconfig.typecheck.json" ] && cfg="tsconfig.typecheck.json"

  output=$(cd "$dir" && npx tsc --noEmit --pretty false -p "$cfg" 2>&1)
  compiler_status=$?
  rootdir_line='^([^[:cntrl:]]+\([0-9]+,[0-9]+\): )?error TS6059:'
  errs=$(printf '%s\n' "$output" | grep "error TS" | grep -Ev "$rootdir_line")
  count=$(printf '%s' "$errs" | grep -c . )
  rootdir_diagnostics=$(printf '%s\n' "$output" | grep -E "$rootdir_line")
  unexpected=$(printf '%s\n' "$output" | grep -Ev "$rootdir_line" | grep '[^[:space:]]')
  other_diagnostics=$(printf '%s\n' "$output" | grep -o 'error TS[0-9]\+' | grep -v '^error TS6059$')

  # A nonzero compiler exit is clean only when every nonblank output line is a TS6059 diagnostic.
  if [ "$compiler_status" -ne 0 ] && { [ -z "$rootdir_diagnostics" ] || [ -n "$unexpected" ] || [ -n "$other_diagnostics" ]; }; then
    printf '  %-22s compiler failed (exit %s) outside TS6059\n' "$pkg" "$compiler_status"
    printf '%s\n' "$output" | sed 's/^/      /'
    status=1
  elif [ "$count" -eq 0 ]; then
    printf '  %-22s ok\n' "$pkg"
  else
    printf '  %-22s %s error(s)\n' "$pkg" "$count"
    printf '%s\n' "$errs" | sed 's/^/      /'
    status=1
  fi
done

# ── A RUN THAT CHECKED NOTHING MUST NOT READ AS A RUN THAT FOUND NOTHING ────────────────────────
# This line stood as a COMMENT alone. The loop `continue`s past any directory carrying no
# `tsconfig.json`, so a glob that matched nothing — packages moved, the script run from another cwd,
# the workspace re-laid — walked zero projects, left `status` at 0, and printed `every package clean`.
# The header stated the law and the code never held it, which is the worse of the two failures: a
# reader who checks the comment is told the floor stands.
#
# THE FLOOR IS ON THE SET, ASSERTED BEFORE ANYTHING IS ASSERTED ABOUT ITS MEMBERS. It counts the
# projects actually entered, and the count PRINTS, so "clean" always arrives with its subject's size.
if [ "$walked" -eq 0 ]; then
  echo "typecheck-witness: NO TYPECHECKABLE PROJECT FOUND — nothing was checked, so nothing is clean."
  echo "  It walks \`packages/*/\` and \`tests/\` for a tsconfig.json, from the repo root."
  exit 1
fi

[ "$status" -eq 0 ] && echo "typecheck-witness: every package clean ($walked project(s) walked)"
exit "$status"
