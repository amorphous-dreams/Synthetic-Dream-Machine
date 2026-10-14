// The capability inventory's own instruments, each read against a planted positive, plus the committed table's source
// readings held against the source (no build needed for that half; the witness measures the doors on the built tree).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  DOORS, UNMEASURED, askMentions, stripComments, asksOf, countingDoors, differences, measureBrowserSpawn, nodeSpawnPlan, outcomeOf, poolSpawnOf, probeSource,
  seamCallSites, standInWorkerClass, webSpawnPlan,
} from "./capability-inventory.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const committed = JSON.parse(readFileSync(join(ROOT, "tools/capability-inventory.json"), "utf8"));

test("CONTROL: each reply reads as the outcome it carries, and no reply reads silent", () => {
  assert.equal(outcomeOf("fetch", { type: "cas:block", bytes: new Uint8Array([1]) }), "grants");
  assert.equal(outcomeOf("fetch", { type: "cas:block", bytes: null }), "refused");
  assert.equal(outcomeOf("rest", { type: "doc:rested", rested: true }), "grants");
  assert.equal(outcomeOf("rest", { type: "doc:rested", rested: false, why: "RestDoorRefused" }), "refused");
  assert.equal(outcomeOf("custody", { type: "custody:written", written: true }), "grants");
  assert.equal(outcomeOf("custody", { type: "custody:written", written: false }), "refused");
  assert.equal(outcomeOf("dyad", { type: "dyad:read", standing: "clear" }), "grants");
  assert.equal(outcomeOf("dyad", { type: "dyad:read", standing: "aside" }), "refused");
  for (const d of DOORS) assert.equal(outcomeOf(d, undefined), "silent");
  // A door that RAN reads as reach, though the island heard a refusal or nothing.
  assert.equal(outcomeOf("custody", [{ type: "custody:written", written: false }], true), "grants");
  assert.equal(outcomeOf("custody", undefined, true), "grants");
  // Every reply counts: a granting reply after a refusal, or before one, reads as reach.
  assert.equal(outcomeOf("dyad", [{ type: "dyad:read", standing: "aside" }, { type: "dyad:read", standing: "clear" }]), "grants");
  assert.equal(outcomeOf("dyad", [{ type: "dyad:read", standing: "clear" }, { type: "dyad:read", standing: "aside" }]), "grants");
  assert.equal(outcomeOf("dyad", [{ type: "dyad:read", standing: "aside" }, { type: "dyad:read", standing: "owing" }]), "refused");
});

test("CONTROL: the stand-in doors count each call against the open row, and a call after the row closed reads late", async () => {
  const doors = countingDoors();
  doors.open("a");
  await doors.cas("c"); doors.dyad("f", "d");
  assert.deepEqual([...doors.ran].sort(), ["dyad", "fetch"]);
  doors.close();
  await doors.custody("archive", new Uint8Array());
  assert.deepEqual(doors.late, ["custody"]);
  doors.open("b");
  assert.deepEqual([...doors.ran], [], "a late call never lands in the next row");
  await doors.rest([]);
  assert.deepEqual([...doors.ran], ["rest"]);
});

test("CONTROL: the comment scanner keeps a `/*` inside a string or after `//` from opening a block, and keeps strings whole", () => {
  const lines = stripComments([
    "// `bags/*` id derives from the path",
    "const a = answerCustodyWrite(x); // trailing /* note",
    "const g = \"bags/*\"; const h = 'x//y';",
    "const b = fetchThroughCasDoor(c);",
    "/* a real block",
    "   nodeSpawnDaemonWorker(url) */ const t = \"cas:want\";",
    "  * multiplier;",
  ].join("\n"));
  assert.deepEqual([...lines], [
    "",
    "const a = answerCustodyWrite(x); ",
    "const g = \"bags/*\"; const h = 'x//y';",
    "const b = fetchThroughCasDoor(c);",
    "",
    " const t = \"cas:want\";",
    "  * multiplier;",
  ]);
  // A regex literal holding `/*` or `//` opens nothing, and a file left inside a comment reads where it ended.
  const rx = stripComments("const GLOB = /bags\\/*x/; const U = /a\\/\\/b/;\nconst c = answerDocRest(m);\nreturn /[/*]/.test(s);\nconst d = 1;");
  assert.deepEqual([...rx], ["const GLOB = /bags\\/*x/; const U = /a\\/\\/b/;", "const c = answerDocRest(m);", "return /[/*]/.test(s);", "const d = 1;"]);
  assert.equal(rx.endsIn, "code");
  assert.equal(stripComments("const a = 1; /* never closed\nconst b = 2;").endsIn, "block");
  assert.equal(stripComments("const a = 2 / 3 / 4;\nconst b = x / y; // note /*").endsIn, "code");
});

