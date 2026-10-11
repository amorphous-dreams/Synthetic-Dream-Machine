#!/bin/sh
# browser-ci — the HOST driver for docker-compose.browser-ci.yml (a node plus a disposable Playwright runner).
#
#   browser-ci.sh up                        build, seed through the test door, stand the node, light one synthetic face
#                                           (`persona new 0`), restart so the vessel stands as a Lararium, wait healthy.
#                                           Refuses by name when the port already answers or the project already stands.
#   browser-ci.sh restart                   restart the node container WITHOUT removing its volumes; wait healthy
#   browser-ci.sh admit [--fragment] <key>  `lares device-admit --joinee-key …` inside the node; prints the carriage
#                                           payload. --fragment prints ONLY the `#admit=…` line, for a script to hand the page
#   browser-ci.sh bag <name>                stand a writable scratch bag (`lares act CREATE --bag … --yes`); prints its URI.
#                                           A bare name becomes lar:///ha.ka.ba/bags/<name>; a lar: URI passes through
#   browser-ci.sh ingest <path>             copy a repo carrier (bags/<bag>/<w.w.w>/…) into the scratch workspace volume and
#                                           `lares ingest --source … --to <bag uri> --apply --yes`
#                                           (default bag lar:///ha.ka.ba/bags/lares; BROWSER_CI_BAG overrides)
#   browser-ci.sh recipe add <bag-uri>      add the bag to the recipe of the wiki the browser mounts (`wiki init` first,
#                                           which is idempotent, then `wiki add-bag`)
#   browser-ci.sh recipe remove <bag-uri>   `wiki remove-bag` — the swarm's negative control
#   browser-ci.sh get <meme-uri> [--bag <slug> | --recipe <slug>]
#                                           `lares meme get`, JSON on stdout (the text rides in data.text). Default reads
#                                           AS the mounted wiki (`--recipe <slug>`)
#   browser-ci.sh info                      one JSON object for the host QA driver: origin (qa and host views), relay URL,
#                                           gate public key, the worn face, the wiki slug and the registered bag URIs
#   browser-ci.sh qa <cmd…>                 run <cmd> in the disposable Chromium runner (repo at /repo; the runner shares the node's network, node at http://localhost:4321);
#                                           LARES_URL, BROWSER_CI_* and LIVE_WIKI_* from the caller's env ride through
#   browser-ci.sh down                      remove containers, network AND the scratch volumes
#
# PARALLEL SAFETY. Every verb honors the pair
#   BROWSER_CI_PROJECT  compose project name (default lares-browser-ci); containers, network and volumes derive from it
#   BROWSER_CI_PORT     loopback port the node publishes (default 5401; the browser swarm's range is 5400-5499)
#   BROWSER_CI_IMAGE    the node image tag (default lares-browser-ci:local); builders in separate worktrees each name their own
# Two surfaces with distinct values share no container, network, volume or image tag. Give each builder its own.
# BROWSER_CI_WIKI overrides the wiki slug that `recipe` and `get` address (default: the node's one live wiki).
#
# The host script alone touches Docker. No container receives the Docker socket; the qa runner cannot issue an
# admit. Face names are synthetic.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
FILE="${BROWSER_CI_COMPOSE_FILE:-$ROOT/docker-compose.browser-ci.yml}"
FACE="${BROWSER_CI_FACE:-ci-face}"
PROJECT="${BROWSER_CI_PROJECT:-lares-browser-ci}"
PORT="${BROWSER_CI_PORT:-5401}"
CLI="packages/lares-cli/bin/lares.mjs"
BAG_PREFIX="lar:///ha.ka.ba/bags/"
export BROWSER_CI_PORT="$PORT"

die() { printf 'browser-ci: %s\n' "$*" >&2; exit 2; }
compose() { docker compose -p "$PROJECT" -f "$FILE" "$@"; }
lares() { compose exec -T lares node "$CLI" "$@"; }

case "$PORT" in
  54[0-9][0-9]) ;;
  *) die "BROWSER_CI_PORT $PORT lies outside 5400-5499" ;;
