/**
 * The host shims (lares-container.sh / .ps1) against a fake `docker` that records argv. The fake answers the two
 * questions the shim asks of a vessel: whether one runs (FAKE_RUNNING_ID) and what standing verdict the CLI reads
 * (FAKE_OBSERVE_OUTPUT). Nothing here starts
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
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}";; esac\n` +
      `case " $* " in *" --observe --json "*) printf '%s\\n' "\${FAKE_OBSERVE_OUTPUT:-}";; esac\n` +
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

// ATTACHED: under a real pseudo-terminal the shim must NOT add -T, or the founding loses its human-route prompt.
// (Reading `-t 1` inside the `$(tty_flag)` substitution once always read false: stdout there is a pipe.)
const haveScript = spawnSync("script", ["--version"]).status === 0;
test("sh: found under a TTY runs attached, with no -T", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-tty-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    spawnSync("script", ["-qec", `sh ${SH} found`, "/dev/null"], {
      env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME, LARES_COMPOSE_FILE: compose, LARES_STATE: "/s", LARES_WORKSPACE: "/w" },
      encoding: "utf8",
    });
    const calls = await readFile(log, "utf8");
    assert.match(calls, /--profile offline run --rm offline vessel found --skip-build --root \/state --genesis \/app\/genesis\s*$/m);
    assert.doesNotMatch(calls, /-T/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

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

  test(`${name}: any other argv with a running vessel runs the CLI by exec`, async () => {
    const r = await run(shim, ["vessel", "read", "--json"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /compose .*exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel read --json/);
  });

  test(`${name}: a verb with no running vessel uses the offline door`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--profile offline run --rm -T offline persona new 0 --name ci-face/);
    assert.doesNotMatch(r.calls, /compose .*exec/);
  });

  test(`${name}: found uses the offline CLI door`, async () => {
    const r = await run(shim, ["found", "--json"], { env: MOUNTS });
    assert.match(r.calls, /--profile offline run --rm -T offline vessel found --skip-build --root \/state --genesis \/app\/genesis --json\s*$/m);
  });

  test(`${name}: a successful exec with a restand verdict restarts and waits healthy`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /restart lares[\s\S]*up -d --wait lares/);
    assert.match(r.stderr, /lares-container: face lit; restarting the vessel/);
  });

  test(`${name}: CONTROL attach verdict does not restart`, async () => {
    const r = await run(shim, ["persona", "list"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: vessel stand with no service stands and waits healthy`, async () => {
    const r = await run(shim, ["vessel", "stand", "--json"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /up -d --wait lares/);
    assert.doesNotMatch(r.calls, /compose .*exec/);
  });

  test(`${name}: vessel stand on a standing vessel whose verdict reads restand restarts it`, async () => {
    const r = await run(shim, ["vessel", "stand"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node \S+ vessel stand --observe --json[\s\S]*restart lares[\s\S]*up -d --wait lares/);
    // The acting stand never runs inside the container: the one exec carries --observe.
    assert.doesNotMatch(r.calls, /vessel stand\s*$/m);
  });

  test(`${name}: CONTROL vessel stand on a vessel whose verdict reads attach prints the reading and restarts nothing`, async () => {
    const r = await run(shim, ["vessel", "stand"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /"act":"attach"/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: --observe anywhere in a vessel stand argv keeps it a reading`, async () => {
    const r = await run(shim, ["vessel", "stand", "--json", "--observe"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node \S+ vessel stand --json --observe/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: vessel stand --observe passes through as a reading`, async () => {
    const r = await run(shim, ["vessel", "stand", "--observe", "--json"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --observe --json/);
    assert.equal((r.calls.match(/--observe --json/g) ?? []).length, 1);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: up stands the lares service detached; down removes it`, async () => {
    assert.match((await run(shim, ["up"], { env: MOUNTS })).calls, /up -d --wait lares/);
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
