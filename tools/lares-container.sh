#!/bin/sh
# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml).
#
#   lares-container.sh up [--capture <dir>]...   stand the vessel (detached) and wait until it answers healthy
#   lares-container.sh down                      stop it and remove its container (state stays in LARES_STATE)
#   lares-container.sh found [vessel-found args] the founding act, under a TTY (it gathers the human route: a passphrase
#                                                and/or a paper pin; with no TTY the CLI refuses CredentialTtyRefusal)
#   lares-container.sh logs [compose-logs args]  follow the vessel's log
#   lares-container.sh vessel stand              stand the vessel when none stands; restart it when its standing no
#                                                longer matches its state on disk; otherwise print the standing
#   lares-container.sh vessel stop               stop the vessel's container (state stays; `up` stands it again)
#   lares-container.sh <anything else>           run the lares CLI: inside the standing vessel, or through the offline
#                                                door when no vessel stands (vault status|unlock|bind|unbind read their
#                                                credential on that TTY)
#
# ONE STORE DOOR. While a vessel stands the CLI runs by `compose exec`, sharing the daemon's /tmp (the UDS
# rendezvous), uid and environment. With no vessel standing, one `compose run` of the `offline` service owns the
# store for that act. So a face lights before `up`: found, `persona new 0 --name <label>`, `persona wear 0`, up.
#
# THE HOST HOLDS THE ENGINE. The app gets no docker socket, and the CLI inside never stops or starts the daemon.
# After each exec'd verb that succeeds, the shim reads the CLI's standing verdict (`vessel stand --observe --json`)
# and restarts the vessel itself when the verdict reads `restand` (a face lit after boot). `vessel stop` stops the
# container.
# One lararium per HUMAN: nothing here names a face.
#
# LARES_STATE and LARES_WORKSPACE come from the environment or `lares-surface.env` beside the compose file
# (KEY=VALUE lines, as compose reads them). Neither standing refuses by name.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
COMPOSE_FILE_PATH="${LARES_COMPOSE_FILE:-$ROOT/docker-compose.surface.yml}"
ENV_FILE="$(dirname -- "$COMPOSE_FILE_PATH")/lares-surface.env"
CLI="packages/lares-cli/bin/lares.mjs"

die() { printf 'lares-container: %s\n' "$*" >&2; exit 2; }

set_in_env_file() { # $1 = name; true when the env file carries a non-empty value for it
  [ -f "$ENV_FILE" ] && grep -Eq "^[[:space:]]*$1=[^[:space:]]" "$ENV_FILE"
}
for name in LARES_STATE LARES_WORKSPACE; do
  eval "val=\${$name:-}"
  if [ -z "$val" ] && ! set_in_env_file "$name"; then
    die "$name stands in neither the environment nor $ENV_FILE — set it (the host directory mounted for the vessel)"
  fi
done

ENV_ARGS=""
if [ -f "$ENV_FILE" ]; then ENV_ARGS=yes; fi

compose() {
  if [ -n "$ENV_ARGS" ]; then
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" "$@"
  else
    docker compose -f "$COMPOSE_FILE_PATH" "$@"
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

lift_vessel() {
  reason=$(printf '%s\n' "$observe_output" | sed -n 's/.*"standing"[[:space:]]*:[[:space:]]*{[^}]*"reason"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
  printf 'lares-container: %s; restarting the vessel\n' "${reason:-the standing requires a re-stand}" >&2
  if ! compose restart lares; then printf '%s\n' 'lares-container: the vessel restart failed' >&2; return 1; fi
  if ! compose up -d --wait lares; then printf '%s\n' 'lares-container: the vessel did not answer healthy after its restart' >&2; return 1; fi
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
    # shellcheck disable=SC2046
    compose --profile offline run --rm $(tty_flag) offline "$@"
  fi
}

# Read the terminal NOW: inside `$(tty_flag)` stdout is the substitution's pipe, so a `[ -t 1 ]` there is always false
# and every founding would lose its TTY.
HAVE_TTY=""
if [ -t 0 ] && [ -t 1 ]; then HAVE_TTY=yes; fi
tty_flag() { if [ -z "$HAVE_TTY" ]; then printf -- '-T'; fi; }

[ "$#" -gt 0 ] || die "usage: lares-container.sh up|down|found|logs|vessel stand|<lares verb…>"
verb=$1; shift

case "$verb" in
  up)
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
        docker compose -f "$COMPOSE_FILE_PATH" -f "$override" up -d --wait lares
      fi
    else
      compose up -d --wait lares
    fi ;;
  down)  compose down --remove-orphans "$@" ;;
  logs)  compose logs "$@" lares ;;
  found)
    # shellcheck disable=SC2046
    compose --profile offline run --rm $(tty_flag) offline vessel found --skip-build --root /state --genesis /app/genesis "$@" ;;
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
          if ! running_vessel; then compose up -d --wait lares
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
