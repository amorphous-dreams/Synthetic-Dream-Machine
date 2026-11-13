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

test("two runs under two different HOMEs serialize on the one lock: the second starts after the first exits (handshake files, no sleep)", async () => {
  const d = dir();
  const lock = join(d, "lock");
  const homeA = join(d, "homeA"), homeB = join(d, "homeB");
  mkdirSync(homeA); mkdirSync(homeB);
  const inA = join(d, "a-holding"), release = join(d, "a-release"), bStarted = join(d, "b-started"), aDone = join(d, "a-done");
  // First: holds the box until the test releases it.
  const first = spawn("bash", [BATTERY, "bash", "-c", `touch ${inA}; while [ ! -e ${release} ]; do :; done; touch ${aDone}`], { env: { ...process.env, HOME: homeA, LARES_BATTERY_LOCK: lock }, stdio: "ignore" });
  await until(inA);
  // Second: its command may only run once the first has exited, so it records whether a-done stood when it began.
  const second = spawn("bash", [BATTERY, "bash", "-c", `[ -e ${aDone} ] && touch ${bStarted}`], { env: { ...process.env, HOME: homeB, LARES_BATTERY_LOCK: lock }, stdio: "ignore" });
  // While the first holds the box the second is queued: let the event loop turn many times, and it still has not started.
  for (let i = 0; i < 200; i++) await new Promise((r) => setImmediate(r));
  assert.ok(!existsSync(bStarted));
  assert.equal(second.exitCode, null, "the second exited while the first held the lock");
  writeFileSync(release, "");
  assert.equal(await exited(first), 0);
  assert.equal(await exited(second), 0, "the second ran only after the first finished");
  assert.ok(existsSync(bStarted));
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
