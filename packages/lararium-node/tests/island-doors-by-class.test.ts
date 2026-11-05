/**
 * The vessel's capabilities, by the class of island that asks: an island reaches only the capabilities its class owns,
 * and only through the record its vessel handed it at construction.
 *
 *   D1  a WIKI island that posts `custody:write` reaches no custody capability: the function never runs, the
 *       island reads `written: false` naming `CustodyWriteRefused`, and the refusal logs once however often it asks.
 *                                                 control: the DAEMON island's same ask reaches the capability, with
 *                                                 the exact carrier and bytes, and reads `written: true`
 *   D2  a wiki island that posts `receipt:request` reaches no receipt capability and reads `issued: false` naming
 *       `ReceiptRefused`.                         control: the daemon island's ask reaches the capability
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
import type { CapabilityRecord } from "@lararium/mesh";
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

  test("D2 — a wiki island's receipt ask reaches no capability and refuses by name", async () => {
    const rested: string[][] = [];
    const caps: CapabilityRecord = { receipt: async (ids) => { rested.push([...ids]); } };
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki", caps });
    await wiki.ask(receiptAsk("w1"));
    expect(rested).toEqual([]);
    expect(wiki.said.map((m) => [m["type"], m["issued"]])).toEqual([["receipt:issued", false]]);
    expect(String(wiki.said[0]!["why"])).toMatch(/ReceiptRefused/);

    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon", caps });
    await daemon.ask(receiptAsk("d1"));
    expect(rested).toEqual([["doc-a"]]);
    expect(daemon.said.map((m) => [m["type"], m["issued"]])).toEqual([["receipt:issued", true]]);
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

  test("D4 — a session island reaches none of the three capabilities", async () => {
    const reached: string[] = [];
    const caps: CapabilityRecord = {
      custodyWrite: async () => { reached.push("custody"); },
      receipt: async () => { reached.push("receipt"); },
      cas: async () => { reached.push("cas"); return null; },
      dyad: () => { reached.push("dyad"); return "clear"; },
    };

    const session = island();
    nodeWorkerHandle(session.worker, { island: "session", caps });
    for (const ask of [custodyAsk("s1"), receiptAsk("s2"), casAsk("s3"), dyadAsk("s4")]) await session.ask(ask);
    expect(reached).toEqual([]);
    expect(session.said).toEqual([]);

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
      parentPort: { postMessage: parentPost, on: parentOn },
    }));
    const { runSovereignWorker } = await import("../src/sovereign-island-model.js");
    runSovereignWorker({} as never);
    expect(runSovereignKernel).toHaveBeenCalledTimes(1);
    expect(runSovereignKernel.mock.calls[0]?.[2]).toMatchObject({ caps: { receipt: expect.anything() } });
  });
});
