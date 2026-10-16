#!/bin/sh
# household-https-witness — the household certificate slot, proven end to end with NO real credential, domain or
# DNS zone: a TEST certificate authority issues the wildcard through the compose file's own `issuer` service, the
# `terminator` serves it in front of a standing vessel, and the vessel's container never meets the credential.
#
#   REFUSALS    the issuer refuses by name: no credential directory, a directory inside the state mount (trailing
#               slashes and dotted paths included), a file or directory wider than its owner, terms not accepted,
#               and a resolver inside the house (a private address or a name under the zone) or one with no port.
#   ISSUANCE    Pebble (the Let's Encrypt test authority) validates a DNS-01 challenge for `*.<zone>`; lego's
#               lookups ride the slot's own LARES_ISSUER_RESOLVERS, here the challenge test server, and its
#               `exec` DNS provider stands in for the DNS host's API and writes the TXT record to Pebble's
#               challenge test server. The certificate names the wildcard alone and chains to Pebble's root.
#   PER MACHINE a second run under another certificate name issues a second certificate with its own key.
#   THE EDGE    the terminator serves the issued certificate for the household name, refuses another name's
#               handshake, proxies `https` to the vessel, and passes a socket upgrade carrying the sealed gate's
#               first flight (HTTP 101) on the knock the vessel's sovereign sync gate stands, the path the vessel
#               itself states (`[lar-gate] the sync gate for Nexus … stands on <path>`). The vessel founds a hearth
#               and the witness opens its key through the test door: a hearth rests at its floor, standing no sync
#               gate, until a person unlocks it. A `Sec-WebSocket-Protocol` header of 8192 bytes passes the
#               terminator and reaches the gate, which refuses it by name on its own console (`flight-overlong`)
#               and destroys it before any 101 (502), never nginx's 400. CONTROLS: a knock no gate stood (a random
#               path) and the stood knock with no flight each draw 502; a header line longer than the terminator's
#               buffer draws nginx's own 400.
#   THE WALL    the fake credential appears nowhere in the vessel's environment, mounts, `/state` or `/workspace`,
#               nor in the terminator's. CONTROL: the same search finds it inside the issuer.
#
# WHAT STAYS UNWALKED, NAMED. The stand-in replaces the DNS host's API, so the registrar's own provider code (its
# read of the two files, its API calls) rests on lego's documentation and source; a live issuance against the
# public authority and a renewal stay by-hand acts. The witness reaches no real domain, zone or authority: it sets
# the ACME server to the test authority before any issuer runs.
#
# Sources (read 2026-10-12):
#   Pebble and its challenge test server, images, ports 14000 (ACME directory `/dir`), 15000 (management,
#     `/roots/0`), test root `test/certs/pebble.minica.pem`:  https://github.com/letsencrypt/pebble
#   challenge test server management API, `POST :8055/set-txt {"host","value"}`, `clear-txt`, DNS on :8053:
#     https://github.com/letsencrypt/pebble/blob/main/cmd/pebble-challtestsrv/README.md
#   lego `exec` provider, `EXEC_PATH`, the program runs as `<program> present|cleanup <fqdn> <record>`:
#     https://go-acme.github.io/lego/dns/exec/
#
# The vessel founds through the TEST door on a `mktemp` state directory (tools/test-scratch-marker.mjs, then
# tools/seed-test-custody.mjs, mounted read-only into a one-shot container of the image). The witness removes only
# the containers, network and volumes of its own compose project and the directories it made.
#
#   HOUSEHOLD_PROJECT   compose project name (default lares-household-https)
#   HOUSEHOLD_TLS_PORT  loopback port the terminator publishes (default 5471; 5400-5499)
#   HOUSEHOLD_PORT      loopback port the vessel publishes (default 5470; 5400-5499)
#   HOUSEHOLD_IMAGE     the product image (default lares-surface:local; built when the tag stands absent)
#   HOUSEHOLD_TOOLS     the staging tools the test door mounts (default this checkout's tools/)
#   HOUSEHOLD_PEBBLE_IMAGE / HOUSEHOLD_CHALLTESTSRV_IMAGE   the test authority (defaults pinned below)
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
PROJECT=${HOUSEHOLD_PROJECT:-lares-household-https}
TLS_PORT=${HOUSEHOLD_TLS_PORT:-5471}
PORT=${HOUSEHOLD_PORT:-5470}
IMAGE=${HOUSEHOLD_IMAGE:-lares-surface:local}
TOOLS=${HOUSEHOLD_TOOLS:-$ROOT/tools}
PEBBLE_IMAGE=${HOUSEHOLD_PEBBLE_IMAGE:-ghcr.io/letsencrypt/pebble:2.10.1}
CHALLTESTSRV_IMAGE=${HOUSEHOLD_CHALLTESTSRV_IMAGE:-ghcr.io/letsencrypt/pebble-challtestsrv:2.10.1}
FILE="$ROOT/docker-compose.surface.yml"
ZONE=home.example.test
NAME=hearth.$ZONE
FAILURES=0
SCRATCH=""

