#!/usr/bin/env bash
# mesh-scenarios — the readings the mesh harness owes, each standing on its own.
#
# ── WHY MANY AND NOT ONE ────────────────────────────────────────────────────────────────────────
# A mesh that only ever runs whole cannot say which half broke. Two of these stand ONE operator with
# nothing to carry from — a sovereign hearth and its browser vessel, alone — so a fault there belongs
# to that operator's own boot rather than to the federation. The rest each walk ONE axis of the
# membership grid (posture · phase · realm standing) or one crossing of two, and name the cells they
# cover in a `# COVERS:` line above their function.
#
#   operator-a   lararium-a + browser-a, PEERLESS      the founder's own setup, standing alone
#   operator-b   lararium-b + browser-b, PEERLESS      the joiner's own setup, standing alone
#   nexus        every class, wired                    hearths + herms + browsers, carrying
#   quorum · relation · realm · open · open-relation · leaf · crossing · realm-crossing · quorum-realm
#   meme         two contracted operators + browser-a  an author's `bag` crossing; the island's face
#
# ── HOW A LONE OPERATOR STANDS ──────────────────────────────────────────────────────────────────
# `--no-deps` withholds the herms `depends_on` would otherwise drag in, and `LAR_x_PEERS=` blanks the
# bootstrap list. `peers` filters empty away, so a vessel with none is a supported shape rather than a
# broken one — which is the point: an operator who cannot stand alone has no sovereignty to federate.
#
# The browser vessel shares its operator's network namespace, so both names ride together, always.
#
# Usage:  tools/mesh-scenarios.sh [operator-a | operator-b | nexus | quorum | relation | realm | open |
#                                  crossing | open-relation | leaf | realm-crossing | quorum-realm | meme | all]
# Green:  every named scenario's browser vessel exits 0 and its hearth answers.
set -uo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.mesh.yml"
WANT="${1:-all}"
FAILED=0

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
step() { printf '  %-46s' "$*"; }
ok()   { printf '\033[32mok\033[0m\n'; }
bad()  { printf '\033[31mFAILED (%s)\033[0m\n' "$1"; FAILED=$((FAILED + 1)); }
# A MEASURED ABSENCE IS NOT A BROKEN STEP. `gap` reports a thing the system does not yet do, walked
# and named with its wake condition, so it neither lies green nor spends a red on settled ground.
# It never stands in for `bad`: use it only where the walk SUCCEEDED and the system's answer was no.
gap()  { printf '\033[33mGAP (%s)\033[0m\n' "$1"; }

# Every scenario burns its own volumes. A hearth that founded in a previous reading would let the next
# one report a founding it never performed.
#
# AND IT WAITS FOR THE TEARDOWN TO LAND. `down -v` returns before the network is released, so the next
# `up` raced it and failed — a harness fault that reads exactly like a mesh that cannot stand.
clear_all() {
  $COMPOSE down -v >/dev/null 2>&1 || true
  local deadline=$((SECONDS + 60))
  while docker network ls --format '{{.Name}}' | grep -q '^dreamnet-mesh_mesh$' && [ "$SECONDS" -lt "$deadline" ]; do
    sleep 1
  done
}

# The browser vessel is the verdict: it refuses at the floor unless the origin can actually mint, so a
# zero here means a real engine held a real secure context against that operator's own namespace.
#
# A RUNNING CONTAINER'S ExitCode READS 0. `docker inspect` reports the LAST exit, and a probe still
# driving Chromium reports 0 before it has decided anything — measured: a step read "ok" and printed no
# evidence, because the log it then read was still being written. So this answers EMPTY until the
# container has actually exited, and every poll on it waits for a verdict rather than a heartbeat.
browser_verdict() {
  # Two `local` lines, not one: bash expands every word of a `local` before it assigns any, so a name
  # built from `$svc` on the same line reads an unbound variable under `set -u` — and the function's
  # empty answer read exactly like a probe that never exited.
  local svc="$1" status
  local name="dreamnet-mesh-${svc}-1"
  status=$(docker inspect -f '{{.State.Status}}' "$name" 2>/dev/null) || { echo "absent"; return; }
  [ "$status" = "exited" ] || { echo ""; return; }
  docker inspect -f '{{.State.ExitCode}}' "$name" 2>/dev/null || echo "absent"
}

# DOES A SERVICE'S LOG CARRY THIS LINE — and why this is never a bare `grep -q`.
#
# `set -o pipefail` + `grep -q` over a LONG producer is a trap: `grep -q` exits at the FIRST match and
# closes the pipe, the producer takes SIGPIPE and returns non-zero, and the pipeline reads as FAILURE
# precisely when the pattern MATCHED. Measured: a hearth that had stood in 13 seconds reported "never
# stood", and the failure dump printed the very line the check was looking for.
#
# IT BITES BY OUTPUT SIZE, WHICH IS WHY IT READS AS A FLAKE. A short log finishes before grep exits and
# the pipeline passes; the same check over a longer log fails. Every wait here reads a container log
# that grows with the run, so "intermittent" is the shape this bug wears.
#
# `grep -c` reads its input to the end, so nothing is signalled and the count is the answer. A short
# producer (`printf` into grep) is unaffected and stays as it is.
logs_have() {
  local pattern="$1"; shift
  local n
  n=$($COMPOSE logs "$@" 2>&1 | grep -cF "$pattern")
  [ "${n:-0}" -gt 0 ]
}

# WHETHER A HEARTH'S VERB SOCKET ANSWERS — which is not the same as having stood.
#
# `[lararium]` in the log proves the boot printed; it does not prove the UDS verb-channel is taking
# calls. Measured: a scenario that trusted the log line fired three verbs into a socket that was not
# yet listening, and read the empty results as failures of the thing it was testing.
#
# The founding rite carries the same law for its own LIVE movement — "⑥ ASSERTS BY CONNECTING, never
# by inspecting" — because local facts (a file, a port, a log line) all read true while the vessel
# answers nothing.
# THE PROBE MUST CROSS THE SOCKET. A first draft used `vessel read` — "the pure inspection that starts
# nothing", which reads local files and answers true while the verb channel is still deaf. The probe
# rides a DAEMON-ROUTED verb, so a pass means a verb actually completed.
answers() {
  $COMPOSE exec -T "$1" node packages/lares-cli/dist/src/bin/lares.js bag stats --json >/dev/null 2>&1
}

# WHY A HEARTH NEVER ANSWERED, in the words the boot used.
#
# A four-line tail catches the stack and loses the sentence above it, and that sentence carries the
# NUMBER: a boot that spent 3000ms and one that spent 15000ms fail identically at the tail and mean
# different things — the first says a budget went unraised, the second says raising it did not answer.
# So the dump reaches for the resolve line first and falls back to the tail only when none stands.
dump_boot_failure() {
  local svc="$1" line
  line=$($COMPOSE logs "$svc" 2>&1 | grep -oE "did not resolve within [0-9]+ms|reason: '[a-z-]+'" | sort -u | tr '\n' ' ')
  [ -n "$line" ] && printf '      %s: %s\n' "$svc" "$line"
  $COMPOSE logs "$svc" 2>&1 | tail -6 | sed 's/^/      /'
}

# Wait until a hearth both STANDS and ANSWERS. Either alone is a half-truth.
up_and_answering() {
  local svc="$1" deadline=$(( SECONDS + ${2:-300} ))
  while ! { stood "$svc" && answers "$svc"; } && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  stood "$svc" && answers "$svc"
}

# whether a hearth has stood — the boot line every lararium prints.
stood() { logs_have "[lararium]" "$1"; }

