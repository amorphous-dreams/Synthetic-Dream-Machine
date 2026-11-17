// The wake's pure parts under an injected runner: no container, no Docker, no child process (road `L43`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const core = await import(resolve("packages/lares-cli/.claude-plugin/hooks/lares-wake-core.mjs"));
const { wake, compactCarry, renderIndex, indexArgv, stateArgv, INDEX_BYTES, WAKE_BUDGET_MS, STATE_PREFIX, STATE_FILTER, STATE_ROWS } = core;

const UP = JSON.stringify({ data: { node: { up: true, port: 4321 } } });
const row = (key, description) => ({ title: `lar:///ha.ka.ba/kahua/memory/${key}`, fields: { title: `lar:///ha.ka.ba/kahua/memory/${key}`, description } });
const page = (rows, extra = {}) => JSON.stringify({ ok: true, requestId: "r", data: { recipe: "default", filter: "[tag[stage/index]]", rows, total: rows.length, next: null, asOf: "90a1a6dbea5e1f15", ...extra } });
const answered = (stdout, code = 0) => ({ done: Promise.resolve({ stdout, code, signal: null }), kill() {} });
const hung = (log, name) => ({ done: new Promise(() => {}), kill() { log.push(name); } });
/** A runner answering each read by name; `calls` records the argv each read rode. */
const runner = (answers, calls = {}) => (name, argv) => { calls[name] = argv; return answers[name]; };

test("the wake carries the memory index beside the frame and the homes line", async () => {
  const calls = {};
  const context = await wake({ run: runner({
    observe: answered(UP),
    index: answered(page([row("project/house-laws", "The seven house laws."), row("state/open-ledger", "What stands open.")])),
    homes: answered("home reading\n"),
  }, calls) });
  assert.match(context, /"up":true/);
  assert.match(context, /Lares homes: home reading/);
  assert.match(context, /Lares memory index: 2 rows\n/);
  assert.match(context, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/project\/house-laws — The seven house laws\.\n/);
  assert.match(context, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/open-ledger — What stands open\.\n/);
  assert.match(context, /read a row: meme_get\(uri=<title>, recipe="default"\)/);
  assert.doesNotMatch(context, /after=/);
  // The read rides the vessel's own door: the daemon wiki, the index tag, title and description, a row limit, a byte cap.
  assert.deepEqual(calls.index, ["wiki", "filter", "[tag[stage/index]!prefix[lar:///ha.ka.ba/kahua/memory/state/]]", "--recipe", "default", "--fields", "title,description", "--limit", "32", "--max-bytes", String(INDEX_BYTES), "--json"]);
  assert.deepEqual(calls.index, indexArgv());
  assert.deepEqual(calls.observe, ["vessel", "stand", "--observe", "--json"]);
});

test("a page with a cursor names the call that reads further", async () => {
  const context = await wake({ run: runner({
    observe: answered(UP), homes: answered("h"),
    index: answered(page([row("a/one", "One."), row("a/two", "Two.")], { total: 6, next: "2.90a1a6dbea5e1f15" })),
  }) });
  assert.match(context, /Lares memory index: 6 rows \(2 shown\)\n/);
  assert.match(context, /read further: wiki_filter\(filter="\[tag\[stage\/index\]!prefix\[lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/\]\]", recipe="default", fields=\["title","description"\], after="2\.90a1a6dbea5e1f15"\)/);
});

