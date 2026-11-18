/**
 * The vessel's capabilities, by the class of island that asks: an island reaches only the capabilities its class owns,
 * and only through the record its vessel handed it at construction.
 *
 *   D1  a WIKI island that posts `custody:write` reaches no custody capability: the function never runs, the
 *       island reads `written: false` naming `CustodyWriteRefused`, and the refusal logs once however often it asks.
 *                                                 control: the DAEMON island's same ask reaches the capability, with
 *                                                 the exact carrier and bytes, and reads `written: true`
 *   D2  a wiki island whose record carries no receipt reads `issued: false` naming `ReceiptRefused`; where the record
 *       grants it, its worker stays silent (the pool answers).   control: the daemon island's ask reaches the capability
 *   D9  exactly ONE party answers each receipt requestId through the real pool: the pool where the record grants `receipt`,
 *       the island's worker where it lacks it; a vessel whose lift grants none gets none from a neighbour's repo.
 *   D3  a wiki island's `cas:want` reaches its record's `cas` (a wiki reads the blobs its own tiddlers name).
 *                                                 control: with no `cas` standing it reads a miss
 *   D4  a SESSION island reaches none of the three: a custody ask and a receipt ask draw no answer at all, and a
 *       fetch ask draws none either.              control: the same three asks on a daemon island each draw one
 *   D7  two vessels in ONE process keep separate capabilities: each daemon island answers through its OWN record,
 *       and a record the second vessel stands never overwrites the first's (the global setter this record replaced).
 *   D8  a daemon island handed NO receipt capability refuses a receipt ask by name (`ReceiptCapabilityUnavailable`).
 */
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi, afterEach } from "vitest";
import { next as A } from "@automerge/automerge";
import { Repo, type DocHandle } from "@automerge/automerge-repo";
import { VesselIslandPoolCore, emptyLarDoc, mkEa, mkTeardownAck, type CapabilityRecord, type LarDoc, type VesselIslandHost } from "@lararium/mesh";
import { nodeWorkerHandle } from "../src/worker-handle.js";

/** The worker type the handle wraps, read off the handle itself: this suite stands no thread, only an emitter. */
type Worker = Parameters<typeof nodeWorkerHandle>[0];

/** A stand-in worker: an emitter whose `postMessage` collects what the vessel answers. */
function island(): { worker: Worker; said: Array<Record<string, unknown>>; ask(msg: unknown): Promise<void> } {
  const emitter = new EventEmitter();
  const said: Array<Record<string, unknown>> = [];
  const worker = Object.assign(emitter, {
    postMessage: (m: unknown) => { said.push(m as Record<string, unknown>); },
    terminate: async () => 0,
  }) as unknown as Worker;
  return {
    worker, said,
    async ask(msg) { emitter.emit("message", msg); await new Promise((r) => setTimeout(r, 10)); },
  };
}

const custodyAsk = (requestId: string) => ({ type: "custody:write", requestId, carrier: "veil", bytes: new Uint8Array([7, 7, 7]) });
const receiptAsk = (requestId: string) => ({ type: "receipt:request", requestId, documentIds: ["doc-a"] });
const dyadAsk = (requestId: string) => ({ type: "dyad:ask", requestId, fleetRoot: "fleet", deviceKey: "device" });
const casAsk = (requestId: string) => ({ type: "cas:want", requestId, cid: "sha256:" + "ab".repeat(32) });

afterEach(() => { vi.restoreAllMocks(); });

