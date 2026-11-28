/**
 * summon-launch.test — the launch cap carries the one wake line, a model and the tool rules a mandate names (none of its own), and starts nothing else. Every case
 * injects its spawn, its directory read and its log open: no test starts a model or writes a log. The wake line welds to the
 * mesh core: this suite imports the built core's patterns (`@lararium/mesh/spirit-summons`, from dist) and holds the tool's to them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ALLOWED_TOOLS, LAUNCH_CAPS, LaunchRefused, WAKE_LINE, launchPlan, run } from "./summon-launch.mjs";
import * as core from "../packages/lararium-mesh/dist/spirit-summons.js";

const HASH = "ab".repeat(32);
const LINE = `wake as cold-reader#00002: lares spirit om cold-reader mandate=lar:///ha.ka.ba/kahua/memory/mandate/${HASH.slice(0, 16)}@${HASH}`;

/** A spawn that records its call and stands (or fails) on the next tick. */
function fakeSpawn(fail = null) {
  const calls = [];
  const spawn = (bin, argv, opts) => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.unref = () => { child.unrefed = true; };
    calls.push({ bin, argv, opts, child });
    queueMicrotask(() => (fail === null ? child.emit("spawn") : child.emit("error", new Error(fail))));
    return child;
  };
  return { calls, spawn, holdsDir: () => true };
}
const answer = async (argv, deps) => { const out = []; const exit = await run(argv, { ...deps, out: (l) => out.push(JSON.parse(l)) }); return { exit, out: out[0] }; };

test("claude-cli starts `claude -p <the one line> --model <slug>`, detached, and names its pid", async () => {
  const { calls, ...deps } = fakeSpawn();
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--model", "claude-fable-5-2", "--cwd", "/tmp"], deps);
  assert.equal(exit, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].bin, "claude");
  assert.deepEqual(calls[0].argv, ["-p", LINE, "--model", "claude-fable-5-2"]);
  assert.equal(calls[0].opts.detached, true);
  assert.equal(calls[0].opts.cwd, "/tmp");
  assert.equal(calls[0].opts.env.LARES_SUMMONED, "cold-reader#00002");
  assert.equal(calls[0].child.unrefed, true);
  assert.deepEqual(out, { ok: true, cap: "claude-cli", pid: 4242, argv: ["claude", "-p", LINE, "--model", "claude-fable-5-2"] });
});

test("a mandate naming no model passes no --model; a face rides the line", () => {
  assert.deepEqual(launchPlan({ cap: "claude-cli", prompt: `${LINE} face=1` }).argv, ["-p", `${LINE} face=1`]);
});

test("a launch naming no allowed tools passes no permission flag at all", () => {
  const argv = launchPlan({ cap: "claude-cli", prompt: LINE, model: "opus" }).argv;
  assert.deepEqual(argv, ["-p", LINE, "--model", "opus"]);
  assert.ok(!argv.some((a) => /allowed|permission|dangerously/i.test(a) && a !== LINE));
});

test("the allowed tools a mandate names ride the argv exactly, once", async () => {
  const { calls, ...deps } = fakeSpawn();
  const rules = "Bash(lares:*),Read";
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--allowed-tools", rules, "--model", "opus", "--cwd", "/tmp"], deps);
  assert.equal(exit, 0);
  assert.deepEqual(calls[0].argv, ["-p", LINE, "--allowedTools", rules, "--model", "opus"]);
  assert.deepEqual(out.argv, ["claude", "-p", LINE, "--allowedTools", rules, "--model", "opus"]);
});

test("a malformed allowed-tools value refuses by name with its cure, and nothing starts", async () => {
  for (const rules of ["--dangerously-skip-permissions", "Bash(lares:*) --permission-mode bypassPermissions", "Bash(a(b))", "Bash(lares:*),", "", "Bash(x)\nRead"]) {
    const { calls, ...deps } = fakeSpawn();
    const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--allowed-tools", rules], deps);
    assert.equal(exit, 2, rules);
    assert.equal(out.code, "launch-allowed-tools-malformed");
    assert.match(out.message, /lares spirit mandate .* allowed-tools=/);
    assert.doesNotMatch(out.message, /\b(is|are|was|were|be|been|being|am)\b/);
    assert.equal(calls.length, 0);
  }
});

