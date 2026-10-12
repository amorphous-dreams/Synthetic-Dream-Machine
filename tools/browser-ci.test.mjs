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
  *"ps -q"*) echo cid123 ;;
  *"printenv LAR_PORT"*) echo 4321 ;;
  *"persona list --json"*) echo '{"ok":true,"data":{"personas":[]}}' ;;
  *"persona new 0"*) echo '{"verifyingKey":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' ;;
  *"device-admit --joinee-key"*) echo '{"hearthGatePubKey":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' ;;
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

test("admit runs device-admit inside the node, with no TTY", async () => {
  const r = await run(["admit", "abc"]);
  assert.equal(r.status, 0);
  assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs device-admit --joinee-key abc/);
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
  for (const v of [["up"], ["down"], ["qa", "true"]]) assert.doesNotMatch((await run(v)).calls, /docker\.sock/);
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

test("admit --fragment prints only the #admit= line", async () => {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-frag-"));
  try {
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '{\\n  "kind": "x"\\n}\\n\\n[lares device-admit] carry this:\\n  #admit=QUJD\\n'\n`);
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("sh", [SH, "admit", "--fragment", "k"], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: process.env.HOME }, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "#admit=QUJD\n");
  } finally { await rm(dir, { recursive: true, force: true }); }
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

// ── the admit exchange (qa-admit) ─────────────────────────────────────────────────────────────────────────────
// The fake runner asks for two carriages (a second fresh profile), a malformed key, and echoes what the host wrote
// into the shared directory. The fake `exec … device-admit` answers a fragment derived from the key it was handed.
async function runAdmit(runnerLines, env = {}, command = ["node", "x.mjs"]) {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-xchg-"));
  const log = join(dir, "calls.log");
  try {
    await writeFile(join(dir, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$CALL_LOG"
case "$*" in
  *"wiki list --json"*) printf '%s\\n' "$INFO_WIKIS"; exit 0 ;;
esac
case "$*" in
  *" run "*)
    for k in ${runnerLines.map((l) => `"${l}"`).join(" ")}; do
      echo "ADMIT-REQUEST $k"
      safe=$(printf '%s' "$k" | tr -c 'A-Za-z0-9' '_' | cut -c1-80)
      i=0
      while [ ! -f "$BROWSER_CI_EXCHANGE_DIR/$k.admit" ] && [ ! -f "$BROWSER_CI_EXCHANGE_DIR/$k.refused" ] && [ ! -f "$BROWSER_CI_EXCHANGE_DIR/$safe.refused" ] && [ "$i" -lt 100 ]; do i=$((i+1)); sleep 0.05; done
      for f in "$BROWSER_CI_EXCHANGE_DIR/$k.admit" "$BROWSER_CI_EXCHANGE_DIR/$k.refused" "$BROWSER_CI_EXCHANGE_DIR/$safe.refused"; do [ -f "$f" ] && echo "GOT $(basename "$f"): $(cat "$f")"; done
    done
    echo "passthrough line"
    exit \${RUNNER_EXIT:-0} ;;
  *"device-admit --joinee-key cccc"*) echo "node refuses" >&2; exit 1 ;;
  *"device-admit --joinee-key "*) k=\${*##*--joinee-key }; printf '{\\n}\\n\\n[lares device-admit] carry:\\n  #admit=FRAG-%s\\n' "$k" ;;
esac
`);
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("sh", [SH, "qa-admit", ...command], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: process.env.HOME, CALL_LOG: log, BROWSER_CI_PORT: "5499", ...env }, encoding: "utf8" });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    return { ...r, calls };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("qa-admit answers each ADMIT-REQUEST with that key's fragment, any number of times per run", async () => {
  const a = "a".repeat(64), b = "b".repeat(64);
  const r = await runAdmit([a, b]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`GOT ${a}\\.admit: #admit=FRAG-${a}`));
  assert.match(r.stdout, new RegExp(`GOT ${b}\\.admit: #admit=FRAG-${b}`));
  assert.match(r.stdout, /passthrough line/, "every other runner line passes through");
});

test("qa-admit refuses a malformed key by name and a node refusal by name, and the runner status carries through", async () => {
  const bad = await runAdmit(["not-a-key"]);
  assert.match(bad.stdout, /\.refused: the joinee key must be 64 lowercase hex characters/);
  const hex = "c".repeat(64);
  const refused = await runAdmit([hex]);
  assert.match(refused.stdout, new RegExp(`GOT ${hex}\\.refused: node refuses`));
  assert.equal((await runAdmit([], { RUNNER_EXIT: "7" })).status, 7);
});

test("plain qa answers no request and the runner gets the exchange directory by name", async () => {
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

test("qa-admit refuses a live walk before the runner starts when its wiki document is absent", async () => {
  const r = await runAdmit([], {
    BROWSER_CI_WIKI: "lares",
    INFO_WIKIS: JSON.stringify({ ok: true, data: { wikis: [] } }),
  }, ["node", "packages/lararium-web/tests/live-wiki.mjs", "crossing"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /WIKI_DOC_MISSING/);
  assert.match(r.stderr, /wiki init/);
  assert.doesNotMatch(r.calls, / run .*qa /, "the QA container stays unstarted");
});

test("qa-admit treats empty and non-Automerge document URLs as absent", async () => {
  for (const automergeUrl of ["", "https://example.test/doc"]) {
    const r = await runAdmit([], {
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

test("CONTROL: qa-admit starts a live walk when the registered document is an Automerge URL", async () => {
  const r = await runAdmit([], {
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
