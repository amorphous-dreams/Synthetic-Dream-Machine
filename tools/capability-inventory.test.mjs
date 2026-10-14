// The capability inventory's own instruments, each read against a planted positive, plus the committed table's seams
// held against the source (no build needed for that half; the witness measures the doors on the built tree).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { DOORS, asksOf, differences, outcomeOf, probeSource, seamCallSites } from "./capability-inventory.mjs";

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
});

test("CONTROL: a widened door, a new seam and a seam that left each read red by name; an equal table reads clean", () => {
  const same = structuredClone(committed);
  assert.deepEqual(differences(same, committed), []);
  const widened = structuredClone(committed);
  widened.islands["node wiki"].rest = "grants";
  assert.ok(differences(widened, committed).some((d) => d === "node wiki rest: the table says refused, the vessel GRANTS"));
  const seam = structuredClone(committed);
  seam.callSites.push("packages/lararium-node/src/somewhere.ts: nodeSpawnDaemonWorker(…");
  assert.ok(differences(seam, committed).some((d) => d.includes("somewhere.ts") && d.includes("names no seam")));
  const gone = structuredClone(committed);
  gone.callSites = gone.callSites.slice(1);
  assert.ok(differences(gone, committed).some((d) => d.includes("no longer holds it")));
  const extra = structuredClone(committed);
  extra.islands["web session"] = { fetch: "grants", rest: "silent", custody: "silent", dyad: "silent" };
  assert.ok(differences(extra, committed).some((d) => d.startsWith("web session: measured")));
});

test("CONTROL: the seam scanner counts a call and passes over a comment, a definition and a test file", () => {
  const files = {
    "/r/packages": ["pkg"],
    "/r/packages/pkg/src": ["a.ts", "a.test.ts", "b.d.ts"],
  };
  const text = {
    "/r/packages/pkg/src/a.ts": [
      "// nodeSpawnDaemonWorker(url) in a comment",
      " * attachBrowserDyadDoor(handle) in a doc block",
      "export function nodeSpawnWikiWorker(url: string) {",
      "  const h = nodeSpawnSessionWorker(url);",
    ].join("\n"),
    "/r/packages/pkg/src/a.test.ts": "nodeSpawnDaemonWorker(url);",
    "/r/packages/pkg/src/b.d.ts": "nodeSpawnDaemonWorker(url);",
  };
  const sites = seamCallSites("/r", (d) => files[d] ?? [], (p) => text[p]);
  assert.deepEqual(sites, ["packages/pkg/src/a.ts: nodeSpawnSessionWorker(…"]);
});

test("the committed table names every seam the source holds, and no other", () => {
  const sites = seamCallSites(ROOT);
  assert.ok(sites.length > 0, "the scanner read no seam in the tree");
  assert.deepEqual([...sites].sort(), [...committed.callSites].sort());
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
