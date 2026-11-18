// battery-legs.test — the leg table, the choice of legs, the per-leg report and the lock, through injected runners and a
// lock that cannot open; no real suite runs here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LEGS, countsOf, legEnv, runLegs, selectLegs } from "./battery-legs.mjs";

const TOOL = fileURLToPath(new URL("./battery-legs.mjs", import.meta.url));
const dir = () => mkdtempSync(join(tmpdir(), "battery-legs-"));

test("the leg table names the thirteen legs in run order, the build first", () => {
  assert.deepEqual(LEGS.map((l) => l.name), ["build", "mesh", "node", "browser", "cli", "shims", "typecheck", "bcc", "evergreen", "parity", "vparity", "domains", "genesis"]);
  const shims = LEGS.find((l) => l.name === "shims");
  assert.deepEqual([shims.cmd, ...shims.args], ["node", "--test", "tools/lares-container.test.mjs", "tools/container-founding-seat.test.mjs", "tools/rite-walk.test.mjs"]);
});

test("--legs picks by name and keeps the table's order; an unknown name comes back named", () => {
  assert.deepEqual(selectLegs("node,build").legs.map((l) => l.name), ["build", "node"]);
  assert.deepEqual(selectLegs("bcc,nope,also-no").unknown, ["nope", "also-no"]);
  assert.equal(selectLegs(undefined).legs.length, LEGS.length);
});

test("each leg prints == name, rc= and its counts; every leg runs past a red one, and the red legs come back named", () => {
  const said = [], ran = [];
  const outputs = { a: "\u001b[32m      Tests  12 passed | 1 skipped (13)\u001b[0m\n   Duration  3s\n", b: "boom\n", c: "ℹ pass 4\nℹ fail 0\n" };
  const legs = ["a", "b", "c"].map((name) => ({ name }));
  const { red } = runLegs(legs, (leg) => { ran.push(leg.name); return { status: leg.name === "b" ? 3 : 0, output: outputs[leg.name] }; }, (l) => said.push(l));
  assert.deepEqual(ran, ["a", "b", "c"]);
  assert.deepEqual(red, ["b (rc=3)"]);
  const text = said.join("\n");
  assert.match(text, /^== a\nrc=0\n {6}Tests {2}12 passed \| 1 skipped \(13\)\n== b\nrc=3\n== c\nrc=0\nℹ pass 4\nℹ fail 0\n/);
  assert.match(text, /battery-legs: 2 green · 1 red: b \(rc=3\)/);
});

test("countsOf reads the tallies a suite or witness prints at its tail, at most three lines", () => {
  assert.deepEqual(countsOf("noise\nbcc-witness: ok 1730 · head-unbound 0 · mismatch 0 · unchecked 0 · torn 0 (of 1730)\n"), ["bcc-witness: ok 1730 · head-unbound 0 · mismatch 0 · unchecked 0 · torn 0 (of 1730)"]);
  assert.deepEqual(countsOf("x\n"), []);
});

test("non-vitest legs use a per-run temporary root while vitest workers mint their own", () => {
  const source = { PATH: "/bin", LAR_BAGS: "/checkout/bags", LAR_ROOT: "/lar" };
  const root = join(tmpdir(), "battery-run-root");
  const env = legEnv(source, root, "shims");
  assert.equal(env.LAR_BAGS, undefined);
  assert.equal(env.LAR_ROOT, root);
  assert.equal(env.PATH, "/bin");
  for (const name of ["mesh", "node", "cli"]) assert.equal(legEnv(source, root, name).LAR_ROOT, undefined, name);
});

test("an unknown leg exits 2 by name before the lock or any leg", () => {
  const d = dir();
  const r = spawnSync(process.execPath, [TOOL, "--legs", "build,nope", "--out", d], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "no-such-dir", "lock") } });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unknown leg: nope/);
});

test("the legs run only under the battery lock: an unopenable lock exits 64 and no leg runs", () => {
  const d = dir();
  const r = spawnSync(process.execPath, [TOOL, "--legs", "bcc", "--out", d], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "no-such-dir", "lock"), LARES_BATTERY_LEGS_HELD: "" } });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /REFUSED/);
  assert.ok(!existsSync(join(d, "bcc.out")), "a leg ran unlocked");
});

test("--list prints each leg and its command, with no lock", () => {
  const d = dir();
  const r = spawnSync(process.execPath, [TOOL, "--list"], { encoding: "utf8", env: { ...process.env, LARES_BATTERY_LOCK: join(d, "no-such-dir", "lock") } });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^build\tbash -c pnpm -r build && node tools\/stamp-build\.mjs \.$/m);
  assert.match(r.stdout, /^genesis\tbash tools\/genesis-parity-witness\.sh$/m);
});
