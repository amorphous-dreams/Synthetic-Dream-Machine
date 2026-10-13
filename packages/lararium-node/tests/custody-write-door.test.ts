/**
 * The custody write door: an island hands bytes to the vessel, which alone holds the key and seals them.
 *
 *   W1 no door standing answers `written: false`, and the writer rejects. control: a standing door receives the
 *      exact carrier and bytes and the writer resolves.
 *   W2 a door that faults answers `written: false` naming the fault.
 *   W3 the writer rejects when no answer arrives inside its patience. control: an answer resolves it.
 *   W4 the writer ignores an answer for another request id.
 *   W5 a bad carrier or non-bytes payload never reaches the door and answers `bad custody write ask`.
 *      control: both `archive` and `veil` reach the door.
 *   W6 a rejection's message carries no byte of the payload.
 */
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, test } from "vitest";
import { answerCustodyWrite, setCustodyWriteDoor } from "../src/worker-handle.js";
import { vesselCustodyWriter } from "../src/sovereign-island-model.js";

function wired(opts: { answer?: boolean } = {}) {
  const island = new EventEmitter();
  const posted: unknown[] = [];
  const port = {
    postMessage: (msg: unknown) => {
      posted.push(msg);
      if (opts.answer === false) return;
      void answerCustodyWrite(msg as { requestId: string; carrier: "archive" | "veil"; bytes: Uint8Array }).then((reply) => island.emit("message", reply));
    },
    on: (ev: "message", fn: (m: unknown) => void) => { island.on(ev, fn); },
  };
  return { port, posted, island };
}

afterEach(() => setCustodyWriteDoor(null));

describe("the custody write door", () => {
  test("W1 — no door standing rejects; a standing door receives the exact carrier and bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const w = wired();
    await expect(vesselCustodyWriter(w.port)("archive", bytes)).rejects.toThrow(/archive carrier \(no custody write door/);
    const received: Array<[string, Uint8Array]> = [];
    setCustodyWriteDoor(async (carrier, payload) => { received.push([carrier, payload]); });
    await expect(vesselCustodyWriter(w.port)("veil", bytes)).resolves.toBeUndefined();
    expect(received).toEqual([["veil", bytes]]);
    expect(received[0]?.[1]).toBe(bytes);
  });

  test("W2 — a faulting door answers unwritten with its fault", async () => {
    setCustodyWriteDoor(async () => { throw new Error("the seal store refused the write"); });
    const reply = await answerCustodyWrite({ requestId: "r1", carrier: "archive", bytes: new Uint8Array([4]) });
    expect(reply).toMatchObject({ type: "custody:written", requestId: "r1", written: false, why: "the seal store refused the write" });
    await expect(vesselCustodyWriter(wired().port)("archive", new Uint8Array([4]))).rejects.toThrow(/the seal store refused the write/);
  });

  test("W3 — no answer inside the writer's patience rejects; an answer resolves", async () => {
    setCustodyWriteDoor(async () => {});
    const bytes = new Uint8Array([5]);
    await expect(vesselCustodyWriter(wired({ answer: false }).port, 30)("archive", bytes)).rejects.toThrow(/no answer/);
    await expect(vesselCustodyWriter(wired().port, 30)("archive", bytes)).resolves.toBeUndefined();
  });

  test("W4 — an answer under another request id settles nothing", async () => {
    const w = wired({ answer: false });
    const asking = vesselCustodyWriter(w.port, 60)("veil", new Uint8Array([6]));
    w.island.emit("message", { type: "custody:written", requestId: "someone-else", written: true });
    await expect(asking).rejects.toThrow(/no answer/);
  });

  test("W5 — bad asks never reach the door; archive and veil do", async () => {
    const seen: Array<[string, Uint8Array]> = [];
    setCustodyWriteDoor(async (carrier, bytes) => { seen.push([carrier, bytes]); });
    const good = new Uint8Array([7]);
    for (const ask of [
      { requestId: "bad-carrier", carrier: "outside", bytes: good },
      { requestId: "bad-bytes", carrier: "archive", bytes: [7] },
    ]) {
      const reply = await answerCustodyWrite(ask as never);
      expect(reply).toMatchObject({ written: false, why: "bad custody write ask" });
    }
    const archiveBytes = new Uint8Array([8]);
    const veilBytes = new Uint8Array([9]);
    await answerCustodyWrite({ requestId: "archive", carrier: "archive", bytes: archiveBytes });
    await answerCustodyWrite({ requestId: "veil", carrier: "veil", bytes: veilBytes });
    expect(seen).toEqual([["archive", archiveBytes], ["veil", veilBytes]]);
    expect(seen[0]?.[1]).toBe(archiveBytes);
    expect(seen[1]?.[1]).toBe(veilBytes);
  });

  test("W6 — a rejection message never carries payload bytes", async () => {
    setCustodyWriteDoor(async () => { throw new Error("seal failed"); });
    const marker = "synthetic-payload-marker";
    const bytes = new TextEncoder().encode(marker);
    let message = "";
    try { await vesselCustodyWriter(wired().port)("archive", bytes); }
    catch (error) { message = error instanceof Error ? error.message : String(error); }
    expect(message).toContain("seal failed");
    expect(message).not.toContain(marker);
  });
});
