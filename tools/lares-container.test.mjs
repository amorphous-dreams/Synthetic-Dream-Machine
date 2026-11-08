/**
 * The host shims (lares-container.sh / .ps1) against a fake `docker` that records argv. The fake answers the two
 * questions the shim asks of a vessel: whether one runs (FAKE_RUNNING_ID) and what standing verdict the CLI reads
 * (FAKE_OBSERVE_OUTPUT); FAKE_PS_RC, FAKE_EXEC_RC and FAKE_OBSERVE_RC make each of the three calls fail. Nothing here starts
 * a container: the live proof (found, up, vessel read, ingest, restart, both holder refusals) runs against the
 * real image. This pins the shim's own contract: the verb routing, the refusals by name, the read-only capture
 * binds, and that no argv ever carries the docker socket.
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile, chmod, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "..");
const SH = join(ROOT, "tools/lares-container.sh");
const PS1 = join(ROOT, "tools/lares-container.ps1");
const havePwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "1"]).status === 0;

/**
 * THE ENV FILE RESTS AT `~/.lares/lares-surface.env`, outside every bind, the same file `resolveLaresMcp` reads, and
 * never in the clone: a file beside the compose file would sit in the tracked checkout. Every run names a scratch HOME
 * and a scratch house root, so no test reads a real `~/.lares`. `envAt: "clone"` plants the file beside the compose
 * file instead, where the shim must not look. `@HOUSE@` in an env value or an env file names the run's scratch house.
 */
