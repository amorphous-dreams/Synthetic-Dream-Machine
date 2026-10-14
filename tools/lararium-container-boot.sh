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

if [ ! -f "$LAR_ROOT/data/lares/vessel/social-bootstrap.json" ]; then
  echo "[boot] founding this container's own Lararium (own vessel identity)…"
  # --skip-build uses the CLI and daemon already compiled into the product image.
  #
  # THE HUMAN ROUTE. A founding seals custody from birth and gathers its route (a passphrase or a paper pin) from a
  # TTY ALONE: no flag and no env var carries one. Two shapes reach this line.
  #   · ATTACHED (`docker compose run --rm -it <service>`): the CLI prompts on the terminal.
  #   · A DISPOSABLE TEST HARNESS (the mesh scenarios, the rehearsal): the compose file declares the root scratch with
  #     LAR_STAGE_DIR, and the existing test door founds the custody under a fixed test passphrase first. The door
  #     refuses any root without the staging marker (`.lar-test-scratch`), which this boot writes only under LAR_STAGE_DIR.
  # Neither shape standing, the founding below refuses BY NAME (CredentialTtyRefusal) and says how to run it attached.
  if [ -n "${LAR_STAGE_DIR:-}" ]; then
    node tools/test-scratch-marker.mjs "$LAR_ROOT"
    node tools/seed-test-custody.mjs "$LAR_ROOT"
  fi
  node packages/lares-cli/dist/src/bin/lares.js vessel found --skip-build
fi

# A PLACE IS NOT YET A HEARTH. `vessel found` stands the place FACELESS, and `standAs` reads a faceless
# vessel as a herm however the compose file labels it — so a container meant to serve as a full Lararium
# must LIGHT A FACE before it serves, or it stands the crossroads instead and announces no node dial.
# A Herm container leaves this unset on purpose: staying faceless IS its standing (Lares Viales).
if [ -n "${LAR_STAND_FACE:-}" ]; then
  # NEVER FATAL. Lighting a face seeds four planes through the repo, and a cold container whose peers have
  # not yet answered reports the plane doc unavailable — a vessel that then EXITS serves nothing at all,
  # where a faceless one still carries and routes. So the lift is attempted and its refusal is named, and
  # the container serves either way; `standAs` reads whatever actually stands.
  echo "[boot] lighting the face '${LAR_STAND_FACE}' — this container serves as a hearth, never a crossroads…"
  # LIT AGAINST THIS ISLAND'S OWN STORE, never against the mesh. Lighting a face MINTS four planes and
  # writes the PersonaGroup id into a bootstrap this container already holds — every doc it touches lives
  # on local disk. With LAR_PEERS set, the repo reaches for peers that have not yet stood and the mint
  # answers `Document … is unavailable`: a resolution failure standing in for a dependency that was never
  # real. So the lift runs peerless and the SERVER carries the peers, which also reads right — a face is
  # what this vessel holds, never what the mesh grants it.
  LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js persona new 0 --name "$LAR_STAND_FACE" \
    || echo "[boot] the face did NOT light (see the error above) — serving faceless, at the waking floor"
fi

# A HEARTH THAT CARRIES IS NOT YET A HEARTH THAT TENDS. A single face lifts a vessel off the floor and
# leaves the Nexus ungoverned: the roster forms from personas that declared a HANDLE and took a CHAIR,
# so a face minted with neither seats nobody and `nexus seal show` reads an empty quorum with a
# fail-closed threshold. `LAR_STAND_KAHU` names the chairs, comma-separated, and this container seats
# them before it serves.
#
# THE SEAL IS FILE-LOCAL, so it lands before the exec below rather than against a running daemon —
# `seal seat` reads and writes this vessel's own nexus home and its own seat keys. A container seats its
# own founding quorum for the same reason it founds its own identity: nothing in the mesh grants it.
# SEATING IS ONCE, NEVER EVERY BOOT. `seal seat` at genesis RE-DERIVES the genesis epoch, and every
# carriage entries root on the epoch that stood when they were signed. A re-seat on restart mints a new
# epoch, so the fold denies existing members whose entries name another epoch.
#
# A vessel that already carries a seated quorum has nothing to seat.
_already_seated() {
  node packages/lares-cli/dist/src/bin/lares.js nexus seal show --json 2>/dev/null \
    | grep -q '"quorumSeated":true'
}

