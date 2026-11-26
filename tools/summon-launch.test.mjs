/**
 * summon-launch.test — the launch cap carries the one wake line and a model, and starts nothing else. Every case injects its
 * spawn: no test starts a model.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { LAUNCH_CAPS, LaunchRefused, launchPlan, run } from "./summon-launch.mjs";

const HASH = "ab".repeat(32);
const LINE = `wake as cold-reader#00002: lares spirit om cold-reader --mandate lar:///ha.ka.ba/kahua/memory/mandate/${HASH.slice(0, 16)}@${HASH}`;

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
  return { calls, spawn };
}
const answer = async (argv, deps) => { const out = []; const exit = await run(argv, { ...deps, out: (l) => out.push(JSON.parse(l)) }); return { exit, out: out[0] }; };

test("claude-cli starts `claude -p <the one line> --model <slug>`, detached, and names its pid", async () => {
  const { calls, spawn } = fakeSpawn();
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE, "--model", "claude-fable-5-2", "--cwd", "/tmp"], { spawn });
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
  assert.deepEqual(launchPlan({ cap: "claude-cli", prompt: `${LINE} --face 1` }).argv, ["-p", `${LINE} --face 1`]);
});

test("the cap passes no permission flag", () => {
  const argv = launchPlan({ cap: "claude-cli", prompt: LINE, model: "opus" }).argv;
  assert.ok(!argv.some((a) => /permission|dangerously/.test(a) && a !== LINE));
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
  const { spawn } = fakeSpawn("spawn claude ENOENT");
  const { exit, out } = await answer(["--cap", "claude-cli", "--prompt", LINE], { spawn });
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
