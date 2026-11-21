#!/bin/sh
# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml).
#
#   lares-container.sh up [--capture <dir>]... [--workspace <name>=<dir>]...
#                                                stand the vessel (detached) and wait until it answers healthy
#   lares-container.sh down [compose-down args]  stop it and remove its container (the house stays in LARES_HOUSE),
#                                                after a census of what a stop would drop (below)
#   lares-container.sh reset                     clear a stopped vessel's hearth (LARES_HOUSE/hearth alone) after
#                                                terminal confirmation; sensoriums, projections, library and config stay
#   lares-container.sh found [vessel-found args] the founding act, under a TTY (it gathers the human route: a passphrase
#                                                and/or a paper pin, and `--hearth` prints the seed card and reads it
#                                                back; with no TTY the CLI refuses CredentialTtyRefusal)
#   lares-container.sh logs [compose-logs args]  follow the vessel's log
#   lares-container.sh build [--at <rev>] [compose-build args]
#                                                build the vessel image (every package the vessel runs) from one commit
#                                                (HEAD unless --at names another), unpacked from its archive under the
#                                                house's cache, through the env file, stamping that revision as its
#                                                label; an uncommitted or untracked file never rides it, and a dirty
#                                                tree builds from HEAD and names what it left out; no checkout refuses
#   lares-container.sh rebuild [--at <rev> | --prior] [--image]
#                                                the restand `lares rite kukulu` calls (the one human verb): the image of
#                                                the revision (the tag, a kept rev tag, or a build), then down (keep,
#                                                census), the pūlama re-stood and lit on this terminal where its code moved
#                                                or it stands unlit, up, its admit where owed, the last face worn. It reads
#                                                where the house stands each run, so a stopped run picks up from there; with
#                                                no terminal, a light or admit owed stops it before anything moves.
#                                                `--image` stops after the image and prints the reading as one JSON line
#   lares-container.sh vessel stand              stand the vessel when none stands; restart it when its standing no
#                                                longer matches its state on disk; otherwise print the standing.
#                                                Every stand and restart this shim performs (`up` too) warns when the
#                                                image's revision label differs from the checkout's HEAD
#   lares-container.sh vessel stop               stop the vessel's container (state stays; `up` stands it again)
#   lares-container.sh vault unlock              hand the standing vessel a credential typed on this TTY: it opens its
#                                                vessel key and composes with what the key opens
#   lares-container.sh vault lock                the standing vessel drops its key and stands at the floor
#   lares-container.sh <anything else>           run the lares CLI: inside the standing vessel, or through the offline
#                                                door when no vessel stands (vault status|bind|unbind read their
#                                                credential on that TTY)
#
# THE HOST `lares` COMES THROUGH HERE. With LAR_ROOT unset and the env file below standing, the host CLI hands every
# vessel verb to this shim with the same argv (packages/lares-cli/src/host-bridge.ts), so `lares <verb>` from the host
# shell answers from the vessel; host verbs (home, repo, help) stay on the host. The attach (`-t`) asks a terminal on
# stdin AND stdout, and NO_COLOR, TERM, COLORTERM and LARES_DEBUG cross into the vessel by name (`-e NAME`).
#
# ONE HUMAN VERB RAISES THE HOUSE: `lares rite kukulu`. It fast-forwards the checkout where it stands clean and behind its
# upstream, then calls `rebuild` here, which reads where the house stands and walks only what remains; a kukulu lei spends a
# return where one stands, so a day that needs no route asks none. The pūlama's light and admit read the route inside the
# pūlama, attached to this terminal; this shim never reads or types one.
#
# A VESSEL STANDS HOLDING NO KEY. Every start returns it to the floor: it carries and serves its public shelf and
# every sovereign act waits. So after `up`, after `vessel stand`, and after each restart this shim performs, it runs
# `vault unlock` attached when this shell holds a TTY, and otherwise names that one command. No flag, env var or
# pipe carries a credential, and this shim never reads one.
#
# ONE STORE DOOR. While a vessel stands the CLI runs by `compose exec`, sharing the daemon's /tmp (the UDS
# rendezvous), uid and environment. With no vessel standing, one `compose run` of the `offline` service owns the
# store for that act. So a hearth founds before `up`: `found --hearth --name <label>` (the Stable founding act: the
# place, persona zero, its seed charter, the face), then up. A place standing already lifts the same way,
# with the vessel stopped first: the act holds the store.
#
# THE HOST HOLDS THE ENGINE. The app gets no docker socket, and the CLI inside never stops or starts the daemon.
# After each exec'd verb that succeeds, the shim reads the CLI's standing verdict (`vessel stand --observe --json`)
# and restarts the vessel itself when the verdict reads `restand` (a face lit after boot). `vessel stop` stops the
# container.
# One lararium per HUMAN: nothing here names a face.
#
# A STOP NEVER DROPS CONTENT SILENTLY. A stopped container holds no memory to count, so `down` asks the standing vessel
# first (`vessel census`, by compose exec): the saves its sealed rest holds in memory and the carriers its disk
# projector has not settled. A clean answer stops as before. Any item, or a census that cannot answer (a wedged vessel,
# a failed exec, the bound passing), prints what it learned and refuses, naming two ways on: let it settle, by the way the
# vessel's state names (`wear N` where faces stand open and none worn, `vault unlock` where the key stands shut, a wait
# where a worn face holds it), then `down` again; or type `accept-loss` on this terminal to stop anyway. With no terminal it
# refuses. With no vessel standing, `down` runs as it always has.
#
# LARES_HOUSE and LARES_WORKSPACE come from the environment or the operator's `~/.lares/lares-surface.env` (KEY=VALUE
# lines, as compose reads them). LARES_WORKSPACE names the workspace the house lays canon from and projects into, a
# projection target the operator names; for the Kahu cabal it names the repo checkout, the working surface
# (founding-runbook#/prepare). Neither standing refuses by name, and so does a LARES_HOUSE that reads relative.
# LARES_HOUSE names the ONE host house root: its hearth, sensoriums, projections, library and config bind under /lar,
# and this shim makes those five directories as the operator before any container stands. THE ENV FILE RESTS OUTSIDE EVERY
# BIND, at `~/.lares/lares-surface.env`, the same file the MCP seat's resolver reads to know the hearth stands in this
# container; an env file inside one of the five binds refuses by name. The checkout carries no operator config, so no
# file beside the compose file is read.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
COMPOSE_FILE_PATH="${LARES_COMPOSE_FILE:-$ROOT/docker-compose.surface.yml}"
ENV_FILE="${HOME:?set HOME to name the operator home that holds .lares/lares-surface.env}/.lares/lares-surface.env"
CLI="packages/lares-cli/bin/lares.mjs"

die() { printf 'lares-container: %s\n' "$*" >&2; exit 2; }

set_in_env_file() { # $1 = name; true when the env file carries a non-empty value for it
  [ -f "$ENV_FILE" ] && grep -Eq "^[[:space:]]*$1=[^[:space:]]" "$ENV_FILE"
}
for name in LARES_HOUSE LARES_WORKSPACE; do
  eval "val=\${$name:-}"
  if [ -z "$val" ] && ! set_in_env_file "$name"; then
    die "$name stands in neither the environment nor $ENV_FILE — set it (the host directory mounted for the vessel)"
  fi
done

