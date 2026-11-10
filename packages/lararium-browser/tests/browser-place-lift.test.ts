/**
 * browser-place-lift — a SELF-FOUNDED, unjoined browser face lifts at its own place while its custody stands unlocked
 * (the node's place session, ported): the founding armed a place KEL through the cold card, the face's atom certifies one
 * place session there, and the island seals the face's device documents under that session. A relock drops the lift; a
 * device joined to another's face stays at its floor.
 *
 *   P1  the decision: a self-founded, proved, unjoined face on a browser whose place stands lifts at its place; a face this
 *       browser holds no root of (joined to another's), a joined or presented face, an unproved face or a browser with no
 *       place stays put. CONTROL: the one reading that lifts.
 *   P2  RED: an unlocked self-founded browser mints its face's place session, the island signs a booked seal under it, the
 *       sealed value reads back after a restart of the holder; the relock drops the signer and the next ask refuses.
 *   P3  a browser that armed no place KEL mints no place session (it refuses by name) and lifts nothing.
 *   P4  the boot's lift seam: the self-founded branch stands the place lift through the same lift stack and lock as the
 *       Nexus lift, and the lock closes the place session's table.
 *   P5  RED: the daemon island rests a wrap's Archive through the vessel's custody door while the lift stands (the node's
 *       `sealOnVessel`); at the floor the write answers unwritten and the wrap refuses by name. The browser's daemon island
 *       hands its behaviour that writer (a lift with no writer refused every wrap `wrap-failed`).
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-store · lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { describe, expect, test } from "vitest";
import { answerIslandAsks, composeVessel, islandFloorStack, islandLiftStack, larVesselOf } from "@lararium/mesh";
import { islandSessionDoor } from "@lararium/keyhive";
import { browserSessionLift, islandCustodyWriter } from "../src/browser-island-caps.js";
import { browserLiftsAtPlace, mintBrowserPlaceSession } from "../src/browser-place-session.js";
import { browserFaceAtom } from "../src/browser-face-atom.js";
import { generateOrLoadBrowserVesselIdentity, loadBrowserPlaceKel } from "../src/browser-vessel-identity.js";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace } from "./browser-custody-fixture.js";
import { said, vessel, world } from "../../lararium-mesh/tests/content-key-fixture.js";
import { utf8Bytes } from "../../lararium-mesh/src/crypto.js";

const GROUP = "b7f1c2a9d4e60381";
const BAG = "lar:///ha.ka.ba/wikis/daemon/working";
const SOURCES = import.meta.glob(["../src/open-browser-vessel.ts", "../src/daemon-island-start.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** A vessel-to-island wire in one thread (as browser-island-caps.test). */
function wire() {
  const toVessel = new Set<(m: unknown) => void>();
  const toIsland = new Set<(m: unknown) => void>();
  return {
    vesselSide: {
      post: (m: unknown) => { queueMicrotask(() => { for (const l of toIsland) l(structuredClone(m)); }); },
      listen: (cb: (m: unknown) => void) => { toVessel.add(cb); return () => toVessel.delete(cb); },
    },
    islandSide: {
      post: (m: unknown) => { queueMicrotask(() => { for (const l of toVessel) l(structuredClone(m)); }); },
      listen: (cb: (m: unknown) => void) => { toIsland.add(cb); },
    },
  };
}

/** A fresh browser: its custody slot, the face's tree, its identity and (where `card`) the place KEL its founding armed. */
async function browser(card: boolean): Promise<{ idbName: string; atomKey: string }> {
  const idbName = `browser-place-lift-${crypto.randomUUID()}`;
  await bindSyntheticBrowserCustodySlot(idbName);
  await bindSyntheticFace(idbName, GROUP);
  // The card stand-in reads back true: the ceremony's own read-back runs in lararium-web's vessel host.
  await generateOrLoadBrowserVesselIdentity(idbName, undefined, card ? { placeFoundingCard: { readBack: async () => {} } } : {});
  const atom = await browserFaceAtom(idbName, GROUP);
  return { idbName, atomKey: atom.key };
}