# ── THE CONTRACT, FACTORED ONCE ─────────────────────────────────────────────────────────────────
# Six scenarios walk the same four doors — `seal export` on A, `seal import` on B, B's `accept-carriage`,
# A's `contract` — and a copy in each let one drift from the others unnoticed. This helper carries the two
# steps every relation begins with and hands the caller B's nym in `NYM`. It returns non-zero when a door
# refused, having printed its evidence; the caller tears down and returns.
#
# The charter travels by its own doors rather than by `cp` — `seal export` hands A's public material over,
# `seal import` places it on B, refusing to land on a founding. That is the handoff the runbook instructs
# ("B cannot consent to a charter it has never seen"), performed rather than simulated.
NYM=""
contract_ab() {
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local CHARTER ACC SIG
  NYM=""
  step "A's charter travels to B by its own doors"
  CHARTER=$($COMPOSE exec -T lararium-a $LARES nexus seal export --no-json 2>/dev/null)
  if [ -z "$CHARTER" ]; then bad "A exported no charter"; return 1; fi
  if printf '%s' "$CHARTER" | $COMPOSE exec -T lararium-b sh -c 'cat > /tmp/a-charter.mem' \
     && $COMPOSE exec -T lararium-b $LARES nexus seal import /tmp/a-charter.mem >/dev/null 2>&1; then ok
  else bad "B could not take A's charter"; return 1; fi

  step "B signs her contract-in, A's quorum admits her"
  ACC=$($COMPOSE exec -T lararium-b $LARES nexus accept-carriage --json 2>/dev/null)
  NYM=$(printf '%s' "$ACC" | grep -oE '"nym":"[a-f0-9]{64}"' | head -1 | cut -d'"' -f4)
  SIG=$(printf '%s' "$ACC" | grep -oE '"contractSig":"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
  if [ -z "$NYM" ] || [ -z "$SIG" ]; then
    bad "B minted no contract-in"; printf '%s\n' "$ACC" | tail -2 | sed 's/^/      /'; return 1
  fi
  if $COMPOSE exec -T lararium-a $LARES nexus contract "$NYM" --sig "$SIG" >/dev/null 2>&1; then ok
  else bad "A's quorum refused the admit"; return 1; fi
}

# COVERS: private/seed/unfed
run_operator() {          # $1 = a|b
  local who="$1" hearth="lararium-$1" browser="browser-$1"
  say "OPERATOR ${who^^} — standing alone, nothing to carry from"
  clear_all
  step "$hearth + $browser (peerless, --no-deps)"
  # The peers var for the OTHER operator stays untouched; only this one blanks.
  if env "LAR_$(echo "$who" | tr a-z A-Z)_PEERS=" \
       $COMPOSE up -d --no-deps "$hearth" "$browser" >/dev/null 2>&1; then ok; else bad "up"; return; fi

  step "the browser vessel mints at the floor"
  local code deadline=$((SECONDS + 180))
  while [ "$(browser_verdict "$browser")" = "" ] && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  code=$(browser_verdict "$browser")
  if [ "$code" = "0" ]; then ok; else
    bad "browser exit $code"
    $COMPOSE logs "$browser" 2>&1 | tail -6 | sed 's/^/      /'
  fi

  # POLL, NEVER READ ONCE. The browser probe exits in seconds and the hearth founds for far longer, so
  # a single read after the browser lands catches a vessel mid-boot and calls it dead. Measured: the
  # first form failed here while the log said "lighting the face" one line down.
  step "the hearth stood without a peer"
  deadline=$((SECONDS + 240))
  while ! stood "$hearth" && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  if stood "$hearth"; then ok; else
    bad "no lararium standing"
    $COMPOSE logs "$hearth" 2>&1 | tail -6 | sed 's/^/      /'
  fi
  clear_all
}

# ── THE QUORUM SCENARIO ─────────────────────────────────────────────────────────────────────────
# A HEARTH THAT CARRIES IS NOT YET A HEARTH THAT TENDS. Every reading above proves motion — browsers
# mint, hearths stand, records merge — and none of them proves that a founding operator seated the
# kahu who govern the Nexus those records cross. A mesh can be fully green with no quorum anywhere.
#
# The roster forms from what STOOD: a persona that declared a Handle AND took a chair. So this reads
# the seal's own show, not a persona count — three faces that never sat leave an empty roster while
# `persona list` reads three, and that gap is exactly what the reading is for.
# COVERS: private/seed/unfed
run_quorum() {
  say "QUORUM — the founding kahu seat, and the seal reads them"
  clear_all
  step "lararium-a up, alone"
  if LAR_A_PEERS= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1; then ok; else bad "up"; return; fi

  step "the hearth stands"
  local deadline=$((SECONDS + 240))
  while ! stood lararium-a && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  if stood lararium-a; then ok; else bad "no lararium standing"; clear_all; return; fi

  # THE SEAL'S OWN WORD. `nexus seal show` reports the seated roster and the threshold derived from
  # it — majority over what stood. A hearth with no cabal answers honestly and names nobody.
  step "the seal reads a seated quorum"
  local SHOW
  SHOW=$($COMPOSE exec -T lararium-a node packages/lares-cli/dist/src/bin/lares.js nexus seal show --json 2>&1)
  # ASSERT THE SEATS, NOT ONLY THE THRESHOLD. Majority over TWO is also two, so a threshold check
  # alone passed a roster that had silently lost a chair. The count of seated keys is what names the
  # roster; the threshold is what derives from it.
  # AND THE QUORUM MUST SURVIVE A LOSS. Three chairs over a threshold of two tolerate one seat going
  # dark; two over two tolerate none, and lock the Nexus the day one is lost — including for the
  # rotation that would repair it. A civic roster that cannot lose a kahu is not seated, it is armed.
  if printf '%s' "$SHOW" | grep -q '"seatedKeys":3' \
     && printf '%s' "$SHOW" | grep -q '"threshold":2' \
     && printf '%s' "$SHOW" | grep -q '"fragile":false'; then ok; else
    bad "no quorum seated"
    printf '%s\n' "$SHOW" | tail -3 | sed 's/^/      /'
  fi
  clear_all
}

# ── THE RELATION SCENARIO ───────────────────────────────────────────────────────────────────────
# EVERY READING ABOVE PROVES STANDING AND CARRYING — vessels up, browsers minting at the floor,
# hearths merging from a Herm. None of them proves two operators entering a RELATION, which is the
# act a Nexus IS: "the Nexus begins when a second operator contracts in" (genesis-doc's keeper
# ladder). A hearth that seats its own quorum and never contracts stands a SEED, however green.
#
# The charter travels by its own doors here rather than by `cp` — `seal export` hands A's public
# material over, `seal import` places it on B, refusing to land on a founding. That is the handoff
# the runbook instructs ("B cannot consent to a charter it has never seen"), performed rather than
# simulated.
# ── THE REALM AXIS ──────────────────────────────────────────────────────────────────────────────
# A REALM IS CONSTITUTED BY FEEDING, never created — "the first offering IS the founding of the realm,
# never a step after it". Nothing in this harness has ever fed one, so `realmStanding` has run only in
# unit tests and the `cabal feed` / `cabal clock` doors have never been walked in a container.
#
# The reading it proves is the one that must NOT over-claim: one face feeding is a VISIT, and several
# faces of ONE operator are MANY-FACES rather than a mutual hold — the slots carry faces, and a human
# running several of their own reads as the Sybil-of-one this plane prices socially.
# ── THE LEAF CONTRACT: A BROWSER INTO ITS OPERATOR'S FLEET ──────────────────────────────────────
# CANON CALLS THIS "named, never walked" — and the pieces are all BUILT: `lares device-admit`,
# `runDeviceAdmitEdge`, the browser's own `admit-carriage`. Five test files exercise it in process and
# NO harness had ever walked it across real vessels, which is where every real defect this harness
# found today has lived: the seam between built pieces, never the pieces.
#
# THE ACT IS ONE DELEGATION EDGE, and the leaf mints no root. A browser is a DEVICE of its operator,
# so this rides the fleet axis — `compose` binding one principal's instruments, which buys REACH and
# deposits no depth. It is emphatically not a carriage contract and not a realm dwelling.
# COVERS: private/seed/unfed
run_leaf() {
  say "LEAF — an operator mints a device edge naming her browser, and it parses back"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  step "lararium-a + browser-a up"
  if LAR_A_PEERS= $COMPOSE up -d --no-deps lararium-a browser-a >/dev/null 2>&1; then ok; else bad "up"; return; fi

  step "the hearth stands AND answers"
  if up_and_answering lararium-a; then ok; else
    bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  # THE BROWSER SAYS WHAT IT MINTED. A vessel that mints and cannot name its own key leaves the admit
  # unwalkable — the operator's node has nothing to point at.
  step "the browser mints and NAMES its verifying key"
  local deadline=$((SECONDS + 240)) KEY=""
  while [ -z "$KEY" ] && [ "$SECONDS" -lt "$deadline" ]; do
    KEY=$($COMPOSE logs browser-a 2>&1 | grep -oE 'verifying-key [0-9a-f]{64}' | tail -1 | awk '{print $2}')
    [ -z "$KEY" ] && sleep 3
  done
  if [ -n "$KEY" ]; then ok; else
    bad "the browser named no key"; $COMPOSE logs browser-a 2>&1 | tail -4 | sed 's/^/      /'; clear_all; return; fi

  step "A admits it — one delegation edge, the leaf minting no root"
  local OUT
  # THE PAYLOAD IS THE OUTPUT — `device-admit --json` emits the admit itself, with no `ok` envelope,
  # because what the operator carries to the joining vessel IS the artifact. A first draft asserted
  # `"ok":true` and read a successful admit as a refusal.
  #
  # And the edge must NAME THIS BROWSER: an admit that verified but bound some other device would
  # satisfy any check that only asked whether one was produced.
  OUT=$($COMPOSE exec -T lararium-a $LARES device-admit --as 0 --joinee-key "$KEY" --json 2>/dev/null)
  if printf '%s' "$OUT" | grep -q 'device-admit/v1' \
     && printf '%s' "$OUT" | grep -q "$KEY"; then ok; else
    bad "the admit refused, or bound a different device"; printf '%s\n' "$OUT" | head -3 | sed 's/^/      /'; fi

  # REACH, NEVER DEPTH. A fleet binds one principal's instruments, so admitting a device must not move
  # the Nexus phase — a browser is not a second operator however many of them an operator runs.
  # THE ARTIFACT MUST BE CONSUMABLE, not merely produced. A payload the browser's own parser rejects
  # would satisfy every check above and hand the operator a fragment that goes nowhere. This runs the
  # BROWSER-SIDE parser over the carriage the operator would actually paste.
  #
  # WHAT IT DOES NOT PROVE, and the scenario no longer claims: that a browser CONSUMED it. The probe
  # mints and reports; carrying the fragment into a live page and completing the join is the half that
  # stays unwalked, and calling this "admitted into its fleet" would have papered over exactly that.
  step "the carriage PARSES back through the browser's own reader"
  local CARRIAGE
  CARRIAGE=$($COMPOSE exec -T lararium-a $LARES device-admit --as 0 --joinee-key "$KEY" 2>&1 \
             | grep -oE '#admit=[A-Za-z0-9_-]+' | tail -1)
  if [ -z "$CARRIAGE" ]; then bad "the admit printed no carriage to hand over"; else
    # THE VALUES MUST BE HANDED IN. `exec` carries no host environment, so a probe reading
    # `process.env` inside the container would compare two empty strings and pass.
    if $COMPOSE exec -T -e CARRIAGE="$CARRIAGE" -e KEY="$KEY" lararium-a node --input-type=module -e "
      import { parseAdmitCarriage } from './packages/lararium-browser/dist/admit-carriage.js';
      const p = parseAdmitCarriage(process.env.CARRIAGE ?? '');
      if (!p || p.deviceEdge?.deviceVerifyingKey !== process.env.KEY) process.exit(1);
    " >/dev/null 2>&1; then ok; else bad "the browser's reader refused the carriage, or it named another device"; fi
  fi

  step "the phase is UNMOVED — a fleet buys reach, never depth"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"seed"'; then ok
  else bad "admitting a device moved the Nexus phase"; fi
  clear_all
}

# ── OPEN, ACROSS A LIVE RELATION ────────────────────────────────────────────────────────────────
# THE `open` SCENARIO PROVED POSTURE MOVES NOTHING — against a SEED vessel, where there is no peer to
# move. That is the weaker half of the claim. Posture governs what the public shelf CARRIES, and a
# contracted peer is exactly who a carry reaches, so the flip's blast radius is only observable once
# a relation stands.
#
# The reading that must hold: a posture flip is not an admission and not a revocation. A's member set
# and B's own standing are UNCHANGED across it — the flip widens what crosses, never who is party.
# COVERS: open/multisig/unfed
# COVERS: open/multisig/visit
# COVERS: open/multisig/many-faces
run_open_relation() {
  say "OPEN ACROSS A RELATION — the flip widens what carries, never who is party"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  step "both hearths up and answering"
  if ! LAR_A_PEERS= LAR_B_PEERS= $COMPOSE up -d --no-deps lararium-a lararium-b >/dev/null 2>&1; then
    bad "up"; return; fi
  if up_and_answering lararium-a && up_and_answering lararium-b; then ok; else
    bad "a hearth never answered"; clear_all; return; fi

  if ! contract_ab; then clear_all; return; fi
  step "a relation stands"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true'; then ok
  else bad "the relation never stood"; clear_all; return; fi

  step "A opens the posture, and it survives a bounce"
  $COMPOSE exec -T lararium-a $LARES nexus posture open >/dev/null 2>&1
  $COMPOSE restart lararium-a >/dev/null 2>&1
  if up_and_answering lararium-a \
     && $COMPOSE exec -T lararium-a $LARES nexus posture --json 2>&1 | grep -q '"posture":"open"'; then ok
  else bad "the posture did not survive the bounce"; fi

  # THE ASSERTION THIS SCENARIO EXISTS FOR. A flip is not an admission and not a revocation: B stands
  # exactly where she stood, and the phase reads the relation rather than the posture.
  step "B is STILL a member, and the phase still reads the relation"
  if $COMPOSE exec -T lararium-a $LARES nexus members --list 2>&1 | grep -qi "$NYM" \
     && $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true'; then ok
  else bad "opening the posture moved the membership or the phase"; fi

  step "and B's own posture is UNTOUCHED — a flip is one operator's act"
  if $COMPOSE exec -T lararium-b $LARES nexus posture --json 2>&1 | grep -q '"posture":"private"'; then ok
  else bad "A's flip reached B's posture"; fi

  # THE POSTURE ⊥ THE DWELLING. Posture governs what the public shelf CARRIES; a realm's standing
  # counts who feeds it. Canon holds the pair apart — "carriage and dwelling run on orthogonal axes"
  # — so a flip that moved the realm reading, or a feeding that moved the posture, would couple two
  # axes that must stay free. The walk asserts BOTH directions, because one alone proves nothing.
  step "under an OPEN posture a realm still reads UNFED, then VISIT, then MANY-FACES"
  local REALM; REALM=$(printf 'f%.0s' $(seq 1 64))
  local okc=1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"unfed"' || okc=0
  $COMPOSE exec -T lararium-a $LARES cabal feed  --realm "$REALM" --as 0 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"visit"' || okc=0
  $COMPOSE exec -T lararium-a $LARES cabal feed  --realm "$REALM" --as 1 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"many-faces"' || okc=0
  if [ "$okc" -eq 1 ]; then ok; else
    bad "the OPEN posture moved what the realm reads"
    $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | tail -1 | sed 's/^/      /'
  fi

  step "and the posture is UNMOVED by the feeding — orthogonal both ways"
  if $COMPOSE exec -T lararium-a $LARES nexus posture --json 2>&1 | grep -q '"posture":"open"'; then ok
  else bad "feeding a realm moved the posture"; fi
  clear_all
}

# ── THE CROSSING: A RELATION AND A FED REALM AT ONCE ────────────────────────────────────────────
# EVERY SCENARIO ABOVE WALKS ONE AXIS. This one crosses two, because that is the shape an operator
# actually stands in: two nodes contracted into a Nexus AND faces feeding a realm. The axes are
# ORTHOGONAL by canon — "carriage and dwelling run on orthogonal axes; a contracted operator carries
# sealed traffic and may dwell in no realm at all" — so the crossing must show each reading holding
# its own value while the other moves.
#
# THAT IS THE ASSERTION, not the sum: feeding a realm must not move the phase, and contracting an
# operator must not move the realm. A harness that only ever walked one axis could not tell an
# orthogonal pair from a coupled one.
# COVERS: private/multisig/visit
run_crossing() {
  say "CROSSING — a relation and a fed realm, each holding its own reading"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local REALM; REALM=$(printf 'c%.0s' $(seq 1 64))

  step "both hearths up and answering"
  if ! LAR_A_PEERS= LAR_B_PEERS= $COMPOSE up -d --no-deps lararium-a lararium-b >/dev/null 2>&1; then
    bad "up"; return; fi
  if up_and_answering lararium-a && up_and_answering lararium-b; then ok; else
    bad "a hearth never answered"; clear_all; return; fi

  step "A feeds a realm — VISIT, while the phase stays SEED"
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 0 >/dev/null 2>&1
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"visit"' \
     && $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"seed"'; then ok
  else bad "feeding a realm moved the phase, or did not register"; fi

  if ! contract_ab; then clear_all; return; fi
  step "the phase moves, the realm does NOT"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true' \
     && $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"visit"'; then ok
  else bad "the contract moved the realm, or the phase never moved"; fi

  # THE ORTHOGONALITY, STATED AS A REFUSAL TO COUPLE. B carries for A and dwells in no realm — canon's
  # own example — so B's view of that realm stays UNFED however deep the carriage relation runs.
  step "B carries and dwells nowhere — her realm reads UNFED"
  if $COMPOSE exec -T lararium-b $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"unfed"'; then ok
  else bad "B's realm read as fed without B ever feeding"; fi
  clear_all
}

# ── THE OPEN POSTURE ────────────────────────────────────────────────────────────────────────────
# POSTURE IS THE ONE-WAY, LEAST-GATED ACT IN THE DESIGN: `cap-tier` makes loosening a ratchet that
# runs one way under no-global-now, and nothing but the operator's hand gates the flip. It had never
# been walked in a container, so the claim that it "applies on a node bounce" stood untested.
#
# WHAT THIS PROVES is narrow on purpose: the flip lands in the charter, SURVIVES a bounce, and moves
# NOTHING else — the phase still reads what the relations say. Posture governs what the public shelf
# CARRIES; it never admits an operator, and a scenario that let those two blur would teach the wrong
# thing about the least-reversible act here.
# COVERS: open/seed/unfed
# COVERS: open/seed/visit
# COVERS: open/seed/many-faces
run_open() {
  say "OPEN — the posture flips, survives a bounce, and moves nothing else"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  step "lararium-a up, alone"
  if LAR_A_PEERS= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1; then ok; else bad "up"; return; fi

  step "the hearth stands AND answers"
  if up_and_answering lararium-a; then ok; else
    bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return
  fi

  # FAIL-CLOSED IS THE DEFAULT, and it earns an assertion: a Nexus develops in isolation until the
  # operator opens it, so a harness that only ever saw `open` could not tell a default from a flip.
  step "posture reads PRIVATE by default"
  if $COMPOSE exec -T lararium-a $LARES nexus posture --json 2>&1 | grep -q '"posture":"private"'; then ok
  else bad "the default was not private"; fi

  step "the flip lands in the charter"
  if $COMPOSE exec -T lararium-a $LARES nexus posture open --json 2>&1 | grep -q '"posture":"open"'; then ok
  else bad "the flip did not land"; fi

  # THE CLAIM THE DOOR MAKES — "a node bounce applies it" — and nothing had tested it.
  step "OPEN survives a node bounce"
  $COMPOSE restart lararium-a >/dev/null 2>&1
  if up_and_answering lararium-a \
     && $COMPOSE exec -T lararium-a $LARES nexus posture --json 2>&1 | grep -q '"posture":"open"'; then ok
  else bad "the posture did not survive the bounce"; fi

  step "and the phase is UNMOVED — posture carries, it never admits"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"seed"'; then ok
  else bad "opening the posture moved the phase"; fi

  # THE POSTURE ⊥ THE DWELLING. Posture governs what the public shelf CARRIES; a realm's standing
  # counts who feeds it. Canon holds the pair apart — "carriage and dwelling run on orthogonal axes"
  # — so a flip that moved the realm reading, or a feeding that moved the posture, would couple two
  # axes that must stay free. The walk asserts BOTH directions, because one alone proves nothing.
  step "under an OPEN posture a realm still reads UNFED, then VISIT, then MANY-FACES"
  local REALM; REALM=$(printf 'e%.0s' $(seq 1 64))
  local okc=1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"unfed"' || okc=0
  $COMPOSE exec -T lararium-a $LARES cabal feed  --realm "$REALM" --as 0 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"visit"' || okc=0
  $COMPOSE exec -T lararium-a $LARES cabal feed  --realm "$REALM" --as 1 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"many-faces"' || okc=0
  if [ "$okc" -eq 1 ]; then ok; else
    bad "the OPEN posture moved what the realm reads"
    $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | tail -1 | sed 's/^/      /'
  fi

  step "and the posture is UNMOVED by the feeding — orthogonal both ways"
  if $COMPOSE exec -T lararium-a $LARES nexus posture --json 2>&1 | grep -q '"posture":"open"'; then ok
  else bad "feeding a realm moved the posture"; fi
  clear_all
}

# COVERS: private/seed/visit
# COVERS: private/seed/many-faces
run_realm() {
  say "REALM — fed once is a visit; fed by a second face is many-faces, never belonging"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local REALM; REALM=$(printf 'a%.0s' $(seq 1 64))

  step "lararium-a up, alone"
  if LAR_A_PEERS= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1; then ok; else bad "up"; return; fi

  step "the hearth stands AND answers"
  if up_and_answering lararium-a; then ok; else
    bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return
  fi

  step "an unfed realm reads UNFED"
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 \
     | grep -q '"standing":"unfed"'; then ok; else
    bad "an unfed realm did not read unfed"
    $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | tail -2 | sed 's/^/      /'
  fi

  step "ONE face feeds — a VISIT, and depth changes nothing"
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 0 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 0 >/dev/null 2>&1
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 \
     | grep -q '"standing":"visit"'; then ok; else bad "one face twice did not read as a visit"; fi

  # THE READING THAT MUST NOT OVER-CLAIM. A second FACE of the same operator is a second writer id
  # and not a second hand; naming it belonging would manufacture the reciprocity the model requires
  # be earned.
  step "a SECOND face feeds — MANY-FACES, and never belonging"
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 1 >/dev/null 2>&1
  local CLK
  CLK=$($COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1)
  if printf '%s' "$CLK" | grep -q '"standing":"many-faces"' \
     && ! printf '%s' "$CLK" | grep -q '"standing":"belonging"'; then ok; else
    bad "the second face did not read as many-faces"
    printf '%s\n' "$CLK" | tail -2 | sed 's/^/      /'
  fi
  clear_all
}

# COVERS: private/multisig/unfed
run_relation() {
  say "RELATION — two operators contract, and the phase moves off SEED"
  clear_all
  step "both hearths up, peerless"
  if LAR_A_PEERS= LAR_B_PEERS= $COMPOSE up -d --no-deps lararium-a lararium-b >/dev/null 2>&1; then ok
  else bad "up"; return; fi

  step "both hearths stand"
  local deadline=$((SECONDS + 300))
  while ! { stood lararium-a && stood lararium-b; } && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  if stood lararium-a && stood lararium-b; then ok
  else
    # A STEP THAT REFUSES MUST SHOW ITS EVIDENCE. A bare verdict here sent three runs chasing the
    # wait loop while the cause sat in the boot log.
    bad "a hearth never stood"
    for s in lararium-a lararium-b; do
      printf '      --- %s\n' "$s"; $COMPOSE logs "$s" 2>&1 | tail -4 | sed 's/^/      /'
    done
    clear_all; return
  fi

  # A HEARTH THAT SEATED ITS OWN QUORUM IS STILL A SEED. This is the reading the whole scenario
  # exists to move, so it gets asserted BEFORE the contract as well as after — a phase that read
  # "multisig" here would mean the reading, not the relation, had done the work.
  step "A stands a SEED before any relation"
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"seed"'; then ok
  else bad "A did not read as a seed"; fi

  if ! contract_ab; then clear_all; return; fi

  # THE READING THE SCENARIO EXISTS FOR. A relation stands, so the phase leaves SEED — and the
  # members board folds a key A has never held.
  step "the phase leaves SEED — a Nexus stands"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true'; then ok
  else bad "the phase never moved off seed"; fi

  step "A's members board folds B IN"
  if $COMPOSE exec -T lararium-a $LARES nexus members --list 2>&1 | grep -qi "$NYM"; then ok
  else bad "B never landed on the board"; fi
  clear_all
}

# COVERS: private/seed/unfed
run_nexus() {
  say "NEXUS — every class, carrying"
  clear_all
  step "the whole mesh up"
  if UPLOG=$($COMPOSE up -d 2>&1); then ok; else
    bad "up"; printf '%s\n' "$UPLOG" | tail -6 | sed 's/^/      /'; return
  fi

  step "both browser vessels mint"
  local deadline=$((SECONDS + 240)) a b
  while { [ "$(browser_verdict browser-a)" = "" ] || [ "$(browser_verdict browser-b)" = "" ]; } \
        && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  a=$(browser_verdict browser-a); b=$(browser_verdict browser-b)
  if [ "$a" = "0" ] && [ "$b" = "0" ]; then ok; else bad "browser-a=$a browser-b=$b"; fi

  # CARRIAGE IS THE ONLY THING THIS READING ADDS. Both hearths bootstrap from a Herm, so a merge line
  # names the federation actually moving records rather than two vessels standing near each other.
  # ⚠ THIS STEP IS INTERMITTENT, and the flake is the finding.
  # Measured 2 green in 3 runs after the catalog-pointer fix, against 0 in 3 before it — so that fix
  # reached this and did not close it. What remains: on a cold seven-service mesh a hearth can still
  # lose the `@daemon` resolve, and which one varies. Raising `on-failure` from 3 to 8 changed nothing,
  # so it is not patience. The lone-operator scenarios above stay green, which places the residue in the
  # COLD START ORDER — a hearth starts when its herm's CONTAINER starts, and a started herm is not yet a
  # carrying one. A readiness condition is the open cure.
  #
  # A red here is worth re-running once before chasing: this step reports a race, and a race reports
  # itself differently each time.
  #
  # POLL. Carriage runs on its own cadence, well after the browsers have exited — a single read here
  # times the harness rather than the federation.
  step "the hearths carry from the herm"
  deadline=$((SECONDS + 240))
  while ! logs_have "carriage: merged" lararium-a lararium-b && [ "$SECONDS" -lt "$deadline" ]; do
    sleep 5
  done
  if logs_have "carriage: merged" lararium-a lararium-b; then ok; else
    bad "no carriage"
    $COMPOSE logs lararium-a 2>&1 | tail -5 | sed 's/^/      /'
  fi
  clear_all
}

# THE ONE QUESTION THE OTHER NINE NEVER ASK. Every other scenario stands its hearths PEERLESS
# (`LAR_A_PEERS=` plus `--no-deps`), so nothing in this file has ever walked two operators
# REPLICATING — the charter crosses by hand, and the reading never has to leave one vessel.
#
# A realm is a COLLECTIVE BOUND BY INTERACTION, so the standing that matters spans operators, and
# `cabal feed` already hedges: the roll "counts the slots THIS replica has synced — a peer may hold
# deeper ones". Whether a peer's offering ever ARRIVES is the claim, and it decides which instrument
# can see a realm at all: the lease slots ride the DAEMON bag, and `daemonDocUrlFromBootstrap` reads
# that URL "off the social bootstrap THIS VESSEL already holds".
#
# COVERS: private/multisig/many-faces
run_realm_crossing() {
  say "REALM CROSSING — two contracted operators feed ONE realm, and A reads for B's face"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local REALM; REALM=$(printf 'd%.0s' $(seq 1 64))

  # THE RELAY STANDS FIRST, and this is not politeness. A COLD MESH LOSES A RACE THAT IS NOT A FAULT:
  # a hearth booting beside a cold relay exits `reason: 'resolve-timeout'` out of `openDaemon`, and
  # `restart: "on-failure:8"` did NOT ride it — measured, lararium-a exhausted all eight retries while
  # lararium-b, starting moments later against a warm relay, stood. Staging the relay takes the boot
  # lottery out of a measurement that is about a realm, never about start order.
  step "the relay stands FIRST — the hearths must not race a cold peer"
  if $COMPOSE up -d herm-source >/dev/null 2>&1 && up_and_answering herm-source; then ok
  else bad "the relay never answered"; clear_all; return; fi

  # AND THE HEARTHS STAND ONE AT A TIME, which is not tidiness either. `@daemon` is a hearth-private
  # doc at VESSEL scale, and `SCALE_PATIENCE_MS` grants that scale 3s on the reasoning that "a wider
  # scale traverses more of the mesh". Patience is therefore graded by DISTANCE while the delay that
  # actually bites is LOAD — two hearths booting into one relay queue behind each other, and 3s
  # expires. Measured: lararium-a died `reason: 'resolve-timeout'` on 8 of 8 restarts with the relay
  # already up and answering, while lararium-b stood. Booting them in sequence removes the mutual
  # load, and the error text prescribes exactly this — "Stand again; a vessel under load from its
  # peers commonly resolves on a second reading."
  #
  # NO peer override: both hearths take the compose default (herm-source) and carry through the relay.
  # This is the only scenario in the file that stands one.
  step "A stands FIRST, alone against the relay"
  if $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 && up_and_answering lararium-a; then ok; else
    bad "A never stood"; $COMPOSE logs lararium-a 2>&1 | tail -5 | sed 's/^/      /'; clear_all; return
  fi

  step "then B, into a mesh that is already standing"
  if $COMPOSE up -d --no-deps lararium-b >/dev/null 2>&1 && up_and_answering lararium-b; then ok; else
    bad "B never stood"; $COMPOSE logs lararium-b 2>&1 | tail -5 | sed 's/^/      /'; clear_all; return
  fi

  step "the realm reads UNFED on BOTH sides"
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"unfed"' \
     && $COMPOSE exec -T lararium-b $LARES cabal clock --realm "$REALM" --json 2>&1 | grep -q '"standing":"unfed"'; then ok
  else bad "an unfed realm did not read unfed on both sides"; fi

  if ! contract_ab; then clear_all; return; fi

  step "the phase leaves SEED — a Nexus stands over BOTH operators"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true'; then ok
  else bad "the phase never moved off seed"; fi

  # A NEXUS *IS* THE RELATION — "a second OPERATOR is the first relation, and a Nexus IS the relation"
  # — and a relation has two sides. The phase counts the members board (`contracted = members.length`).
  #
  # A RELATION HAS TWO SIDES, AND EACH HOLDS ITS OWN EVIDENCE. The phase counts operators a vessel
  # ADMITTED onto its members board — an immune surface, rightly local, and empty forever on a vessel
  # that joined someone else's Nexus. B's evidence is the contract-in SHE signed: a fact about her own
  # vessel that needs no partner's document. `accept-carriage` now KEEPS it, bound to the charter epoch
  # it consented under, so a rotation cannot carry a consent across terms it never read.
  #
  # A draft chased this the other way — pointing B at A's members board — and that was an AUTHORITY
  # DEFECT: it would let A's future admits widen B's carriage without her consent.
  step "★ does B read the Nexus too? a relation has two sides ★"
  local BPHASE
  BPHASE=$($COMPOSE exec -T lararium-b $LARES nexus seal show --json 2>&1)
  if printf '%s' "$BPHASE" | grep -q '"isNexus":true'; then ok
  else
    bad "B still reads a SEED — her own kept consent did not reach the phase"
    printf '      B reads: %s\n' "$(printf '%s' "$BPHASE" | grep -oE '"phase":\{"phase":"[a-z]+"' | head -1)"
    printf '      B board: %s\n' "$($COMPOSE exec -T lararium-b $LARES nexus members --list --json 2>&1 \
        | grep -oE '"boardRoot":"[a-f0-9]*"|"members":\[[^]]*\]' | tr '\n' ' ')"
  fi

  # AND SHE NEVER CLAIMS THE ROSTER. A joiner sees her own relation; how many others joined is not
  # readable from her side, and a reading that counted them would fabricate what no vessel can see.
  step "and B's members board stays her OWN and EMPTY — no roster was imported"
  if $COMPOSE exec -T lararium-b $LARES nexus members --list --json 2>&1 | grep -q '"members":\[\]'; then ok
  else bad "B's immune surface folded somebody else's admits"; fi

  step "A feeds her own face — a VISIT on A's side"
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 0 >/dev/null 2>&1
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 \
     | grep -q '"standing":"visit"'; then ok; else bad "A's own offering did not read as a visit"; fi

  # THE CELL THIS SCENARIO CLAIMS, and it claims it HONESTLY: many-faces under a standing relation,
  # reached the only way this system can reach it — two faces of ONE operator. The cross-operator
  # walk below measures whether it could ever be reached the other way, and it cannot yet.
  step "A's SECOND face feeds — MANY-FACES under a standing relation"
  $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$REALM" --as 1 >/dev/null 2>&1
  if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 \
     | grep -q '"standing":"many-faces"'; then ok; else bad "two faces did not read as many-faces"; fi

  step "B feeds HER face, on her own contracted vessel"
  if $COMPOSE exec -T lararium-b $LARES cabal feed --realm "$REALM" --as 0 >/dev/null 2>&1; then ok
  else bad "B could not feed"; fi

  # THE MEASUREMENT THIS SCENARIO EXISTS FOR. Three faces have now fed one realm — two of A's and one
  # of B's — so a reading that spanned the Nexus would count THREE. A counts its own two and stops.
  #
  # The cause is structural, not a sync delay. `daemonDocUrlFromBootstrap` reads the daemon bag's URL
  # "off the social bootstrap THIS VESSEL already holds", so a realm's feed is read from a board nobody
  # else writes. A realm is a collective bound by interaction, and the record of that interaction sits
  # in each participant's private drawer.
  #
  # The two senses now hold SEPARATE ADDRESS SPACES (`realmFeedPrefix` vs `leaseEpochPrefix`), which is
  # what the move waits on rather than the move itself. Both fold by MAX and neither verifies a seal
  # before folding, so a shared board carrying both would let any peer stale grants on resources it has
  # no authority over. The feed carries no daemon root and can travel alone.
  step "★ does a peer's offering CROSS? three faces have fed ★"
  local FACES
  local wait_until=$((SECONDS + 45))
  while [ "$SECONDS" -lt "$wait_until" ]; do
    FACES=$($COMPOSE exec -T lararium-a $LARES cabal clock --realm "$REALM" --json 2>&1 \
            | grep -oE '"maintainerCount":[0-9]+' | head -1 | cut -d: -f2)
    [ "${FACES:-0}" -ge 3 ] 2>/dev/null && break
    sleep 3
  done
  if [ "${FACES:-0}" -ge 3 ]; then ok
  else
    gap "A counts ${FACES:-0} faces, never B's — realm standing does not cross operators"
    printf '      the feed is read off the DAEMON board, which each vessel reads from its OWN bootstrap\n'
    printf '      wakes when the feed moves to the realm SUBSTRATE; its address space is already separate\n'
  fi
  clear_all
}

# THE QUORUM SEED — two operators and FOUR personas, which is where a threshold starts describing a
# check. Operator A seats three chairs from her own vault and operator B carries one in. Three chairs
# from one identity home stay three faces of one operator, supplying no hand that can refuse; the
# fourth arrives with one, and only then does k-of-n mean anything.
#
# So a quorum wants no third hearth. It wants the partner a multisig already has, plus enough chairs
# for the threshold to bind ACROSS the two.
#
# The realm ladder rides along under BOTH postures, because posture and dwelling run on orthogonal
# axes and a quorum changes neither. Six cells close here.
#
# COVERS: private/quorum/unfed
# COVERS: private/quorum/visit
# COVERS: private/quorum/many-faces
# COVERS: open/quorum/unfed
# COVERS: open/quorum/visit
# COVERS: open/quorum/many-faces
run_quorum_realm() {
  say "QUORUM — two partners contract in, and a realm reads the same under either posture"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  step "the relay stands FIRST"
  if $COMPOSE up -d herm-source >/dev/null 2>&1 && up_and_answering herm-source; then ok
  else bad "the relay never answered"; clear_all; return; fi

  # ONE AT A TIME. `@daemon` carries a 3s boot patience at vessel scale, and three hearths racing one
  # relay queue behind each other past it. Sequence removes the load rather than the race.
  for svc in lararium-a lararium-b; do
    step "$svc stands, alone against a mesh already up"
    if $COMPOSE up -d --no-deps "$svc" >/dev/null 2>&1 && up_and_answering "$svc"; then ok
    else bad "$svc never stood"; $COMPOSE logs "$svc" 2>&1 | tail -4 | sed 's/^/      /'; clear_all; return; fi
  done

  step "A stands a SEED before any relation"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"seed"'; then ok
  else bad "A did not read as a seed"; fi

  # Each partner takes A's charter, signs its own contract-in, and A's quorum admits it. Both crossings
  # run the same way, so the second proves the first was no accident of ordering.
  local CHARTER
  CHARTER=$($COMPOSE exec -T lararium-a $LARES nexus seal export --no-json 2>/dev/null)
  if [ -z "$CHARTER" ]; then bad "A exported no charter"; clear_all; return; fi

  for partner in lararium-b; do
    step "$partner takes the charter and contracts in"
    printf '%s' "$CHARTER" | $COMPOSE exec -T "$partner" sh -c 'cat > /tmp/a-charter.mem'
    $COMPOSE exec -T "$partner" $LARES nexus seal import /tmp/a-charter.mem >/dev/null 2>&1
    local ACC NYM SIG
    ACC=$($COMPOSE exec -T "$partner" $LARES nexus accept-carriage --json 2>/dev/null)
    NYM=$(printf '%s' "$ACC" | grep -oE '"nym":"[a-f0-9]{64}"' | head -1 | cut -d'"' -f4)
    SIG=$(printf '%s' "$ACC" | grep -oE '"contractSig":"[a-f0-9]+"' | head -1 | cut -d'"' -f4)
    if [ -n "$NYM" ] && [ -n "$SIG" ] \
       && $COMPOSE exec -T lararium-a $LARES nexus contract "$NYM" --sig "$SIG" >/dev/null 2>&1; then ok
    else bad "$partner never contracted in"; printf '%s\n' "$ACC" | tail -2 | sed 's/^/      /'; clear_all; return; fi
  done

  step "★ FOUR personas across TWO operators — A reads QUORUM ★"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"quorum"'; then ok
  else
    bad "three seated chairs plus one contracted partner did not read as a quorum"
    $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 \
      | grep -oE '"phase":\{"phase":"[a-z]+"' | head -1 | sed 's/^/      /'
  fi

  # THE REALM LADDER, walked once per posture. A quorum moves neither reading, and a posture flip moves
  # neither either — that is the orthogonality the grid exists to hold.
  # A REALM ID READS 64 HEX. A letter outside 0-9a-f mints no doc id and the verb refuses at usage,
  # so the ladder reports a realm that never existed rather than a reading that disagreed.
  _realm_ladder() {
    local letter="$1" label="$2" realm
    realm=$(printf "${letter}%.0s" $(seq 1 64))
    step "under $label the realm reads UNFED"
    if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$realm" --json 2>&1 | grep -q '"standing":"unfed"'; then ok
    else
      bad "an unfed realm did not read unfed under $label"
      printf '      realm %s reads: %s\n' "${letter}…" "$($COMPOSE exec -T lararium-a $LARES cabal clock --realm "$realm" --json 2>&1 \
        | grep -oE '"standing":"[a-z-]+"|"maintainerCount":[0-9]+|"error".*' | tr '\n' ' ' | cut -c1-200)"
    fi

    step "under $label one face feeds — a VISIT"
    $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$realm" --as 0 >/dev/null 2>&1
    if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$realm" --json 2>&1 | grep -q '"standing":"visit"'; then ok
    else bad "one face did not read as a visit under $label"; fi

    step "under $label a second face feeds — MANY-FACES"
    $COMPOSE exec -T lararium-a $LARES cabal feed --realm "$realm" --as 1 >/dev/null 2>&1
    if $COMPOSE exec -T lararium-a $LARES cabal clock --realm "$realm" --json 2>&1 | grep -q '"standing":"many-faces"'; then ok
    else bad "two faces did not read as many-faces under $label"; fi
  }

  _realm_ladder b "a PRIVATE posture"

  step "the posture flips OPEN, and the quorum stands unmoved"
  if $COMPOSE exec -T lararium-a $LARES nexus posture open --json 2>&1 | grep -q '"posture":"open"' \
     && $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"phase":{"phase":"quorum"'; then ok
  else bad "opening the posture moved the phase"; fi

  _realm_ladder 9 "an OPEN posture"

  clear_all
}

# ── THE MEME CROSSING: AN AUTHOR'S `bag` BETWEEN TWO OPERATORS ──────────────────────────────────
# `meme-two-vessel-bag` proves the law over ONE operator's fleet — a founder and a same-key joiner that
# dials it, on one host. This reading stands the pair the mesh is for: two SOVEREIGN operators, own
# roots and own keys, contracted into a relation, peered only through the relay. What must hold on
# whichever side reads: `bag = "backpack: rope, lantern"` is the AUTHOR's line and crosses byte-whole;
# `$origin-bag` is the host's stamp on the wiki tiddler alone and never rides the carrier; residency
# rides the envelope. The canonical hash names the same bytes on both sides, or the crossing lied.
#
# THE ONE SHARED DOOR: `meme put --bag lares` refuses (the daemon mounts `lares` read-only) and
# `--recipe lares` lands in a per-DID draft nobody else mounts, so a promotion rides `act LOAD --to
# lar:///ha.ka.ba/bags/lares` — the residency verbs reach the bag by access. Measured in the two-vessel
# witness; walked here across real vessels.
#
# The browser leg rides `browser-a`: its probe boots a REAL island in Chromium and calls the in-VM face
# (`$tw.lares.meme`) inside the island's own worker — place · read · check · project — and its exit
# code is the verdict (0: the floor AND the face; 1: no floor; 3: the face refused).
# COVERS: private/multisig/unfed
run_meme() {
  say "MEME — an author's bag crosses two contracted operators, and the browser island speaks the laws"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local URI="lar:///t.witness.npc/inventory" LARES_BAG="lar:///ha.ka.ba/bags/lares"
  # The author's line as WRITTEN, and as the canonical render ALIGNS it (`bag      = "…"`): the VALUE is what
  # must read back byte-whole; the key column is the carrier's own alignment. Two-vessel-bag reads the same.
  local BAG_LINE='bag = "backpack: rope, lantern"' BAG_RE='^bag +=  *"backpack: rope, lantern"$'
  # The witness meme, slots named by the caller: `meme_text a` · `meme_text a b`.
  meme_text() {
    printf '<<^ code="&#x0001;" from=? -> to=%s>>\n```toml meta\nuri-path = "t.witness.npc/inventory"\n%s\n```\n\n<<^ code="&#x0002;">>\n\n' "$URI" "$BAG_LINE"
    local s; for s in "$@"; do printf '<<~ ahu #/%s>>\n\n! %s\n\n<<~/ahu>>\n\n' "$s" "$s"; done
    printf '<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n'
  }
  # One `meme get --bag lares --json` on a hearth — the whole JSON, for the caller to read fields off.
  meme_get() { $COMPOSE exec -T "$1" $LARES meme get "$URI" --bag lares --json 2>&1; }
  json_text() { printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.data?.text??""))}catch{}})'; }
  json_hash() { printf '%s' "$1" | grep -oE '"canonicalHash":"[^"]+"' | head -1 | cut -d'"' -f4; }
  # Poll a hearth's `get` until its text carries `$2` (a slot marker) or the budget ends; echoes the JSON.
  await_meme() {
    local svc="$1" marker="$2" until=$((SECONDS + ${3:-90})) out=""
    while [ "$SECONDS" -lt "$until" ]; do
      out=$(meme_get "$svc")
      if printf '%s' "$out" | grep -q '"ok":true' && json_text "$out" | grep -qF "$marker"; then printf '%s' "$out"; return 0; fi
      sleep 3
    done
    printf '%s' "$out"; return 1
  }

  # THE RELAY STANDS FIRST, THEN ONE HEARTH AT A TIME — the boot lottery `realm-crossing` measured. Both
  # hearths take the compose default (herm-source) and peer through it: the only reading in this file
  # where two OPERATORS hold a transport between them, which a crossing needs before it can be measured.
  step "the relay stands FIRST — the hearths must not race a cold peer"
  if $COMPOSE up -d herm-source >/dev/null 2>&1 && up_and_answering herm-source; then ok
  else bad "the relay never answered"; clear_all; return; fi
  for svc in lararium-a lararium-b; do
    step "$svc stands, alone against a mesh already up"
    if $COMPOSE up -d --no-deps "$svc" >/dev/null 2>&1 && up_and_answering "$svc"; then ok
    else bad "$svc never stood"; dump_boot_failure "$svc"; clear_all; return; fi
  done

  if ! contract_ab; then clear_all; return; fi
  step "the phase leaves SEED — a Nexus stands over both"
  if $COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -q '"isNexus":true'; then ok
  else bad "the relation never stood"; clear_all; return; fi

  step "A puts the witness meme — the author's bag rides its meta"
  local PUT HASH_A
  meme_text a | $COMPOSE exec -T lararium-a sh -c 'cat > /tmp/npc.mem'
  PUT=$($COMPOSE exec -T lararium-a $LARES meme put "$URI" --recipe lares --file /tmp/npc.mem --json 2>&1)
  HASH_A=$(json_hash "$PUT")
  if printf '%s' "$PUT" | grep -q '"ok":true' && [ -n "$HASH_A" ]; then ok
  else bad "A's put refused"; printf '%s\n' "$PUT" | tail -3 | sed 's/^/      /'; clear_all; return; fi

  step "A promotes through the one shared door: act LOAD into bags/lares"
  local LD
  LD=$($COMPOSE exec -T lararium-a $LARES act LOAD --source-uri /tmp/npc.mem --to "$LARES_BAG" --yes --json 2>&1)
  if printf '%s' "$LD" | grep -q '"ok":true'; then ok
  else bad "the LOAD refused"; printf '%s\n' "$LD" | tail -3 | sed 's/^/      /'; clear_all; return; fi

  # A CONTROL ON A'S OWN SIDE: the bag read carries the author's line, and its hash is the put's. A
  # crossing that failed past this step failed in the carriage; one that failed here never left A.
  step "A's own bag read carries the line byte-whole, hash = the put's"
  local GA
  GA=$(await_meme lararium-a "<<~ ahu #/a>>" 30)
  if json_text "$GA" | grep -qE "$BAG_RE" && [ "$(json_hash "$GA")" = "$HASH_A" ] \
     && ! json_text "$GA" | grep -q '\$origin-bag'; then ok
  else bad "A's bag read disagrees with A's put"; printf '%s\n' "$GA" | tail -2 | cut -c1-300 | sed 's/^/      /'; fi

  # THE READING THE SCENARIO EXISTS FOR. B mounts `lares` too — her OWN registration of it. Whether A's
  # promotion reaches her names whether two operators' `lares` bags are ONE bag or two.
  # MEASURED 2026-09-11, and the finding is the seam: B answers `not-found`, and `wiki which` on B names
  # NO bag for the URI. `lar:///ha.ka.ba/bags/lares` names a doc EACH vessel founded for itself; the
  # contract writes A's members board and B's kept consent, never a bag. Two contracted operators hold
  # two `lares` bags with one name, and nothing in the relation carries one into the other. The lone
  # proven crossing (`meme-two-vessel-bag`) is a FLEET: the joiner dials the founder holding the
  # founder's own doc url (`LAR_JOIN_DOC`), which is one operator's bag on two devices — reach, never a
  # second operator. So the walk succeeds, the system's answer is no, and the step reports a GAP rather
  # than a red; the doc urls print beside it so a reading that ever shows ONE url on both sides wakes
  # the steps below.
  step "★ B gets it — the line byte-whole, canonicalHash = A's ★"
  local GB crossed=0
  if GB=$(await_meme lararium-b "<<~ ahu #/a>>" 90) \
     && json_text "$GB" | grep -qE "$BAG_RE" && [ "$(json_hash "$GB")" = "$HASH_A" ] \
     && ! json_text "$GB" | grep -q '\$origin-bag'; then ok; crossed=1
  else
    gap "B reads no meme — the relation carries no bag; each operator's \`lares\` is its own doc"
    printf '      B reads: %s\n' "$(printf '%s' "$GB" | tail -1 | cut -c1-200)"
    printf '      B which: %s\n' "$($COMPOSE exec -T lararium-b $LARES wiki which "$URI" --no-json 2>&1 | tr '\n' ' ' | tr -s ' ' | cut -c1-200)"
    for s in lararium-a lararium-b; do
      printf '      %s lares doc: %s\n' "$s" "$($COMPOSE exec -T "$s" $LARES wiki list 2>&1 \
        | grep -A1 '^  lares ' | grep -oE 'automerge:[A-Za-z0-9]+' | head -1)"
    done
    printf '      wakes when both sides name ONE doc: a bag the relation carries, not a fleet dial\n'
  fi
  # THE BYTES BEHIND A PUBLIC POINTER (tiddler-carriage #/measured, step 2). The law: a public pointer's
  # RECORD federates and its BYTES ride the public CAS — a peer holding the pointer fetches them by cid
  # over the public read-face and verifies `sha256(bytes) == cid` before it trusts a byte. This step
  # LOADs a `.png` on A (bytes into A's `cid/`, a pointer into A's bag) and asks the one content-addressed
  # public read-face the mesh stands — the Herm's bulb, `GET /bulb/<cid>.bin` — for that cid.
  # MEASURED 2026-09-11 (`bulb-serves-boot-cas-alone.test.ts`): the bulb answers the GENESIS manifest's
  # blobs alone (`bulb-read-face.ts` builds `blobByCid` off `buildBulb(bulb)`), so a hearth's staged blob
  # draws 404 — and no hearth ever hands its `cid/` to a Herm. The bytes-door this needs: a public-floor
  # `GET /cas/<cid>.bin` served off the holder's `cid/` tier (verify-on-pull like the bulb), reached by
  # the peer's resolver on a local miss (`makeCidResolver`, cas-transit.ts). Gated behind the bag seam:
  # until B reads A's bag, B holds no pointer to fetch for.
  step "★ a PUBLIC pointer's bytes: the Herm's read-face serves A's staged blob ★"
  local PNG_CID BULB_CODE
  $COMPOSE exec -T lararium-a sh -c 'mkdir -p /tmp/blob/bags/lares/t.witness.blob && printf "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > /tmp/blob/bags/lares/t.witness.blob/photo.png && printf "type: image/png\n" > /tmp/blob/bags/lares/t.witness.blob/photo.png.meta' 2>/dev/null
  LD=$($COMPOSE exec -T lararium-a $LARES act LOAD --source-uri /tmp/blob/bags/lares/t.witness.blob --to "$LARES_BAG" --yes --json 2>&1)
  PNG_CID=$($COMPOSE exec -T lararium-a sh -c 'sha256sum /tmp/blob/bags/lares/t.witness.blob/photo.png' 2>/dev/null | cut -c1-64)
  BULB_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:18092/bulb/${PNG_CID}.bin" 2>/dev/null || printf 000)
  if printf '%s' "$LD" | grep -q '"ok":true' && [ "$BULB_CODE" = "200" ]; then ok
  elif printf '%s' "$LD" | grep -q '"ok":true'; then
    gap "the bulb serves the boot CAS alone — A's blob draws ${BULB_CODE}; no public-floor cid door stands"
    printf '      A staged: %s\n' "$($COMPOSE exec -T lararium-a $LARES bag cas --no-json 2>&1 | sed -n 2p | sed 's/^ *//')"
    printf '      herm-source GET /bulb/%s.bin → %s\n' "${PNG_CID:0:16}…" "$BULB_CODE"
    printf '      wakes when a holder serves GET /cas/<cid>.bin off its cid/ tier, verify-on-pull\n'
  else bad "A's pointer LOAD refused"; printf '%s\n' "$LD" | tail -2 | cut -c1-300 | sed 's/^/      /'; fi

  if [ "$crossed" -eq 0 ]; then
    step "B projects · B edits and A gets it · PARTITION"
    gap "unwalkable until the crossing stands — nothing on B to project, edit, or cut"
    step "★ B fetches the pointer's BYTES from A's public CAS ★"
    gap "unwalkable until the crossing stands — B holds no pointer to fetch for"
    run_meme_browser
    clear_all; return
  fi

  step "B projects it to md — the pair renders"
  local PJ
  PJ=$($COMPOSE exec -T lararium-b $LARES meme project "$URI" --to md --bag lares --json 2>&1)
  if printf '%s' "$PJ" | grep -q '"ok":true' && printf '%s' "$PJ" | grep -q '"meta"'; then ok
  else bad "B's projection refused"; printf '%s\n' "$PJ" | tail -2 | cut -c1-300 | sed 's/^/      /'; fi

  step "B edits on the base she read, promotes; A gets the new slot"
  local HASH_B GB2 GA2
  HASH_B=$(json_hash "$GB")
  meme_text a b | $COMPOSE exec -T lararium-b sh -c 'cat > /tmp/npc-b.mem'
  # The shared bag refuses a put outright (CONTROL); the edit rides the promotion door.
  if $COMPOSE exec -T lararium-b $LARES meme put "$URI" --bag lares --base "$HASH_B" --file /tmp/npc-b.mem --json 2>&1 | grep -q '"ok":true'; then
    bad "B's put --bag lares LANDED — the shared bag must refuse a placement"; clear_all; return; fi
  LD=$($COMPOSE exec -T lararium-b $LARES act LOAD --source-uri /tmp/npc-b.mem --to "$LARES_BAG" --yes --json 2>&1)
  if ! printf '%s' "$LD" | grep -q '"ok":true'; then
    bad "B's LOAD refused"; printf '%s\n' "$LD" | tail -2 | cut -c1-300 | sed 's/^/      /'; clear_all; return; fi
  if GA2=$(await_meme lararium-a "<<~ ahu #/b>>" 90) && json_text "$GA2" | grep -qE "$BAG_RE"; then ok
  else bad "A never read B's edit"; printf '%s\n' "$GA2" | tail -1 | cut -c1-300 | sed 's/^/      /'; fi

  # UNDER PARTITION. B leaves the mesh network — the idiom `herm-mesh-partition.mjs` uses on the relay,
  # applied to the operator — edits while cut, returns, and A reads the edit once the seam heals.
  step "PARTITION: B is cut, edits while cut, returns — A gets the edit"
  local NET="dreamnet-mesh_mesh" CB="dreamnet-mesh-lararium-b-1"
  if ! docker network disconnect "$NET" "$CB" >/dev/null 2>&1; then bad "could not cut B off the mesh"; clear_all; return; fi
  meme_text a b c | $COMPOSE exec -T lararium-b sh -c 'cat > /tmp/npc-c.mem'
  LD=$($COMPOSE exec -T lararium-b $LARES act LOAD --source-uri /tmp/npc-c.mem --to "$LARES_BAG" --yes --json 2>&1)
  local cut_ok=1; printf '%s' "$LD" | grep -q '"ok":true' || cut_ok=0
  # A MUST NOT see it while B is cut — a slot that crosses a partition names a channel that is not the mesh.
  local leaked=0; GA2=$(meme_get lararium-a); json_text "$GA2" | grep -qF "<<~ ahu #/c>>" && leaked=1
  docker network connect "$NET" "$CB" >/dev/null 2>&1 || { bad "could not return B to the mesh"; clear_all; return; }
  if [ "$cut_ok" -eq 0 ]; then bad "B's LOAD refused while cut — a sovereign vessel writes offline"; printf '%s\n' "$LD" | tail -2 | cut -c1-300 | sed 's/^/      /'
  elif [ "$leaked" -eq 1 ]; then bad "A read B's edit WHILE B was cut — the partition did not partition"
  elif GA2=$(await_meme lararium-a "<<~ ahu #/c>>" 180) && json_text "$GA2" | grep -qE "$BAG_RE"; then ok
  else
    gap "B's offline edit never reached A after the return — the seam is the RECONNECT, not the write"
    printf '      A reads: %s\n' "$(printf '%s' "$GA2" | tail -1 | cut -c1-200)"
    $COMPOSE logs --since 4m lararium-b 2>&1 | grep -iE "reconnect|disconnect|peer|socket" | tail -3 | sed 's/^/      /'
  fi

  run_meme_browser
  clear_all
}