# The value one name carries: the environment first, else the env file's last plain KEY=VALUE line for it.
value_of() { # $1 = name
  eval "v=\${$1:-}"
  if [ -z "$v" ] && [ -f "$ENV_FILE" ]; then v=$(sed -n "s/^[[:space:]]*$1=//p" "$ENV_FILE" | tail -n 1); fi
  printf '%s' "$v"
}
HOUSE=$(value_of LARES_HOUSE)
case "$HOUSE" in /*) ;; *) die "LARES_HOUSE ($HOUSE) reads relative — name the host house root by an absolute path" ;; esac
HOUSE_CLASSES="hearth sensoriums projections library config"
# THE PŪLAMA (road L47e): with LARES_PULAMA=1 the house's custody holder stands in its own container beside the vessel,
# lit once by the operator's own hand (`pulama light`), and outlives every vessel restart. Its private state rests under
# LARES_HOUSE/pulama/state on the host, so it keeps the operator's ownership, and mounts in the pūlama alone. Its socket
# rests in a named Docker volume the pūlama and the vessel share and no host path reaches: the shim never makes, reads or
# clears a socket on the host, and every pūlama verb enters through `compose exec pulama`. Unset, the vessel holds custody
# itself.
#
# THE PŪLAMA BELONGS TO ITS HOUSE. The env file's LARES_PULAMA=1 names the pūlama of the env file's own house; a
# LARES_HOUSE in the environment naming another house (a new house founding beside the standing one) stands that vessel
# holding its own custody, and the line says so. LARES_PULAMA in the environment speaks for whichever house stands.
PULAMA_MODE=""
pulama_word=$(value_of LARES_PULAMA)
if [ -z "${LARES_PULAMA:-}" ] && [ "$pulama_word" = 1 ] && [ -f "$ENV_FILE" ]; then
  file_house=$(sed -n "s/^[[:space:]]*LARES_HOUSE=//p" "$ENV_FILE" | tail -n 1)
  if [ -n "$file_house" ] && [ "$file_house" != "$HOUSE" ]; then
    printf 'lares-container: LARES_PULAMA=1 in %s names the pūlama of %s; this house (%s) holds its own custody\n' "$ENV_FILE" "$file_house" "$HOUSE" >&2
    pulama_word=""
  fi
fi
if [ "$pulama_word" = 1 ]; then
  PULAMA_MODE=yes
  HOUSE_CLASSES="$HOUSE_CLASSES pulama/state"
  export LAR_PULAMA_SOCKET=/pulama/socket/pulama.sock
  # The kūkulu's offer (its lei and the standing vessel's vouch) rests in the config bind, which the rite writes on the host.
  export LAR_KUKULU_OFFER=/lar/config/kukulu-offer.json
fi
PULAMA_MAIN="packages/lararium-node/dist/src/pulama-main.js"
# THE ENV FILE RESTS OUTSIDE EVERY BIND: inside one, the container would read (and a reset could clear) the file that
# names its own mounts.
env_real=$(realpath -m -- "$ENV_FILE")
house_real=$(realpath -m -- "$HOUSE")
for class in $HOUSE_CLASSES; do
  case "$env_real" in "$house_real/$class"|"$house_real/$class"/*) die "the env file $ENV_FILE sits inside LARES_HOUSE's $class bind — keep it outside every bind" ;; esac
done

# THE HOUSE KEEPS ITSELF: where a keep workspace stands named, down runs the host's `rite keep --if-due` while the vessel
# still stands (it keeps only a house that moved); a keep that refuses never blocks the down. LARES_HOST_CLI names the
# host's lares door, else the checkout's own bin under the host's node.
KEEP_SAID=""
keep_before_down() {
  KEEP_SAID="no keep workspace named"
  [ -n "$(value_of LARES_KEEP_WORKSPACE)$(value_of LARES_WORKSPACES)" ] || return 0
  host_cli=$(value_of LARES_HOST_CLI)
  if [ -n "$host_cli" ]; then set -- "$host_cli"
  elif command -v node >/dev/null 2>&1; then set -- node "$ROOT/packages/lares-cli/bin/lares.mjs"
  else KEEP_SAID="no host node answered, so nothing kept"; printf '%s\n' 'lares-container: no host node answers, so down keeps nothing; `lares rite keep` keeps by hand' >&2; return 0; fi
  # SAID UP FRONT: a house that moved cuts and pushes a keep inside the stop, which can take minutes.
  printf '%s\n' 'lares-container: keeping first (rite keep --if-due): a house that moved cuts and pushes its keep before the stop' >&2
  if "$@" rite keep --if-due --no-json; then KEEP_SAID="kept (rite keep --if-due)"
  else KEEP_SAID="the keep did not complete"; printf '%s\n' 'lares-container: the keep did not complete (above); down goes on, and `lares rite keep` keeps by hand' >&2; fi
}

# Make every bound class as the operator, so the engine never makes one owned by root.
ensure_house() {
  for class in $HOUSE_CLASSES; do
    mkdir -p -- "$HOUSE/$class" || die "cannot make $HOUSE/$class — make it as the operator, then run again"
  done
  # A host directory at pulama/socket mounts nowhere (the socket rides a named volume); the shim names it and never removes it.
  if [ -e "$HOUSE/pulama/socket" ]; then
    printf 'lares-container: %s mounts nowhere (the pūlama'"'"'s socket rides a named volume); remove it by hand: rm -r -- %s\n' "$HOUSE/pulama/socket" "$HOUSE/pulama/socket" >&2
  fi
}

ENV_ARGS=""
if [ -f "$ENV_FILE" ]; then ENV_ARGS=yes; fi

compose() {
  if [ -n "$ENV_ARGS" ]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" "$@"
  else
    docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" "$@"
  fi
}

# Whether a vessel stands. A `ps` that fails reads as UNKNOWN, never as "none stands": the offline door opens only
# on a reading, so a broken engine never routes an act beside a live holder.
running_vessel() {
  running_id=$(compose ps -q --status running lares) || die "cannot read the vessel's state (docker compose ps failed); nothing ran"
  [ -n "$running_id" ]
}

# The CLI's own reading of the standing vessel against its state on disk. It runs without a TTY: the answer is JSON
# for this script, never a prompt.
observe_output=""
observe_standing() { observe_output=$(compose exec -T lares node "$CLI" vessel stand --observe --json); }
# An answer counts only when it names a verdict this shim knows; an empty or unreadable answer names none.
verdict_known() {
  printf '%s\n' "$observe_output" | grep -Eq '"standing"[[:space:]]*:[[:space:]]*\{[^}]*"act"[[:space:]]*:[[:space:]]*"(attach|restand)"'
}
verdict_restand() {
  printf '%s\n' "$observe_output" | grep -Eq '"standing"[[:space:]]*:[[:space:]]*\{[^}]*"act"[[:space:]]*:[[:space:]]*"restand"'
}

# Does the standing vessel hold its key? The custody door answers on `vault status --json`; anything but a plain
# `"unlocked":true` reads as not held.
key_held() {
  compose exec -T lares node "$CLI" vault status --json 2>/dev/null | grep -q '"unlocked"[[:space:]]*:[[:space:]]*true'
}

# THE FACE TO WEAR AGAIN. The mount is the composition's own state and never survives a restart, so the shim keeps the
# face the operator last wore through it (`vault unlock --face N`) in the house's config (`config/last-worn-face`, a reset
# keeps it): after a stand or a restart it opens every face the credential opens and wears that one again.
# AN EMPTY MEMORY NAMES NO FACE. A file that reads empty (or absent, or no ordinal) answers empty, and the shim wears
# nothing: a `wear` writes the pūlama's `face.worn`, which it wears again after every restart, so a guessed face 0 would
# outlive the guess. The vessel's own mount stands instead (node-vessel-identity's daemonMountOf: face 0 where it stands
# open, else the lowest face open, under a pūlama the lowest it lends lit).
WORN_FACE_FILE="$HOUSE/config/last-worn-face"
last_worn_face() {
  worn=$(cat -- "$WORN_FACE_FILE" 2>/dev/null) || worn=""
  case "$worn" in ''|*[!0-9]*) worn="" ;; esac
  printf '%s' "$worn"
}
NO_FACE_REMEMBERED='no face rests remembered (config/last-worn-face reads empty), so the shim wears none and the vessel'"'"'s own mount stands; another face: wear N'
# After an unlock that landed: wear the face last worn, or, with none remembered, say the vessel's own mount stands.
wear_after_unlock() {
  if [ -z "$wear" ]; then printf 'lares-container: the vessel opened; %s\n' "$NO_FACE_REMEMBERED" >&2; return 0; fi
  # shellcheck disable=SC2046
  waited_exec $(pass_env) -T lares node "$CLI" wear "$wear" </dev/null || printf 'lares-container: the vessel opened, but h%s stands outside the lent set or locked; wear another face with `lares-container.sh wear N`\n' "$wear" >&2
}
remember_worn_face() { # the argv of a `vault unlock` that landed
  face=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --face) face=${2:-}; shift ;;
      --face=*) face=${1#--face=} ;;
    esac
    shift
  done
  case "$face" in ''|*[!0-9]*) return 0 ;; esac
  mkdir -p -- "$HOUSE/config" && printf '%s\n' "$face" > "$WORN_FACE_FILE" || printf '%s\n' 'lares-container: the worn face could not be remembered; the next stand wears the face remembered before, or none' >&2
}

# THE MOUNT, read: the census frame (`vessel census --json`, bounded as down's census is) names `worn` beside the lit
# set, null where faces stand lent and none worn. Any other answer, or none, reads as no need to wear.
none_worn() {
  run_census --json >/dev/null 2>&1 || true
  printf '%s\n' "$census_out" | grep -q '"worn"[[:space:]]*:[[:space:]]*null'
}
wear_last_face() {
  wear=$(last_worn_face)
  if [ -z "$wear" ]; then
    WORE=""
    printf '%s\n' 'lares-container: faces stand lent and none worn, and no face rests remembered (config/last-worn-face reads empty); the shim wears none: wear one with `lares-container.sh wear N`' >&2
    return 0
  fi
  printf 'lares-container: faces stand lent and none worn; wearing h%s, the face last worn\n' "$wear" >&2
  # shellcheck disable=SC2046
  if waited_exec $(pass_env) -T lares node "$CLI" wear "$wear" </dev/null; then WORE="h$wear"
  else WORE=""; printf 'lares-container: h%s stands outside the lent set or locked; wear another face with `lares-container.sh wear N`\n' "$wear" >&2; fi
}
WORE=""

# The vessel just stood (or restarted), so it holds no key. With a TTY, run the unlock attached: it opens every face the
# credential opens (`--all`), then `lares wear` takes the last worn face again (none remembered: the vessel's own mount); without one, name both commands. A refused or
# abandoned unlock leaves the vessel standing at the floor and never fails the act that stood it. A hint never names the
# bare command that fails on a vessel of several faces.
unlock_or_name() {
  if key_held; then
    # A HELD KEY IS NOT A WORN FACE. Under a pūlama the vessel redials its key at boot, while the mount lives in process
    # memory and leaves with every restart: the census frame names the worn face, and over faces lent and none worn the
    # shim wears the face last worn.
    if none_worn; then wear_last_face; fi
    return 0
  fi
  wear=$(last_worn_face)
  if [ -n "$PULAMA_MODE" ]; then
    # UNDER A PŪLAMA THE ROUTE GOES TO THE PŪLAMA ALONE. The vessel's own unlock asks nothing there (it redials the
    # pūlama), so it runs detached from this terminal: an image that prompts anyway reads no keystroke.
    # shellcheck disable=SC2046
    if waited_exec $(pass_env) -T lares node "$CLI" vault unlock --all </dev/null; then
      wear_after_unlock
      return 0
    fi
    printf '%s\n' 'lares-container: the vessel stands at the floor, unserved by the pūlama; read it with `lares-container.sh pulama status`, light it with `lares-container.sh pulama light`, admit the image that stands with `lares-container.sh pulama admit`, or raise a served vessel with `lares rite kukulu`' >&2
    return 0
  fi
  if [ -n "$wear" ]; then then_wear=", then wear h$wear"; else then_wear=", then the vessel's own mount"; fi
  if [ -n "$HAVE_TTY" ]; then
    printf 'lares-container: the vessel stands holding no vessel key; unlocking it on this terminal (every face the credential opens%s)\n' "$then_wear" >&2
    # shellcheck disable=SC2046
    if ! waited_exec $(pass_env) lares node "$CLI" vault unlock --all; then
      if [ -n "$wear" ]; then printf 'lares-container: the vessel still stands at the floor; open every face the credential opens with `lares-container.sh vault unlock --all`, then `lares-container.sh wear %s`\n' "$wear" >&2
      else printf '%s\n' 'lares-container: the vessel still stands at the floor; open every face the credential opens with `lares-container.sh vault unlock --all`' >&2; fi
    else
      wear_after_unlock
    fi
  elif [ -n "$wear" ]; then
    printf 'lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.sh vault unlock --all, then lares-container.sh wear %s (every face the credential opens, then wear h%s; another face: wear N)\n' "$wear" "$wear" >&2
  else
    printf '%s\n' 'lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.sh vault unlock --all (every face the credential opens; no face rests remembered, so the vessel mounts its own; another face: wear N)' >&2
  fi
}

# THE IMAGE'S REVISION LABEL AGAINST THE CHECKOUT'S HEAD. A build bakes the commit it built from into the image; an image
# that names another revision, or none, runs older code than the checkout holds. Uncommitted changes never ride an image
# (a build reads the commit), so the label reads against HEAD alone. It warns and stands: the operator decides whether
# the rebuild is owed. No git, or no checkout: it skips.
SHIM_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
GIT_REV=""; GIT_DIRTY=""
if GIT_REV=$(git -C "$SHIM_DIR" rev-parse HEAD 2>/dev/null) && [ -n "$GIT_REV" ]; then
  if [ -n "$(git -C "$SHIM_DIR" status --porcelain --untracked-files=no 2>/dev/null)" ]; then GIT_DIRTY=yes; GIT_REV="$GIT_REV-dirty"; fi
  export GIT_REV
else
  GIT_REV=""
fi
warn_image_revision() {
  if [ -z "$GIT_REV" ]; then
    printf '%s\n' 'lares-container: no git checkout answers here, so the image revision check is skipped' >&2
    return 0
  fi
  cid=$(compose ps -q lares 2>/dev/null) || return 0
  [ -n "$cid" ] || return 0
  label=$(docker inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$cid" 2>/dev/null | LC_ALL=C sed -e 's/[[:cntrl:]]//g' -e 's/\xc2[\x80-\x9f]//g') || return 0
  [ "$label" != "${GIT_REV%-dirty}" ] || return 0
  if [ -n "$GIT_DIRTY" ]; then
    printf 'lares-container: the image names revision %s and the checkout stands at %s, beside uncommitted changes no image carries; rebuild from the commit with `tools/lares-container.sh build`, then `up` again\n' "${label:-none}" "${GIT_REV%-dirty}" >&2
  else
    printf 'lares-container: the image names revision %s and the checkout stands at %s; rebuild with `tools/lares-container.sh build`, then `up` again\n' "${label:-none}" "$GIT_REV" >&2
  fi
}

lift_vessel() {
  reason=$(printf '%s\n' "$observe_output" | sed -n 's/.*"standing"[[:space:]]*:[[:space:]]*{[^}]*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  printf 'lares-container: %s; restarting the vessel\n' "${reason:-the standing requires a re-stand}" >&2
  # A lift over a moved image recreates the vessel, so the down path runs first; on the image that stands, a restart.
  if vessel_moved; then down_if_moved
  elif ! compose restart lares; then printf '%s\n' 'lares-container: the vessel restart failed' >&2; return 1; fi
  if ! up_with_workspaces; then printf '%s\n' 'lares-container: the vessel did not answer healthy after its restart' >&2; return 1; fi
  warn_image_revision
  unlock_or_name
}

# Any CLI verb: inside the standing vessel, else through the offline door. A verb that succeeds inside a standing
# vessel gets followed by one standing check, and the shim lifts the vessel when the verdict asks for it. A caller
# that asked for the reading itself (`--observe`) gets that reading alone.
follow_up=yes
route_cli() {
  if running_vessel; then
    # shellcheck disable=SC2046
    if waited_exec $(pass_env) $(tty_flag) lares node "$CLI" "$@"; then rc=0; else rc=$?; fi
    if [ "$rc" -ne 0 ]; then return "$rc"; fi
    if [ -z "$follow_up" ]; then return 0; fi
    # The verb landed. A standing check that fails leaves a possible lift unperformed, so it never passes silently.
    if ! observe_standing || ! verdict_known; then
      printf '%s\n' 'lares-container: the verb succeeded, and the standing check after it answered no verdict; run `lares-container.sh vessel stand`' >&2
      return 1
    fi
    if verdict_restand; then lift_vessel; fi
  else
    printf '%s\n' 'lares-container: no vessel stands; this act runs offline on the store' >&2
    ensure_house
    # shellcheck disable=SC2046
    waited_run $(pass_env) $(tty_flag) offline "$@"
  fi
}

# THE CENSUS BEFORE A STOP, bounded: the census itself waits on its own lines (ten seconds for the custody door, fifteen
# per island page), and this bound stands over the whole exec, so a wedged vessel never hangs `down`.
CENSUS_WAIT_SECONDS=60
census_out=""; census_err=""; census_timed_out=""
run_census() { # $1 = --no-json (the default: the lines down prints) or --json (the frame a mount read greps)
  census_fmt=${1:---no-json}
  census_dir=$(mktemp -d) || return 125
  (
    if [ -n "$ENV_ARGS" ]; then exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" exec -T lares node "$CLI" vessel census "$census_fmt"
    else exec docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" exec -T lares node "$CLI" vessel census "$census_fmt"; fi
  ) >"$census_dir/out" 2>"$census_dir/err" </dev/null &
  census_pid=$!
  # The watch polls once a second and leaves on its own once the exec ends, so no sleeper outlives the census by more
  # than a second; past the bound it marks the timeout, then stops the exec (TERM, and KILL five seconds on).
  (
    waited=0
    while kill -0 "$census_pid" 2>/dev/null; do
      if [ "$waited" -ge "$CENSUS_WAIT_SECONDS" ]; then
        : > "$census_dir/timed-out"
        kill -TERM "$census_pid" 2>/dev/null
        for _ in 1 2 3 4 5; do kill -0 "$census_pid" 2>/dev/null || exit 0; sleep 1; done
        kill -KILL "$census_pid" 2>/dev/null
        exit 0
      fi
      sleep 1
      waited=$((waited + 1))
    done
  ) >/dev/null 2>&1 &
  if wait "$census_pid"; then census_rc=0; else census_rc=$?; fi
  census_out=$(cat "$census_dir/out")
  census_err=$(cat "$census_dir/err")
  census_timed_out=""; if [ -e "$census_dir/timed-out" ]; then census_timed_out=yes; fi
  rm -rf -- "$census_dir"
  return "$census_rc"
}

# THE WAY TO SETTLE READS THE VESSEL'S STATE: faces open and none worn (the census says so) wear one; a key the vessel holds
# under a worn face waits alone; a key it does not hold, or a census that never answered, unlocks.
settle_way() {
  if printf '%s\n' "$census_err" | grep -q '^census: no face worn'; then
    printf '%s' '  - wear a face and let it settle: tools/lares-container.sh wear N (faces stand open and none worn), then tools/lares-container.sh down again'
  elif [ -z "$census_timed_out" ] && ! printf '%s\n' "$census_err" | grep -q '^census: vessel locked' && key_held; then
    printf '%s' '  - let it settle: give the vessel a moment, then tools/lares-container.sh down again'
  else
    printf '%s' '  - unlock it and let it settle: tools/lares-container.sh vault unlock, then tools/lares-container.sh down again'
  fi
}

# The two ways on, then the typed acceptance: only the word `accept-loss`, typed on this terminal, stops anyway.
offer_accept_loss() {
  printf '%s\n' 'lares-container: the vessel stands. Two ways on:' \
    "$(settle_way)" \
    '  - stop anyway, dropping what the list names: type accept-loss below' >&2
  [ -n "$HAVE_TTY" ] || die "down refuses: no terminal stands here to type accept-loss on; the vessel stands"
  printf 'Type accept-loss to stop anyway: '
  IFS= read -r answer || die "down: no answer read; the vessel stands"
  [ "$answer" = accept-loss ] || die "down: the answer did not read accept-loss; the vessel stands"
  printf '%s\n' 'lares-container: accept-loss typed; stopping the vessel' >&2
}

# Census the standing vessel; return only when the stop may go on (clean, or accept-loss typed).
census_before_stop() {
  if run_census; then rc=0; else rc=$?; fi
  if [ "$rc" -eq 0 ] && printf '%s\n' "$census_out" | grep -q '^census: clean'; then return 0; fi
  # A LOCKED HEARTH: the census names the cure in one line (`census: vessel locked: …`); say it plainly, not "could not answer".
  if [ -z "$census_timed_out" ] && printf '%s\n' "$census_err" | grep -q '^census: vessel locked'; then
    printf '%s\n' 'lares-container: down refuses a silent stop: vessel locked: run tools/lares-container.sh vault unlock, then down' >&2
    offer_accept_loss
    return 0
  fi
  if [ "$rc" -eq 3 ] && [ -z "$census_timed_out" ]; then
    printf '%s\n' 'lares-container: down refuses a silent stop: the census names content that rests nowhere yet, and a stop now drops it:' >&2
    printf '%s\n' "$census_out" | sed -e '/^$/d' -e 's/^/  /' >&2
  else
    if [ -n "$census_timed_out" ]; then why="no answer within ${CENSUS_WAIT_SECONDS}s (the vessel may stand wedged)"
    else why="the census exec ended with status $rc"; fi
    printf 'lares-container: down refuses a silent stop: the census could not answer (%s), so what a stop would drop reads unknown\n' "$why" >&2
    printf '%s\n' 'lares-container: down cannot confirm the vessel census; it remains standing. Check tools/lares-container.sh logs, then retry down.' >&2
    if [ "${LARES_DEBUG:-}" = 1 ]; then
      if [ -n "$census_out" ]; then printf '%s\n' "$census_out" | sed -e '/^$/d' -e 's/^/  /' >&2; fi
      if [ -n "$census_err" ]; then printf '%s\n' "$census_err" | sed -e '/^$/d' -e 's/^/  /' >&2; fi
    fi
  fi
  offer_accept_loss
}

# Read the terminal NOW: inside `$(tty_flag)` stdout is the substitution's pipe, so a `[ -t 1 ]` there is always false
# and every founding would lose its TTY.
HAVE_TTY=""
if [ -t 0 ] && [ -t 1 ]; then HAVE_TTY=yes; fi
tty_flag() { if [ -z "$HAVE_TTY" ]; then printf -- '-T'; fi; }
# THE ATTACH READS BOTH ENDS. Piped stdin never attaches; and a piped stdout never attaches either, since a pseudo-
# terminal would fold stderr into stdout and turn every newline into CRLF, so `lares … --json | jq` would read noise.

# DISPLAY, DEBUG AND THE SEAT MARK RIDE BY NAME. Each of these the caller's environment sets crosses into the vessel as
# `-e NAME` (compose reads the value from this environment), so no value rides argv; no other name crosses, and no
# credential. The harness marks (CLAUDECODE, CODEX_SANDBOX, CODEX_SANDBOX_NETWORK_DISABLED) make the CLI ask as an AI
# seat (#231's seat-canon-reach); a process's ancestry cannot cross the container boundary, so the mark is its one carrier.
pass_env() {
  for name in NO_COLOR TERM COLORTERM LARES_DEBUG CLAUDECODE CODEX_SANDBOX CODEX_SANDBOX_NETWORK_DISABLED; do
    eval "isset=\${$name+x}"
    if [ -n "$isset" ]; then printf -- '-e %s ' "$name"; fi
  done
}

# A SIGNAL NEVER STRANDS AN ACT INSIDE THE VESSEL. Docker forwards no signal to an exec'd process, and a killed
# `compose run` client leaves its container running (measured: tests/host-bridge-real-docker.test.ts). So every act
# runs as a WAITED child (its stdin handed on from fd 3, since an async child would read /dev/null), and TERM, HUP and
# INT trap: the shim ends the compose client, stops what it started inside the vessel, then ends by the same signal.
# An exec carries LARES_EXEC_TAG (by name, a random value of this run), and the stop signals each vessel process whose
# environment holds that tag; a run names its container (lares-offline-<tag>), and the stop stops and removes it.
# Nothing detaches: the child stays in this terminal's foreground group, so a credential prompt keeps its TTY.
LARES_EXEC_TAG=$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')
export LARES_EXEC_TAG
RUN_NAME="lares-offline-$LARES_EXEC_TAG"
if { true <&0; } 2>/dev/null; then exec 3<&0; else exec 3</dev/null; fi
act_kind=""; act_pid=""; caught=""

stop_act() { # $1 = the signal caught
  caught=$1
  kill -TERM "$act_pid" 2>/dev/null
  if [ "$act_kind" = run ]; then
    docker stop -t 10 "$RUN_NAME" >/dev/null 2>&1
    docker rm -f "$RUN_NAME" >/dev/null 2>&1
  else
    # shellcheck disable=SC2016
    compose exec -T lares sh -c 'for p in /proc/[0-9]*; do pid=${p#/proc/}; [ "$pid" = "$$" ] && continue; if tr "\0" "\n" < "$p/environ" 2>/dev/null | grep -qx "LARES_EXEC_TAG=$2"; then kill -s "$1" "$pid" 2>/dev/null; fi; done' stop "$caught" "$LARES_EXEC_TAG" </dev/null >/dev/null 2>&1
  fi
}

run_waited() { # $1 = exec|run; the rest = the compose argv
  act_kind=$1; shift
  # The subshell EXECS docker, so the pid waited on and signalled names the compose client itself.
  (
    if [ -n "$ENV_ARGS" ]; then exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" "$@"
    else exec docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" "$@"; fi
  ) <&3 3<&- &
  act_pid=$!
  trap 'stop_act TERM' TERM
  trap 'stop_act HUP' HUP
  trap 'stop_act INT' INT
  while :; do
    if wait "$act_pid"; then act_rc=0; else act_rc=$?; fi
    kill -0 "$act_pid" 2>/dev/null || break
  done
  trap - TERM HUP INT
  if [ -n "$caught" ]; then kill -s "$caught" "$$"; exit "$act_rc"; fi
  return "$act_rc"
}
waited_exec() { run_waited exec exec -e LARES_EXEC_TAG "$@"; }
waited_run() { run_waited run --profile offline run --rm --name "$RUN_NAME" "$@"; }

[ "$#" -gt 0 ] || die "usage: lares-container.sh up|down|reset|found|logs|build|rebuild|pulama|vessel stand|<lares verb…> (build builds the vessel image, every package, from a commit; rebuild is the restand \`lares rite kukulu\` walks)"
verb=$1; shift

# A WORKSPACE (cabal-realm#/the-workbench): an operator-configured directory a private wiki's workbench mirror rests in,
# bound read-write at `/lar/workspaces/<name>` (a wiki's share row names it: `lares wiki share <wiki> --workspace <name>`).
# They come from `--workspace <name>=<dir>` on `up` and from LARES_WORKSPACES (the environment or the env file: `;`-separated
# `<name>=<dir>` pairs, so they stand on every up). A workspace inside LARES_HOUSE/hearth refuses by name: a re-founding
# clears the hearth. The checkout and LARES_WORKSPACE bind like any directory (founding road rank 4j: the checkout counts as
# the cabal's working surface). A name binds once.
workspace_names=" "
workspace_bind() { # $1 = name=dir; appends one bind to $files
  pair=$1
  case "$pair" in *=*) ;; *) die "--workspace wants <name>=<dir>, and \"$pair\" names no '='" ;; esac
  name=${pair%%=*}; wdir=${pair#*=}
  printf '%s' "$name" | grep -Eq '^[a-z0-9][a-z0-9._-]{0,63}$' || die "--workspace: \"$name\" names no workspace (lower-case letters, digits, '.', '_' and '-')"
  case "$workspace_names" in *" $name "*) die "--workspace: \"$name\" binds once" ;; esac
  real=$(realpath -e -- "$wdir" 2>/dev/null) || die "--workspace $name: $wdir is no directory"
  [ -d "$real" ] || die "--workspace $name: $wdir is no directory"
  hearth_real=$(realpath -m -- "$HOUSE/hearth")
  case "$real/" in "$hearth_real/"*) die "--workspace $name refuses $real — it rests inside the hearth ($hearth_real)" ;; esac
  case "$real" in *"
"*) die "--workspace refuses a path that holds a newline" ;; esac
  yaml_dir=$(printf '%s' "$real" | sed -e "s/'/''/g" -e 's/\$/$$/g')
  workspace_names="$workspace_names$name "
  files="$files
      - type: bind
        source: '$yaml_dir'
        target: /lar/workspaces/$name"
}

# THE RESTART KEEPS THE WORKSPACES: compose recreates a container whose configuration moved, so a restart's `up` carries every
# LARES_WORKSPACES bind, as the operator's `up` did. A workspace named by `--workspace` alone rides that one `up`.
up_with_workspaces() {
  files=""; workspace_names=" "
  configured=$(value_of LARES_WORKSPACES)
  if [ -n "$configured" ]; then
    old_ifs=$IFS; IFS=';'
    for pair in $configured; do IFS=$old_ifs; [ -z "$pair" ] || workspace_bind "$pair"; IFS=';'; done
    IFS=$old_ifs
  fi
  if [ -z "$files" ]; then compose up -d --wait lares; return $?; fi
  ws_override=$(mktemp)
  printf 'services:\n  lares:\n    volumes:%s\n' "$files" > "$ws_override"
  if [ -n "$ENV_ARGS" ]; then docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" -f "$ws_override" up -d --wait lares; ws_rc=$?
  else docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" -f "$ws_override" up -d --wait lares; ws_rc=$?; fi
  rm -f "$ws_override"
  return "$ws_rc"
}

# The pūlama stands before any vessel: up with --no-recreate leaves a lit one lit. Then the host reports the image digest
# the vessel will raise, since a vessel never vouches for its own face.
# The digest of the image a vessel stands from: what up reports to the pūlama.
image_digest() {
  image=$(value_of LARES_IMAGE); [ -n "$image" ] || image=lares-surface:local
  digest=$(docker image inspect --format '{{.Id}}' "$image") || die "cannot read the vessel image's digest ($image); nothing raised"
}
stand_pulama() {
  [ -n "$PULAMA_MODE" ] || return 0
  compose --profile pulama up -d --no-recreate pulama || die "the pūlama did not stand; nothing raised"
  image_digest
  # THE IMAGE OFFERS ITS SEED BESIDE ITS DIGEST. A one-shot of the image itself reads the seed it carries (no house
  # mounted: the pūlama compares nothing, and the founding record reads at boot, inside the vessel) and prints the whole
  # frame on one stdout line; rebuild chatter rides stderr. A read that prints no frame falls back to the bare digest,
  # so a seed read never blocks a stand.
  frame=$(docker run --rm -e LAR_ROOT=/lar "$image" node "$CLI" vessel floor seed --genesis /app/genesis --image "$digest" 2>/dev/null | tail -n 1) || frame=""
  case "$frame" in '{'*) report=$frame ;; *) report=$digest ;; esac
  compose --profile pulama exec -T pulama node "$PULAMA_MAIN" image "$report" || die "the pūlama refused the image report for $digest; nothing raised"
}
# Does a pūlama run beside the vessel? It reads the container itself, whatever LARES_PULAMA now says: running, absent, or
# unknown where the ps fails.
pulama_state() {
  p_id=$(compose --profile pulama ps -q --status running pulama) || { printf unknown; return 0; }
  if [ -n "$p_id" ]; then printf running; else printf absent; fi
}

# THE PŪLAMA'S CODE AGAINST THE IMAGE THAT STANDS. `up` keeps a lit pūlama lit (--no-recreate), so after a `build` it runs
# the image it stood from. The pūlama runs the vessel's image, so the image id moves with every vessel build; what decides
# a re-stand is the pūlama's own code closure, the `lares.pulama.closure` label a build stamps. One reading serves the
# line `up` and `pulama status` print and the `rebuild` verb's choice:
#   absent         no pūlama runs
#   level          the pūlama runs the image that stands
#   closure-level  it runs an older image whose code closure matches the new one: it stays lit, no restand owed
#   moved          the closure moved, or either side carries none: `pulama restand`, then a light by hand
#   unread         a read failed: it names nothing and blocks nothing (rebuild refuses on it)
PULAMA_CLOSURE_FORMAT='{{ index .Config.Labels "lares.pulama.closure" }}'
closure_label() { # $1 = image|container, $2 = the reference; a label that reads no digest reads empty
  if [ "$1" = image ]; then c_out=$(docker image inspect --format "$PULAMA_CLOSURE_FORMAT" "$2" 2>/dev/null | tr -d '\r') || c_out=""
  else c_out=$(docker inspect --format "$PULAMA_CLOSURE_FORMAT" "$2" 2>/dev/null | tr -d '\r') || c_out=""; fi
  if printf '%s' "$c_out" | grep -Eq '^sha256:[0-9a-f]{64}$'; then printf '%s' "$c_out"; fi
}
pr_state=unread; pr_ran=""; pr_stands=""; pr_closure=""
pulama_reading() {
  pr_state=unread; pr_ran=""; pr_stands=""; pr_closure=""
  pr_id=$(compose --profile pulama ps -q --status running pulama 2>/dev/null) || return 0
  if [ -z "$pr_id" ]; then pr_state=absent; return 0; fi
  pr_ran=$(docker inspect --format '{{.Image}}' "$pr_id" 2>/dev/null) || pr_ran=""
  pr_stands=$(docker image inspect --format '{{.Id}}' "$IMAGE_REF" 2>/dev/null) || pr_stands=""
  pr_ran=$(printf '%s' "$pr_ran" | tr -d '\r'); pr_stands=$(printf '%s' "$pr_stands" | tr -d '\r')
  [ -n "$pr_ran" ] && [ -n "$pr_stands" ] || return 0
  if [ "$pr_ran" = "$pr_stands" ]; then pr_state=level; return 0; fi
  pr_closure=$(closure_label container "$pr_id")
  if [ -n "$pr_closure" ] && [ "$pr_closure" = "$(closure_label image "$IMAGE_REF")" ]; then pr_state=closure-level; else pr_state=moved; fi
}
# THE IMAGE LINE (road rank 4l, L6): wherever a pūlama runs, `up` and `pulama status` print one line naming its image
# beside the image the tag names and, where a vessel stands, the vessel's own.
vessel_clause() {
  v_id=$(compose ps -q --status running lares 2>/dev/null) || return 0
  [ -n "$v_id" ] || return 0
  v_img=$(docker inspect --format '{{.Image}}' "$v_id" 2>/dev/null) || return 0
  v_img=$(printf '%s' "$v_img" | tr -d '\r')
  [ -z "$v_img" ] || printf ' (the vessel runs %s)' "$v_img"
}
warn_pulama_skew() {
  [ -n "$PULAMA_MODE" ] || return 0
  pulama_reading
  case "$pr_state" in absent|unread) return 0 ;; esac
  pr_vessel=$(vessel_clause)
  case "$pr_state" in
    level) printf 'lares-container: the pūlama runs image %s, and %s stands at the same %s%s\n' "$pr_ran" "$IMAGE_REF" "$pr_stands" "$pr_vessel" >&2 ;;
    moved) printf 'lares-container: the pūlama runs image %s, and %s stands at %s%s; its code closure moved (or reads unlabeled), so it keeps the older code until `lares rite kukulu` re-stands it (`pulama restand`) and lights it on a terminal\n' "$pr_ran" "$IMAGE_REF" "$pr_stands" "$pr_vessel" >&2 ;;
    closure-level) printf 'lares-container: the pūlama runs image %s, and %s stands at %s%s; its code closure reads the same (%s), so it stands lit and owes no restand\n' "$pr_ran" "$IMAGE_REF" "$pr_stands" "$pr_vessel" "$(printf '%s' "$pr_closure" | cut -c1-19)" >&2 ;;
  esac
}

# THE VESSEL'S LOG OUTLIVES THE DOWN. A down removes the container, and its log leaves with it, so the down path saves
# the last VESSEL_LOG_LINES lines (stdout and stderr) to the house's run/vessel-last.log first, overwritten each down,
# and names the file. A log that cannot be read is named and never blocks the down.
VESSEL_LOG_LINES=20000
save_vessel_log() { # $1 = the running vessel's container id
  sv_id=$(printf '%s\n' "$1" | tr -d '\r' | sed -n '1p')
  sv_file="$HOUSE/run/vessel-last.log"
  if mkdir -p -- "$HOUSE/run" && docker logs --tail "$VESSEL_LOG_LINES" "$sv_id" > "$sv_file" 2>&1; then
    printf "lares-container: the vessel's log (its last %s lines) rests at %s\n" "$VESSEL_LOG_LINES" "$sv_file" >&2
  else
    printf '%s\n' "lares-container: the vessel's log could not be read; the down goes on" >&2
  fi
}

# THE DOWN PATH (`down`, and every act that must stop the vessel first): the keep while the vessel stands, the census,
# the refusal of a silent stop, the vessel's log; then the vessel alone stops where a pūlama runs, or the whole project downs.
down_vessel() { # $@ = compose-down options
  # A pūlama that reads unknown stops nothing: a full down would take a lit pūlama with it.
  d_pulama=$(pulama_state)
  [ "$d_pulama" != unknown ] || die "down refuses: docker compose ps failed for the pūlama, so whether the pūlama stands reads unknown; the vessel and the pūlama stand"
  # A ps that fails reads as UNKNOWN: whether a vessel stands, and what it holds, goes uncounted, so the same typed
  # acceptance guards the stop.
  if ! down_id=$(compose ps -q --status running lares); then
    printf '%s\n' 'lares-container: down refuses a silent stop: docker compose ps failed, so whether a vessel stands reads unknown' >&2
    printf '%s\n' 'lares-container: down cannot confirm the vessel census; it remains standing. Check tools/lares-container.sh logs, then retry down.' >&2
    offer_accept_loss
  elif [ -n "$down_id" ]; then
    keep_before_down
    census_before_stop
    save_vessel_log "$down_id"
  else
    KEEP_SAID="no vessel stood, so no keep ran"
  fi
  if [ "$d_pulama" = running ]; then
    # The pūlama keeps the hearth lit through the rebuild: the vessel alone stops (with down's options) and leaves.
    compose stop "$@" lares && compose rm -f lares
  else
    compose down --remove-orphans "$@"
  fi
}

# A MOVED IMAGE NEVER RECREATES SILENTLY (road rank 4l, RD4). Compose recreates a vessel whose image moved, and a
# recreate drops whatever the vessel holds in memory. So `up`, and a lift, over a running vessel whose image differs from
# the image the tag names runs the down path first. A read that fails names no move (the act goes on as it did).
vessel_moved() {
  m_id=$(compose ps -q --status running lares 2>/dev/null) || return 1
  [ -n "$m_id" ] || return 1
  m_ran=$(docker inspect --format '{{.Image}}' "$m_id" 2>/dev/null) || m_ran=""
  m_stands=$(docker image inspect --format '{{.Id}}' "$IMAGE_REF" 2>/dev/null) || m_stands=""
  m_ran=$(printf '%s' "$m_ran" | tr -d '\r'); m_stands=$(printf '%s' "$m_stands" | tr -d '\r')
  [ -n "$m_ran" ] && [ -n "$m_stands" ] && [ "$m_ran" != "$m_stands" ]
}
down_if_moved() {
  vessel_moved || return 0
  printf 'lares-container: the vessel runs image %s, and %s stands at %s; the down path runs first (keep, census), never a silent recreate\n' "$m_ran" "$IMAGE_REF" "$m_stands" >&2
  down_vessel || die "the down path did not complete (above); the vessel stands on its older image"
}

# THE IMAGE BUILDS FROM A COMMIT (road rank 4l, RD2), never from the live tree. `git archive <rev>`, and each submodule's
# own archive at the commit the revision pins, unpack in a scratch folder under the house's cache (outside the checkout
# and outside every bind), and compose builds from there through the env file, an override naming that folder as the
# context and the revision as the label. So an untracked or uncommitted file never rides an image; a dirty tree builds
# from HEAD and names what it left out. A submodule whose checkout lacks the pinned commit is named and left out.
IMAGE_REF=$(value_of LARES_IMAGE); [ -n "$IMAGE_REF" ] || IMAGE_REF=lares-surface:local
case "${IMAGE_REF##*/}" in *:*) IMAGE_REPO=${IMAGE_REF%:*} ;; *) IMAGE_REPO=$IMAGE_REF ;; esac
BUILT_REV=""