describe("a self-founded browser face lifts at its own place", () => {
  test("P1 — the decision: only a self-founded, proved, unjoined face on a browser whose place stands lifts at its place", () => {
    const lifts = { presented: false, joined: false, rootHeld: true, proved: true, placeStands: true };
    expect(browserLiftsAtPlace(lifts), "CONTROL: the self-founded face lifts").toBe(true);
    expect(browserLiftsAtPlace({ ...lifts, rootHeld: false }), "joined to another's face: no root here, stays at the floor").toBe(false);
    expect(browserLiftsAtPlace({ ...lifts, joined: true }), "a hearth's admit or dial: it lifts through its Nexus").toBe(false);
    expect(browserLiftsAtPlace({ ...lifts, presented: true }), "a Nexus presentation stands: that lift serves").toBe(false);
    expect(browserLiftsAtPlace({ ...lifts, proved: false }), "an unproved face lifts nothing").toBe(false);
    expect(browserLiftsAtPlace({ ...lifts, placeStands: false }), "no place KEL: nothing to present the atom to").toBe(false);
  });

  test("P2 — RED: the place session signs a booked seal, the value reads back after a restart, and the relock drops it all", async () => {
    const { idbName, atomKey } = await browser(true);
    const kel = await loadBrowserPlaceKel(idbName);
    expect(kel?.ok, "the founding armed the place KEL").toBe(true);
    const minted = await mintBrowserPlaceSession({ idbName, personaGroup: GROUP, atomKey });
    if ("refusal" in minted) throw new Error(minted.refusal);
    expect(minted.session.chain).toEqual({ place: { atomKey, place: kel!.ok ? kel!.aid : "" } });

    const floor = larVesselOf(await composeVessel(islandFloorStack({ cas: async () => null })));
    const sl = browserSessionLift(minted.session);
    const lifted = await composeVessel(islandLiftStack(floor, sl.lift));
    expect(floor.liftedFace()).toBe(sl.subject);
    const w = wire();
    answerIslandAsks(w.vesselSide, floor.record);
    const proof = islandSessionDoor(w.islandSide, { idPrefix: "browser-place" });

    const release = sl.hold("call-1", "sealed-seal");
    const reading = await proof.signer({ requestId: "call-1", verb: "sealed-seal" });
    if ("refusal" in reading) throw new Error(reading.refusal);
    expect(reading.chain).toEqual(minted.session.chain);
    const v = await vessel(world(), "browser-place");
    const sealed = await v.holder.sealBlob({ bagId: BAG, plaintext: utf8Bytes("a line the device wrote"), signer: reading.signer, founding: { history: "closed" } });
    expect(said(sealed)).toBe("OK");
    release();
    // THE REST HOLDS: a fresh holder over the same sealed rest (a restart) opens what the place session sealed.
    const ref = (sealed as { body: { ref: string } }).body.ref;
    const reopened = await v.restart().openBlob({ bagId: BAG, ref });
    expect(said(reopened)).toBe("OK");
    expect(new TextDecoder().decode((reopened as { plaintext: Uint8Array }).plaintext)).toContain("a line the device wrote");

    // THE RELOCK: the lift leaves the record, the signer drops, the table closes, and the next booked ask refuses by name.
    await lifted.dispose();
    minted.close();
    expect(floor.liftedFace()).toBeNull();
    expect(floor.record.sessionSign).toBeUndefined();
    expect(minted.session.signer.dropped).toBe(true);
    sl.hold("call-2", "sealed-seal");
    expect(said(await proof.signer({ requestId: "call-2", verb: "sealed-seal" }))).toBe("signer-unavailable");
  });

  test("P3 — a browser that armed no place KEL mints no place session", async () => {
    const { idbName, atomKey } = await browser(false);
    expect(await loadBrowserPlaceKel(idbName)).toBeNull();
    expect(await mintBrowserPlaceSession({ idbName, personaGroup: GROUP, atomKey })).toEqual({ refusal: "place-unfounded" });
  });

  test("P4 — the boot's lift seam: the self-founded branch stands the place lift through the one lift stack and lock", () => {
    const open = (SOURCES["../src/open-browser-vessel.ts"] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(open).toMatch(/browserLiftsAtPlace\(/);
    expect(open).toMatch(/mintBrowserPlaceSession\(/);
    // One lift stack serves both anchors: exactly one `islandLiftStack(` call and one lock registration on custody.
    expect(open.match(/islandLiftStack\(/g)?.length).toBe(1);
    expect(open.match(/onBrowserCustodyLock\(idbName, \(\) => \{ void lockThenDrop\(\); \}\)/g)?.length).toBe(1);
  });

  test("P5 — RED: the island rests a wrap's Archive through the vessel's custody door while the lift stands, and the floor refuses it", async () => {
    const { idbName, atomKey } = await browser(true);
    const minted = await mintBrowserPlaceSession({ idbName, personaGroup: GROUP, atomKey });
    if ("refusal" in minted) throw new Error(minted.refusal);
    const rested: Uint8Array[] = [];
    const floor = larVesselOf(await composeVessel(islandFloorStack({ cas: async () => null })));
    const w = wire();
    answerIslandAsks(w.vesselSide, floor.record);
    const write = islandCustodyWriter(w.islandSide as never, "archive");
    // AT THE FLOOR: no custody door stands, so the wrap's Archive refuses by name and nothing rests.
    await expect(write("veil", utf8Bytes("archive at the floor"))).rejects.toThrow(/did not seal the veil carrier/);
    const sl = browserSessionLift(minted.session, async (_carrier, bytes) => { rested.push(bytes); });
    const lifted = await composeVessel(islandLiftStack(floor, sl.lift));
    await write("veil", utf8Bytes("archive under the lift"));
    expect(rested.map((b) => new TextDecoder().decode(b))).toEqual(["archive under the lift"]);
    await lifted.dispose();
    minted.close();
    await expect(write("veil", utf8Bytes("after the lock"))).rejects.toThrow(/did not seal/);
    const island = (SOURCES["../src/daemon-island-start.ts"] ?? "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(island).toMatch(/persistVeilArchive: \(bytes: Uint8Array\) => sealOnVessel\("veil", bytes\)/);
  });
});
