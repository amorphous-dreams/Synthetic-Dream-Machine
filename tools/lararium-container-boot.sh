#!/bin/sh
# lararium-container-boot — found THIS container's OWN Lararium, then serve. Per the per-vessel
# identity model, each vessel mints its own identity (separate from the operator identity), so a
# containerized Lararium founds its own (own vessel key + operator + binding edge) into its own
# volume — an independent sovereign hearth. The product image carries the engine island and the
# compiled CLI; this root gets its own genesis copy so `lares vessel found` can read the CID.
set -e
: "${LAR_ROOT:?LAR_ROOT must be set}"

mkdir -p "$LAR_ROOT/genesis"
cp /app/genesis/seed.json "$LAR_ROOT/genesis/" 2>/dev/null || true
cp -r /app/genesis/cas  "$LAR_ROOT/genesis/" 2>/dev/null || true   # the CAS substrate (engine/plugin blobs by CID — re-genesis)
# The genesis seed carries the ISLAND ALONE. The social bootstrap — one vessel's address book — lives
# in that vessel's own store (<lares>/vessel), so no copy of a seed can hand a container someone
# else's identity. Each container founds its own below.
#
# THE STORE SITES BY HOUSE, NOT BY KIND. Under LAR_ROOT each directory names an XDG kind — data, state,
# cache, config, run — and the two houses nest inside the data kind exactly as they do under XDG, so the
# spirits' substrate stands at `<root>/data/lares/vessel` beside the house's `<root>/data/lararium`.
# A probe reading one segment short finds nothing and re-founds a container that already stands.

# THE CARD OF A STAGED HEARTH. On a staged root the founding's read-back stands in, and its JSON answer carries the
# seed card's code; a quorum this boot grows reveals it to roll the charter. Test roots alone: a live card never
# rests anywhere but on its paper, and an attached founding prints it on the terminal for a person to keep.
_card=""
_json_line() { node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const l=s.split("\n").filter((x)=>x.startsWith("{")).pop();process.stdout.write(l??"")})'; }
_card_of() { node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).data.cards[0].code??""))}catch{}})'; }

_bootstrap="$LAR_ROOT/data/lares/vessel/social-bootstrap.json"
# A HEARTH WHOSE FOUNDING STOPPED RESUMES. A place that stands with no face lit, under LAR_STAND_FACE, runs the
# Stable founding act again: the act skips what stands (the place, a seed charter it already seated) and completes.
_resume=""
if [ -f "$_bootstrap" ] && [ -n "${LAR_STAND_FACE:-}" ] && ! grep -q 'persona-group/group-id' "$_bootstrap"; then _resume=yes; fi