# THE OUTGOING IMAGE KEEPS A REVISION TAG (road rank 4l, RD3). Before a build moves the image tag, the image it held
# takes `<repo>:rev-<12 hex of its revision label>` (`rev-unlabeled-<12 hex of its id>` where it names no revision), so
# the house can step back by hand. After a build lands, the newest three revision tags stand and the rest untag, never a
# hand tag (a tag this shim did not write), an image a container runs, or the image the pūlama admitted last or last
# raised. A prune only untags: the pūlama's admission record of a pruned image stays in its state.
REV_TAGS_KEPT=3
tag_outgoing() {
  t_line=$(docker image inspect --format '{{.Id}}|{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$IMAGE_REF" 2>/dev/null | tr -d '\r') || t_line=""
  [ -n "$t_line" ] || { printf 'lares-container: no image stands at %s yet, so no outgoing image takes a revision tag\n' "$IMAGE_REF" >&2; return 0; }
  t_id=${t_line%%|*}; t_rev=${t_line#*|}
  if printf '%s' "$t_rev" | grep -Eq '^[0-9a-f]{12,40}(-dirty)?$'; then
    t_tag="rev-$(printf '%s' "$t_rev" | cut -c1-12)"
    case "$t_rev" in *-dirty) t_tag="$t_tag-dirty" ;; esac
  else
    t_tag="rev-unlabeled-$(printf '%s' "${t_id#sha256:}" | cut -c1-12)"
  fi
  if docker tag "$IMAGE_REF" "$IMAGE_REPO:$t_tag"; then
    printf 'lares-container: the outgoing image keeps the tag %s:%s\n' "$IMAGE_REPO" "$t_tag" >&2
  else
    printf 'lares-container: the outgoing image could not take the tag %s:%s; the build goes on\n' "$IMAGE_REPO" "$t_tag" >&2
  fi
}
# The image the pūlama admitted last (its newest admission row, read from its state on the host) and the image it last
# raised (the host's report). Either may read empty.
pulama_admitted_last() {
  a_dir="$HOUSE/pulama/state/records"
  [ -d "$a_dir" ] || return 0
  # shellcheck disable=SC2012
  a_row=$(grep -l 'lares/pulama/admitted/' "$a_dir"/*.json 2>/dev/null | xargs -r ls -t 2>/dev/null | head -n 1) || a_row=""
  [ -n "$a_row" ] || return 0
  sed -n 's/.*image\\*"[[:space:]]*:[[:space:]]*\\*"\(sha256:[0-9a-f]\{64\}\).*/\1/p' "$a_row" 2>/dev/null | head -n 1
}
prune_rev_tags() {
  p_tags=$(docker image ls --format '{{.Tag}}' "$IMAGE_REPO" 2>/dev/null | tr -d '\r') || return 0
  p_admitted=$(pulama_admitted_last)
  p_raised=$(tr -d '\r\n' < "$HOUSE/pulama/state/image" 2>/dev/null) || p_raised=""
  p_rows=""
  for p_tag in $p_tags; do
    printf '%s' "$p_tag" | grep -Eq '^rev-([0-9a-f]{12}(-dirty)?|unlabeled-[0-9a-f]{1,12})$' || continue
    p_info=$(docker image inspect --format '{{.Created}} {{.Id}}' "$IMAGE_REPO:$p_tag" 2>/dev/null | tr -d '\r') || continue
    [ -n "$p_info" ] || continue
    p_rows="$p_rows$p_info $p_tag
"
  done
  [ -n "$p_rows" ] || return 0
  p_n=0
  printf '%s' "$p_rows" | LC_ALL=C sort -r | while read -r p_created p_id p_tag; do
    p_n=$((p_n + 1))
    [ "$p_n" -gt "$REV_TAGS_KEPT" ] || continue
    if [ -n "$p_admitted" ] && [ "$p_id" = "$p_admitted" ]; then printf 'lares-container: keeps %s:%s: the pūlama admitted it last\n' "$IMAGE_REPO" "$p_tag" >&2; continue; fi
    if [ -n "$p_raised" ] && [ "$p_id" = "$p_raised" ]; then printf 'lares-container: keeps %s:%s: the image the pūlama last raised\n' "$IMAGE_REPO" "$p_tag" >&2; continue; fi
    p_runs=$(docker ps -q --filter "ancestor=$p_id" 2>/dev/null) || p_runs="unknown"
    if [ -n "$p_runs" ]; then printf 'lares-container: keeps %s:%s: a container runs it\n' "$IMAGE_REPO" "$p_tag" >&2; continue; fi
    if docker rmi "$IMAGE_REPO:$p_tag" >/dev/null; then printf 'lares-container: pruned %s:%s (created %s)\n' "$IMAGE_REPO" "$p_tag" "$p_created" >&2
    else printf 'lares-container: %s:%s could not prune; it stands\n' "$IMAGE_REPO" "$p_tag" >&2; fi
  done
}
build_image() { # $1 = the revision; the rest = compose-build args
  b_at=$1; shift
  [ -n "$GIT_REV" ] || die "build refuses: no git checkout answers at $SHIM_DIR, so the image's revision label would name no commit; build from a checkout"
  b_top=$(git -C "$SHIM_DIR" rev-parse --show-toplevel) || die "build refuses: no git checkout answers at $SHIM_DIR"
  b_rev=$(git -C "$b_top" rev-parse --verify --quiet "$b_at^{commit}") || die "build refuses: $b_at names no commit in $b_top; nothing built"
  b_short=$(printf '%s' "$b_rev" | cut -c1-12)
  b_left=$(git -C "$b_top" status --porcelain 2>/dev/null) || b_left=""
  if [ -n "$b_left" ]; then
    printf 'lares-container: the checkout holds %s uncommitted or untracked path(s); the image builds from %s and leaves them out:\n' "$(printf '%s\n' "$b_left" | wc -l | tr -d ' ')" "$b_short" >&2
    printf '%s\n' "$b_left" | head -n 20 | sed 's/^/  /' >&2
  fi
  mkdir -p -- "$HOUSE/cache" || die "cannot make $HOUSE/cache; nothing built"
  b_ctx=$(mktemp -d "$HOUSE/cache/build.XXXXXX") || die "cannot make a scratch folder under $HOUSE/cache; nothing built"
  b_ov="$HOUSE/cache/build-override.${b_ctx##*.}"
  case "$(realpath -m -- "$b_ctx")/" in "$(realpath -m -- "$b_top")/"*) rm -rf -- "$b_ctx"; die "build refuses: the house's cache ($HOUSE/cache) rests inside the checkout; name a LARES_HOUSE outside it" ;; esac
  case "$b_ctx" in *"'"*|*"
"*) rm -rf -- "$b_ctx"; die "build refuses a house path that holds a quote or a newline" ;; esac
  b_fail() { rm -rf -- "$b_ctx" "$b_ctx.tar" "$b_ov"; die "$1"; }
  git -C "$b_top" archive --format=tar -o "$b_ctx.tar" "$b_rev" && tar -xf "$b_ctx.tar" -C "$b_ctx" || b_fail "the archive of $b_short did not unpack; nothing built"
  rm -f -- "$b_ctx.tar"
  # Each submodule at the commit this revision pins (a gitlink: mode 160000), from its own checkout.
  b_mods=$(git -C "$b_top" ls-tree -r "$b_rev" | awk -F '\t' '$1 ~ / commit / { split($1, m, " "); print m[3] " " $2 }')
  if [ -n "$b_mods" ]; then
    while IFS=' ' read -r b_sha b_path; do
      [ -n "$b_sha" ] || continue
      if [ -e "$b_top/$b_path/.git" ] && git -C "$b_top/$b_path" cat-file -e "$b_sha^{commit}" 2>/dev/null; then
        mkdir -p -- "$b_ctx/$b_path"
        git -C "$b_top/$b_path" archive --format=tar -o "$b_ctx.tar" "$b_sha" && tar -xf "$b_ctx.tar" -C "$b_ctx/$b_path" || b_fail "the submodule $b_path at $(printf '%s' "$b_sha" | cut -c1-12) did not unpack; nothing built"
        rm -f -- "$b_ctx.tar"
      else
        printf 'lares-container: the submodule %s stands unchecked-out or lacks its pinned commit %s here, so the image builds without it\n' "$b_path" "$(printf '%s' "$b_sha" | cut -c1-12)" >&2
      fi
    done <<EOF
$b_mods
EOF
  fi
  # THE PŪLAMA'S CODE CLOSURE rides the image as a label (`lares.pulama.closure`): the pūlama runs the vessel's image, so a
  # build compares this digest, never the image id, to decide whether the standing pūlama must re-stand and re-light.
  b_closure=""
  if command -v node >/dev/null 2>&1; then b_closure=$(node "$HERE/pulama-closure.mjs" "$b_ctx" 2>/dev/null | tr -d '\r') || b_closure=""; fi
  if printf '%s' "$b_closure" | grep -Eq '^sha256:[0-9a-f]{64}$'; then
    printf "lares-container: the pūlama's code closure reads %s\n" "$(printf '%s' "$b_closure" | cut -c1-19)" >&2
  else
    b_closure=""
    printf '%s\n' 'lares-container: no pūlama code closure reads from this tree (no host node, or no pūlama entry), so the image carries none and a pūlama beside it reads as moved' >&2
  fi
  printf "services:\n  lares:\n    build:\n      context: '%s'\n      args:\n        GIT_REV: '%s'\n        PULAMA_CLOSURE: '%s'\n" "$b_ctx" "$b_rev" "$b_closure" > "$b_ov"
  GIT_REV=$b_rev; export GIT_REV
  tag_outgoing
  printf 'lares-container: building the vessel image (every package) from commit %s\n' "$b_short" >&2
  if [ -n "$ENV_ARGS" ]; then b_envf=$ENV_FILE; else b_envf=/dev/null; fi
  if docker compose --env-file "$b_envf" -f "$COMPOSE_FILE_PATH" -f "$b_ov" build "$@" lares; then b_rc=0; else b_rc=$?; fi
  rm -rf -- "$b_ctx" "$b_ov"
  [ "$b_rc" -eq 0 ] || die "the build failed (above); $IMAGE_REF stands as it stood"
  BUILT_REV=$b_rev
  prune_rev_tags
  printf 'lares-container: the vessel image stands rebuilt from %s (revision %s); `up` stands it\n' "$b_short" "$b_rev" >&2
  build_host "$b_top" "$b_rev"
}

# THE HOST BUILDS FROM THE SAME REVISION. The host's own `lares` runs this checkout's build, so an image built from the
# commit the checkout stands at takes the host CLI with it (`pnpm run build:host`): one verb keeps the two in step. A
# checkout standing elsewhere (a `--at` of another commit) keeps its own build, and the line names both revisions.
build_host() { # $1 = the checkout's top, $2 = the revision the image carries
  h_head=$(git -C "$1" rev-parse HEAD 2>/dev/null) || h_head=""
  h_short=$(printf '%s' "$2" | cut -c1-12)
  if [ "$h_head" != "$2" ]; then
    printf 'lares-container: the checkout stands at %s and the image carries %s, so the host CLI keeps its own build; build from the checkout'"'"'s commit to bring both into step\n' "$(printf '%s' "$h_head" | cut -c1-12)" "$h_short" >&2
    return 0
  fi
  printf 'lares-container: the host CLI builds from %s, the revision the image carries\n' "$h_short" >&2
  pnpm --dir "$1" run --silent build:host >&2 || die "the host CLI build failed (above); the image stands built from $h_short, and the host keeps its prior build"
}

# THE STAND (`up`, and the rebuild's stand): the moved-image down path, the pūlama, the vessel healthy, the revision and
# image lines, then the unlock or the hint. Inside a rebuild under a pūlama the unlock waits for the admit.
REBUILDING=""
up_verb() {
  ensure_house
  override=""; n=0; files=""
  trap '[ -z "$override" ] || rm -f "$override"' EXIT
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --capture)
        [ "$#" -ge 2 ] || die "--capture wants a directory"
        dir=$(CDPATH= cd -- "$2" 2>/dev/null && pwd -P) || die "--capture: $2 is no directory"
        case "$dir" in
          /|/home|"$(CDPATH= cd -- "${HOME:-/nonexistent}" 2>/dev/null && pwd -P)") die "--capture refuses $dir — name a session root inside it, never a home directory whole" ;;
        esac
        [ ! -S "$dir" ] || die "--capture refuses $dir — it is a socket, not a session root"
        # The path rides the override as a single-quoted YAML scalar (a quote doubles, nothing else escapes), with
        # each dollar sign doubled so compose reads it as a literal and interpolates nothing.
        case "$dir" in *"
"*) die "--capture refuses a path that holds a newline" ;; esac
        yaml_dir=$(printf '%s' "$dir" | sed -e "s/'/''/g" -e 's/\$/$$/g')
        n=$((n + 1))
        files="$files
      - type: bind
        source: '$yaml_dir'
        target: /capture/$n
        read_only: true"
        shift 2 ;;
      --workspace)
        [ "$#" -ge 2 ] || die "--workspace wants <name>=<dir>"
        workspace_bind "$2"
        shift 2 ;;
      *) die "unknown option $1 for up" ;;
    esac
  done
  configured=$(value_of LARES_WORKSPACES)
  if [ -n "$configured" ]; then
    old_ifs=$IFS; IFS=';'
    for pair in $configured; do IFS=$old_ifs; [ -z "$pair" ] || workspace_bind "$pair"; IFS=';'; done
    IFS=$old_ifs
  fi
  down_if_moved
  stand_pulama
  if [ -n "$files" ]; then
    override=$(mktemp)
    printf 'services:\n  lares:\n    volumes:%s\n' "$files" > "$override"
    if [ -n "$ENV_ARGS" ]; then
      docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" -f "$override" up -d --wait lares
    else
      docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" -f "$override" up -d --wait lares
    fi
    up_rc=$?
  else
    if compose up -d --wait lares; then up_rc=0; else up_rc=$?; fi
  fi
  if [ "$up_rc" -ne 0 ]; then printf '%s\n' 'lares-container: the vessel did not become ready — check tools/lares-container.sh logs; if it already runs, run up again' >&2; exit "$up_rc"; fi
  warn_image_revision
  warn_pulama_skew
  if [ -n "$REBUILDING" ] && [ -n "$PULAMA_MODE" ]; then return 0; fi
  unlock_or_name
}

