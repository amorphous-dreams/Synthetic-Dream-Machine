#!/bin/sh
# browser-ci — the HOST driver for docker-compose.browser-ci.yml (a node plus a disposable Playwright runner).
#
#   browser-ci.sh up                        build, found a hearth through the test door (`vessel found --hearth`: the place,
#                                           its seed charter, one synthetic face), stand the node, open its key through the
#                                           test door, name the face (`persona new 0`) and WEAR it (`persona wear 0`),
#                                           restart so the vessel stands as a Lararium, wait healthy, open its key again.
#                                           Refuses by name when the port already answers or the project already stands.
#   browser-ci.sh restart                   restart the node container WITHOUT removing its volumes; wait healthy; open its key
#   browser-ci.sh join offer                `lares fleet join offer` inside the node (it rides the store door, so it runs
#                                           against the standing hearth); prints the offer JSON alone
#   browser-ci.sh join answer <request>     pipe a host-side request file into the node and `lares fleet join answer` it;
#                                           prints the answer JSON alone. BROWSER_CI_SYNC_URL, when set, rides as --sync-url
#   browser-ci.sh bag <name>                stand a writable scratch bag (`lares act CREATE --bag … --yes`); prints its URI.
#                                           A bare name becomes lar:///ha.ka.ba/bags/<name>; a lar: URI passes through
#   browser-ci.sh ingest <path>             copy a repo carrier (bags/<bag>/<w.w.w>/…) into the scratch workspace volume and
#                                           `lares ingest --source … --to <bag uri> --apply --yes`
#                                           (default bag lar:///ha.ka.ba/bags/lares; BROWSER_CI_BAG overrides)
#   browser-ci.sh recipe add <bag-uri>      ensure the catalog recipe exists, then add the bag to the wiki the browser mounts
#   browser-ci.sh recipe remove <bag-uri>   `wiki remove-bag` — the swarm's negative control
#   browser-ci.sh get <meme-uri> [--bag <slug> | --recipe <slug>]
#                                           `lares meme get`, JSON on stdout (the text rides in data.text). Default reads
#                                           AS the mounted wiki (`--recipe <slug>`)
#   browser-ci.sh info                      one JSON object for the host QA driver: origin (qa and host views), relay URL,
#                                           gate public key (the node's `[lararium] gate key:` boot line), the worn face
#                                           (`worn`), the wiki slug, the wiki document the mount resolves (`wikiDoc`) and
#                                           every document registered under the slug, the recipe URI and its bag stack in
#                                           order, and the registered bag URIs
#   browser-ci.sh qa <cmd…>                 run <cmd> in the disposable Chromium runner (repo at /repo; the runner shares the node's network, node at http://localhost:4321);
#                                           LARES_URL, BROWSER_CI_* and LIVE_WIKI_* from the caller's env ride through
#   browser-ci.sh qa-join <cmd…>            `qa`, plus the JOIN EXCHANGE below: the host carries the node's half of each
#                                           browser profile's fleet join
#   browser-ci.sh down                      remove containers, network AND the scratch volumes
#
# JOIN EXCHANGE (`qa-join`). Each fresh browser profile joins the node's face through the fleet-join door: three files
# by courier, offer -> request -> answer. The page mints the request, and the runner holds no Docker, so the host
# carries the node's two acts over a small host directory bind-mounted at /exchange. One join runs two legs under one
# id the runner picks (1-64 lowercase letters, digits or dashes):
#   runner -> host   one stdout line   JOIN-OFFER <id>
#   host -> runner   the file /exchange/<id>.offer holding the offer JSON, written whole (tmp + mv)
#   runner           pastes the offer into the page, reads back the request the page minted, and writes it whole to
#                    /exchange/<id>.request
#   runner -> host   one stdout line   JOIN-REQUEST <id>
#   host -> runner   the file /exchange/<id>.answer holding the answer JSON, written whole (tmp + mv)
# Either leg answers /exchange/<id>.refused instead, holding the refusal text, when the id reads malformed, the request
# file stands absent, or the node refuses. The runner then pastes the answer, and the page lands it and re-enters boot.
# One run may hold any number of joins, one id each; the host answers each line as it reads it. The runner WAITS by
# polling for the answering file (a timeout only bounds the wait). The runner sees BROWSER_CI_EXCHANGE=/exchange, and
# tools/browser-ci-join.mjs (`joinThroughPage(page)`) speaks the runner side. Every other stdout line passes through
# untouched, and the host exits with the runner's status.
#
# PARALLEL SAFETY. Every verb honors the pair
#   BROWSER_CI_PROJECT  compose project name (default lares-browser-ci); containers, network and volumes derive from it
#   BROWSER_CI_PORT     loopback port the node publishes (default 5401; the browser swarm's range is 5400-5499)
#   BROWSER_CI_IMAGE    the node image tag (default lares-browser-ci:local); builders in separate worktrees each name their own
# Two surfaces with distinct values share no container, network, volume or image tag. Give each builder its own.
# BROWSER_CI_WIKI overrides the wiki slug that `recipe` and `get` address (default: the node's one live wiki).
#
# EVERY BOOT RESTS AT THE FLOOR holding no vessel key, and every sovereign verb waits there. This surface stages
# its own scratch vessel, so after each start the driver opens the key through the test door
# (tools/unlock-staged-container.sh; the door refuses any root without the scratch marker the seed wrote).
#
# The host script alone touches Docker. No container receives the Docker socket; the qa runner cannot answer a
# fleet join. Every face name stays synthetic.
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
# Open the standing node's key through the test door; a door that answers anything but an open key stops the driver.
unlock() {
  if ! out=$("$HERE/unlock-staged-container.sh" "$(compose ps -q lares)" 2>&1); then
    printf '%s\n' "$out" >&2; die "the staged node did not open its vessel key through the test door"
  fi
}

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

