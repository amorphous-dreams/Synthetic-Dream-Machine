import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const BATTERY = fileURLToPath(new URL("./battery.sh", import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), "battery-"));
// Bounded by turns, not by a clock: the handshake file is the signal, the turn count only keeps a broken run from hanging.
const until = async (path, turns = 4000) => { for (let i = 0; i < turns && !existsSync(path); i++) await new Promise((r) => setTimeout(r, 5)); if (!existsSync(path)) throw new Error(`no handshake at ${path}`); };
// The exit reads off the child's own record first: an exit that fired before anyone listened still answers (floor-test-kit).
import { exited, floorEnv } from "./floor-test-kit.mjs";

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

// THE HEADROOM (no count of runs stands; the disk's write churn sets the only limit). RED-FIRST: written by floor-wright#2,
// run by the familiar.
test("HEADROOM: three runs under three HOMEs hold the floor at once where the readings admit them; no count stands (handshake files, no sleep)", async () => {
  const d = dir();
  const lock = join(d, "lock");
  const homes = ["homeA", "homeB", "homeC"].map((n) => { const h = join(d, n); mkdirSync(h); return h; });
  const marks = ["a", "b", "c"].map((n) => join(d, `${n}-holding`));
  const release = join(d, "release");
  const holder = (inFile) => `touch ${inFile}; while [ ! -e ${release} ]; do :; done`;
  const kids = [];
  const fly = (...a) => { const c = spawn(...a, { detached: true }); kids.push(c); return c; };
  try {
  const runs = marks.map((m, i) => fly("bash", [BATTERY, "bash", "-c", holder(m)], { env: floorEnv(lock, { HOME: homes[i] }), stdio: "ignore" }));
  // All three hold at once: two would have filled a fixed count, and the third flies beside them.
  for (const m of marks) await until(m);
  writeFileSync(release, "");
  for (const r of runs) assert.equal(await exited(r), 0);
  } finally { writeFileSync(release, ""); for (const c of kids) { try { process.kill(-c.pid, "SIGKILL"); } catch { /* gone */ } } }
});

test("HEADROOM: a run beside another waits while its load reading refuses, and admits once the other leaves (the measurement decides)", async () => {
  const d = dir();
  const lock = join(d, "lock");
  const inA = join(d, "a-holding"), releaseA = join(d, "a-release"), aDone = join(d, "a-done"), bStarted = join(d, "b-started");
  const kids = [];
  const fly = (...a) => { const c = spawn(...a, { detached: true }); kids.push(c); return c; };
  try {
  const first = fly("bash", [BATTERY, "bash", "-c", `touch ${inA}; while [ ! -e ${releaseA} ]; do :; done; touch ${aDone}`], { env: floorEnv(lock), stdio: "ignore" });
  await until(inA);
  // Zero cores of headroom: beside a live run the load reading refuses; alone it admits (its own stop reads the floor).
  const second = fly("bash", [BATTERY, "bash", "-c", `[ -e ${aDone} ] && touch ${bStarted}`], { env: floorEnv(lock, { LARES_FLOOR_LOAD_PER_CORE: "0" }), stdio: ["ignore", "ignore", "pipe"] });
  let err = ""; second.stderr.on("data", (c) => { err += c; });
  for (let i = 0; i < 4000 && !/waits: the load reads/.test(err); i++) await new Promise((r) => setTimeout(r, 5));
  assert.match(err, /floor: run \d+ waits: the load reads [\d.]+ against 0 cores/);
  assert.equal(second.exitCode, null, "the second ran while the load refused it");
  writeFileSync(releaseA, "");
  assert.equal(await exited(first), 0);
  assert.equal(await exited(second), 0, "the second ran only after the first left");
  assert.ok(existsSync(bStarted));
  } finally { writeFileSync(releaseA, ""); for (const c of kids) { try { process.kill(-c.pid, "SIGKILL"); } catch { /* gone */ } } }
});

test("each run's lock and reservation key by its own pid and leave with it; --floor-dir names the floor beside the door", () => {
  const d = dir();
  const lock = join(d, ".battery.lock");
  const floor = spawnSync("bash", [BATTERY, "--floor-dir"], { encoding: "utf8", env: floorEnv(lock) }).stdout.trim();
  assert.equal(floor, join(d, ".floor"));
  const r = spawnSync("bash", [BATTERY, "bash", "-c", `ls ${floor}`], { encoding: "utf8", env: floorEnv(lock) });
  assert.equal(r.status, 0, r.stderr);
  const key = /holding the box, run (\d+)/.exec(r.stderr)?.[1];
  assert.ok(key, r.stderr);
  assert.deepEqual(r.stdout.trim().split("\n").sort(), [`run-${key}.json`, `run-${key}.lock`]);
  assert.deepEqual(readdirSync(floor), [], "the run's lock and reservation left with it");
  const plain = spawnSync("bash", [BATTERY, "--floor-dir"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: "" } });
  assert.equal(plain.stdout.trim(), join(userInfo().homedir, ".lares-scratch", ".floor"));
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