pulama_restand() {
  # THE PŪLAMA RE-STANDS ON THE IMAGE THAT STANDS. `up` never recreates a lit pūlama, so after a `build` this verb
  # does: with no vessel standing (down first), it locks a running pūlama (every session drops, every key zero-fills),
  # then recreates it on the current image. It stands unlit: the operator lights it by hand, then `up` and
  # `pulama admit`. It reads no route and types none.
  restand_vessel=$(compose ps -q --status running lares) || die "pulama restand refuses: docker compose ps failed, so whether a vessel stands reads unknown; nothing recreated"
  [ -z "$restand_vessel" ] || die "pulama restand refuses while the lares vessel stands; run \`tools/lares-container.sh down\` first (nothing recreated)"
  restand_state=$(pulama_state)
  [ "$restand_state" != unknown ] || die "pulama restand refuses: docker compose ps failed for the pūlama, so whether it stands reads unknown; nothing recreated"
  ensure_house
  if [ "$restand_state" = running ]; then
    compose --profile pulama exec -T pulama node "$PULAMA_MAIN" lock </dev/null || die "the pūlama refused the lock; nothing recreated"
  fi
  compose --profile pulama up -d --force-recreate pulama || die "the pūlama did not stand on the current image"
  restand_image=$(value_of LARES_IMAGE); [ -n "$restand_image" ] || restand_image=lares-surface:local
  restand_digest=$(docker image inspect --format '{{.Id}}' "$restand_image" 2>/dev/null) || restand_digest=""
  restand_digest=$(printf '%s' "$restand_digest" | tr -d '\r')
  if [ -n "$IN_REBUILD" ]; then printf 'lares-container: the pūlama stands unlit on %s\n' "${restand_digest:-$restand_image}" >&2
  else printf 'lares-container: the pūlama stands unlit on %s; light it by hand (`tools/lares-container.sh pulama light`), then `tools/lares-container.sh up` and `tools/lares-container.sh pulama admit` (`lares rite kukulu` on a terminal walks all of it)\n' "${restand_digest:-$restand_image}" >&2; fi
}

