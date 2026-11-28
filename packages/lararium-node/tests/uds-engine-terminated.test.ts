/**
 * A DEAD ENGINE REFUSES BY NAME, BEFORE ANY HANDLER RUNS; AN OVERWEIGHT WAVE NEVER REACHES IT.
 *
 * The incident: the daemon's shared Automerge wasm instance terminated mid-INGEST, and from then on every request refused
 * by a generic fault code while health read 200. The engine fault looked like a door fault, and every caller retried
 * into it.
 *
 * Here the fault is INJECTED: the control store's `get` throws `Module terminated` on demand. No wasm instance runs out of
 * memory.
 *   - the control-document fault that carries the engine's signature flips the watch, and the caller hears
 *     `engine-terminated`;
 *   - every later verb refuses `engine-terminated` before arbitration: no control read, no `placeVerb`, even once the
 *     injected fault lifts (only a restart brings a fresh engine);
 *   - a receipt the door's memory already holds reads back from it, named with the engine's state; a receipt the dead
 *     engine cannot read refuses by name rather than answering `unknown`;
 *   - an INGEST wave past one document's budget refuses `ingest-wave-over-budget` before arbitration, so a direct client
 *     that bypasses the CLI's paging meets the daemon's bound.
 */
import { answerRingOf, controlStoreOf } from "@lararium/mesh/control-home";
import { describe, test, expect } from "vitest";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnection } from "node:net";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type LarDoc } from "@lararium/mesh/base-doc";
import { concludeVerb } from "@lararium/mesh/verb-tiddler";
import { startUdsChannel } from "../src/uds-channel.js";
import { claimStore } from "../src/owned-store.js";
import { createEngineWatch, ENGINE_HAND_ACT, type EngineWatch } from "../src/engine-watch.js";

interface Placed { verb: string; args: Record<string, unknown>; requestedBy: string; requestId: string; }

function sendLine(socketPath: string, line: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const sock = createConnection(socketPath);
    let buf = "";
    sock.setEncoding("utf8");
    sock.on("connect", () => { sock.write(JSON.stringify(line) + "\n"); });
    sock.on("data", (chunk: string) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl !== -1) { const l = buf.slice(0, nl); sock.end(); resolve(JSON.parse(l)); }
    });
    sock.on("error", reject);
  });
}

async function waitForSocket(path: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (existsSync(path)) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`socket never appeared at ${path}`);
}

interface Rig { socketPath: string; placed: Placed[]; engine: EngineWatch; kill: (dead: boolean) => void; reads: () => number }

async function withChannel(run: (rig: Rig) => Promise<void>): Promise<void> {
  const repo = new Repo({ sharePolicy: async () => true });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  const dir = mkdtempSync(join(tmpdir(), "uds-engine-"));
  const claim = await claimStore(dir, { holder: "vessel" });
  const placed: Placed[] = [];
  const engine = createEngineWatch(() => new Date("2026-11-22T10:34:00.000Z"));
  let dead = false;
  let reads = 0;
  // THE INJECTED FAULT: the control store's read throws the terminated binding's own words while `dead` holds.
  const control = controlStoreOf(handle);
  const get = control.get.bind(control);
  control.get = async (title: string) => { reads += 1; if (dead) throw new Error("Module terminated"); return get(title); };
  const channel = startUdsChannel({
    controlHandle: handle,
    control,
    // The island lands the verdict in the control document and hands the whole answer to the ring, as `writeOutcome` does.
    placeVerb: (o) => {
      const p = o as Placed;
      placed.push(p);
      const outcome = concludeVerb({ requestId: p.requestId, verb: p.verb, status: "done", cause: "test-worker", batchMode: "best-effort", results: { summary: { ok: true } } });
      handle.change((doc) => { doc.tiddlers[outcome.tiddler.title] = outcome as unknown as LarDoc["tiddlers"][string]; });
      answerRingOf(control).put(outcome);
    },
    claim,
    repo,
    engine,
    timeoutMs: 2_000,
  });
  try {
    await waitForSocket(claim.socketPath);
    await run({ socketPath: claim.socketPath, placed, engine, kill: (d) => { dead = d; }, reads: () => reads });
  } finally {
    channel.close();
    await claim.release();
    rmSync(dir, { recursive: true, force: true });
  }
}

