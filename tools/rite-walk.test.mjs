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
  assert.match(receiptFaults(forged("lay", { runbook: "founding-runbook.mem" })).join("\n"), /lay: names no runbook line/);
});

test("rite-walk-names-unreached: a step whose ground never stood reads `unreached: blocked:<step>`; hands that cannot reach answer their own cause", async () => {
  const failed = await stubWalk(async (step) => (step.id === "found" ? { ok: false, answer: "the founding refused" } : { ok: true, answer: "ok" }));
  assert.equal(row(failed.rows, "found").outcome, "fail");
  assert.deepEqual([row(failed.rows, "up").outcome, row(failed.rows, "up").cause], ["unreached", "blocked:found"]);
  assert.deepEqual([row(failed.rows, "lay").outcome, row(failed.rows, "lay").cause], ["unreached", "blocked:up"]);
  assert.deepEqual(failed.rows.filter((r) => r.outcome === "pass").map((r) => r.step), []);
  assert.deepEqual(failed.stood, [], "no stand-in clears a hearth the walk never reached");
  assert.equal(row(failed.rows, "reset").cause, "host-shim");
  const thrown = await stubWalk(async (step) => { if (step.id === "lay") throw new Error("the lay threw"); return { ok: true, answer: "ok" }; });
  assert.deepEqual([row(thrown.rows, "lay").outcome, row(thrown.rows, "lay").answer], ["fail", "the lay threw"]);
  const seatless = await stubWalk(async (step) => (step.id === "memory" ? { unreached: "seat-interpreter" } : { ok: true, answer: "ok" }));
  assert.deepEqual([row(seatless.rows, "memory").outcome, row(seatless.rows, "memory").cause], ["unreached", "seat-interpreter"]);
  assert.deepEqual(receiptFaults(seatless.rows), []);
});

// ── rite-walk-wears-what-stood ──────────────────────────────────────────────────────────────────────────────────────

const ATTACH_CAUSE = "[vessel-host] fault while waiting for ea: manifest handler threw: WorkingLayerAttachRefusal: [daemon] WorkingLayerAttachRefusal: working layer \"lar:///ha.ka.ba/wikis/daemon/working\" could not attach (" + "the cause the walker must carry whole ".repeat(20) + "); start the vessel again";
const switchRefusedAnswer = (wears) => ({ op: "unlock", reading: "already-unlocked", wears, standing: "hearth", held: true, switchRefused: ATTACH_CAUSE, face: 2, wornAgain: 1 });
const runStep = (id, answer) => STEPS.find((s) => s.id === id).run({ vars: {}, wear: async () => answer });

test("rite-walk-wears-what-stood: a wear whose switch refused fails the step, whatever face the frame names", async () => {
  for (const id of ["wear-referee", "hold-wear-referee", "lay-wear-referee"]) {
    for (const wears of [2, 1]) assert.equal((await runStep(id, switchRefusedAnswer(wears))).ok, false, `${id} passed over a refused switch (wears ${wears})`);
  }
});

test("CONTROL rite-walk-wears-what-stood: a wear that stood the asked face passes", async () => {
  assert.equal((await runStep("lay-wear-referee", { op: "unlock", reading: "already-unlocked", wears: 2, standing: "hearth", held: true })).ok, true);
});

test("rite-walk-wears-what-stood: a refused switch's cause rides the row whole, past the answer's cut", async () => {
  const step = STEPS.find((s) => s.id === "lay-wear-referee");
  const [r] = await walk([{ ...step, needs: [], line: 1 }], { run: (s) => s.run({ vars: {}, wear: async () => switchRefusedAnswer(1) }), now: () => 0 });
  assert.equal(r.outcome, "fail");
  assert.ok(Buffer.byteLength(r.answer) <= 400, "the answer keeps its cut");
  assert.equal(r.refusal, ATTACH_CAUSE);
});

test("rite-walk-wears-what-stood: a refused act's words ride whole, and a pass carries no refusal", async () => {
  const long = { op: "unlock", reading: "opens", held: false, refused: ATTACH_CAUSE };
  const [failed, passed] = await walk([{ id: "a", line: 1 }, { id: "b", line: 2 }], {
    run: async (s) => (s.id === "a" ? { ok: false, answer: `the engineer never stood worn: ${JSON.stringify(long)}` } : { ok: true, answer: "ok" }), now: () => 0,
  });
  assert.equal(failed.refusal, ATTACH_CAUSE);
  assert.equal("refusal" in passed, false);
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
  const c = receipt({ ...inputs, rows: rows.map((r) => (r.step === "lay" ? { ...r, outcome: "fail" } : r)) });
  assert.notEqual(c.outcomes, a.outcomes);
  assert.equal(c.tally.firstFail, "lay");
  assert.ok(Buffer.byteLength(row((await stubWalk(async () => ({ ok: true, answer: "é".repeat(900) }))).rows, "lay").answer) <= 400);
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
  assert.deepEqual(parseArgs(["--out", "o", "--to", "lay", "--keep"]), { keep: true, bind: false, out: "o", to: "lay" });
});

// ── the image leg ───────────────────────────────────────────────────────────────────────────────────────────────────

