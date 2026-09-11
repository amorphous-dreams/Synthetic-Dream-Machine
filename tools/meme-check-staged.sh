#!/usr/bin/env bash
# meme-check-staged — refuse a commit that carries a `.mem` whose block check no longer covers its body.
#
# The instrument is `lares meme check`: read alone, write nothing, exit 1 on drift. Two carriers went
# stale under a hand this week with the instrument standing and nothing invoking it at the one moment
# that matters. This runs it over what the commit CARRIES — the staged blobs, never the working tree —
# so a carrier edited after `git add` is judged as the index holds it, which is what the commit records.
#
# The blobs land under a scratch tree that mirrors their paths, and the check runs from inside it, so
# every line it prints names the repo-relative file. The scratch tree is a git tree of its own, so the
# check's dirty-carrier scan reads an empty answer rather than an absent one.
#
# FAIL CLOSED. A missing binary refuses with the build named; a check that cannot run never passes.
# `git commit --no-verify` remains the operator's override, and says so in the refusal.
#
#   install:  git config core.hooksPath .githooks        (`.githooks/pre-commit` execs this script)
#   witness:  tools/meme-check-hook-witness.sh
set -uo pipefail
REPO="$(git rev-parse --show-toplevel)" || exit 1
cd "$REPO" || exit 1
# The binary sits beside THIS script's checkout, never the committing repo's: the same hook gates a
# corpus checkout that carries no build of its own.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LARES="${LARES_BIN:-$HERE/packages/lares-cli/dist/src/bin/lares.js}"

mapfile -d '' STAGED < <(git diff --cached --name-only --diff-filter=ACMR -z -- '*.mem')
[ "${#STAGED[@]}" -eq 0 ] && exit 0

if [ ! -f "$LARES" ]; then
  echo "[meme-check-staged] REFUSED — ${#STAGED[@]} .mem file(s) staged and no built CLI at $LARES" >&2
  echo "  build it (pnpm --filter @lares/cli build), or commit with --no-verify to skip the check." >&2
  exit 1
fi

SCRATCH="$(mktemp -d "${TMPDIR:-/tmp}/meme-check-staged-XXXXXX")" || exit 1
trap 'rm -rf "$SCRATCH"' EXIT
for f in "${STAGED[@]}"; do
  mkdir -p "$SCRATCH/$(dirname "$f")"
  git show ":$f" > "$SCRATCH/$f" || { echo "[meme-check-staged] cannot read the staged blob for $f" >&2; exit 1; }
done
git -C "$SCRATCH" init -q

OUT="$(cd "$SCRATCH" && node "$LARES" meme check "${STAGED[@]}" 2>&1)"
CODE=$?
if [ "$CODE" -eq 0 ]; then
  echo "[meme-check-staged] ${#STAGED[@]} staged carrier(s) canonical"
  exit 0
fi
echo "[meme-check-staged] REFUSED — a staged carrier drifted from canonical form:" >&2
printf '%s\n' "$OUT" | grep -E '^(would normalize|flagged): ' | sed 's/^/  /' >&2
printf '%s\n' "$OUT" | grep -E '^  - ' | sed 's/^/  /' >&2
echo "  re-stamp with: lares meme normalize <file>   then stage it again (or --no-verify to override)." >&2
exit 1