# WHO HOLDS THE SEATED CHAIRS — so a boot can tell "nothing to do" from "you asked for something else and I am
# not doing it". A SEAT CARRIES A PRIVATE CHAIR LABEL AND NO HANDLE: the charter names each chair by its label
# (`chair-h0`, …), so the charter alone never answers which handles this boot seated. The handles rest on the
# personas that took the chairs, so the boot reads them there: each persona that holds a seat, by its handle,
# in index order. (The answer's JSON rides the last line that opens with a brace; trace lines may precede it.)
_seated_handles() {
  node packages/lares-cli/dist/src/bin/lares.js persona list --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{try{const line=s.split("\n").filter((l)=>l.startsWith("{")).pop();const personas=JSON.parse(line).data.personas;process.stdout.write(personas.filter((p)=>p.seat===true).map((p)=>p.handle??"").join(","))}catch{}})'
}

if [ -n "${LAR_STAND_KAHU:-}" ] && _already_seated; then
  _seated="$(_seated_handles)"
  if [ "$_seated" = "$LAR_STAND_KAHU" ]; then
    echo "[boot] a quorum already stands, seated under these same handles — nothing to seat"
  else
    # A SILENT NO-OP IS THE WRONG ANSWER TO A CHANGED CONFIG. The operator edited the chair list and
    # this boot is deliberately not honouring it, because a re-seat at genesis re-derives the epoch
    # and orphans every carriage entry rooted on the PRIOR epoch. Changing a SEATED roster is what a
    # rotation is for — under the standing quorum, against a key-set pre-committed an epoch earlier.
    echo "[boot] ⚠ the seated chairs stand under the handles: ${_seated}"
    echo "[boot] ⚠ but LAR_STAND_KAHU asks for: ${LAR_STAND_KAHU}"
    echo "[boot] ⚠ NOT re-seating — a re-seat re-derives the genesis epoch and orphans every member."
    echo "[boot] ⚠ To change who holds a STANDING charter, rotate it: \`lares nexus seal rotate\`."
    echo "[boot] ⚠ To start over instead, burn this vessel's volume and boot fresh."
  fi
elif [ -n "${LAR_STAND_KAHU:-}" ]; then
  echo "[boot] seating the founding kahu: ${LAR_STAND_KAHU}"
  _i=0
  # THREE ACTS PER COMMAND, never one: --name labels privately, --handle declares outward, --seat
  # stands for a chair. Only the last two reach the roster.
  # `printf '%s'` ENDS WITHOUT A NEWLINE, and `while read` returns false on a final unterminated line
  # after assigning it — so the last chair silently never stood. Measured: three handles named, two
  # kahu seated, and the roster still met a majority-of-two threshold, so the reading stayed green
  # over a quorum missing a third of itself.
  printf '%s\n' "$LAR_STAND_KAHU" | tr ',' '\n' | while IFS= read -r _handle; do
    [ -z "$_handle" ] && continue
    LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js persona new "$_i" \
      --name "kahu-$_i" --handle "$_handle" --seat \
      || echo "[boot] kahu $_i ('$_handle') did NOT stand — the roster will read short"
    _i=$((_i + 1))
  done
  # `rite quorum` composes seal seat · seal show — the seat gives each chair that stood a seat key of its own,
  # arms the next epoch with each chair's next key, and the threshold derives majority over the roster.
  LAR_PEERS= node packages/lares-cli/dist/src/bin/lares.js nexus rite quorum \
    || echo "[boot] the cabal did NOT seat (see above) — this hearth carries but does not tend"
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
