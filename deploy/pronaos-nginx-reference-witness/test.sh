#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT="lararium-pronaos-nginx-witness-$$"
PORT="${PRONAOS_NGINX_PORT:-18432}"
BASE="http://127.0.0.1:${PORT}"

cleanup() {
  rm -f "/tmp/pronaos-nginx-body-$$" "/tmp/pronaos-nginx-headers-$$" "/tmp/pronaos-nginx-mutated-$$"
  docker compose -p "$PROJECT" -f "$SCRIPT_DIR/compose.yml" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT HUP INT TERM

fail() { printf '%s\n' "[pronaos-nginx] FAIL: $*" >&2; exit 1; }
pass() { printf '%s\n' "[pronaos-nginx] PASS: $*"; }

docker compose -p "$PROJECT" -f "$SCRIPT_DIR/compose.yml" up -d --wait

wait_for_http() {
  attempts=0
  while [ "$attempts" -lt 30 ]; do
    if curl --silent --show-error --fail "$BASE/" >/dev/null 2>&1; then return 0; fi
    attempts=$((attempts + 1))
    sleep 1
  done
  fail "NGINX did not become reachable"
}
wait_for_http

assert_file() {
  path=$1
  expected_file=$2
  body_file=/tmp/pronaos-nginx-body-$$
  curl --silent --show-error --path-as-is -o "$body_file" "$BASE$path"
  cmp -s "$body_file" "$expected_file" || fail "$path body mismatch"
  pass "$path serves the prepared byte"
}

assert_status() {
  path=$1
  expected=$2
  actual=$(curl --silent --show-error --path-as-is -o /tmp/pronaos-nginx-body-$$ -w '%{http_code}' "$BASE$path")
  [ "$actual" = "$expected" ] || fail "$path returned $actual, expected $expected"
  if grep -q '<!doctype html>' /tmp/pronaos-nginx-body-$$; then fail "$path fell through to an SPA document"; fi
  pass "$path refuses with HTTP $expected"
}

assert_cache() {
  path=$1
  expected=$2
  header_file=/tmp/pronaos-nginx-headers-$$
  curl --silent --show-error --path-as-is -D "$header_file" -o /dev/null "$BASE$path"
  actual=$(awk -F': ' 'tolower($1) == "cache-control" { value=$2 } END { sub(/[\r\n]+$/, "", value); print value }' "$header_file")
  [ "$actual" = "$expected" ] || fail "$path cache-control was '$actual', expected '$expected'"
  pass "$path carries Cache-Control: $expected"
}

assert_file / "$SCRIPT_DIR/public/index.html"
assert_file /assets/app.js "$SCRIPT_DIR/public/assets/app.js"
assert_file /assets/worker.js "$SCRIPT_DIR/public/assets/worker.js"
assert_file /manifest.webmanifest "$SCRIPT_DIR/public/manifest.webmanifest"
assert_file /genesis/seed.json "$SCRIPT_DIR/public/genesis/seed.json"
assert_file /genesis/cas/9488c80300bd88c2f44460693d03adc5a5aa54b2c22b867e049486a3e706787b "$SCRIPT_DIR/public/genesis/cas/9488c80300bd88c2f44460693d03adc5a5aa54b2c22b867e049486a3e706787b"

assert_cache / "no-store"
assert_cache /assets/app.js "public, immutable, max-age=31536000"
assert_cache /assets/worker.js "public, immutable, max-age=31536000"
assert_cache /manifest.webmanifest "no-store"
assert_cache /genesis/seed.json "no-store"
assert_cache /genesis/cas/9488c80300bd88c2f44460693d03adc5a5aa54b2c22b867e049486a3e706787b "public, immutable, max-age=31536000"

assert_status /assets/missing.js 404
assert_status /manifest-missing.webmanifest 404
assert_status /genesis/cas/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 404
assert_status /private/upstream-fixture 404
assert_status /assets/..%2fprivate%2fupstream-fixture 404
assert_status /private/../assets/missing.js 404

node "$SCRIPT_DIR/ws-client.mjs" "$PORT"

nginx_id=$(docker compose -p "$PROJECT" -f "$SCRIPT_DIR/compose.yml" ps -q nginx)
nginx_mounts=$(docker inspect "$nginx_id" --format '{{range .Mounts}}{{println .Destination}}{{end}}')
case "$nginx_mounts" in
  *private*|*lares*|*lararium-data*) fail "NGINX received a private-looking mount: $nginx_mounts" ;;
esac
pass "NGINX has only the declared config and public projection mounts"

upstream_id=$(docker compose -p "$PROJECT" -f "$SCRIPT_DIR/compose.yml" ps -q upstream)
upstream_ports=$(docker inspect "$upstream_id" --format '{{json .NetworkSettings.Ports}}')
case "$upstream_ports" in
  '{}'|*'"4321/tcp":null'*) : ;;
  *) fail "upstream unexpectedly published host ports: $upstream_ports" ;;
esac
pass "the peer upstream remains internal-only"

# Deliberate weakening: replacing the final refusal with an SPA fallback must
# make the missing-route witness red. This runs a disposable second carrier.
mutated=$(mktemp)
mutated_id="${PROJECT}-spa-fallback"
sed 's/      return 404;/      try_files \/index.html =404;/' "$SCRIPT_DIR/nginx.conf" > "$mutated"
network="${PROJECT}_pronaos"
docker run -d --rm --name "$mutated_id" --network "$network" \
  -p "127.0.0.1::8080" \
  -v "$mutated:/etc/nginx/nginx.conf:ro" \
  -v "$SCRIPT_DIR/public:/usr/share/nginx/html:ro" \
  nginx:1.29-alpine >/dev/null
cleanup_mutated() { docker rm -f "$mutated_id" >/dev/null 2>&1 || true; rm -f "$mutated"; }
trap 'cleanup_mutated; cleanup' EXIT HUP INT TERM
mutated_port=$(docker port "$mutated_id" 8080/tcp | sed 's/.*://')
attempts=0
while [ "$attempts" -lt 20 ]; do
  if curl --silent --show-error "http://127.0.0.1:$mutated_port/" >/dev/null 2>&1; then break; fi
  attempts=$((attempts + 1)); sleep 1
done
mutated_status=$(curl --silent --show-error --path-as-is -o /tmp/pronaos-nginx-mutated-$$ -w '%{http_code}' "http://127.0.0.1:$mutated_port/manifest-missing.webmanifest")
[ "$mutated_status" = "200" ] || fail "weakening did not make the missing route visible"
grep -q '<!doctype html>' /tmp/pronaos-nginx-mutated-$$ || fail "weakening did not expose SPA fallback"
pass "deliberate SPA-fallback weakening is caught by the refusal witness"

printf '%s\n' "[pronaos-nginx] REFERENCE HARNESS PASS — NGINX carrier boundary holds"