if [ ! -f "$_bootstrap" ] || [ -n "$_resume" ]; then
  echo "[boot] founding this container's own Lararium (own vessel identity)…"
  # --skip-build uses the CLI and daemon already compiled into the product image.
  #
  # THE HUMAN ROUTE. A founding seals custody from birth and gathers its route (a passphrase or a paper pin) from a
  # TTY ALONE: no flag and no env var carries one. Two shapes reach this line.
  #   · ATTACHED (`docker compose run --rm -it <service>`): the CLI prompts on the terminal, and a hearth's card
  #     prints there and reads back there.
  #   · A DISPOSABLE TEST HARNESS (the mesh scenarios, the rehearsal): the compose file declares the root scratch with
  #     LAR_STAGE_DIR, and the existing test door founds the custody under a fixed test passphrase first. The door
  #     refuses any root without the staging marker (`.lar-test-scratch`), which this boot writes only under LAR_STAGE_DIR.
  # Neither shape standing, the founding below refuses BY NAME (CredentialTtyRefusal) and says how to run it attached.
  if [ -n "${LAR_STAGE_DIR:-}" ] && [ -z "$_resume" ]; then
    node tools/test-scratch-marker.mjs "$LAR_ROOT"
    node tools/seed-test-custody.mjs "$LAR_ROOT"
  fi
  # A HEARTH FOUNDS BY THE STABLE FOUNDING ACT. `LAR_STAND_FACE` names persona zero: the act stands the place, the
  # face's root, its one-seat PRIVATE seed charter (the seat's own key, its next key on a card read back) and the
  # face that binds the charter's AID, in one act. A Herm container leaves it unset on purpose: a place with no face
  # IS its standing (Lares Viales). The face lifts peerless: every doc it mints lives on local disk, and with
  # LAR_PEERS set the repo reaches for peers that have not yet stood.
  if [ -n "${LAR_STAND_FACE:-}" ]; then
    echo "[boot] founding the hearth '${LAR_STAND_FACE}' by the Stable founding act…"
    if [ -n "${LAR_STAGE_DIR:-}" ]; then
      # A staged root: the read-back stands in, and the JSON answer carries the card's code for the roll below.
      _out="$(LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js vessel found --hearth --name "$LAR_STAND_FACE" --skip-build --json)" \
        || { echo "$_out"; echo "[boot] the hearth did NOT found (see above) — serving as a place, at the waking floor"; }
      _card="$(printf '%s\n' "$_out" | _json_line | _card_of)"
    else
      # A live root: the card prints on this terminal and reads back there, and no answer carries its code.
      LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js vessel found --hearth --name "$LAR_STAND_FACE" --skip-build \
        || echo "[boot] the hearth did NOT found (see above) — serving as a place, at the waking floor"
    fi
  else
    node packages/lares-cli/dist/src/bin/lares.js vessel found --skip-build
  fi

  # A HEARTH THAT CARRIES IS NOT YET A HEARTH THAT TENDS. `LAR_STAND_KAHU` names the chairs' Handles,
  # comma-separated: persona zero takes the first (its seed chair stays its own), each later one stands on a face of
  # its own (h1, h2, …), and the seed card reveals so `seal rotate` rolls the seed charter to every chair that
  # stands, under a majority rule. The AID the founding
  # minted stays the hearth's name: a roll moves the seats and never the Nexus. This runs ONCE, at the founding
  # that printed the card; a later boot finds the roster rolled and seats nothing.
  if [ -n "${LAR_STAND_KAHU:-}" ]; then
    if [ -z "$_card" ]; then
      echo "[boot] ⚠ LAR_STAND_KAHU asks for chairs, and no seed card stands in this boot's hand (an attached founding"
      echo "[boot] ⚠ keeps its card on paper): roll the charter by hand, \`lares nexus seal rotate\`, with the card."
    else
      echo "[boot] growing the seed charter to the founding kahu: ${LAR_STAND_KAHU}"
      _i=0
      # `printf '%s'` ENDS WITHOUT A NEWLINE, and `while read` returns false on a final unterminated line after
      # assigning it — so the last chair silently never stood. Each line ends here.
      printf '%s\n' "$LAR_STAND_KAHU" | tr ',' '\n' | while IFS= read -r _handle; do
        [ -z "$_handle" ] && continue
        _label="kahu-$_i"; [ "$_i" -eq 0 ] && _label="$LAR_STAND_FACE"
        LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js persona new "$_i" \
          --name "$_label" --handle "$_handle" --seat \
          || echo "[boot] kahu $_i ('$_handle') did NOT stand — the roster will read short"
        _i=$((_i + 1))
      done
      _chairs=$(printf '%s\n' "$LAR_STAND_KAHU" | tr ',' '\n' | grep -c .)
      LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js nexus seal rotate --cold-key "$_card" --threshold $(( _chairs / 2 + 1 )) \
        || echo "[boot] the seed charter did NOT roll (see above) — this hearth tends under its one seed seat"
    fi
  fi
  # A staged hearth whose card no roll took prints it for the harness that may roll it later (test roots alone).
  if [ -n "${LAR_STAGE_DIR:-}" ] && [ -n "$_card" ] && [ -z "${LAR_STAND_KAHU:-}" ]; then
    echo "[boot] staged seed card: $_card"
  fi
  _card=""
fi

# A VESSEL STANDS HOLDING NO KEY, and only a TTY opens one. A DISPOSABLE TEST HARNESS (LAR_STAGE_DIR: the mesh
# scenarios, the rehearsal) has no TTY, so its staged root unlocks through the test door, which refuses any root
# without the staging marker this boot wrote above. The door waits in the background for the daemon to answer and
# sends the unlock frame once; an unstaged container stays at the floor until a person runs `lares vault unlock`.
if [ -n "${LAR_STAGE_DIR:-}" ]; then
  (
    _n=0
    while [ "$_n" -lt 600 ]; do
      # THE CODE IS READ, NEVER OBEYED. This script runs under `set -e`, and a bare failing command ends the
      # subshell at its first non-zero exit: a door that ran before the daemon's socket stood (rc 3) ended the
      # loop it was meant to continue, printed nothing, and left the vessel at the floor for the whole run.
      # The `&&`/`||` list keeps the exit code as a value this loop reads.
      node tools/unlock-test-custody.mjs "$LAR_ROOT" >/dev/null 2>&1 && _rc=0 || _rc=$?
      # rc 3 = no daemon answers yet; any other code settles it (0 opened, 1 the daemon said otherwise, 2 unmarked).
      if [ "$_rc" -ne 3 ]; then echo "[boot] staged custody unlock: door rc $_rc"; break; fi
      _n=$((_n + 1)); sleep 0.5
    done
    # A loop that drained without an answer says so: a silent floor reads like a vessel nobody tried to open.
    if [ "$_n" -ge 600 ]; then echo "[boot] staged custody unlock: no daemon answered the door"; fi
  ) &
fi

echo "[boot] serving…"
exec node packages/lararium-node/dist/src/main.js
