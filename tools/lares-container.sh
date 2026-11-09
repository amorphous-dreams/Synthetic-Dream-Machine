#!/bin/sh
# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml).
#
#   lares-container.sh up [--capture <dir>]...   stand the vessel (detached) and wait until it answers healthy
#   lares-container.sh down [compose-down args]  stop it and remove its container (the house stays in LARES_HOUSE),
#                                                after a census of what a stop would drop (below)
#   lares-container.sh reset                     clear a stopped vessel's hearth (LARES_HOUSE/hearth alone) after
#                                                terminal confirmation; sensoriums, projections, library and config stay
#   lares-container.sh found [vessel-found args] the founding act, under a TTY (it gathers the human route: a passphrase
#                                                and/or a paper pin, and `--hearth` prints the seed card and reads it
#                                                back; with no TTY the CLI refuses CredentialTtyRefusal)
#   lares-container.sh logs [compose-logs args]  follow the vessel's log
#   lares-container.sh build [compose-build args] build the vessel image through the env file, baking the checkout's
#                                                HEAD into its revision label; a dirty checkout, or none, refuses
#   lares-container.sh vessel stand              stand the vessel when none stands; restart it when its standing no
#                                                longer matches its state on disk; otherwise print the standing
#   lares-container.sh vessel stop               stop the vessel's container (state stays; `up` stands it again)
#   lares-container.sh vault unlock              hand the standing vessel a credential typed on this TTY: it opens its
#                                                vessel key and composes with what the key opens
#   lares-container.sh vault lock                the standing vessel drops its key and stands at the floor
#   lares-container.sh <anything else>           run the lares CLI: inside the standing vessel, or through the offline
#                                                door when no vessel stands (vault status|bind|unbind read their
#                                                credential on that TTY)
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
# a failed exec, the bound passing), prints what it learned and refuses, naming two ways on: unlock and let it settle
# (`vault unlock`, then `down` again), or type `accept-loss` on this terminal to stop anyway. With no terminal it
# refuses. With no vessel standing, `down` runs as it always has.
#
# LARES_HOUSE and LARES_WORKSPACE come from the environment or the operator's `~/.lares/lares-surface.env` (KEY=VALUE
# lines, as compose reads them). Neither standing refuses by name, and so does a LARES_HOUSE that reads relative.
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
# THE ENV FILE RESTS OUTSIDE EVERY BIND: inside one, the container would read (and a reset could clear) the file that
# names its own mounts.
env_real=$(realpath -m -- "$ENV_FILE")
house_real=$(realpath -m -- "$HOUSE")
for class in $HOUSE_CLASSES; do
  case "$env_real" in "$house_real/$class"|"$house_real/$class"/*) die "the env file $ENV_FILE sits inside LARES_HOUSE's $class bind — keep it outside every bind" ;; esac
done

# Make the five bound classes as the operator, so the engine never makes one owned by root.
ensure_house() {
  for class in $HOUSE_CLASSES; do
    mkdir -p -- "$HOUSE/$class" || die "cannot make $HOUSE/$class — make it as the operator, then run again"
  done
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

# The vessel just stood (or restarted), so it holds no key. With a TTY, run the unlock attached; without one, name
# it. A refused or abandoned unlock leaves the vessel standing at the floor and never fails the act that stood it.
unlock_or_name() {
  if key_held; then return 0; fi
  if [ -n "$HAVE_TTY" ]; then
    printf '%s\n' 'lares-container: the vessel stands holding no vessel key; unlocking it on this terminal' >&2
    if ! compose exec lares node "$CLI" vault unlock; then
      printf '%s\n' 'lares-container: the vessel still stands at the floor; open it with `lares-container.sh vault unlock`' >&2
    fi
  else
    printf '%s\n' 'lares-container: the vessel stands holding no vessel key; open it on a terminal: lares-container.sh vault unlock' >&2
  fi
}

# THE IMAGE'S REVISION LABEL AGAINST THE CHECKOUT'S HEAD. A rebuild bakes `GIT_REV` into the image; an image that names
# another revision, or none, runs older code than the checkout holds. A dirty tree labels `<sha>-dirty`, which no clean
# build matches. It warns and stands: the operator decides whether the rebuild is owed. No git, or no checkout: it skips.
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
  [ "$label" != "$GIT_REV" ] || return 0
  if [ -n "$GIT_DIRTY" ]; then
    printf 'lares-container: the image names revision %s and the checkout holds uncommitted changes; commit first, then rebuild with `tools/lares-container.sh build` and `up` again\n' "${label:-none}" >&2
  else
    printf 'lares-container: the image names revision %s and the checkout stands at %s; rebuild with `tools/lares-container.sh build`, then `up` again\n' "${label:-none}" "$GIT_REV" >&2
  fi
}

lift_vessel() {
  reason=$(printf '%s\n' "$observe_output" | sed -n 's/.*"standing"[[:space:]]*:[[:space:]]*{[^}]*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  printf 'lares-container: %s; restarting the vessel\n' "${reason:-the standing requires a re-stand}" >&2
  if ! compose restart lares; then printf '%s\n' 'lares-container: the vessel restart failed' >&2; return 1; fi
  if ! compose up -d --wait lares; then printf '%s\n' 'lares-container: the vessel did not answer healthy after its restart' >&2; return 1; fi
  unlock_or_name
}

# Any CLI verb: inside the standing vessel, else through the offline door. A verb that succeeds inside a standing
# vessel gets followed by one standing check, and the shim lifts the vessel when the verdict asks for it. A caller
# that asked for the reading itself (`--observe`) gets that reading alone.
follow_up=yes
route_cli() {
  if running_vessel; then
    # shellcheck disable=SC2046
    if compose exec $(tty_flag) lares node "$CLI" "$@"; then rc=0; else rc=$?; fi
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
    compose --profile offline run --rm $(tty_flag) offline "$@"
  fi
}

# THE CENSUS BEFORE A STOP, bounded: the census itself waits on its own lines (ten seconds for the custody door, fifteen
# per island page), and this bound stands over the whole exec, so a wedged vessel never hangs `down`.
CENSUS_WAIT_SECONDS=60
census_out=""; census_err=""; census_timed_out=""
run_census() {
  census_dir=$(mktemp -d) || return 125
  (
    if [ -n "$ENV_ARGS" ]; then exec docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" exec -T lares node "$CLI" vessel census --no-json
    else exec docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" exec -T lares node "$CLI" vessel census --no-json; fi
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

# The two ways on, then the typed acceptance: only the word `accept-loss`, typed on this terminal, stops anyway.
offer_accept_loss() {
  printf '%s\n' 'lares-container: the vessel stands. Two ways on:' \
    '  - unlock it and let it settle: tools/lares-container.sh vault unlock, then tools/lares-container.sh down again' \
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
  if [ "$rc" -eq 3 ] && [ -z "$census_timed_out" ]; then
    printf '%s\n' 'lares-container: down refuses a silent stop: the census names content that rests nowhere yet, and a stop now drops it:' >&2
    printf '%s\n' "$census_out" | sed -e '/^$/d' -e 's/^/  /' >&2
  else
    if [ -n "$census_timed_out" ]; then why="no answer within ${CENSUS_WAIT_SECONDS}s (the vessel may stand wedged)"
    else why="the census exec ended with status $rc"; fi
    printf 'lares-container: down refuses a silent stop: the census could not answer (%s), so what a stop would drop reads unknown\n' "$why" >&2
    if [ -n "$census_out" ]; then printf '%s\n' "$census_out" | sed -e '/^$/d' -e 's/^/  /' >&2; fi
    if [ -n "$census_err" ]; then printf '%s\n' "$census_err" | sed -e '/^$/d' -e 's/^/  /' >&2; fi
  fi
  offer_accept_loss
}

# Read the terminal NOW: inside `$(tty_flag)` stdout is the substitution's pipe, so a `[ -t 1 ]` there is always false
# and every founding would lose its TTY.
HAVE_TTY=""
if [ -t 0 ] && [ -t 1 ]; then HAVE_TTY=yes; fi
tty_flag() { if [ -z "$HAVE_TTY" ]; then printf -- '-T'; fi; }

[ "$#" -gt 0 ] || die "usage: lares-container.sh up|down|reset|found|logs|build|vessel stand|<lares verb…>"
verb=$1; shift

case "$verb" in
  up)
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
        *) die "unknown option $1 for up" ;;
      esac
    done
    if [ -n "$files" ]; then
      override=$(mktemp)
      printf 'services:\n  lares:\n    volumes:%s\n' "$files" > "$override"
      if [ -n "$ENV_ARGS" ]; then
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" -f "$override" up -d --wait lares
      else
        docker compose --env-file /dev/null -f "$COMPOSE_FILE_PATH" -f "$override" up -d --wait lares
      fi
    else
      compose up -d --wait lares
    fi
    warn_image_revision
    unlock_or_name ;;
  down)
    # A ps that fails reads as UNKNOWN: whether a vessel stands, and what it holds, goes uncounted, so the same typed
    # acceptance guards the stop.
    if ! down_id=$(compose ps -q --status running lares); then
      printf '%s\n' 'lares-container: down refuses a silent stop: docker compose ps failed, so whether a vessel stands reads unknown' >&2
      offer_accept_loss
    elif [ -n "$down_id" ]; then
      census_before_stop
    fi
    compose down --remove-orphans "$@" ;;
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
    printf 'LARES_HOUSE: %s\nReset removes every entry inside %s; the hearth directory itself, sensoriums, projections, library, config, the env file and the image stay.\nType re-found to proceed: ' "$house" "$hearth"
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
    # THE IMAGE BUILDS THROUGH THE SHIM: compose reads the env file (LARES_HOUSE, LARES_WORKSPACE interpolate), and the
    # revision label names the commit the checkout stands at. A label must name a real commit, so a dirty checkout
    # refuses (commit first), and so does a shim outside any checkout (the label would read empty).
    [ -n "$GIT_REV" ] || die "build refuses: no git checkout answers at $SHIM_DIR, so the image's revision label would name no commit; build from a checkout"
    [ -z "$GIT_DIRTY" ] || die "build refuses: the checkout holds uncommitted tracked changes, so the image's revision label ($GIT_REV) would name no real commit; commit first, then run build again"
    printf 'lares-container: building the vessel image at revision %s\n' "$GIT_REV" >&2
    compose build "$@" lares ;;
  found)
    ensure_house
    # shellcheck disable=SC2046
    compose --profile offline run --rm $(tty_flag) offline vessel found --skip-build --root /lar --genesis /app/genesis "$@" ;;
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
          if ! running_vessel; then ensure_house; compose up -d --wait lares; unlock_or_name
          elif ! observe_standing || ! verdict_known; then die "the standing vessel answered no verdict"
          elif verdict_restand; then lift_vessel
          else printf '%s\n' "$observe_output"; fi
        fi ;;
      # Stopping the daemon stops the container's main process: a host act.
      stop) [ "$#" -eq 1 ] || die "vessel stop takes no option through this shim"; compose stop lares ;;
      rite) route_cli "$verb" "$@" ;;
      *) route_cli "$verb" "$@" ;;
    esac ;;
  *) route_cli "$verb" "$@" ;;
esac