test("the byte cap cuts the index and says so", () => {
  const rows = Array.from({ length: 32 }, (_, i) => row(`big/row-${i}`, "x".repeat(400)));
  const block = renderIndex(JSON.parse(page(rows)), 2048);
  assert.ok(Buffer.byteLength(block) <= 2048 + 400, `the block holds ${Buffer.byteLength(block)} bytes`);
  const shown = block.split("\n").filter((l) => l.startsWith("lar:///")).length;
  assert.ok(shown > 0 && shown < 32, `${shown} rows shown`);
  assert.match(block, new RegExp(`Lares memory index: 32 rows \\(${shown} shown\\)`));
  assert.match(block, /cut at the wake's byte cap/);
  // A row whose own line outruns the cap alone still shows, its description cut.
  const one = renderIndex(JSON.parse(page([row("big/one", "y".repeat(9000))])), 512);
  assert.match(one, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/big\/one — y+…/);
  assert.ok(Buffer.byteLength(one) <= 512 + 400);
});

test("a fault reads unread by its cause, and the wake still carries everything else", async () => {
  const refused = JSON.stringify({ ok: false, error: { code: "vessel-locked", message: "the vessel stands locked" } });
  for (const [answer, cause] of [
    [answered(refused, 4), /memory index unread: vessel-locked: the vessel stands locked/],
    [answered("compose: pulling\n", 0), /memory index unread: the read's answer did not parse \(exit 0\)/],
    [answered("", 127), /memory index unread: the read exited 127 with no answer/],
    [{ done: Promise.resolve({ stdout: "", code: null, signal: null, error: "ENOENT" }), kill() {} }, /memory index unread: the read did not start \(ENOENT\)/],
  ]) {
    const context = await wake({ run: runner({ observe: answered(UP), homes: answered("home reading"), index: answer }) });
    assert.match(context, cause);
    assert.match(context, /"up":true/);
    assert.match(context, /Lares homes: home reading/);
    assert.doesNotMatch(context, /Lares memory index: \d+ rows/);
  }
});

test("a vessel that answers down skips the index read and says so once", async () => {
  const killed = [];
  const context = await wake({ run: runner({
    observe: answered(JSON.stringify({ data: { node: { up: false } } })),
    index: hung(killed, "index"),
    homes: answered("home reading"),
  }) });
  assert.match(context, /vessel down \(the observation answered node\.up false\)/);
  assert.equal(context.match(/memory index/g)?.length, 1);
  assert.match(context, /memory index skipped: no vessel answers/);
  assert.doesNotMatch(context, /unread/);
  assert.deepEqual(killed, ["index"]);
  assert.match(context, /Lares homes: home reading/);
});

test("one budget bounds all three reads, and each read left open reports itself", async () => {
  const killed = [];
  const t0 = performance.now();
  const context = await wake({ budgetMs: 40, run: runner({ observe: hung(killed, "observe"), index: hung(killed, "index"), homes: hung(killed, "homes") }) });
  assert.ok(performance.now() - t0 < 2000, "the wake closed with its budget");
  assert.match(context, /vessel observation timed out/);
  assert.match(context, /Lares homes: lares home read gave no answer inside the wake's budget/);
  assert.deepEqual(killed.sort(), ["homes", "index", "observe"]);
  // A slow index beside an answering vessel reports itself as unread.
  const slow = await wake({ budgetMs: 40, run: runner({ observe: answered(UP), index: hung([], "index"), homes: answered("h") }) });
  assert.match(slow, /memory index unread: no answer inside the wake's budget/);
  // The budget closes inside the harness's own bound, which stays the only clock: the registration's timeout.
  const hooks = JSON.parse(readFileSync(resolve("packages/lares-cli/.claude-plugin/hooks/hooks.json"), "utf8"));
  for (const event of ["SessionStart", "PreCompact"]) {
    const timeout = hooks.hooks[event][0].hooks[0].timeout;
    assert.ok(WAKE_BUDGET_MS + 2000 <= timeout * 1000, `${event}: the budget ${WAKE_BUDGET_MS} ms closes two seconds inside the harness's ${timeout} s`);
  }
});

test("wake-index-lists-the-rest: the index leaves the state rows to their own block", () => {
  const { INDEX_FILTER } = core;
  assert.equal(INDEX_FILTER, `[tag[stage/index]!prefix[${STATE_PREFIX}]]`);
  assert.equal(indexArgv()[2], INDEX_FILTER);
  // The render keeps the door's order: the wake never re-sorts.
  const block = renderIndex(JSON.parse(page([row("project/first", "F."), row("feedback/second", "S.")])));
  assert.ok(block.indexOf("project/first") < block.indexOf("feedback/second"));
});

// The rows in play: the state rows, derived by their address prefix, read on every wake and printed before the index.
const STATE = [
  row("state/porch-2026-11-16", "The porch: what the last sitting left on the step."),
  row("state/open-ledger", "What stands open."),
  row("state/handoff", "Start here: the handoff from the last controller."),
  row("state/standing-orders", "The orders that stand."),
];
const statePage = (rows, extra = {}) => JSON.stringify({ ok: true, requestId: "s", data: { recipe: "default", filter: STATE_FILTER, rows, total: rows.length, next: null, asOf: "90a1a6dbea5e1f15", ...extra } });

test("wake-leads-with-rows-in-play: every wake prints the state rows before the index, the handoff first", async () => {
  for (const source of ["startup", "resume", "clear", "compact", ""]) {
    const calls = {};
    const context = await wake({ source, run: runner({
      observe: answered(UP), homes: answered("h"),
      index: answered(page([row("project/house-laws", "The seven house laws.")])),
      state: answered(statePage(STATE)),
    }, calls) });
    const lines = context.split("\n");
    const head = lines.findIndex((l) => l.startsWith("Lares rows in play"));
    assert.ok(head > 0, `${source}: the rows in play stand in the wake`);
    assert.ok(head < lines.findIndex((l) => l.startsWith("Lares memory index")), `${source}: the rows in play come before the index`);
    assert.match(lines[head], /^Lares rows in play \(start here\): 4 rows/);
    assert.equal(lines[head + 1], "lar:///ha.ka.ba/kahua/memory/state/handoff — Start here: the handoff from the last controller.");
    // The rest keep the door's own order.
    assert.equal(lines[head + 2], "lar:///ha.ka.ba/kahua/memory/state/porch-2026-11-16 — The porch: what the last sitting left on the step.");
    assert.equal(lines[head + 4], "lar:///ha.ka.ba/kahua/memory/state/standing-orders — The orders that stand.");
    assert.match(lines[head + 5], /read a row: meme_get\(uri=<title>, recipe="default"\)/);
    // The read derives the rows by their address prefix, slot titles (`…#/entry`) left out: no list of addresses rides the wake.
    // No sort by `modified`: the stage memes carry no such field, so the door's title order stands.
    assert.deepEqual(calls.state, stateArgv());
    assert.equal(calls.state[2], `[prefix[${STATE_PREFIX}]!regexp[#]]`);
  }
  // CONTROL: no handoff row leaves the door's order as it stands.
  const bare = await wake({ run: runner({ observe: answered(UP), homes: answered("h"), index: answered(page([])), state: answered(statePage(STATE.filter((r) => !r.title.endsWith("/handoff")))) }) });
  assert.match(bare, /Lares rows in play \(start here\): 3 rows\nlar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/porch-2026-11-16/);
});

test("wake-leads-with-rows-in-play: the block stays short, and a fault or an empty prefix names itself", async () => {
  const base = { observe: answered(UP), homes: answered("h"), index: answered(page([])) };
  const many = Array.from({ length: 20 }, (_, i) => row(`state/row-${String(i).padStart(2, "0")}`, "z".repeat(900)));
  const long = await wake({ run: runner({ ...base, state: answered(statePage(many.slice(0, STATE_ROWS), { total: 20, next: `${STATE_ROWS}.90a1a6dbea5e1f15` })) }) });
  const shown = long.split("\n").filter((l) => l.startsWith("lar:///ha.ka.ba/kahua/memory/state/"));
  assert.ok(shown.length > 0 && shown.length <= STATE_ROWS, `${shown.length} rows shown`);
  for (const line of shown) assert.ok(Buffer.byteLength(line) <= 400, `a row line holds ${Buffer.byteLength(line)} bytes`);
  assert.match(long, /Lares rows in play \(start here\): 20 rows \(\d+ shown\)/);
  assert.match(long, /(read further|read the whole view): wiki_filter\(filter="\[prefix\[lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/\]!regexp\[#\]\]"/);
  const none = await wake({ run: runner({ ...base, state: answered(statePage([])) }) });
  assert.match(none, /Lares rows in play: no row stands under lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/state\/ in the worn face's daemon wiki/);
  const broken = await wake({ run: runner({ ...base, state: answered("", 127) }) });
  assert.match(broken, /Lares rows in play unread: the read exited 127 with no answer; the view: wiki_filter\(filter="\[prefix/);
  // CONTROL: a vessel that answers down reads no state rows and says the memory skip once.
  const killed = [];
  const down = await wake({ run: runner({ ...base, observe: answered(JSON.stringify({ data: { node: { up: false } } })), index: hung(killed, "index"), state: hung(killed, "state") }) });
  assert.doesNotMatch(down, /rows in play/);
  assert.deepEqual(killed.sort(), ["index", "state"]);
});

test("the compaction carry hands the summary the rows in play and the index", async () => {
  const text = await compactCarry({ run: runner({ index: answered(page([row("project/house-laws", "The seven house laws.")])), state: answered(statePage(STATE)) }) });
  assert.match(text, /^Lares compaction carry: keep every `lar:` address below verbatim in the summary/);
  assert.ok(text.indexOf("Lares rows in play") < text.indexOf("Lares memory index: 1 rows\n"));
  assert.match(text, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/project\/house-laws — The seven house laws\./);
  for (const r of STATE) assert.ok(text.includes(r.title), r.title);
  // A fault names its cause and the other read rides on.
  const faulted = await compactCarry({ run: runner({ index: answered("", 1), state: answered(statePage(STATE)) }) });
  assert.match(faulted, /memory index unread: the read exited 1 with no answer/);
  assert.ok(faulted.includes("lar:///ha.ka.ba/kahua/memory/state/handoff"));
  const slow = await compactCarry({ budgetMs: 30, run: runner({ index: hung([], "index"), state: hung([], "state") }) });
  assert.match(slow, /memory index unread: no answer inside the wake's budget/);
  assert.match(slow, /Lares rows in play unread: no answer inside the wake's budget/);
});

// Road `L48`: the wake shows the lei and the unmatched tessera halves; each read stands behind a port, answered here by fixtures.
const { leiArgv, halvesArgv, gitArgv, unmatchedHalves, LOCKED_LINE } = core;
const SHA = "0123456789abcdef0123456789abcdef01234567";
const CID = "a".repeat(64);
const gitHead = () => answered(`${SHA}\nlane/l48-wake\n`);
const lei = (data) => answered(JSON.stringify({ ok: true, data }));

test("wake-names-the-lei: the wake names the lei a session wears at its branch, one read per rite", async () => {
  const calls = [];
  const run = (name, argv) => {
    calls.push([name, argv]);
    return ({
      observe: answered(UP), homes: answered("h"), index: answered(page([])), git: gitHead(),
      lei: lei(argv[3] === "push" ? { lei: { standing: true, after: CID } } : { lei: { standing: false, refusal: "absent", after: null } }),
    })[name];
  };
  const context = await wake({ run });
  assert.match(context, new RegExp(`Lares lei: this session wears push \\(follows ${"a".repeat(12)}\\) at lane/l48-wake@01234567`));
  assert.doesNotMatch(context, /kukulu \(/);
  assert.deepEqual(calls.filter(([n]) => n === "lei").map(([, a]) => a), [leiArgv("push", "lane/l48-wake", SHA), leiArgv("kukulu", "lane/l48-wake", SHA)]);
  assert.deepEqual(calls.find(([n]) => n === "git")[1], gitArgv());
});

test("wake-names-the-lei: a standing lei reads as worn, a fork names its tips, and no lei reads as none worn", async () => {
  const base = { observe: answered(UP), homes: answered("h"), index: answered(page([])), git: gitHead() };
  const old = await wake({ run: runner({ ...base, lei: lei({ lei: { standing: true, after: null } }) }) });
  assert.match(old, /wears push \(the branch's first\), kukulu \(the branch's first\) at/);
  const forked = await wake({ run: runner({ ...base, lei: lei({ lei: { standing: false, refusal: "forked", after: null, forks: [CID, "b".repeat(64)] } }) }) });
  assert.match(forked, new RegExp(`push forked at ${"a".repeat(12)} \\| ${"b".repeat(12)}`));
  const none = await wake({ run: runner({ ...base, lei: lei({ lei: { standing: false, refusal: "absent", after: null } }) }) });
  assert.match(none, /Lares lei: none worn at lane\/l48-wake@01234567/);
});

test("wake-names-the-lei: a locked vessel gives the operator's call, and a read fault names its cause", async () => {
  const base = { observe: answered(UP), homes: answered("h"), index: answered(page([])), git: gitHead() };
  const locked = await wake({ run: runner({ ...base, lei: answered(JSON.stringify({ ok: false, error: { code: "vessel-locked", message: "vessel-locked: run lares vault unlock" } }), 4) }) });
  assert.ok(locked.includes(LOCKED_LINE));
  assert.match(LOCKED_LINE, /tell the operator now/);
  const broken = await wake({ run: runner({ ...base, lei: answered("", 127) }) });
  assert.match(broken, /Lares lei unread: push: the read exited 127 with no answer; kukulu: /);
  // CONTROL: a runner that wires no lei, git or halves port leaves the wake as it stood.
  const plain = await wake({ run: runner({ observe: answered(UP), homes: answered("h"), index: answered(page([])) }) });
  assert.doesNotMatch(plain, /Lares lei|tessera conferre/);
  // CONTROL: a vessel that answers down starts no lei read.
  const down = await wake({ run: runner({ ...base, observe: answered(JSON.stringify({ data: { node: { up: false } } })), lei: lei({ lei: { standing: true } }) }) });
  assert.doesNotMatch(down, /Lares lei/);
});

test("wake-names-unmatched-half: a begun half without its landed, and a landed without its begun, each name themselves", async () => {
  const receipts = [
    { act: "rite-begun", rite: "push", tessera: "t-one" }, { act: "rite-landed", rite: "push", tessera: "t-one" },
    { act: "rite-begun", rite: "kukulu", tessera: "t-two" },
    { act: "rite-landed", rite: "push", tessera: "t-three" },
  ];
  assert.deepEqual(unmatchedHalves(receipts), [{ half: "begun", rite: "kukulu", tessera: "t-two" }, { half: "landed", rite: "push", tessera: "t-three" }]);
  const calls = {};
  const context = await wake({ run: runner({
    observe: answered(UP), homes: answered("h"), index: answered(page([])), halves: answered(JSON.stringify({ ok: true, data: { receipts } })),
  }, calls) });
  assert.match(context, /Lares tessera conferre: 1 par, 2 red \(no match\): kukulu t-two guest half begun, no host half landed; push t-three host half landed, no guest half begun/);
  assert.deepEqual(calls.halves, halvesArgv());
  // CONTROL: every half paired reads as one standing line.
  const paired = await wake({ run: runner({ observe: answered(UP), homes: answered("h"), index: answered(page([])), halves: answered(JSON.stringify({ ok: true, data: { receipts: receipts.slice(0, 2) } })) }) });
  assert.match(paired, /Lares tessera conferre: 1 par, every half has its match/);
  assert.deepEqual(unmatchedHalves(undefined), []);
});

// The keep rite: the wake reads the keep line at the workspace the house config names, and names a red keep tessera with its cure.
const { keepArgv, keepWorkspaceOf } = core;
const BUNDLE = "f".repeat(64);
const TESSERA = "9".repeat(64);

test("wake-names-the-keep-line: the wake reads the keep lei at the configured keep workspace and names it", async () => {
  const calls = [];
  const base = { observe: answered(UP), homes: answered("h"), index: answered(page([])) };
  const run = (name, argv) => { calls.push([name, argv]); return ({ ...base, keep: lei({ lei: { standing: true, reach: "wide", returnsLeft: 11, after: CID } }) })[name]; };
  const context = await wake({ run, keepWorkspace: "backup" });
  assert.match(context, /Lares keep: a keep lei stands for workspace "backup" with 11 returns left; `lares rite keep --workspace backup` spends one/);
  assert.deepEqual(calls.find(([n]) => n === "keep")[1], keepArgv("backup"));
  assert.deepEqual(keepArgv("backup"), ["lei", "show", "--rite", "keep", "--branch", "backup", "--json"]);
  const none = await wake({ run: runner({ ...base, keep: lei({ lei: { standing: false, refusal: "absent", after: null } }) }), keepWorkspace: "backup" });
  assert.match(none, /Lares keep: no keep lei stands for workspace "backup" \(absent\); `lares vault unlock` offers one, or by hand: lares lei kui --rite keep --branch backup --returns <n>/);
  const broken = await wake({ run: runner({ ...base, keep: answered("", 127) }), keepWorkspace: "backup" });
  assert.match(broken, /Lares keep unread: the read exited 127 with no answer/);
  // CONTROL: a house config that names no keep workspace reads no keep line.
  const calls2 = {};
  const plain = await wake({ run: runner({ ...base, keep: lei({ lei: { standing: true } }) }, calls2), keepWorkspace: null });
  assert.doesNotMatch(plain, /Lares keep/);
  assert.equal(calls2.keep, undefined);
  // The keep workspace reads as the CLI reads it: LARES_KEEP_WORKSPACE, else the one LARES_WORKSPACES pair.
  assert.equal(keepWorkspaceOf({ LARES_KEEP_WORKSPACE: "backup" }, null), "backup");
  assert.equal(keepWorkspaceOf({}, "LARES_WORKSPACES=backup=/srv/b\n"), "backup");
  assert.equal(keepWorkspaceOf({ LARES_WORKSPACES: "a=/x;b=/y" }, null), null);
  assert.equal(keepWorkspaceOf({}, null), null);
});

test("wake-names-a-red-keep-tessera-and-its-cure: a keep cut and never landed names its workspace, its bundle and the rite that lands it", async () => {
  const receipts = [{ act: "rite-begun", rite: "keep", tessera: TESSERA }];
  const conferre = { par: [], red: [{ tessera: TESSERA, rite: "keep", red: "landed-absent", branch: "backup", head: BUNDLE }] };
  const context = await wake({ run: runner({
    observe: answered(UP), homes: answered("h"), index: answered(page([])), halves: answered(JSON.stringify({ ok: true, data: { receipts, conferre } })),
  }) });
  assert.match(context, /Lares tessera conferre: 0 par, 1 red/);
  assert.match(context, new RegExp(`Lares keep red: tessera ${"9".repeat(12)} \\(workspace "backup", bundle ${"f".repeat(16)}\\) reads landed-absent: cut and never landed; cure: lares rite keep --workspace backup \\(it pushes what waits and lands it\\)`));
  // CONTROL: a red half of another rite names no keep cure.
  const other = await wake({ run: runner({
    observe: answered(UP), homes: answered("h"), index: answered(page([])),
    halves: answered(JSON.stringify({ ok: true, data: { receipts: [{ act: "rite-begun", rite: "kukulu", tessera: "t-two" }], conferre: { par: [], red: [{ tessera: "t-two", rite: "kukulu", red: "landed-absent", branch: "main", head: SHA }] } } })),
  }) });
  assert.doesNotMatch(other, /Lares keep red/);
});
