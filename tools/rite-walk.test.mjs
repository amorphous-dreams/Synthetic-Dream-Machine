// rite-walk.test — the reds the rite walker owes, planted against the runbook's own bytes, stub hands and scratch trees.
// No vessel stands here: the walk itself runs once at each merge (`node tools/rite-walk.mjs --out <dir>`).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { RUNBOOK, STEPS, assertBound, assertScratchRoot, bindSteps, receipt, receiptFaults, riteCommands, riteSlot, verdict, walk } from "./rite-walk/steps.mjs";
import { carrierIdentity, parseArgs } from "./rite-walk.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
const WALKER = join(ROOT, "tools/rite-walk.mjs");
const LIVE = readFileSync(join(ROOT, RUNBOOK), "utf8");
const scratch = () => realpathSync(mkdtempSync(join(tmpdir(), "rite-walk-test-")));
const refuses = (fn, pattern) => assert.throws(fn, (e) => e.name === "RiteWalkRefusal" && pattern.test(e.message), `expected a RiteWalkRefusal matching ${pattern}`);
/** Walk the live join with hands that pass every step they reach; answers the rows and the steps the hands ran. */
async function stubWalk(run = async () => ({ ok: true, answer: "ok" })) {
  const ran = [], stood = [];
  const rows = await walk(assertBound(bindSteps(LIVE)), {
    run: async (step) => { ran.push(step.id); return await run(step); },
    standIn: async (step) => { stood.push(step.id); return "the stub cleared the hearth"; },
    now: () => 0,
  });
  return { rows, ran, stood };
}
const row = (rows, id) => rows.find((r) => r.step === id);

// ── rite-walk-binds-every-line ──────────────────────────────────────────────────────────────────────────────────────

test("rite-walk-binds-every-line: every `lares` command of the rite's fences binds one step, and every step binds a line of the slot", () => {
  const joined = bindSteps(LIVE);
  assert.deepEqual({ unmapped: joined.unmapped, orphans: joined.orphans, unquoted: joined.unquoted }, { unmapped: [], orphans: [], unquoted: [] });
  const commands = riteCommands(LIVE);
  assert.ok(commands.length >= 30, `the probe read ${commands.length} fence commands; the rite carries more`);
  assert.equal(joined.bound.filter((s) => s.fence !== undefined).length, commands.length);
  const slot = riteSlot(LIVE);
  for (const s of joined.bound) assert.ok(s.line >= slot[0].line && s.line <= slot.at(-1).line, `${s.id} binds line ${s.line}, outside the slot`);
  assert.equal(new Set(STEPS.map((s) => s.id)).size, STEPS.length, "step ids repeat");
});

test("rite-walk-binds-every-line: a runbook that gains a `lares` line no step walks reads red, by line and command", () => {
  const fixture = LIVE.replace("lares wiki init notes\n", "lares wiki init notes\nlares frobnicate --now      # a command no step walks\n");
  assert.notEqual(fixture, LIVE);
  const joined = bindSteps(fixture);
  assert.equal(joined.unmapped.length, 1);
  assert.equal(joined.unmapped[0].command, "lares frobnicate --now");
  assert.equal(fixture.split("\n")[joined.unmapped[0].line - 1].startsWith("lares frobnicate"), true);
  refuses(() => assertBound(joined), /unmapped: runbook line \d+ instructs `lares frobnicate --now`/);
});

