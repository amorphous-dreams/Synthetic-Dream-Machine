import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beginStep, leadStepBrief, readState, stepDirName, validateState, writeState } from "./lane-state.mjs";

const good = () => ({ head: "e6aa31a8e", owed: ["row 4", "row 5"], seats: [{ name: "b3", mode: "build", dir: "/lane/cop3" }], worktrees: { wt: "feature/x" }, next: "write the broker red tests", step: 0, trailers: ["Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", "Claude-Session: https://claude.ai/code/session_01TEST"] });
const lane = () => mkdtempSync(join(tmpdir(), "lane-"));

test("validateState accepts the whole shape and refuses by name: unknown key, missing key, bad head, bad seat, non-string owed, negative step", () => {
  assert.doesNotThrow(() => validateState(good()));
  assert.throws(() => validateState({ ...good(), extra: 1 }), /unknown key "extra"/);
  const { next, ...rest } = good();
  assert.throws(() => validateState(rest), /missing key "next"/);
  assert.throws(() => validateState({ ...good(), head: "zz" }), /head/);
  assert.throws(() => validateState({ ...good(), seats: [{ name: "b" }] }), /seat/);
  assert.throws(() => validateState({ ...good(), owed: [3] }), /owed/);
  assert.throws(() => validateState({ ...good(), step: -1 }), /step/);
  assert.throws(() => validateState({ ...good(), worktrees: { a: 1 } }), /worktrees/);
  assert.throws(() => validateState(null), /object/);
});

test("writeState then readState round-trips; a write leaves no temp file; a bad state writes nothing", () => {
  const root = lane();
  writeState(root, good());
  assert.deepEqual(readState(root), good());
  assert.deepEqual(readdirSync(root), ["state.json"]);
  assert.throws(() => writeState(root, { ...good(), head: "no" }), /head/);
  assert.deepEqual(readState(root), good(), "a refused write leaves the old state");
});

test("readState names a missing, torn or invalid file instead of reading it as empty", () => {
  const root = lane();
  assert.throws(() => readState(root), /no state\.json/);
  writeFileSync(join(root, "state.json"), "{not json");
  assert.throws(() => readState(root), /state\.json.*(JSON|parse)/i);
  writeFileSync(join(root, "state.json"), JSON.stringify({ head: "abc1234" }));
  assert.throws(() => readState(root), /missing key/);
});

test("beginStep bumps the step counter, persists it, and names a fresh step dir each time; the dir name is zero-padded", () => {
  const root = lane();
  writeState(root, good());
  const a = beginStep(root), b = beginStep(root);
  assert.equal(a.state.step, 1);
  assert.equal(b.state.step, 2);
  assert.equal(readState(root).step, 2);
  assert.equal(a.stepDir, join(root, "steps", "step-001"));
  assert.equal(b.stepDir, join(root, "steps", "step-002"));
  assert.equal(stepDirName(12), "steps/step-012");
});

test("leadStepBrief carries the head, every owed row, the live seats, the worktree map, the next step and the one-step law with the state path", () => {
  const root = lane();
  const text = leadStepBrief(good(), { laneRoot: root, stepDir: join(root, "steps", "step-001") });
  for (const need of ["e6aa31a8e", "row 4", "row 5", "b3", "/lane/cop3", "feature/x", "write the broker red tests", join(root, "state.json"), "ONE step", "40 tool calls", "out.md", "never poll"]) assert.ok(text.includes(need), need);
});

test("validateState refuses a seat with an extra or empty field, and an empty next, head-ward strings and worktree paths", () => {
  assert.throws(() => validateState({ ...good(), seats: [{ name: "b", mode: "build", dir: "/d", extra: 1 }] }), /seat/);
  assert.throws(() => validateState({ ...good(), seats: [{ name: "", mode: "build", dir: "/d" }] }), /seat/);
  assert.throws(() => validateState({ ...good(), next: "" }), /next/);
  assert.throws(() => validateState({ ...good(), worktrees: { a: "" } }), /worktrees/);
});

test("validateState refuses missing, empty or malformed commit trailers: each one line of the shape Key: value", () => {
  const { trailers, ...rest } = good();
  assert.throws(() => validateState(rest), /missing key "trailers"/);
  assert.throws(() => validateState({ ...good(), trailers: [] }), /trailers/);
  assert.throws(() => validateState({ ...good(), trailers: ["no colon here"] }), /trailers/);
  assert.throws(() => validateState({ ...good(), trailers: ["Co-Authored-By: a\nClaude-Session: b"] }), /trailers/);
  assert.throws(() => validateState({ ...good(), trailers: ["Key:"] }), /trailers/);
});

test("leadStepBrief carries the lane's commit trailers verbatim, one per line, under COMMIT TRAILERS", () => {
  const root = lane();
  const text = leadStepBrief(good(), { laneRoot: root, stepDir: join(root, "steps", "step-001") });
  assert.match(text, /## COMMIT TRAILERS[^\n]*\nCo-Authored-By: Claude Opus 5\.5 <noreply@anthropic\.com>\nClaude-Session: https:\/\/claude\.ai\/code\/session_01TEST\n/);
});