# THE RESTAND (road rank 4l, L7, folded under `lares rite kukulu`, the one human verb that calls it): `rebuild` raises the
# house onto the image of one revision. It reads where the house stands on every run and walks only what remains, so a run
# that stopped (a refused census, a light not yet typed, no terminal) picks up from wherever the house stands; no file
# remembers a half-done run.
#   1  the image of the revision (HEAD, `--at <rev>`, or `--prior`: the newest kept image before the one the tag holds):
#      the tag holds it already; else a kept `<repo>:rev-<12 hex>` tag does, and it takes the tag (no build); else a build
#      from the commit. `--image` stops here and prints ONE JSON line on stdout naming where the house stands (the rite's
#      reading: the revision, the image, the vessel, the pūlama, lit, admitted, a kūkulu offer)
#   2  under a pūlama: a light is owed where none runs, where its code closure moved, or where it stands unlit; an admit
#      where a new vessel rises on an image the pūlama has not admitted and no kūkulu offer carries. With no terminal, a
#      light or an admit owed stops HERE, before anything moves, and names the hand act
#   3  the down path (keep, census) where the vessel runs another image or the pūlama re-stands; a vessel already on the
#      image stays standing
#   4  the pūlama re-stands where its code moved, then lights ATTACHED on this terminal: the pūlama reads the route
#   5  up on the image; under a pūlama its admit, attached, where owed, then the vessel's unlock (detached) and the face last worn
#   6  one closing line: the revision, the worn face, the keep
# It never switches a branch, never moves the checkout, and never reads or types a route.
IN_REBUILD=""
worn_now() { # the face the census frame names worn, or nothing
  run_census --json >/dev/null 2>&1 || true
  printf '%s\n' "$census_out" | sed -n 's/.*"worn"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n 1
}
label_of() { # $1 = an image reference; the revision its label names, or nothing
  docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1" 2>/dev/null | LC_ALL=C sed -e 's/[[:cntrl:]]//g'
}
image_id() { docker image inspect --format '{{.Id}}' "$IMAGE_REF" 2>/dev/null | tr -d '\r'; }
# THE PRIOR IMAGE: the newest kept `rev-<12 hex>` tag whose image the tag does not hold now, read by its revision label.
prior_revision() {
  pv_cur=$(image_id) || pv_cur=""
  pv_tags=$(docker image ls --format '{{.Tag}}' "$IMAGE_REPO" 2>/dev/null | tr -d '\r') || return 0
  pv_rows=""
  for pv_tag in $pv_tags; do
    printf '%s' "$pv_tag" | grep -Eq '^rev-[0-9a-f]{12}$' || continue
    pv_info=$(docker image inspect --format '{{.Created}} {{.Id}}' "$IMAGE_REPO:$pv_tag" 2>/dev/null | tr -d '\r') || continue
    [ -n "$pv_info" ] && [ "${pv_info#* }" != "$pv_cur" ] || continue
    pv_rows="$pv_rows$pv_info $pv_tag
"
  done
  [ -n "$pv_rows" ] || return 0
  pv_best=$(printf '%s' "$pv_rows" | LC_ALL=C sort -r | head -n 1)
  label_of "$IMAGE_REPO:${pv_best##* }"
}
R_REV=""; R_HOW=""
resolve_image() { # $1 = a revision, or nothing for the prior image
  [ -n "$GIT_REV" ] || die "rebuild refuses: no git checkout answers at $SHIM_DIR, so no revision names the image; run it from a checkout"
  ri_top=$(git -C "$SHIM_DIR" rev-parse --show-toplevel) || die "rebuild refuses: no git checkout answers at $SHIM_DIR"
  if [ -z "$1" ]; then
    R_REV=$(prior_revision)
    printf '%s' "$R_REV" | grep -Eq '^[0-9a-f]{40}$' || die "rebuild --prior finds no kept image before the one $IMAGE_REF holds (a kept image carries the tag $IMAGE_REPO:rev-<12 hex> and its revision label); nothing moved"
  else
    R_REV=$(git -C "$ri_top" rev-parse --verify --quiet "$1^{commit}") || die "rebuild refuses: $1 names no commit in $ri_top; nothing moved"
  fi
  ri_short=$(printf '%s' "$R_REV" | cut -c1-12)
  if [ "$(label_of "$IMAGE_REF")" = "$R_REV" ]; then
    R_HOW=stood
    printf 'lares-container: %s holds the image of %s already; no build\n' "$IMAGE_REF" "$ri_short"
    return 0
  fi
  ri_kept="$IMAGE_REPO:rev-$ri_short"
  if [ "$(label_of "$ri_kept")" = "$R_REV" ]; then
    tag_outgoing
    docker tag "$ri_kept" "$IMAGE_REF" || die "the kept image $ri_kept could not take the tag $IMAGE_REF; it stands as it stood"
    R_HOW=kept
    printf 'lares-container: %s now holds the kept image %s; no build\n' "$IMAGE_REF" "$ri_kept"
    return 0
  fi
  [ -n "$1" ] || die "rebuild --prior: the kept tag $ri_kept no longer holds revision $ri_short; nothing moved"
  build_image "$R_REV"
  R_HOW=built
}
# THE PŪLAMA'S OWN STATUS (`pulama-main.js status`, read detached): whether it stands lit, and whether the admitted set it
# reads under its key names the image and no tombstone ends it. An unlit pūlama lists no admission; a status that never
# answers leaves both unread.
ps_lit=""; ps_admitted=""
pulama_status_read() { # $1 = the image digest
  ps_lit=""; ps_admitted=""
  ps_flat=$(compose --profile pulama exec -T pulama node "$PULAMA_MAIN" status </dev/null 2>/dev/null | tr -d ' \t\r\n') || return 0
  case "$ps_flat" in *'"lit":true'*) ps_lit=yes ;; *'"lit":false'*) ps_lit=no; return 0 ;; *) return 0 ;; esac
  ps_list=$(printf '%s' "$ps_flat" | sed -n 's/.*"admitted":\[\([^]]*\)\].*/\1/p')
  ps_ended=$(printf '%s' "$ps_flat" | sed -n 's/.*"ended":\[\([^]]*\)\].*/\1/p')
  ps_admitted=no
  case "$ps_list" in *"\"$1\""*) case "$ps_ended" in *"\"$1\""*) ;; *) ps_admitted=yes ;; esac ;; esac
}
# A kūkulu offer the standing vessel rested (config/kukulu-offer.json) whose vouch names the image: the next vessel offers
# it once, and the pūlama lends on it with no admit.
offer_carries() { [ -n "$1" ] && [ -f "$HOUSE/config/kukulu-offer.json" ] && grep -qF -- "$1" "$HOUSE/config/kukulu-offer.json"; }
# Does a vessel run the image the tag names? vo_running reads yes wherever a vessel runs at all.
vo_running=""
vessel_on_image() {
  vo_running=""
  vo_id=$(compose ps -q --status running lares 2>/dev/null) || return 1
  [ -n "$vo_id" ] || return 1
  vo_running=yes
  vo_ran=$(docker inspect --format '{{.Image}}' "$vo_id" 2>/dev/null | tr -d '\r') || return 1
  vo_stands=$(image_id) || return 1
  [ -n "$vo_ran" ] && [ "$vo_ran" = "$vo_stands" ]
}
print_reading() {
  rd_image=$(image_id) || rd_image=""
  if vessel_on_image; then rd_current=true; else rd_current=false; fi
  if [ -n "$vo_running" ]; then rd_vessel=standing; else rd_vessel=down; fi
  rd_pulama=off; rd_lit=null; rd_admitted=null
  if [ -n "$PULAMA_MODE" ]; then
    pulama_reading; rd_pulama=$pr_state
    case "$pr_state" in
      absent|unread) ;;
      *) pulama_status_read "$rd_image"
         case "$ps_lit" in yes) rd_lit=true ;; no) rd_lit=false ;; esac
         case "$ps_admitted" in yes) rd_admitted=true ;; no) rd_admitted=false ;; esac ;;
    esac
  fi
  if offer_carries "$rd_image"; then rd_offer=true; else rd_offer=false; fi
  printf '{"op":"rebuild-image","revision":"%s","image":"%s","how":"%s","vessel":"%s","current":%s,"pulama":"%s","lit":%s,"admitted":%s,"offer":%s}\n' \
    "$R_REV" "$rd_image" "$R_HOW" "$rd_vessel" "$rd_current" "$rd_pulama" "$rd_lit" "$rd_admitted" "$rd_offer"
}
HAND_LINE='your hand: lares rite kukulu on a terminal'
stand_house() {
  s_digest=$(image_id) || s_digest=""
  s_restand=""; s_light=""; s_admit=""; s_stays=""; s_why=""
  if vessel_on_image; then s_stays=yes; fi
  if [ -n "$PULAMA_MODE" ]; then
    pulama_reading
    case "$pr_state" in
      unread) die "rebuild stops before anything moves: whether the pūlama stands, or what it runs, reads unknown (read it with \`tools/lares-container.sh pulama status\`)" ;;
      absent) s_restand=yes; s_light=yes; s_why="no pūlama runs" ;;
      moved) s_restand=yes; s_light=yes; s_why="the pūlama's code closure moved" ;;
      *) pulama_status_read "$s_digest"
         case "$ps_lit" in
           yes) ;;
           no) s_light=yes; s_why="the pūlama stands unlit" ;;
           *) die "rebuild stops before anything moves: the pūlama answers no status, so whether it stands lit reads unknown (read it with \`tools/lares-container.sh pulama status\`)" ;;
         esac ;;
    esac
    [ -z "$s_restand" ] || s_stays=""
    if [ -z "$s_light" ] && [ -z "$s_stays" ] && [ "$ps_admitted" != yes ] && ! offer_carries "$s_digest"; then s_admit=yes; fi
    if [ -z "$HAVE_TTY" ]; then
      [ -z "$s_light" ] || die "rebuild stops before anything moves: $s_why, and its light reads your route on a terminal; $HAND_LINE"
      [ -z "$s_admit" ] || die "rebuild stops before anything moves: the pūlama has not admitted this image and no kūkulu offer carries it, and its admit reads your route on a terminal; $HAND_LINE (or string a kukulu lei first: lares lei kui --rite kukulu --branch <name> --returns <n> --all)"
    fi
  fi
  if [ -n "$s_stays" ]; then
    KEEP_SAID="the vessel stayed standing, so no keep ran"
    printf 'lares-container: rebuild: the vessel runs %s already and stays standing\n' "$s_digest" >&2
  else
    printf '%s\n' 'lares-container: rebuild: the down path (keep, census)' >&2
    down_vessel
  fi
  [ -z "$s_restand" ] || pulama_restand
  if [ -n "$s_light" ]; then
    printf 'lares-container: rebuild: %s; the pūlama lights on this terminal (it reads your route, this shim never does)\n' "$s_why" >&2
    compose --profile pulama exec pulama node "$PULAMA_MAIN" light || true
    pulama_status_read "$s_digest"
    [ "$ps_lit" = yes ] || die "the pūlama did not light (above); run \`lares rite kukulu\` again on a terminal, and it picks up from here"
    if [ -z "$s_stays" ] && [ "$ps_admitted" != yes ] && ! offer_carries "$s_digest"; then s_admit=yes; fi
  fi
  if [ -z "$s_stays" ]; then REBUILDING=yes; up_verb; fi
  if [ -n "$PULAMA_MODE" ]; then
    if [ -n "$s_admit" ]; then
      printf '%s\n' 'lares-container: rebuild: the pūlama admits the image; it reads your route on this terminal' >&2
      compose --profile pulama exec pulama node "$PULAMA_MAIN" admit || die "the pūlama admitted nothing (above); the vessel stands at the floor: \`tools/lares-container.sh pulama admit\`, then \`tools/lares-container.sh vault unlock --all\`"
    fi
    if [ -n "$s_stays" ]; then unlock_or_name
    else
      # shellcheck disable=SC2046
      waited_exec $(pass_env) -T lares node "$CLI" vault unlock --all </dev/null || die "the vessel did not open (above); read it with \`tools/lares-container.sh pulama status\`, then \`tools/lares-container.sh vault unlock --all\`"
      if none_worn; then wear_last_face; fi
    fi
  elif [ -n "$s_stays" ]; then unlock_or_name; fi
  r_worn=${WORE#h}; [ -n "$r_worn" ] || r_worn=$(worn_now)
  r_rev=$(label_of "$IMAGE_REF" | cut -c1-12)
  if [ -n "$r_worn" ]; then r_wearing="wearing h$r_worn"; else r_wearing="no face worn (wear one: \`tools/lares-container.sh wear N\`)"; fi
  printf 'lares-container: the house stands on revision %s, %s; keep: %s\n' "${r_rev:-unlabeled}" "$r_wearing" "${KEEP_SAID:-none ran}" >&2
}
rebuild_verb() {
  r_at=HEAD; r_at_given=""; r_prior=""; r_image=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --at) [ "$#" -ge 2 ] || die "rebuild --at wants a revision"; r_at=$2; r_at_given=yes; shift 2 ;;
      --prior) r_prior=yes; shift ;;
      --image) r_image=yes; shift ;;
      *) die "rebuild takes --at <rev>, --prior and --image, and \"$1\" names none of them" ;;
    esac
  done
  [ -z "$r_prior" ] || [ -z "$r_at_given" ] || die "rebuild takes --at <rev> or --prior, never both"
  IN_REBUILD=yes
  # Every line the image step prints rides stderr, so stdout carries the reading alone.
  if [ -n "$r_prior" ]; then resolve_image "" >&2; else resolve_image "$r_at" >&2; fi
  if [ -n "$r_image" ]; then print_reading; return 0; fi
  stand_house
}

