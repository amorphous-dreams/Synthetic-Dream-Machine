#!/bin/sh
# household-resolver-witness — the household resolver answers each name with its own address, proven against a TEST
# zone alone: two hearths, two addresses, through the compose file's own `records` check and `resolver` service.
#
#   REFUSALS      the `records` check refuses by name: no zone, no records file, a path that names no file, a
#                 malformed line, an address that reads as no IPv4 address, holds an octet led by a zero or names no
#                 LAN device, a name outside the zone, a label DNS cannot hold, a name on two lines, a file LARES_UID
#                 cannot read and a file others can write. A file only LARES_UID reads passes: the check runs as that
#                 uid. A file it refused stands no resolver.
#   PER NAME      the resolver answers `hearth.<zone>` and `parlour.<zone>` with their two addresses; a name under the
#                 zone that the file does not list answers NXDOMAIN; a listed name asked for AAAA answers no address;
#                 a private reverse lookup answers NXDOMAIN inside the house; the house answers its zone apex itself.
#   THE HOUSE     a name outside the zone forwards to the upstream, and the upstream hears no household name and
#                 no private reverse lookup. CONTROL: the upstream's own log names the outside name and the public
#                 reverse lookup the witness asked for.
#   AN EDIT       a third line lands once the check passed and the resolver restarted; a refused edit leaves the
#                 standing resolver on the last zone the check passed.
#
# The upstream stands in the resolver's own network namespace (`network_mode: service:resolver`), so it needs no
# address of its own and a second run of this witness shares nothing with the first. The witness reaches no real
# domain, zone, resolver or credential: the zone ends in `.test`, the outside name in `.example`, and the addresses
# come from the documentation ranges (RFC 5737). It publishes the resolver on a loopback port the OS hands it, and
# removes only the containers, network and volume of its own compose project and the directory it made.
#
#   HOUSEHOLD_PROJECT   compose project name (default lares-household-resolver)
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(dirname -- "$HERE")
PROJECT=${HOUSEHOLD_PROJECT:-lares-household-resolver}
FILE="$ROOT/docker-compose.surface.yml"
ZONE=home.example.test
FAILURES=0
SCRATCH=""

for tool in docker dig node; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'household-resolver-witness: %s stands absent on this host\n' "$tool" >&2; exit 2; }
done

LARES_UID=$(id -u); LARES_GID=$(id -g)
export COMPOSE_PROJECT_NAME="$PROJECT" LARES_UID LARES_GID

compose() { docker compose -f "$FILE" -f "$SCRATCH/witness.compose.yml" "$@"; }

drop_scratch() {
  if [ -n "$SCRATCH" ]; then
    compose --profile https --profile witness down -v --remove-orphans >/dev/null 2>&1 || :
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
contains 'household-records: LARES_DNS_RECORDS stands unset' 'stands unset' || { printf 'household-resolver-witness: the contains scanner matches nothing\n' >&2; exit 2; }
not_contains 'status: NXDOMAIN' 'status: NOERROR' || { printf 'household-resolver-witness: the not_contains scanner misreads\n' >&2; exit 2; }

# A project that already stands belongs to someone else. This check runs before the witness makes anything, so its
# teardown, armed only once the scratch directory exists, removes nothing the run did not create.
if [ -n "$(docker ps -a -q --filter "label=com.docker.compose.project=$PROJECT" 2>/dev/null)" ] \
   || [ -n "$(docker network ls -q --filter "label=com.docker.compose.project=$PROJECT" 2>/dev/null)" ]; then
  printf 'household-resolver-witness: project %s already stands; pick another HOUSEHOLD_PROJECT\n' "$PROJECT" >&2; exit 2
fi

SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/household-resolver.XXXXXX")
mkdir -p "$SCRATCH/state" "$SCRATCH/workspace"
# The vessel's two mounts stay unset in this slot's services, and compose still reads the whole file.
export LARES_STATE="$SCRATCH/state" LARES_WORKSPACE="$SCRATCH/workspace"
export LARES_TLS_ZONE="$ZONE" LARES_DNS_BIND=127.0.0.1
# A loopback port the OS hands out, so a second copy of this witness never reaches for the same one.
LARES_DNS_PORT=$(node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});')
export LARES_DNS_PORT
export LARES_DNS_UPSTREAM=127.0.0.1:54

