#!/usr/bin/env bash
# pre-commit-hook-witness — the HOOK's own absent-gate branch, driven in a throwaway repo.
#
# `meme-check-hook-witness.sh` drives `tools/meme-check-staged.sh` directly; it never exercises
# `.githooks/pre-commit`'s `run_gate`, and it reads the deletion only post hoc (in witness-all or CI),
# after a stale carrier has already committed. This witness drives the HOOK itself, over a tree that
# carries NO `tools/` gate scripts at all, so the hook's own "the gate does not apply here" branch is
# the thing under test.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT="$(pwd)"
HOOK="$REPO_ROOT/.githooks/pre-commit"

FAILED=0
step() { printf '  %-58s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/pre-commit-hook-witness-XXXXXX")" || exit 1
trap 'rm -rf "$WORK"' EXIT
git -C "$WORK" init -q
git -C "$WORK" config user.email witness@example.invalid
git -C "$WORK" config user.name witness
mkdir -p "$WORK/bags/t"
echo '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>' > "$WORK/bags/t/stale.mem"

echo "pre-commit-hook-witness — the hook's own absent-gate branch, no tools/ present at all"

step "① RED: a staged .mem, NO tools/ dir at all → the hook refuses"
git -C "$WORK" add bags/t/stale.mem
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a staged .mem with the gate script absent"
elif printf '%s' "$OUT" | grep -q 'meme-check-staged.sh is absent'; then ok
else bad "refused without naming the absent gate"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step "② CONTROL: no staged .mem, NO tools/ dir → the hook passes"
git -C "$WORK" reset -q
echo hello > "$WORK/note.txt"
git -C "$WORK" add note.txt
if (cd "$WORK" && "$HOOK" >/dev/null 2>&1); then ok; else bad "refused with nothing .mem staged"; fi

step "③ a staged git-rm of the gate script, beside a staged .mem → refuses (reads the index)"
mkdir -p "$WORK/tools"
printf '#!/usr/bin/env sh\nexit 0\n' > "$WORK/tools/meme-check-staged.sh"
chmod +x "$WORK/tools/meme-check-staged.sh"
git -C "$WORK" add tools/meme-check-staged.sh bags/t/stale.mem
git -C "$WORK" commit -qm seed
git -C "$WORK" rm -q --cached tools/meme-check-staged.sh
echo "! an edit" >> "$WORK/bags/t/stale.mem"
git -C "$WORK" add bags/t/stale.mem
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a staged removal of the gate (read the working tree, not the index)"
elif printf '%s' "$OUT" | grep -q 'meme-check-staged.sh is absent'; then ok
else bad "refused for another reason"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step "④ RED (L7): a staged submission source, NO submission-currency-staged.sh at all → the hook refuses"
git -C "$WORK" reset -q --hard
SHELF="$WORK/bags/lares/ha.ka.ba/lares/api/pono/submissions"
mkdir -p "$SHELF" "$WORK/bags/lares/ha.ka.ba/lares/scratch"
printf 'source: lar:///ha.ka.ba/lares/scratch/witness-source\n' > "$SHELF/witness.md.meta"
echo "# witness pair" > "$SHELF/witness.md"
echo '<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>' \
  > "$WORK/bags/lares/ha.ka.ba/lares/scratch/witness-source.mem"
git -C "$WORK" add "$SHELF/witness.md" "$SHELF/witness.md.meta" "$WORK/bags/lares/ha.ka.ba/lares/scratch/witness-source.mem"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a staged submission source/pair with the gate script absent"
elif printf '%s' "$OUT" | grep -q 'submission-currency-staged.sh is absent'; then ok
else bad "refused without naming the absent gate"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step "⑤ CONTROL (L7): no staged submission source/pair → the hook passes the submission gate"
git -C "$WORK" reset -q
echo hello2 > "$WORK/note2.txt"
git -C "$WORK" add note2.txt
if (cd "$WORK" && "$HOOK" >/dev/null 2>&1); then ok; else bad "refused with no submission source/pair staged"; fi

if [ "$FAILED" -eq 0 ]; then echo "pre-commit-hook-witness: the hook refuses a staged .mem or submission source/pair with its matching gate absent, and passes a staging that touches neither"
else echo "pre-commit-hook-witness: $FAILED check(s) failed"; fi
exit "$FAILED"
