/**
 * browser-fleet-root — a user's leaf fleet with no node: one browser founds a face, offers, and answers a second
 * browser's request; the second lands the answer. Real IndexedDB, real WebCrypto, the real founding ceremony.
 *
 *   R1  the founder's offer names its face and root and no scope, with the root shut; a browser that holds no root refuses `root-absent`
 *   R2  the founder answers the joinee's request under ONE ward route: the answer carries no hearth's dial, its edge binds
 *       no hearth, and the face's log takes one admission and one device-edge
 *   R3  the joinee lands it: its admit names no gate, and BOTH browsers hold one address secret for the face
 *   R4  the same request answered again serves the seated edge and appends nothing
 *   R5  a wrong ward route opens nothing: no act lands and no answer leaves
 *   R6  a request whose bytes a courier moved refuses by name, and no act lands
 *   R7  the same vessel under another atom refuses `vessel-already-admitted`: the tag law holds on a leaf's root
 */
import { describe, expect, test, vi } from "vitest";
import { admittedJoineeIsland, heldDocOf, personaActRecordsOfGroup, readFleetJoinOffer, fleetJoinHearthOf, type FleetJoinAnswer, type FleetJoinRequest, type LarDoc } from "@lararium/mesh";
import type { Repo } from "@automerge/automerge-repo";
import { openBrowserVessel, type BrowserVesselOptions } from "../src/open-browser-vessel.js";
import { generateOrLoadBrowserVesselIdentity } from "../src/browser-vessel-identity.js";
import { faceAtomRow, readBrowserFaceAddressSecret } from "../src/browser-face-atom.js";
import { withCustodyRows } from "../src/browser-custody.js";
import { browserFleetJoinLand, browserFleetJoinRequest, browserFleetJoinSettle } from "../src/browser-fleet-join.js";
import { browserFleetJoinOffer, browserFleetRootDoor, browserRootFaces, type BrowserRootFace, type BrowserSeatFace } from "../src/browser-fleet-root.js";
import { seatWardWorkerSpawn } from "../src/testing.js";
import { runWardAct } from "../src/ward-core.js";
import { bindSyntheticBrowserCustodySlot, fixtureWardDialog, FIXTURE_WARD_PASSPHRASE } from "./browser-custody-fixture.js";
import { BootHalted } from "./wire-vessel-rig.js";

seatWardWorkerSpawn(() => ({
  postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { port.postMessage(await runWardAct(m.data)); }; },
  terminate() {},
}));
/** The route the joinee's synthetic custody slot opens, for its ward key's mint. */
const JOINEE_WARD = { route: async () => "browser fixture custody slot" };

const seen = vi.hoisted(() => ({ foundings: [] as Array<{ repo: unknown; nexusPubkey: string }> }));
vi.mock("@lararium/keyhive", async (importOriginal) => {
  const real = await importOriginal<typeof import("@lararium/keyhive")>();
  return {
    ...real,
    // The founding door's face ceremony, watched for the Repo and the island it ran over; the ceremony itself runs real.
    foundTheFace: async (input: Parameters<typeof real.foundTheFace>[0]) => {
      const result = await real.foundTheFace(input);
      seen.foundings.push({ repo: input.repo, nexusPubkey: input.nexusPubkey });
      return result;
    },
  };
});

interface Founder { idbName: string; repo: Repo; root: BrowserRootFace; face: BrowserSeatFace; kelIsland: string; asks: string[] }

/** Browser 1: the founding door (`foundFace`, the page's founding button) over a veil floor, halted once its boot record rests. */
async function foundFace(): Promise<Founder> {
  const idbName = `browser-fleet-root-${crypto.randomUUID()}`;
  await bindSyntheticBrowserCustodySlot(idbName);
  const before = seen.foundings.length;
  await expect(openBrowserVessel({ idbName, foundFace: true, askWardRoute: fixtureWardDialog, onPhase: (phase: string) => {
    if (phase === "bootstrap-kept") throw new BootHalted();
  } } as unknown as BrowserVesselOptions)).rejects.toBeInstanceOf(BootHalted);
  const founding = seen.foundings[before];
  if (!founding) throw new Error("the founding door ran no face ceremony");
  // THE OVERLAY RECORD MAPS THE FACE ONTO ITS ROOT'S INDEX (`browserRootFaces`): the door the vessel host stands reads the same.
  const held = await browserRootFaces(idbName);
  expect(held).toHaveLength(1);
  const { seat, ...root } = held[0]!;
  return { idbName, repo: founding.repo as Repo, root, face: seat, kelIsland: founding.nexusPubkey, asks: [] };
}