for p in "$PORT" "$TLS_PORT"; do
  case "$p" in 54[0-9][0-9]) ;; *) printf 'household-https-witness: port %s lies outside 5400-5499\n' "$p" >&2; exit 2 ;; esac
done
for tool in docker curl openssl; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'household-https-witness: %s stands absent on this host\n' "$tool" >&2; exit 2; }
done

LARES_UID=$(id -u); LARES_GID=$(id -g)
export COMPOSE_PROJECT_NAME="$PROJECT" LARES_PORT="$PORT" LARES_IMAGE="$IMAGE" LARES_UID LARES_GID

compose() { docker compose -f "$FILE" -f "$SCRATCH/witness.compose.yml" "$@"; }

drop_scratch() {
  if [ -n "$SCRATCH" ]; then
    compose --profile https --profile issuer --profile offline --profile witness down -v --remove-orphans >/dev/null 2>&1 || :
    rm -rf -- "$SCRATCH"
  fi
  SCRATCH=""
}
trap drop_scratch EXIT HUP INT TERM

result() {
  label=$1; shift
  if "$@"; then printf 'PASS %s\n' "$label"
  else printf 'FAIL %s\n' "$label"; FAILURES=$((FAILURES + 1)); fi
}
contains() { printf '%s' "$1" | grep -q -- "$2"; }
not_contains() { ! contains "$1" "$2"; }
# The scanners prove themselves on a known positive before any assertion trusts them.
contains 'household-issuer: LARES_TLS_ZONE stands unset' 'stands unset' || { printf 'household-https-witness: the contains scanner matches nothing\n' >&2; exit 2; }
not_contains 'HTTP/1.1 101 Switching Protocols' ' 400 ' || { printf 'household-https-witness: the not_contains scanner misreads\n' >&2; exit 2; }

# A project that already stands belongs to someone else. This check runs before the witness makes anything, so
# its teardown, armed only once the scratch directory exists, removes nothing the run did not create.
if [ -n "$(docker ps -a -q --filter "label=com.docker.compose.project=$PROJECT" 2>/dev/null)" ] \
   || [ -n "$(docker network ls -q --filter "label=com.docker.compose.project=$PROJECT" 2>/dev/null)" ]; then
  printf 'household-https-witness: project %s already stands; pick another HOUSEHOLD_PROJECT\n' "$PROJECT" >&2; exit 2
fi
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -f "$ROOT/Dockerfile" --target serve -t "$IMAGE" "$ROOT"
fi

SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/household-https.XXXXXX")
mkdir -p "$SCRATCH/state" "$SCRATCH/workspace" "$SCRATCH/tls" "$SCRATCH/witness" "$SCRATCH/credential"
chmod 700 "$SCRATCH/credential"
# Two FAKE credentials, minted for this run. They open nothing anywhere.
FAKE_KEY="fake-household-witness-key-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
FAKE_SECRET="fake-household-witness-secret-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
printf '%s\n' "$FAKE_KEY" > "$SCRATCH/credential/porkbun-api-key"
printf '%s\n' "$FAKE_SECRET" > "$SCRATCH/credential/porkbun-secret-api-key"
chmod 400 "$SCRATCH/credential/porkbun-api-key" "$SCRATCH/credential/porkbun-secret-api-key"

# The stand-in for the DNS host's API. lego runs it as `<program> present|cleanup <fqdn> <record>`; it posts the
# record to the challenge test server. It refuses unless the issuer hands it both credential files through the
# provider's own `_FILE` names, so a green issuance means the issuer process read them where the slot mounts them.
cat > "$SCRATCH/witness/dns-hook.sh" <<'HOOK'
#!/bin/sh
set -eu
[ -s "${PORKBUN_API_KEY_FILE:-/nonexistent}" ] && [ -s "${PORKBUN_SECRET_API_KEY_FILE:-/nonexistent}" ] || { echo "dns-hook: the credential files stand unreadable" >&2; exit 1; }
case "$1" in
  present) wget -qO- --post-data "{\"host\":\"$2\",\"value\":\"$3\"}" http://challtestsrv:8055/set-txt ;;
  cleanup) wget -qO- --post-data "{\"host\":\"$2\"}" http://challtestsrv:8055/clear-txt ;;
  *) echo "dns-hook: unknown act $1" >&2; exit 1 ;;