walk_document_preflight() {
  slug=$(wiki_slug)
  wikis=$(lares wiki list --json) || die "WIKI_DOC_MISSING: cannot read the registered document for $slug; run wiki init for that wiki before starting the walk"
  INFO_SLUG=$slug INFO_WIKIS=$wikis node -e '
    const e = process.env;
    const wikis = JSON.parse(e.INFO_WIKIS).data?.wikis ?? [];
    const mine = wikis.filter((wiki) => wiki.slug === e.INFO_SLUG);
    const mounted = mine.find((wiki) => wiki.kind === "system") ?? mine.find((wiki) => wiki.kind === "user");
    if (!mounted || typeof mounted.automergeUrl !== "string" || !/^automerge:.+$/.test(mounted.automergeUrl)) {
      process.stderr.write(`WIKI_DOC_MISSING: wikiDoc is absent or invalid for ${e.INFO_SLUG}; run wiki init for that wiki before starting the walk.\n`);
      process.exit(2);
    }
  '
}

# Answer one join leg with a refusal, written whole: refuse_join <id> <text>. The exchange directory rides $xdir.
refuse_join() {
  printf '%s\n' "$2" >"$xdir/$1.tmp"; mv "$xdir/$1.tmp" "$xdir/$1.refused"
}

bag_uri() {
  case "$1" in
    lar:*) printf '%s\n' "$1" ;;
    ""|*[!a-z0-9-]*|-*) die "a bag name is lowercase letters, digits and dashes" ;;
    *) printf '%s%s\n' "$BAG_PREFIX" "$1" ;;
  esac
}