test("CONTROL: a widened door, a new, extra or departed seam and a new ask each read red by name; an equal table reads clean", () => {
  const same = structuredClone(committed);
  assert.deepEqual(differences(same, committed), []);
  const widened = structuredClone(committed);
  widened.islands["node wiki"].rest = "grants";
  assert.ok(differences(widened, committed).some((d) => d === "node wiki rest: the table says refused, the vessel GRANTS"));
  const seam = structuredClone(committed);
  seam.callSites.push("packages/lararium-node/src/somewhere.ts: nodeSpawnDaemonWorker");
  assert.ok(differences(seam, committed).some((d) => d.includes("somewhere.ts") && d.includes("names no seam")));
  const gone = structuredClone(committed);
  gone.callSites = gone.callSites.slice(1);
  assert.ok(differences(gone, committed).some((d) => d.includes("no longer holds it")));
  // A MULTISET: a second call at a site the table already names reads red, though the SET of sites stays the same.
  const twice = structuredClone(committed);
  twice.callSites.push(twice.callSites[0]);
  assert.ok(differences(twice, committed).some((d) => d.startsWith(committed.callSites[0]) && d.includes("the source holds")));
  const asker = structuredClone(committed);
  asker.askSites.push("packages/lararium-mesh/src/vessel-island-pool-core.ts: \"custody:write\"");
  assert.ok(differences(asker, committed).some((d) => d.includes("vessel-island-pool-core.ts") && d.includes("new asker or responder")));
  const ears = structuredClone(committed);
  ears.webListeners["web wiki"] += 1;
  assert.ok(differences(ears, committed).some((d) => d.startsWith("web wiki: the spawn attaches")));
  const extra = structuredClone(committed);
  extra.islands["web other"] = { fetch: "grants", rest: "silent", custody: "silent", dyad: "silent" };
  assert.ok(differences(extra, committed).some((d) => d.startsWith("web other: measured")));
  // A row the tool cannot drive reads `unmeasured`; a later reading of `silent` there moves the table, never matches it.
  const read = structuredClone(committed);
  read.islands["web daemon"] = { ...UNMEASURED, fetch: "silent" };
  const base = structuredClone(committed);
  base.islands["web daemon"] = { ...UNMEASURED };
  assert.ok(differences(read, base).some((d) => d === "web daemon fetch: the table says unmeasured, the vessel silent"));
});

