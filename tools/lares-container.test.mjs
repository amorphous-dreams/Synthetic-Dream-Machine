/**
 * The host shims (lares-container.sh / .ps1) against a fake `docker` that records argv. The fake answers the two
 * questions the shim asks of a vessel: whether one runs (FAKE_RUNNING_ID) and what standing verdict the CLI reads
 * (FAKE_OBSERVE_OUTPUT); FAKE_PS_RC, FAKE_EXEC_RC and FAKE_OBSERVE_RC make each of the three calls fail. Nothing here starts
 * a container: the live proof (found, up, vessel read, ingest, restart, both holder refusals) runs against the
 * real image. This pins the shim's own contract: the verb routing, the refusals by name, the read-only capture
 * binds, and that no argv ever carries the docker socket.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/lares-container.sh");
const PS1 = join(ROOT, "tools/lares-container.ps1");
const havePwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "1"]).status === 0;

/**
 * THE HEARTH OWNS ITS ENV FILE. The shim reads `lares-surface.env` from the hearth root (`LAR_ROOT`, else
 * `~/.lares`), the same root `resolveLaresMcp` reads, and never from the clone: a file beside the compose file
 * would sit in the tracked checkout. Every run names a scratch hearth, so no test reads a real `~/.lares`.
 * `envAt: "clone"` plants the file beside the compose file instead, where the shim must not look.
 */