/** Browser 2: a fresh origin's store, its custody bound, at its floor. */
async function joineeFor(group: string): Promise<string> {
  const idbName = `browser-fleet-leaf-${crypto.randomUUID()}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  await bindSyntheticBrowserCustodySlot(idbName, group);
  return idbName;
}

const logOf = (f: Founder): Record<string, unknown>[] =>
  personaActRecordsOfGroup(heldDocOf(f.repo as never, f.face.personaUrl) as LarDoc | undefined, f.face.personaGroupId).map((r) => (r as { body: Record<string, unknown> }).body);
const actsOf = (f: Founder, act: string, deviceKey: string) => logOf(f).filter((b) => b["act"] === act && b["deviceKey"] === deviceKey).length;

/** The answer through the door the vessel host stands (`browserFleetRootDoor`), its ward asked by the ceremony's stand-in. */
const answerOf = (f: Founder, request: unknown, ward: string = FIXTURE_WARD_PASSPHRASE): Promise<FleetJoinAnswer> =>
  browserFleetRootDoor({ idbName: f.idbName, repo: f.repo, kelIsland: f.kelIsland, askWard: async (act) => { f.asks.push(act); return ward; } })
    .answer(f.root.personaGroup, request);

describe("a leaf fleet: a browser that founded a face offers and answers, with no node", () => {
  test("R1–R6: found, offer, request, answer, land; the replay, the wrong route and the moved bytes", async () => {
    const founder = await foundFace();
    const group = founder.face.personaGroupId;

    // R1: the offer.
    const offer = await browserFleetJoinOffer({ face: founder.root, idbName: founder.idbName });
    const read = readFleetJoinOffer(JSON.parse(JSON.stringify(offer)));
    if ("refusal" in read) throw new Error(read.refusal);
    expect(read.personaGroup).toBe(group);
    expect(read.scopes).toEqual([]);
    const leaf = await joineeFor(group);
    await expect(browserFleetJoinOffer({ face: { personaGroup: group, handleIndex: 0 }, idbName: leaf })).rejects.toMatchObject({ refusal: "root-absent" });

    // The joinee's request, by the joining half that already stands.
    const request: FleetJoinRequest = await browserFleetJoinRequest({ offer: JSON.parse(JSON.stringify(offer)), idbName: leaf, ward: JOINEE_WARD });
    expect(actsOf(founder, "admission", request.atomKey)).toBe(0);

    // R5 first, so it reads a log no answer touched: a wrong route opens no ward, and nothing lands.
    await expect(answerOf(founder, request, "not the route this face was born under")).rejects.toThrow();
    expect(actsOf(founder, "admission", request.atomKey)).toBe(0);

    // R6: a courier moved the request's bytes.
    await expect(answerOf(founder, { ...request, sealKey: request.sealKey.replace(/^../, request.sealKey.startsWith("00") ? "11" : "00") })).rejects.toMatchObject({ refusal: expect.stringMatching(/^request-(unsigned|malformed)$/) });
    expect(actsOf(founder, "admission", request.atomKey)).toBe(0);

    // R2: the answer.
    const answer = await answerOf(founder, JSON.parse(JSON.stringify(request)));
    expect(fleetJoinHearthOf(answer)).toBeNull();
    expect((answer.edge as { hearthTrueName: string }).hearthTrueName).toBe("");
    expect(answer.reach).toEqual({ syncUrl: null, islandKind: "own", islandScope: founder.kelIsland });
    expect(answer.certificates).toEqual([]);
    expect(actsOf(founder, "admission", request.atomKey)).toBe(1);
    expect(actsOf(founder, "device-edge", request.atomKey)).toBe(1);
    // ONE ASK PER ANSWER: the wrong route, the moved bytes and this answer each asked the ceremony once.
    expect(founder.asks).toHaveLength(3);
    expect(await browserRootFaces(leaf)).toEqual([]);

    // R3: the landing.
    const landed = await browserFleetJoinLand({ answer: JSON.parse(JSON.stringify(answer)), idbName: leaf });
    expect(landed.admit.personaGroupId).toBe(group);
    expect(landed.admit.hearthGatePin).toBeUndefined();
    expect(landed.admit.hearthTrueName).toBe("");
    // The admit names the founder's own island (`own`), and the joinee resolves ITS OWN island from it, as each later boot does.
    expect(landed.admit.hearthIslandKind).toBe("own");
    expect(admittedJoineeIsland({ hearthGatePubKey: landed.admit.hearthGatePubKey, hearthIslandKind: landed.admit.hearthIslandKind, hearthIslandScope: landed.admit.hearthIslandScope, ownVesselKey: "ab".repeat(32) })).toBe("ab".repeat(32));
    const [mine, theirs] = [await readBrowserFaceAddressSecret(founder.idbName, group), await readBrowserFaceAddressSecret(leaf, group)];
    expect(mine).not.toBeNull();
    expect(Array.from(theirs ?? [])).toEqual(Array.from(mine ?? []));

    // R4: the replay.
    const again = await answerOf(founder, request);
    expect((again.edge as { deviceEdge: unknown }).deviceEdge).toEqual((answer.edge as { deviceEdge: unknown }).deviceEdge);
    expect(actsOf(founder, "admission", request.atomKey)).toBe(1);
    expect(actsOf(founder, "device-edge", request.atomKey)).toBe(1);

    // R7: THE TAG LAW. The same vessel comes back under another atom (its tag secret unmoved): the face seats one vessel once.
    await browserFleetJoinSettle(leaf, group);
    // The atom row moved by hand, past the custody contract that refuses to move it: a vessel that re-minted its atom.
    await withCustodyRows(leaf, async (rows) => { await rows.write(faceAtomRow(group), crypto.getRandomValues(new Uint8Array(32))); });
    const second = await browserFleetJoinRequest({ offer: JSON.parse(JSON.stringify(await browserFleetJoinOffer({ face: founder.root, idbName: founder.idbName }))), idbName: leaf, ward: JOINEE_WARD });
    expect(second.atomKey).not.toBe(request.atomKey);
    expect(second.vesselTag).toBe(request.vesselTag);
    await expect(answerOf(founder, second)).rejects.toMatchObject({ refusal: "vessel-already-admitted" });
    expect(actsOf(founder, "admission", second.atomKey)).toBe(0);
  }, 180_000);
});