[ "$#" -gt 0 ] || die "usage: browser-ci.sh up|restart|join|bag|ingest|recipe|get|info|qa|qa-join|down"
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
    unlock
    lares persona new 0 --name "$FACE"
    # The face stands WORN: `persona wear` records the worn index and the restart below puts the vessel on it.
    lares persona wear 0
    compose restart lares
    compose up -d --wait lares
    unlock ;;
  restart)
    compose restart lares
    compose up -d --wait lares
    unlock ;;
  join)
    [ "$#" -ge 1 ] || die "join wants offer, or answer and one request file"
    case "$1" in
      offer)
        [ "$#" -eq 1 ] || die "join offer takes no argument"
        out=$(lares fleet join offer) || { printf '%s\n' "$out" >&2; exit 4; }
        # The CLI prints the offer JSON, then one hint line; the JSON alone crosses.
        json=$(printf '%s\n' "$out" | sed -n '/^{/,/^}/p')
        [ -n "$json" ] || { printf '%s\n' "$out" >&2; die "fleet join offer printed no offer"; }
        printf '%s\n' "$json" ;;
      answer)
        [ "$#" -eq 2 ] || die "join answer wants one request file"
        [ -f "$2" ] || die "no request file at $2"
        req=$2
        set --
        [ -z "${BROWSER_CI_SYNC_URL:-}" ] || set -- --sync-url "$BROWSER_CI_SYNC_URL"
        # The request rides stdin into a file inside the node (its own /tmp), and the answer reads it there.
        # shellcheck disable=SC2016
        out=$(compose exec -T lares sh -c 'f=$(mktemp) && cat >"$f" && node "$0" fleet join answer "$f" "$@"; rc=$?; rm -f "$f"; exit "$rc"' "$CLI" "$@" <"$req") \
          || { printf '%s\n' "$out" >&2; exit 4; }
        json=$(printf '%s\n' "$out" | sed -n '/^{/,/^}/p')
        [ -n "$json" ] || { printf '%s\n' "$out" >&2; die "fleet join answer printed no answer"; }
        printf '%s\n' "$json" ;;
      *) die "join wants offer, or answer and one request file" ;;
    esac ;;
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
        # The catalog recipe exists before composition changes are applied.
        json_verb wiki init "$slug" --json >/dev/null
        # WHERE THIS LANDS: `wiki add-bag` writes the NODE's own composition (its catalog recipe), which shadows a
        # system wiki's default (oracle) recipe for the node's mount, its live watch and `get --recipe` alike. A
        # catalog never crosses, so an admitted leaf still mounts the default recipe.
        wikis=$(lares wiki list --json)
        if printf '%s' "$wikis" | node -e '
          let input = "";
          process.stdin.setEncoding("utf8");
          process.stdin.on("data", (chunk) => input += chunk);
          process.stdin.on("end", () => {
            const reply = JSON.parse(input);
            const wikis = reply.data?.wikis;
            process.exit(Array.isArray(wikis) && wikis.some((wiki) => wiki.slug === process.argv[1] && wiki.kind === "system") ? 0 : 1);
          });' "$slug"; then
          printf '%s\n' "browser-ci: note: $slug is a [system] wiki; this verb writes the node's own recipe (its catalog), which the node's mount and \`get --recipe\` read, and which no leaf receives. An admitted leaf mounts the default recipe (oracle lararium lares): ingest into a bag that recipe stacks (the default lar:///ha.ka.ba/bags/lares) to reach a leaf (see info: recipe.leafReadsDefaultRecipe)" >&2
        fi
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
    # The gate key: the hearth's own `[lararium] gate key:` boot line (its vessel key, which the gate arms with). A
    # crossroads prints a `[herm]   gate key:` line too; the read names the hearth's line alone, and the last boot.
    gate=$(compose logs --no-color lares 2>/dev/null | sed -n 's/^.*\[lararium\] gate key: \([0-9a-f]\{64\}\)[[:space:]]*$/\1/p' | tail -n 1)
    [ -n "$gate" ] || die "the node's log names no [lararium] gate key; run up first"
    bags=$(lares bag stats | sed -n 's/^  \(lar:[^ ]*\).*$/\1/p')
    # Every document the catalog and oracle plane register is data in the JSON wiki list.
    wikis=$(lares wiki list --json)
    # The recipe's bag stack, in order. No read-only verb names it; `wiki pin` walks it (and re-asserts the stowage of
    # those same bags, which a mounted wiki wants held anyway). A wiki without a catalog recipe yet answers no stack.
    stack=$(lares wiki pin "$slug" 2>/dev/null | sed -n 's/^  \(lar:[^ ]*\).*$/\1/p' || true)
    INFO_ORIGIN_QA=$origin INFO_PORT=$PORT INFO_SLUG=$slug INFO_FACES=$faces INFO_GATE=$gate INFO_BAGS=$bags \
    INFO_KEY=$key INFO_WIKIS=$wikis INFO_STACK=$stack \
    node -e '
      const e = process.env;
      const faces = JSON.parse(e.INFO_FACES).data.personas;
      const face = faces.find((p) => p.active) || faces[0] || null;
      const host = "http://127.0.0.1:" + e.INFO_PORT;
      const ws = (o) => o.replace(/^http/, "ws") + "/ws";
      const reply = JSON.parse(e.INFO_WIKIS);
      const docs = (reply.data?.wikis ?? []).filter((wiki) =>
        typeof wiki.slug === "string" && typeof wiki.uri === "string" && typeof wiki.kind === "string" &&
        typeof wiki.automergeUrl === "string" && /^automerge:.+$/.test(wiki.automergeUrl)).map((wiki) => ({
          slug: wiki.slug, kind: wiki.kind, bag: wiki.uri, doc: wiki.automergeUrl,
        }));
      const mine = docs.filter((d) => d.slug === e.INFO_SLUG);
      // A system wiki (lares, lararium) registers its canon document on the ORACLE plane.
      const mounted = mine.find((d) => d.kind === "system") ?? mine.find((d) => d.kind === "user") ?? null;
      if (!mounted) {
        process.stderr.write(`WIKI_DOC_MISSING: wikiDoc is absent for ${e.INFO_SLUG}; run wiki init for that wiki before starting the walk.\n`);
        process.exit(2);
      }
      const stack = e.INFO_STACK.split("\n").filter((l) => l.startsWith("lar:"));
      process.stdout.write(JSON.stringify({
        origin: { qa: e.INFO_ORIGIN_QA, host },
        relay: { qa: ws(e.INFO_ORIGIN_QA), host: ws(host) },
        gateKey: e.INFO_GATE,
        face: face && { name: face.petname, handleIndex: face.handleIndex, worn: face.active === true, verifyingKey: e.INFO_KEY },
        worn: face ? face.active === true : false,
        wiki: e.INFO_SLUG,
        wikiDoc: { url: mounted.doc, kind: mounted.kind, bag: mounted.bag },
        wikiDocsRegistered: mine.map((d) => ({ url: d.doc, kind: d.kind })),
        recipe: {
          uri: "lar:///ha.ka.ba/bags/catalog/recipes/" + e.INFO_SLUG,
          bagStack: stack.length ? stack : null,
          // One reader walks the planes catalog first, oracle second, on the node. A catalog never crosses, so
          // a leaf mounting a system wiki reads the default (oracle) recipe whatever the node composed.
          leafReadsDefaultRecipe: mine.some((d) => d.kind === "system"),
        },
        bags: e.INFO_BAGS.split("\n").filter((l) => l.startsWith("lar:")),
      }) + "\n");' ;;
  qa|qa-join)
    [ "$#" -gt 0 ] || die "$verb wants a command"
    for arg do
      case "$arg" in
        */live-wiki.mjs|live-wiki.mjs) walk_document_preflight; break ;;
      esac
    done
    # Pass-through: the caller's LARES_URL, BROWSER_CI_* and LIVE_WIKI_* variables reach the runner by name.
    envargs=""
    for name in $(env | sed -n 's/^\(LARES_URL\|BROWSER_CI_[A-Za-z0-9_]*\|LIVE_WIKI_[A-Za-z0-9_]*\)=.*/\1/p'); do
      envargs="$envargs -e $name"
    done
    # The exchange directory: host-made, world-writable (the runner's user differs), removed on every exit.
    xdir=$(mktemp -d "${TMPDIR:-/tmp}/browser-ci-exchange.XXXXXX")
    chmod 1777 "$xdir"
    fifo="$xdir.out"
    mkfifo "$fifo"
    child=""
    trap '[ -z "$child" ] || kill "$child" 2>/dev/null || true; rm -rf "$xdir" "$fifo"' EXIT
    trap 'exit 130' INT TERM
    export BROWSER_CI_EXCHANGE_DIR="$xdir"
    # shellcheck disable=SC2086
    compose --profile qa run --rm -T $envargs -e BROWSER_CI_EXCHANGE=/exchange qa "$@" >"$fifo" &
    child=$!
    while IFS= read -r line; do
      printf '%s\n' "$line"
      [ "$verb" = "qa-join" ] || continue
      case "$line" in
        "JOIN-OFFER "*|"JOIN-REQUEST "*)
          leg=${line%% *}
          id=${line#* }
          safe=$(printf '%s' "$id" | tr -c 'a-z0-9-' '_' | cut -c1-64)
          case "$id" in
            ""|*[!a-z0-9-]*) refuse_join "$safe" 'the join id must be 1-64 lowercase letters, digits or dashes'; continue ;;
          esac
          [ "${#id}" -le 64 ] || { refuse_join "$safe" 'the join id must be 1-64 lowercase letters, digits or dashes'; continue; }
          if [ "$leg" = "JOIN-OFFER" ]; then
            if out=$("$0" join offer 2>"$xdir/$id.err"); then
              printf '%s\n' "$out" >"$xdir/$id.tmp"; mv "$xdir/$id.tmp" "$xdir/$id.offer"
            else
              refuse_join "$id" "$(cat "$xdir/$id.err"; printf '%s' "$out")"
            fi
          else
            [ -f "$xdir/$id.request" ] || { refuse_join "$id" "no request file stands at $id.request"; continue; }
            if out=$("$0" join answer "$xdir/$id.request" 2>"$xdir/$id.err"); then
              printf '%s\n' "$out" >"$xdir/$id.tmp"; mv "$xdir/$id.tmp" "$xdir/$id.answer"
            else
              refuse_join "$id" "$(cat "$xdir/$id.err"; printf '%s' "$out")"
            fi
          fi ;;
      esac
    done <"$fifo"
    status=0
    wait "$child" || status=$?
    child=""
    exit "$status" ;;
  down)
    compose --profile seed --profile qa down -v --remove-orphans "$@" ;;
  *) die "unknown verb $verb" ;;
esac