test("rite-walk-binds-every-line: the walker refuses a drifted runbook before any act (rc 2, no root minted, no receipt)", () => {
  const dir = scratch();
  try {
    const fixture = join(dir, "runbook.mem");
    writeFileSync(fixture, LIVE.replace("lares wiki init notes\n", "lares wiki init notes\nlares frobnicate --now\n"));
    const stage = join(dir, "stage");
    mkdirSync(stage);
    const r = spawnSync(process.execPath, [WALKER, "--runbook", fixture, "--out", join(dir, "out")], { encoding: "utf8", env: { ...process.env, LAR_STAGE_DIR: stage } });
    assert.equal(r.status, 2, r.stderr);
    assert.match(r.stderr, /RiteWalkRefusal: the step table and the runbook disagree/);
    assert.match(r.stderr, /lares frobnicate --now/);
    assert.deepEqual(readdirSync(stage), []);
    assert.equal(existsSync(join(dir, "out")), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rite-walk-binds-every-line: a step whose command the rite dropped reads orphan; an expected answer the rite stopped quoting reads unquoted", () => {
  const dropped = bindSteps(LIVE.replace("lares wiki share notes --list\n", ""));
  assert.deepEqual(dropped.orphans.map((o) => o.step), ["notes-list"]);
  refuses(() => assertBound(dropped), /orphan: step notes-list/);
  const requoted = bindSteps(LIVE.replaceAll("ok — 1 of 1 seats", "ok, one seat"));
  assert.deepEqual(requoted.unquoted.map((u) => u.step), ["promote-open"]);
  refuses(() => assertBound(requoted), /unquoted: step promote-open/);
});

test("CONTROL rite-walk-binds-every-line: a passing stand step names its runbook line and the answer the runbook quotes", async () => {
  const { rows } = await stubWalk();
  const share = row(rows, "share-lares");
  const line = Number(share.runbook.split(":")[1]);
  assert.match(share.runbook, /^founding-runbook\.mem:\d+$/);
  assert.equal(LIVE.split("\n")[line - 1].startsWith("lares wiki share lares --write joshua-fontany-engineer --read joshua-fontany-referee"), true);
  assert.equal(share.outcome, "pass");
  assert.ok(LIVE.includes(share.expect), "the step's expected answer stands in the runbook, verbatim");
});

// ── rite-walk-names-unreached ───────────────────────────────────────────────────────────────────────────────────────

test("rite-walk-names-unreached: the shim's reset, the image and the browser read unreached with their cause, and never run", async () => {
  const { rows, ran, stood } = await stubWalk();
  assert.deepEqual([row(rows, "reset").outcome, row(rows, "reset").cause], ["unreached", "host-shim"]);
  assert.deepEqual([row(rows, "image").outcome, row(rows, "image").cause], ["unreached", "image"]);
  assert.deepEqual([row(rows, "browser").outcome, row(rows, "browser").cause], ["unreached", "browser"]);
  for (const id of ["reset", "image", "browser"]) assert.equal(ran.includes(id), false, `${id} ran`);
  assert.equal(verdict(row(rows, "reset")), "unreached: host-shim");
  assert.deepEqual(stood, ["reset"], "the reset's stand-in keeps the ground for the re-founding, and the row still reads unreached");
  assert.equal(row(rows, "refound").outcome, "pass");
  assert.deepEqual(receiptFaults(rows), []);
});

test("rite-walk-names-unreached: a passphrase ward the staged custody answered reads `pass (staged-custody)`, never a bare pass", async () => {
  const { rows } = await stubWalk();
  const wards = STEPS.filter((s) => s.via === "staged-custody").map((s) => s.id);
  assert.ok(wards.length >= 20, `only ${wards.length} steps name the staged custody`);
  for (const id of ["found", "up", "persona-engineer", "unlock-all", "wear-steward", "lift", "promote-open", "refound"]) assert.ok(wards.includes(id), `${id} names no staged custody`);
  for (const id of wards) assert.equal(verdict(row(rows, id)), "pass (staged-custody)");
  assert.equal(verdict(row(rows, "memory")), "pass (seat-stdio)");
  // Every `vault unlock` and `persona new` of the fences rides the ward.
  for (const s of STEPS.filter((x) => /^lares (vault unlock|persona new|found|up)\b/.test(x.fence ?? ""))) assert.equal(s.via, "staged-custody", s.id);
});

test("rite-walk-names-unreached: a receipt that turns an unreached step into a pass, drops a cause or bares a stand-in reads faults by name", async () => {
  const { rows } = await stubWalk();
  const forged = (id, change) => rows.map((r) => (r.step === id ? { ...r, ...change } : r));
  assert.match(receiptFaults(forged("reset", { outcome: "pass", cause: undefined })).join("\n"), /reset: the table marks it unreached \(host-shim\) and the receipt reads pass/);
  assert.match(receiptFaults(forged("image", { cause: undefined })).join("\n"), /image: unreached and names no cause/);
  assert.match(receiptFaults(forged("found", { via: undefined })).join("\n"), /found: a bare pass over a staged-custody stand-in/);
  assert.match(receiptFaults(rows.filter((r) => r.step !== "export")).join("\n"), /export: the receipt carries no row/);
  assert.match(receiptFaults(forged("seed", { runbook: "founding-runbook.mem" })).join("\n"), /seed: names no runbook line/);
});

test("rite-walk-names-unreached: a step whose ground never stood reads `unreached: blocked:<step>`; hands that cannot reach answer their own cause", async () => {
  const failed = await stubWalk(async (step) => (step.id === "found" ? { ok: false, answer: "the founding refused" } : { ok: true, answer: "ok" }));
  assert.equal(row(failed.rows, "found").outcome, "fail");
  assert.deepEqual([row(failed.rows, "up").outcome, row(failed.rows, "up").cause], ["unreached", "blocked:found"]);
  assert.deepEqual([row(failed.rows, "seed").outcome, row(failed.rows, "seed").cause], ["unreached", "blocked:up"]);
  assert.deepEqual(failed.rows.filter((r) => r.outcome === "pass").map((r) => r.step), []);
  assert.deepEqual(failed.stood, [], "no stand-in clears a hearth the walk never reached");
  assert.equal(row(failed.rows, "reset").cause, "host-shim");
  const thrown = await stubWalk(async (step) => { if (step.id === "seed") throw new Error("the seed threw"); return { ok: true, answer: "ok" }; });
  assert.deepEqual([row(thrown.rows, "seed").outcome, row(thrown.rows, "seed").answer], ["fail", "the seed threw"]);
  const seatless = await stubWalk(async (step) => (step.id === "memory" ? { unreached: "seat-interpreter" } : { ok: true, answer: "ok" }));
  assert.deepEqual([row(seatless.rows, "memory").outcome, row(seatless.rows, "memory").cause], ["unreached", "seat-interpreter"]);
  assert.deepEqual(receiptFaults(seatless.rows), []);
});

test("CONTROL rite-walk-names-unreached: the receipt names the head and the carrier, and its outcome digest moves with an outcome and never with an answer", async () => {
  const { rows } = await stubWalk();
  const inputs = { head: "0".repeat(40), dirty: false, runbook: carrierIdentity(RUNBOOK, LIVE), walker: "sha256:w" };
  const a = receipt({ ...inputs, rows });
  assert.equal(a.kind, "rite-walk-receipt");
  assert.equal(a.inputs.head, "0".repeat(40));
  assert.match(a.inputs.runbook.sha256, /^[0-9a-f]{64}$/);
  assert.match(a.inputs.runbook.bcc, /^ni:\/\/\/sha-256;/);
  assert.equal(a.tally.pass + a.tally.fail + a.tally.unreached, STEPS.length);
  assert.deepEqual([a.tally.unreached, a.tally.fail, a.tally.firstFail], [3, 0, null]);
  const b = receipt({ ...inputs, rows: rows.map((r) => ({ ...r, answer: "another founding minted other ids", ms: 99 })) });
  assert.equal(b.outcomes, a.outcomes);
  const c = receipt({ ...inputs, rows: rows.map((r) => (r.step === "seed" ? { ...r, outcome: "fail" } : r)) });
  assert.notEqual(c.outcomes, a.outcomes);
  assert.equal(c.tally.firstFail, "seed");
  assert.ok(Buffer.byteLength(row((await stubWalk(async () => ({ ok: true, answer: "é".repeat(900) }))).rows, "seed").answer) <= 400);
});

// ── rite-walk-scratch-only ──────────────────────────────────────────────────────────────────────────────────────────

test("rite-walk-scratch-only: a root outside the scratch prefix, in the checkout or in a home refuses by name", () => {
  const dir = scratch();
  try {
    const home = join(dir, "home");
    mkdirSync(join(home, ".lares"), { recursive: true });
    const guard = { checkout: ROOT, home, prefixes: [dir], env: {} };
    refuses(() => assertScratchRoot("/var/lib/lares-rite", guard), /outside every scratch prefix/);
    refuses(() => assertScratchRoot(dir, guard), /outside every scratch prefix/);
    refuses(() => assertScratchRoot(join(ROOT, "scratch-root"), { ...guard, prefixes: [dir, ROOT] }), /overlaps the checkout/);
    refuses(() => assertScratchRoot(join(ROOT, "scratch-root"), guard), /outside every scratch prefix/);
    refuses(() => assertScratchRoot(home, guard), /holds the home/);
    refuses(() => assertScratchRoot(join(home, ".lares", "house"), guard), /stands inside .*\.lares/);
    refuses(() => assertScratchRoot(join(home, ".claude"), guard), /stands inside .*\.claude/);
    refuses(() => assertScratchRoot("", guard), /no root named/);
    refuses(() => assertScratchRoot(join(dir, "r"), { ...guard, prefixes: [] }), /no scratch prefix named/);
    // A link under the prefix that leads into the checkout reads by where it lands.
    symlinkSync(ROOT, join(dir, "link"));
    refuses(() => assertScratchRoot(join(dir, "link", "scratch-root"), guard), /outside every scratch prefix/);
    // A standing directory no harness marked.
    mkdirSync(join(dir, "held"));
    writeFileSync(join(dir, "held", "someone-elses-file"), "x");
    refuses(() => assertScratchRoot(join(dir, "held"), guard), /no \.lar-test-scratch marker/);
    // The canon source and genesis ride the scratch root alone.
    refuses(() => assertScratchRoot(join(dir, "r"), { ...guard, env: { LAR_BAGS: join(ROOT, "bags") } }), /LAR_BAGS stands set/);
    refuses(() => assertScratchRoot(join(dir, "r"), { ...guard, env: { LAR_GENESIS: join(ROOT, "genesis") } }), /LAR_GENESIS stands set/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("CONTROL rite-walk-scratch-only: an unminted path under the prefix and a root a harness marked both pass", () => {
  const dir = scratch();
  try {
    const guard = { checkout: ROOT, home: join(dir, "home"), prefixes: [dir], env: {} };
    assert.equal(assertScratchRoot(join(dir, "fresh"), guard), join(dir, "fresh"));
    mkdirSync(join(dir, "marked"));
    writeFileSync(join(dir, "marked", ".lar-test-scratch"), "staged\n");
    writeFileSync(join(dir, "marked", "genesis"), "x");
    assert.equal(assertScratchRoot(join(dir, "marked"), guard), join(dir, "marked"));
    mkdirSync(join(dir, "empty"));
    assert.equal(assertScratchRoot(join(dir, "empty"), guard), join(dir, "empty"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rite-walk-scratch-only: the walker refuses a root in the checkout or a home before any act (rc 2; nothing minted, staged or written)", () => {
  const dir = scratch();
  try {
    const home = join(dir, "home"), stage = join(dir, "stage");
    mkdirSync(join(home, ".lares"), { recursive: true });
    mkdirSync(stage);
    // LAR_BAGS names the checkout's canon: the walker drops it, and the refusal below still lands before a byte moves.
    const env = { ...process.env, HOME: home, LAR_STAGE_DIR: stage, LAR_BAGS: join(ROOT, "bags") };
    for (const [root, pattern] of [
      [join(ROOT, "scratch-root"), /outside every scratch prefix/],
      [join(home, ".lares"), /outside every scratch prefix|stands inside/],
      ["/var/lib/lares-rite", /outside every scratch prefix/],
    ]) {
      const r = spawnSync(process.execPath, [WALKER, "--root", root, "--out", join(dir, "out")], { encoding: "utf8", env });
      assert.equal(r.status, 2, `${root}: ${r.stderr}`);
      assert.match(r.stderr, /^RiteWalkRefusal: /);
      assert.match(r.stderr, pattern);
      assert.equal(r.stdout, "", "a refused walk ran no step");
    }
    assert.equal(existsSync(join(ROOT, "scratch-root")), false);
    assert.deepEqual(readdirSync(join(home, ".lares")), []);
    assert.deepEqual(readdirSync(stage), []);
    assert.equal(existsSync(join(dir, "out")), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rite-walk-scratch-only: the walker's arguments refuse by name", () => {
  refuses(() => parseArgs(["--out"]), /--out names nothing/);
  refuses(() => parseArgs(["--live"]), /unknown argument --live/);
  assert.deepEqual(parseArgs(["--out", "o", "--to", "seed", "--keep"]), { keep: true, bind: false, out: "o", to: "seed" });
});

// ── the image leg ───────────────────────────────────────────────────────────────────────────────────────────────────

const imageLeg = await import("./rite-walk/image-leg.mjs");
const SCOPE = { base: "/tmp/rite-image-test/base", project: "lares-rehearsal", port: "4399", image: "lares-rehearsal:local", realHome: "/home/someone", checkout: ROOT };

test("image-scope-refuses-the-operators-surface: project, port, image and home each refuse by name before any act", () => {
  const scope = imageLeg.assertImageScope(SCOPE);
  for (const path of [scope.home, scope.house, scope.workspace, scope.envFile, scope.compose, scope.bin, scope.dockerLog]) assert.ok(path.startsWith(`${scope.base}/`), path);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, project: "lares-surface" }), /operator's own surface/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, project: "lares-surface-two" }), /operator's own surface/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, port: "4321" }), /operator's own surface port/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, image: "lares-surface:local" }), /operator's own image/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, image: "lares-surface:other" }), /operator's own image/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, base: "/home/someone" }), /holds the home/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, base: "/home" }), /holds the home/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, base: "/home/someone/.lares/x" }), /stands inside/);
  refuses(() => imageLeg.assertImageScope({ ...SCOPE, base: join(ROOT, "scratch-house") }), /overlaps the checkout/);
  for (const name of ["base", "project", "port", "image"]) refuses(() => imageLeg.assertImageScope({ ...SCOPE, [name]: undefined }), /names nothing/);
});

test("image-compose-copy-names-the-project: the live surface file rewrites its name and its build context once each", () => {
  const live = readFileSync(join(ROOT, "docker-compose.surface.yml"), "utf8");
  const copy = imageLeg.composeCopy(live, { project: "lares-rehearsal", context: "/abs/checkout" });
  assert.match(copy, /^name: lares-rehearsal$/m);
  assert.doesNotMatch(copy, /^name: lares-surface$/m);
  assert.match(copy, /^ {4}context: \/abs\/checkout$/m);
  assert.equal(copy.split("\n").length, live.split("\n").length);
  refuses(() => imageLeg.composeCopy(live.replace(/^name: lares-surface$/m, "name: other"), { project: "p", context: "/c" }), /carries 0/);
  assert.doesNotMatch(imageLeg.surfaceEnvText(imageLeg.assertImageScope(SCOPE), { uid: 1000, gid: 1000 }), /LARES_PULAMA/, "the vessel holds its own custody until the walk stands the pūlama");
  const env = imageLeg.surfaceEnvText(imageLeg.assertImageScope(SCOPE), { uid: 1000, gid: 1000, pulama: true });
  assert.match(env, /^LARES_PORT=4399$/m);
  assert.match(env, /^COMPOSE_PROJECT_NAME=lares-rehearsal$/m);
  assert.match(env, /^LARES_PULAMA=1$/m);
});

test("image-docker-wrapper-holds-the-scope: every call logs, compose carries the project, the operator's names refuse", () => {
  const dir = scratch();
  try {
    const real = join(dir, "real-docker"), wrapper = join(dir, "docker"), log = join(dir, "docker.log");
    // The stand-in engine prints its argv; `container inspect` answers the project label of the container named.
    writeFileSync(real, "#!/bin/sh\nif [ \"$1\" = container ]; then case \"$5\" in mine) echo lares-rehearsal ;; theirs) echo another ;; *) exit 1 ;; esac; exit 0; fi\nprintf 'REAL'; for a in \"$@\"; do printf ' %s' \"$a\"; done; printf '\\n'\n", { mode: 0o755 });
    writeFileSync(wrapper, imageLeg.dockerWrapperText({ real, project: "lares-rehearsal", image: "lares-rehearsal:local", log }), { mode: 0o755 });
    const docker = (...args) => spawnSync(wrapper, args, { encoding: "utf8" });
    assert.equal(docker("compose", "--env-file", "/e", "ps", "-q").stdout.trim(), "REAL compose -p lares-rehearsal --env-file /e ps -q");
    assert.equal(docker("compose", "-p", "lares-rehearsal", "ps").stdout.trim(), "REAL compose -p lares-rehearsal ps");
    assert.equal(docker("image", "inspect", "--format", "{{.Id}}", "lares-rehearsal:local").status, 0);
    assert.equal(docker("inspect", "--format", "{{.State.Status}}", "mine").status, 0);
    const refused = [
      ["compose", "-p", "lares-surface", "ps"], ["compose", "-p", "other", "ps"], ["compose", "ps", "-p", "other"], ["compose", "--project-name=other", "ps"],
      ["image", "inspect", "lares-surface:local"], ["image", "inspect", "node:24-slim"], ["image", "rm", "lares-rehearsal:local"],
      ["rm", "-f", "lares-surface-lares-1"], ["stop", "theirs"], ["exec", "theirs", "sh"], ["run", "--rm", "-p", "127.0.0.1:4321:4321", "x"],
      ["system", "prune"], ["rmi", "lares-rehearsal:local"], ["volume", "rm", "x"], ["ps"],
    ];
    for (const args of refused) { const r = docker(...args); assert.equal(r.status, 97, args.join(" ")); assert.doesNotMatch(r.stdout, /REAL/, args.join(" ")); }
    const lines = readFileSync(log, "utf8").trim().split("\n");
    assert.equal(lines.length, 4 + refused.length, "every call, passed or refused, rests in the log");
    assert.match(lines[0], /\tdocker compose -p lares-rehearsal --env-file \/e ps -q$/);
    assert.equal(lines.filter((l) => l.includes("\tREFUSED (")).length, refused.length);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("image-walk-keeps-the-outcome-law: a blocked step reads unreached, a throw fails, a stand-in never reads a bare pass", async () => {
  const steps = [
    { id: "a", command: "a", via: "pty" }, { id: "b", command: "b", needs: ["a"] }, { id: "c", command: "c" },
    { id: "d", command: "d", needs: ["c"] }, { id: "e", command: "e" },
  ];
  const rows = await imageLeg.walkImage(steps, {
    now: () => 0,
    run: async (step) => {
      if (step.id === "c") throw new Error("the engine never answered");
      if (step.id === "e") return { unreached: "door-absent", answer: "exit 2: unknown command" };
      return { ok: true, answer: "ok", measures: { n: 1 } };
    },
  });
  assert.deepEqual(rows.map((r) => [r.step, verdict(r)]), [["a", "pass (pty)"], ["b", "pass"], ["c", "fail"], ["d", "unreached: blocked:c"], ["e", "unreached: door-absent"]]);
  assert.equal(row(rows, "c").answer, "the engine never answered");
  assert.deepEqual(row(rows, "a").measures, { n: 1 });
  assert.deepEqual(imageLeg.imageReceiptFaults(rows, steps), []);
  assert.match(imageLeg.imageReceiptFaults([{ ...row(rows, "a"), via: undefined }, ...rows.slice(1)], steps).join("\n"), /a: a bare pass over a pty stand-in/);
  assert.match(imageLeg.imageReceiptFaults(rows.slice(1), steps).join("\n"), /a: the receipt carries no row/);
  assert.match(imageLeg.imageReceiptFaults([{ ...row(rows, "d"), cause: undefined }, ...rows.filter((r) => r.step !== "d")], steps).join("\n"), /d: unreached and names no cause/);
});

test("rite-receipt-names-the-definitions-hash: the receipt step hands the door the walker's sha256, never its path", () => {
  const args = imageLeg.receiptArgs("a".repeat(40));
  const defs = args[args.indexOf("--definitions") + 1];
  assert.match(defs, /^[0-9a-f]{64}$/);
  assert.equal(defs, createHash("sha256").update(readFileSync(new URL("./rite-walk/image-leg.mjs", import.meta.url))).digest("hex"));
});
test("image-leg-table-ends-in-teardown, and the line refuses before any act where it names no scope", () => {
  const ids = imageLeg.IMAGE_STEPS.map((s) => s.id);
  assert.equal(ids.at(-1), "teardown");
  assert.equal(new Set(ids).size, ids.length);
  for (const step of imageLeg.IMAGE_STEPS) for (const need of step.needs ?? []) assert.ok(ids.indexOf(need) < ids.indexOf(step.id), `${step.id} needs ${need}, which stands later`);
  assert.equal(imageLeg.IMAGE_STEPS.find((s) => s.id === "teardown").needs, undefined, "teardown waits on nothing");
  refuses(() => imageLeg.parseImageArgs(["--image-leg", "--prune"]), /unknown argument/);
  const bare = spawnSync(process.execPath, [WALKER, "--image-leg", "--out", "/tmp/never"], { encoding: "utf8" });
  assert.equal(bare.status, 2, bare.stderr);
  assert.match(bare.stderr, /--base names nothing/);
  const theirs = spawnSync(process.execPath, [WALKER, "--image-leg", "--base", "/tmp/rite-image-never/base", "--project", "lares-surface", "--port", "4399", "--image", "lares-rehearsal:local", "--out", "/tmp/never"], { encoding: "utf8" });
  assert.equal(theirs.status, 2, theirs.stderr);
  assert.ok(!existsSync("/tmp/rite-image-never"), "a refused line lays no ground");
});

// ── the carry leg ───────────────────────────────────────────────────────────────────────────────────────────────────

const carrySeed = await import("./rite-walk/carry-seed.mjs").catch((e) => ({ missing: e }));
const carryLeg = await import("./rite-walk/carry-leg.mjs").catch((e) => ({ missing: e }));
const present = (mod) => { if (mod.missing) throw mod.missing; return mod; };
const OLD_REV = "983c70580223cc3b10fe151670fe6916f6d60a84";
const PIN = "10a450e887ff72bac2ed54c8e2b10ca126e322b6";
const CANON = {
  still: { uri: "lar:///ha.ka.ba/lares/docs/still-canon", text: "<<^ code=`&#x0001;`>>\n\nstill canon\n\n<<^ code=`&#x0003;`>>\n" },
  moved: { uri: "lar:///ha.ka.ba/lares/docs/moved-canon", text: "<<^ code=`&#x0001;`>>\n\nmoved canon\n\n<<^ code=`&#x0003;`>>\n" },
  kapae: { uri: "lar:///ha.ka.ba/lares/docs/shadowed-canon" },
};
/** A scratch home holding the one rehearsal prefix the carry scope allows. */
function carryHome() {
  const home = scratch();
  return { home, base: join(home, ".lares-scratch", "rehearsal", "carry") };
}
const carryOpts = (over = {}) => {
  const { home, base } = carryHome();
  return { base, project: "lares-rehearsal", port: "4399", image: "lares-rehearsal:local", "from-rev": OLD_REV, realHome: home, checkout: ROOT, ...over };
};

test("carry-seed-keys-every-stage-row: each stage meme carries `row-key` equal to its title path, and the plan replays byte-equal", () => {
  const { seedPlan, rowKeyOf, STAGE_PREFIX, INDEX_ROWS } = present(carrySeed);
  const plan = seedPlan({ count: 40, canon: CANON });
  assert.equal(JSON.stringify(plan), JSON.stringify(seedPlan({ count: 40, canon: CANON })), "the generator is deterministic");
  const rows = Object.values(plan.faces).flat();
  const staged = rows.filter((r) => r.uri.startsWith(STAGE_PREFIX));
  assert.ok(staged.length >= 40 + 6 + 15 + 10, `${staged.length} stage rows`);
  for (const r of staged) {
    const key = r.uri.slice(STAGE_PREFIX.length);
    assert.equal(rowKeyOf(r.text), key, `${r.uri} carries its title path as its row key`);
    assert.match(key, /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  const ids = rows.map((r) => `${r.face} ${r.recipe} ${r.uri}`);
  assert.equal(new Set(ids).size, ids.length, "no row stands twice");
  assert.equal(INDEX_ROWS.length, 6);
  for (const ix of INDEX_ROWS) {
    const r = plan.faces[0].find((x) => x.uri === `${STAGE_PREFIX}${ix.key}`);
    assert.ok(r, `index row ${ix.key}`);
    assert.match(r.text, /"stage\/index"/);
  }
  const kinds = new Set(rows.map((r) => r.kind));
  for (const k of ["index", "stage", "margin", "page", "working-still", "working-moved", "non-nfc"]) assert.ok(kinds.has(k), `a ${k} row`);
  const edges = new Set(plan.edges.map((e) => e.kind));
  for (const k of ["wiki-init", "wiki-share", "bag-share", "kahua-lift", "kahua-staged", "kapae", "temp-consent", "library", "sensorium"]) assert.ok(edges.has(k), `a ${k} edge`);
  // The kāpae rides the tiddler door, which answers the worn face's daemon wiki (`--recipe default`) alone; the carry
  // manifest carries the shadow from that face's working layer.
  for (const e of plan.edges.filter((x) => x.kind === "kapae")) assert.equal(e.recipe, "default", "the kapae edge plans the one recipe the tiddler door answers");
  assert.ok(rows.some((r) => Buffer.byteLength(r.text) >= 480 * 1024), "one body probes the size edge");
  assert.ok(rows.filter((r) => /slot=`#\/note-/.test(r.text)).length >= 12, "twelve rows carry ahu slots");
  assert.ok(rows.filter((r) => /ʻ/.test(r.text)).length >= 5, "five rows carry non-ASCII");
  assert.ok(rows.some((r) => r.kind === "non-nfc" && r.text !== r.text.normalize("NFC")), "one row stands outside NFC");
  assert.deepEqual(plan.expectedStandoff, [], "no row owes a stand-off: an override base works as an instrument, never a gate");
  assert.deepEqual(plan.expectedFresher, { bag: "lares", titles: [CANON.moved.uri], quiet: [CANON.still.uri] }, "the copy over moved canon is the one fresher warning the new house owes; the still one stays quiet");
});

test("carry-seed-shares-stand-apart: no slug takes a share of two kinds, the shared bag stands minted and unshared as a wiki, and each share names faces by pet-name", () => {
  const { seedPlan, PETNAMES } = present(carrySeed);
  const plan = seedPlan({ count: 40, canon: CANON });
  const shares = plan.edges.filter((e) => e.kind === "wiki-share" || e.kind === "bag-share").map((e) => ({ kind: e.kind === "wiki-share" ? "wiki" : "bag", slug: e.slug ?? e.bag, names: [...e.read, ...(e.write ?? [])] }));
  const slugs = shares.map((s) => s.slug);
  assert.equal(new Set(slugs).size, slugs.length, `one share row per slug (the share config keys by slug alone): ${slugs.join(", ")}`);
  for (const b of shares.filter((s) => s.kind === "bag")) {
    assert.ok(plan.edges.some((e) => e.kind === "wiki-init" && e.slug === b.slug), `the shared bag ${b.slug} stands minted (wiki init) before its share`);
    assert.ok(Object.values(plan.faces).flat().some((r) => r.recipe === b.slug), `the shared bag ${b.slug} holds a page, so the carry moves a bag-shared wiki's working layer (its readers hold the bag alone, never that layer)`);
  }
  for (const s of shares) for (const n of s.names) assert.ok(PETNAMES.includes(n), `${s.kind} ${s.slug} names ${n}, a pet-name`);
});

test("carry-shares-read-back: the share doors take one pet-name per word, and the seed's rows read back by kind from `bag share --list`, a collided or waiting row faulting", () => {
  const { shareArgs, judgeShares } = present(carryLeg);
  const wiki = { kind: "wiki-share", slug: "cold-shelf", write: [], read: ["joshua-fontany-referee"] };
  const bag = { kind: "bag-share", bag: "lending-shelf", read: ["joshua-fontany-engineer", "joshua-fontany-referee"] };
  const notes = { kind: "wiki-share", slug: "notes", write: ["joshua-fontany-engineer"], read: ["joshua-fontany-referee"] };
  assert.deepEqual(shareArgs(bag), ["bag", "share", "lending-shelf", "--read", "joshua-fontany-engineer joshua-fontany-referee", "--no-json"]);
  assert.deepEqual(shareArgs(notes), ["wiki", "share", "notes", "--write", "joshua-fontany-engineer", "--read", "joshua-fontany-referee", "--no-json"]);
  const edges = [wiki, bag, notes];
  const good = [
    "bag lending-shelf: read joshua-fontany-engineer (h1), joshua-fontany-referee (h2) · write (none named)",
    "wiki cold-shelf: read joshua-fontany-referee (h2) · write (none named)",
    "wiki notes: read joshua-fontany-engineer (h1), joshua-fontany-referee (h2) · write joshua-fontany-engineer (h1)",
  ].join("\n");
  assert.deepEqual(judgeShares({ code: 0, text: good }, edges), { ok: true, faults: [] });
  // The collision walk 9b met: the bag row replaced the wiki row of one slug.
  const collided = judgeShares({ code: 0, text: "bag cold-shelf: read (none named) · write (none named)\n  waits: \"joshua-fontany-engineer,joshua-fontany-referee\" names no face here; it lands when a face carries that pet-name" }, [wiki]);
  assert.equal(collided.ok, false);
  assert.match(collided.faults.join("; "), /wiki cold-shelf reads as bag cold-shelf/);
  // A reader the row never resolved (a comma-joined name, a name no face carries) faults by name.
  const waiting = judgeShares({ code: 0, text: "bag lending-shelf: read (none named) · write (none named)\n  waits: \"joshua-fontany-engineer,joshua-fontany-referee\" names no face here; it lands when a face carries that pet-name" }, [bag]);
  assert.match(waiting.faults.join("; "), /bag lending-shelf never resolves joshua-fontany-engineer/);
  assert.match(waiting.faults.join("; "), /bag lending-shelf waits on "joshua-fontany-engineer,joshua-fontany-referee"/);
  assert.match(judgeShares({ code: 0, text: good }, [{ kind: "bag-share", bag: "absent", read: ["x"] }]).faults.join("; "), /bag absent stands in no row/);
  assert.match(judgeShares({ code: 2, text: "boom" }, edges).faults.join("; "), /exited 2/);
});

test("carry-seed-sweep: the sweep strips the one `row-key` line and leaves every other byte", () => {
  const { stageMemeText, sweepRowKey, rowKeyOf } = present(carrySeed);
  const text = stageMemeText("project/house-laws", "the laws", { tags: ["stage/semantic", "stage/index"], description: "house laws" });
  const swept = sweepRowKey(text);
  assert.equal(swept.key, "project/house-laws");
  assert.equal(rowKeyOf(swept.text), null);
  assert.equal(swept.text, text.replace('row-key = "project/house-laws"\n', ""));
  assert.throws(() => sweepRowKey(swept.text), /carries no row-key/);
  const flipped = present(carryLeg).tamperOne(Buffer.from("abc"));
  assert.notDeepEqual(flipped, Buffer.from("abc"));
  assert.equal(flipped.length, 3);
});

test("carry-scope-holds-the-rehearsal: the base stands under ~/.lares-scratch/rehearsal/, the image scope holds, the old revision names a full sha", () => {
  const { assertCarryScope } = present(carryLeg);
  const opts = carryOpts();
  const scope = assertCarryScope(opts);
  for (const p of [scope.houseOld, scope.houseNew, scope.oldSrc, scope.newSrc, scope.workspaceOld, scope.workspaceNew, scope.composeOld, scope.composeNew, scope.census])
    assert.ok(p.startsWith(`${scope.base}/`), `${p} stands beneath the base`);
  assert.notEqual(scope.houseOld, scope.houseNew);
  refuses(() => assertCarryScope({ ...opts, base: join(opts.realHome, ".lares-scratch", "elsewhere") }), /\.lares-scratch\/rehearsal/);
  refuses(() => assertCarryScope({ ...opts, port: "4321" }), /operator's own surface port/);
  refuses(() => assertCarryScope({ ...opts, image: "lares-surface:local" }), /operator's own image/);
  refuses(() => assertCarryScope({ ...opts, "from-rev": undefined }), /--from-rev/);
  refuses(() => assertCarryScope({ ...opts, "from-rev": "983c70580" }), /full sha/);
});

test("carry-standoff-reads-a-named-set: the import's stand-offs judge against the plan's set, never against a bare exit code", () => {
  {
    // The kāpae edge shadows a canon meme family: the door call names the family act, the kapae mode and the daemon wiki.
    const { kapaeArgs } = present(carryLeg);
    const argv = kapaeArgs({ title: "lar:///ha.ka.ba/lares/docs/art-sigils", recipe: "default" });
    for (const f of ["--family", "--recipe", "default", "--mode", "kapae"]) assert.ok(argv.includes(f), `the kapae call carries ${f}`);
  }
  {
    // The source export names the wikis no island mounts at that instant: one the steward woke at hold-old projected its
    // pages, so its cold-wikis and its working bag's override-bases omissions read excused BY NAME; an unwoken one reads red.
    const { judgeExport } = present(carryLeg);
    const ok0 = { code: 0, stdout: "" };
    const cold = (items) => ({ kind: "cold-wikis", items, count: items.length, detail: `${items.join(", ")} stand cold` });
    const bases = (bag) => ({ kind: "override-bases-unread", detail: `the daemon's override-bases read did not answer for ${bag} (wiki not mounted): …` });
    const woke = judgeExport(ok0, { data: { omissions: [cold(["lares"]), bases("lar:///ha.ka.ba/wikis/lares/working"), { kind: "parallel-drafts" }] } }, { woken: ["lares", "notes", "cold-shelf"] });
    assert.equal(woke.ok, true, JSON.stringify(woke.faults));
    assert.deepEqual(woke.excused.map((e) => e.kind).sort(), ["cold-wikis", "override-bases-unread"]);
    const unwoken = judgeExport(ok0, { data: { omissions: [cold(["works"])] } }, { woken: ["lares"] });
    assert.equal(unwoken.ok, false);
    assert.match(unwoken.faults.join(" "), /cold-wikis.*works/, "a red omission quotes its detail");
    const strayBag = judgeExport(ok0, { data: { omissions: [bases("lar:///ha.ka.ba/wikis/works/working")] } }, { woken: ["lares"] });
    assert.equal(strayBag.ok, false, "an override-bases omission over an unwoken wiki's bag reads red");
  }
  {
    // hold-old wakes EVERY wiki the house lists (the ruled rite: each wiki in turn), the canon wikis beside the seeded ones;
    // the daemon never takes a pin, and an unreadable list wakes nothing rather than a guessed set.
    const { wikisToWake } = present(carryLeg);
    const listed = { ok: true, data: { wikis: [{ slug: "notes" }, { slug: "lararium" }, { slug: "lares" }, { slug: "daemon" }, { slug: "cold-shelf" }] } };
    assert.deepEqual(wikisToWake(listed), ["cold-shelf", "lararium", "lares", "notes"]);
    assert.equal(wikisToWake(null), null);
  }
  const { judgeImport } = present(carryLeg);
  const moved = CANON.moved.uri;
  const tallies = (stoodOff = [], refused = []) => ({ memes: { landed: 3, already: 0, planned: 0, waiting: 0, stoodOff, refused } });
  const ok = judgeImport([{ code: 1, json: { ok: false, error: { code: "conflict" }, data: { applied: true, tallies: tallies([`${moved} (canon moved)`]), waiting: [] } } }], { expectedStandoff: [moved] });
  assert.equal(ok.ok, true, ok.faults.join("; "));
  const missed = judgeImport([{ code: 0, json: { ok: true, data: { tallies: tallies(), waiting: [] } } }], { expectedStandoff: [moved] });
  assert.equal(missed.ok, false);
  assert.match(missed.faults.join("; "), /expected stand-off .*moved-canon.* never stood off/);
  const extra = judgeImport([{ code: 1, json: { data: { tallies: tallies([`${moved} (x)`, "lar:///ha.ka.ba/other (y)"]), waiting: [] } } }], { expectedStandoff: [moved] });
  assert.match(extra.faults.join("; "), /unexpected stand-off lar:\/\/\/ha\.ka\.ba\/other/);
  const refused = judgeImport([{ code: 1, json: { data: { tallies: tallies([`${moved} (x)`], ["lar:///r (no)"]), waiting: [] } } }], { expectedStandoff: [moved] });
  assert.match(refused.faults.join("; "), /refused/);
  const waiting = judgeImport([{ code: 1, json: { data: { tallies: tallies([`${moved} (x)`]), waiting: [{ face: "f2" }] } } }], { expectedStandoff: [moved] });
  assert.match(waiting.faults.join("; "), /waiting/);
  // A refusal the plan seeded (the non-NFC record the source house holds) reads excused by its uri; another refusal stays red.
  const nfc = "lar:///ha.ka.ba/kahua/memory/research/non-nfc";
  const seeded = judgeImport([{ code: 4, json: { data: { applied: true, tallies: tallies([`${moved} (x)`], [`${nfc} (non-NFC bytes)`]), waiting: [] } } }], { expectedStandoff: [moved], expectedRefused: [nfc] });
  assert.equal(seeded.ok, true, seeded.faults.join("; "));
  assert.deepEqual(seeded.excusedRefused, [`memes: ${nfc} (non-NFC bytes)`]);
  const both = judgeImport([{ code: 4, json: { data: { applied: true, tallies: tallies([`${moved} (x)`], [`${nfc} (non-NFC bytes)`, "lar:///r (no)"]), waiting: [] } } }], { expectedStandoff: [moved], expectedRefused: [nfc] });
  assert.match(both.faults.join("; "), /1 row\(s\) refused: memes: lar:\/\/\/r/);
  const never = judgeImport([{ code: 0, json: { data: { applied: true, tallies: tallies([`${moved} (x)`]), waiting: [] } } }], { expectedStandoff: [moved], expectedRefused: [nfc] });
  assert.match(never.faults.join("; "), /expected refusal .*non-nfc never refused/);
  const unread = judgeImport([{ code: 2, json: null }], { expectedStandoff: [] });
  assert.match(unread.faults.join("; "), /answered no JSON/);
});

test("carry-fresher-reads-the-warning: the copy over moved canon lands and the new house warns it fresher; the still copy stays quiet", () => {
  const { judgeFresher, CARRY_STEPS } = present(carryLeg);
  const moved = CANON.moved.uri, still = CANON.still.uri;
  const read = (lines, code = 0) => ({ code, text: lines.join("\n") });
  const fresh = { bag: "lares", titles: [moved], quiet: [still] };
  const head = "fresher: 1 working copy over lar:///ha.ka.ba/bags/lares shadow a fresher canon record (base -> canon now):";
  const ok = judgeFresher(read([head, `  ${moved}  sha256:aaaa… -> sha256:bbbb…`]), fresh);
  assert.equal(ok.ok, true, ok.faults.join("; "));
  assert.deepEqual(ok.listed, [moved]);
  assert.match(judgeFresher(read(["fresher: no working copy over lar:///ha.ka.ba/bags/lares shadows a fresher canon record"]), fresh).faults.join("; "), /expected fresher .*moved-canon.* never warned/);
  assert.match(judgeFresher(read(["fresher: 2 …", `  ${moved}  a -> b`, `  ${still}  a -> c`]), fresh).faults.join("; "), /unexpected fresher .*still-canon/);
  assert.match(judgeFresher(read(["lares vessel fresher: cap-denied"], 2), fresh).faults.join("; "), /exited 2/);
  assert.equal(judgeFresher(read(["fresher: no working copy over lar:///ha.ka.ba/bags/lares shadows a fresher canon record"]), { titles: [], quiet: [still] }).ok, true, "a plan that owes no warning reads a quiet house green");
  // THE SECOND CLASS: a copy that names no base and differs from canon reads `base unknown`, apart from the fresher class.
  const none = "fresher: no working copy over lar:///ha.ka.ba/bags/lares shadows a fresher canon record";
  const unknownHead = "fresher: 2 working copies over lar:///ha.ka.ba/bags/lares name no base and differ from canon (base unknown; review each, it may hide fresher canon):";
  const doubt = { bag: "lares", titles: [], unknown: [moved, still], quiet: [] };
  const u = judgeFresher(read([none, unknownHead, `  ${moved}  base unknown -> sha256:bbbb…`, `  ${still}  base unknown -> sha256:cccc…`]), doubt);
  assert.equal(u.ok, true, u.faults.join("; "));
  assert.deepEqual(u.listed, [], "a base-unknown line never reads as a fresher warning");
  assert.deepEqual(u.unknown, [moved, still]);
  assert.match(judgeFresher(read([none]), doubt).faults.join("; "), /expected base-unknown .*moved-canon.* never named/);
  assert.match(judgeFresher(read([none, unknownHead, `  ${moved}  base unknown -> b`]), fresh).faults.join("; "), /expected fresher .*moved-canon.* never warned/, "a base-unknown line does not answer a fresher expectation");
  assert.match(judgeFresher(read([head, `  ${moved}  a -> b`, unknownHead, `  ${still}  base unknown -> c`]), fresh).faults.join("; "), /unexpected base-unknown .*still-canon/, "a quiet title stays in neither class");
  // The read runs as its own step, after every face imported and before the re-import.
  const ids = CARRY_STEPS.map((s) => s.id);
  const step = CARRY_STEPS.find((s) => s.id === "fresher");
  assert.ok(step, "a fresher step stands");
  assert.ok(step.needs.includes("import-apply") && ids.indexOf("fresher") === ids.indexOf("import-apply") + 1, "the fresher read follows the three imports");
  assert.match(step.command, /lares vessel fresher --bag/);
});

test("carry-fresher-plan-reads-the-bundle: a working row that carries its override base owes the fresher warning; one that carries none owes the base-unknown class", () => {
  const { fresherPlanFor } = present(carryLeg);
  const moved = CANON.moved.uri, still = CANON.still.uri;
  const want = { bag: "lares", titles: [moved], quiet: [still] };
  const rowOf = (uri, base) => ({ path: `wikis/lares/working/${uri.slice("lar:///".length)}.mem`, layer: "wiki-working", ...(base ? { overrideBase: base } : {}) });
  const based = fresherPlanFor(want, { rows: [rowOf(moved, `sha256:${"a".repeat(64)}`), rowOf(still, `sha256:${"b".repeat(64)}`)] });
  assert.deepEqual(based, { bag: "lares", titles: [moved], unknown: [], quiet: [still], faults: [] }, "a house that stamped bases: moved warns, still stays quiet");
  // A bundle whose working rows carry no base: each copy carries the rehearsal's paragraph, so each differs from the
  // canon standing below it and the new house names both for review; neither reads quiet.
  const bare = fresherPlanFor(want, { rows: [rowOf(moved), rowOf(still)] });
  assert.deepEqual(bare, { bag: "lares", titles: [], unknown: [moved, still], quiet: [], faults: [] });
  const missing = fresherPlanFor(want, { rows: [rowOf(still)] });
  assert.match(missing.faults.join("; "), /carries no working row for .*moved-canon/);
  assert.equal(fresherPlanFor(null, { rows: [] }), null);
});

test("carry-fresher-step-reads-at-the-steward: the step wears face 0 and reads `vessel fresher --bag <plan bag>`; a plan with no expectation reads nothing", async () => {
  const { CARRY_STEPS, assertCarryScope } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  mkdirSync(scope.base, { recursive: true });
  const moved = CANON.moved.uri;
  const answer = (kind, args) => {
    const line = [args].flat().map(String).join(" ");
    if (/vault status/.test(line)) return { code: 0, stdout: '{"ok":true,"data":{"unlocked":true,"wears":0}}', stderr: "" };
    if (/vessel fresher/.test(line)) return { code: 0, stdout: `fresher: 1 working copy over lar:///ha.ka.ba/bags/lares shadow a fresher canon record (base -> canon now):\n  ${moved}  a -> b\n`, stderr: "" };
    return { code: 0, stdout: "{}", stderr: "" };
  };
  const step = CARRY_STEPS.find((s) => s.id === "fresher");
  // The bundle the import read: the moved copy's row carries its base, the still copy's too.
  const bundleDir = join(scope.houseNew, "config", "carry", "pre-merge");
  mkdirSync(bundleDir, { recursive: true });
  const rowOf = (uri) => ({ path: `wikis/lares/working/${uri.slice("lar:///".length)}.mem`, layer: "wiki-working", overrideBase: `sha256:${"a".repeat(64)}` });
  writeFileSync(join(bundleDir, "manifest.json"), JSON.stringify({ rows: [rowOf(moved), rowOf(CANON.still.uri)] }));
  const { c, calls } = recordingCarry(scope, { answer, vars: { oldRev: OLD_REV, pin: PIN, expectedFresher: { bag: "lares", titles: [moved], quiet: [CANON.still.uri] } } });
  const r = await step.run(c);
  assert.equal(r.ok, true, r.answer);
  const fresherCall = calls.find((k) => k.args.join(" ").includes("vessel fresher"));
  assert.ok(fresherCall && fresherCall.phase === "new", "the read runs in the new house");
  assert.deepEqual(fresherCall.args.slice(-3), ["fresher", "--bag", "lares"]);
  assert.ok(calls.some((k) => /vault unlock --face 0/.test(k.args.join(" "))), "the steward wears for the read");
  const none = recordingCarry(scope, { answer, vars: { oldRev: OLD_REV, pin: PIN } });
  const skipped = await step.run(none.c);
  assert.equal(skipped.ok, true);
  assert.equal(none.calls.length, 0, "a plan that names no fresher expectation reads nothing");
});

test("carry-teardown-holds-a-kept-base: under --keep the teardown step takes the containers down and leaves the base standing; without it the base clears", async () => {
  const { CARRY_STEPS } = present(carryLeg);
  const step = CARRY_STEPS.find((s) => s.id === "teardown");
  const run = async (keep) => {
    const asked = [];
    const c = { scope: { newSrc: "/nonexistent-new-src", image: "img" }, vars: { keep }, hands: () => ({ teardown: async (o = {}) => { asked.push(o); return { downCode: 0, containers: "", baseStands: o.keepBase === true, log: [] }; } }) };
    return { r: await step.run(c), asked, vars: c.vars };
  };
  const kept = await run(true);
  assert.deepEqual(kept.asked, [{ keepBase: true }]);
  assert.equal(kept.r.ok, true, kept.r.answer);
  assert.match(kept.r.answer, /the base stands \(kept\)/);
  assert.equal(kept.vars.baseKept, true);
  const cleared = await run(false);
  assert.deepEqual(cleared.asked, [{ keepBase: false }]);
  assert.equal(cleared.r.ok, true, cleared.r.answer);
  assert.notEqual(cleared.vars.baseKept, true);
});

test("carry-meme-text-rides-raw: the walker's meme reads ask the text alone (`--no-json`), since a get with no terminal on stdout answers the JSON envelope and a put of that envelope refuses (`1 line(s) stand between ETX and EOT`)", () => {
  const { memeGetArgs, sweepScript } = present(carryLeg);
  assert.deepEqual(memeGetArgs("lar:///ha.ka.ba/kahua/memory/ruling/2026-11-14"), ["meme", "get", "lar:///ha.ka.ba/kahua/memory/ruling/2026-11-14", "--recipe", "default", "--no-json"]);
  const script = sweepScript("node packages/lares-cli/bin/lares.mjs");
  assert.match(script, /meme get "\$u" --recipe default --no-json > \/tmp\/sweep\.mem/);
  assert.match(script, /meme put "\$u" --recipe default --file \/tmp\/sweep\.mem --json/);
  assert.match(script, /SWEPT \$n BAD \$bad/);
});

test("carry-table-keeps-the-order: census before down, no reset step, no accept-loss typed, teardown last", () => {
  const { CARRY_STEPS, CARRY_SAYS } = present(carryLeg);
  const ids = CARRY_STEPS.map((s) => s.id);
  assert.equal(ids.at(-1), "teardown");
  assert.equal(new Set(ids).size, ids.length);
  for (const step of CARRY_STEPS) for (const need of step.needs ?? []) assert.ok(ids.indexOf(need) >= 0 && ids.indexOf(need) < ids.indexOf(step.id), `${step.id} needs ${need}, which stands later or nowhere`);
  assert.ok(!ids.some((id) => /reset/.test(id)), "the leg walks no reset");
  assert.ok(ids.indexOf("census-old") < ids.indexOf("down-old"), "the old census comes before down");
  assert.ok(ids.indexOf("export") < ids.indexOf("down-old"));
  const down = CARRY_STEPS.find((s) => s.id === "down-old");
  assert.ok(down.needs.includes("census-old") && down.needs.includes("export"), "down waits on the census and the export");
  for (const [name, says] of Object.entries(CARRY_SAYS)) for (const s of says) assert.notEqual(s.answer, "accept-loss", `${name} types accept-loss`);
  assert.deepEqual(ids.slice(0, ids.indexOf("persona-1") + 1), ["src-old", "build-old", "stage-custody-old", "found-old", "up-old", "seed-canon-old", "persona-1"], "a probe to persona-1 walks the old phase alone");
});

/** Hands that answer every call with `answer(kind, args)` and record each one. */
function recordingCarry(scope, { answer = () => ({ code: 0, stdout: "{}", stderr: "" }), vars = {} } = {}) {
  const calls = [];
  const hand = (phase) => {
    const rec = (kind) => async (args, opts = {}) => { calls.push({ phase, kind, args: [args].flat().map(String), says: opts.says ?? [] }); return { ms: 1, typed: true, ...answer(kind, args, opts) }; };
    return {
      scope, vars, env: {}, checkout: phase === "old" ? scope.oldSrc : scope.newSrc,
      shim: rec("shim"), compose: rec("compose"), docker: rec("docker"),
      pty: rec("pty"), shimLine: (args) => `shim ${args.join(" ")}`, said: (r) => `${r.stdout}\n${r.stderr}`,
      cid: async () => "", head: () => (phase === "old" ? vars.oldRev : vars.pin), stage() {}, async proveScope() { return "ok"; },
      dockerLog: () => [], async teardown() { return { downCode: 0, containers: "", baseStands: false, log: [] }; }, async close() {},
    };
  };
  const hands = { old: hand("old"), new: hand("new") };
  return {
    calls,
    c: {
      scope, vars, say: () => {},
      hands: (phase) => hands[phase],
      git: async (args) => { calls.push({ phase: "host", kind: "git", args: args.map(String), says: [] }); return { code: 0, stdout: answer("git", args).stdout ?? "", stderr: "" }; },
      node: async (args) => { calls.push({ phase: "host", kind: "node", args: args.map(String), says: [] }); const a = answer("node", args); return { code: a.code ?? 0, stdout: a.stdout ?? "{}", stderr: a.stderr ?? "" }; },
    },
  };
}

test("carry-hands-never-type-accept-loss-nor-reset: every step run against recording hands asks for neither, nor --accept-omissions", async () => {
  const { CARRY_STEPS, assertCarryScope } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  mkdirSync(scope.base, { recursive: true });
  const { c, calls } = recordingCarry(scope, { vars: { oldRev: OLD_REV, pin: PIN, expectedStandoff: [] } });
  for (const step of CARRY_STEPS) { try { await step.run(c); } catch { /* a fake answer may break a step; its calls stand recorded */ } }
  const flat = calls.map((k) => [...k.args, ...k.says.map((s) => s.answer)].join(" "));
  assert.ok(calls.length > 0);
  for (const line of flat) {
    assert.doesNotMatch(line, /\baccept-loss\b/, line);
    assert.doesNotMatch(line, /--accept-omissions/, line);
    assert.doesNotMatch(line, /(^|\s)reset(\s|$)/, line);
  }
  rmSync(scope.base, { recursive: true, force: true });
});

test("carry-down-refuses-a-loss: a `down` that asks for accept-loss reads fail and types nothing", async () => {
  const { CARRY_STEPS, assertCarryScope } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  const { c, calls } = recordingCarry(scope, { answer: (kind) => (kind === "pty" ? { code: 124, stdout: "the census reads 3 unsettled\nType accept-loss to stop anyway: ", typed: true } : { code: 0, stdout: "", stderr: "" }) });
  const result = await CARRY_STEPS.find((s) => s.id === "down-old").run(c);
  assert.equal(result.ok, false);
  assert.match(result.answer, /accept-loss/);
  const down = calls.find((k) => k.kind === "pty");
  assert.deepEqual(down.says, [], "the down types no answer at all");
});

test("carry-pinned-sha-holds: the new phase clones the pinned sha, never the head that moved, and a resume refuses another pin", async () => {
  const { CARRY_STEPS, assertCarryScope, carryState } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  const MOVED = "f".repeat(40);
  const { c, calls } = recordingCarry(scope, { vars: { oldRev: OLD_REV, pin: PIN }, answer: (kind, args) => (kind === "git" && args.includes("rev-parse") ? { stdout: `${MOVED}\n` } : { code: 0, stdout: "", stderr: "" }) });
  try { await CARRY_STEPS.find((s) => s.id === "src-new").run(c); } catch { /* the fake tree never stands */ }
  const checkout = calls.find((k) => k.kind === "git" && k.args.includes("checkout"));
  assert.ok(checkout, "src-new checks a revision out");
  assert.ok(checkout.args.includes(PIN), `checks out ${checkout.args.join(" ")}`);
  assert.ok(!calls.some((k) => k.args.includes(MOVED)), "the moved head never enters a clone");
  const kept = { vars: { pin: PIN, oldRev: OLD_REV }, rows: [], legs: [] };
  assert.equal(carryState({ kept, pin: undefined, head: MOVED, oldRev: OLD_REV }).vars.pin, PIN, "a resume keeps the pin it started under");
  refuses(() => carryState({ kept, pin: MOVED, head: MOVED, oldRev: OLD_REV }), /pinned/);
  assert.equal(carryState({ kept: null, pin: undefined, head: MOVED, oldRev: OLD_REV }).vars.pin, MOVED, "a fresh walk pins the head it starts at");
});

test("carry-leg-line-refuses-before-any-act: no scope, the operator's project, or no old revision each read rc 2 and lay no ground", () => {
  const bare = spawnSync(process.execPath, [WALKER, "--carry-leg", "--out", "/tmp/never"], { encoding: "utf8" });
  assert.equal(bare.status, 2, bare.stderr);
  assert.match(bare.stderr, /--base names nothing/);
  const theirs = spawnSync(process.execPath, [WALKER, "--carry-leg", "--base", "/tmp/rite-carry-never/base", "--project", "lares-surface", "--port", "4399", "--image", "lares-rehearsal:local", "--from-rev", OLD_REV, "--out", "/tmp/never"], { encoding: "utf8" });
  assert.equal(theirs.status, 2, theirs.stderr);
  assert.ok(!existsSync("/tmp/rite-carry-never"), "a refused line lays no ground");
  refuses(() => present(carryLeg).parseCarryArgs(["--carry-leg", "--prune"]), /unknown argument/);
});

test("image-hands-take-a-checkout: the hands a phase runs with name the clone they stand on, and the image leg's helpers export", () => {
  const scope = imageLeg.assertImageScope(SCOPE);
  const h = imageLeg.imageHands(scope, { vars: {} }, { checkout: "/abs/old-src" });
  assert.equal(h.checkout, "/abs/old-src");
  assert.match(h.shimLine(["up"]), /^\/abs\/old-src\/tools\/lares-container\.sh up$/);
  assert.equal(imageLeg.imageHands(scope, { vars: {} }).checkout, ROOT);
  for (const name of ["build", "stageCustody", "found", "upOwn", "lastJson", "unlockedOf", "UNLOCK_SAYS", "WARD_SAYS", "TEST_PASSPHRASE", "tail", "refusal"]) assert.ok(imageLeg[name] !== undefined, `image-leg exports ${name}`);
});

test("carry-parity-contract: an import that never applied reads a fault; compare hands the parity each import answer and each named stand-off; the carried house lights", async () => {
  const { judgeImport, compareArgs, CARRY_STEPS } = present(carryLeg);
  const moved = CANON.moved.uri;
  const t = { memes: { landed: 1, already: 0, planned: 0, waiting: 0, stoodOff: [`${moved} (x)`], refused: [] } };
  assert.equal(judgeImport([{ code: 1, json: { data: { applied: true, tallies: t, waiting: [] } } }], { expectedStandoff: [moved] }).ok, true);
  assert.match(judgeImport([{ code: 1, json: { data: { applied: false, tallies: t, waiting: [] } } }], { expectedStandoff: [moved] }).faults.join("; "), /never applied/);
  const args = compareArgs({ old: ["o0.json", "o1.json"], fresh: ["n0.json"], base: ["b0.json"], imports: ["i0.json", "i1.json"], standOff: [moved], manifest: "m.json", out: "r.json" });
  assert.deepEqual(args.slice(0, 1), ["compare"]);
  for (const [flag, value] of [["--old", "o1.json"], ["--new", "n0.json"], ["--base", "b0.json"], ["--imports", "i1.json"], ["--stand-off", moved], ["--manifest", "m.json"]]) {
    assert.ok(args.some((a, i) => a === flag && args[i + 1] === value), `${flag} ${value}`);
  }
  assert.ok(args.includes("--json") && args[args.indexOf("--out") + 1] === "r.json");
  const ids = CARRY_STEPS.map((s) => s.id);
  for (const id of ["pulama-up", "pulama-light", "up-by-pulama"]) assert.ok(ids.indexOf(id) > ids.indexOf("parity") && ids.indexOf(id) < ids.indexOf("teardown"), `${id} lights the carried house after parity`);
});

test("carry-persona-prompts-pinned: the new-face prompts the probe met at 983c70580 pin the leg's answers and its prompt reading", () => {
  const { PERSONA_SAYS, promptsOf } = present(carryLeg);
  // Measured 2026-11-16 on the source image (probe to persona-1), the route redacted.
  const met = "Face h1 takes a route of its own, apart from this vessel's. Lose it and this face's sealed state opens for no one.\r\nA founding seals the vessel's custody from birth and binds a HUMAN ROUTE to it. Lose every route and the sealed state opens for no one; keep the passphrase or the paper safe.\r\nbind [p]assphrase, [s]heet (paper pin), [b]oth (p): p\r\nnew passphrase: \r\nnew passphrase (confirm): \r\npersona h1 minted";
  assert.deepEqual(PERSONA_SAYS.map((s) => s.prompt), ["bind [p]assphrase, [s]heet (paper pin), [b]oth (p): ", "new passphrase: ", "new passphrase (confirm): "]);
  assert.deepEqual(promptsOf(met), ["bind [p]assphrase, [s]heet (paper pin), [b]oth (p):", "new passphrase:", "new passphrase (confirm):"]);
  let at = 0;
  for (const s of PERSONA_SAYS) { const i = met.indexOf(s.prompt, at); assert.ok(i >= 0, `the leg types after ${JSON.stringify(s.prompt)}`); at = i + s.prompt.length; }
});

// ── the carry leg keeps the source house ────────────────────────────────────────────────────────────────────────────

test("carry-keeps-the-source-house: the keep stands between the export and the down, and the new phase may import from a fresh clone of the keep's remote", () => {
  const { CARRY_STEPS, KEEP_WORKSPACE, assertCarryScope, phaseScope, parseCarryArgs } = present(carryLeg);
  const ids = CARRY_STEPS.map((s) => s.id);
  for (const id of ["keep-lei-old", "keep-old", "keep-clone-new"]) assert.ok(ids.includes(id), `the table walks ${id}`);
  assert.ok(ids.indexOf("export") < ids.indexOf("keep-lei-old") && ids.indexOf("keep-lei-old") < ids.indexOf("keep-old") && ids.indexOf("keep-old") < ids.indexOf("down-old"), "export, then the keep lei, then the keep, then down");
  assert.ok(ids.indexOf("keep-clone-new") < ids.indexOf("found-new"), "the clone stands before the new house founds from it");
  const cmd = (id) => CARRY_STEPS.find((s) => s.id === id).command;
  assert.match(cmd("keep-lei-old"), new RegExp(`lares lei kui --rite keep --branch ${KEEP_WORKSPACE} --returns 2`));
  assert.match(cmd("keep-old"), new RegExp(`lares rite keep --workspace ${KEEP_WORKSPACE}`));
  assert.ok(!CARRY_STEPS.find((s) => s.id === "down-old").needs.includes("keep-old"), "a source revision with no keep rite still walks its down");
  const scope = assertCarryScope(carryOpts());
  assert.equal(phaseScope(scope, "old").workspaces, `${KEEP_WORKSPACE}=${scope.keepWs}`, "the old house binds the keep workspace at its up");
  assert.equal(phaseScope(scope, "new").workspaces, undefined);
  assert.match(imageLeg.surfaceEnvText(phaseScope(scope, "old"), { uid: 1, gid: 1 }), new RegExp(`^LARES_WORKSPACES=${KEEP_WORKSPACE}=`, "m"));
  assert.doesNotMatch(imageLeg.surfaceEnvText(phaseScope(scope, "new"), { uid: 1, gid: 1 }), /LARES_WORKSPACES/);
  assert.equal(parseCarryArgs(["--carry-leg", "--import-from", "keep"])["import-from"], "keep");
  refuses(() => parseCarryArgs(["--carry-leg", "--import-from", "elsewhere"]), /--import-from/);
});

test("carry-keep-reads-par: the lei strings under the ward, the keep pushes to the scratch remote and conferre reads its tessera par; a red tessera fails; a source with no keep rite reads unreached", async () => {
  const { CARRY_STEPS, KEEP_WORKSPACE, assertCarryScope } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  const T = "7".repeat(64), B = "b".repeat(64);
  const step = (id) => CARRY_STEPS.find((s) => s.id === id);
  const keepAnswer = (par) => JSON.stringify({ ok: par, data: { rite: "keep", workspace: KEEP_WORKSPACE, kept: true, tessera: T, bundleId: B, pushed: true, landed: [{ tessera: T, par }], par } });
  const answers = (par) => (kind, args) => {
    const line = [args].flat().join(" ");
    if (kind === "pty" && /lei kui --rite keep/.test(line)) return { code: 0, stdout: JSON.stringify({ ok: true, data: { rite: "keep", branch: KEEP_WORKSPACE, returns: 2 } }) };
    if (kind === "shim" && /lei show --rite keep/.test(line)) return { code: 0, stdout: JSON.stringify({ ok: true, data: { lei: { standing: true, returnsLeft: 2 } } }) };
    if (kind === "node" && /rite keep --workspace/.test(line)) return { code: par ? 0 : 1, stdout: keepAnswer(par) };
    if (kind === "shim" && /rite receipts/.test(line)) return { code: 0, stdout: JSON.stringify({ ok: true, data: { conferre: par ? { par: [{ tessera: T, rite: "keep", par: true }], red: [] } : { par: [], red: [{ tessera: T, rite: "keep", red: "landed-absent" }] } } }) };
    return { code: 0, stdout: "{}", stderr: "" };
  };
  const good = recordingCarry(scope, { answer: answers(true), vars: { oldRev: OLD_REV, pin: PIN } });
  const lei = await step("keep-lei-old").run(good.c);
  assert.equal(lei.ok, true, lei.answer);
  const kui = good.calls.find((k) => k.kind === "pty" && k.args.join(" ").includes("lei kui --rite keep"));
  assert.ok(kui.says.length > 0 && kui.says.every((s) => s.answer !== "accept-loss"), "the ward's prompt gets the published route");
  const kept = await step("keep-old").run(good.c);
  assert.equal(kept.ok, true, kept.answer);
  assert.equal(good.c.vars.keep.tessera, T);
  assert.equal(good.c.vars.keep.bundleId, B);
  const keepCall = good.calls.find((k) => k.kind === "node" && k.args.includes("keep"));
  assert.ok(keepCall.args.includes("--workspace") && keepCall.args.includes(KEEP_WORKSPACE), keepCall.args.join(" "));
  const red = recordingCarry(scope, { answer: answers(false), vars: { oldRev: OLD_REV, pin: PIN } });
  assert.equal((await step("keep-old").run(red.c)).ok, false, "a keep whose tessera reads red fails");
  const old = recordingCarry(scope, { answer: (kind) => (kind === "pty" || kind === "shim" ? { code: 2, stdout: "", stderr: "lares lei: name a sub-verb: show, kui, unstring or restring" } : { code: 0, stdout: "{}" }), vars: { oldRev: OLD_REV, pin: PIN } });
  assert.equal((await step("keep-lei-old").run(old.c)).unreached, "door-absent", "a source revision that strings no keep lei reads unreached by name");
});

test("carry-import-from-keep: under --import-from keep the import reads the fresh clone of the keep's remote, never the copied bundle", async () => {
  const { CARRY_STEPS, assertCarryScope, KEEP_CLONE_IN } = present(carryLeg);
  const scope = assertCarryScope(carryOpts());
  // The steward stands worn (the status reads unlocked, wearing face 0), so the preview reaches its import.
  const { c, calls } = recordingCarry(scope, { answer: () => ({ code: 0, stdout: JSON.stringify({ unlocked: true, wears: 0 }), stderr: "" }), vars: { oldRev: OLD_REV, pin: PIN, importFrom: "keep", keep: { bundleId: "b".repeat(64) } } });
  try { await CARRY_STEPS.find((s) => s.id === "import-preview").run(c); } catch { /* the fake tree never stands */ }
  const imports = calls.filter((k) => k.args.join(" ").includes(" import ") || k.args[0] === "import");
  assert.ok(imports.length > 0, "the preview runs an import");
  for (const k of imports) assert.ok(k.args.join(" ").includes(KEEP_CLONE_IN), k.args.join(" "));
  const clone = recordingCarry(scope, { vars: { oldRev: OLD_REV, pin: PIN, keep: { bundleId: "b".repeat(64) } } });
  try { await CARRY_STEPS.find((s) => s.id === "keep-clone-new").run(clone.c); } catch { /* the fake clone never stands */ }
  const cloned = clone.calls.find((k) => k.kind === "git" && k.args.includes("clone"));
  assert.ok(cloned && cloned.args.includes(scope.keepRemote), "the clone reads the keep's scratch remote");
});