# The stand-in upstream: one answer for a name outside the zone, and a log of every question it hears.
cat > "$SCRATCH/witness.compose.yml" <<YAML
services:
  upstream:
    profiles: [witness]
    image: \${LARES_DNS_IMAGE:-coredns/coredns:1.12.1}
    user: "0:0"
    network_mode: "service:resolver"
    command: ["-conf", "/etc/coredns/Corefile"]
    configs:
      - source: witness-upstream-corefile
        target: /etc/coredns/Corefile
    cap_drop: [ALL]
    cap_add: [NET_BIND_SERVICE]
    security_opt: ["no-new-privileges:true"]
configs:
  witness-upstream-corefile:
    content: |
      .:54 {
        log
        template IN A elsewhere.example {
          answer "{{ .Name }} 60 IN A 198.51.100.7"
        }
      }
YAML

RECORDS="$SCRATCH/household.records"
write_records() { printf '%s\n' "$@" > "$RECORDS"; chmod 644 "$RECORDS"; }
check() { compose --profile https run --rm -T records 2>&1; }
ask() { dig +time=3 +tries=3 -p "$LARES_DNS_PORT" @127.0.0.1 "$@" 2>&1 || :; }
# A resolver that just stood may let the first question time out; dig asks again, and its notes about that stay out.
answer_of() { dig +short +time=3 +tries=3 -p "$LARES_DNS_PORT" @127.0.0.1 "$@" 2>/dev/null | grep -v '^;' || :; }

printf '── the records check refuses by name\n'
export LARES_DNS_RECORDS=""
out=$(check || :)
result 'no records file: the check refuses by name'             contains "$out" 'household-records: LARES_DNS_RECORDS stands unset'
export LARES_DNS_RECORDS="$RECORDS"
out=$(check || :)
result 'a path that names no file refuses, and the engine made nothing there' sh -c "printf '%s' \"\$1\" | grep -q 'household.records' && test ! -e '$RECORDS'" sh "$out"
write_records '192.0.2.10 hearth.home.example.test'
out=$(LARES_TLS_ZONE= check || :)
result 'no zone: the check refuses by name'                     contains "$out" 'household-records: LARES_TLS_ZONE stands unset'
write_records '192.0.2.10 hearth.home.example.test extra'
out=$(check || :)
result 'a line with three words refuses'                        contains "$out" 'holds no "<LAN address> <name>" pair'
write_records '192.0.2.300 hearth.home.example.test'
out=$(check || :)
result 'an octet past 255 refuses'                              contains "$out" 'reads as no IPv4 address'
write_records '192.0.02.10 hearth.home.example.test'
out=$(check || :)
result 'an octet led by a zero refuses (the resolver loads no such zone)' contains "$out" 'holds an octet led by a zero'
write_records '127.0.0.1 hearth.home.example.test'
out=$(check || :)
result 'a loopback address refuses'                             contains "$out" 'names no device on the LAN'
write_records '192.0.2.10 hearth.elsewhere.example'
out=$(check || :)
result 'a name outside the zone refuses'                        contains "$out" 'lies outside LARES_TLS_ZONE'
write_records "192.0.2.10 $(printf 'a%.0s' $(seq 64)).home.example.test"
out=$(check || :)
result 'a label past 63 characters refuses'                     contains "$out" 'holds a label past 63 characters'
write_records '192.0.2.10 hearth.home.example.test' '192.0.2.11 hearth.home.example.test'
out=$(check || :)
result 'a name on two lines refuses'                            contains "$out" 'stands on two lines'
write_records '# nothing but a comment'
out=$(check || :)
result 'a file that holds no record refuses'                    contains "$out" 'holds no record'
write_records '192.0.2.10 hearth.home.example.test'
chmod 200 "$RECORDS"
out=$(check || :)
result 'a file LARES_UID cannot read refuses'                   contains "$out" 'keeps the check out'
chmod 600 "$RECORDS"
out=$(check || :)
result 'a file only its owner reads passes: the check reads it as LARES_UID' contains "$out" 'household-records: 1 name(s)'
chmod 666 "$RECORDS"
out=$(check || :)
result 'a file others can write refuses'                        contains "$out" 'lets group or other write'
chmod 644 "$RECORDS"
write_records '192.0.2.10 hearth.home.example.test' 'nonsense'
compose --profile https up -d resolver >/dev/null 2>&1 && rc=0 || rc=$?
result 'a refused file stands no resolver'                      test "$rc" -ne 0 -a -z "$(compose --profile https ps -q resolver 2>/dev/null)"