esac

# A verb answer that names failure (anything but `"ok":true`) stops the driver with that answer on stderr.
ok_or_die() {
  case "$1" in *'"ok":true'*) ;; *) printf '%s\n' "$1" >&2; exit 4 ;; esac
}
# Run a CLI verb whose answer is JSON: print the answer, fail with it on stderr when the verb refuses.
json_verb() {
  if out=$(lares "$@" 2>&1); then ok_or_die "$out"; printf '%s\n' "$out"
  else printf '%s\n' "$out" >&2; exit 4; fi
}

# The wiki slug the browser mounts: BROWSER_CI_WIKI, else the node's one live wiki (`lares wiki active` lists the
# slugs it runs; a freshly founded vessel runs exactly one).
wiki_slug() {
  if [ -n "${BROWSER_CI_WIKI:-}" ]; then printf '%s\n' "$BROWSER_CI_WIKI"; return; fi
  slug=$(lares wiki active | awk '/^active wikis/ {on=1; next} /rotatable pin budget/ {on=0} on && NF {print $NF; exit}')
  [ -n "$slug" ] || die "the node runs no wiki; run up first"
  printf '%s\n' "$slug"
}

bag_uri() {
  case "$1" in
    lar:*) printf '%s\n' "$1" ;;
    ""|*[!a-z0-9-]*|-*) die "a bag name is lowercase letters, digits and dashes" ;;
    *) printf '%s%s\n' "$BAG_PREFIX" "$1" ;;
  esac
}

[ "$#" -gt 0 ] || die "usage: browser-ci.sh up|restart|admit|bag|ingest|recipe|get|info|qa|down"
verb=$1; shift