esac
HOOK
chmod 755 "$SCRATCH/witness/dns-hook.sh"

# The test authority joins the project beside the slot; the issuer gains the stand-in hook and the test root through
# its environment, and the test resolver through the slot's own LARES_ISSUER_RESOLVERS. Its command stays the
# compose file's own.
cat > "$SCRATCH/witness.compose.yml" <<YAML
services:
  challtestsrv:
    profiles: [witness]
    image: $CHALLTESTSRV_IMAGE
    command: ["-http01", "", "-https01", "", "-tlsalpn01", ""]
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
  pebble:
    profiles: [witness]
    image: $PEBBLE_IMAGE
    command: ["-config", "/test/config/pebble-config.json", "-dnsserver", "challtestsrv:8053"]
    environment:
      PEBBLE_VA_NOSLEEP: "1"
      PEBBLE_WFE_NONCEREJECT: "0"
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    depends_on: [challtestsrv]
  issuer:
    environment:
      EXEC_PATH: /witness/dns-hook.sh
      LEGO_CA_CERTIFICATES: /witness/pebble.minica.pem
      LEGO_DNS_PROPAGATION_WAIT: 1s
    volumes:
      - type: bind
        source: $SCRATCH/witness
        target: /witness
        read_only: true
YAML

export LARES_STATE="$SCRATCH/state" LARES_WORKSPACE="$SCRATCH/workspace"
export LARES_TLS_ZONE="$ZONE" LARES_TLS_NAME="$NAME"
export LARES_TLS_DIR="$SCRATCH/tls" LARES_TLS_BIND=127.0.0.1 LARES_TLS_PORT="$TLS_PORT"
export LARES_ISSUER_DNS=exec LARES_ACME_SERVER=https://pebble:14000/dir LARES_ISSUER_RESOLVERS=challtestsrv:8053
export LAR_PUBLIC_URL="https://$NAME"

issue() { compose --profile issuer run --rm -T issuer 2>&1; }

