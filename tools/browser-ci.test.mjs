/**
 * tools/browser-ci.sh against a fake `docker` that records argv. Nothing here starts a container: the live proof
 * (up, ingest, meme get, qa smoke, down) runs against the real image. This pins the driver's contract: the verb
 * routing, the refusals by name, that `down` removes the volumes, and that no argv ever carries the Docker socket.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/browser-ci.sh");

async function run(argv, env = {}) {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  *"ps -a -q"*) [ "$STAND" = "yes" ] && echo cid123 ;;
  *"image inspect"*) [ "$QA_IMAGE" = "yes" ] || exit 1 ;;
  *"ps -q"*) echo cid123 ;;
  *"unlock-test-custody.mjs"*) echo '{"op":"unlock","reading":"opens","held":true}'; exit "\${DOOR_RC:-0}" ;;
  *"printenv LAR_PORT"*) echo 4321 ;;
  *"persona list --json"*) echo '{"ok":true,"data":{"personas":[]}}' ;;
  *"persona new 0"*) echo '{"verifyingKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' ;;
  *"logs --no-color lares"*) printf 'lares-1  | [herm]   gate key: %s\nlares-1  | [lararium] gate key: %s\n' "$(printf 'c%.0s' $(seq 64))" "$(printf 'b%.0s' $(seq 64))" ;;
  *"fleet join offer"*) printf '{\n  "kind": "fleet-join-offer",\n  "nonce": "n1"\n}\n[lares fleet join] carry the offer to the joining vessel\n' ;;
  *"fleet join answer"*) printf '{\n  "kind": "fleet-join-answer",\n  "request": %s\n}\n[lares fleet join] carry the answer to the joining vessel\n' "$(cat)" ;;
  *"wiki list --json"*) printf '%s\\n' "$INFO_WIKIS" ;;
  *" --json"*) echo '{"ok":true}' ;;
  *"wiki active"*) printf "\\nactive wikis (1/4):\\n     lares\\n  rotatable pin budget: 3\\n" ;;
esac
`);
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("sh", [SH, ...argv], { env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME, STAND: "no", BROWSER_CI_PORT: "5499", ...env }, encoding: "utf8" });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    return { ...r, calls };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("down removes containers and the scratch volumes", async () => {
  const r = await run(["down"]);
  assert.equal(r.status, 0);
  assert.match(r.calls, /down -v --remove-orphans/);
});

test("join offer runs fleet join offer inside the node, with no TTY, and prints the offer JSON alone", async () => {
  const r = await run(["join", "offer"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs fleet join offer$/m);
  assert.deepEqual(JSON.parse(r.stdout), { kind: "fleet-join-offer", nonce: "n1" });
  assert.doesNotMatch(r.stdout, /carry the offer/);
});

test("join answer pipes a host request file into the node and prints the answer JSON alone", async () => {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-req-"));
  try {
    const req = join(dir, "request.json");
    await writeFile(req, '{"kind":"fleet-join-request","nonce":"n1"}');
    const r = await run(["join", "answer", req]);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares sh -c .*fleet join answer "\$f" "\$@".* packages\/lares-cli\/bin\/lares\.mjs$/m);
    assert.doesNotMatch(r.calls, /--sync-url/);
    assert.deepEqual(JSON.parse(r.stdout), { kind: "fleet-join-answer", request: { kind: "fleet-join-request", nonce: "n1" } });
    const synced = await run(["join", "answer", req], { BROWSER_CI_SYNC_URL: "ws://lares:4321/ws" });
    assert.match(synced.calls, /lares\.mjs --sync-url ws:\/\/lares:4321\/ws$/m);
    assert.equal((await run(["join", "answer", join(dir, "absent.json")])).status, 2);
    assert.equal((await run(["join", "bogus"])).status, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("ingest refuses an absolute or climbing path, and a missing carrier, by name", async () => {
  for (const p of ["/etc/passwd", "../x.mem", "bags/none/missing.mem"]) {
    const r = await run(["ingest", p]);
    assert.equal(r.status, 2, p);
    assert.match(r.stderr, /browser-ci:/);
  }
});

test("ingest copies the carrier in and applies it", async () => {
  const r = await run(["ingest", "bags/elyncia/ha.ka.ba/elyncia/characters/primary-characters/lady-aki.mem"]);
  assert.equal(r.status, 0);
  assert.match(r.calls, /cp .*lady-aki\.mem cid123:\/workspace\/bags\/elyncia\//);
  assert.match(r.calls, /ingest --source \/workspace\/bags\/elyncia\/.*lady-aki\.mem --to lar:\/\/\/ha\.ka\.ba\/bags\/lares --apply --yes/);
});

test("qa runs the command in the disposable runner; no argv carries the Docker socket", async () => {
  const r = await run(["qa", "node", "x.mjs"]);
  assert.equal(r.status, 0);
  assert.match(r.calls, /--profile qa run --rm -T (-e [\w=/]+ )*qa node x\.mjs/);
  assert.match(r.calls, /build qa/);
  for (const v of [["up"], ["down"], ["qa", "true"]]) assert.doesNotMatch((await run(v)).calls, /docker\.sock/);
});

// THE DEFAULT TAG BUILDS FROM THE TREE EVERY RUN. The harness image bakes the walks (`browser-ci-smoke.mjs`,
// `live-wiki.mjs`, the join helper, the custody probe), so a default tag left standing from an older tree would
// run an older tree's walk bytes against this code and read its verdict as this tree's. The layer cache keeps an
// unchanged tree's build cheap.
test("qa builds the default harness image from the tree even when a stale tag of it stands, before the run", async () => {
  const r = await run(["qa", "true"], { QA_IMAGE: "yes" });
  assert.equal(r.status, 0, r.stderr);
  const lines = r.calls.split("\n");
  const built = lines.findIndex((l) => /build qa$/.test(l));
  const ran = lines.findIndex((l) => /--profile qa run --rm/.test(l));
  assert.ok(built >= 0, "the default tag builds qa from the tree");
  assert.ok(ran > built, "the build precedes the run");
});

test("qa reads a named harness image as given, and builds it only when that tag stands absent", async () => {
  const given = await run(["qa", "true"], { QA_IMAGE: "yes", BROWSER_CI_HARNESS_IMAGE: "qa-other:local" });
  assert.equal(given.status, 0, given.stderr);
  assert.match(given.calls, /image inspect qa-other:local/);
  assert.doesNotMatch(given.calls, /build qa/);
  const absent = await run(["qa", "true"], { BROWSER_CI_HARNESS_IMAGE: "qa-other:local" });
  assert.equal(absent.status, 0, absent.stderr);
  assert.match(absent.calls, /build qa/);
});

// The two witnesses that bake a surface image hold the same law; a text pin keeps a later edit from
// returning either to the absent-only build.
const IMAGE_LAW = [
  ["tools/household-https-witness.sh", "HOUSEHOLD_IMAGE"],
  ["tools/harbor-walk-witness.sh", "HARBOR_IMAGE"],
];

export function buildsFromTree(text, variable) {
  const set = /^BUILD_FROM_TREE=yes$/m.test(text);
  const cleared = new RegExp(`^\\[ -z "\\$\\{${variable}:-\\}" \\] \\|\\| BUILD_FROM_TREE=$`, "m").test(text);
  const gated = /if \[ -n "\$BUILD_FROM_TREE" \] \|\| ! docker image inspect/.test(text);
  return set && cleared && gated;
}

test("the surface witnesses build their image from the tree unless their image variable names one", async () => {
  for (const [file, variable] of IMAGE_LAW) {
    assert.ok(buildsFromTree(await readFile(join(ROOT, file), "utf8"), variable), file);
  }
});

test("CONTROL: a planted witness with the absent-only build fails the image law", () => {
  const planted = 'IMAGE=${HARBOR_IMAGE:-lares-surface:local}\nif ! docker image inspect "$IMAGE" >/dev/null 2>&1; then\n  build\nfi\n';
  assert.equal(buildsFromTree(planted, "HARBOR_IMAGE"), false);
  const lawful = 'BUILD_FROM_TREE=yes\n[ -z "${HARBOR_IMAGE:-}" ] || BUILD_FROM_TREE=\nif [ -n "$BUILD_FROM_TREE" ] || ! docker image inspect "$IMAGE" >/dev/null 2>&1; then\n';
  assert.equal(buildsFromTree(lawful, "HARBOR_IMAGE"), true);
});

test("every verb honors BROWSER_CI_PROJECT; the default project is lares-browser-ci", async () => {
  const named = await run(["restart"], { BROWSER_CI_PROJECT: "harbor-rigger" });
  assert.match(named.calls, /^compose -p harbor-rigger -f /m);
  assert.doesNotMatch(named.calls, /lares-browser-ci/);
  assert.match((await run(["restart"])).calls, /^compose -p lares-browser-ci -f /m);
});

test("a port outside 5400-5499 refuses by name", async () => {
  const r = await run(["restart"], { BROWSER_CI_PORT: "8080" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /BROWSER_CI_PORT 8080 lies outside/);
});

test("up refuses by name when the project already stands, before it builds anything", async () => {
  const r = await run(["up"], { STAND: "yes" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /project lares-browser-ci already stands/);
  assert.doesNotMatch(r.calls, /build|run --rm seed/);
});

test("up refuses by name when the port already answers", async () => {
  const srv = createServer((_, res) => res.end("x"));
  await new Promise((ok, no) => { srv.once("error", no); srv.listen(5498, "127.0.0.1", ok); }).catch(() => null);
  if (!srv.listening) return;
  try {
    const r = await new Promise((ok) => {
      const c = spawn("sh", [SH, "up"], { env: { PATH: process.env.PATH, HOME: process.env.HOME, BROWSER_CI_PORT: "5498" } });
      let err = ""; c.stderr.on("data", (d) => { err += d; }); c.on("close", (code) => ok({ code, err }));
    });
    assert.equal(r.code, 2);
    assert.match(r.err, /port 5498 already answers/);
  } finally { srv.close(); }
});

test("restart restarts the node and waits healthy, and removes no volume", async () => {
  const r = await run(["restart"]);
  assert.equal(r.status, 0);
  assert.match(r.calls, /restart lares/);
  assert.match(r.calls, /up -d --wait lares/);
  assert.doesNotMatch(r.calls, /down|-v\b|volume/);
});

// Every boot rests at the floor holding no vessel key, so each start this driver performs ends at the test door.
const UNLOCK = "exec cid123 node tools/unlock-test-custody.mjs /state";

test("up opens the staged node's key after each start: before the face lights, and after the restart", async () => {
  const r = await run(["up"]);
  assert.equal(r.status, 0, r.stderr);
  const first = r.calls.indexOf(UNLOCK), last = r.calls.lastIndexOf(UNLOCK);
  assert.ok(first >= 0 && last > first, "two unlocks ride one up");
  assert.ok(first > r.calls.indexOf("up -d --wait lares") && first < r.calls.search(/persona new 0/), "the first unlock stands between the first healthy wait and the face");
  assert.ok(last > r.calls.lastIndexOf("restart lares") && last > r.calls.lastIndexOf("up -d --wait lares"), "the last unlock follows the restart's healthy wait");
  // The door's files ride in by `docker cp`; no mount changes and no argv carries the Docker socket.
  assert.match(r.calls, /^cp \S+\/tools cid123:\/app\/$/m);
  assert.doesNotMatch(r.calls, /docker\.sock/);
});

test("restart opens the staged node's key after its healthy wait", async () => {
  const r = await run(["restart"]);
  assert.ok(r.calls.indexOf(UNLOCK) > r.calls.indexOf("up -d --wait lares"));
});

test("a door that answers no open key stops the driver by name", async () => {
  const r = await run(["restart"], { DOOR_RC: "1" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /did not open its vessel key through the test door/);
});

test("bag creates a bag through act CREATE and prints its URI", async () => {
  const r = await run(["bag", "aki-fixture"]);
  assert.equal(r.status, 4, "the fake answers no ok:true, so the driver names the refusal");
  assert.match(r.calls, /act CREATE --bag lar:\/\/\/ha\.ka\.ba\/bags\/aki-fixture --yes/);
  assert.equal((await run(["bag", "Bad Name"])).status, 2);
});

test("recipe add inits the mounted wiki, then adds; remove only removes", async () => {
  const bag = "lar:///ha.ka.ba/bags/aki-fixture";
  const add = await run(["recipe", "add", bag], {
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [
      { slug: "lares", kind: "system", uri: "lar:///ha.ka.ba/bags/lares", automergeUrl: "automerge:doc" },
    ] } }),
  });
  assert.match(add.calls, /wiki active/);
  assert.match(add.calls, /wiki init lares --json/);
  assert.match(add.calls, /wiki list --json/);
  assert.match(add.stderr, /note: lares is a \[system\] wiki/);
  const rm = await run(["recipe", "remove", bag]);
  assert.equal(rm.status, 0);
  assert.match(rm.calls, /wiki remove-bag lares lar:\/\/\/ha\.ka\.ba\/bags\/aki-fixture/);
  assert.doesNotMatch(rm.calls, /wiki init/);
  assert.equal((await run(["recipe", "toggle", bag])).status, 2);
});

test("BROWSER_CI_WIKI names the wiki without asking the node", async () => {
  const r = await run(["recipe", "remove", "lar:///ha.ka.ba/bags/x"], { BROWSER_CI_WIKI: "other" });
  assert.match(r.calls, /wiki remove-bag other /);
  assert.doesNotMatch(r.calls, /wiki active/);
});

test("get reads AS the mounted wiki by default, and takes an explicit --bag or --recipe", async () => {
  const u = "lar:///ha.ka.ba/x/y";
  assert.match((await run(["get", u])).calls, /meme get lar:\/\/\/ha\.ka\.ba\/x\/y --recipe lares/);
  assert.match((await run(["get", u, "--bag", "aki-fixture"])).calls, /meme get .* --bag aki-fixture/);
  assert.equal((await run(["get", u, "--tag", "z"])).status, 2);
});

test("qa passes LARES_URL, BROWSER_CI_* and LIVE_WIKI_* through by name, never by value", async () => {
  const r = await run(["qa", "true"], { LARES_URL: "http://lares:4321", LIVE_WIKI_TOKEN: "s3cret", UNRELATED: "no" });
  assert.match(r.calls, /-e LARES_URL/);
  assert.match(r.calls, /-e LIVE_WIKI_TOKEN/);
  assert.match(r.calls, /-e BROWSER_CI_PORT/);
  assert.doesNotMatch(r.calls, /s3cret|UNRELATED/);
});

test("the qa runner shares the node's network namespace and dials it by localhost (a secure context)", async () => {
  const yml = await readFile(join(ROOT, "docker-compose.browser-ci.yml"), "utf8");
  const qa = yml.slice(yml.search(/^  qa:/m), yml.search(/^volumes:/m));
  assert.match(qa, /^    network_mode: "service:lares"$/m);
  assert.match(qa, /^    image: \$\{BROWSER_CI_HARNESS_IMAGE:-lares-browser-harness:local\}$/m);
  assert.match(qa, /^      target: browser-harness$/m);
  assert.match(qa, /^    working_dir: \/app$/m);
  assert.doesNotMatch(qa, /source: \.(?:\s|$)|target: \/repo/);
  assert.match(qa, /^      LARES_URL: http:\/\/localhost:4321$/m);
  assert.doesNotMatch(qa, /^    networks:/m);
  assert.doesNotMatch(qa, /lares:4321/);
  assert.match(qa, /cap_drop: \[ALL\]/);
  assert.doesNotMatch(yml, /docker\.sock/);
});

test("an unknown verb and a bare call refuse by name", async () => {
  assert.equal((await run([])).status, 2);
  assert.equal((await run(["bogus"])).status, 2);
});

// ── the join exchange (qa-join) ───────────────────────────────────────────────────────────────────────────────
// The fake runner runs one join per id (two fresh profiles, a malformed id, a node refusal), each in two legs: it asks
// for an offer, writes the request a page would mint, asks for the answer, and echoes what the host wrote into the
// shared directory. The fake `exec … fleet join answer` answers with the request it read on stdin.
async function runJoin(runnerIds, env = {}, command = ["node", "x.mjs"]) {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-xchg-"));
  const log = join(dir, "calls.log");
  try {
    await writeFile(join(dir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  *"wiki list --json"*) printf '%s\\n' "$INFO_WIKIS"; exit 0 ;;
esac
await_file() { i=0; while [ ! -f "$1" ] && [ ! -f "$2" ] && [ "$i" -lt 100 ]; do i=$((i+1)); sleep 0.05; done; }
got() { for f in "$@"; do [ -f "$f" ] && echo "GOT $(basename "$f"): $(cat "$f" | tr '\\n' ' ')"; done; return 0; }
case "$*" in
  *" run "*)
    x=$BROWSER_CI_EXCHANGE_DIR
    for k in ${runnerIds.map((l) => `"${l}"`).join(" ")}; do
      echo "JOIN-OFFER $k"
      safe=$(printf '%s' "$k" | tr -c 'a-z0-9-' '_' | cut -c1-64)
      await_file "$x/$k.offer" "$x/$safe.refused"
      got "$x/$k.offer" "$x/$safe.refused"
      [ -f "$x/$k.offer" ] || continue
      if [ "$k" != "no-request" ]; then printf '{"kind":"fleet-join-request","id":"%s"}' "$k" >"$x/$k.request"; fi
      echo "JOIN-REQUEST $k"
      await_file "$x/$k.answer" "$x/$k.refused"
      got "$x/$k.answer" "$x/$k.refused"
    done
    echo "passthrough line"
    exit \${RUNNER_EXIT:-0} ;;
  *"fleet join offer"*) [ -z "$OFFER_REFUSES" ] || { echo "node refuses the offer" >&2; exit 1; }
    printf '{\\n  "kind": "fleet-join-offer"\\n}\\n[lares fleet join] carry the offer\\n' ;;
  *"fleet join answer"*) req=$(cat)
    case "$req" in *refuse-me*) echo "node refuses the request" >&2; exit 1 ;; esac
    printf '{\\n  "kind": "fleet-join-answer",\\n  "request": %s\\n}\\n[lares fleet join] carry the answer\\n' "$req" ;;
esac
`);
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("sh", [SH, "qa-join", ...command], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: process.env.HOME, CALL_LOG: log, BROWSER_CI_PORT: "5499", ...env }, encoding: "utf8" });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    return { ...r, calls };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("qa-join answers each JOIN-OFFER with an offer and each JOIN-REQUEST with that request's answer, any number of joins per run", async () => {
  const a = "a".repeat(32), b = "join-b";
  const r = await runJoin([a, b]);
  assert.equal(r.status, 0, r.stderr);
  for (const id of [a, b]) {
    assert.match(r.stdout, new RegExp(`GOT ${id}\\.offer: \\{ +"kind": "fleet-join-offer" \\}`));
    assert.match(r.stdout, new RegExp(`GOT ${id}\\.answer: \\{ +"kind": "fleet-join-answer", +"request": \\{"kind":"fleet-join-request","id":"${id}"\\} \\}`));
  }
  assert.doesNotMatch(r.stdout, /carry the (offer|answer)/, "the JSON alone crosses");
  assert.match(r.stdout, /passthrough line/, "every other runner line passes through");
});

test("qa-join refuses a malformed id, an absent request and a node refusal by name, and the runner status carries through", async () => {
  const bad = await runJoin(["Not_An_Id"]);
  assert.match(bad.stdout, /\.refused: the join id must be 1-64 lowercase letters, digits or dashes/);
  const absent = await runJoin(["no-request"]);
  assert.match(absent.stdout, /GOT no-request\.refused: no request file stands at no-request\.request/);
  const offerRefused = await runJoin(["join-c"], { OFFER_REFUSES: "1" });
  assert.match(offerRefused.stdout, /GOT join-c\.refused: node refuses the offer/);
  const answerRefused = await runJoin(["refuse-me"]);
  assert.match(answerRefused.stdout, /GOT refuse-me\.refused: node refuses the request/);
  assert.equal((await runJoin([], { RUNNER_EXIT: "7" })).status, 7);
});

test("plain qa answers no join leg and the runner gets the exchange directory by name", async () => {
  const r = await run(["qa", "true"]);
  assert.match(r.calls, /-e BROWSER_CI_EXCHANGE=\/exchange/);
});

test("the compose runner mounts the exchange directory, and the node mounts nothing of it", async () => {
  const yml = await readFile(join(ROOT, "docker-compose.browser-ci.yml"), "utf8");
  const qa = yml.slice(yml.search(/^  qa:/m), yml.search(/^volumes:/m));
  assert.match(qa, /target: \/exchange/);
  assert.match(qa, /BROWSER_CI_EXCHANGE_DIR/);
  assert.doesNotMatch(yml.slice(0, yml.search(/^  qa:/m)), /\/exchange/);
});

test("up wears the synthetic face before the restart that puts the vessel on it", async () => {
  const r = await run(["up"]);
  const at = (re) => r.calls.search(re);
  assert.ok(at(/persona new 0/) >= 0 && at(/persona wear 0/) > at(/persona new 0/));
  assert.ok(r.calls.lastIndexOf("restart lares") > at(/persona wear 0/));
});

test("CONTROL: info reads the mounted wiki document from a registered JSON system wiki", async () => {
  const r = await run(["info"], {
    BROWSER_CI_WIKI: "lares",
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [
      { slug: "lares", uri: "lar:///ha.ka.ba/bags/lares", kind: "system", automergeUrl: "automerge:21Bk4FPMkZ6Gpbde8XXvZfxhCZcg" },
    ] } }),
  });
  assert.equal(r.status, 0, r.stderr);
  const info = JSON.parse(r.stdout);
  assert.deepEqual(info.wikiDoc, {
    url: "automerge:21Bk4FPMkZ6Gpbde8XXvZfxhCZcg", kind: "system", bag: "lar:///ha.ka.ba/bags/lares",
  });
  assert.deepEqual(info.wikiDocsRegistered, [{ url: info.wikiDoc.url, kind: "system" }]);
  assert.equal(info.gateKey, "b".repeat(64), "the gate key reads off the hearth's own boot line, never the crossroads line");
  assert.match(r.calls, /logs --no-color lares/);
  assert.doesNotMatch(r.calls, /device-admit|fleet join/);
  assert.equal(info.recipe.leafReadsDefaultRecipe, true);
  assert.match(r.calls, /wiki list --json/);
});

test("info refuses a walk start by name when the wiki has no document", async () => {
  const r = await run(["info"], {
    BROWSER_CI_WIKI: "lares",
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [] } }),
  });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /wikiDoc/);
  assert.equal(r.stdout, "");
});

test("qa-join refuses a live walk before the runner starts when its wiki document is absent", async () => {
  const r = await runJoin([], {
    BROWSER_CI_WIKI: "lares",
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [] } }),
  }, ["node", "packages/lararium-web/tests/live-wiki.mjs", "crossing"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /WIKI_DOC_MISSING/);
  assert.match(r.stderr, /wiki init/);
  assert.doesNotMatch(r.calls, / run .*qa /, "the QA container stays unstarted");
});

test("qa-join treats empty and non-Automerge document URLs as absent", async () => {
  for (const automergeUrl of ["", "https://example.test/doc"]) {
    const r = await runJoin([], {
      BROWSER_CI_WIKI: "lares",
      INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [
        { slug: "lares", uri: "lar:///ha.ka.ba/bags/lares", kind: "system", automergeUrl },
      ] } }),
    }, ["node", "packages/lararium-web/tests/live-wiki.mjs", "crossing"]);
    assert.equal(r.status, 2, JSON.stringify({ automergeUrl }));
    assert.match(r.stderr, /WIKI_DOC_MISSING/);
    assert.match(r.stderr, /wiki init/);
    assert.doesNotMatch(r.calls, / run .*qa /, "the QA container stays unstarted");
  }
});

test("CONTROL: qa-join starts a live walk when the registered document is an Automerge URL", async () => {
  const r = await runJoin([], {
    BROWSER_CI_WIKI: "lares",
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [
      { slug: "lares", uri: "lar:///ha.ka.ba/bags/lares", kind: "system", automergeUrl: "automerge:21Bk4FPMkZ6Gpbde8XXvZfxhCZcg" },
    ] } }),
  }, ["node", "packages/lararium-web/tests/live-wiki.mjs", "crossing"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.calls, /wiki list --json/);
  assert.match(r.calls, / run .*qa /);
});

test("the live wiki walk requires its document and asserts that quick edit flows leave no drafts", async () => {
  const source = await readFile(join(ROOT, "packages/lararium-web/tests/live-wiki.mjs"), "utf8");
  assert.match(source, /assert\.ok\(nodeWikiDoc,[^)]*LIVE_WIKI_NODE_DOC/);
  assert.doesNotMatch(source, /if\s*\(nodeWikiDoc\)/);
  assert.match(source, /assertNoDraft[\s\S]*Draft of/);
  const discard = source.match(/await assertNoDraft\(page, AKI, "quick open-and-discard"\);/);
  const save = source.match(/await assertNoDraft\(page, AKI, "immediate save"\);/);
  const reload = source.match(/await assertNoDraft\(page, AKI, "reload after save"\);/);
  assert.ok(discard, "discard flow asserts draft absence");
  assert.ok(save, "immediate save flow asserts draft absence");
  assert.ok(reload, "post-reload flow asserts draft absence");
  const helper = source.slice(source.indexOf("async function assertNoDraft"), source.indexOf("/** Open Aki through"));
  assert.match(helper, /waitForFunction/);
  assert.ok(helper.indexOf("waitForFunction") < helper.indexOf("getByText(draftTitle"), "draft search results settle before the row count is read");
  assert.match(source, /quick discard leaves Aki's view frame in the story river/);
  assert.match(source, /viewFrame\(page, AKI\)\.waitFor\(\{ state: "visible"/);
  assert.match(source, /Confirm changes to this tiddler/);
  assert.match(source, /level\.fill\("3"\)/, "CONTROL: the standard field edit and save remain in the walk");
});

test("the runner side speaks both legs: JOIN-OFFER waits on <id>.offer, JOIN-REQUEST writes <id>.request whole and waits on <id>.answer", async () => {
  const { requestOffer, requestAnswer, JoinRefused } = await import("./browser-ci-join.mjs");
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-runner-"));
  const lines = [];
  const log = console.log;
  console.log = (line) => { lines.push(String(line)); };
  try {
    // A fake host: answer each line it sees by writing the leg's file.
    const host = setInterval(async () => {
      for (const line of lines.splice(0)) {
        const [verb, id] = line.split(" ");
        if (verb === "JOIN-OFFER") await writeFile(join(dir, `${id}.offer`), '{\n  "kind": "fleet-join-offer"\n}\n');
        if (verb === "JOIN-REQUEST") {
          const request = JSON.parse(await readFile(join(dir, `${id}.request`), "utf8"));
          await writeFile(join(dir, `${id}.answer`), JSON.stringify({ kind: "fleet-join-answer", request }));
        }
      }
    }, 20);
    try {
      const { id, offer } = await requestOffer({ dir, timeoutMs: 5_000 });
      assert.match(id, /^[0-9a-f]{32}$/);
      assert.deepEqual(offer, { kind: "fleet-join-offer" });
      const answer = await requestAnswer(id, { kind: "fleet-join-request", n: 1 }, { dir, timeoutMs: 5_000 });
      assert.deepEqual(answer, { kind: "fleet-join-answer", request: { kind: "fleet-join-request", n: 1 } });
      await writeFile(join(dir, "x.refused"), "node refuses\n");
      await assert.rejects(requestAnswer("x", { kind: "fleet-join-request" }, { dir, timeoutMs: 5_000 }), (e) => e instanceof JoinRefused && /node refuses/.test(e.message));
      await assert.rejects(requestAnswer(id, { kind: "fleet-join-offer" }, { dir }), /not fleet-join-request/);
      await assert.rejects(requestOffer({ dir: "" }), /BROWSER_CI_EXCHANGE stands unset/);
    } finally { clearInterval(host); }
  } finally {
    console.log = log;
    await rm(dir, { recursive: true, force: true });
  }
});
