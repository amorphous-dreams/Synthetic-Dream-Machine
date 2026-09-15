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
# ── AND SIX THAT WALK SEAMS RATHER THAN CELLS ───────────────────────────────────────────────────
#   climb        one operator, a face used before a charter   the bricking climb (REGRESSION GUARD)
#   seal         one operator, the archive's own boot reading a wrong key that reads as no key
#   title        one operator, the userinfo ban               enforcement, body-passthrough, the allowed form
#   wikis        one operator, NO cabal                       which layer took the save
#   conflict     one operator, both hands on one carrier      surface, never overwrite — and the rail
#   board        two operators, one charter                   the gradient's three states
#
# EACH NAMES WHAT MAKES IT RED in its own header, and the two that stand green the day they land say
# so rather than implying a repro. A scenario that cannot go red proves less than nothing.
#
# ── HOW A LONE OPERATOR STANDS ──────────────────────────────────────────────────────────────────
# `--no-deps` withholds the herms `depends_on` would otherwise drag in, and `LAR_x_PEERS=` blanks the
# bootstrap list. `peers` filters empty away, so a vessel with none is a supported shape rather than a
# broken one — which is the point: an operator who cannot stand alone has no sovereignty to federate.
#
# The browser vessel shares its operator's network namespace, so both names ride together, always.
#
# Usage:  tools/mesh-scenarios.sh [operator-a | operator-b | nexus | quorum | relation | realm | open |
#                                  crossing | open-relation | leaf | realm-crossing | quorum-realm | meme |
#                                  climb | seal | title | wikis | conflict | board | all]
# Green:  every named scenario's browser vessel exits 0 and its hearth answers.
set -uo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.mesh.yml"
WANT="${1:-all}"
FAILED=0
ARTIFACT_DIR="${ARTIFACT_DIR:-}"
if [ -n "$ARTIFACT_DIR" ]; then mkdir -p "$ARTIFACT_DIR"; fi

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
capture_mesh_state() {
  [ -n "$ARTIFACT_DIR" ] || return 0
  {
    printf '\n── mesh compose state before teardown (%s) ──\n' "$(date -u +%FT%TZ)"
    $COMPOSE ps
    $COMPOSE logs --no-color
  } >>"$ARTIFACT_DIR/mesh-compose.log" 2>&1 || true
}

clear_all() {
  capture_mesh_state
  $COMPOSE down -v >/dev/null 2>&1 || true
  local deadline=$((SECONDS + 60))
  while docker network ls --format '{{.Name}}' | grep -q '^dreamnet-mesh_mesh$' && [ "$SECONDS" -lt "$deadline" ]; do
    sleep 1
  done
}

# Reject a typo before arming the EXIT trap: an invalid request must not tear down a mesh another
# operator owns merely because this runner parsed its argument.
case "$WANT" in
  operator-a|operator-b|nexus|quorum|relation|realm|realm-crossing|quorum-realm|open|crossing|open-relation|leaf|meme|climb|seal|title|wikis|conflict|board|all) ;;
  *) echo "mesh-scenarios: unknown scenario \"$WANT\" (operator-a | operator-b | nexus | quorum | relation | realm | open | crossing | open-relation | leaf | realm-crossing | quorum-realm | meme | climb | seal | title | wikis | conflict | board | all)" >&2; exit 2 ;;
esac

# `all` already clears after each scenario. This covers early returns and CI cancellation, when the
# fixed compose project would otherwise be left holding volumes or a network for the next scheduled run.
trap clear_all EXIT
trap 'exit 130' INT TERM

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