printf '── two hearths, two addresses\n'
write_records '# the household' '192.0.2.10 hearth.home.example.test' '' '192.0.2.11 parlour.home.example.test'
out=$(check)
result 'CONTROL: the check passes a lawful file'                contains "$out" 'household-records: 2 name(s) under home.example.test'
compose --profile https --profile witness up -d resolver upstream >/dev/null 2>&1
result 'hearth answers with its own address'                    test "$(answer_of hearth.$ZONE A)" = 192.0.2.10
result 'parlour answers with its own address'                   test "$(answer_of parlour.$ZONE A)" = 192.0.2.11
unlisted=$(ask cellar.$ZONE A)
result 'a name the file does not list answers NXDOMAIN'         contains "$unlisted" 'status: NXDOMAIN'
six=$(ask hearth.$ZONE AAAA)
result 'a listed name asked for AAAA answers no address'        sh -c "printf '%s' '$six' | grep -q 'status: NOERROR' && printf '%s' '$six' | grep -q 'ANSWER: 0'"
result 'a name outside the zone forwards to the upstream'       test "$(answer_of www.elsewhere.example A)" = 198.51.100.7
heard=$(compose --profile witness logs --no-color upstream 2>&1)
result 'CONTROL: the upstream log names the outside question'   contains "$heard" 'www.elsewhere.example'
result 'the upstream heard no household name'                   not_contains "$heard" "$ZONE"
private=$(ask -x 10.0.0.5)
result 'a private reverse lookup answers NXDOMAIN inside the house' contains "$private" 'status: NXDOMAIN'
ask -x 198.51.100.7 >/dev/null
heard=$(compose --profile witness logs --no-color upstream 2>&1)
result 'CONTROL: a public reverse lookup forwards to the upstream'  contains "$heard" '7.100.51.198.in-addr.arpa'
result 'the upstream heard no private reverse lookup'          not_contains "$heard" '5.0.0.10.in-addr.arpa'
apex=$(ask _acme-challenge.$ZONE TXT)
result 'the house answers its zone apex itself (why the issuer asks public resolvers)' sh -c "printf '%s' \"\$1\" | grep -q 'flags: qr aa' && printf '%s' \"\$1\" | grep -q 'SOA'" sh "$apex"

printf '── an edit lands once the check passed and the resolver restarted\n'
write_records '192.0.2.10 hearth.home.example.test' '192.0.2.11 parlour.home.example.test' '192.0.2.12 study.home.example.test'
result 'CONTROL: before the restart the new name answers NXDOMAIN' contains "$(ask study.$ZONE A)" 'status: NXDOMAIN'
out=$(check)
result 'the check passes the edited file'                       contains "$out" 'household-records: 3 name(s)'
compose --profile https restart resolver >/dev/null 2>&1
result 'the new name answers once the resolver restarted'       test "$(answer_of study.$ZONE A)" = 192.0.2.12
result 'the earlier names still answer'                         test "$(answer_of parlour.$ZONE A)" = 192.0.2.11
printf '── a refused edit leaves the standing resolver on the last checked zone\n'
write_records '192.0.2.10 hearth.home.example.test' '192.0.2.13 cellar.elsewhere.example'
out=$(check || :)
result 'the check refuses the edit by name'                     contains "$out" 'cellar.elsewhere.example lies outside LARES_TLS_ZONE'
compose --profile https restart resolver >/dev/null 2>&1
result 'the resolver still answers the last checked zone'       test "$(answer_of study.$ZONE A)" = 192.0.2.12

[ "$FAILURES" -eq 0 ] || compose --profile https --profile witness logs --no-color --tail 30 records resolver upstream 2>&1 | sed 's/^/    /'
drop_scratch
if [ "$FAILURES" -ne 0 ]; then printf 'FAIL household resolver: %s assertion(s) failed\n' "$FAILURES"; exit 1; fi
printf 'PASS household resolver: every assertion held\n'