const imageLeg = await import("./rite-walk/image-leg.mjs");
const SCOPE = { base: "/tmp/rite-image-test/base", project: "lares-image-walk", port: "4377", image: "lares-image-walk:local", realHome: "/home/someone", checkout: ROOT };

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
  const copy = imageLeg.composeCopy(live, { project: "lares-image-walk", context: "/abs/checkout" });
  assert.match(copy, /^name: lares-image-walk$/m);
  assert.doesNotMatch(copy, /^name: lares-surface$/m);
  assert.match(copy, /^ {4}context: \/abs\/checkout$/m);
  assert.equal(copy.split("\n").length, live.split("\n").length);
  refuses(() => imageLeg.composeCopy(live.replace(/^name: lares-surface$/m, "name: other"), { project: "p", context: "/c" }), /carries 0/);
  assert.doesNotMatch(imageLeg.surfaceEnvText(imageLeg.assertImageScope(SCOPE), { uid: 1000, gid: 1000 }), /LARES_PULAMA/, "the vessel holds its own custody until the walk stands the pūlama");
  const env = imageLeg.surfaceEnvText(imageLeg.assertImageScope(SCOPE), { uid: 1000, gid: 1000, pulama: true });
  assert.match(env, /^LARES_PORT=4377$/m);
  assert.match(env, /^COMPOSE_PROJECT_NAME=lares-image-walk$/m);
  assert.match(env, /^LARES_PULAMA=1$/m);
});

test("image-docker-wrapper-holds-the-scope: every call logs, compose carries the project, the operator's names refuse", () => {
  const dir = scratch();
  try {
    const real = join(dir, "real-docker"), wrapper = join(dir, "docker"), log = join(dir, "docker.log");
    // The stand-in engine prints its argv; `container inspect` answers the project label of the container named.
    writeFileSync(real, "#!/bin/sh\nif [ \"$1\" = container ]; then case \"$5\" in mine) echo lares-image-walk ;; theirs) echo another ;; *) exit 1 ;; esac; exit 0; fi\nprintf 'REAL'; for a in \"$@\"; do printf ' %s' \"$a\"; done; printf '\\n'\n", { mode: 0o755 });
    writeFileSync(wrapper, imageLeg.dockerWrapperText({ real, project: "lares-image-walk", image: "lares-image-walk:local", log }), { mode: 0o755 });
    const docker = (...args) => spawnSync(wrapper, args, { encoding: "utf8" });
    assert.equal(docker("compose", "--env-file", "/e", "ps", "-q").stdout.trim(), "REAL compose -p lares-image-walk --env-file /e ps -q");
    assert.equal(docker("compose", "-p", "lares-image-walk", "ps").stdout.trim(), "REAL compose -p lares-image-walk ps");
    assert.equal(docker("image", "inspect", "--format", "{{.Id}}", "lares-image-walk:local").status, 0);
    assert.equal(docker("inspect", "--format", "{{.State.Status}}", "mine").status, 0);
    const refused = [
      ["compose", "-p", "lares-surface", "ps"], ["compose", "-p", "other", "ps"], ["compose", "ps", "-p", "other"], ["compose", "--project-name=other", "ps"],
      ["image", "inspect", "lares-surface:local"], ["image", "inspect", "node:24-slim"], ["image", "rm", "lares-image-walk:local"],
      ["rm", "-f", "lares-surface-lares-1"], ["stop", "theirs"], ["exec", "theirs", "sh"], ["run", "--rm", "-p", "127.0.0.1:4321:4321", "x"],
      ["system", "prune"], ["rmi", "lares-image-walk:local"], ["volume", "rm", "x"], ["ps"],
    ];
    for (const args of refused) { const r = docker(...args); assert.equal(r.status, 97, args.join(" ")); assert.doesNotMatch(r.stdout, /REAL/, args.join(" ")); }
    const lines = readFileSync(log, "utf8").trim().split("\n");
    assert.equal(lines.length, 4 + refused.length, "every call, passed or refused, rests in the log");
    assert.match(lines[0], /\tdocker compose -p lares-image-walk --env-file \/e ps -q$/);
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
  const theirs = spawnSync(process.execPath, [WALKER, "--image-leg", "--base", "/tmp/rite-image-never/base", "--project", "lares-surface", "--port", "4377", "--image", "lares-image-walk:local", "--out", "/tmp/never"], { encoding: "utf8" });
  assert.equal(theirs.status, 2, theirs.stderr);
  assert.ok(!existsSync("/tmp/rite-image-never"), "a refused line lays no ground");
});

test("image-light-seats-a-served-vessel: the image leg's operator admits the image the host reported at up (`pulama-admit`, its route typed) before its unlock-by-pulama reads the vessel served", () => {
  const { IMAGE_STEPS } = imageLeg;
  const ids = IMAGE_STEPS.map((s) => s.id);
  for (const [a, b] of [["up-by-pulama", "pulama-admit"], ["pulama-admit", "unlock-by-pulama"], ["unlock-by-pulama", "teardown"]]) assert.ok(ids.indexOf(a) >= 0 && ids.indexOf(a) < ids.indexOf(b), `${a} before ${b}`);
  const admit = IMAGE_STEPS.find((s) => s.id === "pulama-admit");
  assert.ok(admit.needs.includes("up-by-pulama") && admit.via === "pty" && /operator/.test(admit.command), "the admission names the operator's route");
  assert.ok(IMAGE_STEPS.find((s) => s.id === "unlock-by-pulama").needs.includes("pulama-admit"));
});

test("pulama-admit-names-the-lent-set: the admission names no face and the pūlama admits every lit face; named ordinals ride the line as a set (pulama-hand.ts admit)", () => {
  const { pulamaAdmitArgs } = imageLeg;
  assert.deepEqual(pulamaAdmitArgs(), ["pulama", "admit"]);
  assert.deepEqual(pulamaAdmitArgs([0, 2]), ["pulama", "admit", "0", "2"]);
});

test("image-hands-stand-on-the-checkout: the hands name the checkout they stand on, and the shim line runs the checkout's own shim", () => {
  const scope = imageLeg.assertImageScope(SCOPE);
  const h = imageLeg.imageHands(scope, { vars: {} });
  assert.equal(h.checkout, ROOT);
  assert.equal(h.shimLine(["up"]), `${ROOT}/tools/lares-container.sh up`);
});
