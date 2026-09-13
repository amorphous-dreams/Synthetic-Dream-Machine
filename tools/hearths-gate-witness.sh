#!/usr/bin/env bash
# hearths-gate-witness — the cross-hearth gate, driven in a throwaway repo. Red first, then the CONTROLs.
#
# A gate only ever shown passing is no gate, so the CROSSING goes first: a commit trailing one hearth's
# session that stages a file another hearth holds, and the gate must refuse naming the row. Then the
# CONTROLs: the SAME file under the HOLDING hearth's trailer passes; a commit carrying NO trailer passes
# with a note (the operator's own commits carry none); a path no hold names passes silently.
#
# The ledger under test is the real one — a witness against a fixture ledger proves the parser and not
# the rows the tree actually stands on.
#
# Runs under `${TMPDIR:-/tmp}`; touches no repo of the operator's.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT="$(pwd)"
GATE="$REPO_ROOT/tools/hearths-gate.mjs"
LEDGER="bags/lares/ha.ka.ba/lares/docs/pono/hearths.mem"

FAILED=0
step() { printf '  %-62s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }

[ -f "$REPO_ROOT/$LEDGER" ] || { echo "hearths-gate-witness: no ledger at $LEDGER" >&2; exit 1; }

MEME_TRAILER="$(grep -oE 'trailer = "[^"]+"' "$REPO_ROOT/$LEDGER" | sed -n '1s/.*"\(.*\)"/\1/p')"
FOUND_TRAILER="$(grep -oE 'trailer = "[^"]+"' "$REPO_ROOT/$LEDGER" | sed -n '2s/.*"\(.*\)"/\1/p')"
HELD_BY_FOUNDING="packages/lararium-mesh/src/handle-kel.ts"
HELD_BY_MEME="tests/harness/instance.ts"
UNHELD="tools/a-path-no-hold-names.txt"

WORK="$(mktemp -d "${TMPDIR:-/tmp}/hearths-gate-witness-XXXXXX")" || exit 1
trap 'rm -rf "$WORK"' EXIT
git -C "$WORK" init -q
git -C "$WORK" config user.email witness@example.invalid
git -C "$WORK" config user.name witness
# ONLY the commit-msg hook installs here: the pre-commit gate resolves its own script through the
# COMMITTING repo's toplevel, so a throwaway repo would make it exec a path that does not exist and the
# red would read as this gate refusing when nothing of this gate ever ran.
mkdir -p "$WORK/.hooks"
printf '#!/usr/bin/env sh\nexec node "%s" "$1"\n' "$GATE" > "$WORK/.hooks/commit-msg"
chmod +x "$WORK/.hooks/commit-msg"
git -C "$WORK" config core.hooksPath "$WORK/.hooks"
mkdir -p "$WORK/$(dirname "$LEDGER")"
cp "$REPO_ROOT/$LEDGER" "$WORK/$LEDGER"
git -C "$WORK" add -A >/dev/null
git -C "$WORK" commit -q -m "seed the ledger" --no-verify

stage() { mkdir -p "$WORK/$(dirname "$1")"; date +%s%N > "$WORK/$1"; git -C "$WORK" add "$1" >/dev/null; }
attempt() { git -C "$WORK" commit -F - > "$WORK/out.txt" 2>&1; }

echo "hearths-gate-witness — a commit may not reach into another hearth's ground"
echo "  ledger: $LEDGER   ($MEME_TRAILER · $FOUND_TRAILER)"

step "★ RED: a $MEME_TRAILER commit stages the founding hearth's file"
stage "$HELD_BY_FOUNDING"
printf 'lar:///a.b.c — a crossing\n\nClaude-Session: https://claude.ai/code/%s\n' "$MEME_TRAILER" | attempt
if [ $? -eq 0 ]; then bad "the gate let the crossing through"
elif grep -q "REFUSED" "$WORK/out.txt" && grep -q "$HELD_BY_FOUNDING" "$WORK/out.txt" && grep -q "$FOUND_TRAILER" "$WORK/out.txt"; then ok
else bad "refused without naming the file and the row"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: the SAME file under the HOLDING hearth's trailer passes"
printf 'lar:///a.b.c — the holder writes\n\nClaude-Session: https://claude.ai/code/%s\n' "$FOUND_TRAILER" | attempt
if [ $? -eq 0 ]; then ok; else bad "the holding hearth was refused its own ground"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: a commit with NO trailer passes, with a printed note"
stage "$HELD_BY_FOUNDING"
printf 'the operator writes, carrying no trailer\n' | attempt
if [ $? -ne 0 ]; then bad "a trailer-less commit was refused"; sed 's/^/      /' "$WORK/out.txt" | head -8
elif grep -q "no \`Claude-Session:\` trailer" "$WORK/out.txt"; then ok
else bad "passed without the note"; sed 's/^/      /' "$WORK/out.txt" | head -4; fi

step "CONTROL: a path NO hold names passes"
stage "$UNHELD"
printf 'lar:///a.b.c — unheld ground\n\nClaude-Session: https://claude.ai/code/%s\n' "$MEME_TRAILER" | attempt
if [ $? -eq 0 ]; then ok; else bad "unheld ground refused"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: the committing hearth's OWN ground passes"
stage "$HELD_BY_MEME"
printf 'lar:///a.b.c — own ground\n\nClaude-Session: https://claude.ai/code/%s\n' "$MEME_TRAILER" | attempt
if [ $? -eq 0 ]; then ok; else bad "own ground refused"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: a nonsense trailer owns nothing — every held path reads as a crossing"
stage "$HELD_BY_MEME"
printf 'lar:///a.b.c — a stranger\n\nClaude-Session: https://claude.ai/code/session_NOBODYHOLDSTHIS\n' | attempt
if [ $? -eq 0 ]; then bad "a stranger wrote a held file unchallenged"
elif grep -q "REFUSED" "$WORK/out.txt"; then ok
else bad "refused for the wrong reason"; sed 's/^/      /' "$WORK/out.txt" | head -6; fi

echo
if [ "$FAILED" -eq 0 ]; then printf '\033[32mhearths-gate-witness: all vectors stand\033[0m\n'; exit 0; fi
printf '\033[31mhearths-gate-witness: %d vector(s) failed\033[0m\n' "$FAILED"; exit 1