test("CONTROL: the seam scanner counts a call and a reference, each time, and passes over imports, re-exports, comments, a definition and a test file", () => {
  const files = { "/r/packages": ["pkg"], "/r/packages/pkg/src": ["a.ts", "a.test.ts", "b.d.ts"] };
  const text = {
    "/r/packages/pkg/src/a.ts": [
      "import { nodeSpawnDaemonWorker } from \"./worker-handle.js\";",
      "import {",
      "  browserSpawnWorker,",
      "  holderWorkerHandle,",
      "} from \"./worker-handle.js\";",
      "export { refuseBrowserDyadAsks } from \"./browser-dyad-door.js\";",
      "// nodeSpawnDaemonWorker(url) in a comment",
      "/**",
      " * attachBrowserDyadDoor(handle) in a doc block",
      " */",
      "export function nodeSpawnWikiWorker(url: string) {",
      "  const h = nodeSpawnSessionWorker(url);",
      "  const g = nodeSpawnSessionWorker(url);",
      "  spawnWorker: spawnWorker ?? browserSpawnWorker,",
      "import { browserSpawnWorker as spawnIt } from \"./worker-handle.js\";",
      "const k = spawnIt(url);",
      "export function wrap(h) { refuseBrowserDyadAsks(h); return h; }",
      "/* a note */ const w = new Worker(url, { type: \"module\" });",
      "/* a block that opens",
      "   nodeSpawnDaemonWorker(url) inside it",
      "*/ const s = new host.SharedWorker(url);",
      "export { a, b }",
      "  answerCustodyWrite(ask);",
      "// `bags/*` id derives from the path",
      "const viaConst = holderWorkerHandle;",
      "viaConst(port);",
      "const { attachBrowserDyadDoor: hang } = await import(\"./browser-dyad-door.js\");",
      "hang(h, door);",
      "const W = globalThis.Worker; Reflect.construct(W, [url]);",
    ].join("\n"),
    "/r/packages/pkg/src/a.test.ts": "nodeSpawnDaemonWorker(url);",
    "/r/packages/pkg/src/b.d.ts": "nodeSpawnDaemonWorker(url);",
  };
  const sites = seamCallSites("/r", (d) => files[d] ?? [], (p) => text[p]);
  assert.deepEqual([...sites].sort(), [
    "packages/pkg/src/a.ts: browserSpawnWorker as spawnIt",
    "packages/pkg/src/a.ts: nodeSpawnSessionWorker",
    "packages/pkg/src/a.ts: nodeSpawnSessionWorker",
    "packages/pkg/src/a.ts: browserSpawnWorker",
    "packages/pkg/src/a.ts: spawnIt",
    "packages/pkg/src/a.ts: refuseBrowserDyadAsks",
    "packages/pkg/src/a.ts: Worker",
    "packages/pkg/src/a.ts: SharedWorker",
    "packages/pkg/src/a.ts: answerCustodyWrite",
    "packages/pkg/src/a.ts: holderWorkerHandle as viaConst",
    "packages/pkg/src/a.ts: attachBrowserDyadDoor as hang",
    "packages/pkg/src/a.ts: holderWorkerHandle",
    "packages/pkg/src/a.ts: viaConst",
    "packages/pkg/src/a.ts: attachBrowserDyadDoor",
    "packages/pkg/src/a.ts: hang",
    "packages/pkg/src/a.ts: Worker",
  ].sort());
});

test("CONTROL: the ask scanner counts each quoted ask type and passes over comments and unquoted words", () => {
  const files = { "/r/packages": ["pkg"], "/r/packages/pkg/src": ["a.ts"] };
  const text = {
    "/r/packages/pkg/src/a.ts": [
      "// a \"cas:want\" in a comment",
      "if (m.type === \"custody:write\") reply();",
      "const t = 'dyad:ask'; const u = `doc:rest`;",
      "const word = cas:want;",
    ].join("\n"),
  };
  assert.deepEqual(askMentions("/r", (d) => files[d] ?? [], (p) => text[p]), [
    "packages/pkg/src/a.ts: \"custody:write\"",
    "packages/pkg/src/a.ts: \"dyad:ask\"",
    "packages/pkg/src/a.ts: \"doc:rest\"",
  ]);
});

test("the committed table names every seam and every ask the source holds, as many times as it holds them", () => {
  const sites = seamCallSites(ROOT);
  assert.ok(sites.length > 0, "the scanner read no seam in the tree");
  assert.deepEqual([...sites].sort(), [...committed.callSites].sort());
  const asks = askMentions(ROOT);
  assert.ok(asks.length > 0, "the scanner read no ask in the tree");
  assert.deepEqual([...asks].sort(), [...committed.askSites].sort());
});

