/*
 * The familiar's hooks (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum): the pure parts of `lares-spirit-core.mjs`, then
 * each hook spawned whole against a stub shim that logs its argv, fed the harness's stdin shapes. Every hook exits 0.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  handbackPetOf, omContext, petOf, roundAsk, stateDirOf, statePathOf, stopStep, trueUpText, TRUE_UP_EVERY,
} from "../.claude-plugin/hooks/lares-spirit-core.mjs";

const sourceDir = resolve(import.meta.dirname, "..", ".claude-plugin", "hooks");

test("the pure parts", async (t) => {
  await t.test("a pet name rides argv[2], and a malformed one reads as none", () => {
    assert.equal(petOf(["node", "hook", "lares-alpha"]), "lares-alpha");
    assert.equal(petOf(["node", "hook", "Bad Name"]), null);
    assert.equal(petOf(["node", "hook"]), null);
  });
  await t.test("the wake context carries om's text, or names the read that cures a fault", () => {
    assert.equal(omContext("p", { stdout: JSON.stringify({ ok: true, data: { text: "the record" } }), code: 0 }), "the record");
    assert.match(omContext("p", null), /no answer inside the wake's budget; read it by hand: lares spirit om p/);
    assert.match(omContext("p", { stdout: JSON.stringify({ ok: false, error: { code: "spirit-unknown", message: "spirit-unknown: no record" } }), code: 3 }), /spirit-unknown: no record; read it by hand/);
    assert.match(omContext("p", { stdout: "", code: 127 }), /exited 127/);
  });
  await t.test("the compaction asks for a ROUND under the pet name", () => {
    const ask = roundAsk("lares-alpha");
    assert.match(ask, /"ROUND \(lares-alpha\)"/);
    assert.match(ask, /round\/lares-alpha-<hash12>/);
  });
  await t.test("the counter fires every N stops, and once on an unfiled round", () => {
    let state = { turns: 0, unfiled: null };
    const fired = [];
    for (let i = 0; i < TRUE_UP_EVERY * 2; i++) { const s = stopStep(state); state = s.state; if (s.fire) fired.push(state.turns); }
    assert.deepEqual(fired, [TRUE_UP_EVERY, TRUE_UP_EVERY * 2]);
    const once = stopStep({ turns: 3, unfiled: "spirit-slot-over-budget: …" });
    assert.equal(once.fire, "unfiled");
    assert.equal(once.state.unfiled, null);
    assert.match(trueUpText("p", once), /a round landed unfiled \(spirit-slot-over-budget/);
    assert.match(trueUpText("p", once), /lares spirit hum p/);
  });
  await t.test("the counters rest in the house's run dir, else the state home", () => {
    assert.equal(stateDirOf({ LARES_HOUSE: "/house" }, null), "/house/run/familiar");
    assert.equal(stateDirOf({ HOME: "/h" }, "LARES_HOUSE=/from-file\n"), "/from-file/run/familiar");
    assert.equal(stateDirOf({ HOME: "/h" }, null), "/h/.local/state/lares/familiar");
    assert.equal(statePathOf("/d", "../escape"), null);
    assert.equal(statePathOf("/d", "abc-123"), "/d/stop-abc-123.json");
  });
  await t.test("a handback's pet reads off its mask tag, else the agent id", () => {
    assert.equal(handbackPetOf("Om-Wright: Lares (Tasked Spirit)\nreport", "a1"), "om-wright");
    assert.equal(handbackPetOf("plain report", "Agent_9"), "agent-9");
  });
});

test("the hooks, spawned whole", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "spirit-hooks-"));
  const hooks = join(root, "packages/lares-cli/.claude-plugin/hooks");
  const tools = join(root, "tools");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(join(root, "packages/lares-cli/bin"), { recursive: true });
  mkdirSync(tools, { recursive: true });
  mkdirSync(join(root, "house/run/familiar"), { recursive: true });
  for (const name of readdirSync(sourceDir)) if (name.endsWith(".mjs")) copyFileSync(join(sourceDir, name), join(hooks, name));
  const log = join(root, "argv.log");
  const shim = join(tools, "lares-container.sh");
  /** A shim that logs each argv (one per line, NUL-free) and answers by its first words. */
  const plant = (answers) => writeFileSync(shim, [
    "#!/bin/sh",
    `printf '%s\\n' "$*" >> '${log}'`,
    'case "$1 $2" in',
    ...Object.entries(answers).map(([k, v]) => `"${k}") printf '%s\\n' '${v}' ;;`),
    "*) exit 2 ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 });
  const spawn = (name, args, input) => {
    const env = { ...process.env, HOME: root, LARES_HOUSE: join(root, "house") };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [join(hooks, name), ...args], { env, input, encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 0, r.error?.message ?? r.stderr);
    return r.stdout;
  };
  const calls = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
  const reset = () => rmSync(log, { force: true });
  try {
    await t.test("om: SessionStart carries the record as additionalContext", () => {
      reset();
      plant({ "spirit om": JSON.stringify({ ok: true, data: { text: "Lares spirit om · lares-alpha: the record" } }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "SessionStart", source: "startup" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
      assert.match(out.hookSpecificOutput.additionalContext, /the record/);
      assert.match(calls(), /^spirit om lares-alpha --json$/m);
    });
    await t.test("om: with no pet name the hook prints nothing and reads nothing", () => {
      reset();
      assert.equal(spawn("lares-om-hook.mjs", [], "{}"), "");
      assert.equal(calls(), "");
    });
    await t.test("compact: a familiar's argument appends the ROUND ask to the plain-text carry", () => {
      reset();
      plant({ "wiki filter": JSON.stringify({ ok: true, data: { rows: [], total: 0, next: null } }) });
      const text = spawn("lares-compact-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "PreCompact", trigger: "auto" }));
      assert.match(text, /^Lares compaction carry/);
      assert.match(text, /ROUND \(lares-alpha\)/);
      assert.throws(() => JSON.parse(text));
    });
    await t.test("round: compact_summary rides to spirit round, and an unfiled answer marks the session's counter", () => {
      reset();
      plant({ "spirit round": JSON.stringify({ ok: true, data: { filed: false, unfiled: "spirit-slot-over-budget: #/bodies" } }) });
      spawn("lares-round-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "PostCompact", session_id: "s-1", compact_summary: "the summary\nROUND (lares-alpha)" }));
      assert.match(calls(), /^spirit round lares-alpha --text the summary$/m);
      const state = JSON.parse(readFileSync(join(root, "house/run/familiar/stop-s-1.json"), "utf8"));
      assert.match(state.unfiled, /spirit-slot-over-budget/);
    });
    await t.test("round: an empty summary lands nothing", () => {
      reset();
      spawn("lares-round-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "PostCompact", session_id: "s-2", compact_summary: "" }));
      assert.equal(calls(), "");
    });
    await t.test("true-up: steps aside while a stop already continues", () => {
      reset();
      writeFileSync(join(root, "house/run/familiar/stop-s-3.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-3", stop_hook_active: true })), "");
      assert.equal(calls(), "");
    });
    await t.test("true-up: an unfiled round fires once, naming ah and hum, where the vessel answers up", () => {
      reset();
      plant({ "vessel stand": JSON.stringify({ data: { node: { up: true } } }) });
      const out = JSON.parse(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-1" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "Stop");
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit ah lares-alpha/);
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit hum lares-alpha/);
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-1" })), "");
    });
    await t.test("true-up: a vessel that answers no up lets the stop through silently", () => {
      reset();
      plant({ "vessel stand": JSON.stringify({ data: { node: { up: false } } }) });
      writeFileSync(join(root, "house/run/familiar/stop-s-4.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-4" })), "");
    });
    await t.test("handback: a SubagentHandback message lands as residue under its mask's pet name", () => {
      reset();
      plant({ "spirit residue": JSON.stringify({ ok: true, data: {} }) });
      spawn("lares-handback-hook.mjs", [], JSON.stringify({ hook_event_name: "PostToolUse", tool_name: "SubagentHandback", tool_input: { message: "Om-Wright: Lares (Tasked Spirit) report" } }));
      assert.match(calls(), /^spirit residue om-wright --text Om-Wright: Lares \(Tasked Spirit\) report --json$/m);
    });
    await t.test("handback: another tool lands nothing", () => {
      reset();
      spawn("lares-handback-hook.mjs", [], JSON.stringify({ tool_name: "Bash", tool_input: { message: "x" } }));
      assert.equal(calls(), "");
    });
    await t.test("every hook exits 0 where the shim answers nothing at all", () => {
      reset();
      writeFileSync(shim, "#!/bin/sh\nexit 127\n", { mode: 0o755 });
      for (const [name, args, input] of [
        ["lares-om-hook.mjs", ["p"], "{}"], ["lares-compact-hook.mjs", ["p"], "{}"],
        ["lares-round-hook.mjs", ["p"], JSON.stringify({ session_id: "s-5", compact_summary: "s" })],
        ["lares-true-up-hook.mjs", ["p"], JSON.stringify({ session_id: "s-5" })],
        ["lares-handback-hook.mjs", [], JSON.stringify({ tool_name: "SubagentHandback", tool_input: { message: "m" } })],
      ]) spawn(name, args, input);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
