// The wake's pure parts under an injected runner: no container, no Docker, no child process (road `L43`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const core = await import(resolve("packages/lares-cli/.claude-plugin/hooks/lares-wake-core.mjs"));
const { wake, compactCarry, renderIndex, indexArgv, INDEX_BYTES, WAKE_BUDGET_MS, ROWS_IN_PLAY } = core;

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
  assert.deepEqual(calls.index, ["wiki", "filter", "[tag[stage/index]]", "--recipe", "default", "--fields", "title,description", "--limit", "32", "--max-bytes", String(INDEX_BYTES), "--json"]);
  assert.deepEqual(calls.index, indexArgv());
  assert.deepEqual(calls.observe, ["vessel", "stand", "--observe", "--json"]);
});

test("a page with a cursor names the call that reads further", async () => {
  const context = await wake({ run: runner({
    observe: answered(UP), homes: answered("h"),
    index: answered(page([row("a/one", "One."), row("a/two", "Two.")], { total: 6, next: "2.90a1a6dbea5e1f15" })),
  }) });
  assert.match(context, /Lares memory index: 6 rows \(2 shown\)\n/);
  assert.match(context, /read further: wiki_filter\(filter="\[tag\[stage\/index\]\]", recipe="default", fields=\["title","description"\], after="2\.90a1a6dbea5e1f15"\)/);
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

test("a wake after a compaction carries the rows in play by address", async () => {
  const run = runner({ observe: answered(UP), homes: answered("h"), index: answered(page([row("state/open-ledger", "What stands open.")])) });
  const after = await wake({ run, source: "compact" });
  for (const uri of ROWS_IN_PLAY) assert.ok(after.includes(uri), uri);
  assert.match(after, /Lares rows in play/);
  const cold = await wake({ run, source: "startup" });
  assert.doesNotMatch(cold, /Lares rows in play/);
});

test("the compaction carry hands the summary the index and the rows in play", async () => {
  const text = await compactCarry({ run: runner({ index: answered(page([row("project/house-laws", "The seven house laws.")])) }) });
  assert.match(text, /^Lares compaction carry: keep every `lar:` address below verbatim in the summary/);
  assert.match(text, /Lares memory index: 1 rows\n/);
  assert.match(text, /lar:\/\/\/ha\.ka\.ba\/kahua\/memory\/project\/house-laws — The seven house laws\./);
  for (const uri of ROWS_IN_PLAY) assert.ok(text.includes(uri), uri);
  assert.deepEqual(ROWS_IN_PLAY, ["lar:///ha.ka.ba/kahua/memory/state/open-ledger", "lar:///ha.ka.ba/kahua/memory/state/standing-orders"]);
  // A fault still carries the addresses: the read names its cause and the rows in play ride on.
  const faulted = await compactCarry({ run: runner({ index: answered("", 1) }) });
  assert.match(faulted, /memory index unread: the read exited 1 with no answer/);
  for (const uri of ROWS_IN_PLAY) assert.ok(faulted.includes(uri), uri);
  const slow = await compactCarry({ budgetMs: 30, run: runner({ index: hung([], "index") }) });
  assert.match(slow, /memory index unread: no answer inside the wake's budget/);
});
