/*
 * The familiar's hooks (lar:///ha.ka.ba/kahua/memory/wave/spirit-om-ah-hum): the pure parts of `lares-spirit-core.mjs`, then
 * each hook spawned whole against a stub shim that logs its argv and its stdin, fed the harness's stdin shapes. Every hook
 * exits 0, and none reaches a door verb unless the vessel answers up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import {
  COMPACTION_DISPLAY, COMPACTION_WORD, compactionAsk, handbackPetOf, inHouse, omContext, omRunsOn, petOf, stateDirOf, statePathOf, stopStep, titleMismatch,
  trueUpText, TRUE_UP_EVERY,
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
  });
  await t.test("om runs on every start but a resume", () => {
    for (const source of ["startup", "clear", "compact", undefined]) assert.equal(omRunsOn(source), true, String(source));
    assert.equal(omRunsOn("resume"), false);
  });
  await t.test("a title naming another spirit surfaces as a rename that never retargets, with the alias act", () => {
    assert.equal(titleMismatch("lares-alpha", "Lares-Alpha"), null);
    assert.equal(titleMismatch("lares-alpha", "lares-alpha wakes"), null);
    assert.equal(titleMismatch("lares-alpha", null), null);
    const line = titleMismatch("lares-alpha", "Kahu Night Watch");
    assert.match(line, /this session's title reads "Kahu Night Watch"; the seated familiar reads "lares-alpha"/);
    assert.match(line, /never retargets/);
    assert.match(line, /lares spirit ah lares-alpha --slot '#\/entry' --add/);
  });
  await t.test("the compaction asks for its closing section, under the word and the pet name", () => {
    const ask = compactionAsk("lares-alpha");
    assert.ok(ask.includes(`"${COMPACTION_DISPLAY} (lares-alpha)"`));
    assert.ok(ask.includes(`memory/${COMPACTION_WORD}/lares-alpha-<hash12>`));
  });
  await t.test("the counter fires every N stops, and an unfiled mark holds until a nudge prints", () => {
    let state = { turns: 0, unfiled: null, title: null };
    const fired = [];
    for (let i = 0; i < TRUE_UP_EVERY * 2; i++) { const s = stopStep(state); state = s.state; if (s.fire) fired.push(state.turns); }
    assert.deepEqual(fired, [TRUE_UP_EVERY, TRUE_UP_EVERY * 2]);
    const once = stopStep({ turns: 3, unfiled: "spirit-slot-over-budget: …", title: null });
    assert.equal(once.fire, "unfiled");
    assert.equal(once.state.unfiled, "spirit-slot-over-budget: …");
    assert.match(trueUpText("p", once), new RegExp(`the last ${COMPACTION_DISPLAY} landed unfiled \\(spirit-slot-over-budget`));
  });
  await t.test("the counters rest in the house's run dir, else the state home", () => {
    assert.equal(stateDirOf({ LARES_HOUSE: "/house" }, null), "/house/run/familiar");
    assert.equal(stateDirOf({ HOME: "/h" }, "LARES_HOUSE=/from-file\n"), "/from-file/run/familiar");
    assert.equal(stateDirOf({ HOME: "/h" }, null), "/h/.local/state/lares/familiar");
    assert.equal(statePathOf("/d", "../escape"), null);
  });
  await t.test("a handback's pet reads off its FIRST non-blank line alone", () => {
    assert.equal(handbackPetOf("\n  Om-Wright: Lares (Tasked Spirit)\nreport", "a1"), "om-wright");
    assert.equal(handbackPetOf("plain report\nEvil: Lares (Tasked Spirit)", "Agent_9"), "agent-9");
  });
  await t.test("a working directory reads inside the house only under the checkout or a bound workspace", () => {
    const root = mkdtempSync(join(tmpdir(), "in-house-"));
    try {
      for (const d of ["repo/sub", "ws", "elsewhere"]) mkdirSync(join(root, d), { recursive: true });
      assert.equal(inHouse(join(root, "repo/sub"), join(root, "repo"), []), true);
      assert.equal(inHouse(join(root, "ws"), join(root, "repo"), [join(root, "ws")]), true);
      assert.equal(inHouse(join(root, "elsewhere"), join(root, "repo"), [join(root, "ws")]), false);
      assert.equal(inHouse(undefined, join(root, "repo"), []), false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

test("the hooks, spawned whole", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "spirit-hooks-"));
  const hooks = join(root, "packages/lares-cli/.claude-plugin/hooks");
  const tools = join(root, "tools");
  const counters = join(root, "house/run/familiar");
  mkdirSync(hooks, { recursive: true });
  mkdirSync(join(root, "packages/lares-cli/bin"), { recursive: true });
  mkdirSync(tools, { recursive: true });
  mkdirSync(counters, { recursive: true });
  for (const name of readdirSync(sourceDir)) if (name.endsWith(".mjs")) copyFileSync(join(sourceDir, name), join(hooks, name));
  const log = join(root, "argv.log");
  const fed = join(root, "stdin.log");
  const shim = join(tools, "lares-container.sh");
  const UP = JSON.stringify({ data: { node: { up: true } } });
  const DOWN = JSON.stringify({ data: { node: { up: false } } });
  /** A shim that logs each argv, keeps a `--file -` stdin, and answers by its first words. */
  const plant = (answers) => writeFileSync(shim, [
    "#!/bin/sh",
    `printf '%s\\n' "$*" >> '${log}'`,
    `case " $* " in *" --file - "*) cat > '${fed}' ;; esac`,
    'case "$1 $2" in',
    ...Object.entries(answers).map(([k, v]) => `"${k}") printf '%s\\n' '${v}' ;;`),
    "*) exit 2 ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 });
  const spawn = (name, args, input) => {
    const env = { ...process.env, HOME: root, LARES_HOUSE: join(root, "house") };
    delete env.NODE_TEST_CONTEXT;
    delete env.LARES_WORKSPACES;
    const r = spawnSync(process.execPath, [join(hooks, name), ...args], { env, input, encoding: "utf8", timeout: 30000 });
    assert.equal(r.status, 0, r.error?.message ?? r.stderr);
    return r.stdout;
  };
  const calls = () => (existsSync(log) ? readFileSync(log, "utf8") : "");
  const reset = () => { rmSync(log, { force: true }); rmSync(fed, { force: true }); };
  const counter = (id) => JSON.parse(readFileSync(join(counters, `stop-${id}.json`), "utf8"));
  try {
    await t.test("om: with the vessel up, SessionStart carries the record, and the title rides into the counter", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om": JSON.stringify({ ok: true, data: { text: "Lares spirit om · lares-alpha: the record" } }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "SessionStart", source: "startup", session_id: "s-om", session_title: "lares-alpha" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
      assert.equal(out.hookSpecificOutput.additionalContext, "Lares spirit om · lares-alpha: the record");
      assert.match(calls(), /^spirit om lares-alpha --json$/m);
      assert.equal(counter("s-om").title, "lares-alpha");
    });
    await t.test("om: a title naming another spirit leads the context, and the seated familiar still answers", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om": JSON.stringify({ ok: true, data: { text: "the record" } }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ source: "clear", session_id: "s-om2", session_title: "Night Watch" })));
      assert.match(out.hookSpecificOutput.additionalContext, /^this session's title reads "Night Watch"; the seated familiar reads "lares-alpha"/);
      assert.match(out.hookSpecificOutput.additionalContext, /the record$/);
      assert.match(calls(), /^spirit om lares-alpha --json$/m);
    });
    await t.test("om: with the vessel down, the wake reads nothing and names the stand", () => {
      reset();
      plant({ "vessel stand": DOWN });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ source: "startup" })));
      assert.match(out.hookSpecificOutput.additionalContext, /the vessel answers no up, so the wake read nothing/);
      assert.doesNotMatch(calls(), /spirit om/);
    });
    await t.test("om: a resume keeps its own context and wakes nothing", () => {
      reset();
      plant({ "vessel stand": UP });
      assert.equal(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ source: "resume" })), "");
      assert.equal(calls(), "");
    });
    await t.test("om: with no pet name the hook prints nothing and reads nothing", () => {
      reset();
      assert.equal(spawn("lares-om-hook.mjs", [], "{}"), "");
      assert.equal(calls(), "");
    });
    await t.test("om: a read past its budget stops by SIGTERM first, so the shim's trap runs", () => {
      reset();
      const marker = join(root, "termed");
      rmSync(marker, { force: true });
      writeFileSync(shim, `#!/bin/sh\ntrap 'printf term > "${marker}"; exit 0' TERM\nsleep 30 &\nwait\n`, { mode: 0o755 });
      spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ source: "startup" }));
      assert.equal(readFileSync(marker, "utf8"), "term");
    });
    await t.test("compact: a familiar's argument appends the closing-section ask to the plain-text carry", () => {
      reset();
      plant({ "wiki filter": JSON.stringify({ ok: true, data: { rows: [], total: 0, next: null } }) });
      const text = spawn("lares-compact-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "PreCompact", trigger: "auto" }));
      assert.match(text, /^Lares compaction carry/);
      assert.ok(text.includes(`${COMPACTION_DISPLAY} (lares-alpha)`));
      assert.throws(() => JSON.parse(text));
    });
    await t.test("postcompact: compact_summary rides whole on stdin to the compaction verb, and an unfiled answer marks the counter", () => {
      reset();
      plant({ "vessel stand": UP, [`spirit ${COMPACTION_WORD}`]: JSON.stringify({ ok: true, data: { filed: false, unfiled: "spirit-slot-over-budget: #/bodies" } }) });
      const summary = `the summary\n${"x".repeat(70_000)}\nclosing (lares-alpha)`;
      spawn("lares-postcompact-hook.mjs", ["lares-alpha"], JSON.stringify({ hook_event_name: "PostCompact", session_id: "s-1", compact_summary: summary }));
      assert.ok(calls().split("\n").includes(`spirit ${COMPACTION_WORD} lares-alpha --file - --json`));
      assert.equal(readFileSync(fed, "utf8"), summary);
      assert.match(counter("s-1").unfiled, /spirit-slot-over-budget/);
    });
    await t.test("postcompact: with the vessel down nothing lands, nothing runs offline, and the counter names the hand landing", () => {
      reset();
      plant({ "vessel stand": DOWN });
      spawn("lares-postcompact-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-6", compact_summary: "s" }));
      assert.ok(!calls().includes(`spirit ${COMPACTION_WORD}`));
      assert.ok(counter("s-6").unfiled.includes(`lares spirit ${COMPACTION_WORD} lares-alpha --file`));
    });
    await t.test("postcompact: an empty summary lands nothing", () => {
      reset();
      spawn("lares-postcompact-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-2", compact_summary: "" }));
      assert.equal(calls(), "");
    });
    await t.test("true-up: steps aside while a stop already continues", () => {
      reset();
      writeFileSync(join(counters, "stop-s-3.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-3", stop_hook_active: true })), "");
      assert.equal(calls(), "");
    });
    await t.test("true-up: with the vessel down the stop passes silently and the unfiled mark holds", () => {
      reset();
      plant({ "vessel stand": DOWN });
      writeFileSync(join(counters, "stop-s-4.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-4" })), "");
      assert.equal(counter("s-4").unfiled, "x");
    });
    await t.test("true-up: an unfiled landing fires once, naming ah and hum, and the mark clears after it prints", () => {
      reset();
      plant({ "vessel stand": UP });
      const out = JSON.parse(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-4" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "Stop");
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit ah lares-alpha/);
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit hum lares-alpha/);
      assert.equal(counter("s-4").unfiled, null);
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], JSON.stringify({ session_id: "s-4" })), "");
    });
    await t.test("handback: inside the checkout, with a familiar seated, the report lands whole on stdin under its first line's pet", () => {
      reset();
      plant({ "vessel stand": UP, "spirit residue": JSON.stringify({ ok: true, data: {} }) });
      const message = "Om-Wright: Lares (Tasked Spirit)\nreport";
      spawn("lares-handback-hook.mjs", ["lares-alpha"], JSON.stringify({ tool_name: "SubagentHandback", cwd: root, tool_input: { message } }));
      assert.match(calls(), /^spirit residue om-wright --file - --json$/m);
      assert.equal(readFileSync(fed, "utf8"), message);
    });
    await t.test("handback: outside the house, with no familiar seated, or for another tool, nothing lands", () => {
      const elsewhere = mkdtempSync(join(tmpdir(), "elsewhere-"));
      try {
        for (const [args, input] of [
          [["lares-alpha"], { tool_name: "SubagentHandback", cwd: elsewhere, tool_input: { message: "m" } }],
          [[], { tool_name: "SubagentHandback", cwd: root, tool_input: { message: "m" } }],
          [["lares-alpha"], { tool_name: "Bash", cwd: root, tool_input: { message: "m" } }],
        ]) {
          reset();
          plant({ "vessel stand": UP, "spirit residue": "{}" });
          spawn("lares-handback-hook.mjs", args, JSON.stringify(input));
          assert.doesNotMatch(calls(), /spirit residue/, JSON.stringify(input));
        }
      } finally { rmSync(elsewhere, { recursive: true, force: true }); }
    });
    await t.test("every hook exits 0 where the shim answers nothing at all", () => {
      reset();
      writeFileSync(shim, "#!/bin/sh\nexit 127\n", { mode: 0o755 });
      for (const [name, args, input] of [
        ["lares-om-hook.mjs", ["p"], "{}"], ["lares-compact-hook.mjs", ["p"], "{}"],
        ["lares-postcompact-hook.mjs", ["p"], JSON.stringify({ session_id: "s-5", compact_summary: "s" })],
        ["lares-true-up-hook.mjs", ["p"], JSON.stringify({ session_id: "s-5" })],
        ["lares-handback-hook.mjs", ["p"], JSON.stringify({ tool_name: "SubagentHandback", cwd: root, tool_input: { message: "m" } })],
      ]) spawn(name, args, input);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