# THE BROWSER LEG. `browser-a` shares A's namespace and runs the probe; its exit code is the verdict, and
# the face lines print beside it so the reading carries what the island actually answered.
run_meme_browser() {
  step "browser-a: the island speaks the laws in Chromium's worker"
  if ! $COMPOSE up -d --no-deps browser-a >/dev/null 2>&1; then bad "browser-a would not start"; return; fi
  # The island boots cold in the container — genesis over the probe's own server, TW5, keyhive WASM — and
  # only then does the face answer; the budget carries the boot AND the probe's budgeted close.
  local code deadline=$((SECONDS + 420))
  while [ "$(browser_verdict browser-a)" = "" ] && [ "$SECONDS" -lt "$deadline" ]; do sleep 3; done
  code=$(browser_verdict browser-a)
  if [ "$code" = "0" ]; then ok; else bad "browser exit ${code:-timeout}"; fi
  $COMPOSE logs browser-a 2>&1 | grep -E "meme-face|REFUSED|speaks the laws|page:" | sed 's/^[^|]*| //' | sed 's/^/      /'
}

case "$WANT" in
  operator-a) run_operator a ;;
  operator-b) run_operator b ;;
  nexus)      run_nexus ;;
  quorum)     run_quorum ;;
  relation)   run_relation ;;
  realm)      run_realm ;;
  realm-crossing) run_realm_crossing ;;
  quorum-realm)   run_quorum_realm ;;
  open)       run_open ;;
  crossing)   run_crossing ;;
  open-relation) run_open_relation ;;
  leaf)       run_leaf ;;
  meme)       run_meme ;;
  all)        run_operator a; run_operator b; run_quorum; run_relation; run_realm; run_open; run_open_relation; run_leaf; run_crossing; run_nexus; run_realm_crossing; run_quorum_realm; run_meme ;;
  *) echo "mesh-scenarios: unknown scenario \"$WANT\" (operator-a | operator-b | nexus | quorum | relation | realm | open | crossing | open-relation | leaf | realm-crossing | quorum-realm | meme | all)" >&2; exit 2 ;;
esac

say "═══ RESULT ═══"
if [ "$FAILED" -eq 0 ]; then
  echo "  every scenario stood: each operator alone, and the mesh carrying."
  exit 0
fi
echo "  $FAILED step(s) FAILED — a lone-operator failure belongs to that boot, never to the federation."
exit 1
