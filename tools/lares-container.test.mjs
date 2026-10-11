/**
 * The host shims (lares-container.sh / .ps1) against a fake `docker` that records argv. Nothing here starts
 * a container: the live proof (found, up, vessel read, ingest, restart, both holder refusals) runs against the
 * real image. This pins the shim's own contract: the verb routing, the refusals by name, the read-only capture
 * binds, and that no argv ever carries the docker socket.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/lares-container.sh");
const PS1 = join(ROOT, "tools/lares-container.ps1");
const havePwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "1"]).status === 0;

async function run(shim, argv, { env = {}, envFile } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n` +
      `for a in "$@"; do case "$a" in -f) :;; *override*|/tmp/*) [ -f "$a" ] && cat "$a" >> "$CALL_LOG";; esac; done\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    if (envFile) await writeFile(join(dir, "lares-surface.env"), envFile);
    const cmd = shim === SH ? ["sh", [SH, ...argv]] : ["pwsh", ["-NoProfile", "-File", PS1, ...argv]];
    const base = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME, LARES_COMPOSE_FILE: compose };
    const r = spawnSync(cmd[0], cmd[1], { env: { ...base, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    return { ...r, calls, dir };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

const MOUNTS = { LARES_STATE: "/s", LARES_WORKSPACE: "/w" };
const shims = [["sh", SH], ...(havePwsh ? [["ps1", PS1]] : [])];

for (const [name, shim] of shims) {
  test(`${name}: neither mount standing refuses by name, before docker runs`, async () => {
    const r = await run(shim, ["vessel", "read"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_STATE/);
    assert.equal(r.calls, "");
  });

  test(`${name}: a mount named in lares-surface.env stands`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_STATE=/s\nLARES_WORKSPACE=/w\n" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--env-file \S*lares-surface\.env/);
  });

  test(`${name}: any other argv runs the CLI inside the container by exec, never run`, async () => {
    const r = await run(shim, ["vessel", "read", "--json"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /compose .*exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel read --json/);
    assert.doesNotMatch(r.calls, /\brun\b/);
  });

  test(`${name}: found is the one run, on the found profile`, async () => {
    const r = await run(shim, ["found"], { env: MOUNTS });
    assert.match(r.calls, /--profile found run --rm -T found\s*$/m);
  });

  test(`${name}: up stands the lares service detached; down removes it`, async () => {
    assert.match((await run(shim, ["up"], { env: MOUNTS })).calls, /up -d lares/);
    assert.match((await run(shim, ["down"], { env: MOUNTS })).calls, /down --remove-orphans/);
  });

  test(`${name}: --capture binds read-only under /capture/<n>; a home directory whole refuses`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "cap-"));
    try {
      const r = await run(shim, ["up", "--capture", dir], { env: MOUNTS });
      assert.match(r.calls, /target: \/capture\/1/);
      assert.match(r.calls, /read_only: true/);
      const bad = await run(shim, ["up", "--capture", process.env.HOME], { env: MOUNTS });
      assert.equal(bad.status, 2);
      assert.match(bad.stderr, /home directory/);
      assert.equal(bad.calls, "");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  test(`${name}: no argv carries the docker socket`, async () => {
    for (const argv of [["up"], ["found"], ["vessel", "read"]]) {
      assert.doesNotMatch((await run(shim, argv, { env: MOUNTS })).calls, /docker\.sock/);
    }
  });
}
