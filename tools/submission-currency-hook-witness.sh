#!/usr/bin/env bash
# submission-currency-hook-witness — the submission-currency gate, driven in a throwaway repo.
#
# RED first (a source edit staged with no re-projection refuses, naming the pair), then the CONTROL (an
# unrelated `.mem` edit passes silently — the shelf never fires on a commit that never touches it), then
# GREEN (the same edit plus a fresh re-projection passes), then HAND-EDIT (a hand edit staged straight
# to a pair's `.md`, source and meta untouched, refuses as DRIFTED). A closing FAIL-CLOSED step proves
# the missing-binary refusal names the build, matching `meme-check-hook-witness`'s discipline.
#
# The fixture source is the real repo's `bags/lares/ha.ka.ba/lares/api/pono/prism.mem` — the same
# carrier `meme-command.test.ts` already uses as a stable projection fixture — mirrored into the
# throwaway repo under its own declared path so `projectSubmission` resolves it exactly as the real
# shelf does. Runs under `${TMPDIR:-/tmp}`; touches no repo of the operator's. Needs the built CLI.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT="$(pwd)"
HOOK="$REPO_ROOT/tools/submission-currency-staged.sh"
LARES="$REPO_ROOT/packages/lares-cli/dist/src/bin/lares.js"
PRISM_SRC="$REPO_ROOT/bags/lares/ha.ka.ba/lares/api/pono/prism.mem"

FAILED=0
step() { printf '  %-58s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }

if [ ! -f "$LARES" ]; then
  echo "submission-currency-hook-witness: SKIPPED — no built CLI at $LARES (pnpm --filter @lares/cli build)" >&2
  exit 0
fi
if [ ! -f "$PRISM_SRC" ]; then
  echo "submission-currency-hook-witness: SKIPPED — fixture source gone: $PRISM_SRC" >&2
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/submission-currency-hook-witness-XXXXXX")" || exit 1
trap 'rm -rf "$WORK"' EXIT
git -C "$WORK" init -q
git -C "$WORK" config user.email witness@example.invalid
git -C "$WORK" config user.name witness

SRC_DIR="bags/lares/ha.ka.ba/lares/api/pono"
SHELF="bags/lares/ha.ka.ba/lares/api/pono/submissions"
mkdir -p "$WORK/$SRC_DIR" "$WORK/$SHELF"
cp "$PRISM_SRC" "$WORK/$SRC_DIR/prism.mem"
# prism.mem carries a frozen `aka` edge to RFC-2119 — weave PINS it for real (bagsResolver, read-only
# over `--root`), so the throwaway repo needs that target too, or the currency gate's scratch mirror
# (which mirrors only what the real repo's commit involves) never finds it and reads a false DRIFT.
# A real committer's working tree already holds RFC-2119.mem; this mirrors that reality.
RFC2119_SRC="$REPO_ROOT/bags/lares/ha.ka.ba/lares/api/pono/RFC-2119.mem"
[ -f "$RFC2119_SRC" ] && cp "$RFC2119_SRC" "$WORK/$SRC_DIR/RFC-2119.mem"

( cd "$WORK" && node "$LARES" meme project "$SRC_DIR/prism.mem" --to md --out "$SHELF" \
    --title-base lar:///ha.ka.ba/lares/api/pono/submissions >/dev/null 2>&1 )
git -C "$WORK" add "$SRC_DIR/prism.mem" "$SHELF/prism.md" "$SHELF/prism.md.meta"
[ -f "$WORK/$SRC_DIR/RFC-2119.mem" ] && git -C "$WORK" add "$SRC_DIR/RFC-2119.mem"
git -C "$WORK" commit -qm baseline

echo "submission-currency-hook-witness — the gate over staged submission sources and pairs"

step "① RED: a source edit staged, no re-projection → refuses, naming prism"
printf '\n<!-- an edit the shelf pair never saw -->\n' >> "$WORK/$SRC_DIR/prism.mem"
git -C "$WORK" add "$SRC_DIR/prism.mem"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a stale pair"
elif printf '%s' "$OUT" | grep -q 'prism'; then ok
else bad "refused without naming the pair"; printf '%s\n' "$OUT" | tail -6 | sed 's/^/      /'; fi

git -C "$WORK" reset -q -- "$SRC_DIR/prism.mem"

step "② CONTROL: an unrelated .mem edit staged → passes silently"
mkdir -p "$WORK/bags/lares/elsewhere"
echo '<<!DOCTYPE unrelated>>' > "$WORK/bags/lares/elsewhere/other.mem"
git -C "$WORK" add "bags/lares/elsewhere/other.mem"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then
  if [ -z "$OUT" ]; then ok; else bad "passed but was not silent"; printf '%s\n' "$OUT" | sed 's/^/      /'; fi
else bad "fired on a commit that never touches the shelf"; fi
git -C "$WORK" reset -q -- "bags/lares/elsewhere/other.mem"

step "③ GREEN: the source edit plus a fresh re-projection → passes"
( cd "$WORK" && node "$LARES" meme project "$SRC_DIR/prism.mem" --to md --out "$SHELF" \
    --title-base lar:///ha.ka.ba/lares/api/pono/submissions >/dev/null 2>&1 )
git -C "$WORK" add "$SRC_DIR/prism.mem" "$SHELF/prism.md" "$SHELF/prism.md.meta"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then ok; else bad "$?"; printf '%s\n' "$OUT" | tail -6 | sed 's/^/      /'; fi
git -C "$WORK" commit -qm "re-projected"

step "④ HAND-EDIT: a hand edit staged straight to the .md pair → refuses as DRIFTED"
printf '\nan uncalled-for hand edit\n' >> "$WORK/$SHELF/prism.md"
git -C "$WORK" add "$SHELF/prism.md"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a hand-edited pair"
elif printf '%s' "$OUT" | grep -q 'prism' && printf '%s' "$OUT" | grep -qi 'DRIFTED'; then ok
else bad "refused without naming DRIFTED"; printf '%s\n' "$OUT" | tail -6 | sed 's/^/      /'; fi

step "⑤ FAIL-CLOSED: an involved pair staged, no binary → refuses, naming the build"
if OUT=$(cd "$WORK" && LARES_BIN=/nonexistent "$HOOK" 2>&1); then bad "passed with no instrument"
elif printf '%s' "$OUT" | grep -q 'no built CLI'; then ok
else bad "refused without naming the build"; fi
git -C "$WORK" reset -q -- "$SHELF/prism.md"

if [ "$FAILED" -eq 0 ]; then echo "submission-currency-hook-witness: the gate refuses a stale pair, passes a current one, and reads what the commit carries"
else echo "submission-currency-hook-witness: $FAILED check(s) failed"; fi
exit "$FAILED"
