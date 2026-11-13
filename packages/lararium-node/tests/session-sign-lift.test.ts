/**
 * session-sign-lift — session signing seats on the LIFT, never on the herm floor and never on a process-global door.
 *
 *   D10  two daemon-class islands in one process, each record carrying its OWN book's door: each signs only through its
 *        own book, and dropping A's door (its record loses `sessionSign`) leaves B signing.
 *   D11  a daemon record without `sessionSign` refuses `signer-unavailable` by name on the same request id, and logs
 *        `SessionSignDoorRefused` once however often it asks.
 *   D12  a herm floor and a Lararium floor composed through `islandFloorStack`; the Lararium's lift (`islandLiftStack`)
 *        reaches its own book; the lift's dispose (the lock) removes the door, and a stale dispose after a newer lift leaves the newer door.
 *   D13  source witness: no process-global setter survives anywhere under packages/{src,tests} or tools, the shared
 *        prep seats no door; the Lararium compose lifts through `islandLiftStack` over the prep's record; the herm's compose names no session sign.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store
 */
import { EventEmitter } from "node:events";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test, vi, afterEach } from "vitest";
import { composeVessel, islandFloorStack, islandLiftStack, larVesselOf, type CapabilityRecord } from "@lararium/mesh";
import { nodeWorkerHandle } from "../src/worker-handle.js";
import { SessionSignBook } from "../src/session-sign-door.js";
import type { UdsSessionSigner } from "../src/uds-channel.js";

type Worker = Parameters<typeof nodeWorkerHandle>[0];

function island(): { worker: Worker; said: Array<Record<string, unknown>>; ask(msg: unknown): Promise<void> } {
  const emitter = new EventEmitter();
  const said: Array<Record<string, unknown>> = [];
  const worker = Object.assign(emitter, {
    postMessage: (m: unknown) => { said.push(m as Record<string, unknown>); },
    terminate: async () => 0,
  }) as unknown as Worker;
  return { worker, said, async ask(msg) { emitter.emit("message", msg); await new Promise((r) => setTimeout(r, 10)); } };
}

const CHAIN = { scope: { faceKey: "aa".repeat(32), nexus: "nexus-one" }, vesselFaceKey: "bb".repeat(32) };
const NEXUS = { kind: "nexus" as const, aid: "nexus-one" };
const payload = new Uint8Array([1, 2, 3]);

function signer(tag: string): UdsSessionSigner & { signed: Uint8Array[] } {
  const signed: Uint8Array[] = [];
  return {
    signed, dropped: false, drop() {},
    certificate: { scope: CHAIN.scope, vesselFaceKey: CHAIN.vesselFaceKey, sessionKey: "cc".repeat(32) },
    async sign(_purpose, bytes) { signed.push(bytes); return { signature: `sig-${tag}` }; },
  };
}

/** A lift: a fresh book with one booked call, and its door. */
function lift(tag: string, requestId: string): { book: SessionSignBook; s: ReturnType<typeof signer>; door: NonNullable<CapabilityRecord["sessionSign"]> } {
  const book = new SessionSignBook();
  const s = signer(tag);
  book.hold(requestId, "sealed-seal", { signer: s, anchor: NEXUS, subject: `subject-${tag}` });
  return { book, s, door: book.door(() => CHAIN) };
}

const signAsk = (requestId: string, ask: string) => ({ type: "session:sign", requestId, op: "sign", ask, verb: "sealed-seal", payload });
const answers = (said: Array<Record<string, unknown>>) => said.filter((m) => m["type"] === "session:signed").map((m) => [m["requestId"], m["signature"] ?? m["refusal"]]);

afterEach(() => { vi.restoreAllMocks(); });

