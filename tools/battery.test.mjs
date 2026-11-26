import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BATTERY = fileURLToPath(new URL("./battery.sh", import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), "battery-"));
// Bounded by turns, not by a clock: the handshake file is the signal, the turn count only keeps a broken run from hanging.
const until = async (path, turns = 4000) => { for (let i = 0; i < turns && !existsSync(path); i++) await new Promise((r) => setTimeout(r, 5)); if (!existsSync(path)) throw new Error(`no handshake at ${path}`); };
const exited = (child) => new Promise((res) => child.on("exit", (code) => res(code)));

test("CONTROL: a free lock runs the command at once and its output reaches us", () => {
  const d = dir();
  const r = spawnSync("bash", [BATTERY, "echo", "ran"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "lock") } });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ran/);
});

test("the command's own exit code passes through", () => {
  const d = dir();
  const r = spawnSync("bash", [BATTERY, "bash", "-c", "exit 7"], { env: { ...process.env, LARES_BATTERY_LOCK: join(d, "lock") } });
  assert.equal(r.status, 7);
});

test("an unopenable lock exits 64 and never runs the command", () => {
  const d = dir();
  const marker = join(d, "ran");
  const r = spawnSync("bash", [BATTERY, "touch", marker], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "no-such-dir", "lock") } });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /REFUSED/);
  assert.ok(!existsSync(marker), "the command ran unlocked");
});

test("TWO SLOTS: two runs under two different HOMEs hold two slots at once; a third waits until one exits (handshake files, no sleep)", async () => {
  const d = dir();
  const lock = join(d, "lock");
  const homes = ["homeA", "homeB", "homeC"].map((n) => { const h = join(d, n); mkdirSync(h); return h; });
  const inA = join(d, "a-holding"), inB = join(d, "b-holding"), releaseA = join(d, "a-release"), releaseB = join(d, "b-release"), cStarted = join(d, "c-started"), aDone = join(d, "a-done");
  const holder = (inFile, release, done) => `touch ${inFile}; while [ ! -e ${release} ]; do :; done; ${done ? `touch ${done}` : "true"}`;
  const env = (home) => ({ ...process.env, HOME: home, LARES_BATTERY_LOCK: lock });
  const first = spawn("bash", [BATTERY, "bash", "-c", holder(inA, releaseA, aDone)], { env: env(homes[0]), stdio: "ignore" });
  await until(inA);
  // The second flies beside the first: two heavy runs at once.
  const second = spawn("bash", [BATTERY, "bash", "-c", holder(inB, releaseB)], { env: env(homes[1]), stdio: "ignore" });
  await until(inB);
  // The third queues: its command may only run once a slot frees, so it records whether a-done stood when it began.
  const third = spawn("bash", [BATTERY, "bash", "-c", `[ -e ${aDone} ] && touch ${cStarted}`], { env: env(homes[2]), stdio: "ignore" });
  for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r));
  assert.ok(!existsSync(cStarted));
  assert.equal(third.exitCode, null, "the third exited while both slots stood held");
  writeFileSync(releaseA, "");
  assert.equal(await exited(first), 0);
  assert.equal(await exited(third), 0, "the third ran only after a slot freed");
  assert.ok(existsSync(cStarted));
  writeFileSync(releaseB, "");
  assert.equal(await exited(second), 0);
});

test("--lock-paths names both slots: slot 1 the lock, slot 2 beside it with -2 before the .lock suffix", () => {
  const d = dir();
  const paths = (lock) => spawnSync("bash", [BATTERY, "--lock-paths"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: lock } }).stdout.trim().split("\n");
  assert.deepEqual(paths(join(d, ".battery.lock")), [join(d, ".battery.lock"), join(d, ".battery-2.lock")]);
  assert.deepEqual(paths(join(d, "plain")), [join(d, "plain"), join(d, "plain-2")]);
  const r = spawnSync("bash", [BATTERY, "--lock-paths"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: "" } });
  assert.deepEqual(r.stdout.trim().split("\n"), [join(userInfo().homedir, ".lares-scratch", ".battery.lock"), join(userInfo().homedir, ".lares-scratch", ".battery-2.lock")]);
});

test("--lock-path names the lock: LARES_BATTERY_LOCK wins; otherwise the PASSWD home's .lares-scratch, never $HOME", () => {
  const d = dir();
  const scratchHome = join(d, "scratch-home");
  mkdirSync(scratchHome);
  const path = (env) => spawnSync("bash", [BATTERY, "--lock-path"], { encoding: "utf8", env: { ...process.env, ...env } });
  const mine = join(d, "mine");
  assert.equal(path({ LARES_BATTERY_LOCK: mine }).stdout.trim(), mine);
  const r = path({ HOME: scratchHome, LARES_BATTERY_LOCK: "" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), join(userInfo().homedir, ".lares-scratch", ".battery.lock"));
  assert.ok(!r.stdout.includes(scratchHome), "a $HOME-relative lock would give each lead its own lock");
});

test("RED: a relative LARES_BATTERY_LOCK refuses (exit 64) since two working directories would pick two locks", () => {
  const d = dir(); const marker = join(d, "ran");
  const r = spawnSync("bash", [BATTERY, "touch", marker], { encoding: "utf8", cwd: d, env: { ...process.env, LARES_BATTERY_LOCK: ".battery.lock" } });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /absolute/);
  assert.ok(!existsSync(marker));
});

test("RED: a failed passwd lookup refuses (exit 64) and never falls back to /root", () => {
  const d = dir(); const bin = join(d, "bin"); mkdirSync(bin);
  writeFileSync(join(bin, "getent"), "#!/bin/sh\nexit 2\n", { mode: 0o755 });
  const r = spawnSync("bash", [BATTERY, "--lock-path"], { encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, LARES_BATTERY_LOCK: "" } });
  assert.equal(r.status, 64);
  assert.ok(!r.stdout.includes("/root"));
});

test("RED: the wrapped command's stderr reaches us (the lock open's silencing is scoped to the open)", () => {
  const d = dir();
  const r = spawnSync("bash", [BATTERY, "bash", "-c", "echo diagnosis >&2; exit 7"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "lock") } });
  assert.equal(r.status, 7);
  assert.match(r.stderr, /diagnosis/);
});