printf '── the issuer refuses by name\n'
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR= issue || :)
result 'no credential directory: the issuer refuses by name'      contains "$out" 'household-issuer: LARES_DNS_CREDENTIAL_DIR stands unset'
mkdir -p "$SCRATCH/state/credential"
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/state/credential" issue || :)
result 'a credential directory inside the state mount refuses'    contains "$out" 'household-issuer: LARES_DNS_CREDENTIAL_DIR lies inside LARES_STATE'
out=$(LARES_STATE="$SCRATCH/state/" LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/state/credential/" issue || :)
result 'trailing slashes hide no directory inside the state mount' contains "$out" 'household-issuer: LARES_DNS_CREDENTIAL_DIR lies inside LARES_STATE'
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/workspace/../state/credential" issue || :)
result 'a dotted path refuses before any comparison'              contains "$out" 'holds a dot segment or a doubled slash'
rmdir "$SCRATCH/state/credential"
out=$(LARES_ACME_ACCEPT_TOS= LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" issue || :)
result 'terms not accepted: the issuer refuses by name'           contains "$out" 'household-issuer: LARES_ACME_ACCEPT_TOS'
chmod 644 "$SCRATCH/credential/porkbun-secret-api-key"
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" issue || :)
result 'a credential file others can read refuses'                contains "$out" 'household-issuer: PORKBUN_SECRET_API_KEY_FILE'
result 'a refusal prints no credential'                           not_contains "$out" "$FAKE_SECRET"
chmod 600 "$SCRATCH/credential/porkbun-secret-api-key"
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" issue || :)
result 'a credential file its owner can write refuses (0400 alone)' contains "$out" 'household-issuer: PORKBUN_SECRET_API_KEY_FILE file mode (600)'
chmod 400 "$SCRATCH/credential/porkbun-secret-api-key"
chmod 755 "$SCRATCH/credential"
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" issue || :)
result 'a credential directory others can enter refuses'          contains "$out" 'household-issuer: LARES_DNS_CREDENTIAL_DIR mode (755)'
chmod 700 "$SCRATCH/credential"
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" LARES_ISSUER_RESOLVERS=192.168.0.53:53 issue || :)
result 'a private resolver refuses: the issuer never asks the house' contains "$out" 'household-issuer: LARES_ISSUER_RESOLVERS entry 192.168.0.53:53 names a resolver inside the house'
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" LARES_ISSUER_RESOLVERS=resolver.$ZONE:53 issue || :)
result 'a resolver named under the zone refuses'                  contains "$out" 'names a resolver inside the house'
for inside in resolver:1053 '[fd00::53]:53' 100.100.100.100:53 LOCALHOST:53 pihole.lan:53; do
  out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" LARES_ISSUER_RESOLVERS="$inside" issue || :)
  result "a resolver inside the house refuses: $inside"           contains "$out" 'names a resolver inside the house'
done
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" LARES_ISSUER_RESOLVERS=challtestsrv:8053, issue || :)
result 'a resolver list with an empty entry refuses'              contains "$out" 'holds an empty entry'
out=$(LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential" LARES_ISSUER_RESOLVERS=challtestsrv issue || :)
result 'a resolver with no port refuses'                          contains "$out" 'names no host:port'
result 'a refusing issuer wrote no certificate'                   test ! -e "$SCRATCH/tls/certificates"

export LARES_ACME_ACCEPT_TOS=yes LARES_DNS_CREDENTIAL_DIR="$SCRATCH/credential"

printf '── the test authority issues the wildcard through the issuer\n'
compose --profile witness up -d challtestsrv pebble >/dev/null 2>&1
# Pebble's own test root, which signs its ACME endpoint's certificate.
docker cp "$(compose --profile witness ps -q pebble)":/test/certs/pebble.minica.pem "$SCRATCH/witness/pebble.minica.pem"
tries=0
until compose --profile witness logs pebble 2>&1 | grep -q 'ACME directory available' || [ "$tries" -ge 30 ]; do sleep 1; tries=$((tries + 1)); done   # the bound only bounds the wait
out=$(issue) && rc=0 || rc=$?
[ "$rc" -eq 0 ] || printf '%s\n' "$out" | tail -20
result 'the issuer exits clean'                                   test "$rc" -eq 0
result 'the DNS-01 challenge solved through the stand-in API'     contains "$out" 'The server validated our request'
CERT="$SCRATCH/tls/certificates/household.crt"; KEY="$SCRATCH/tls/certificates/household.key"
result 'the certificate and key land where the terminator reads'  test -s "$CERT" -a -s "$KEY"
san=$(openssl x509 -in "$CERT" -noout -ext subjectAltName 2>/dev/null | tr -d ' \n' || :)
result 'the certificate names the wildcard and nothing else'      test "$san" = "X509v3SubjectAlternativeName:criticalDNS:*.$ZONE"
result 'the key rests readable by its owner alone'                test "$(stat -c %a "$KEY")" = 600
# The authority's root, fetched from its management port inside the project network.
compose --profile issuer run --rm -T --entrypoint /usr/bin/wget issuer \
  -qO- --no-check-certificate https://pebble:15000/roots/0 > "$SCRATCH/root.pem" 2>/dev/null || :
result 'the certificate chains to the test authority root'        openssl verify -CAfile "$SCRATCH/root.pem" -untrusted "$SCRATCH/tls/certificates/household.issuer.crt" "$CERT"

result 'the certificate directory holds no fake credential'       sh -c "! grep -rIq 'fake-household-witness' '$SCRATCH/tls'"
result 'the issuer log printed no fake credential'                not_contains "$out" 'fake-household-witness'

printf '── one certificate per machine\n'
out=$(LARES_TLS_CERT_NAME=second-machine issue) && rc=0 || rc=$?
result 'a second run under another name issues a second certificate' test "$rc" -eq 0 -a -s "$SCRATCH/tls/certificates/second-machine.crt"
result 'the second machine holds its own key'                     sh -c "! cmp -s '$KEY' '$SCRATCH/tls/certificates/second-machine.key'"

printf '── the wall: the search finds the fake credential inside the issuer\n'
seen=$(compose --profile issuer run --rm -T --entrypoint /bin/sh issuer -c 'cat "$PORKBUN_API_KEY_FILE" "$PORKBUN_SECRET_API_KEY_FILE"' 2>&1 || :)
result 'CONTROL: the issuer reads both fake credentials'          sh -c "printf '%s' '$seen' | grep -q '$FAKE_KEY' && printf '%s' '$seen' | grep -q '$FAKE_SECRET'"

printf '── the vessel stands behind the terminator\n'
docker run --rm --name "$PROJECT-seed" --user "$LARES_UID:$LARES_GID" \
  -v "$LARES_STATE:/state" -v "$TOOLS:/app/tools:ro" --tmpfs /tmp:mode=1777 \
  --entrypoint sh "$IMAGE" -ec \
  'node tools/test-scratch-marker.mjs /state && node tools/seed-test-custody.mjs /state' >/dev/null
compose --profile offline run --rm -T offline vessel found --hearth --name household-witness --skip-build --root /state --genesis /app/genesis >/dev/null
export LARES_TLS_CERT="$CERT" LARES_TLS_KEY="$KEY"
compose --profile https up -d lares terminator >/dev/null 2>&1
tries=0
until curl -fsS -m 3 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 || [ "$tries" -ge 120 ]; do sleep 1; tries=$((tries + 1)); done   # the bound only bounds the wait
tries=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(compose --profile https ps -q terminator)" 2>/dev/null)" = healthy ] || [ "$tries" -ge 60 ]; do sleep 1; tries=$((tries + 1)); done

reach() { host=$1; shift; curl -sS -m 10 --http1.1 --cacert "$SCRATCH/root.pem" --resolve "$host:$TLS_PORT:127.0.0.1" "$@"; }
knock() {   # $1 = the upgrade path, $2 = the Sec-WebSocket-Protocol value; prints the response head
  path=$1; proto=$2
  printf 'header = "Sec-WebSocket-Protocol: %s"\n' "$proto" > "$SCRATCH/knock.curl"
  curl -sS -m 5 --http1.1 -i -o - --cacert "$SCRATCH/root.pem" --resolve "$NAME:$TLS_PORT:127.0.0.1" \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    -K "$SCRATCH/knock.curl" "https://$NAME:$TLS_PORT$path" 2>/dev/null | head -c 600 || :
}
bytes() { head -c "$1" /dev/zero | tr '\0' a; }

health=$(reach "$NAME" -o /dev/null -w '%{http_code} %{ssl_verify_result}' "https://$NAME:$TLS_PORT/api/health" 2>/dev/null || :)
result 'https to the household name verifies and reads ready'     test "$health" = '200 0'
# curl exits 35 when the TLS handshake itself fails: the terminator rejected the name before any certificate.
reach "other.$ZONE.invalid" -k -o /dev/null "https://other.$ZONE.invalid:$TLS_PORT/api/health" 2>/dev/null && other=0 || other=$?
result 'CONTROL: another name meets a refused handshake'          test "$other" -eq 35
# THE KNOCK. Every socket opens through the sealed face gate (siege-resilience): a gate answers an upgrade only on
# the path its own bundle derives, `<route>/<knock>`, and only when `Sec-WebSocket-Protocol` carries its first
# flight, `lar-gate, <token>`; every other upgrade meets a destroyed socket before any HTTP 101. A hearth rests at its
# floor, standing no sync gate, until a person unlocks it, so the witness opens the staged hearth's key through the
# test door; the hearth composes and its sovereign sync gate states the path it stands on. The witness knocks there
# with a flight that reads (96 bytes, 128 characters of unpadded base64url): the gate answers 101, then falls silent
# on a flight no dialer sealed to it.
VESSEL=$(compose ps -q lares)
unlocked=$("$HERE/unlock-staged-container.sh" "$VESSEL" 2>&1 || :)
result 'the staged hearth opens its key and composes as a hearth' contains "$unlocked" '"standing":"hearth"'
stood_knock() { docker logs "$VESSEL" 2>&1 | sed -n 's/.*\[lar-gate\] the sync gate for Nexus .* stands on \(\/[^ ]*\).*/\1/p' | tail -n 1; }
tries=0
until [ -n "$(stood_knock)" ] || [ "$tries" -ge 60 ]; do sleep 1; tries=$((tries + 1)); done   # the bound only bounds the wait
wspath=$(stood_knock)
result 'the vessel states the knock its sync gate stands on'      sh -c "case '$wspath' in /ws/?*) exit 0 ;; *) exit 1 ;; esac"
flight="lar-gate, $(head -c 96 /dev/urandom | base64 | tr -d '\n=' | tr '+/' '-_')"
result 'the flight spells the gate header (138 bytes)'            test "${#flight}" -eq 138
head_plain=$(knock "$wspath" "$flight")
result 'a wss knock through the terminator draws HTTP 101'        contains "$head_plain" 'HTTP/1.1 101'
unstood="/ws/$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
head_unstood=$(knock "$unstood" "$flight")
result 'CONTROL: a knock no gate stood draws 502, never 101'      contains "$head_unstood" 'HTTP/1.1 502'
head_noflight=$(knock "$wspath" lar.witness)
result 'CONTROL: the stood knock without a flight draws 502'      contains "$head_noflight" 'HTTP/1.1 502'
head_tablet=$(knock "$wspath" "$(bytes 8192)")
# 502 is the vessel's refusal behind the terminator, and the vessel names it on its own console; 400 would be nginx's.
vessel_refused() { docker logs "$VESSEL" 2>&1 | grep -q "refused before any 101 ($1)"; }
result 'an 8192-byte Sec-WebSocket-Protocol passes the terminator (502)' contains "$head_tablet" 'HTTP/1.1 502'
result 'the 8192-byte header meets the vessel, never nginx (no 400)' not_contains "$head_tablet" 'HTTP/1.1 400'
result 'the gate refused the 8192-byte header by name'            vessel_refused flight-overlong
head_over=$(knock "$wspath" "$(bytes 20000)")
result 'CONTROL: a header line past the buffer draws nginx 400'   contains "$head_over" 'HTTP/1.1 400'

# A red at the edge prints what the two services said, so the reader sees which side refused.
[ "$FAILURES" -eq 0 ] || compose --profile https logs --no-color --tail 40 lares terminator 2>&1 | sed 's/^/    /'

printf '── the wall: the vessel never meets the credential\n'
EDGE=$(compose --profile https ps -q terminator)
for pair in "vessel:$VESSEL" "terminator:$EDGE"; do
  who=${pair%%:*}; id=${pair#*:}
  shape=$(docker inspect -f '{{json .Config.Env}} {{json .Mounts}} {{json .HostConfig.Binds}}' "$id")
  result "the $who names no credential variable"                  not_contains "$shape" 'PORKBUN\|LARES_DNS_CREDENTIAL\|/run/dns'
  result "the $who mounts no credential directory"                not_contains "$shape" "$SCRATCH/credential"
  result "the $who holds neither fake credential in its environment" not_contains "$shape" "$FAKE_KEY\|$FAKE_SECRET"
done
# ONE search, two needles. A canary planted in the workspace proves the search reads the vessel's process and both
# mounts; the same search then reads no fake credential.
CANARY="household-witness-canary-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
printf '%s\n' "$CANARY" > "$SCRATCH/workspace/witness-canary.txt"
vessel_search() {   # $1 = needle; prints what the vessel's own process, /state and /workspace hold of it
  docker exec "$VESSEL" sh -c 'tr "\0" "\n" < /proc/1/environ | grep -c -- "$1"; grep -rIl -- "$1" /state /workspace /run /tmp 2>/dev/null; echo search-ran' sh "$1" 2>/dev/null || :
}
host_search() { grep -rIl -- "$1" "$SCRATCH/state" "$SCRATCH/workspace" 2>/dev/null || :; echo search-ran; }
seen=$(vessel_search "$CANARY")
result 'CONTROL: the vessel search finds a planted canary'        contains "$seen" '/workspace/witness-canary.txt'
seen=$(vessel_search fake-household-witness)
result 'the vessel search ran to its end'                         contains "$seen" 'search-ran'
result 'the vessel process, /state and /workspace hold no fake credential' test "$seen" = "0
search-ran"
seen=$(host_search "$CANARY")
result 'CONTROL: the host search finds the canary'                contains "$seen" 'witness-canary.txt'
seen=$(host_search fake-household-witness)
result 'the host state and workspace hold no fake credential'     test "$seen" = search-ran
result 'CONTROL: the same needle reads in the credential directory' grep -rIq 'fake-household-witness' "$SCRATCH/credential"
result 'the compose file holds no credential value'               sh -c "! grep -q 'fake-household-witness' '$FILE'"

drop_scratch
if [ "$FAILURES" -ne 0 ]; then printf 'FAIL household https: %s assertion(s) failed\n' "$FAILURES"; exit 1; fi
printf 'PASS household https: every assertion held\n'
