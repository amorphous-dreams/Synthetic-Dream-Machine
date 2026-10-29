/**
 * The rest door: an island asks the vessel to rest a document its own Repo keeps no store for, and records a
 * pointer to it only on the vessel's acknowledgment.
 *
 *   D1  no door standing answers `rested: false`, and the asker rejects.     control: a standing door answers true
 *   D2  a door that faults answers `rested: false` naming the fault.
 *   D3  the asker rejects when no answer arrives inside its own patience.    control: an answer resolves it
 *   D4  the asker ignores an answer for another request id.
 *   D6  an ask that reaches the vessel before the island's sync leg has stood waits on that leg's arrival, never
 *       on a clock: the document rests when its bytes land.                  control: with no leg standing the ask holds
 *   D5  the vessel's own act rests the document in its store before it resolves: a second reader of the same
 *       directory finds the document's bytes the instant the act returns.   control: before the act, it finds none
 */
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type DocumentId } from "@automerge/automerge-repo";
import { attachMessageChannelSync, emptyLarDoc, makeIslandRepo, type LarDoc } from "@lararium/mesh";
import { DurableNodeFSStorageAdapter } from "../src/durable-storage-adapter.js";
import { restEvery, restingRepo } from "./resting-repo.js";
import { restInStore } from "../src/open-node-vessel.js";
import { afterEach, describe, expect, test } from "vitest";
import { answerDocRest, setRestDoor } from "../src/worker-handle.js";
import { vesselRestAsker } from "../src/sovereign-island-model.js";

/** A port pair in one process: what the island posts, the vessel answers through the door. */
function wired(opts: { answer?: boolean } = {}) {
  const island = new EventEmitter();
  const posted: unknown[] = [];
  const port = {
    postMessage: (msg: unknown) => {
      posted.push(msg);
      if (opts.answer === false) return;
      void answerDocRest(msg as { requestId: string; documentIds: string[] }).then((reply) => island.emit("message", reply));
    },
    on: (ev: "message", fn: (m: unknown) => void) => { island.on(ev, fn); },
  };
  return { port, posted, island };
}

afterEach(() => setRestDoor(null));

describe("the rest door", () => {
  test("D1 — no door standing: the ask reads unrested and the asker rejects; a standing door acknowledges", async () => {
    const w = wired();
    await expect(vesselRestAsker(w.port)(["doc-a"])).rejects.toThrow(/did not acknowledge doc-a.*no rest door/);
    const rested: string[][] = [];
    setRestDoor(async (ids) => { rested.push([...ids]); });
    expect(await answerDocRest({ requestId: "proof", documentIds: ["doc-a", "doc-b"] }))
      .toMatchObject({ rested: true, proof: { documentIds: ["doc-a", "doc-b"] } });
    await expect(vesselRestAsker(w.port)(["doc-a", "doc-b"])).resolves.toBeUndefined();
    expect(rested).toEqual([["doc-a", "doc-b"], ["doc-a", "doc-b"]]);
  });

  test("D2 — a faulting door answers unrested with its fault", async () => {
    setRestDoor(async () => { throw new Error("the store refused the save"); });
    const reply = await answerDocRest({ requestId: "r1", documentIds: ["doc-a"] });
    expect(reply).toMatchObject({ type: "doc:rested", requestId: "r1", rested: false, why: "the store refused the save" });
    await expect(vesselRestAsker(wired().port)(["doc-a"])).rejects.toThrow(/the store refused the save/);
  });

  test("D3 — no answer inside the asker's patience rejects; an answer resolves", async () => {
    setRestDoor(async () => {});
    await expect(vesselRestAsker(wired({ answer: false }).port, 30)(["doc-a"])).rejects.toThrow(/no answer/);
    await expect(vesselRestAsker(wired().port, 30)(["doc-a"])).resolves.toBeUndefined();
  });

  test("D4 — an answer under another request id settles nothing", async () => {
    const w = wired({ answer: false });
    const asking = vesselRestAsker(w.port, 60)(["doc-a"]);
    w.island.emit("message", { type: "doc:rested", requestId: "someone-else", rested: true });
    await expect(asking).rejects.toThrow(/no answer/);
  });

  test("D5 — the door's act returns only after the store holds the document", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rest-door-"));
    try {
      // A long save debounce: nothing reaches the store on its own inside this test, only through the act.
      const repo = restingRepo(dir, { saveDebounceRate: 60_000 });
      const handle = repo.create<LarDoc>(emptyLarDoc());
      const stored = async (): Promise<number> => (await new DurableNodeFSStorageAdapter(dir).loadRange([handle.documentId])).length;
      expect(await stored(), "CONTROL: the store holds nothing of the document before the act").toBe(0);
      await restInStore(repo, [handle.documentId as DocumentId]);
      expect(await stored(), "the document rests in the store when the act returns").toBeGreaterThan(0);
    } finally {
      await restEvery();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("D6 — an ask that outruns the island's sync leg waits for the leg, then rests the document", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rest-door-"));
    try {
      const vessel = restingRepo(dir, { saveDebounceRate: 60_000 });
      const channel = new MessageChannel();
      const island = makeIslandRepo({ syncPort: channel.port2 as unknown as MessagePort });
      const handle = island.create<LarDoc>(emptyLarDoc());
      // The ask posts on a faster road than the sync handshake: the vessel holds no leg to the island yet.
      let outcome: "pending" | "rested" | { fault: string } = "pending";
      const asking = restInStore(vessel, [handle.documentId as DocumentId]).then(
        () => { outcome = "rested"; },
        (e: unknown) => { outcome = { fault: e instanceof Error ? e.message : String(e) }; },
      );
      for (let turn = 0; turn < 20; turn++) await new Promise<void>((r) => setImmediate(r));
      expect(outcome, "with no leg standing the ask holds: it neither rests nor reads the document unavailable").toBe("pending");
      attachMessageChannelSync(vessel, channel.port1 as unknown as MessagePort);
      await asking;
      expect(outcome).toBe("rested");
      expect((await new DurableNodeFSStorageAdapter(dir).loadRange([handle.documentId])).length).toBeGreaterThan(0);
      await island.shutdown();
      channel.port1.close(); channel.port2.close();
    } finally {
      await restEvery();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
