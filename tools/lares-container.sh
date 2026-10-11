#!/bin/sh
# lares-container — the HOST shim for the surface vessel (docker-compose.surface.yml).
#
#   lares-container.sh up [--capture <dir>]...   stand the vessel (detached)
#   lares-container.sh down                      stop it and remove its container (state stays in LARES_STATE)
#   lares-container.sh found [vessel-found args] the offline founding act, under a TTY (it gathers the human route)
#   lares-container.sh logs [compose-logs args]  follow the vessel's log
#   lares-container.sh <anything else>           run the lares CLI INSIDE the standing container
#
# The CLI runs by `compose exec`, never `run`: it shares the daemon's /tmp (the UDS rendezvous), uid and
# environment. `found` is the one `run`, because founding is an offline act on a stopped store. The engine gets no
# docker socket; engine control stays with the host. One lararium per HUMAN: nothing here names a face.
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

tty_flag() { if [ -t 0 ] && [ -t 1 ]; then :; else printf -- '-T'; fi; }

[ "$#" -gt 0 ] || die "usage: lares-container.sh up|down|found|logs|<lares verb…>"
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
          n=$((n + 1))
          files="$files
      - type: bind
        source: \"$dir\"
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
        docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE_PATH" -f "$override" up -d lares
      else
        docker compose -f "$COMPOSE_FILE_PATH" -f "$override" up -d lares
      fi
    else
      compose up -d lares
    fi ;;
  down)  compose down --remove-orphans "$@" ;;
  logs)  compose logs "$@" lares ;;
  found)
    # shellcheck disable=SC2046
    if [ "$#" -eq 0 ]; then
      compose --profile found run --rm $(tty_flag) found
    else
      compose --profile found run --rm $(tty_flag) found vessel found --skip-build --root /state --genesis /app/genesis "$@"
    fi ;;
  *)
    # shellcheck disable=SC2046
    compose exec $(tty_flag) lares node "$CLI" "$verb" "$@" ;;
esac
