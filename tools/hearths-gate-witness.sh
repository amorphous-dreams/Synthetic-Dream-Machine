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
# ONE HEARTH CANNOT PRODUCE A CROSSING, AND THAT MUST NOT READ AS A GREEN GATE. When the ledger's live
# `holds` fence carries a single row, no path in the tree can cross, so the arming vectors would pass by
# having nothing to refuse — a gate wearing a check it never earned. In that case those vectors run
# against a FIXTURE ledger built from THIS ledger's own rows (every `[[hold]]` block it carries, live and
# closed, gathered into one live fence), which is exactly the shape the tree takes the moment a second
# hearth opens. The script SAYS when it fell back, and the pass-through CONTROLs keep reading the real
# ledger so the header's law still holds for them.
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

# THE GATE'S OWN PARSER ANSWERS BOTH QUESTIONS. A grep over `trailer = "…"` reads the closed fence too and
# would pair a live hearth with a retired one; `parseHolds` reads exactly what the gate reads.
# THE GATE PATH RIDES AN ENV VAR, NEVER `argv[1]`. The gate self-executes on
# `import.meta.url === file://${process.argv[1]}`, so handing it its own path as the first argument makes
# a READ of the module run its `main()` and exit before the reader prints anything.
holds_count() {
  GATE_URL="file://$GATE" LEDGER_FILE="$1" node --input-type=module -e '
    const { parseHolds } = await import(process.env.GATE_URL);
    const { readFileSync } = await import("node:fs");
    // `String(...)`: node inspects a bare number with ANSI colour, and the caller compares it as an integer.
    console.log(String(parseHolds(readFileSync(process.env.LEDGER_FILE, "utf8")).length));
  '
}
trailer_owning() {
  GATE_URL="file://$GATE" LEDGER_FILE="$1" QUERY_PATH="$2" node --input-type=module -e '
    const { parseHolds, hearthsOf } = await import(process.env.GATE_URL);
    const { readFileSync } = await import("node:fs");
    const rows = parseHolds(readFileSync(process.env.LEDGER_FILE, "utf8"));
    console.log((hearthsOf(process.env.QUERY_PATH, rows)[0] || {}).trailer || "");
  '
}

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

cp "$REPO_ROOT/$LEDGER" "$WORK/real-ledger.mem"
# The fixture: every `[[hold]]` block this ledger carries, in one LIVE fence.
{ echo '```toml holds'
  awk '/^```toml holds/ { inf = 1; next } inf && /^```$/ { inf = 0; next } inf' "$REPO_ROOT/$LEDGER"
  echo '```'
} > "$WORK/fixture-ledger.mem"

LIVE_HOLDS="$(holds_count "$REPO_ROOT/$LEDGER")"
if [ "${LIVE_HOLDS:-0}" -ge 2 ]; then
  ARMED_LEDGER="$WORK/real-ledger.mem"; ARMED_WHY="the live ledger ($LIVE_HOLDS holds)"
else
  ARMED_LEDGER="$WORK/fixture-ledger.mem"
  ARMED_WHY="a fixture of this ledger's own rows — the live fence carries $LIVE_HOLDS hold, which can cross nothing"
fi
use_ledger() { cp "$1" "$WORK/$LEDGER"; }

OWNER_A="$(trailer_owning "$ARMED_LEDGER" "$HELD_BY_FOUNDING")"
OWNER_B="$(trailer_owning "$ARMED_LEDGER" "$HELD_BY_MEME")"

stage() { mkdir -p "$WORK/$(dirname "$1")"; date +%s%N > "$WORK/$1"; git -C "$WORK" add "$1" >/dev/null; }
attempt() { git -C "$WORK" commit -F - > "$WORK/out.txt" 2>&1; }

echo "hearths-gate-witness — a commit may not reach into another hearth's ground"
echo "  ledger: $LEDGER"
echo "  arming vectors read: $ARMED_WHY"
echo "  $HELD_BY_FOUNDING → $OWNER_A"
echo "  $HELD_BY_MEME → $OWNER_B"

step "the arming ledger names two DIFFERENT hearths for the two paths"
if [ -n "$OWNER_A" ] && [ -n "$OWNER_B" ] && [ "$OWNER_A" != "$OWNER_B" ]; then ok
else bad "the vectors below would measure nothing: A='$OWNER_A' B='$OWNER_B'"; fi

use_ledger "$ARMED_LEDGER"