test("the allowed-tools pattern welds to the mesh core's", () => {
  assert.equal(core.ALLOWED_TOOLS.source, ALLOWED_TOOLS.source);
  assert.equal(core.ALLOWED_TOOLS.flags, ALLOWED_TOOLS.flags);
});

test("the wake line welds to the mesh core: one pattern, imported from the built core", () => {
  assert.equal(core.WAKE_LINE.source, WAKE_LINE.source);
  assert.equal(WAKE_LINE.flags, "");
  assert.equal(core.WAKE_LINE.flags, "");
});

test("a workdir the host holds none of refuses launch-workdir-absent, and nothing starts", async () => {
  const { calls, spawn } = fakeSpawn();
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--cwd", "/srv/none"], { spawn, holdsDir: () => false });
  assert.equal(exit, 2);
  assert.equal(out.code, "launch-workdir-absent");
  assert.match(out.message, /workdir=\/absolute\/path/);
  assert.equal(calls.length, 0);
});

test("the instance's stream appends to the log the launch names; a log that takes no append refuses and starts nothing", async () => {
  const opened = [];
  const { calls, ...deps } = fakeSpawn();
  const { exit } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--cwd", "/tmp", "--log", "/srv/logs/a.log"], { ...deps, openLog: (file) => { opened.push(file); return "ignore"; } });
  assert.equal(exit, 0);
  assert.deepEqual(opened, ["/srv/logs/a.log"]);
  assert.deepEqual(calls[0].opts.stdio, ["ignore", "ignore", "ignore"]);
  const shut = fakeSpawn();
  const refused = await answer(["--cap", "claude-cli", "--prompt", LINE, "--cwd", "/tmp", "--log", "/srv/logs/a.log"], { spawn: shut.spawn, holdsDir: () => true, openLog: () => { throw new Error("EACCES"); } });
  assert.equal(refused.exit, 2);
  assert.equal(refused.out.code, "launch-log-unwritable");
  assert.match(refused.out.message, /log=\/absolute\/file/);
  assert.equal(shut.calls.length, 0);
});

test("any prompt past the one line refuses, and nothing starts", async () => {
  for (const prompt of [`${LINE}\nand also read this brief`, "do the task", `${LINE} --dangerously-skip-permissions`, LINE.replace("om cold-reader", "om other-pet"), LINE.replace(HASH, "abc")]) {
    const { calls, spawn } = fakeSpawn();
    const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", prompt], { spawn });
    assert.equal(exit, 2, prompt);
    assert.equal(out.code, "launch-prompt-malformed");
    assert.match(out.message, /lares spirit summon/, "the refusal names its cure");
    assert.equal(calls.length, 0);
  }
});

test("an unknown cap and a flag-shaped model refuse by name", () => {
  assert.throws(() => launchPlan({ cap: "codex-exec", prompt: LINE }), (e) => e instanceof LaunchRefused && e.code === "launch-cap-unknown" && e.message.includes(Object.keys(LAUNCH_CAPS)[0]));
  assert.throws(() => launchPlan({ cap: "claude-cli", prompt: LINE, model: "--dangerously-skip-permissions" }), (e) => e.code === "launch-model-malformed");
  assert.throws(() => launchPlan({ cap: "__proto__", prompt: LINE }), (e) => e.code === "launch-cap-unknown");
});

test("a host with no such binary answers launch-cap-absent", async () => {
  const { spawn, holdsDir } = fakeSpawn("spawn claude ENOENT");
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE], { spawn, holdsDir });
  assert.equal(exit, 2);
  assert.equal(out.code, "launch-cap-absent");
  assert.match(out.message, /command -v claude/);
});

test("--dry-run prints the argv and spawns nothing", async () => {
  const { calls, spawn } = fakeSpawn();
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--dry-run"], { spawn });
  assert.equal(exit, 0);
  assert.deepEqual(out.argv, ["claude", "-p", LINE]);
  assert.equal(calls.length, 0);
});

test("the refusals carry no copula", () => {
  for (const make of [() => launchPlan({ cap: "x", prompt: LINE }), () => launchPlan({ cap: "claude-cli", prompt: "x" }), () => launchPlan({ cap: "claude-cli", prompt: LINE, model: "-x" })]) {
    try { make(); assert.fail("refuses"); } catch (e) { assert.doesNotMatch(e.message, /\b(is|are|was|were|be|been|being|am)\b/); }
  }
});
