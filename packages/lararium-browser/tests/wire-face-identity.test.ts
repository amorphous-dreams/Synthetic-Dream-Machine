/**
 * wire-face-identity — the veil at the wire, on the browser vessel: what a page's Repo presents on its relay under one
 * face, and then under another, over ONE browser store.
 *
 * The vessel runs for real over the page's IndexedDB; the admit ceremony and the relay transport are fakes beneath it
 * (`wire-vessel-rig`), and the fake relay records the peer id and the peer metadata the vessel's Repo connects it with:
 * the same two values a hearth's gate reads off a real dial.
 *
 *   B1  face A dials, the same store boots face B and dials: the store id and the peer id both differ
 *   B2  face A boots again: it presents the store id it presented before (what the hearth keys this leaf's sync state on)
 *
 * The node vessel's twin, with the change actor and the floor, stands at `packages/lararium-node/tests/face-wire-identity.test.ts`.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import { LARES_DOC_URI, LARARIUM_DOC_URI } from "@lararium/mesh";
import { BootHalted, admitNaming, bootOptions, observed, resetObserved } from "./wire-vessel-rig.js";
import { bindSyntheticBrowserCustodySlot, bindSyntheticFace } from "./browser-custody-fixture.js";
import { openBrowserVessel } from "../src/open-browser-vessel.js";

vi.mock("@lararium/keyhive", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  // The rig's admit rests a stand-in Archive no hive wrote; a second admit of one face reads it as another atom's and keeps none.
  return { ...(await orig<object>()), runApplyAdmitPayload: async (input: never) => rig.fakeAdmitResult(input), archiveIsOf: async () => false };
});
vi.mock("../../lararium-mesh/src/lar-ws-client-adapter.ts", async (orig) => {
  const rig = await import("./wire-vessel-rig.js");
  return { ...(await orig<object>()), LarWSClientAdapter: rig.FakeRelayAdapter };
});

const SLOW = 300_000;
const hearth = "cd".repeat(32);
const named = { [LARES_DOC_URI]: generateAutomergeUrl(), [LARARIUM_DOC_URI]: generateAutomergeUrl() };
const FACE_A = "a1".repeat(32);
const FACE_B = "b2".repeat(32);

/** One boot of the store `idbName` wearing `face`, halted once its relay stands: what its Repo presented there. */
async function presentAs(idbName: string, face: string): Promise<{ peerId: string; storageId: string | undefined }> {
  resetObserved();
  const options = { ...bootOptions(admitNaming(hearth, named, face), hearth), idbName };
  await bindSyntheticBrowserCustodySlot(idbName);
  await bindSyntheticFace(idbName, face);
  await expect(openBrowserVessel(options)).rejects.toBeInstanceOf(BootHalted);
  const relay = observed.relays[0];
  expect(relay, "the vessel stood its relay adapter").toBeDefined();
  await vi.waitFor(() => { expect(relay!.presented, "the Repo connected the relay under its own identity").not.toBeNull(); }, { timeout: 30_000 });
  return relay!.presented!;
}

afterEach(() => resetObserved());

describe("the veil at the wire: one browser store presents no identifier under two faces", () => {
  test("B1 + B2: face A, then face B, then face A again over one store", async () => {
    const idbName = `wire-face-${crypto.randomUUID()}`;
    const a = await presentAs(idbName, FACE_A);
    const b = await presentAs(idbName, FACE_B);
    expect(a.storageId, "a durable page names a store id").toMatch(/\S/);
    expect(b.storageId).toMatch(/\S/);
    expect(b.storageId, "the store id repeats across the face switch").not.toBe(a.storageId);
    expect(b.peerId, "the peer id repeats across the face switch").not.toBe(a.peerId);
    const again = await presentAs(idbName, FACE_A);
    expect(again.storageId, "the same face keeps its store id across a restart").toBe(a.storageId);
    expect(again.peerId, "each boot mints its own peer id").not.toBe(a.peerId);
  }, SLOW);
});
