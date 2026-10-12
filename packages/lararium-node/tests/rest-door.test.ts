/**
 * The rest door: an island asks the vessel to rest a document its own Repo keeps no store for, and records a
 * pointer to it only on the vessel's acknowledgment.
 *
 *   D1  no door standing answers `rested: false`, and the asker rejects.     control: a standing door answers true
 *   D2  a door that faults answers `rested: false` naming the fault.
 *   D3  the asker rejects when no answer arrives inside its own patience.    control: an answer resolves it
 *   D4  the asker ignores an answer for another request id.
 */
import { EventEmitter } from "node:events";
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
    await expect(vesselRestAsker(w.port)(["doc-a", "doc-b"])).resolves.toBeUndefined();
    expect(rested).toEqual([["doc-a", "doc-b"]]);
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
});