async function run(shim, argv, { env = {}, envFile, envAt = "hearth" } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n` +
      `for a in "$@"; do case "$a" in -f) :;; *override*|/tmp/*) [ -f "$a" ] && cat "$a" >> "$CALL_LOG";; esac; done\n` +
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" --observe --json "*) printf '%s\\n' "\${FAKE_OBSERVE_OUTPUT:-}"; exit "\${FAKE_OBSERVE_RC:-0}";; esac\n` +
      `case " $* " in *" vault status --json "*) printf '%s\\n' "\${FAKE_CUSTODY_OUTPUT:-}"; exit 0;; esac\n` +
      `case " $* " in *" exec "*) exit "\${FAKE_EXEC_RC:-0}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    const hearth = join(dir, "hearth");
    await mkdir(hearth, { recursive: true });
    if (envFile) await writeFile(join(envAt === "clone" ? dir : hearth, "lares-surface.env"), envFile);
    const cmd = shim === SH ? ["sh", [SH, ...argv]] : ["pwsh", ["-NoProfile", "-File", PS1, ...argv]];
    // A standing vessel answers a steady verdict unless a test scripts another answer.
    const steady = '{"data":{"standing":{"act":"attach","reason":"steady"}}}';
    const base = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME, LAR_ROOT: hearth, LARES_COMPOSE_FILE: compose, FAKE_OBSERVE_OUTPUT: steady };
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
      env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: process.env.HOME, LAR_ROOT: join(dir, "hearth"), LARES_COMPOSE_FILE: compose, LARES_STATE: "/s", LARES_WORKSPACE: "/w" },
      encoding: "utf8",
    });
    const calls = await readFile(log, "utf8");
    assert.match(calls, /--profile offline run --rm offline vessel found --skip-build --root \/state --genesis \/app\/genesis\s*$/m);
    assert.doesNotMatch(calls, /(^|\s)-T(\s|$)/);
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

  test(`${name}: a mount named in the hearth's lares-surface.env stands`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_STATE=/s\nLARES_WORKSPACE=/w\n" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--env-file \S*\/hearth\/lares-surface\.env/);
  });

  test(`${name}: an env file beside the compose file goes unread: no hearth file, the mounts refuse by name`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_STATE=/s\nLARES_WORKSPACE=/w\n", envAt: "clone" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_STATE stands in neither the environment nor \S*\/hearth\/lares-surface\.env/);
    assert.equal(r.calls, "");
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

  // A VESSEL STANDS HOLDING NO KEY. With no TTY the shim names the one command that opens it, after every act
  // that stands or restarts the vessel; a vessel that already holds its key draws no line.
  const NAMES_UNLOCK = new RegExp(`the vessel stands holding no vessel key; open it on a terminal: lares-container\\.${name} vault unlock`);
  test(`${name}: up names vault unlock when the vessel holds no key`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"ok":true,"data":{"door":{"op":"custody","unlocked":false}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /up -d --wait lares[\s\S]*exec -T lares node \S+ vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
    assert.doesNotMatch(r.calls, /vault unlock/, "no TTY: the shim sends no unlock, it only names it");
  });

  test(`${name}: CONTROL a vessel that holds its key draws no unlock line`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_CUSTODY_OUTPUT: '{"ok":true,"data":{"door":{"op":"custody","unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /holding no vessel key/);
  });

  test(`${name}: a restart the shim performs names vault unlock again`, async () => {
    const r = await run(shim, ["persona", "new", "0", "--name", "ci-face"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"restand","reason":"face lit"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /restart lares[\s\S]*up -d --wait lares[\s\S]*vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
  });

  test(`${name}: vault lock routes to the CLI inside the standing vessel`, async () => {
    const r = await run(shim, ["vault", "lock"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node \S+ vault lock/);
  });

  test(`${name}: CONTROL attach verdict does not restart`, async () => {
    const r = await run(shim, ["persona", "list"], {
      env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: '{"data":{"standing":{"act":"attach","reason":"steady"}}}' },
    });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: vessel stand with no service stands and waits healthy`, async () => {
    const r = await run(shim, ["vessel", "stand"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /up -d --wait lares/);
    // The one exec a fresh stand makes: the custody door's read, after which the shim names the unlock.
    const execs = r.calls.split("\n").filter((line) => /compose .*exec /.test(line) || /^compose exec |(^| )exec /.test(line));
    assert.equal(execs.length, 1, r.calls);
    assert.match(execs[0], /exec -T lares node \S+ vault status --json/);
    assert.match(r.stderr, NAMES_UNLOCK);
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

  test(`${name}: a failed state reading refuses, and opens neither door`, async () => {
    const r = await run(shim, ["persona", "list"], { env: { ...MOUNTS, FAKE_PS_RC: "1" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /cannot read the vessel's state/);
    assert.doesNotMatch(r.calls, /compose .*exec|run --rm/);
  });

  test(`${name}: a verb the CLI refuses keeps its exit status, and no standing check follows`, async () => {
    const r = await run(shim, ["meme", "get", "lar:///x", "--recipe", "default"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "7" } });
    assert.equal(r.status, 7);
    assert.doesNotMatch(r.calls, /--observe/);
  });

  test(`${name}: a standing check that fails after a verb landed exits non-zero and says so`, async () => {
    const r = await run(shim, ["persona", "new", "1", "--name", "probe"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_RC: "1" } });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /the standing check after it answered no verdict/);
    assert.doesNotMatch(r.calls, /restart lares/);
  });

  test(`${name}: a standing check that exits zero and names no verdict never passes as "no lift"`, async () => {
    for (const answer of ["", "not json", '{"data":{}}', '{"data":{"standing":{"act":"dance"}}}']) {
      const r = await run(shim, ["persona", "new", "1", "--name", "probe"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_OBSERVE_OUTPUT: answer } });
      assert.equal(r.status, 1, JSON.stringify(answer));
      assert.match(r.stderr, /answered no verdict/);
    }
  });

  test(`${name}: option-bearing host stand routes to the CLI`, async () => {
    const r = await run(shim, ["vessel", "stand", "--init"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --init/);
  });

  test(`${name}: vessel stop stops the container from the host, never from inside it`, async () => {
    const r = await run(shim, ["vessel", "stop"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /stop lares\s*$/m);
    assert.doesNotMatch(r.calls, /compose .*exec/);
  });

  test(`${name}: unknown vessel sub-doors are handed to the CLI`, async () => {
    for (const argv of [["vessel", "clear", "--force"], ["vessel", "rite", "rebirth"]]) {
      const r = await run(shim, argv, { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "2" } });
      assert.equal(r.status, 2, argv.join(" "));
      assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs/);
      assert.doesNotMatch(r.stderr, /no pave or wipe command/);
    }
  });

  test(`${name}: option-bearing vessel stand is validated by the CLI`, async () => {
    const argv = ["vessel", "stand", "--restart"];
    const r = await run(shim, argv, { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_EXEC_RC: "2" } });
    assert.equal(r.status, 2, argv.join(" "));
    assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel stand --restart\s*$/m);
    assert.doesNotMatch(r.stderr, /takes no option through this shim/);
  });

  test(`${name}: CONTROL another vessel rite still routes to the CLI`, async () => {
    const r = await run(shim, ["vessel", "rite", "quorum"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid" } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node \S+ vessel rite quorum/);
  });

  test(`${name}: a capture path holding a quote and a dollar sign rides the override as a literal`, async () => {
    const base = await mkdtemp(join(tmpdir(), "cap-odd-"));
    const odd = join(base, "it's $HOME");
    try {
      await mkdir(odd);
      const r = await run(shim, ["up", "--capture", odd], { env: MOUNTS });
      assert.equal(r.status, 0, r.stderr);
      assert.ok(r.calls.includes(`source: '${odd.replaceAll("'", "''").replaceAll("$", "$$$$")}'`), r.calls);
    } finally { await rm(base, { recursive: true, force: true }); }
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