step "★ RED: an $OWNER_B commit stages another hearth's file"
stage "$HELD_BY_FOUNDING"
printf 'lar:///a.b.c — a crossing\n\nClaude-Session: https://claude.ai/code/%s\n' "$OWNER_B" | attempt
if [ $? -eq 0 ]; then bad "the gate let the crossing through"
elif grep -q "REFUSED" "$WORK/out.txt" && grep -q "$HELD_BY_FOUNDING" "$WORK/out.txt" && grep -q "$OWNER_A" "$WORK/out.txt"; then ok
else bad "refused without naming the file and the row"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: the SAME file under the HOLDING hearth's trailer passes"
printf 'lar:///a.b.c — the holder writes\n\nClaude-Session: https://claude.ai/code/%s\n' "$OWNER_A" | attempt
if [ $? -eq 0 ]; then ok; else bad "the holding hearth was refused its own ground"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: the committing hearth's OWN ground passes"
stage "$HELD_BY_MEME"
printf 'lar:///a.b.c — own ground\n\nClaude-Session: https://claude.ai/code/%s\n' "$OWNER_B" | attempt
if [ $? -eq 0 ]; then ok; else bad "own ground refused"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: a nonsense trailer owns nothing — every held path reads as a crossing"
stage "$HELD_BY_MEME"
printf 'lar:///a.b.c — a stranger\n\nClaude-Session: https://claude.ai/code/session_NOBODYHOLDSTHIS\n' | attempt
if [ $? -eq 0 ]; then bad "a stranger wrote a held file unchallenged"
elif grep -q "REFUSED" "$WORK/out.txt"; then ok
else bad "refused for the wrong reason"; sed 's/^/      /' "$WORK/out.txt" | head -6; fi

# THE LEDGER BELONGS TO NO HEARTH — a hold that reached it would refuse the hand owing a crossing row,
# and the ledger's own law demands that row BEFORE the hand starts. These vectors read a fixture where a
# hearth claims the docs ground (the natural claim to make), because the live fence claims it today by
# nobody and a vector over that proves only the accident.
sed 's|^  "packages/lares-cli/src/commands/persona.ts",|  "packages/lares-cli/src/commands/persona.ts",\n  "bags/lares/ha.ka.ba/lares/docs/pono/**",|' \
  "$WORK/fixture-ledger.mem" > "$WORK/claimed-ledger.mem"
use_ledger "$WORK/claimed-ledger.mem"

step "★ RED-TURNED-GREEN: a FOREIGN hearth writes its own crossing row into the claimed ledger"
stage "$LEDGER"
printf 'lar:///a.b.c — a crossing row\n\nClaude-Session: https://claude.ai/code/session_SECONDHEARTHWRITES\n' | attempt
if [ $? -eq 0 ]; then ok
else bad "the ledger refused the hand its own law sends to it — the carve-out in hearthsOf is gone"
     sed 's/^/      /' "$WORK/out.txt" | head -8; fi

# `stage` writes a timestamp over whatever it names, so the vector above left the work tree's ledger
# unparseable — and an unparseable ledger stands the gate DOWN, which would pass every vector below by
# having nothing to refuse. Re-seat it. (The control beneath caught exactly this when it was missing.)
use_ledger "$WORK/claimed-ledger.mem"

step "CONTROL: the carve-out frees the LEDGER ALONE — a sibling under the same glob still refuses"
stage "bags/lares/ha.ka.ba/lares/docs/pono/otakiage.mem"
printf 'lar:///a.b.c — a neighbour\n\nClaude-Session: https://claude.ai/code/session_SECONDHEARTHWRITES\n' | attempt
if [ $? -eq 0 ]; then bad "the carve-out widened past the ledger — every docs/pono path now passes"
elif grep -q "REFUSED" "$WORK/out.txt"; then ok
else bad "refused for the wrong reason"; sed 's/^/      /' "$WORK/out.txt" | head -6; fi

# THE PASS-THROUGH CONTROLS READ THE REAL LEDGER. They assert what the gate does to a commit it must NOT
# refuse, and that answer must come off the rows the tree actually stands on, single hearth or not.
use_ledger "$WORK/real-ledger.mem"
LIVE_OWNER="$(trailer_owning "$WORK/real-ledger.mem" "$HELD_BY_FOUNDING")"

step "CONTROL: a commit with NO trailer passes, with a printed note"
stage "$HELD_BY_FOUNDING"
printf 'the operator writes, carrying no trailer\n' | attempt
if [ $? -ne 0 ]; then bad "a trailer-less commit was refused"; sed 's/^/      /' "$WORK/out.txt" | head -8
elif grep -q "no \`Claude-Session:\` trailer" "$WORK/out.txt"; then ok
else bad "passed without the note"; sed 's/^/      /' "$WORK/out.txt" | head -4; fi

step "CONTROL: a path NO hold names passes"
stage "$UNHELD"
printf 'lar:///a.b.c — unheld ground\n\nClaude-Session: https://claude.ai/code/%s\n' "${LIVE_OWNER:-session_NOBODYHOLDSTHIS}" | attempt
if [ $? -eq 0 ]; then ok; else bad "unheld ground refused"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

step "CONTROL: a live hearth writes its OWN ground on the real ledger"
stage "$HELD_BY_FOUNDING"
printf 'lar:///a.b.c — the live hearth writes\n\nClaude-Session: https://claude.ai/code/%s\n' "$LIVE_OWNER" | attempt
if [ $? -eq 0 ]; then ok; else bad "the standing hearth was refused its own ground"; sed 's/^/      /' "$WORK/out.txt" | head -8; fi

echo
if [ "$FAILED" -eq 0 ]; then printf '\033[32mhearths-gate-witness: all vectors stand\033[0m\n'; exit 0; fi
printf '\033[31mhearths-gate-witness: %d vector(s) failed\033[0m\n' "$FAILED"; exit 1
