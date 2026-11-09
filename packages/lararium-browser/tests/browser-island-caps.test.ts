import { publicIslandFixture } from "../../lararium-mesh/tests/public-share-fixture.js";
/**
 * browser-island-caps — slice 5b: the browser answers its daemon island's asks through a record composed through
 * the one composer. Receipt, cas and dyad stand at construction; `custodyWrite` and `sessionSign` stand
 * only while a lift holds them. A floor signs nothing (`signer-unavailable`, as `composeHerm` answers); an unlocked
 * vessel signs a booked call, the holder seals under that signature, and the lock takes it all back.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices (slice 5b)
 */
import { describe, expect, it } from "vitest";
import { answerIslandAsks, composeVessel, islandFloorStack, islandLiftStack, larVesselOf } from "@lararium/mesh";
import { islandSessionDoor } from "@lararium/keyhive";
import { browserSessionLift } from "../src/browser-island-caps.js";
import { said, vessel, world } from "../../lararium-mesh/tests/content-key-fixture.js";
import { utf8Bytes } from "../../lararium-mesh/src/crypto.js";

/** A vessel-to-island wire in one thread: what the island posts reaches the vessel's listeners, and back. */
function wire() {
  const toVessel = new Set<(m: unknown) => void>();
  const toIsland = new Set<(m: unknown) => void>();
  const vesselSide = {
    post: (m: unknown) => { queueMicrotask(() => { for (const l of toIsland) l(structuredClone(m)); }); },
    listen: (cb: (m: unknown) => void) => { toVessel.add(cb); return () => toVessel.delete(cb); },
  };
  const islandSide = {
    post: (m: unknown) => { queueMicrotask(() => { for (const l of toVessel) l(structuredClone(m)); }); },
    listen: (cb: (m: unknown) => void) => { toIsland.add(cb); },
  };
  /** Post one ask from the island, and wait for the vessel's answer on its request id: the far-side barrier. */
  const ask = (msg: { type: string; requestId: string } & Record<string, unknown>): Promise<Record<string, unknown>> => new Promise((resolve) => {
    const settle = (m: unknown): void => { const r = m as Record<string, unknown>; if (r["requestId"] === msg.requestId) { toIsland.delete(settle); resolve(r); } };
    toIsland.add(settle);
    islandSide.post(msg);
  });
  return { vesselSide, islandSide, ask };
}