describe("session signing seats on the lift, per record", () => {
  test("D10 — two daemon islands each sign only through their own record's book; dropping A's door leaves B signing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = lift("a", "req-a"), b = lift("b", "req-b");
    const capsA: CapabilityRecord = { sessionSign: a.door }, capsB: CapabilityRecord = { sessionSign: b.door };
    const ia = island(), ib = island();
    nodeWorkerHandle(ia.worker, { island: "daemon", caps: capsA });
    nodeWorkerHandle(ib.worker, { island: "daemon", caps: capsB });

    await ia.ask(signAsk("a1", "req-a"));
    await ia.ask(signAsk("a2", "req-b")); // B's booking: A's book never holds it
    await ib.ask(signAsk("b1", "req-b"));
    await ib.ask(signAsk("b2", "req-a"));
    expect(answers(ia.said)).toEqual([["a1", "sig-a"], ["a2", "signer-unavailable"]]);
    expect(answers(ib.said)).toEqual([["b1", "sig-b"], ["b2", "signer-unavailable"]]);
    expect(a.s.signed).toEqual([payload]);
    expect(b.s.signed).toEqual([payload]);

    delete capsA.sessionSign;
    await ia.ask(signAsk("a3", "req-a"));
    await ib.ask(signAsk("b3", "req-b"));
    expect(answers(ia.said).at(-1)).toEqual(["a3", "signer-unavailable"]);
    expect(answers(ib.said).at(-1)).toEqual(["b3", "sig-b"]);
  });

  test("D11 — a daemon record without sessionSign refuses by name on the same request id, logged once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = island();
    nodeWorkerHandle(d.worker, { island: "daemon", caps: {} });
    await d.ask(signAsk("n1", "req-1"));
    await d.ask(signAsk("n2", "req-1"));
    expect(answers(d.said)).toEqual([["n1", "signer-unavailable"], ["n2", "signer-unavailable"]]);
    expect(warn.mock.calls.filter((c) => /SessionSignDoorRefused/.test(String(c[0])))).toHaveLength(1);
  });

  test("D12 — a herm floor signs nothing while a Lararium in the same process signs through its lift; the lift's down removes the door", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const hermFloor = larVesselOf(await composeVessel(islandFloorStack({ cas: async () => null })));
    const larFloor = larVesselOf(await composeVessel(islandFloorStack({ cas: async () => null })));
    const l = lift("lar", "req-1");
    const lifted = await composeVessel(islandLiftStack(larFloor, { face: "lar", sessionSign: l.door, drop: () => {} }));
    const herm = island(), lar = island();
    nodeWorkerHandle(herm.worker, { island: "daemon", caps: hermFloor.record });
    nodeWorkerHandle(lar.worker, { island: "daemon", caps: larFloor.record });

    await herm.ask(signAsk("h1", "req-1"));
    await lar.ask(signAsk("l1", "req-1"));
    expect(answers(herm.said)).toEqual([["h1", "signer-unavailable"]]);
    expect(answers(lar.said)).toEqual([["l1", "sig-lar"]]);
    expect(hermFloor.record.sessionSign).toBeUndefined();

    await lifted.dispose();
    expect(larFloor.record.sessionSign).toBeUndefined();
    await lar.ask(signAsk("l2", "req-1"));
    expect(answers(lar.said).at(-1)).toEqual(["l2", "signer-unavailable"]);
    // a down that runs after another lift re-seated the record leaves that newer door standing
    const again = lift("again", "req-2");
    await composeVessel(islandLiftStack(larFloor, { face: "lar", sessionSign: again.door, drop: () => {} }));
    await lifted.dispose();
    // The lift seats its own fenced door (row B8), so the newer lift reads by what it answers, never by identity.
    expect(larFloor.record.sessionSign).toBeDefined();
    await lar.ask(signAsk("l3", "req-2"));
    expect(answers(lar.said).at(-1)).toEqual(["l3", "sig-again"]);
  });
});

describe("D13 — no ambient session sign door survives in source", () => {
  const root = resolve(__dirname, "../../..");
  const needle = "set" + "SessionSign" + "Door";
  const self = resolve(__filename);
  const walk = (dir: string, out: string[]): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|js|mjs|cjs|sh)$/.test(name) && p !== self) out.push(p);
    }
    return out;
  };

  test("no file under packages/*/src, packages/*/tests or tools names the global setter", () => {
    const files: string[] = [];
    for (const pkg of readdirSync(join(root, "packages"))) {
      for (const sub of ["src", "tests"]) {
        const d = join(root, "packages", pkg, sub);
        try { if (statSync(d).isDirectory()) walk(d, files); } catch { /* absent */ }
      }
    }
    walk(join(root, "tools"), files);
    expect(files.length).toBeGreaterThan(100); // the walk reached the tree (a silent zero proves nothing)
    expect(files.filter((f) => readFileSync(f, "utf8").includes(needle)).map((f) => f.slice(root.length + 1))).toEqual([]);
  });

  test("the shared prep seats no door; the herm's compose names no session sign", () => {
    const src = readFileSync(join(root, "packages/lararium-node/src/open-node-vessel.ts"), "utf8");
    const body = (name: string): string => {
      const at = src.indexOf(`async function ${name}(`);
      expect(at).toBeGreaterThan(-1);
      const next = src.indexOf("\nasync function ", at + 1);
      const nextExport = src.indexOf("\nexport ", at + 1);
      const end = Math.min(...[next, nextExport].filter((i) => i > -1), src.length);
      return src.slice(at, end);
    };
    expect(body("prepareNodeBootOn")).not.toMatch(/islandCaps\.sessionSign\s*=|seatSessionSignLift\(/);
    expect(body("composeNodeHermOn")).not.toMatch(/sessionSign/i);
    expect(body("composeNodeVesselOn")).toMatch(/islandLiftStack\(p\.islandVessel/);
    expect(body("prepareNodeBootOn")).toMatch(/islandFloorStack\(/);
    expect(src).not.toMatch(/seatSessionSignLift/);
  });
});
