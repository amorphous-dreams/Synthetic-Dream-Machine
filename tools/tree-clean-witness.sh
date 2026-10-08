#!/usr/bin/env bash
# tree-clean-witness — a run leaves the TRACKED tree's projection ground (`bags/`, `wikis/`) exactly as it found it.
#
# ── WHY ─────────────────────────────────────────────────────────────────────────────────────────
# The bags root resolves REPO-RELATIVE when nothing sites it, so a boot that sets `LAR_ROOT` and leaves
# `LAR_BAGS` unset writes its projections — boot-side pointers included — straight into the tracked tree.
# Nothing in a test's own assertions sees it: the suite goes green and the dirt lands beside it. This
# witness asks the one question that does see it: what did the run add to `git status` under those paths?
#
# Only what the run ADDS counts. Dirt standing before the run is read first and subtracted, so a tree a
# hand is already editing reads the run alone.
#
# ── A ZERO PROVES NOTHING WITHOUT A POSITIVE ───────────────────────────────────────────────────
# `--control` runs a command that plants one file under `bags/` and MUST read red; the witness then removes
# the probe it planted. A witness that reads green on its own control is blind, and says so.
#
# Usage:  tools/tree-clean-witness.sh                 the node e2e config, LAR_BAGS unset (the default run)
#         tools/tree-clean-witness.sh -- <cmd …>     any command, measured the same way
#         tools/tree-clean-witness.sh --control      the known positive: must read red
# Exit:   0 clean · 1 the run dirtied the tree (or the control did not read red) · 2 the run itself failed
set -uo pipefail
cd "$(dirname "$0")/.." || exit 2

PATHS=(bags wikis)
status_now() { git status --porcelain --untracked-files=all -- "${PATHS[@]}" | sort; }

measure() {
  local before after added rc
  before="$(status_now)"
  "$@"
  rc=$?
  after="$(status_now)"
  added="$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after") | sed '/^$/d')"
  if [ -n "$added" ]; then
    echo "[tree-clean-witness] RED — the run added to the tracked tree:" >&2
    printf '%s\n' "$added" | head -40 | sed 's/^/  /' >&2
    return 1
  fi
  [ "$rc" -ne 0 ] && { echo "[tree-clean-witness] the run itself exited $rc (the tree stayed clean)" >&2; return 2; }
  echo "[tree-clean-witness] clean — the run added nothing under ${PATHS[*]}"
  return 0
}

if [ "${1:-}" = "--control" ]; then
  probe="bags/.tree-clean-witness-probe-$$"
  measure sh -c "printf 'probe\n' > '$probe'"
  code=$?
  rm -f "$probe"
  if [ "$code" -eq 1 ]; then echo "[tree-clean-witness] control read red, as it must"; exit 0; fi
  echo "[tree-clean-witness] BLIND — a planted file under bags/ read clean (exit $code)" >&2
  exit 1
fi

if [ "${1:-}" = "--" ]; then
  shift
  measure "$@"
  exit $?
fi

measure env -u LAR_BAGS sh -c 'cd packages/lararium-node && npx vitest run --config vitest.e2e.config.ts'
exit $?
