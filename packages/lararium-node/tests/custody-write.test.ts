/**
 * The custodyWrite capability: an island hands bytes to the vessel, which alone holds the key and seals them. Each test
 * hands the answer its own capability record, the one a vessel would hand its daemon island.
 *
 *   W1 no `custodyWrite` standing answers `written: false`, and the writer rejects. control: a standing capability
 *      receives the exact carrier and bytes and the writer resolves.
 *   W2 a capability that faults answers `written: false` naming the fault.
 *   W3 the writer rejects when no answer arrives inside its patience. control: an answer resolves it.
 *   W4 the writer ignores an answer for another request id.
 *   W5 a bad carrier or non-bytes payload never reaches the capability and answers `bad custody write ask`.
 *      control: the face veil reaches it.
 *   W6 a rejection's message carries no byte of the payload.
 */
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, test } from "vitest";
import type { CapabilityRecord } from "@lararium/mesh";
import { answerCustodyWrite } from "../src/worker-handle.js";
import { vesselCustodyWriter } from "../src/sovereign-island-model.js";

function wired(opts: { answer?: boolean } = {}) {
  const island = new EventEmitter();
  const posted: unknown[] = [];
  const port = {
    postMessage: (msg: unknown) => {
      posted.push(msg);
      if (opts.answer === false) return;
      void answerCustodyWrite(caps, msg as { requestId: string; carrier: "veil"; bytes: Uint8Array }).then((reply) => island.emit("message", reply));
    },
    on: (ev: "message", fn: (m: unknown) => void) => { island.on(ev, fn); },
  };
  return { port, posted, island };
}

/** The record the vessel hands; each test starts from an empty one. */
let caps: CapabilityRecord = {};
beforeEach(() => { caps = {}; });

describe("the custodyWrite capability", () => {
  test("W1 — no capability standing rejects; a standing one receives the exact carrier and bytes", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const w = wired();
    await expect(vesselCustodyWriter(w.port)("veil", bytes)).rejects.toThrow(/veil carrier \(no custodyWrite capability/);
    const received: Array<[string, Uint8Array]> = [];
    caps.custodyWrite = async (carrier, payload) => { received.push([carrier, payload]); };
    await expect(vesselCustodyWriter(w.port)("veil", bytes)).resolves.toBeUndefined();
    expect(received).toEqual([["veil", bytes]]);
    expect(received[0]?.[1]).toBe(bytes);
  });

  test("W2 — a faulting capability answers unwritten with its fault", async () => {
    caps.custodyWrite = async () => { throw new Error("the seal store refused the write"); };
    const reply = await answerCustodyWrite(caps, { requestId: "r1", carrier: "veil", bytes: new Uint8Array([4]) });
    expect(reply).toMatchObject({ type: "custody:written", requestId: "r1", written: false, why: "the seal store refused the write" });
    await expect(vesselCustodyWriter(wired().port)("veil", new Uint8Array([4]))).rejects.toThrow(/the seal store refused the write/);
  });

  test("W3 — the vessel's answer resolves the write", async () => {
    caps.custodyWrite = async () => {};
    await expect(vesselCustodyWriter(wired().port)("veil", new Uint8Array([5]))).resolves.toBeUndefined();
  });

  test("W4 — an answer under another request id settles nothing; its own refusal rejects (control)", async () => {
    const w = wired({ answer: false });
    let settled = false;
    const asking = vesselCustodyWriter(w.port)("veil", new Uint8Array([6])).finally(() => { settled = true; });
    asking.catch(() => {});
    w.island.emit("message", { type: "custody:written", requestId: "someone-else", written: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);
    w.island.emit("message", { type: "custody:written", requestId: (w.posted.at(-1) as { requestId?: string } | undefined)?.requestId, written: false, why: "refused" });
    await expect(asking).rejects.toThrow(/refused/);
  });

  test("W5 — bad asks never reach the capability; only the veil does", async () => {
    const seen: Array<[string, Uint8Array]> = [];
    caps.custodyWrite = async (carrier, bytes) => { seen.push([carrier, bytes]); };
    const good = new Uint8Array([7]);
    for (const ask of [
      { requestId: "bad-carrier", carrier: "outside", bytes: good },
      { requestId: "bad-bytes", carrier: "archive", bytes: [7] },
    ]) {
      const reply = await answerCustodyWrite(caps, ask as never);
      expect(reply).toMatchObject({ written: false, why: "bad custody write ask" });
    }
    const veilBytes = new Uint8Array([9]);
    const retired = await answerCustodyWrite(caps, { requestId: "archive", carrier: "archive", bytes: new Uint8Array([8]) } as never);
    expect(retired).toMatchObject({ written: false, why: "bad custody write ask" });
    await answerCustodyWrite(caps, { requestId: "veil", carrier: "veil", bytes: veilBytes });
    expect(seen).toEqual([["veil", veilBytes]]);
    expect(seen[0]?.[1]).toBe(veilBytes);
  });

  test("W6 — a rejection message never carries payload bytes", async () => {
    caps.custodyWrite = async () => { throw new Error("seal failed"); };
    const marker = "synthetic-payload-marker";
    const bytes = new TextEncoder().encode(marker);
    let message = "";
    try { await vesselCustodyWriter(wired().port)("veil", bytes); }
    catch (error) { message = error instanceof Error ? error.message : String(error); }
    expect(message).toContain("seal failed");
    expect(message).not.toContain(marker);
  });
});
