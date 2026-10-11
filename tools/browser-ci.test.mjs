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
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\ncase "$*" in *"ps -a -q"*) [ "$STAND" = "yes" ] && echo cid123;; *"ps -q"*) echo cid123;; esac\ncase "$*" in *"wiki active"*) printf "\\nactive wikis (1/4):\\n     lares\\n  rotatable pin budget: 3\\n";; esac\n`);
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
  assert.match(r.calls, /--profile qa run --rm -T (-e \w+ )*qa node x\.mjs/);
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
  const add = await run(["recipe", "add", bag]);
  assert.match(add.calls, /wiki active/);
  assert.match(add.calls, /wiki init lares --json/);
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
