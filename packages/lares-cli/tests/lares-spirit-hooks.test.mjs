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
  COMPACTION_DISPLAY, COMPACTION_WORD, OBSERVE_BUDGET_MS, OM_BUDGET_MS, PRECOMPACT_CHARS, WAKE_CEILING_MS, busy, compactionAsk, handbackPetOf, inHouse,
  omContext, omSourceOf, petCandidates, petOf, precompactText, sessionPet, stateDirOf, statePathOf, stopStep, titleMismatch, trueUpText, TRUE_UP_EVERY,
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
  await t.test("om reads every source the harness names, an unknown one as a startup", () => {
    for (const source of ["startup", "resume", "clear", "compact", "fork"]) assert.equal(omSourceOf(source), source);
    assert.equal(omSourceOf("other"), "startup");
    assert.equal(omSourceOf(undefined), "startup");
  });
  await t.test("the pet resolves per session: the title's slug first, the seated default after, none past that", () => {
    assert.deepEqual(petCandidates("Lares-Awakens", "lares-alpha"), [{ pet: "lares-awakens", from: "title" }, { pet: "lares-alpha", from: "seated" }]);
    assert.deepEqual(petCandidates("lares-alpha", "lares-alpha"), [{ pet: "lares-alpha", from: "title" }]);
    assert.deepEqual(petCandidates(null, null), []);
    assert.equal(sessionPet({ pet: "lares-awakens" }, "lares-alpha"), "lares-awakens");
    assert.equal(sessionPet({ pet: null }, "lares-alpha"), "lares-alpha");
  });
  await t.test("the PreCompact text runs the crossing in order: the card first, the fixed-slot ask, the operator's instructions, then the carry, under the cap", () => {
    const text = precompactText({ pet: "p", shape: "keep what only this body knew", inherits: "0123456789ab", card: "the card's open loops", instructions: "focus on the tests", carry: "x".repeat(20_000) });
    assert.ok(text.startsWith("The card, read to the outgoing body before it folds"));
    const ask = text.indexOf(`End the summary with a section headed "${COMPACTION_DISPLAY} (p)", in these fixed slots`);
    assert.ok(ask > text.indexOf("the card's open loops"));
    for (const slot of ["\npet: p\n", "\ninherits: 0123456789ab", "\nopen: ", "\ntells: ", "\nbody: "]) assert.ok(text.includes(slot), slot);
    assert.ok(text.includes("The familiar's own carry-shape:\nkeep what only this body knew"));
    assert.ok(text.indexOf("The operator's own instructions for this compaction: focus on the tests") > ask);
    assert.ok(text.length <= PRECOMPACT_CHARS);
    assert.ok(!precompactText({ pet: null, carry: "c" }).includes(COMPACTION_DISPLAY));
  });
  await t.test("a session with background tasks or crons running reads busy", () => {
    assert.equal(busy({ background_tasks: [{ id: 1 }] }), true);
    assert.equal(busy({ session_crons: [] , background_tasks: [] }), false);
    assert.equal(busy({}), false);
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
  await t.test("the wake's worst case (the gate, the read, one TERM grace) finishes under its ceiling", async () => {
    const { TERM_GRACE_MS } = await import("../.claude-plugin/hooks/lares-wake-core.mjs");
    assert.ok(OBSERVE_BUDGET_MS + OM_BUDGET_MS + TERM_GRACE_MS + 250 <= WAKE_CEILING_MS);
    assert.ok(WAKE_CEILING_MS <= 9_000);
  });
  await t.test("the compaction asks for its closing section, under the word and the pet name", () => {
    const ask = compactionAsk("lares-alpha", null);
    assert.ok(ask.includes(`"${COMPACTION_DISPLAY} (lares-alpha)"`));
    assert.ok(ask.includes(`memory/${COMPACTION_WORD}/`));
  });
  await t.test("the counter fires every N stops, and an unfiled mark holds until a nudge prints", () => {
    let state = { turns: 0, unfiled: null, title: null, every: TRUE_UP_EVERY };
    const fired = [];
    for (let i = 0; i < TRUE_UP_EVERY * 2; i++) { const s = stopStep(state); state = s.state; if (s.fire) fired.push(state.turns); }
    assert.deepEqual(fired, [TRUE_UP_EVERY, TRUE_UP_EVERY * 2]);
    assert.equal(stopStep({ turns: 9, unfiled: null, every: 10 }).fire, "turns");
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
  /** A shim that logs each argv, keeps a `--file -` stdin, and answers by the argv's leading words (a key matches a prefix). */
  const plant = (answers) => writeFileSync(shim, [
    "#!/bin/sh",
    `printf '%s\\n' "$*" >> '${log}'`,
    `case " $* " in *" --file - "*) cat > '${fed}' ;; esac`,
    'case "$*" in',
    ...Object.entries(answers).map(([k, v]) => `"${k}"*) printf '%s\\n' '${v}' ;;`),
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
  const om = (text, more = {}) => JSON.stringify({ ok: true, data: { text, ...more } });
  const STARTER = JSON.stringify({ ok: true, data: { starter: true, text: "the starter shrine" } });
  /** A hook input inside the house (the checkout), the harness's own shape. */
  const at = (fields) => JSON.stringify({ cwd: root, ...fields });
  try {
    await t.test("om: with the vessel up, the seated familiar wakes; the counter keeps the pet, epoch, cadence and title", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": om("Lares spirit om · lares-alpha: the card", { epoch: 4, every: 10 }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ hook_event_name: "SessionStart", source: "startup", session_id: "s-om", session_title: "lares-alpha" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
      assert.equal(out.hookSpecificOutput.additionalContext, "Lares spirit om · lares-alpha: the card");
      assert.ok(calls().split("\n").includes("spirit om lares-alpha --source startup --body s-om --json"));
      assert.deepEqual([counter("s-om").pet, counter("s-om").epoch, counter("s-om").every, counter("s-om").title], ["lares-alpha", 4, 10, "lares-alpha"]);
    });
    await t.test("om: a title naming a familiar whose record stands wears that familiar over the seated default", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-awakens": om("the awakens card"), "spirit om lares-alpha": om("the alpha card") });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup", session_id: "s-aw", session_title: "Lares-Awakens" })));
      assert.equal(out.hookSpecificOutput.additionalContext, "the awakens card");
      assert.equal(counter("s-aw").pet, "lares-awakens");
      assert.ok(!calls().includes("spirit om lares-alpha"));
    });
    await t.test("om: a title whose record stands nowhere falls to the seated default, and the rename line leads", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om night-watch": STARTER, "spirit om lares-alpha": om("the alpha card") });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "clear", session_id: "s-om2", session_title: "Night Watch" })));
      assert.match(out.hookSpecificOutput.additionalContext, /^this session's title reads "Night Watch"; the seated familiar reads "lares-alpha"/);
      assert.match(out.hookSpecificOutput.additionalContext, /the alpha card$/);
      assert.equal(counter("s-om2").pet, "lares-alpha");
    });
    await t.test("om: the seated familiar with no record wakes into the starter shrine", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-awakens": STARTER });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-awakens"], at({ source: "startup", session_id: "s-new" })));
      assert.equal(out.hookSpecificOutput.additionalContext, "the starter shrine");
    });
    await t.test("om: a resume and a fork name their source to the door", () => {
      for (const source of ["resume", "fork"]) {
        reset();
        plant({ "vessel stand": UP, "spirit om": om(`a ${source}`) });
        const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source, session_id: `s-${source}` })));
        assert.equal(out.hookSpecificOutput.additionalContext, `a ${source}`);
        assert.ok(calls().includes(`spirit om lares-alpha --source ${source} --body s-${source} --json`));
      }
    });
    await t.test("om: with the vessel down, the wake reads nothing and names the stand", () => {
      reset();
      plant({ "vessel stand": DOWN });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup" })));
      assert.match(out.hookSpecificOutput.additionalContext, /the vessel answers no up, so the wake read nothing/);
      assert.ok(!calls().includes("spirit om"));
    });
    await t.test("om: outside the house, or with no pet at all, the hook prints nothing and reads nothing", () => {
      const elsewhere = mkdtempSync(join(tmpdir(), "elsewhere-"));
      try {
        reset();
        plant({ "vessel stand": UP, "spirit om": om("x") });
        assert.equal(spawn("lares-om-hook.mjs", ["lares-alpha"], JSON.stringify({ cwd: elsewhere, source: "startup" })), "");
        assert.equal(spawn("lares-om-hook.mjs", [], at({ source: "startup" })), "");
        assert.equal(calls(), "");
      } finally { rmSync(elsewhere, { recursive: true, force: true }); }
    });
    await t.test("om: a read past its budget stops by SIGTERM first, so the shim's trap runs", () => {
      reset();
      const marker = join(root, "termed");
      rmSync(marker, { force: true });
      writeFileSync(shim, `#!/bin/sh\ntrap 'printf term > "${marker}"; exit 0' TERM\nsleep 30 &\nwait\n`, { mode: 0o755 });
      spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup" }));
      assert.equal(readFileSync(marker, "utf8"), "term");
    });
    await t.test("compact: the card reads first, the fixed-slot ask follows naming the inherited hash and the record's carry-shape, a manual /compact's instructions echo, the crossing marks", () => {
      reset();
      writeFileSync(join(counters, "stop-s-c.json"), JSON.stringify({ turns: 0, pet: "lares-awakens" }));
      plant({ "vessel stand": UP, "spirit om lares-awakens --source precompact": om("the card read out", { carryShape: "keep what only this body knew", inherits: "0123456789ab" }), "wiki filter": JSON.stringify({ ok: true, data: { rows: [], total: 0, next: null } }) });
      const text = spawn("lares-compact-hook.mjs", ["lares-alpha"], at({ hook_event_name: "PreCompact", trigger: "manual", session_id: "s-c", custom_instructions: "focus on the tests" }));
      assert.ok(text.startsWith("The card, read to the outgoing body before it folds (the record outranks this summary):\nthe card read out"));
      assert.ok(text.includes(`End the summary with a section headed "${COMPACTION_DISPLAY} (lares-awakens)", in these fixed slots`));
      assert.ok(text.includes("inherits: 0123456789ab"));
      assert.ok(text.includes("The familiar's own carry-shape:\nkeep what only this body knew"));
      assert.ok(text.includes("The operator's own instructions for this compaction: focus on the tests"));
      assert.ok(text.indexOf("focus on the tests") < text.indexOf("Lares compaction carry"));
      assert.ok(calls().includes("spirit om lares-awakens --source precompact --body s-c --json"));
      assert.throws(() => JSON.parse(text));
    });
    await t.test("postcompact: the summary rides whole on stdin bearing the body and epoch; the line the card awaits marks the counter unfiled", () => {
      reset();
      writeFileSync(join(counters, "stop-s-1.json"), JSON.stringify({ turns: 0, pet: "lares-alpha", epoch: 4 }));
      plant({ "vessel stand": UP, [`spirit ${COMPACTION_WORD}`]: JSON.stringify({ ok: true, data: { filed: false, unfiled: "file the #/bodies line: lares spirit ah lares-alpha --slot #/bodies --add x" } }) });
      const summary = `the summary\n${"x".repeat(70_000)}\nclosing (lares-alpha)`;
      spawn("lares-postcompact-hook.mjs", [], at({ hook_event_name: "PostCompact", session_id: "s-1", compact_summary: summary }));
      assert.ok(calls().split("\n").includes(`spirit ${COMPACTION_WORD} lares-alpha --file - --body s-1 --epoch 4 --json`));
      assert.equal(readFileSync(fed, "utf8"), summary);
      assert.match(counter("s-1").unfiled, /lares spirit ah lares-alpha --slot #\/bodies --add/);
    });
    await t.test("postcompact: with the vessel down nothing lands, nothing runs offline, and the counter names the hand landing", () => {
      reset();
      plant({ "vessel stand": DOWN });
      spawn("lares-postcompact-hook.mjs", ["lares-alpha"], at({ session_id: "s-6", compact_summary: "s" }));
      assert.ok(!calls().includes(`spirit ${COMPACTION_WORD}`));
      assert.ok(counter("s-6").unfiled.includes(`lares spirit ${COMPACTION_WORD} lares-alpha --file`));
    });
    await t.test("postcompact: an empty summary lands nothing", () => {
      reset();
      spawn("lares-postcompact-hook.mjs", ["lares-alpha"], at({ session_id: "s-2", compact_summary: "" }));
      assert.equal(calls(), "");
    });
    await t.test("true-up: steps aside while a stop already continues, and while background work runs", () => {
      reset();
      writeFileSync(join(counters, "stop-s-3.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], at({ session_id: "s-3", stop_hook_active: true })), "");
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], at({ session_id: "s-3", background_tasks: [{ id: "t" }] })), "");
      assert.equal(calls(), "");
      assert.equal(counter("s-3").unfiled, "x");
    });
    await t.test("true-up: with the vessel down the stop passes silently and the unfiled mark holds", () => {
      reset();
      plant({ "vessel stand": DOWN });
      writeFileSync(join(counters, "stop-s-4.json"), JSON.stringify({ turns: 0, unfiled: "x" }));
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], at({ session_id: "s-4" })), "");
      assert.equal(counter("s-4").unfiled, "x");
    });
    await t.test("true-up: an unfiled carry fires once, naming ah and hum, and the mark clears after it prints", () => {
      reset();
      plant({ "vessel stand": UP });
      const out = JSON.parse(spawn("lares-true-up-hook.mjs", ["lares-alpha"], at({ session_id: "s-4" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "Stop");
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit ah lares-alpha/);
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit hum lares-alpha/);
      assert.equal(counter("s-4").unfiled, null);
      assert.equal(spawn("lares-true-up-hook.mjs", ["lares-alpha"], at({ session_id: "s-4" })), "");
    });
    await t.test("true-up: the cadence the counter carries from the record decides when it fires", () => {
      reset();
      plant({ "vessel stand": UP });
      writeFileSync(join(counters, "stop-s-7.json"), JSON.stringify({ turns: 2, pet: "lares-awakens", every: 3 }));
      const out = JSON.parse(spawn("lares-true-up-hook.mjs", [], at({ session_id: "s-7" })));
      assert.match(out.hookSpecificOutput.additionalContext, /lares spirit ah lares-awakens/);
    });
    await t.test("handback: inside the house, the report lands whole on stdin under its first line's pet, keyed by session and agent", () => {
      reset();
      plant({ "vessel stand": UP, "spirit residue": JSON.stringify({ ok: true, data: {} }) });
      const message = "Om-Wright: Lares (Tasked Spirit)\nreport";
      spawn("lares-handback-hook.mjs", ["lares-alpha"], at({ tool_name: "SubagentHandback", session_id: "s-h", agent_id: "a-1", tool_input: { message } }));
      assert.ok(calls().split("\n").includes("spirit residue om-wright --file - --key s-h:a-1 --json"));
      assert.equal(readFileSync(fed, "utf8"), message);
    });
    await t.test("handback: outside the house, with no familiar at all, or for another tool, nothing lands", () => {
      const elsewhere = mkdtempSync(join(tmpdir(), "elsewhere-"));
      try {
        for (const [args, input] of [
          [["lares-alpha"], { tool_name: "SubagentHandback", cwd: elsewhere, tool_input: { message: "m" } }],
          [[], { tool_name: "SubagentHandback", cwd: root, session_id: "s-none", tool_input: { message: "m" } }],
          [["lares-alpha"], { tool_name: "Bash", cwd: root, tool_input: { message: "m" } }],
        ]) {
          reset();
          plant({ "vessel stand": UP, "spirit residue": "{}" });
          spawn("lares-handback-hook.mjs", args, JSON.stringify(input));
          assert.ok(!calls().includes("spirit residue"), JSON.stringify(input));
        }
      } finally { rmSync(elsewhere, { recursive: true, force: true }); }
    });
    await t.test("rename: a retitle surfaces once as a rename that never retargets; the same title again stays quiet; no vessel read", () => {
      reset();
      writeFileSync(join(counters, "stop-s-r.json"), JSON.stringify({ turns: 0, pet: "lares-alpha", title: "lares-alpha" }));
      const out = JSON.parse(spawn("lares-rename-hook.mjs", [], at({ hook_event_name: "UserPromptSubmit", session_id: "s-r", session_title: "Kahu Night" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
      assert.match(out.hookSpecificOutput.additionalContext, /never retargets/);
      assert.equal(counter("s-r").title, "Kahu Night");
      assert.equal(spawn("lares-rename-hook.mjs", [], at({ session_id: "s-r", session_title: "Kahu Night" })), "");
      assert.equal(calls(), "");
    });
    await t.test("every hook exits 0 where the shim answers nothing at all", () => {
      reset();
      writeFileSync(shim, "#!/bin/sh\nexit 127\n", { mode: 0o755 });
      for (const [name, args, input] of [
        ["lares-om-hook.mjs", ["p"], at({})], ["lares-compact-hook.mjs", ["p"], at({})],
        ["lares-postcompact-hook.mjs", ["p"], at({ session_id: "s-5", compact_summary: "s" })],
        ["lares-true-up-hook.mjs", ["p"], at({ session_id: "s-5" })],
        ["lares-handback-hook.mjs", ["p"], at({ tool_name: "SubagentHandback", tool_input: { message: "m" } })],
        ["lares-rename-hook.mjs", ["p"], at({ session_id: "s-5", session_title: "t" })],
      ]) spawn(name, args, input);
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
