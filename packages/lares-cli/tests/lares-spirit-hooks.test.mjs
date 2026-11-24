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
  omContext, omSourceOf, petOf, precompactText, readState, sessionPet, stateDirOf, statePathOf, stopStep, holdsPet, titleLine, titleMismatch, trueUpText, updateState, wakePet, TRUE_UP_EVERY,
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
  await t.test("the wake asks for the pet the session holds (any source but a startup), else the seated, else the title's slug; the door reads the title", () => {
    assert.equal(wakePet({ source: "compact", held: "lares-awakens", seated: "lares-alpha", title: "x" }), "lares-awakens");
    assert.equal(wakePet({ source: "compact", held: "lares-alpha", seated: "lares-alpha", title: "Lares-Awakens" }), "lares-alpha");
    assert.equal(wakePet({ source: "startup", held: "lares-awakens", seated: "lares-alpha", title: null }), "lares-alpha");
    assert.equal(wakePet({ source: "startup", held: null, seated: "lares-alpha", title: "Lares-Awakens" }), "lares-alpha");
    assert.equal(wakePet({ source: "startup", held: null, seated: null, title: "Lares-Awakens" }), "lares-awakens");
    assert.equal(wakePet({ source: "startup", held: null, seated: null, title: "x".repeat(70) }), null);
    assert.equal(wakePet({ source: "startup", held: null, seated: null, title: null }), null);
    assert.equal(holdsPet({ source: "compact", held: "lares-alpha" }, "lares-alpha"), true);
    assert.equal(holdsPet({ source: "startup", held: "lares-alpha" }, "lares-alpha"), false);
    assert.equal(holdsPet({ source: "compact", held: null }, "lares-alpha"), false);
    assert.equal(sessionPet({ pet: "lares-awakens" }, "lares-alpha"), "lares-awakens");
    assert.equal(sessionPet({ pet: null }, "lares-alpha"), "lares-alpha");
  });
  await t.test("a retitle follows the held/fresh split: a held pet reads a rename; a fresh session's title names its own familiar, never the seated", () => {
    assert.match(titleLine({ pet: "lares-alpha" }, "Kahu Night"), /the seated familiar reads "lares-alpha"/);
    assert.equal(titleLine({ pet: "lares-alpha" }, "Lares-Alpha"), null);
    assert.equal(titleLine({ pet: "lares-alpha" }, "lares-alpha wakes"), null);
    const fresh = titleLine({ pet: null }, "Lares-Awakens");
    assert.match(fresh, /names lares-awakens/);
    assert.match(fresh, /if the operator named this session so, or a record stands under that name/);
    assert.match(fresh, /lares spirit om lares-awakens --title 'Lares-Awakens'/);
    assert.doesNotMatch(fresh, /lares-alpha/);
    assert.equal(titleLine({ pet: null }, "!!!"), null);
    assert.match(titleLine({ pet: null }, "x".repeat(70)), /runs 70 chars, past the 62 a pet name holds/);
  });
  await t.test("a counter's read-modify-write keeps every key another hook wrote", () => {
    const dir = mkdtempSync(join(tmpdir(), "counter-"));
    try {
      const path = join(dir, "stop-s.json");
      updateState(path, (cur) => ({ ...cur, unfiled: "a landing to file" }));
      updateState(path, (cur) => ({ ...cur, turns: cur.turns + 1, title: "t" }));
      const held = readState(path);
      assert.deepEqual([held.unfiled, held.turns, held.title], ["a landing to file", 1, "t"]);
      assert.equal(existsSync(`${path}.lock`), false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  await t.test("the true-up names the lease epoch the card writes bear", () => {
    assert.match(trueUpText("p", { fire: "turns", state: { turns: 25, epoch: 4 } }), /--epoch 4/);
    const nudge = trueUpText("p", { fire: "turns", state: { turns: 25, digests: { "#/open": "0123456789abcdef" } } }, null, "s-1");
    assert.match(nudge, /lares spirit ah p --slot '#\/open' --file <path> --base 0123456789abcdef --body s-1/);
    assert.match(nudge, /--add '<line>' on #\/bodies, #\/open or #\/voice --body s-1/);
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
    await t.test("om: with the vessel up, the seated familiar wakes in one read beside the title; the counter keeps the pet, epoch, cadence and title", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": om("Lares spirit om · lares-alpha: the card", { pet: "lares-alpha", epoch: 4, every: 10, digests: { "#/open": "0123456789abcdef", "bad": "x" } }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ hook_event_name: "SessionStart", source: "startup", session_id: "s-om", session_title: "lares-alpha" })));
      assert.equal(out.hookSpecificOutput.hookEventName, "SessionStart");
      assert.equal(out.hookSpecificOutput.additionalContext, "Lares spirit om · lares-alpha: the card");
      assert.ok(calls().split("\n").includes("spirit om lares-alpha --source startup --body s-om --title lares-alpha --json"));
      assert.equal(calls().split("\n").filter((l) => l.startsWith("spirit om")).length, 1);
      assert.deepEqual([counter("s-om").pet, counter("s-om").epoch, counter("s-om").every, counter("s-om").title], ["lares-alpha", 4, 10, "lares-alpha"]);
      assert.deepEqual(counter("s-om").digests, { "#/open": "0123456789abcdef" });
    });
    await t.test("om: a fresh titled session hands the seated pet and the title to the door; its starter offer records no pet", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": STARTER });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup", session_id: "s-aw", session_title: "Lares-Awakens" })));
      assert.equal(out.hookSpecificOutput.additionalContext, "the starter shrine");
      assert.ok(calls().split("\n").includes("spirit om lares-alpha --source startup --body s-aw --title Lares-Awakens --json"));
      assert.equal(counter("s-aw").pet, null);
      assert.equal(counter("s-aw").title, "Lares-Awakens");
    });
    await t.test("om: the door's turn (the title's own record) names the pet the counter keeps", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": om("the awakens card", { pet: "lares-awakens" }) });
      spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup", session_id: "s-aw2", session_title: "Lares-Awakens" }));
      assert.equal(counter("s-aw2").pet, "lares-awakens");
    });
    await t.test("om: a fresh untitled session wakes the seated default", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": om("the alpha card", { pet: "lares-alpha" }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup", session_id: "s-untitled" })));
      assert.equal(out.hookSpecificOutput.additionalContext, "the alpha card");
      assert.ok(calls().includes("spirit om lares-alpha --source startup --body s-untitled --json"));
    });
    await t.test("om: a held session names itself held to the door, so a retitle reads as its rename", () => {
      reset();
      writeFileSync(join(counters, "stop-s-held.json"), JSON.stringify({ turns: 3, pet: "lares-alpha", title: "lares-alpha" }));
      plant({ "vessel stand": UP, "spirit om lares-alpha": om("the alpha card", { pet: "lares-alpha" }) });
      spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "compact", session_id: "s-held", session_title: "Lares-Awakens" }));
      assert.ok(calls().includes("spirit om lares-alpha --source compact --body s-held --held --title Lares-Awakens --json"));
    });
    await t.test("om: any source but a startup keeps the pet the session already wears", () => {
      reset();
      writeFileSync(join(counters, "stop-s-keep.json"), JSON.stringify({ turns: 3, pet: "lares-awakens" }));
      plant({ "vessel stand": UP, "spirit om lares-awakens": om("the awakens card", { pet: "lares-awakens" }) });
      spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "compact", session_id: "s-keep" }));
      assert.ok(calls().includes("spirit om lares-awakens --source compact --body s-keep --held --json"));
      assert.ok(!calls().includes("spirit om lares-alpha"));
    });
    await t.test("om: with no familiar seated or held, the title's slug proposes itself", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-awakens": STARTER });
      const out = JSON.parse(spawn("lares-om-hook.mjs", [], at({ source: "startup", session_id: "s-new", session_title: "Lares-Awakens" })));
      assert.equal(out.hookSpecificOutput.additionalContext, "the starter shrine");
    });
    await t.test("om: a refusal records no pet in the counter", () => {
      reset();
      plant({ "vessel stand": UP, "spirit om lares-alpha": JSON.stringify({ ok: false, error: { code: "spirit-ambiguous", message: "spirit-ambiguous: both" } }) });
      const out = JSON.parse(spawn("lares-om-hook.mjs", ["lares-alpha"], at({ source: "startup", session_id: "s-ref" })));
      assert.match(out.hookSpecificOutput.additionalContext, /spirit-ambiguous: both/);
      assert.equal(existsSync(join(counters, "stop-s-ref.json")), false);
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
    await t.test("compact: the precompact claim's epoch lands in the counter; the true-up's nudge bears it", () => {
      reset();
      writeFileSync(join(counters, "stop-s-ep.json"), JSON.stringify({ turns: 0, pet: "lares-alpha", unfiled: "file it" }));
      plant({ "vessel stand": UP, "spirit om lares-alpha --source precompact": om("the card", { epoch: 7 }), "wiki filter": JSON.stringify({ ok: true, data: { rows: [], total: 0, next: null } }) });
      spawn("lares-compact-hook.mjs", [], at({ session_id: "s-ep" }));
      assert.equal(counter("s-ep").epoch, 7);
      assert.equal(counter("s-ep").unfiled, "file it");
      const out = JSON.parse(spawn("lares-true-up-hook.mjs", [], at({ session_id: "s-ep" })));
      assert.match(out.hookSpecificOutput.additionalContext, /--epoch 7/);
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
    await t.test("rename: a fresh session (no held pet) reads its title as its own familiar, never as the seated default's rename", () => {
      reset();
      const out = JSON.parse(spawn("lares-rename-hook.mjs", ["lares-alpha"], at({ hook_event_name: "UserPromptSubmit", session_id: "s-fresh", session_title: "Lares-Awakens" })));
      assert.match(out.hookSpecificOutput.additionalContext, /names lares-awakens/);
      assert.doesNotMatch(out.hookSpecificOutput.additionalContext, /never retargets/);
      assert.equal(counter("s-fresh").title, "Lares-Awakens");
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