async function run(shim, argv, { env = {}, envFile, envAt = "hearth", tty } = {}) {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n` +
      `for a in "$@"; do case "$a" in -f) :;; *override*|/tmp/*) [ -f "$a" ] && cat "$a" >> "$CALL_LOG";; esac; done\n` +
      `case " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit "\${FAKE_PS_RC:-0}";; esac\n` +
      `case " $* " in *" --observe --json "*) printf '%s\\n' "\${FAKE_OBSERVE_OUTPUT:-}"; exit "\${FAKE_OBSERVE_RC:-0}";; esac\n` +
      `case " $* " in *" vessel census "*) [ -z "\${FAKE_CENSUS_OUTPUT:-}" ] || printf '%s\\n' "\${FAKE_CENSUS_OUTPUT}"; [ -z "\${FAKE_CENSUS_ERR:-}" ] || printf '%s\\n' "\${FAKE_CENSUS_ERR}" >&2; exit "\${FAKE_CENSUS_RC:-0}";; esac\n` +
      `case " $* " in *" vault status --json "*) printf '%s\\n' "\${FAKE_CUSTODY_OUTPUT:-}"; exit 0;; esac\n` +
      `case " $* " in *" ps -q lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}"; exit 0;; esac\n` +
      `case " $* " in *"inspect --format"*) printf '%s\\n' "\${FAKE_IMAGE_REV:-}"; exit 0;; esac\n` +
      `case " $* " in *" exec "*) exit "\${FAKE_EXEC_RC:-0}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    const house = join(dir, "house");
    const fill = (v) => typeof v === "string" ? v.replaceAll("@HOUSE@", house) : v;
    const home = env.HOME ? fill(env.HOME) : join(dir, "home");
    await mkdir(join(home, ".lares"), { recursive: true });
    if (envFile) await writeFile(join(envAt === "clone" ? dir : join(home, ".lares"), "lares-surface.env"), fill(envFile));
    const cmd = shim === SH ? ["sh", [SH, ...argv]] : ["pwsh", ["-NoProfile", "-File", PS1, ...argv]];
    // A standing vessel answers a steady verdict unless a test scripts another answer.
    const steady = '{"data":{"standing":{"act":"attach","reason":"steady"}}}';
    const base = { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: home, LARES_COMPOSE_FILE: compose, FAKE_OBSERVE_OUTPUT: steady };
    const filled = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, fill(v)]));
    // `tty` names the bytes typed on a pseudo-terminal (`script`), which then carries stdout and stderr as one stream.
    const r = tty === undefined
      ? spawnSync(cmd[0], cmd[1], { env: { ...base, ...filled }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
      : spawnSync("script", ["-qec", [cmd[0], ...cmd[1]].map((a) => `'${a}'`).join(" "), "/dev/null"], { env: { ...base, ...filled }, encoding: "utf8", input: tty });
    let calls = ""; try { calls = await readFile(log, "utf8"); } catch {}
    const made = {};
    for (const c of ["hearth", "sensoriums", "projections", "library", "config"]) { try { await readdir(join(house, c)); made[c] = true; } catch { made[c] = false; } }
    return { ...r, calls, dir, made };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

// ATTACHED: under a real pseudo-terminal the shim must NOT add -T, or the founding loses its human-route prompt.
// (Reading `-t 1` inside the `$(tty_flag)` substitution once always read false: stdout there is a pipe.)
const haveScript = spawnSync("script", ["--version"]).status === 0;
test("sh: reset clears the hearth alone, after its refusals; sensoriums, projections, library, config and the env file stay", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-reset-"));
  try {
    const house = join(dir, "house"), workspace = join(dir, "workspace"), hearth = join(house, "hearth");
    const kept = ["sensoriums", "projections", "library", "config"].map((c) => join(house, c));
    await Promise.all([hearth, ...kept, workspace, join(workspace, "nested"), join(dir, ".lares")].map((path) => mkdir(path, { recursive: true })));
    const calls = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "${calls}"\ncase " $* " in *" ps -q --status running lares "*) printf '%s' "\${FAKE_RUNNING_ID:-}";; *" ps -q --filter volume="*) printf '%s' "\${FAKE_HOLDER_ID:-}";; esac\n`);
    await chmod(join(dir, "docker"), 0o755);
    await writeFile(join(hearth, "entry"), "keep until confirmation");
    await writeFile(join(hearth, ".hidden"), "hidden");
    for (const k of kept) await writeFile(join(k, "keep"), "stays");
    await writeFile(join(dir, ".lares", "lares-surface.env"), "# stays\n");
    const base = { PATH: `${dir}:${process.env.PATH}`, HOME: dir, LARES_HOUSE: house, LARES_WORKSPACE: workspace };
    const reset = (env, input = "re-found\n") => spawnSync("script", ["-qec", `sh '${SH}' reset`, "/dev/null"], { env: { ...base, ...env }, input, encoding: "utf8" });
    const standing = reset({ FAKE_RUNNING_ID: "vessel" });
    assert.equal(standing.status, 2);
    assert.match(standing.stdout, /tools\/lares-container\.sh down first/);
    // The holder check reads the hearth bind, and a running holder of it refuses.
    const held = reset({ FAKE_HOLDER_ID: "founding-run" });
    assert.equal(held.status, 2);
    assert.match(held.stdout, /a running container binds .*hearth: founding-run/);
    assert.match(await readFile(calls, "utf8"), new RegExp(`ps -q --filter volume=${hearth.replaceAll("/", "\\/")}\\b`));
    const parentOfHome = reset({ HOME: join(house, "operator") });
    assert.equal(parentOfHome.status, 2);
    assert.match(parentOfHome.stdout, /containing HOME/);
    for (const unsafe of ["", "/", dir, workspace, join(workspace, "nested"), dir + "/house/../workspace", "relative/house"]) {
      const result = reset({ LARES_HOUSE: unsafe });
      assert.equal(result.status, 2, `${unsafe}: ${result.stdout}`);
    }
    // A house that holds the workspace refuses.
    const holding = reset({ LARES_WORKSPACE: join(house, "projections", "ws") });
    assert.equal(holding.status, 2);
    assert.match(holding.stdout, /containing LARES_WORKSPACE/);
    assert.equal(reset({}, "no\n").status, 2);
    assert.deepEqual((await readdir(hearth)).sort(), [".hidden", "entry"]);
    const done = reset({});
    assert.equal(done.status, 0, done.stdout);
    assert.match(done.stdout, /sensoriums, projections, library, config, the env file and the image stay/);
    assert.deepEqual(await readdir(hearth), []);
    for (const k of kept) assert.equal(await readFile(join(k, "keep"), "utf8"), "stays");
    assert.equal(await readFile(join(dir, ".lares", "lares-surface.env"), "utf8"), "# stays\n");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("sh: reset refuses a hearth that resolves outside the house", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-reset-link-"));
  try {
    const house = join(dir, "house"), elsewhere = join(dir, "elsewhere"), workspace = join(dir, "workspace");
    await Promise.all([house, elsewhere, workspace].map((path) => mkdir(path, { recursive: true })));
    await writeFile(join(elsewhere, "precious"), "never cleared");
    spawnSync("ln", ["-s", elsewhere, join(house, "hearth")]);
    await writeFile(join(dir, "docker"), "#!/bin/sh\nexit 0\n");
    await chmod(join(dir, "docker"), 0o755);
    const r = spawnSync("script", ["-qec", `sh '${SH}' reset`, "/dev/null"], { env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, LARES_HOUSE: house, LARES_WORKSPACE: workspace }, input: "re-found\n", encoding: "utf8" });
    assert.equal(r.status, 2, r.stdout);
    assert.match(r.stdout, /resolves outside LARES_HOUSE/);
    assert.equal(await readFile(join(elsewhere, "precious"), "utf8"), "never cleared");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test("sh: found under a TTY runs attached, with no -T", { skip: !haveScript }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "lares-container-tty-"));
  try {
    const log = join(dir, "calls.log");
    await writeFile(join(dir, "docker"), `#!/bin/sh\nprintf '%s\\n' "$*" >> "$CALL_LOG"\n`);
    await chmod(join(dir, "docker"), 0o755);
    const compose = join(dir, "docker-compose.surface.yml");
    await writeFile(compose, "services: {}\n");
    spawnSync("script", ["-qec", `sh ${SH} found`, "/dev/null"], {
      env: { PATH: `${dir}:${process.env.PATH}`, CALL_LOG: log, HOME: join(dir, "home"), LARES_COMPOSE_FILE: compose, LARES_HOUSE: join(dir, "house"), LARES_WORKSPACE: "/w" },
      encoding: "utf8",
    });
    const calls = await readFile(log, "utf8");
    assert.match(calls, /--profile offline run --rm offline vessel found --skip-build --root \/lar --genesis \/app\/genesis\s*$/m);
    assert.doesNotMatch(calls, /(^|\s)-T(\s|$)/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

const MOUNTS = { LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" };
const shims = [["sh", SH], ...(havePwsh ? [["ps1", PS1]] : [])];

for (const [name, shim] of shims) {
  test(`${name}: neither mount standing refuses by name, before docker runs`, async () => {
    const r = await run(shim, ["vessel", "read"]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE/);
    assert.equal(r.calls, "");
  });

  test(`${name}: a mount named in the hearth's lares-surface.env stands`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n" });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /--env-file \S*\/home\/\.lares\/lares-surface\.env/);
  });

  test(`${name}: an env file beside the compose file goes unread: no hearth file, the mounts refuse by name`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n", envAt: "clone" });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE stands in neither the environment nor \S*\/home\/\.lares\/lares-surface\.env/);
    assert.equal(r.calls, "");
  });

  test(`${name}: with no hearth env file and the mounts from the shell, compose is pointed off the checkout's own .env`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    // Compose auto-loads `.env` from the compose file's directory when no --env-file names one; the shim
    // names an empty one so a checkout .env never feeds the vessel's variables.
    assert.match(r.calls, /--env-file \/dev\/null|--env-file NUL/);
  });

  test(`${name}: CONTROL: a hearth env file stays the env file named`, async () => {
    const r = await run(shim, ["vessel", "read"], { envFile: "LARES_HOUSE=@HOUSE@\nLARES_WORKSPACE=/w\n" });
    assert.match(r.calls, /--env-file \S*\/home\/\.lares\/lares-surface\.env/);
    assert.doesNotMatch(r.calls, /--env-file \/dev\/null/);
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
    assert.match(r.calls, /--profile offline run --rm -T offline vessel found --skip-build --root \/lar --genesis \/app\/genesis --json\s*$/m);
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

  /** The revision the shim computes: HEAD, marked `-dirty` while the tree holds changes. */
  const checkoutRev = () => {
    const head = spawnSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    const dirty = spawnSync("git", ["-C", ROOT, "status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).stdout.trim() !== "";
    return dirty ? `${head}-dirty` : head;
  };

  test(`${name}: up warns when the image's revision label differs from HEAD, naming both`, async () => {
    const head = checkoutRev();
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: "0123456789abcdef0123456789abcdef01234567", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /image names revision 0123456789abcdef0123456789abcdef01234567 and the checkout /);
    if (!head.endsWith("-dirty")) {
      assert.ok(r.stderr.includes(head), "the warning names the checkout's head");
      assert.match(r.stderr, name === "sh" ? /GIT_REV=\S+ docker compose -f "\S+" build lares/ : /\$env:GIT_REV='\S+'; docker compose -f "\S+" build lares/, "the hint names the build that bakes the label, in the shim's own shell form");
    } else {
      assert.match(r.stderr, /commit first/);
      assert.doesNotMatch(r.stderr, /-dirty build|GIT_REV='\S*-dirty/, "a dirty tree prints no -dirty build line");
    }
    assert.doesNotMatch(r.stderr, /rebuild the image \(`docker compose build`\)/);
  });

  test(`${name}: a label carrying control characters prints without them`, async () => {
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: "\u001b[31mevil\u0085\u009b[0m", FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /[\u001b\u0085\u009b]/);
  });

  test(`${name}: CONTROL up stays silent about the revision when the image names the checkout's rev`, async () => {
    const head = checkoutRev();
    const r = await run(shim, ["up"], { env: { ...MOUNTS, FAKE_RUNNING_ID: "cid", FAKE_IMAGE_REV: head, FAKE_CUSTODY_OUTPUT: '{"data":{"door":{"unlocked":true}}}' } });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stderr, /image names revision/);
    assert.doesNotMatch(r.stderr, /no git checkout/);
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

  // THE CENSUS BEFORE A STOP (operator ruling R3): a stop never drops content silently.
  const STANDING = { ...MOUNTS, FAKE_RUNNING_ID: "vessel" };
  const CLEAN = "census: clean — no save waits in memory, and the disk projector owes no carrier";
  const ITEMS = "held-save  save-unbooked  doc doc-heron  2 save(s) in memory  bag notes\ncarrier  pending  lar:///ha.ka.ba/notes/pond  bag notes  island wiki";
  const stopped = (calls) => /down --remove-orphans/.test(calls);

  test(`${name}: down over a standing vessel asks the census first, and a clean answer stops it`, async () => {
    const r = await run(shim, ["down", "--timeout", "5"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: CLEAN } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.calls, /exec -T lares node packages\/lares-cli\/bin\/lares\.mjs vessel census --no-json/);
    assert.ok(r.calls.indexOf("vessel census") < r.calls.indexOf("down --remove-orphans"), r.calls);
    // down's own flags still pass through.
    assert.match(r.calls, /down --remove-orphans --timeout 5/);
  });

  test(`${name}: a census naming items refuses with no terminal, listing each, and stops nothing`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /held-save {2}save-unbooked {2}doc doc-heron/);
    assert.match(r.stderr, /carrier {2}pending {2}lar:\/\/\/ha\.ka\.ba\/notes\/pond/);
    assert.match(r.stderr, /vault unlock/);
    assert.match(r.stderr, /accept-loss/);
    assert.match(r.stderr, /no terminal/);
    assert.equal(stopped(r.calls), false, r.calls);
  });

  test(`${name}: a census that cannot answer refuses by name, never a silent stop`, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "1", FAKE_CENSUS_ERR: "container wedged" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /could not answer/);
    assert.match(r.stderr, /container wedged/);
    assert.equal(stopped(r.calls), false, r.calls);
    // An exit of zero that names no clean verdict never reads clean.
    const mute = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "0" } });
    assert.equal(mute.status, 2);
    assert.equal(stopped(mute.calls), false, mute.calls);
  });

  test(`${name}: a ps that fails refuses the stop with no terminal`, async () => {
    const r = await run(shim, ["down"], { env: { ...MOUNTS, FAKE_PS_RC: "1" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /reads unknown/);
    assert.equal(stopped(r.calls), false, r.calls);
  });

  test(`${name}: CONTROL down with no vessel standing asks no census`, async () => {
    const r = await run(shim, ["down"], { env: MOUNTS });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.calls, /vessel census/);
    assert.ok(stopped(r.calls));
  });

  test(`${name}: on a terminal, accept-loss typed stops; another word refuses`, { skip: !haveScript }, async () => {
    const items = { ...STANDING, FAKE_CENSUS_OUTPUT: ITEMS, FAKE_CENSUS_RC: "3" };
    const accepted = await run(shim, ["down"], { env: items, tty: "accept-loss\n" });
    assert.equal(accepted.status, 0, accepted.stdout);
    assert.match(accepted.stdout, /doc doc-heron/);
    assert.match(accepted.stdout, /Type accept-loss/);
    assert.ok(stopped(accepted.calls), accepted.calls);
    const wrong = await run(shim, ["down"], { env: items, tty: "yes\n" });
    assert.notEqual(wrong.status, 0, wrong.stdout);
    assert.match(wrong.stdout, /did not read accept-loss/);
    assert.equal(stopped(wrong.calls), false, wrong.calls);
  });

  test(`${name}: on a terminal, a census that cannot answer offers accept-loss`, { skip: !haveScript }, async () => {
    const r = await run(shim, ["down"], { env: { ...STANDING, FAKE_CENSUS_RC: "1" }, tty: "accept-loss\n" });
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /could not answer/);
    assert.ok(stopped(r.calls), r.calls);
  });

  test(`${name}: --capture binds read-only under /capture/<n>; a home directory whole refuses`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "cap-"));
    try {
      const r = await run(shim, ["up", "--capture", dir], { env: MOUNTS });
      assert.match(r.calls, /target: \/capture\/1/);
      assert.match(r.calls, /read_only: true/);
      const bad = await run(shim, ["up", "--capture", "/home"], { env: MOUNTS });
      assert.equal(bad.status, 2);
      assert.match(bad.stderr, /home directory/);
      assert.equal(bad.calls, "");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  test(`${name}: a relative LARES_HOUSE refuses by name, before docker runs`, async () => {
    const r = await run(shim, ["vessel", "read"], { env: { LARES_HOUSE: "house", LARES_WORKSPACE: "/w" } });
    assert.equal(r.status, 2);
    assert.match(r.stderr, /LARES_HOUSE \(house\) reads relative/);
    assert.equal(r.calls, "");
  });

  test(`${name}: an env file inside one of the house's binds refuses by name, before docker runs`, async () => {
    const inside = await run(shim, ["vessel", "read"], { env: { HOME: "@HOUSE@/config/operator", LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" }, envFile: "# names nothing\n" });
    assert.equal(inside.status, 2, inside.stderr);
    assert.match(inside.stderr, /sits inside LARES_HOUSE's config bind/);
    assert.equal(inside.calls, "");
    // CONTROL: an env file beside the house root, in no bind, serves.
    const beside = await run(shim, ["vessel", "read"], { env: { HOME: "@HOUSE@/operator", LARES_HOUSE: "@HOUSE@", LARES_WORKSPACE: "/w" }, envFile: "# names nothing\n" });
    assert.equal(beside.status, 0, beside.stderr);
  });

  test(`${name}: up, found and the offline door make the house's five bound classes before a container stands`, async () => {
    for (const argv of [["up"], ["found"]]) {
      const r = await run(shim, argv, { env: MOUNTS });
      assert.equal(r.status, 0, r.stderr);
      assert.deepEqual(r.made, { hearth: true, sensoriums: true, projections: true, library: true, config: true });
    }
    const offline = await run(shim, ["vessel", "read"], { env: MOUNTS });
    assert.deepEqual(offline.made, { hearth: true, sensoriums: true, projections: true, library: true, config: true });
  });

  test(`${name}: no argv carries the docker socket`, async () => {
    for (const argv of [["up"], ["found"], ["vessel", "read"]]) {
      assert.doesNotMatch((await run(shim, argv, { env: MOUNTS })).calls, /docker\.sock/);
    }
  });
}