const verb = (requestId: string, extra: Record<string, unknown> = {}) => ({ verb: "nexus-kapae", args: { n: 1 }, requestedBy: "did:key:test", requestId, ...extra });

describe("uds-channel — a dead engine refuses by name", () => {
  test("the control-document fault that carries the engine's signature answers engine-terminated, and the watch falls", async () => {
    await withChannel(async ({ socketPath, placed, engine, kill }) => {
      const ok = await sendLine(socketPath, verb("req-engine-before"));
      expect(ok["status"]).toBe("done");
      expect(placed).toHaveLength(1);

      kill(true);
      const refused = await sendLine(socketPath, verb("req-engine-trap"));
      expect(refused["status"]).toBe("error");
      expect((refused["refusal"] as { reason: string }).reason).toBe("engine-terminated");
      expect(String(refused["errorMessage"])).toContain(ENGINE_HAND_ACT);
      expect(placed).toHaveLength(1);
      expect(engine.fallen()?.cause).toBe("module-terminated");
      expect(engine.fallen()?.path).toBe("ledger");
    });
  });

  test("after the fall every verb refuses before arbitration: no control read, no dispatch, even once the fault lifts", async () => {
    await withChannel(async ({ socketPath, placed, engine, kill, reads }) => {
      kill(true);
      await sendLine(socketPath, verb("req-engine-first"));
      expect(engine.fallen()).not.toBeNull();
      kill(false); // the injected fault lifts; the engine it stood for stays dead until a restart
      const before = reads();
      const again = await sendLine(socketPath, verb("req-engine-after"));
      expect((again["refusal"] as { reason: string }).reason).toBe("engine-terminated");
      expect(String(again["errorMessage"])).toMatch(/nothing ran/);
      expect(reads()).toBe(before);
      expect(placed).toHaveLength(0);
    });
  });

  test("a settled receipt reads back from the door's memory, named with the engine's state; an unread one refuses by name", async () => {
    await withChannel(async ({ socketPath, kill }) => {
      expect((await sendLine(socketPath, verb("req-engine-settled")))["status"]).toBe("done");
      kill(true);
      await sendLine(socketPath, verb("req-engine-kill"));

      const settled = await sendLine(socketPath, { op: "receipt", requestId: "req-engine-settled" });
      expect(settled["state"]).toBe("done");
      expect(settled["engine"]).toMatchObject({ status: "engine-terminated", cause: "module-terminated" });

      const unread = await sendLine(socketPath, { op: "receipt", requestId: "req-never-seen" });
      expect(unread["state"]).not.toBe("unknown");
      expect((unread["refusal"] as { reason: string } | undefined)?.reason).toBe("engine-terminated");
    });
  });
});

describe("uds-channel — the daemon's own INGEST wave budget", () => {
  const carrier = (i: number) => ({ uri: `lar:///t/c${i}`, file: `/b/c${i}.mem`, size: 18_000, diskHash: "sha256:a", syncedHash: null, ext: ".mem",
    text: "<<~ ahu slot=`#/s`>>\n".repeat(6) + "x".repeat(18_000) });

  test("a direct client's overweight wave refuses ingest-wave-over-budget before arbitration; a light one runs", async () => {
    await withChannel(async ({ socketPath, placed, reads }) => {
      const before = reads();
      const heavy = await sendLine(socketPath, { verb: "INGEST", args: { "to-bag": "lar:///ha.ka.ba/bags/lares", carriers: Array.from({ length: 194 }, (_, i) => carrier(i)) }, requestedBy: "did:key:test", requestId: "req-heavy" });
      expect(heavy["status"]).toBe("error");
      expect((heavy["refusal"] as { reason: string }).reason).toBe("ingest-wave-over-budget");
      expect(String(heavy["errorMessage"])).toMatch(/194 carriers/);
      expect(placed).toHaveLength(0);
      expect(reads()).toBe(before);
      const receipt = await sendLine(socketPath, { op: "receipt", requestId: "req-heavy" });
      expect(receipt["state"]).toBe("unknown");

      const light = await sendLine(socketPath, { verb: "INGEST", args: { "to-bag": "lar:///ha.ka.ba/bags/lares", carriers: [carrier(0), carrier(1)] }, requestedBy: "did:key:test", requestId: "req-light" });
      expect(light["status"]).toBe("done");
      expect(placed).toHaveLength(1);
    });
  });
});