test("CONTROL: a browser spawn over the stand-in Worker reads a planted responder as reach, a bare handle as silent, and a spawn that makes no Worker throws", async () => {
  const asks = asksOf();
  // A planted responder on the handle the spawn returns: it answers the fetch ask and refuses the custody ask.
  const planted = () => {
    const w = new globalThis.Worker("file:///x.js", { type: "module" });
    w.addEventListener("message", (e) => {
      const m = e.data;
      if (m?.type === "cas:want") w.postMessage({ type: "cas:block", requestId: m.requestId, bytes: new Uint8Array([1]) });
      if (m?.type === "custody:write") void Promise.resolve().then(() => w.postMessage({ type: "custody:written", requestId: m.requestId, written: false }));
    });
    return w;
  };
  assert.deepEqual(await measureBrowserSpawn(planted, asks, "planted"), { doors: { fetch: "grants", rest: "silent", custody: "refused", dyad: "silent" }, listeners: 1 });
  assert.deepEqual(await measureBrowserSpawn(() => new globalThis.Worker("file:///x.js"), asks, "bare"), { doors: { fetch: "silent", rest: "silent", custody: "silent", dyad: "silent" }, listeners: 0 });
  // A responder that answers only after a macrotask reads silent at the turn, and its listener still counts.
  const late = () => { const w = new globalThis.Worker("file:///x.js"); w.addEventListener("message", () => setTimeout(() => {}, 0)); return w; };
  assert.equal((await measureBrowserSpawn(late, asks, "late")).listeners, 1);
  // A door hung on `onmessage` hears the asks and counts as a listener.
  const hung = () => { const w = new globalThis.Worker("file:///x.js"); w.onmessage = (e) => { if (e.data?.type === "doc:rest") w.postMessage({ type: "doc:rested", requestId: e.data.requestId, rested: true }); }; return w; };
  assert.deepEqual(await measureBrowserSpawn(hung, asks, "hung"), { doors: { fetch: "silent", rest: "grants", custody: "silent", dyad: "silent" }, listeners: 1 });
  await assert.rejects(measureBrowserSpawn(() => null, asks, "none"), /made 0 Web Worker/);
  assert.equal(typeof globalThis.Worker, "undefined", "the stand-in Worker leaves the global as it found it");
  const { StandInWorker, spawned } = standInWorkerClass();
  new StandInWorker("file:///y.js");
  assert.equal(spawned.length, 1);
});

test("CONTROL: a pool whose host spawn stands unreachable throws by name, never reads silent", () => {
  assert.throws(() => poolSpawnOf({}, "SomePool"), /SomePool: the pool's host spawn stands unreachable/);
  const calls = [];
  const spawn = poolSpawnOf({ _host: { spawnWorker: (a) => { calls.push(a); return "h"; } } }, "P");
  assert.equal(spawn({ session: true }), "h");
  assert.deepEqual(calls, [{ session: true }]);
});

test("CONTROL: the wiki and session rows spawn through each pool's OWN host, called as the pool core calls it", () => {
  const calls = [];
  const FakePool = class { constructor(opts) { this.opts = opts; this._host = { spawnWorker: (a) => { calls.push([opts.workerScriptUrl?.href ?? null, a]); return "pooled"; } }; } };
  const handleMod = { nodeSpawnDaemonWorker: (u) => `daemon:${u.href}` };
  const probe = new URL("file:///probe.mjs");
  const node = nodeSpawnPlan(handleMod, FakePool, probe);
  assert.deepEqual(node.map(([row]) => row), ["node daemon", "node wiki", "node session"]);
  assert.deepEqual(node.map(([, spawn]) => spawn()), ["daemon:file:///probe.mjs", "pooled", "pooled"]);
  const web = webSpawnPlan(FakePool);
  assert.deepEqual(web.map(([row]) => row), ["web wiki", "web session"]);
  for (const [, spawn] of web) spawn();
  assert.deepEqual(calls, [
    ["file:///probe.mjs", undefined], ["file:///probe.mjs", { session: true }],
    ["file:///capability-probe/island.js", undefined], ["file:///capability-probe/island.js", { session: true }],
  ]);
});

test("CONTROL: the probe's handshake reads an answered ask and an unanswered one apart, with no clock", async () => {
  const asks = asksOf();
  const dir = mkdtempSync(join(tmpdir(), "capability-probe-test-"));
  try {
    const url = pathToFileURL(join(dir, "probe.mjs"));
    writeFileSync(url, probeSource(asks));
    const w = new Worker(url);
    const replies = await new Promise((resolve, reject) => {
      w.on("error", reject);
      w.on("message", (m) => {
        // A vessel side that answers the fetch ask alone, and refuses the rest ask by name.
        if (m?.type === "cas:want") w.postMessage({ type: "cas:block", requestId: m.requestId, bytes: new Uint8Array([1]) });
        if (m?.type === "doc:rest") w.postMessage({ type: "doc:rested", requestId: m.requestId, rested: false });
        if (m?.type === "custody:write") assert.ok(m.bytes instanceof Uint8Array, "the probe carries its bytes as bytes");
        if (m?.type === "probe:done") setImmediate(() => w.postMessage({ type: "probe:end" }));
        if (m?.type === "probe:result") resolve(m.replies);
      });
    });
    await w.terminate();
    const read = Object.fromEntries(asks.map((a) => [a.door, outcomeOf(a.door, replies[a.msg.requestId])]));
    assert.deepEqual(read, { fetch: "grants", rest: "refused", custody: "silent", dyad: "silent" });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
