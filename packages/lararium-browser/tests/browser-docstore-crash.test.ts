/**
 * browser-docstore-crash — the document store's door hears its daemon island leave (F2, clock-sweep land read).
 *
 * A browser Worker gives no exit event, so before this cure the door's cell detached only on the vessel's own terminate:
 * an island that crashed left every seal and open waiting on it forever. Now the island's fault frame, its error and its
 * exit each detach the cell, the way the daemon VM core ends its own asks, so a waiting seal refuses by name at once.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store
 */
import { describe, expect, it } from "vitest";
import { docStorePortCell, vesselDocStoreDoor, type CapabilityRecord, type VesselWorkerHandle } from "@lararium/mesh";
import { islandAskingThroughRecord } from "../src/open-browser-daemon-vm.js";

type Session = { readonly id: string; readonly subject: string };
const settle = (ms = 30) => new Promise((done) => setTimeout(done, ms));

/** A fake daemon island Worker: it says the door answers, then answers no ask; the test fires its crash. */
function island() {
  const toVessel = new Set<(m: unknown) => void>();
  const errors = new Set<(e: Error) => void>();
  const exits = new Set<(why: string) => void>();
  const heard: Array<{ type?: string; requestId?: string }> = [];
  const handle: VesselWorkerHandle = {
    post: (m) => { heard.push(m as { type?: string; requestId?: string }); },
    listen: (cb) => { toVessel.add(cb); return () => { toVessel.delete(cb); }; },
    onError: (cb) => { errors.add(cb); return () => { errors.delete(cb); }; },
    onExit: (cb) => { exits.add(cb); return () => { exits.delete(cb); }; },
    terminate: () => { for (const cb of [...exits]) cb("terminated"); },
  };
  const say = (m: unknown): void => { for (const cb of [...toVessel]) cb(m); };
  return { handle, heard, say, crash: (e: Error) => { for (const cb of [...errors]) cb(e); } };
}

function stand() {
  const cell = docStorePortCell(async () => null);
  const caps: CapabilityRecord = { docStore: (port) => cell.attach(port) };
  const i = island();
  islandAskingThroughRecord(i.handle, caps);
  i.say({ type: "docstore:answering" });
  const door = vesselDocStoreDoor<Session>(() => cell.port(), { book: () => () => {}, idPrefix: "crash" });
  const value = { role: "change" as const, ref: "ab".repeat(32), parents: [], plaintext: new Uint8Array([1, 2, 3]) };
  const seal = () => door.seal({ bagId: "lar:///ha.ka.ba/@test/bags/crash", values: [value], session: { id: "s", subject: "f" } });
  return { i, door, seal };
}

describe("the browser door hears its daemon island leave", () => {
  it("RED: an island that crashes (its Worker's error) refuses the waiting seal by name at once, and every later seal", async () => {
    const { i, seal } = stand();
    let settled = false;
    const waiting = seal().then((v) => { settled = true; return v; });
    await settle();
    expect(settled).toBe(false);   // barrier: the seal reached the island and waits on it
    expect(i.heard.some((m) => m.type === "docstore:seal")).toBe(true);
    i.crash(new Error("island threw"));
    expect(await waiting).toMatchObject({ refusal: "signer-unavailable" });
    expect(await seal()).toMatchObject({ refusal: "signer-unavailable", cause: expect.stringMatching(/no daemon island answers/) });
  });

  it("RED: an island's fault frame detaches the door the same way", async () => {
    const { i, seal } = stand();
    const waiting = seal();
    await settle();
    i.say({ type: "fault", error: "the island faulted" });
    expect(await waiting).toMatchObject({ refusal: "signer-unavailable" });
  });

  it("CONTROL: an island that answers seals the waiting ask, and no crash means no refusal", async () => {
    const { i, seal } = stand();
    const waiting = seal();
    await settle();
    const ask = i.heard.find((m) => m.type === "docstore:seal")!;
    i.say({ type: "docstore:sealed", requestId: ask.requestId, refusal: "seal-refused", cause: "the island answered" });
    expect(await waiting).toMatchObject({ refusal: "seal-refused", cause: "the island answered" });
  });
});