const SOURCES = import.meta.glob(["../src/open-browser-daemon-vm.ts", "../src/open-browser-vessel.ts", "../src/daemon-island-start.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const floorOf = async () => larVesselOf(await composeVessel(islandFloorStack({ ...publicIslandFixture, cas: async (cid) => (cid === "cid-held" ? utf8Bytes("held bytes") : null) })));

describe("slice 5b: the browser's island asks answer through its capability record", () => {
  it("a browser vessel at its floor answers session:sign with signer-unavailable by name, as composeHerm does", async () => {
    const floor = await floorOf();
    const w = wire();
    answerIslandAsks(w.vesselSide, floor.record);
    expect(floor.record.sessionSign).toBeUndefined();
    expect(floor.record.custodyWrite).toBeUndefined();
    const read = await w.ask({ type: "session:sign", requestId: "s1", op: "read", ask: "call-1", verb: "sealed-seal" });
    expect(read).toEqual({ type: "session:signed", requestId: "s1", refusal: "signer-unavailable" });
    const sign = await w.ask({ type: "session:sign", requestId: "s2", op: "sign", ask: "call-1", verb: "sealed-seal", payload: utf8Bytes("x") });
    expect(sign["refusal"]).toBe("signer-unavailable");
    // The floor's own members answer: cas by its plane, and a custody write refuses by the absent member's name.
    expect(new TextDecoder().decode((await w.ask({ type: "cas:want", requestId: "c1", cid: "cid-held" }))["bytes"] as Uint8Array)).toBe("held bytes");
    expect((await w.ask({ type: "cas:want", requestId: "c2", cid: "cid-absent" }))["bytes"]).toBeNull();
    const custody = await w.ask({ type: "custody:write", requestId: "w1", carrier: "veil", bytes: utf8Bytes("archive") });
    expect(custody).toMatchObject({ written: false, why: "no custodyWrite capability stands on this vessel" });
    // CONTROL: a nonsense op refuses too, and a dyad ask with no reader stands aside.
    expect((await w.ask({ type: "session:sign", requestId: "s3", op: "mint", ask: "call-1", verb: "sealed-seal" }))["refusal"]).toBe("signer-unavailable");
    expect((await w.ask({ type: "dyad:ask", requestId: "d1", fleetRoot: "root", deviceKey: "key" }))["standing"]).toBe("aside");
  });

  it("an unlocked browser vessel signs a call its session booked, the holder seals under that signature, and the lock takes the lift back", async () => {
    const wd = world();
    const v = await vessel(wd, "browser");
    let dropped = false;
    const floor = await floorOf();
    const sl = browserSessionLift({
      signer: { get dropped() { return dropped; }, certificate: v.signer.certificate, sign: (purpose, payload) => v.signer.sign(purpose, payload), drop: () => { dropped = true; } } as never,
      chain: { scope: v.chain.scope, vesselFaceKey: v.chain.certificate.vesselFaceKey },
    }, async () => {});
    const lifted = await composeVessel(islandLiftStack(floor, sl.lift));
    expect(floor.liftedFace()).not.toBeNull();
    expect(floor.record.sessionSign).toBeTypeOf("function");
    expect(floor.record.custodyWrite).toBeTypeOf("function");
    const w = wire();
    answerIslandAsks(w.vesselSide, floor.record);
    const proof = islandSessionDoor(w.islandSide, { idPrefix: "browser-island" });

    // An ask no session booked borrows no signer, unlocked or not.
    expect(said(await proof.signer({ requestId: "call-unbooked", verb: "sealed-seal" }))).toBe("signer-unavailable");
    const release = sl.hold("call-1", "sealed-seal");
    // Another verb under a booked id borrows nothing either.
    expect(said(await proof.signer({ requestId: "call-1", verb: "sealed-open" }))).toBe("signer-unavailable");
    const reading = await proof.signer({ requestId: "call-1", verb: "sealed-seal" });
    if ("refusal" in reading) throw new Error(reading.refusal);
    expect(reading.chain.scope).toEqual(v.chain.scope);
    // THE HOLDER SEALS: the signature crosses the port, the key never does.
    const sealed = await v.holder.sealBlob({ bagId: "lar:///ha.ka.ba/@test/bags/browser-notes", plaintext: utf8Bytes("a private line"), signer: reading.signer, founding: { history: "closed" } });
    expect(said(sealed)).toBe("OK");
    release();

    // THE LOCK: the lift leaves the record, the signer drops, and the next ask refuses by name.
    await lifted.dispose();
    expect(floor.liftedFace()).toBeNull();
    expect(dropped).toBe(true);
    expect(floor.record.sessionSign).toBeUndefined();
    expect(floor.record.custodyWrite).toBeUndefined();
    sl.hold("call-2", "sealed-seal");
    expect(said(await proof.signer({ requestId: "call-2", verb: "sealed-seal" }))).toBe("signer-unavailable");
    // CONTROL: the floor's members stay.
    expect(floor.record.cas).toBeTypeOf("function");
  });

  it("the vessel worker answers its daemon island through the record its vessel composed (a census of the spawn seam)", () => {
    const strip = (path: string): string => (SOURCES[`../src/${path}`] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const vm = strip("open-browser-daemon-vm.ts");
    expect(vm.length).toBeGreaterThan(0);
    expect(vm.match(/answerIslandAsks\(/g)?.length).toBe(1);
    const open = strip("open-browser-vessel.ts");
    expect(open).toMatch(/islandFloorStack\(/);
    expect(open).toMatch(/islandLiftStack\(/);
    expect(open).not.toMatch(/composeBrowserIslandCaps\(|liftBrowserIslandCaps\(/);
    const island = strip("daemon-island-start.ts");
    expect(island).toMatch(/sessionProof:/);
  });
});
