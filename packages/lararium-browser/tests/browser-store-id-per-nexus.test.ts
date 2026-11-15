/**
 * browser-store-id-per-nexus — the veil at the wire, on the browser vessel's relay: what a page's Repo presents to the
 * hearth of one Nexus, and then to the hearth of another, wearing ONE face over ONE browser store.
 *
 * The store keeps one store id for each face it wears, and it holds across a restart. A relay adapter that joins the
 * Repo bare presents that id at every Nexus the face dials, so two hearths that compare what they read match one browser
 * across their two Nexuses, restart after restart. The page in turn keys a hearth's sync state on the store id the
 * hearth names, so one remote store met at two Nexuses would open each exchange from the heads the other reached.
 *
 * The vessel runs for real over the page's IndexedDB; the admit ceremony and the relay transport stand as fakes beneath
 * it (`wire-vessel-rig`). The fake relay records what the vessel's Repo connects it with (the two values a hearth's gate
 * reads off a real dial), and a hearth's arrival on it shows the store id the Repo hears for that hearth.
 *
 *   N1  RED: face A at Nexus 1, then at Nexus 2: the two hearths read unrelated store ids
 *   N2  RED: one remote store id rests under each Nexus's own local scope, never bare
 *   N3  CONTROL: face A at Nexus 1 again, after a restart: the store id it presented before, the local scope it rested
 *       under before, and a peer id of its own
 *
 * The node vessel's twin stands at `packages/lararium-node/tests/face-wire-alias.test.ts` (V2, V4, V5).
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/residency-follows-the-contract#/faces-sit-flat
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { generateAutomergeUrl, type PeerId, type PeerMetadata } from "@automerge/automerge-repo";
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
const NEXUS_1 = "11".repeat(16);
const NEXUS_2 = "22".repeat(16);
/** Both hearths name this one store: two Nexus sessions that meet ONE remote store. */
const HEARTH_STORE = "hearth-store";

interface Presented { readonly peerId: string; readonly storageId: string | undefined; /** The hearth's store id as the page's Repo hears it. */ readonly hearthStoreAtPage: string | undefined }

/** One boot of the store `idbName` wearing `face` at `nexus`, halted once its relay stands: what its Repo presented there,
 *  and what it heard of the hearth that arrived. */
async function presentAt(idbName: string, face: string, nexus: string): Promise<Presented> {
  resetObserved();
  const options = { ...bootOptions(admitNaming(hearth, named, face), hearth, nexus), idbName };
  await bindSyntheticBrowserCustodySlot(idbName);
  await bindSyntheticFace(idbName, face);
  await expect(openBrowserVessel(options)).rejects.toBeInstanceOf(BootHalted);
  const relay = observed.relays[0];
  expect(relay, "the vessel stood its relay adapter").toBeDefined();
  await vi.waitFor(() => { expect(relay!.presented, "the Repo connected the relay").not.toBeNull(); }, { timeout: 30_000 });
  const heard: Array<string | undefined> = [];
  relay!.on("peer-candidate", ({ peerMetadata }: { peerMetadata: PeerMetadata }) => { heard.push(peerMetadata.storageId); });
  relay!.emit("peer-candidate", { peerId: "hearth-peer" as PeerId, peerMetadata: { storageId: HEARTH_STORE as NonNullable<PeerMetadata["storageId"]> } });
  expect(heard.length, "the hearth's arrival reached the Repo's side of the relay").toBe(1);
  return { ...relay!.presented!, hearthStoreAtPage: heard[0] };
}

afterEach(() => resetObserved());

describe("the veil at the wire: one browser face presents no identifier at two Nexuses", () => {
  test("N1 + N2 + N3: face A at Nexus 1, at Nexus 2, then at Nexus 1 again over one store", async () => {
    const idbName = `store-nexus-${crypto.randomUUID()}`;
    const one = await presentAt(idbName, FACE_A, NEXUS_1);
    const two = await presentAt(idbName, FACE_A, NEXUS_2);
    const again = await presentAt(idbName, FACE_A, NEXUS_1);
    // N3 CONTROL: one face at one Nexus resumes. The hearth keys this leaf's sync state on the store id, and the page
    // keys the hearth's on the scope its store id rests under.
    expect(one.storageId, "a durable page names a store id").toMatch(/\S/);
    expect(again.storageId, "one face at one Nexus keeps its store id across a restart").toBe(one.storageId);
    expect(again.hearthStoreAtPage, "one face at one Nexus keeps the scope its hearth's sync state rests under").toBe(one.hearthStoreAtPage);
    expect(again.peerId, "each boot mints its own peer id").not.toBe(one.peerId);
    // N1 RED: two hearths that compare what they read match no store id.
    expect(two.storageId).toMatch(/\S/);
    expect(two.storageId, "the store id repeats across the two Nexuses").not.toBe(one.storageId);
    expect(two.peerId).not.toBe(one.peerId);
    // N2 RED: the hearth's store id rests under the (face, Nexus) that met it.
    expect(one.hearthStoreAtPage, "the page holds the hearth's store id bare").not.toBe(HEARTH_STORE);
    expect(one.hearthStoreAtPage).toContain(HEARTH_STORE);
    expect(two.hearthStoreAtPage, "two Nexus sessions key one remote store's sync state alike").not.toBe(one.hearthStoreAtPage);
  }, SLOW);
});
