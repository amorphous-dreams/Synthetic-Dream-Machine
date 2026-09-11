#!/usr/bin/env bash
# meme-check-hook-witness — the pre-commit gate, driven in a throwaway repo. Red first, then green.
#
# A hook only ever shown passing is no gate, so the STALE carrier goes first: a body edited after its
# check was stamped, staged, and the hook must refuse naming the file. Then the CONTROL: the same
# carrier re-stamped canonical, staged, and the hook must pass. A third staging holds the stale bytes
# in the INDEX while the working tree holds canonical ones, so the hook proves it reads what the commit
# carries and not what sits on disk. A `.mem`-free staging passes without opening the binary at all.
#
# Runs under `${TMPDIR:-/tmp}`; touches no repo of the operator's. Needs the built CLI.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT="$(pwd)"
HOOK="$REPO_ROOT/tools/meme-check-staged.sh"
LARES="$REPO_ROOT/packages/lares-cli/dist/src/bin/lares.js"

FAILED=0
step() { printf '  %-58s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }

if [ ! -f "$LARES" ]; then
  echo "meme-check-hook-witness: SKIPPED — no built CLI at $LARES (pnpm --filter @lares/cli build)" >&2
  exit 0
fi

WORK="$(mktemp -d "${TMPDIR:-/tmp}/meme-check-hook-witness-XXXXXX")" || exit 1
trap 'rm -rf "$WORK"' EXIT
git -C "$WORK" init -q
git -C "$WORK" config user.email witness@example.invalid
git -C "$WORK" config user.name witness
mkdir -p "$WORK/bags/t"

# A carrier whose check does NOT cover its body — the stamp is a placeholder the normalize law will replace.
# A carrier is whatever DECLARES itself, and this script declares nothing: the declaration assembles at run
# time and every fixture line rides behind a tab the `<<-` heredoc strips — the corpus walk reads column-zero
# declarations, never paths.
DECL='<<!DOC''TYPE memetic-wikitext+tiddlywiki lar:///ha.ka.ba/lares/api/pono/memetic-wikitext>>'
{ printf '%s\n\n' "$DECL"; cat <<-'MEM'; } > "$WORK/bags/t/stale.mem"
	<<^ code="&#x0001;" from="?" -> to="lar:///t/witness/hook">>
	```toml meta
	uri-path = "t/witness/hook"
	```

	<<^ code="&#x0002;">>

	<<~ ahu #/a>>

	! a

	<<~/ahu>>

	<<^ code="&#x0003;">>ni:///sha-256;AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA

	<<^ code="&#x0004;" -> to="?">>
	MEM

echo "meme-check-hook-witness — the gate over staged carriers"

step "① a STALE carrier staged → the hook refuses, naming the file"
git -C "$WORK" add bags/t/stale.mem
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "passed a stale check"
elif printf '%s' "$OUT" | grep -q 'would normalize: bags/t/stale.mem'; then ok
else bad "refused without naming the file"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step "② CONTROL: the carrier re-stamped canonical, staged → the hook passes"
( cd "$WORK" && node "$LARES" meme normalize bags/t/stale.mem >/dev/null 2>&1 )
git -C "$WORK" add bags/t/stale.mem
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then ok; else bad "$?"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step "③ the INDEX holds stale bytes, the tree holds canonical → refuses (reads the index)"
git -C "$WORK" commit -qm canonical
cp "$WORK/bags/t/stale.mem" "$WORK/canonical.bak"
sed -i 's/^! a$/! a edited/' "$WORK/bags/t/stale.mem"
git -C "$WORK" add bags/t/stale.mem
cp "$WORK/canonical.bak" "$WORK/bags/t/stale.mem"
if OUT=$(cd "$WORK" && "$HOOK" 2>&1); then bad "judged the working tree, not the index"
elif printf '%s' "$OUT" | grep -q 'would normalize: bags/t/stale.mem'; then ok
else bad "refused for another reason"; printf '%s\n' "$OUT" | tail -5 | sed 's/^/      /'; fi

step '④ nothing .mem staged → passes without the binary'
git -C "$WORK" reset -q
echo hello > "$WORK/note.txt"
git -C "$WORK" add note.txt
if (cd "$WORK" && LARES_BIN=/nonexistent "$HOOK" >/dev/null 2>&1); then ok; else bad "refused with no carrier staged"; fi

step "⑤ a carrier staged and NO binary → refuses (fail closed), naming the build"
git -C "$WORK" add bags/t/stale.mem
sed -i 's/^! a$/! a again/' "$WORK/bags/t/stale.mem"; git -C "$WORK" add bags/t/stale.mem
if OUT=$(cd "$WORK" && LARES_BIN=/nonexistent "$HOOK" 2>&1); then bad "passed with no instrument"
elif printf '%s' "$OUT" | grep -q 'no built CLI'; then ok
else bad "refused without naming the build"; fi

if [ "$FAILED" -eq 0 ]; then echo "meme-check-hook-witness: the gate refuses a stale check, passes a canonical one, and reads the index"
else echo "meme-check-hook-witness: $FAILED check(s) failed"; fi
exit "$FAILED"