case "$verb" in
  up) up_verb "$@" ;;
  rebuild) rebuild_verb "$@" ;;
  down) down_vessel "$@" ;;
  pulama)
    [ -n "$PULAMA_MODE" ] || die "pulama needs LARES_PULAMA=1 in the environment or $ENV_FILE"
    case "${1:-}" in
      up) ensure_house; compose --profile pulama up -d --no-recreate pulama ;;
      down) compose --profile pulama stop pulama ;;
      restand)
        [ "$#" -eq 1 ] || die "pulama restand takes no arguments"
        pulama_restand ;;
      light|lock|status|tessera)
        [ "$1" != status ] || warn_pulama_skew
        # light reads the operator's route on a real terminal inside the pūlama, never through a pipe.
        # shellcheck disable=SC2046
        compose --profile pulama exec $(tty_flag) pulama node "$PULAMA_MAIN" "$1" ;;
      admit)
        # admit reads the route the same way; the face ordinals name the lent set (none names every lit face).
        shift
        for face in "$@"; do
          case "$face" in ''|*[!0-9]*) die "pulama admit takes face ordinals (numbers)" ;; esac
        done
        # shellcheck disable=SC2046
        compose --profile pulama exec $(tty_flag) pulama node "$PULAMA_MAIN" admit "$@" ;;
      unadmit)
        # unadmit ends one image's admission: the route proves on a real terminal inside the pūlama, and a signed
        # tombstone naming the admission's tessera rests; the gate then reads pulama-image-unadmitted.
        [ "$#" -eq 2 ] || die "pulama unadmit takes one image digest (sha256:<64 hex>)"
        case "$2" in sha256:*) hex=${2#sha256:} ;; *) die "pulama unadmit takes one image digest (sha256:<64 hex>)" ;; esac
        case "$hex" in *[!0-9a-f]*|'') die "pulama unadmit takes one image digest (sha256:<64 hex>)" ;; esac
        [ "${#hex}" -eq 64 ] || die "pulama unadmit takes one image digest (sha256:<64 hex>)"
        # shellcheck disable=SC2046
        compose --profile pulama exec $(tty_flag) pulama node "$PULAMA_MAIN" unadmit "$2" ;;
      keep-seat)
        # THE KEEP SEAT ON A PŪLAMA HOUSE: the pūlama proves the steward's route on this terminal and answers the WRAPPED
        # seat plus the local signing seed on one stdout line; the shim writes that line VERBATIM as config/keep-seat.json
        # (0600, temp file then rename), since the house CLI reads it whole. The pūlama gains no config mount. The signer is
        # secret: it never reaches the screen, a log or argv, only the file.
        reseat=""; [ "${2:-}" = --reseat ] && reseat=yes
        [ "$#" -le 2 ] || die "pulama keep-seat takes only --reseat"
        [ -n "$HAVE_TTY" ] || die "pulama keep-seat reads its route on a terminal; run it on one (nothing seated)"
        seat_file="$HOUSE/config/keep-seat.json"
        if [ -e "$seat_file" ] && [ -z "$reseat" ]; then die "a keep seat already rests at $seat_file; pass --reseat to replace it"; fi
        # THE ROUTE RIDES A FORCED TERMINAL, THE ANSWER A CAPTURE: a captured stdout makes compose drop the pseudo-terminal
        # (`--no-TTY` defaults to "stdout reads no terminal"), and the pūlama then refuses route-needs-a-terminal, so the
        # exec forces one (`--no-TTY=false`): the operator's keystrokes reach the pūlama's pty in raw mode (no echo), while
        # every byte it writes, its own prompt and the seat line, folds into the capture and never reaches the screen. The
        # shim's line below stands as the prompt; the CRLF the pty writes strips before the one seat line is read, and the
        # capture clears at once (a key typed before the pūlama lifts echo lands there, never on screen or in a log).
        printf '%s\n' 'lares-container: the pūlama now reads the steward'"'"'s route to seat the keep: type it, then Enter (typed, unseen)' >&2
        out=$(compose --profile pulama exec --no-TTY=false pulama node "$PULAMA_MAIN" keep-seat) || true
        line=$(printf '%s\n' "$out" | tr -d '\r' | grep '^{"op":"keep-seat"' | tail -n 1)
        out=""
        case "$line" in
          *'"reading":"seated"'*) ;;
          *'"reading":"refused"'*) die "the pūlama seated nothing: $(printf '%s' "$line" | sed -e 's/.*"code":"\([^"]*\)".*"message":"\([^"]*\)".*/\1 (\2)/')" ;;
          *) die "the pūlama answered no seat; nothing written" ;;
        esac
        case "$line" in *'"signer":"'*'"seat":{'*|*'"seat":{'*'"signer":"'*) ;; *) die "the pūlama's seat line read malformed; nothing written" ;; esac
        file=$line
        mkdir -p -- "$HOUSE/config" || die "cannot make $HOUSE/config; nothing written"
        tmp="$seat_file.$$.tmp"
        ( umask 077; printf '%s\n' "$file" > "$tmp" ) && chmod 600 "$tmp" && mv -f -- "$tmp" "$seat_file" || { rm -f -- "$tmp"; die "the seat could not be written to $seat_file"; }
        printf 'lares-container: the keep seat rests at %s (0600); a keep now seals under it\n' "$seat_file" >&2 ;;
      *) die "pulama takes up, down, restand, light, admit, unadmit, keep-seat, lock, status or tessera" ;;
    esac ;;
  reset)
    [ "$#" -eq 0 ] || die "reset takes no arguments"
    if running_vessel; then die "reset refuses while the lares vessel stands; run tools/lares-container.sh down first"; fi
    [ -n "$HAVE_TTY" ] || die "reset needs a terminal; nothing removed"
    # Compose accepts plain KEY=VALUE lines; reset accepts literal paths alone and resolves symlinks before clearing.
    # IT CLEARS THE HEARTH ALONE: sensoriums, projections, library, config, the env file and the image stay.
    house=$HOUSE
    workspace=$(value_of LARES_WORKSPACE)
    case "$house" in /*) ;; *) die "reset refuses an empty or non-absolute LARES_HOUSE" ;; esac
    case "$workspace" in /*) ;; *) die "reset refuses an empty or non-absolute LARES_WORKSPACE" ;; esac
    house=$(realpath -e -- "$house") || die "reset cannot resolve LARES_HOUSE"
    workspace=$(realpath -m -- "$workspace") || die "reset cannot resolve LARES_WORKSPACE"
    home=$(realpath -m -- "$HOME") || die "reset cannot resolve HOME"
    [ -d "$house" ] || die "reset needs LARES_HOUSE to name a directory"
    case "$house" in /|"$home"|"$workspace"|"$workspace"/*) die "reset refuses unsafe LARES_HOUSE: $house" ;; esac
    case "$workspace/" in "$house/"*) die "reset refuses LARES_HOUSE containing LARES_WORKSPACE: $house" ;; esac
    case "$home/" in "$house/"*) die "reset refuses LARES_HOUSE containing HOME: $house" ;; esac
    hearth=$(realpath -e -- "$house/hearth") || die "reset finds no hearth at $house/hearth; nothing removed"
    [ "$hearth" = "$house/hearth" ] || die "reset refuses a hearth that resolves outside LARES_HOUSE ($hearth); nothing removed"
    [ -d "$hearth" ] || die "reset needs $house/hearth to name a directory"
    # Any running container that binds the hearth holds the store: a founding run, a harness, a hand-started one.
    holders=$(docker ps -q --filter "volume=$hearth") || die "cannot read running containers (docker ps failed); nothing removed"
    [ -z "$holders" ] || die "reset refuses while a running container binds $hearth: $holders"
    printf 'LARES_HOUSE: %s\nReset removes every entry inside %s; the hearth directory itself, sensoriums, projections, library, config, the env file and the image stay.\nThe projections stay, and with them the private memory of every face in cleartext (%s/projections/wikis/daemon-*, bags/daemon-*, bags/kahua-*): a re-founding never clears them. Export first (lares export <dest>) to carry that memory to the new face; a bundle exported under %s/config stays, and so does its import journal (keyed by the faces it landed on, so the re-founded faces import it afresh); the next export names those folders and the step that clears them.\nType re-found to proceed: ' "$house" "$hearth" "$house" "$house"
    IFS= read -r answer || die "reset confirmation not read; nothing removed"
    [ "$answer" = re-found ] || die "reset confirmation did not match; nothing removed"
    failed=""
    for entry in "$hearth"/* "$hearth"/.[!.]* "$hearth"/..?*; do
      [ -e "$entry" ] || [ -L "$entry" ] || continue
      if ! rm -rf -- "$entry"; then
        printf 'lares-container: cannot remove %s; clear it with its owner or administrator, then run reset again (no sudo runs here)\n' "$entry" >&2
        failed=yes
      fi
    done
    [ -z "$failed" ] || exit 1
    printf '%s\n' 'lares-container: hearth cleared; sensoriums, projections, library and config stand; the hearth can be founded again.' ;;
  logs)  compose logs "$@" lares ;;
  build)
    at=HEAD
    if [ "${1:-}" = --at ]; then [ "$#" -ge 2 ] || die "build --at wants a revision"; at=$2; shift 2; fi
    build_image "$at" "$@" ;;
  found)
    ensure_house
    # shellcheck disable=SC2046
    waited_run $(pass_env) $(tty_flag) offline vessel found --skip-build --root /lar --genesis /app/genesis "$@" ;;
  vessel)
    observing=""
    for arg in "$@"; do if [ "$arg" = --observe ]; then observing=yes; fi; done
    case "${1:-}" in
      stand)
        if [ -n "$observing" ]; then follow_up=""; route_cli "$verb" "$@"
        elif [ "$#" -gt 1 ]; then route_cli "$verb" "$@"
        else
          # The no-argument acting stand belongs to the host: it stands, restarts on a `restand` verdict, or prints
          # the standing. Option-bearing forms go to the CLI, which owns their validation and execution.
          if ! running_vessel; then ensure_house; stand_pulama; compose up -d --wait lares; warn_image_revision; unlock_or_name
          elif ! observe_standing || ! verdict_known; then die "the standing vessel answered no verdict"
          elif verdict_restand; then lift_vessel
          else printf '%s\n' "$observe_output"; fi
        fi ;;
      # Stopping the daemon stops the container's main process: a host act.
      stop) [ "$#" -eq 1 ] || die "vessel stop takes no option through this shim"; compose stop lares ;;
      rite) route_cli "$verb" "$@" ;;
      *) route_cli "$verb" "$@" ;;
    esac ;;
  lei)
    # THE LEI HAND DOOR UNDER A PŪLAMA (#269): the pūlama opens no document, so the vessel reads the act's terms (the
    # face, and for a restring the line's tip), the pūlama reads the route on THIS terminal and signs one record, and the
    # vessel lands it. The signing's terminal output shows here as it runs (its prompt among it); the answer is the last
    # object it prints, from its opening brace at the line's start to the end, joined onto one line. A signing that answers
    # no record lands nothing. Without a pūlama, every lei act routes as before.
    case "${1:-}" in
      kui|restring|unstring)
        if [ -n "$PULAMA_MODE" ]; then
          act=$1
          [ -n "$HAVE_TTY" ] || die "lei under a pūlama reads its route on a terminal; run it on one (nothing signed)"
          # shellcheck disable=SC2046
          terms=$(compose exec $(pass_env) -T lares node "$CLI" lei terms "$@" </dev/null) || exit $?
          # The answer rides a pipe (tee, then the last printed object), and a captured stdout makes compose drop the pty, so the
          # exec forces one (`--no-TTY=false`): the pūlama reads the route on the operator's terminal.
          answer=$(compose --profile pulama exec --no-TTY=false pulama node "$PULAMA_MAIN" lei "$act" "$terms" | tee /dev/stderr | tr -d '\r' | awk '/^\{/ { seen = 1; answer = "" } seen { answer = answer $0 } END { if (seen) print answer }')
          [ -n "$answer" ] || die "the pūlama signed nothing; nothing lands"
          # shellcheck disable=SC2046
          waited_exec $(pass_env) -T lares node "$CLI" lei land "$answer" </dev/null
          exit $?
        fi ;;
    esac
    route_cli "$verb" "$@" ;;
  wear)
    # `lares wear N` moves the daemon mount inside the lent set and asks no route; a wear that landed names the face the
    # operator wears, which the shim keeps for the next stand.
    if route_cli "$verb" "$@"; then rc=0; else rc=$?; fi
    if [ "$rc" -eq 0 ]; then
      for arg in "$@"; do case "$arg" in ''|*[!0-9]*) ;; *) remember_worn_face --face "$arg"; break ;; esac; done
    fi
    exit "$rc" ;;
  vault)
    # A `vault unlock --face N` that landed names the face the operator wears: the shim keeps it for the next stand.
    # Under a pūlama the unlock runs detached from this terminal: the route goes to the pūlama (pulama light), never
    # into a vessel's prompt.
    if [ -n "$PULAMA_MODE" ] && [ "${1:-}" = unlock ]; then
      attached=$HAVE_TTY; HAVE_TTY=""
      if route_cli "$verb" "$@" </dev/null; then rc=0; else rc=$?; fi
      HAVE_TTY=$attached
    elif route_cli "$verb" "$@"; then rc=0; else rc=$?; fi
    if [ "$rc" -eq 0 ] && [ "${1:-}" = unlock ]; then
      remember_worn_face "$@"
      # An unlock under a pūlama that named no face can leave faces lent and none worn: the shim wears the last one.
      if [ -n "$PULAMA_MODE" ] && [ -z "$face" ] && none_worn; then wear_last_face; fi
      # THE UNLOCK'S FACE REACHES THE PŪLAMA. The pūlama keeps the face worn in memory and wears it again after a restart,
      # and only `wear` writes that memory, never the unlock: the shim follows a named face with `wear N`, the chain `up`
      # walks, so the pūlama's memory and the face this shim keeps name one face.
      case "$face" in
        ''|*[!0-9]*) ;;
        *) if [ -n "$PULAMA_MODE" ]; then
             # shellcheck disable=SC2046
             waited_exec $(pass_env) -T lares node "$CLI" wear "$face" </dev/null || printf 'lares-container: the vessel opened h%s, but the wear that tells the pūlama refused; a restart re-wears the face last worn: run `lares-container.sh wear %s`\n' "$face" "$face" >&2
           fi ;;
      esac
    fi
    exit "$rc" ;;
  *) route_cli "$verb" "$@" ;;
esac
