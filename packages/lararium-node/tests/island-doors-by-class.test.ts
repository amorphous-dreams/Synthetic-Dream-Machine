/**
 * The vessel's doors, by the class of island that asks: a worker reaches only the doors its class owns.
 *
 *   D1  a WIKI island that posts `custody:write` reaches no custody door: the door's function never runs, the
 *       island reads `written: false` naming `CustodyDoorRefused`, and the refusal logs once however often it asks.
 *                                                 control: the DAEMON island's same ask reaches the door, with the
 *                                                 exact carrier and bytes, and reads `written: true`
 *   D2  a wiki island that posts `doc:rest` reaches no rest door and reads `rested: false` naming `RestDoorRefused`.
 *                                                 control: the daemon island's ask reaches the door
 *   D3  a wiki island's `cas:want` reaches the fetch door (a wiki reads the blobs its own tiddlers name).
 *                                                 control: with no door standing it reads a miss
 *   D4  a SESSION island reaches none of the three: a custody ask and a rest ask draw no answer at all, and a
 *       fetch ask draws none either.              control: the same three asks on a daemon island each draw one
 */
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { nodeWorkerHandle, setCasDoor, setCustodyWriteDoor, setRestDoor } from "../src/worker-handle.js";

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

const custodyAsk = (requestId: string) => ({ type: "custody:write", requestId, carrier: "archive", bytes: new Uint8Array([7, 7, 7]) });
const restAsk = (requestId: string) => ({ type: "doc:rest", requestId, documentIds: ["doc-a"] });
const casAsk = (requestId: string) => ({ type: "cas:want", requestId, cid: "sha256:" + "ab".repeat(32) });

afterEach(() => { setCustodyWriteDoor(null); setRestDoor(null); setCasDoor(null); vi.restoreAllMocks(); });

describe("the vessel's doors answer by island class", () => {
  test("D1 — a wiki island's custody write reaches no door and refuses by name, once in the log", async () => {
    const sealed: Array<[string, Uint8Array]> = [];
    setCustodyWriteDoor(async (carrier, bytes) => { sealed.push([carrier, bytes]); });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki" });
    await wiki.ask(custodyAsk("w1"));
    await wiki.ask(custodyAsk("w2"));
    expect(sealed).toEqual([]);
    expect(wiki.said.map((m) => [m["type"], m["requestId"], m["written"]])).toEqual([["custody:written", "w1", false], ["custody:written", "w2", false]]);
    expect(String(wiki.said[0]!["why"])).toMatch(/CustodyDoorRefused/);
    expect(warn.mock.calls.filter((c) => /CustodyDoorRefused/.test(String(c[0])))).toHaveLength(1);

    // control: the daemon island's ask lands
    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon" });
    await daemon.ask(custodyAsk("d1"));
    expect(sealed).toEqual([["archive", new Uint8Array([7, 7, 7])]]);
    expect(daemon.said.map((m) => [m["type"], m["requestId"], m["written"]])).toEqual([["custody:written", "d1", true]]);
  });

  test("D2 — a wiki island's rest ask reaches no door and refuses by name", async () => {
    const rested: string[][] = [];
    setRestDoor(async (ids) => { rested.push([...ids]); });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki" });
    await wiki.ask(restAsk("w1"));
    expect(rested).toEqual([]);
    expect(wiki.said.map((m) => [m["type"], m["rested"]])).toEqual([["doc:rested", false]]);
    expect(String(wiki.said[0]!["why"])).toMatch(/RestDoorRefused/);

    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon" });
    await daemon.ask(restAsk("d1"));
    expect(rested).toEqual([["doc-a"]]);
    expect(daemon.said.map((m) => [m["type"], m["rested"]])).toEqual([["doc:rested", true]]);
  });

  test("D3 — a wiki island's fetch reaches the fetch door", async () => {
    const wiki = island();
    nodeWorkerHandle(wiki.worker, { island: "wiki" });
    await wiki.ask(casAsk("miss"));
    expect(wiki.said.map((m) => [m["type"], m["requestId"], m["bytes"]])).toEqual([["cas:block", "miss", null]]);   // control: no door, a miss
    const wanted: string[] = [];
    setCasDoor(async (cid) => { wanted.push(cid); return new Uint8Array([1]); });
    await wiki.ask(casAsk("hit"));
    expect(wanted).toHaveLength(1);
    expect(wiki.said[1]).toMatchObject({ type: "cas:block", requestId: "hit", bytes: new Uint8Array([1]) });
  });

  test("D4 — a session island reaches none of the three doors", async () => {
    const reached: string[] = [];
    setCustodyWriteDoor(async () => { reached.push("custody"); });
    setRestDoor(async () => { reached.push("rest"); });
    setCasDoor(async () => { reached.push("cas"); return null; });

    const session = island();
    nodeWorkerHandle(session.worker, { island: "session" });
    for (const ask of [custodyAsk("s1"), restAsk("s2"), casAsk("s3")]) await session.ask(ask);
    expect(reached).toEqual([]);
    expect(session.said).toEqual([]);

    const daemon = island();
    nodeWorkerHandle(daemon.worker, { island: "daemon" });
    for (const ask of [custodyAsk("d1"), restAsk("d2"), casAsk("d3")]) await daemon.ask(ask);
    expect(reached.sort()).toEqual(["cas", "custody", "rest"]);
    expect(daemon.said).toHaveLength(3);
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
});