case "$verb" in
  up)
    if curl -s -m 2 -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null; then
      die "port $PORT already answers; pick another BROWSER_CI_PORT"
    fi
    if [ -n "$(compose ps -a -q 2>/dev/null)" ]; then
      die "project $PROJECT already stands; run down, or pick another BROWSER_CI_PROJECT"
    fi
    compose build lares
    compose --profile seed run --rm seed
    compose up -d lares
    compose up -d --wait lares
    lares persona new 0 --name "$FACE"
    compose restart lares
    compose up -d --wait lares ;;
  restart)
    compose restart lares
    compose up -d --wait lares ;;
  admit)
    frag=0
    if [ "${1:-}" = "--fragment" ]; then frag=1; shift; fi
    [ "$#" -eq 1 ] || die "admit wants one joinee key (and optionally --fragment first)"
    if [ "$frag" -eq 1 ]; then
      out=$(lares device-admit --joinee-key "$1")
      line=$(printf '%s\n' "$out" | sed -n 's/^ *\(#admit=.*\)$/\1/p' | head -n 1)
      [ -n "$line" ] || { printf '%s\n' "$out" >&2; die "device-admit answered no #admit= line"; }
      printf '%s\n' "$line"
    else
      lares device-admit --joinee-key "$1"
    fi ;;
  bag)
    [ "$#" -eq 1 ] || die "bag wants one name"
    uri=$(bag_uri "$1")
    out=$(lares act CREATE --bag "$uri" --yes)
    ok_or_die "$out"
    printf '%s\n' "$out" >&2
    printf '%s\n' "$uri" ;;
  ingest)
    [ "$#" -eq 1 ] || die "ingest wants one path inside the repo"
    case "$1" in /*|*..*) die "ingest path stays relative to the repo, without .." ;; esac
    [ -f "$ROOT/$1" ] || die "no carrier at $1"
    # The target bag is one the vessel holds admin on; carrier URIs derive from the path, not from this bag.
    BAG=${BROWSER_CI_BAG:-lar:///ha.ka.ba/bags/lares}
    cid=$(compose ps -q lares)
    [ -n "$cid" ] || die "the node does not stand; run up first"
    # `docker cp` into the named workspace volume's mount: the node reads /workspace/<path>.
    docker exec "$cid" mkdir -p "/workspace/$(dirname -- "$1")"
    docker cp "$ROOT/$1" "$cid:/workspace/$1"
    lares ingest --source "/workspace/$1" --to "$BAG" --apply --yes ;;
  recipe)
    [ "$#" -eq 2 ] || die "recipe wants add|remove and one bag URI"
    act=$1; uri=$(bag_uri "$2")
    slug=$(wiki_slug)
    case "$act" in
      add)
        # A freshly founded vessel lists its wiki before it holds a recipe; `wiki init` mints one and is idempotent.
        json_verb wiki init "$slug" --json >/dev/null
        json_verb wiki add-bag "$slug" "$uri" --json ;;
      # remove-bag answers in prose; its exit status carries the verdict.
      remove) lares wiki remove-bag "$slug" "$uri" ;;
      *) die "recipe wants add|remove" ;;
    esac ;;
  get)
    [ "$#" -ge 1 ] || die "get wants a meme URI"
    uri=$1; shift
    if [ "$#" -eq 0 ]; then set -- --recipe "$(wiki_slug)"; fi
    case "$1" in
      --bag|--recipe) [ "$#" -eq 2 ] || die "get takes one --bag or --recipe slug" ;;
      *) die "get takes --bag <slug> or --recipe <slug>" ;;
    esac
    json_verb meme get "$uri" "$@" ;;
  info)
    slug=$(wiki_slug)
    # The runner shares the node's network namespace, so its origin names the node by localhost.
    origin="http://localhost:$(compose exec -T lares printenv LAR_PORT)"
    faces=$(lares persona list --json)
    ok_or_die "$faces"
    # `persona new 0` is idempotent on a lit face and answers its verifying key.
    key=$(lares persona new 0 --name "$FACE" 2>/dev/null | sed -n 's/.*"verifyingKey":"\([0-9a-f]*\)".*/\1/p' | tail -n 1)
    [ -n "$key" ] || die "no face stands; run up first"
    admit=$(lares device-admit --joinee-key "$key" | awk '/^}/ {print; exit} {print}')
    bags=$(lares bag stats | sed -n 's/^  \(lar:[^ ]*\).*$/\1/p')
    INFO_ORIGIN_QA=$origin INFO_PORT=$PORT INFO_SLUG=$slug INFO_FACES=$faces INFO_ADMIT=$admit INFO_BAGS=$bags INFO_KEY=$key \
    node -e '
      const e = process.env;
      const faces = JSON.parse(e.INFO_FACES).data.personas;
      const face = faces.find((p) => p.active) || faces[0] || null;
      const admit = JSON.parse(e.INFO_ADMIT);
      const host = "http://127.0.0.1:" + e.INFO_PORT;
      const ws = (o) => o.replace(/^http/, "ws") + "/ws";
      process.stdout.write(JSON.stringify({
        origin: { qa: e.INFO_ORIGIN_QA, host },
        relay: { qa: ws(e.INFO_ORIGIN_QA), host: ws(host) },
        gateKey: admit.hearthGatePubKey,
        face: face && { name: face.petname, handleIndex: face.handleIndex, worn: face.active === true, verifyingKey: e.INFO_KEY },
        wiki: e.INFO_SLUG,
        bags: e.INFO_BAGS.split("\n").filter((l) => l.startsWith("lar:")),
      }) + "\n");' ;;
  qa)
    [ "$#" -gt 0 ] || die "qa wants a command"
    # Pass-through: the caller's LARES_URL, BROWSER_CI_* and LIVE_WIKI_* variables reach the runner by name.
    envargs=""
    for name in $(env | sed -n 's/^\(LARES_URL\|BROWSER_CI_[A-Za-z0-9_]*\|LIVE_WIKI_[A-Za-z0-9_]*\)=.*/\1/p'); do
      envargs="$envargs -e $name"
    done
    # shellcheck disable=SC2086
    compose --profile qa run --rm -T $envargs qa "$@" ;;
  down)
    compose --profile seed --profile qa down -v --remove-orphans "$@" ;;
  *) die "unknown verb $verb" ;;
esac