describe("the vessel's doors answer by island class", () => {
  test("D1 — a wiki island's custody write reaches no capability and refuses by name, once in the log", async () => {
    const sealed: Array<[string, Uint8Array]> = [];
    const caps: CapabilityRecord = { custodyWrite: async (carrier, bytes) => { sealed.push([carrier, bytes]); } };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki", caps });
    await wiki.ask(custodyAsk("w1"));
    await wiki.ask(custodyAsk("w2"));
    expect(sealed).toEqual([]);
    expect(wiki.said.map((m) => [m["type"], m["requestId"], m["written"]])).toEqual([["custody:written", "w1", false], ["custody:written", "w2", false]]);
    expect(String(wiki.said[0]!["why"])).toMatch(/CustodyWriteRefused/);
    expect(warn.mock.calls.filter((c) => /CustodyWriteRefused/.test(String(c[0])))).toHaveLength(1);

    // control: the daemon island's ask lands
    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon", caps });
    await daemon.ask(custodyAsk("d1"));
    expect(sealed).toEqual([["veil", new Uint8Array([7, 7, 7])]]);
    expect(daemon.said.map((m) => [m["type"], m["requestId"], m["written"]])).toEqual([["custody:written", "d1", true]]);
  });

  test("D2 — a wiki island whose record carries no receipt draws the named refusal and reaches no capability; one whose record grants it draws none from its worker (the pool answers)", async () => {
    const rested: string[][] = [];
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const wiki = island();
    const bare = nodeWorkerHandle(wiki.worker, { island: "wiki", caps: {} });
    await wiki.ask(receiptAsk("w1"));
    expect(wiki.said.map((m) => [m["type"], m["requestId"], m["issued"]])).toEqual([["receipt:issued", "w1", false]]);
    expect(String(wiki.said[0]!["why"])).toMatch(/ReceiptRefused/);
    expect(bare.grants?.()).toEqual({ receipt: false });

    // control: with the grant on the record the worker stays silent and the handle declares the grant the pool reads
    const caps: CapabilityRecord = { receipt: async (ids) => { rested.push([...ids]); } };
    const lifted = island();
    const handle = nodeWorkerHandle(lifted.worker, { island: "wiki", caps });
    await lifted.ask(receiptAsk("w2"));
    expect(lifted.said).toEqual([]);
    expect(rested, "a wiki island never reaches the vessel's receipt function itself").toEqual([]);
    expect(handle.grants?.()).toEqual({ receipt: true });
    delete caps.receipt;   // the lift withdraws: the refusal and the grant both follow the record at ask time
    await lifted.ask(receiptAsk("w3"));
    expect(lifted.said.map((m) => [m["requestId"], m["issued"]])).toEqual([["w3", false]]);
    expect(handle.grants?.()).toEqual({ receipt: false });

    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon", caps: { receipt: async (ids) => { rested.push([...ids]); } } });
    await daemon.ask(receiptAsk("d1"));
    expect(rested).toEqual([["doc-a"]]);
    expect(daemon.said.map((m) => [m["type"], m["issued"]])).toEqual([["receipt:issued", true]]);
  });

  test("D9 — through the real pool exactly ONE party answers each receipt requestId, granted or not, and a vessel whose lift grants none gets none from its neighbour's repo", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const repoOf = (): { repo: Repo; doc: DocHandle<LarDoc>; read: () => number } => {
      const repo = new Repo({ network: [] });
      const doc = repo.create<LarDoc>(emptyLarDoc());
      let reads = 0;
      const table = repo.handles;
      Object.defineProperty(repo, "handles", { get() { reads++; return table; } });
      return { repo, doc, read: () => reads };
    };
    const rig = (caps: CapabilityRecord, repo: Repo) => {
      const emitters = new Map<string, ReturnType<typeof island>>();
      let next = "";
      const host: VesselIslandHost = {
        spawnWorker() {
          const stand = island();
          emitters.set(next, stand);
          // the stand-in answers the pool's own handshake so the mount completes
          const post = stand.worker.postMessage.bind(stand.worker) as (m: unknown) => void;
          (stand.worker as unknown as { postMessage: (m: unknown) => void }).postMessage = (m) => {
            post(m);
            const type = (m as { type?: string }).type;
            if (type === "manifest" || type === "teardown") queueMicrotask(() => (stand.worker as unknown as EventEmitter).emit("message", type === "manifest" ? mkEa("wiki") : mkTeardownAck()));
          };
          return nodeWorkerHandle(stand.worker, { island: "wiki", caps });
        },
        newSyncChannel() { const c = new MessageChannel(); return { mainPort: c.port1, syncPort: c.port2 }; },
        storage: () => undefined,
      };
      const pool = new VesselIslandPoolCore({ host, mainRepo: repo, resolvePluginCids: async () => ({ ok: true, pluginCids: [] }) });
      return { pool, async mount(id: string) { next = id; await pool.mountWiki(id, { coreHash: null, recipe: { wikiSlug: id }, grants: { islandUrl: "automerge:fixture", wikiUrl: null } }); return emitters.get(id)!; } };
    };
    const receipts = (stand: ReturnType<typeof island>, requestId: string) => stand.said.filter((m) => m["type"] === "receipt:issued" && m["requestId"] === requestId);

    // vessel A: a lift that grants receipt, with the document in its repo
    const a = repoOf();
    const vesselA = rig({ receipt: async () => {} }, a.repo);
    const islandA = await vesselA.mount("a");
    const heads = { [a.doc.documentId]: A.getHeads(a.doc.doc()!) };
    await islandA.ask({ type: "receipt:request", requestId: "r1", documentIds: [a.doc.documentId], heads });
    await new Promise((r) => setTimeout(r, 50));
    expect(receipts(islandA, "r1"), "granted: one answer, from the pool").toEqual([{ type: "receipt:issued", requestId: "r1", issued: true }]);
    expect(a.read()).toBeGreaterThan(0);

    // vessel B: a floor lift that grants none, in the same process, holding NO copy; the neighbour's repo holds the document
    const b = repoOf();
    const vesselB = rig({}, b.repo);
    const islandB = await vesselB.mount("b");
    await islandB.ask({ type: "receipt:request", requestId: "r2", documentIds: [a.doc.documentId], heads });
    await new Promise((r) => setTimeout(r, 50));
    const answers = receipts(islandB, "r2");
    expect(answers, "not granted: one answer, the named refusal").toHaveLength(1);
    expect(answers[0]).toMatchObject({ issued: false });
    expect(String(answers[0]!["why"])).toMatch(/ReceiptRefused/);
    expect(b.read(), "the pool's main Repo never consulted for an island without the grant").toBe(0);
    expect(vesselB.pool.restState().asked).toBe(0);
    await vesselA.pool.disposeAll(); await vesselB.pool.disposeAll();
  });

  test("D3 — a wiki island's fetch reaches its record's cas", async () => {
    const caps: CapabilityRecord = {};
    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki", caps });
    await wiki.ask(casAsk("miss"));
    expect(wiki.said.map((m) => [m["type"], m["requestId"], m["bytes"]])).toEqual([["cas:block", "miss", null]]);   // control: no door, a miss
    const wanted: string[] = [];
    caps.cas = async (cid) => { wanted.push(cid); return new Uint8Array([1]); };   // the vessel stands it late, on the record the island holds
    await wiki.ask(casAsk("hit"));
    expect(wanted).toHaveLength(1);
    expect(wiki.said[1]).toMatchObject({ type: "cas:block", requestId: "hit", bytes: new Uint8Array([1]) });
  });

  test("D4 — a session island reaches none of the capabilities, and every ask it posts answers refused by name (F3: none waits on silence)", async () => {
    const reached: string[] = [];
    const caps: CapabilityRecord = {
      custodyWrite: async () => { reached.push("custody"); },
      receipt: async () => { reached.push("receipt"); },
      cas: async () => { reached.push("cas"); return null; },
      dyad: () => { reached.push("dyad"); return "clear"; },
    };

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const session = island();
    nodeWorkerHandle(session.worker, { island: "session", caps });
    for (const ask of [custodyAsk("s1"), receiptAsk("s2"), casAsk("s3"), dyadAsk("s4"), { type: "session:sign", requestId: "s5", op: "sign", ask: "a", verb: "v", payload: new Uint8Array([1]) }]) await session.ask(ask);
    expect(reached).toEqual([]);
    // RED: before F3 a session island drew no answer, so its portTransit `cas:want` on a local miss waited forever.
    expect(session.said.find((m) => m["requestId"] === "s1")).toMatchObject({ type: "custody:written", written: false });
    expect(session.said.find((m) => m["requestId"] === "s2")).toMatchObject({ type: "receipt:issued", issued: false });
    expect(session.said.find((m) => m["requestId"] === "s3")).toEqual({ type: "cas:block", requestId: "s3", bytes: null });
    expect(session.said.find((m) => m["requestId"] === "s4")).toMatchObject({ type: "dyad:read", standing: "aside" });
    expect(session.said.find((m) => m["requestId"] === "s5")).toMatchObject({ type: "session:signed", refusal: "signer-unavailable" });
    expect(warn.mock.calls.some(([line]) => /CasRefused: a session island asked for the cas capability/.test(String(line)))).toBe(true);

    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon", caps });
    for (const ask of [custodyAsk("d1"), receiptAsk("d2"), casAsk("d3"), dyadAsk("d4")]) await daemon.ask(ask);
    expect(reached.sort()).toEqual(["cas", "custody", "dyad", "receipt"]);
    expect(daemon.said).toHaveLength(4);
  });

  test("D7 — two vessels in one process keep separate capabilities", async () => {
    const sealedA: string[] = [];
    const sealedB: string[] = [];
    const capsA: CapabilityRecord = { custodyWrite: async () => { sealedA.push("a"); }, cas: async () => new Uint8Array([1]), receipt: async () => { sealedA.push("ra"); }, dyad: () => "clear" };
    const capsB: CapabilityRecord = { custodyWrite: async () => { sealedB.push("b"); }, cas: async () => new Uint8Array([2]), receipt: async () => { sealedB.push("rb"); }, dyad: () => "owing" };
    const a = island();
    const b = island();
    nodeWorkerHandle(a.worker, { island: "daemon", caps: capsA });
    nodeWorkerHandle(b.worker, { island: "daemon", caps: capsB });   // vessel B stands AFTER vessel A: it overwrites nothing of A's
    await a.ask(custodyAsk("a1")); await a.ask(casAsk("a2"));
    await b.ask(custodyAsk("b1")); await b.ask(casAsk("b2"));
    expect(sealedA).toEqual(["a"]);
    expect(sealedB).toEqual(["b"]);
    expect(a.said.find((m) => m["requestId"] === "a2")).toMatchObject({ bytes: new Uint8Array([1]) });
    expect(b.said.find((m) => m["requestId"] === "b2")).toMatchObject({ bytes: new Uint8Array([2]) });
    await a.ask(receiptAsk("a4")); await b.ask(receiptAsk("b4"));
    await a.ask(dyadAsk("a5")); await b.ask(dyadAsk("b5"));
    expect(sealedA).toEqual(["a", "ra"]);
    expect(sealedB).toEqual(["b", "rb"]);
    expect(a.said.find((m) => m["requestId"] === "a5")).toMatchObject({ standing: "clear" });
    expect(b.said.find((m) => m["requestId"] === "b5")).toMatchObject({ standing: "owing" });
    sealedA.length = 0; sealedB.length = 0;
    // control: dropping vessel A's capability leaves vessel B's standing
    capsA.custodyWrite = undefined;
    await a.ask(custodyAsk("a3")); await b.ask(custodyAsk("b3"));
    expect(a.said.find((m) => m["requestId"] === "a3")).toMatchObject({ written: false });
    expect(b.said.find((m) => m["requestId"] === "b3")).toMatchObject({ written: true });
    expect(sealedB).toEqual(["b"]);
  });

  test("D8 — a daemon island handed no receipt capability refuses a receipt ask by name", async () => {
    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon", caps: {} });
    await daemon.ask(receiptAsk("n1"));
    expect(daemon.said).toHaveLength(1);
    expect(daemon.said[0]).toMatchObject({ type: "receipt:issued", requestId: "n1", issued: false });
    expect(String(daemon.said[0]!["why"])).toMatch(/ReceiptCapabilityUnavailable/);
    // control: the same island's record, once the vessel stands the capability, issues
    const seen: string[][] = [];
    const caps: CapabilityRecord = { receipt: async (ids) => { seen.push([...ids]); } };
    const stood = island();
    nodeWorkerHandle(stood.worker, { island: "daemon", caps });
    await stood.ask(receiptAsk("n2"));
    expect(seen).toEqual([["doc-a"]]);
    expect(stood.said[0]).toMatchObject({ type: "receipt:issued", issued: true });
  });

  test("D5 — one daemon-class spawn in the tree, in the daemon VM's opener; the pool spawns wiki and session alone", () => {
    const src = join(__dirname, "..", "src");
    const code = (file: string): string => readFileSync(join(src, file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
    const calls = (name: string): string[] => readdirSync(src).filter((f) => f.endsWith(".ts") && f !== "worker-handle.ts")
      .flatMap((f) => (code(f).match(new RegExp(`\\b${name}\\s*\\(`, "g")) ?? []).map(() => f));
    expect(calls("nodeSpawnDaemonWorker")).toEqual(["open-daemon-vm.ts"]);
    expect(calls("nodeSpawnWikiWorker")).toEqual(["vessel-island-pool.ts"]);       // control: the scanner sees a spawn
    expect(calls("nodeSpawnSessionWorker")).toEqual(["vessel-island-pool.ts"]);
    expect(calls("nodeWorkerHandle")).toEqual([]);                                 // no file wraps a worker under a class of its own choosing
  });

  test("D6 — production worker boot wires the receipt capability in the shared kernel", async () => {
    vi.resetModules();
    const runSovereignKernel = vi.fn();
    const parentPost = vi.fn();
    const parentOn = vi.fn();
    vi.doMock("@lararium/tw5", async (importOriginal) => {
      const actual = await importOriginal<typeof import("@lararium/tw5")>();
      return { ...actual, runSovereignKernel };
    });
    vi.doMock("worker_threads", () => ({
      parentPort: { postMessage: parentPost, on: parentOn }, workerData: null,
    }));
    const { runSovereignWorker } = await import("../src/sovereign-island-model.js");
    runSovereignWorker({} as never);
    expect(runSovereignKernel).toHaveBeenCalledTimes(1);
    expect(runSovereignKernel.mock.calls[0]?.[2]).toMatchObject({ caps: { receipt: expect.anything() } });
  });
});