# HOW MANY TIMES A PATTERN STANDS IN A SERVICE'S LOG — the counting twin of `logs_have`, and it
# exists for the same reason: `grep -q` over a growing container log closes the pipe at the first
# match, the producer takes SIGPIPE, and under `pipefail` the pipeline reads FAILURE exactly when the
# pattern MATCHED. Measured again on this file's own new readings — three steps reported a vessel
# that had plainly done the thing. `grep -c` reads to the end, so nothing is signalled.
#
# `$1` = extended regex · `$2` = service · `$3` (optional) = a `--since` window.
logs_count() {
  local pattern="$1" svc="$2" since="${3:-}"
  local n
  if [ -n "$since" ]; then n=$($COMPOSE logs --since "$since" "$svc" 2>&1 | grep -cE "$pattern")
  else                     n=$($COMPOSE logs "$svc" 2>&1 | grep -cE "$pattern"); fi
  printf '%s' "${n:-0}"
}

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
  step "lararium-a stands, alone against a mesh already up"
  if $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 && up_and_answering lararium-a; then ok
  else bad "lararium-a never stood"; dump_boot_failure lararium-a; clear_all; return; fi

  # THE DIRECT DIAL. The hearths peer through the herm's FLOW-map for the public shelf and sealed bodies; the
  # member-read lane a realm bag rides is Automerge sync over B's dial to A's `/ws` — B presents her own
  # root's edge in the wire's CONTRACT slot, A admits the card at the floor and binds the wire key to the nym
  # B contracts under. The dial binds its proof to A's gate key (out-of-band, never the wire), so B stands
  # only once A has said it.
  step "A's gate key read off her boot; B stands dialing A"
  local GATE_A
  GATE_A=$($COMPOSE logs lararium-a 2>&1 | grep -oE 'gate key: [0-9a-f]{64}' | head -1 | cut -d' ' -f3)
  if [ -z "$GATE_A" ]; then bad "A logged no gate key"; clear_all; return; fi
  if LAR_B_JOIN_SYNC="ws://lararium-a:8080/ws" LAR_B_JOIN_GATE="$GATE_A" \
       $COMPOSE up -d --no-deps lararium-b >/dev/null 2>&1 && up_and_answering lararium-b; then ok
  else bad "lararium-b never stood"; dump_boot_failure lararium-b; clear_all; return; fi

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

  # THE REALM BAG (realm-bag-brief, ruled 2026-09-11). Both sides re-fold the relation they just stood — A's
  # running node folds the admit its CLI wrote beside it, B stands the realm the imported charter names — and
  # A registers her `lares` on the realm's shared CRDT: steward-signed, read at CONTRACT, @crossroads naming
  # only that it exists and who keeps it.
  step "both sides re-fold the relation; the realm stands under ONE doc id"
  local RA RB
  RA=$($COMPOSE exec -T lararium-a $LARES nexus refresh --json 2>&1 | grep -oE '"realmDoc":"[^"]*"' | head -1)
  RB=$($COMPOSE exec -T lararium-b $LARES nexus refresh --json 2>&1 | grep -oE '"realmDoc":"[^"]*"' | head -1)
  if [ -n "$RA" ] && [ "$RA" = "$RB" ]; then ok
  else bad "the two sides name different realm docs"; printf '      A: %s\n      B: %s\n' "$RA" "$RB"; fi

  step "A registers bags/lares on the realm — steward-signed, read at CONTRACT"
  local REG
  REG=$($COMPOSE exec -T lararium-a $LARES nexus realm-bag lares --json 2>&1)
  if printf '%s' "$REG" | grep -q '"readTier":"contract"'; then ok
  else bad "the registration refused"; printf '%s\n' "$REG" | tail -2 | cut -c1-300 | sed 's/^/      /'; fi

  # A CONTROL ON A'S OWN SIDE: the bag read carries the author's line, and its hash is the put's. A
  # crossing that failed past this step failed in the carriage; one that failed here never left A.
  step "A's own bag read carries the line byte-whole, hash = the put's"
  local GA
  GA=$(await_meme lararium-a "<<~ ahu #/a>>" 30)
  if json_text "$GA" | grep -qE "$BAG_RE" && [ "$(json_hash "$GA")" = "$HASH_A" ] \
     && ! json_text "$GA" | grep -q '\$origin-bag'; then ok
  else bad "A's bag read disagrees with A's put"; printf '%s\n' "$GA" | tail -2 | cut -c1-300 | sed 's/^/      /'; fi

  # THE READING THE SCENARIO EXISTS FOR. The realm carries A's registration; B's `meme get --bag lares` walks
  # the realm plane first (reach-by-access) and reads A's doc across the dial — A's wire gate federates the
  # realm doc and the registered bag's doc to a contracted MEMBER and to nobody else.
  step "★ B gets it — the line byte-whole, canonicalHash = A's ★"
  local GB crossed=0
  if GB=$(await_meme lararium-b "<<~ ahu #/a>>" 90) \
     && json_text "$GB" | grep -qE "$BAG_RE" && [ "$(json_hash "$GB")" = "$HASH_A" ] \
     && ! json_text "$GB" | grep -q '\$origin-bag'; then ok; crossed=1
  else
    bad "B reads no meme"
    printf '      B reads:      %s\n' "$(printf '%s' "$GB" | tail -1 | cut -c1-200)"
    printf '      B realm-bags: %s\n' "$($COMPOSE exec -T lararium-b $LARES nexus realm-bags --json 2>&1 | grep -oE '"bags":\[[^]]*\]' | head -1 | cut -c1-200)"
    printf '      A realm-bags: %s\n' "$($COMPOSE exec -T lararium-a $LARES nexus realm-bags --json 2>&1 | grep -oE '"bags":\[[^]]*\]' | head -1 | cut -c1-200)"
    printf '      B dial:       %s\n' "$($COMPOSE logs lararium-b 2>&1 | grep -E '\[nexus-join\] presenting|\[lar-leaf\] (verdict|ANERGIZED)' | tail -2 | tr '\n' ' ' | cut -c1-200)"
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

  # THE STEWARD WRITE PATH. The read cap is CONTRACT (every contracted member); the write cap is the NAMED
  # STEWARDS' SET. A names B a steward — n-of-n, so the naming is a PROPOSAL B completes with her own co-sign
  # — and B's `meme put --bag lares` then resolves the REALM doc rather than refusing.
  step "B edits on the base she read, promotes; A gets the new slot"
  local HASH_B GB2 GA2 NYM_B REG COSIGN PUT
  HASH_B=$(json_hash "$GB")
  meme_text a b | $COMPOSE exec -T lararium-b sh -c 'cat > /tmp/npc-b.mem'
  # CONTROL: before her naming, B's put refuses — a member at the read tier writes nothing.
  if $COMPOSE exec -T lararium-b $LARES meme put "$URI" --bag lares --base "$HASH_B" --file /tmp/npc-b.mem --json 2>&1 | grep -q '"ok":true'; then
    bad "B's put --bag lares LANDED BEFORE her naming — the read tier must refuse a placement"; clear_all; return; fi
  NYM_B=$($COMPOSE exec -T lararium-b $LARES nexus accept-carriage --json 2>&1 | grep -oE '"nym":"[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  REG=$($COMPOSE exec -T lararium-a $LARES nexus realm-bag lares --steward "$NYM_B" --json 2>&1)
  COSIGN=$($COMPOSE exec -T lararium-b $LARES nexus realm-bag lares --cosign --json 2>&1)
  PUT=$($COMPOSE exec -T lararium-b $LARES meme put "$URI" --bag lares --base "$HASH_B" --file /tmp/npc-b.mem --json 2>&1)
  if ! printf '%s' "$PUT" | grep -q '"ok":true'; then
    bad "B's put --bag lares refused AFTER her co-sign — the steward write path never resolved"
    printf '      A names B:  %s\n' "$(printf '%s' "$REG" | tail -1 | cut -c1-220)"
    printf '      B co-signs: %s\n' "$(printf '%s' "$COSIGN" | tail -1 | cut -c1-220)"
    printf '      B puts:     %s\n' "$(printf '%s' "$PUT" | tail -1 | cut -c1-220)"
    clear_all; return; fi
  if GA2=$(await_meme lararium-a "<<~ ahu #/b>>" 90) && json_text "$GA2" | grep -qE "$BAG_RE"; then ok
  else
    # MEASURED: B's gate opens a realm-carried doc to a peer her OWN membership names a MEMBER, and B
    # contracted INTO A's nexus rather than admitting him — her member set is empty, so she announces nothing
    # back. The realm DOC crosses both ways off the deterministic public shelf; A's private bag doc does not.
    gap "B's placement stands on the realm doc and never crosses — the RETURN LANE is the seam, not the write"
    printf '      B puts:  %s\n' "$(printf '%s' "$PUT" | tail -1 | cut -c1-200)"
    printf '      A reads: %s\n' "$(printf '%s' "$GA2" | tail -1 | cut -c1-200)"
    printf '      wakes when a proof lets B federate a realm-carried doc back to the charter she holds\n'
  fi

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

# COVERS: private/multisig/unfed
# A LEG, NOT A SCENARIO OF ITS OWN. `run_meme` calls this on both its paths, so it walks that
# scenario's cell and claims it by name — the coverage witness reads claims per `run_*()`, and a leg
# that declares nothing reads as a walk nobody described.
# THE BROWSER LEG. `browser-a` shares A's namespace and runs the probe; its exit code is the verdict, and
# the face lines print beside it so the reading carries what the island actually answered.
#
# WHAT THIS LEG CANNOT CARRY. The probe boots an ISLAND — a module Web Worker holding its own `$tw` — and
# an island registers no `module-type: syncadaptor`, so `$tw.syncer` never stands in it and the stock
# syncer's back-parity flow has nothing here to run against. None of the six flows (a root's save, a slot
# child's save, either delete, the `syncFromServer` poll, the `revision`/`bag` stamps, the `$:/` filter)
# can ride this container. They need a plain `tiddlywiki --listen` carrying the packed plugin plus a
# Chromium loading it over the stock `tiddlyweb` + `filesystem` pair, which
# `packages/lararium-tw5/tests/syncer-back-parity.e2e.test.ts` already stands without docker — a second
# spelling of it here would buy a second place for one measurement to drift.
# See lar:///ha.ka.ba/lares/docs/pono/syncer-back-parity.
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

# ════════════════════════════════════════════════════════════════════════════════════════════════
# THE SIX READINGS BELOW WALK SEAMS, NEVER PIECES — the class every defect this harness has found
# lives in. Each names what makes it RED, because a scenario that cannot go red proves less than
# nothing: this house has measured that failure more than a dozen times (a check that ran, measured
# nothing, and reported success).
#
# TWO OF THEM STAND GREEN THE DAY THEY LAND, and they say so rather than implying a repro. `climb`
# and `board` were written against a claimed brick that the tree had already cured — MEASURED here,
# not assumed: the climb boots in 15s and the island line reads `[persona-kel] carried 1 event(s)
# … up the gradient`. They stand as REGRESSION GUARDS, and the label is the honest half.
# ════════════════════════════════════════════════════════════════════════════════════════════════

# ── ① THE BRICKING CLIMB ────────────────────────────────────────────────────────────────────────
# THE WALK: `vessel found` → a face → USE IT → `nexus rite cabal` → restart. The founding face's
# inception seats on the persona-KEL board keyed by the island resolved AT THAT MOMENT, which for an
# unconnected hearth is its OWN key (`personaKelBoardDocUrl(nexusPubkey)`, deterministic-doc.ts:95).
# Seating a charter re-keys that board to the charter's genesis epoch, and the Binding Gate refuses
# rather than degrades — `open-node-vessel.ts:1174`.
#
# ⚠ THIS SCENARIO STANDS GREEN TODAY, AND THAT IS THE MEASUREMENT RATHER THAN A GAP IN IT.
# `carryPersonaKelUpTheGradient` runs BEFORE the gate walks (open-node-vessel.ts:1168) and moves the
# pinned chain onto the island this boot resolved. Walked in a container 2026-09-13: the vessel
# answered 15s after the restart, `restarts=0`, and the halt string appeared ZERO times. So this is
# a regression guard on a cure that landed, never a repro of a live brick.
#
# WHAT WOULD MAKE IT RED AGAIN, quoted from the halt it guards:
#   "[lararium] persona-KEL chain for the pinned identifier … absent from the local board replica
#    — the Binding Gate cannot reach a head (fail-closed)."
# The `…` is a real U+2026 and the dash an em-dash, so the probe greps the ASCII-safe head.
#
# THE HARNESS HAS NEVER WALKED THIS ORDERING. `lararium-container-boot.sh` seats the cabal BEFORE it
# serves, so every other scenario in this file stands a vessel whose charter was seated at genesis.
# The climb seats one against a RUNNING vessel, after the face has already written — which is the
# operator's actual lifecycle ("standing a hearth up and connecting it to a Nexus LATER is a
# first-class flow", the vessel's own boot line) and the ordering the brick needed.
# COVERS: private/seed/unfed
run_climb() {
  say "CLIMB — a face is used, a charter seats after it, and the vessel still boots"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local URI="lar:///t.climb.witness/one"

  # NO KAHU AT BOOT. `LAR_A_KAHU=` blanks `LAR_STAND_KAHU`, so the boot skips its seating block and
  # this vessel stands the way an operator's actually does on day one: a face, and no charter.
  step "A stands with a face and NO charter"
  if LAR_A_PEERS= LAR_A_KAHU= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1; then ok
  else bad "up"; return; fi
  if up_and_answering lararium-a; then :; else
    bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  # NEGATIVE ①a — A VESSEL THAT NEVER SEATS A CHARTER STILL BOOTS. Without this the scenario cannot
  # tell "the climb bricked it" from "this vessel never booted at all", and the whole reading would
  # rest on a boot nobody proved.
  step "NEG a — the island reads a PRIVATE NEXUS OF ONE, and a bounce keeps it"
  if [ "$(logs_count '\[nexus\] island .* \(own\)' lararium-a)" -gt 0 ]; then
    $COMPOSE restart lararium-a >/dev/null 2>&1
    if up_and_answering lararium-a; then ok; else bad "a charterless vessel did not survive a bounce"; fi
  else bad "a charterless vessel did not read as a private nexus of one"; fi

  step "the face is WORN and USED — a carrier lands under it"
  $COMPOSE exec -T lararium-a $LARES persona wear 0 >/dev/null 2>&1
  $COMPOSE exec -T lararium-a sh -c "printf '<<^ code=\"&#x0001;\" from=? -> to=$URI>>\n\`\`\`toml meta\nuri-path = \"t.climb.witness/one\"\n\`\`\`\n\n<<^ code=\"&#x0002;\">>\n\n<<^ code=\"&#x0003;\">>\n\n<<^ code=\"&#x0004;\" -> to=?>>\n' > /tmp/climb.mem" 2>/dev/null
  if $COMPOSE exec -T lararium-a $LARES meme put "$URI" --recipe lares --file /tmp/climb.mem --json 2>&1 \
     | grep -q '"ok":true'; then ok; else bad "the face wrote nothing — the climb has no inception to strand"; fi

  # THE RE-KEYING ACT. `rite cabal` composes seal reserve · seal seat · seal show; the seat writes the
  # roster and `sealEpochCid` becomes the island every later boot resolves.
  step "the charter seats AFTER the face — the board re-keys"
  local i EPOCH
  for i in 0 1 2; do
    $COMPOSE exec -T lararium-a $LARES persona new "$i" --name "kahu-$i" --handle "Kahu $i" --seat >/dev/null 2>&1 || true
  done
  $COMPOSE exec -T lararium-a $LARES nexus rite cabal >/dev/null 2>&1
  EPOCH=$($COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 \
          | grep -oE '"sealEpochCid":"epoch0-[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  if [ -n "$EPOCH" ]; then ok; else bad "no charter seated — nothing re-keyed, so the climb never happened"; clear_all; return; fi

  # ★ THE READING THIS SCENARIO EXISTS FOR ★
  # POLL FOR THE ISLAND LINE, never read once. The vessel answers its verb socket before it has
  # printed the crossroads reading, so a single read here times the harness rather than the climb.
  step "★ RESTART: the vessel boots, and the island CLIMBED ★"
  $COMPOSE restart lararium-a >/dev/null 2>&1
  local climbed=0 cd=$((SECONDS + 240))
  if up_and_answering lararium-a 240; then
    while [ "$SECONDS" -lt "$cd" ]; do
      [ "$(logs_count '\(charter, shared\)' lararium-a)" -gt 0 ] && { climbed=1; break; }
      sleep 5
    done
  fi
  if [ "$climbed" -eq 1 ]; then ok
  else
    bad "the vessel never came back, or the island did not climb"
    dump_boot_failure lararium-a
  fi

  step "the carry ran, and the Binding Gate never halted"
  local HALTS
  HALTS=$($COMPOSE logs --since 6m lararium-a 2>&1 | grep -cF "persona-KEL chain for the pinned identifier")
  if logs_have "up the gradient" lararium-a && [ "${HALTS:-0}" -eq 0 ]; then ok
  else
    bad "the carry did not run, or the gate halted ${HALTS} time(s)"
    $COMPOSE logs --since 6m lararium-a 2>&1 | grep -E "persona-kel|Binding Gate" | tail -3 | cut -c1-220 | sed 's/^/      /'
  fi

  # NEGATIVE ①b — A TORN CHARTER MUST NOT SILENTLY RE-KEY. The gradient ratchets on INTENT, never on
  # accident: `nexusIdentity` holds "a Nexus this vessel KNOWS and cannot READ" apart as its own state
  # (nexus-identity.ts:153), and `nexusScopeOrThrow` throws rather than handing back anything a `??`
  # could absorb. Falling to the vessel's own key here "would descend a serving vessel to a private
  # board on an accident: it would believe it published while every peer watched it vanish".
  #
  # THE TEAR IS SURGICAL: the charter FILE stands (so `charterStands` reads true) and its genesis epoch
  # reads as no island. That is the exact conflation the record names as //the torn charter//.
  # THE FLOOR READING IS COUNTED AS A DELTA, never as an absolute. This scenario's own charterless
  # opening legitimately printed `(own)` lines, so an absolute count reads the vessel's honest past as
  # this step's failure — measured: the step failed reporting one floor reading that predated the tear
  # by two restarts. What the negative asks is whether the TEAR produced a NEW one.
  step "NEG b — a TORN charter REFUSES, and never falls to the floor"
  local OWN_BEFORE OWN_AFTER
  OWN_BEFORE=$(logs_count '\[nexus\] island .* \(own\)' lararium-a)
  $COMPOSE exec -T lararium-a sh -c 'sed -i "s/epoch0-[0-9a-f]*/epoch0-ZZZTORNZZZ/g" /lar-a/data/lares/nexus/founding-roster.mem' 2>/dev/null
  $COMPOSE restart lararium-a >/dev/null 2>&1
  # THE VESSEL IS EXPECTED TO DIE HERE, and `restart: on-failure:8` means it dies eight times. Wait for
  # the refusal to appear rather than for an exit, so a cure that refuses WITHOUT dying still reads.
  local d=$((SECONDS + 180)) tornseen=0
  while [ "$SECONDS" -lt "$d" ]; do
    [ "$(logs_count 'the island reads TORN, so no board may be addressed' lararium-a)" -gt 0 ] && { tornseen=1; break; }
    sleep 5
  done
  OWN_AFTER=$(logs_count '\[nexus\] island .* \(own\)' lararium-a)
  if [ "$tornseen" -eq 1 ] && [ "$OWN_AFTER" -eq "$OWN_BEFORE" ]; then ok
  else
    bad "a torn charter did not refuse, or it re-keyed to its own board (floor readings ${OWN_BEFORE} → ${OWN_AFTER})"
    $COMPOSE logs --since 4m lararium-a 2>&1 | tail -4 | cut -c1-220 | sed 's/^/      /'
  fi

  # NEGATIVE ①c — THE GATE STILL HALTS WHEN A CHAIN IS GENUINELY ABSENT. A cure that carried the chain
  # by WIDENING the gate would pass every step above and remove the fail-closed property entirely, so
  # the guard has to see the gate still refuse for an unrelated reason.
  #
  # THE STATE IS NOT CONSTRUCTIBLE FROM OUTSIDE THE VESSEL, measured: the pinned prefix lives in the
  # daemon bag and the chain in an Automerge board, and nothing on the CLI surface strands one without
  # also stranding the other. `gap`, never `bad` — the walk succeeded and the system's answer was no.
  step "NEG c — the gate still halts on a genuinely absent chain"
  gap "unconstructible from the CLI surface — no door strands a pinned prefix without its board"
  printf '      the gate stands at open-node-vessel.ts:1174 and unit-tests reach it; a container cannot\n'
  printf '      wakes when a door pins a persona-KEL prefix independently of seating its chain\n'
  clear_all
}

# ── ② THE SEAL DESTRUCTION, IN THE SHAPES A UNIT TEST CANNOT REACH ──────────────────────────────
# `archive-write-guard-attacks.test.ts` already stands 15 attacks at unit grain, and they are real
# cures. Every one of them drives an IN-PROCESS function under `mkdtemp` — no daemon, no CLI process,
# no boot path. This reading walks the two shapes that live outside that reach.
#
# ⚠ RED TODAY, and the tree names it in its own test title (attack 14, :390):
#     "★ a boot-sealed archive leaves `sealExpected` FALSE — the five readings never probe a wrong key ★"
# `readArchiveOpening` (archive-passphrase.ts:497) short-circuits before it ever probes:
#     if (!readSealExpected(cfg)) return { kind: "no-seal-expected", opens: true, probed: false, … };
# So a vessel sealed by the BOOT's M3 export — never by `vault seal` — carries `sealExpected:false`,
# and a wrong passphrase reads `opens:true` at the floor. The write guard still catches the CARRIER
# write; the boot's own gate does not, and only a booted vessel can show that.
#
# AND THE SECOND SHAPE: the M3 refusal is SWALLOWED. operator-daemon-behavior.ts:672 catches the
# guard's throw into `console.warn` — "[daemon] keyhive archive export skipped: " — so a refused
# re-seal leaves exit code 0 and a warn line. A green boot is not a written archive.
# COVERS: private/seed/unfed
run_seal() {
  say "SEAL — the boot path's own reading of a wrong key, and the refusal it swallows"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  step "A stands and seals its archive from the BOOT (never \`vault seal\`)"
  if LAR_A_PEERS= LAR_A_KAHU= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 \
     && up_and_answering lararium-a; then ok
  else bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  step "the floor names what the archive did — the reading is stdout, never an exit code"
  local OPENING
  OPENING=$($COMPOSE logs lararium-a 2>&1 | grep -oE 'the archive holds shut \([a-z-]+\)' | tail -1)
  if [ -n "$OPENING" ]; then
    printf '\033[33mGAP (%s)\033[0m\n' "the floor reads: ${OPENING}"
  else ok; fi

  # ★ THE READING. A wrong passphrase must not read as an opening one. `sealExpected:false` is exactly
  # the state a boot-sealed vessel carries, so this asks the vessel the question its own test defers.
  step "★ a WRONG passphrase must NOT read as \`opens\` at the floor ★"
  local ST
  ST=$($COMPOSE exec -T -e LARES_ARCHIVE_PASSPHRASE="a-passphrase-that-never-sealed-anything" \
        lararium-a $LARES vault status --json 2>&1)
  if printf '%s' "$ST" | grep -q '"sealExpected":true'; then ok
  else
    bad "the vessel reads no seal in force under a wrong key — a wrong passphrase reads as opening"
    printf '      %s\n' "$(printf '%s' "$ST" | grep -oE '"sealExpected":[a-z]+|"split":[a-z]+|"passphraseEnvSet":[a-z]+' | tr '\n' ' ')"
    printf '      archive-passphrase.ts:497 returns no-seal-expected/opens:true before it probes\n'
  fi

  # THE SWALLOWED REFUSAL. A boot whose M3 export the guard refused still exits 0; the only witness is
  # a warn line. A scenario that read the exit code alone would call this vessel healthy.
  step "a refused M3 export surfaces as a WARN, never an exit — assert the line is reachable"
  if logs_have "keyhive archive export skipped:" lararium-a; then
    ok
  else
    gap "no refusal fired this boot — the swallow is unproven from a healthy vessel"
    printf '      operator-daemon-behavior.ts:672 catches the guard throw into console.warn\n'
    printf '      wakes when the scenario can seat a carrier the guard refuses, then boot over it\n'
  fi

  # CONTROL — THE GCM TAG PROVES INTENT, AND A CORRECT ROTATE MUST STILL SUCCEED. Without this the
  # whole family could be "cured" by refusing every write, which is the failure wearing a fix's face.
  step "CONTROL — a correct rotate still succeeds"
  local ROT
  ROT=$($COMPOSE exec -T -e LARES_ARCHIVE_PASSPHRASE="" -e LARES_ARCHIVE_PASSPHRASE_NEW="a-new-one" \
        lararium-a $LARES vault rotate --yes --json 2>&1)
  if printf '%s' "$ROT" | grep -q '"ok":true'; then ok
  else
    gap "the rotate refused on this vessel — a cleartext floor has no old passphrase to rotate FROM"
    printf '      %s\n' "$(printf '%s' "$ROT" | tail -1 | cut -c1-200)"
  fi

  # THE EXPORT DOOR, WALKED AGAINST A LIVE VESSEL. The refusal is built (archive-passphrase.ts:324) and
  # unit-tested; what no test walks is the CLI process reaching it through a running daemon.
  step "\`vault export\` aimed at the archive carrier REFUSES"
  local EX
  EX=$($COMPOSE exec -T lararium-a $LARES vault export /lar-a/data/lares/identity/keyhive-archive.bin --force --json 2>&1)
  if printf '%s' "$EX" | grep -qF 'refusing to export onto the'; then ok
  else
    bad "the export did not refuse the carrier it would destroy"
    printf '      %s\n' "$(printf '%s' "$EX" | tail -1 | cut -c1-220)"
  fi

  # THE UNGUARDED INDEX. `carriers()` (archive-passphrase.ts:82) enumerates a BARE `deviceSharePath()`
  # — handle 0 alone — so `recovery-device-share-h1.bin` and higher sit outside rotate, repair, status
  # and the export refusal entirely. A vessel running a second face carries a share nothing guards.
  step "a SECOND handle's device share sits outside the guarded set"
  $COMPOSE exec -T lararium-a $LARES persona new 1 --name "second" >/dev/null 2>&1 || true
  local SHARES
  SHARES=$($COMPOSE exec -T lararium-a sh -c 'ls /lar-a/data/lares/identity/ 2>/dev/null | grep -c "recovery-device-share-h"' 2>/dev/null | tr -d '\r')
  if [ "${SHARES:-0}" -le 1 ]; then
    gap "only ${SHARES:-0} device share stands — a second face minted none, so the h1+ hole is unreached here"
    printf '      archive-passphrase.ts:82 enumerates deviceSharePath() with no index\n'
  else
    bad "${SHARES} device shares stand and carriers() enumerates one — h1+ escapes every guard"
  fi
  clear_all
}

# ── ③ THE USERINFO TITLE — ENFORCEMENT, NOT DISCOVERY ───────────────────────────────────────────
# THE OPERATOR RULED (2026-09-13, spec 8d69076af): `lar://host/path` titles stand; userinfo-bearing
# titles are FORBIDDEN. So this stops asking whether the leak exists and asks whether the enforcement
# the spec now names can actually be performed.
#
# ⚠ THE SPEC AUTHOR'S OWN CLOSING WARD IS THE RED CONDITION:
#     "the enforcement clause reads well and rests on ZERO measurement — I never ran a userinfo-bearing
#      title through any processor, so 'MUST refuse the crossing and preserve the record' names a
#      behaviour no shore has demonstrated it can perform"
# Nothing in this house has ever put a userinfo-bearing title through it. This walk is the first.
#
# THE MEASURED DROP SITES, which are what leg A asserts against:
#   island-adaptor.ts:314 / :319 — `return Promise.resolve()` (silent success)
#   outbound-bridge.ts:64        — catch-and-drop into console.warn
# A refusal down any of those reads WORSE than a stall: the author's text stands on their screen while
# it stops existing in the store. The record must survive where its author can still see it.
# COVERS: private/seed/unfed
run_title() {
  say "TITLE — the userinfo ban enforced, the body left alone, and the permitted form carried"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local BAD_URI="lar://mara:operator@crossroads/t.title.banned/one"
  local OK_URI="lar://crossroads/t.title.allowed/one"

  step "A stands"
  if LAR_A_PEERS= LAR_A_KAHU= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 \
     && up_and_answering lararium-a; then ok
  else bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  # ── LEG A: THE BAN SURFACES, AND DOES NOT DROP SILENTLY ───────────────────────────────────────
  # The normative shape is a negative MUST: a processor MUST NOT satisfy the surfacing obligation by
  # returning success, by logging where nobody reads, or by letting the write fall away unremarked.
  step "★ A — a userinfo-bearing TITLE is REFUSED, and the refusal is legible ★"
  local PUT
  $COMPOSE exec -T lararium-a sh -c "printf 'a body\n' > /tmp/banned.mem" 2>/dev/null
  PUT=$($COMPOSE exec -T lararium-a $LARES meme put "$BAD_URI" --recipe lares --file /tmp/banned.mem --json 2>&1)
  if printf '%s' "$PUT" | grep -q '"ok":false'; then ok
  else
    bad "a userinfo-bearing title was ACCEPTED — the ban is unenforced on the verb path"
    printf '      %s\n' "$(printf '%s' "$PUT" | tail -1 | cut -c1-240)"
    printf '      no form test stands at meme.ts:121 or meme-verbs.ts:173 — presence check only\n'
  fi

  # THE HALF AS IMPORTANT AS THE REFUSAL. A refusal that also loses the text is the worse failure.
  step "A — and the record SURVIVES where its author can see it"
  local BACK
  BACK=$($COMPOSE exec -T lararium-a $LARES meme get "$BAD_URI" --bag lares --json 2>&1)
  if printf '%s' "$PUT" | grep -q '"ok":false' && ! printf '%s' "$BACK" | grep -q '"ok":true'; then
    gap "the write was refused and nothing was stored — the author's copy stands only on their screen"
    printf '      the spec asks a refusal to PRESERVE the record; a bare refusal preserves nothing\n'
  elif printf '%s' "$BACK" | grep -q '"ok":true'; then ok
  else bad "the record neither landed nor was refused legibly — it fell away unremarked"; fi

  # ── LEG B: THE NEGATIVE THAT MATTERS MOST ─────────────────────────────────────────────────────
  # A record whose BODY carries userinfo URIs must cross byte-identical. The spec names the naive
  # implementation as the wrong one in its own words: "A processor enforcing this rule by testing
  # whether a record's text contains a `@`-bearing `lar:` URI closes nothing and breaks every capture
  # of an exchange — the test MUST read the title slot."
  #
  # SO THIS WALKS A FULL CAPTURED-EXCHANGE SHAPE, never a one-line fixture: an aim, a yield, a quoted
  # link and a fenced block, each carrying a speaker-aim URI in the BODY.
  step "★ B — userinfo in the BODY passes UNTOUCHED (the over-enforcement trap) ★"
  local BODY_URI="lar:///t.title.context/capture"
  $COMPOSE exec -T lararium-a sh -c "printf '<<^ code=\"&#x0001;\" from=? -> to=$BODY_URI>>\n\`\`\`toml meta\nuri-path = \"t.title.context/capture\"\n\`\`\`\n\n<<^ code=\"&#x0002;\">>\n\n<<~ lares aim from=\"lar://mara:operator@crossroads/operator.asks.the-cost\" -> to=\"lar://compita:agent@crossroads/clerk.reads.the-record\">>\n\nA quoted link: lar://alias:grant@host/some.path.here\n\n\`\`\`\n<<~ lares yield from=\"lar://compita:agent@crossroads/clerk.named.the-source\" -> to=\"?\">>\n\`\`\`\n\n<<^ code=\"&#x0003;\">>\n\n<<^ code=\"&#x0004;\" -> to=?>>\n' > /tmp/capture.mem" 2>/dev/null
  local CPUT CGET
  CPUT=$($COMPOSE exec -T lararium-a $LARES meme put "$BODY_URI" --recipe lares --file /tmp/capture.mem --json 2>&1)
  if ! printf '%s' "$CPUT" | grep -q '"ok":true'; then
    bad "a capture carrying userinfo in its BODY was refused — the check read the text, not the title slot"
    printf '      %s\n' "$(printf '%s' "$CPUT" | tail -1 | cut -c1-240)"
  else
    CGET=$($COMPOSE exec -T lararium-a $LARES meme get "$BODY_URI" --bag lares --json 2>&1)
    # THREE SPEAKER-AIMS WENT IN; ALL THREE MUST READ BACK. A processor that stripped one and kept two
    # would satisfy any check that only asked whether the record survived.
    local N
    N=$(printf '%s' "$CGET" | grep -oE 'lar://[a-z]+:[a-z]+@[a-z.]+' | wc -l | tr -d ' ')
    if [ "${N:-0}" -ge 3 ]; then ok
    else bad "only ${N} of 3 body-borne speaker-aims read back — the body was altered"; fi
  fi

  # ── LEG C: THE PERMITTED FORM, END TO END ─────────────────────────────────────────────────────
  # ⚠ RED, AND IT STAYS RED UNTIL A PRODUCTION CHANGE LANDS — stated plainly rather than softened.
  # `carrierBaseRelPath` returns null for anything not `lar:///` (bag-paths.ts:97) and the reverse
  # derivation mints `lar:///` unconditionally (:146-160), so a projected hostful carrier cannot read
  # back as itself. The siting has no defensible spelling today either: the loci law admits hostful
  # then discards the authority, and a three-label host spells the same shape as a root triple, so
  # `lar://a.b.c/x.y.z/s` and `lar:///a.b.c/x.y.z/s` collide.
  #
  # SO THIS ASSERTS THE SYNC HALF AND MARKS THE PROJECTION HALF OWED.
  step "★ C — the PERMITTED \`lar://host/path\` title is accepted ★"
  local OPUT
  $COMPOSE exec -T lararium-a sh -c "printf 'a permitted body\n' > /tmp/allowed.mem" 2>/dev/null
  OPUT=$($COMPOSE exec -T lararium-a $LARES meme put "$OK_URI" --recipe lares --file /tmp/allowed.mem --json 2>&1)
  if printf '%s' "$OPUT" | grep -q '"ok":true'; then ok
  else
    bad "the PERMITTED hostful form was refused — the ruling's allowed shape does not stand"
    printf '      %s\n' "$(printf '%s' "$OPUT" | tail -1 | cut -c1-240)"
  fi

  step "C — and it PROJECTS to disk as itself"
  gap "unbuilt and unowned — carrierBaseRelPath returns null for a non-\`lar:///\` URI (bag-paths.ts:97)"
  printf '      the reverse derivation mints lar:/// unconditionally (:146-160), so it cannot read back\n'
  printf '      wakes when a hostful carrier has a defensible on-disk spelling that round-trips\n'
  clear_all
}

# ── ④ WIKIS-FIRST STAGE 1 — AND THE FALLBACK WEARING A SUCCESS'S FACE ───────────────────────────
# THE TRAP: `defaultWritableSlot(slug, workingMounted)` returns the working slot when its handle
# stands and "else the wiki's canon bag (the floor — a grant-less mount still lands a bagless write
# somewhere, never a red)" (wiki-recipe.ts:341). So a save with no working handle lands in `bags/`
# LAWFULLY, QUIETLY, and answers the stock 204 — the ruling's exact failure wearing a success's face.
#
# ⚠ THE STATUS CODE CARRIES NO SIGNAL. Stock TW5's `put-tiddler.js` answers 204 with an Etag whether
# the bytes landed in `wikis/<slug>/working` or fell back to `bags/<slug>`. That is what makes this
# red-able at all: only `lares wiki which` discriminates, and it prints to stdout with NO JSON
# (wiki.ts:514 — plain `console.log`, no `emit`), so the probe must read lines rather than fields.
#
# ⚠ AND IT RUNS ON A VESSEL THAT NEVER SEATED A CABAL — or ①'s red arrives wearing ④'s name.
# COVERS: private/seed/unfed
run_wikis() {
  say "WIKIS — a save lands in the WORKING slot, and the silent fallback is named when it does not"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local SLUG="climbless"

  # NO CABAL. `LAR_A_KAHU=` keeps this vessel a private nexus of one, so a boot fault here belongs to
  # the wiki layer rather than to a charter that re-keyed a board.
  step "A stands with NO cabal seated — ①'s red must not arrive wearing ④'s name"
  if LAR_A_PEERS= LAR_A_KAHU= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 \
     && up_and_answering lararium-a; then ok
  else bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  # ★ THE DISTINGUISHING OBSERVATION ★
  # THE BRIEF NAMED `lares wiki which`, AND THE MINT IS THE BETTER INSTRUMENT — measured. `wiki which`
  # prints through plain `console.log` with no `emit` (wiki.ts:514), so it carries no JSON and a probe
  # must scrape lines; `wiki init --json` states the write layer outright in a field:
  #     "writableBag":"lar:///ha.ka.ba/wikis/climbless/working"
  # That IS `defaultWritableSlot`'s answer, reported at the moment it is computed. Working ⟺ the field
  # reads `wikis/<slug>/working`; the silent fallback ⟺ it reads `bags/<slug>`.
  step "★ the mint names its write layer — the WORKING slot, never \`bags/\` alone ★"
  local INIT WRITABLE
  INIT=$($COMPOSE exec -T lararium-a $LARES wiki init "$SLUG" --json 2>&1)
  WRITABLE=$(printf '%s' "$INIT" | grep -oE '"writableBag":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$WRITABLE" = "lar:///ha.ka.ba/wikis/${SLUG}/working" ]; then ok
  elif [ "$WRITABLE" = "lar:///ha.ka.ba/bags/${SLUG}" ]; then
    bad "THE SILENT FALLBACK TOOK THE OFFICE — the canon bag holds the write layer"
    printf '      wiki-recipe.ts:341 — workingMounted ? wikiSlotUri(slug,"working") : wikiBagUri(slug)\n'
    printf '      a save here lands in bags/ lawfully, quietly, and answers a 204\n'
  else
    bad "the mint named no write layer at all"
    printf '      %s\n' "$(printf '%s' "$INIT" | tail -1 | cut -c1-240)"
    clear_all; return
  fi

  # NEGATIVE ④b — THE CANON BAG MUST NOT ALSO HOLD THE OFFICE. The mint reports ONE writable, so a
  # double-write shows as the canon bag ALSO answering a placement. Measured: it does not, and the
  # refusal is the evidence —
  #     meme: bag "lar:///ha.ka.ba/bags/climbless" holds no writable layer in this island
  #           — a placement never shadows up to the default writable
  # That refusal IS the negative holding. A canon bag that accepted the placement would be the
  # fallback taking a save the working slot was supposed to own.
  step "NEG b — the canon bag REFUSES a placement, so the office is not shared"
  local TITLE="lar:///t.wikis.witness/one" REF
  $COMPOSE exec -T lararium-a sh -c "printf 'a wiki-borne carrier\n' > /tmp/wiki-one.mem" 2>/dev/null
  REF=$($COMPOSE exec -T lararium-a $LARES meme put "$TITLE" --bag "$SLUG" --file /tmp/wiki-one.mem --json 2>&1)
  if printf '%s' "$REF" | grep -qF "holds no writable layer in this island"; then ok
  elif printf '%s' "$REF" | grep -q '"ok":true'; then
    bad "the CANON bag took the placement — the fallback holds the office beside the working slot"
  else
    gap "the canon bag refused for another reason — the double-write question stays unanswered"
    printf '      %s\n' "$(printf '%s' "$REF" | tail -1 | cut -c1-220)"
  fi

  # NEGATIVE ④c — THE THIRD OUTCOME, kept apart on purpose. No file under EITHER root names an ABSENT
  # MIRROR GRANT, never a write-layer failure, and conflating the two sends the next reader to the
  # wrong layer entirely. `island-behaviors.ts:33` returns undefined with no `diskMirrors` and builds
  # no projector at all — the wiki runs, saves answer 204, and nothing ever reaches disk.
  step "NEG c — a missing file names an ABSENT GRANT, never a write-layer failure"
  local ONDISK
  ONDISK=$($COMPOSE exec -T lararium-a sh -c "find /lar-a -path '*${SLUG}*' -name '*.mem' 2>/dev/null | head -3" 2>/dev/null | tr '\n' ' ')
  if [ -n "$ONDISK" ]; then
    printf '\033[33mGAP (%s)\033[0m\n' "on disk: $(printf '%s' "$ONDISK" | cut -c1-110)"
  else
    gap "no .mem under either root — an ABSENT MIRROR GRANT, distinct from a write that went astray"
    printf '      island-behaviors.ts:33 — no diskMirrors, so no projector is constructed\n'
  fi

  # WHAT THIS SCENARIO CANNOT REACH, and it says so rather than implying coverage. The save that
  # actually exercises the fallback is the in-wiki TW5 syncer's `PUT /recipes/default/tiddlers/<title>`
  # answering stock's 204 — and the status code carries NO signal about which root took the bytes,
  # which is precisely what makes the fallback silent. Measured from the host: that route draws 000
  # (no listener) against `lararium-a`'s published port, because the wiki is not mounted as the served
  # recipe in this container. The CLI's `meme put` reaches the doc layer and never that door.
  step "the SYNCER door — the save whose 204 hides which root took it"
  gap "unreachable from this container — the wiki is not the served recipe, so the PUT route draws 000"
  printf '      packages/lararium-tw5/src/routes/native-door.ts serves it at priority 110\n'
  printf '      wakes when a scenario mounts the minted wiki as the served recipe (wiki switch)\n'

  clear_all
}

# ── ⑤ CONFLICT SURFACING IN BOTH LEGS ───────────────────────────────────────────────────────────
# BOTH GATES ARE BUILT. `ingest-gate.ts` decides the disk→records leg — "a conflict SURFACES rather
# than one stream drowning another (Unison's law: surface, never overwrite)" — and `projection-gate.ts`
# mirrors it for records→disk, its own header naming the ruling: "BOTH legs of the round trip now
# reconcile, neither overwrites".
#
# ⚠ WHAT IS UNWALKED IS THE RAIL, NOT THE GATE. The verdict is one thing; an operator SEEING it is
# another, and the rail crosses three hops no unit test spans — `onRefusal` posts an `IslandMsg_Event`
# (island-behaviors.ts:64), the admin VM's `makeWardAlertReactor` writes a durable `@daemon` audit
# under `lar:///ha.ka.ba/bags/daemon/ledger/ward/` and posts a `$:/tags/Alert` tiddler. That is the
# red: a conflict that decides correctly and tells nobody is the failure this scenario exists to catch.
#
# THE GREPPABLE HANDLES: `[disk-ward] write refused` · `projection conflict —` · `disk-ward:refused`
# · `$:/temp/lares/alert/disk-ward` · the ledger prefix above.
# COVERS: private/seed/unfed
run_conflict() {
  say "CONFLICT — both hands move one carrier, nothing is overwritten, and the operator is told"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"
  local URI="lar:///t.conflict.witness/one"

  step "A stands"
  if LAR_A_PEERS= LAR_A_KAHU= $COMPOSE up -d --no-deps lararium-a >/dev/null 2>&1 \
     && up_and_answering lararium-a; then ok
  else bad "no lararium answering"; dump_boot_failure lararium-a; clear_all; return; fi

  # NEGATIVE ⑤d — NO CONFLICT AT FIRST BOOT. The tree carries 701 hand-authored `.mem` carriers under
  # `bags/` (measured: `find bags -name "*.mem" | wc -l` → 701; 600 of them under the three literally
  # granted bags). A projector that fired a conflict on any of them at a cold boot would bury the one
  # real standoff in noise, and an operator trained to ignore the rail is the same as no rail.
  step "NEG d — a cold boot surfaces NO conflict across the hand-authored carriers"
  local FIRST
  FIRST=$($COMPOSE logs lararium-a 2>&1 | grep -cF "[disk-ward] write refused")
  if [ "${FIRST:-0}" -eq 0 ]; then ok
  else
    bad "${FIRST} conflict(s) fired at first boot — the rail is noisy before any hand moved"
    $COMPOSE logs lararium-a 2>&1 | grep -F "[disk-ward] write refused" | head -3 | cut -c1-200 | sed 's/^/      /'
  fi

  step "a carrier is placed, and projects once"
  $COMPOSE exec -T lararium-a sh -c "printf 'the base text\n' > /tmp/conf.mem" 2>/dev/null
  if $COMPOSE exec -T lararium-a $LARES meme put "$URI" --recipe lares --file /tmp/conf.mem --json 2>&1 \
     | grep -q '"ok":true'; then ok
  else bad "the base carrier never landed"; clear_all; return; fi

  # NEGATIVE ⑤b — A BYTE-IDENTICAL NOOP WRITES NOTHING AND CHURNS NO MTIME. The echo gate stands at
  # projection-gate.ts:81 (`disk-matches-records`), and the projector records the observation without
  # writing (disk-projector.ts:500). A projector that rewrote identical bytes would churn every mtime
  # on every pass and make the ingest leg blind to real edits.
  step "NEG b — a byte-identical re-place churns no mtime"
  local F M1 M2
  F=$($COMPOSE exec -T lararium-a sh -c "find /lar-a -name '*conflict*' -name '*.mem' 2>/dev/null | head -1" 2>/dev/null | tr -d '\r\n')
  if [ -z "$F" ]; then
    gap "the carrier projected to no file — the mtime reading has nothing to watch"
  else
    M1=$($COMPOSE exec -T lararium-a sh -c "stat -c %Y '$F'" 2>/dev/null | tr -d '\r')
    $COMPOSE exec -T lararium-a $LARES meme put "$URI" --recipe lares --file /tmp/conf.mem >/dev/null 2>&1
    sleep 5
    M2=$($COMPOSE exec -T lararium-a sh -c "stat -c %Y '$F'" 2>/dev/null | tr -d '\r')
    if [ "$M1" = "$M2" ]; then ok; else bad "an identical write churned the mtime ($M1 → $M2)"; fi
  fi

  # ★ THE READING. BOTH hands move: the file on disk AND the records in the doc, since the last
  # projection. The gate must answer `conflict / both-moved`, write nothing, and surface.
  step "★ both hands move one carrier — a CONFLICT surfaces and nothing is overwritten ★"
  if [ -z "$F" ]; then
    gap "unwalkable — no projected file stands to move by hand"
  else
    $COMPOSE exec -T lararium-a sh -c "printf 'the DISK hand moved this\n' >> '$F'" 2>/dev/null
    $COMPOSE exec -T lararium-a sh -c "printf 'the RECORD hand moved this\n' > /tmp/conf2.mem" 2>/dev/null
    $COMPOSE exec -T lararium-a $LARES meme put "$URI" --recipe lares --file /tmp/conf2.mem >/dev/null 2>&1
    local d=$((SECONDS + 60))
    while ! logs_have "[disk-ward] write refused" lararium-a && [ "$SECONDS" -lt "$d" ]; do sleep 5; done
    if logs_have "projection conflict" lararium-a; then ok
    else
      bad "no conflict surfaced — one stream drowned the other, or the gate never ran"
      $COMPOSE logs --since 3m lararium-a 2>&1 | grep -iE "disk-ward|project" | tail -4 | cut -c1-200 | sed 's/^/      /'
    fi

    # NEGATIVE ⑤c — NO AUTO-MERGE, NO LAST-WRITER-WINS. Assert the ABSENCE: the operator's disk text
    # must still stand, unmerged, after the refusal. A gate that surfaced AND overwrote would pass the
    # step above.
    step "NEG c — the disk hand's bytes STILL STAND, unmerged"
    if $COMPOSE exec -T lararium-a sh -c "grep -qF 'the DISK hand moved this' '$F'" 2>/dev/null; then ok
    else bad "the disk edit was overwritten — the refusal did not refuse"; fi
  fi

  # THE RAIL. A verdict the operator never sees is the failure this scenario exists to catch.
  step "the operator is TOLD — a durable @daemon audit under the ward ledger"
  if logs_have "disk-ward" lararium-a; then
    local AUD
    AUD=$($COMPOSE exec -T lararium-a $LARES meme list --bag daemon --json 2>&1 | grep -cF "ledger/ward/")
    if [ "${AUD:-0}" -gt 0 ]; then ok
    else
      gap "the refusal logged but no ward-ledger record stands — the rail stops at the console"
      printf '      worker-data-verbs.ts:243 writes lar:///ha.ka.ba/bags/daemon/ledger/ward/<id>\n'
      printf '      wakes when the admin VM reactor runs against a container boot\n'
    fi
  else
    gap "no refusal fired, so the rail carried nothing to measure"
  fi

  # NEGATIVE ⑤a — A CLEAN PROJECT STILL PROJECTS. Without this the family could be "cured" by refusing
  # every write, which is the failure wearing a fix's face.
  step "NEG a — CONTROL: a clean carrier still projects"
  local CLEAN="lar:///t.conflict.clean/one"
  $COMPOSE exec -T lararium-a sh -c "printf 'clean text\n' > /tmp/clean.mem" 2>/dev/null
  if $COMPOSE exec -T lararium-a $LARES meme put "$CLEAN" --recipe lares --file /tmp/clean.mem --json 2>&1 \
     | grep -q '"ok":true'; then ok
  else bad "a clean carrier no longer projects — the gate refuses everything"; fi
  clear_all
}

# ── ⑥ NEXUS BOARD KEYING, AND THE GRADIENT'S THREE STATES ───────────────────────────────────────
# TWO VESSELS SHARING ONE CHARTER MUST COMPUTE ONE BOARD. The scope is the charter's genesis epoch —
# `GENESIS_RE = /^epoch0-[0-9a-f]{64}$/` (nexus-identity.ts:71) — hashed into a doc id by
# `deterministicDocUrl`, so A and B derive the same address "alike by every holder and belonging to
# no operator" without exchanging it.
#
# ⚠ THE HEADLINE AND ITS SHARPEST NEGATIVE BOTH STAND GREEN, MEASURED 2026-09-13 in a container:
# a charter torn at its epoch produced `[lararium] fatal: Error: [nexus] the island reads TORN, so no
# board may be addressed`, the vessel exhausted `restart: on-failure:8` and stayed exited, and the
# floor reading `(own)` appeared ZERO times. So the separation survives and the refusal is real.
# This stands as a REGRESSION GUARD on the three-state gradient, and says so.
#
# THE THREE STATES, each with its own reading:
#   (a) no charter          → `(own)`             — a PRIVATE NEXUS OF ONE
#   (b) charter seated      → `(charter, shared)` — the genesis epoch, shared
#   (c) charter unreadable  → TORN                — refuses; `nexusScopeOrThrow` throws rather than
#                                                   handing back anything a `??` could absorb
# COVERS: private/multisig/unfed
run_board() {
  say "BOARD — one charter, one board; different charters, different boards; a torn one, neither"
  clear_all
  local LARES="node packages/lares-cli/dist/src/bin/lares.js"

  # THE RELAY FIRST, THEN ONE HEARTH AT A TIME — the boot lottery `realm-crossing` measured.
  step "the relay stands FIRST"
  if $COMPOSE up -d herm-source >/dev/null 2>&1 && up_and_answering herm-source; then ok
  else bad "the relay never answered"; clear_all; return; fi
  local svc
  for svc in lararium-a lararium-b; do
    step "$svc stands, alone against a mesh already up"
    if $COMPOSE up -d --no-deps "$svc" >/dev/null 2>&1 && up_and_answering "$svc"; then ok
    else bad "$svc never stood"; dump_boot_failure "$svc"; clear_all; return; fi
  done

  # NEGATIVE ⑥b — A VESSEL IN NO NEXUS STANDS AS A PRIVATE NEXUS OF ONE. This is state (a), and it is
  # a first-class lifecycle stage rather than a fault: "standing a hearth up and connecting it to a
  # Nexus LATER is a first-class flow".
  #
  # ⚠ BOTH HEARTHS SEAT THEIR OWN CABAL AT BOOT (`LAR_STAND_KAHU`), so each already reads `charter`
  # under its OWN genesis epoch — which is exactly what negative ⑥a needs.
  step "NEG a — two vessels under DIFFERENT charters compute DIFFERENT boards"
  local EA EB
  EA=$($COMPOSE exec -T lararium-a $LARES nexus seal show --json 2>&1 | grep -oE '"sealEpochCid":"epoch0-[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  EB=$($COMPOSE exec -T lararium-b $LARES nexus seal show --json 2>&1 | grep -oE '"sealEpochCid":"epoch0-[0-9a-f]{64}"' | head -1 | cut -d'"' -f4)
  if [ -n "$EA" ] && [ -n "$EB" ] && [ "$EA" != "$EB" ]; then ok
  else
    bad "two independently-founded vessels do not separate"
    printf '      A: %s\n      B: %s\n' "${EA:-none}" "${EB:-none}"
  fi

  # ★ THE READING. B takes A's charter by its own doors and contracts in; both must then name ONE
  # island. `nexus refresh` reports the realm doc each side derives — the two must agree.
  if ! contract_ab; then clear_all; return; fi
  step "★ under ONE charter, both vessels compute ONE board ★"
  local RA RB
  RA=$($COMPOSE exec -T lararium-a $LARES nexus refresh --json 2>&1 | grep -oE '"realmDoc":"[^"]*"' | head -1)
  RB=$($COMPOSE exec -T lararium-b $LARES nexus refresh --json 2>&1 | grep -oE '"realmDoc":"[^"]*"' | head -1)
  if [ -n "$RA" ] && [ "$RA" = "$RB" ]; then ok
  else
    bad "the two sides name different boards under one charter"
    printf '      A: %s\n      B: %s\n' "${RA:-none}" "${RB:-none}"
  fi

  # NEGATIVE ⑥c — A TORN CHARTER MUST NOT FALL TO THE FLOOR, and its state must read DISTINCT from
  # no-nexus on the wire. Falling back would "descend a serving vessel to a private board on an
  # accident: it would believe it published while every peer watched it vanish".
  # THE FLOOR READING RIDES A DELTA here for the same reason it does in `climb`: B's own boot before
  # her charter seated printed `(own)` honestly, and an absolute count would read that as this step's
  # failure. The negative asks whether the TEAR produced a new one.
  step "NEG c — B's charter is TORN: she REFUSES, and never reads as no-nexus"
  local OWN_BEFORE OWN_AFTER
  OWN_BEFORE=$(logs_count '\[nexus\] island .* \(own\)' lararium-b)
  $COMPOSE exec -T lararium-b sh -c 'sed -i "s/epoch0-[0-9a-f]*/epoch0-ZZZTORNZZZ/g" /lar-b/data/lares/nexus/founding-roster.mem' 2>/dev/null
  $COMPOSE restart lararium-b >/dev/null 2>&1
  local d=$((SECONDS + 180)) tornseen=0
  while [ "$SECONDS" -lt "$d" ]; do
    [ "$(logs_count 'the island reads TORN, so no board may be addressed' lararium-b)" -gt 0 ] && { tornseen=1; break; }
    sleep 5
  done
  OWN_AFTER=$(logs_count '\[nexus\] island .* \(own\)' lararium-b)
  if [ "$tornseen" -eq 1 ] && [ "$OWN_AFTER" -eq "$OWN_BEFORE" ]; then ok
  else
    bad "a torn charter fell to the floor (${OWN_BEFORE} → ${OWN_AFTER}) or never refused"
    $COMPOSE logs --since 4m lararium-b 2>&1 | tail -4 | cut -c1-220 | sed 's/^/      /'
  fi

  # AND THE REFUSAL IS LEGIBLE FROM OUTSIDE. A vessel that refused silently would read to a peer
  # exactly like one that never stood, which is the conflation state (c) exists to prevent.
  step "and the refusal reads DISTINCT from a vessel that simply never stood"
  if [ "$(logs_count 'a charter STANDS at this vessel' lararium-b)" -gt 0 ]; then ok
  else bad "the torn reading names no charter — a peer cannot tell it from an unfounded vessel"; fi
  clear_all
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
  climb)      run_climb ;;
  seal)       run_seal ;;
  title)      run_title ;;
  wikis)      run_wikis ;;
  conflict)   run_conflict ;;
  board)      run_board ;;
  all)        run_operator a; run_operator b; run_quorum; run_relation; run_realm; run_open; run_open_relation; run_leaf; run_crossing; run_nexus; run_realm_crossing; run_quorum_realm; run_meme; run_climb; run_seal; run_title; run_wikis; run_conflict; run_board ;;
  *) echo "mesh-scenarios: unknown scenario \"$WANT\" (operator-a | operator-b | nexus | quorum | relation | realm | open | crossing | open-relation | leaf | realm-crossing | quorum-realm | meme | climb | seal | title | wikis | conflict | board | all)" >&2; exit 2 ;;
esac

say "═══ RESULT ═══"
if [ "$FAILED" -eq 0 ]; then
  echo "  every scenario stood: each operator alone, and the mesh carrying."
  exit 0
fi
echo "  $FAILED step(s) FAILED — a lone-operator failure belongs to that boot, never to the federation."
exit 1
