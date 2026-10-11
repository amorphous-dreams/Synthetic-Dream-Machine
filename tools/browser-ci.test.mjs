/**
 * tools/browser-ci.sh against a fake `docker` that records argv. Nothing here starts a container: the live proof
 * (up, ingest, meme get, qa smoke, down) runs against the real image. This pins the driver's contract: the verb
 * routing, the refusals by name, that `down` removes the volumes, and that no argv ever carries the Docker socket.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/browser-ci.sh");

async function run(argv) {
  const dir = await mkdtemp(join(tmpdir(), "browser-ci-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\ncase "$*" in *"ps -q"*) echo cid123;; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("sh", [SH, ...argv], { env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME }, encoding: "utf8" });
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
  assert.match(r.calls, /--profile qa run --rm -T qa node x\.mjs/);
  for (const v of [["up"], ["down"], ["qa", "true"]]) assert.doesNotMatch((await run(v)).calls, /docker\.sock/);
});

test("an unknown verb and a bare call refuse by name", async () => {
  assert.equal((await run([])).status, 2);
  assert.equal((await run(["bogus"])).status, 2);
});
