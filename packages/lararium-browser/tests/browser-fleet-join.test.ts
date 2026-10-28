/**
 * browser-fleet-join — the fleet-join door's joining half in a real browser origin: real IndexedDB, real WebCrypto.
 *
 *   B1  the browser reads an offer, mints its own face-scoped key per scope, and requests; the request reads back
 *       against the offer, and the same offer again answers the request already kept
 *   B2  an answer the root signed lands: the admit carries the signed pin, canon and reach, the address secret and
 *       the record rest in this browser's store, and the pending join stays, landed, until the boot settles it
 *   B3  an answer whose pin a carrier moved refuses `answer-admit-other-commit` (the face's admit no longer opens over it)
 *       and lands nothing; the good answer lands again
 *       until settled, then refuses `join-absent`; a standing secret under other bytes refuses untouched
 *   B4  the custody door signs only under the key its row holds
 *   B5  a request that broke after minting retries clean over the same offer, on the key it left at rest
 *   B6  a second face's root landing under a group this browser joined refuses `record-other`, and writes nothing
 *   B7  two requests at once keep one pending join: the other answers it, or refuses `join-pending`
 */
import { describe, expect, test } from "vitest";
import {
  admitCarriageCommit, custodyRootDoor, deriveGateBundle, sovereignGateRoot, sovereignRoute, type GateBundlePin, faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer, sealAddressSecret,
  readFleetJoinRequest, type FleetJoinOffer, type FleetJoinRequest, type VesselFaceKey,
} from "@lararium/mesh";
import { certificateImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { generateOrLoadBrowserVesselIdentity, openVesselIdb, idbGet, FLEET_JOIN_STORE } from "../src/browser-vessel-identity.js";
import { readKeystoreRow, withCustodyRows } from "../src/browser-custody.js";
import { bindSyntheticBrowserCustodySlot } from "./browser-custody-fixture.js";
import {
  browserFleetJoinAbandon, browserFleetJoinLand, browserFleetJoinRequest, browserFleetJoinSettle, browserVesselFaceKeyCustody,
} from "../src/browser-fleet-join.js";
import { chain, pair, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";
import { readBrowserFaceAtom } from "../src/browser-face-atom.js";
import { placeSeed } from "./browser-place-seed.fixture.js";
import { placeSignerFromSeed } from "@lararium/mesh";

const GROUP = "0xb7f1c2a9d4e60381";
const HEARTH_NEXUS = "nexus-hearth.synthetic";
const pinAt = (tag: number): GateBundlePin => {
  const bundle = deriveGateBundle(sovereignGateRoot(custodyRootDoor({ derive: () => new Uint8Array(32).fill(tag) })), new TextEncoder().encode(HEARTH_NEXUS), sovereignRoute("/ws"));
  try { return bundle.pin; } finally { bundle.drop(); }
};
const PIN = pinAt(5);
const CARRIAGE = { gatePin: PIN, canon: { "lar:///ha.ka.ba/bags/lares": "automerge:canon-lares" } };
const SALT = "5a".repeat(32);
const SECRET = new Uint8Array(32).fill(7);
let seq = 0;

async function stage(): Promise<{ idbName: string; offer: FleetJoinOffer; root: Awaited<ReturnType<typeof pair>>; face: Awaited<ReturnType<typeof chain>> }> {
  const idbName = `lares:fleet-join-${Date.now()}-${seq++}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  await bindSyntheticBrowserCustodySlot(idbName);
  const root = await pair("browser fleet root");
  const face = await chain("browser fleet face", HEARTH_NEXUS);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  return { idbName, root, face, offer: fleetJoinOffer({ personaGroup: GROUP, rootKey: root.key, nonce, scopes: [face.scope] }) };
}

async function answerTo(s: Awaited<ReturnType<typeof stage>>, request: FleetJoinRequest, secret: Uint8Array = SECRET) {
  const body = {
    nonce: request.nonce, atomKey: request.atomKey, personaGroup: GROUP,
    edge: { kind: "device-admit/v1", personaGroupId: GROUP, deviceEdge: "synthetic", hearthTrueName: HEARTH_NEXUS },
    carriage: CARRIAGE,
    reach: { syncUrl: "ws://hearth.synthetic:7777/ws", islandKind: "anchor", islandScope: HEARTH_NEXUS },
    // The dial the answer carries: the hearth's charter, the face's admit committing to this carriage, its floor pins.
    charter: "the hearth's charter",
    admit: { admit: { nym: s.face.scope.faceKey, action: "admit", parents: [], sealEpochCid: "epoch", carriageCommit: admitCarriageCommit({ carriage: CARRIAGE, salt: SALT }) }, lineage: [], salt: SALT },
    floorPins: [],
    secret: sealAddressSecret({ secret, request }),
  };
  const key = request.requests[0]!.vesselFaceKey as VesselFaceKey;
  const certificates = [{ scope: s.face.scope, vesselFaceKey: key, signature: await signHex(certificateImage(s.face.scope, key), s.face.face) }];
  const grants = [{ personaGroup: GROUP, scope: s.face.scope, signature: await signHex(faceKeyGrantImage(GROUP, s.face.scope), s.root) }];
  return { kind: "fleet-join-answer", ...body, certificates, grants, signature: await signHex(fleetJoinAnswerImage(body), s.root) };
}

const pendingOf = (idbName: string) => readKeystoreRow(idbName, `fleet-join-pending/${GROUP}`);

describe("the browser's fleet join", () => {
  test("B0 — two faces' joins stand pending at once; abandon without a name refuses, and naming one clears only it", async () => {
    const s = await stage();
    const GROUP_B = "0xb7f1c2a9d4e60382";
    const offerB = fleetJoinOffer({ personaGroup: GROUP_B, rootKey: s.root.key, nonce: "cd".repeat(32), scopes: [s.face.scope] });
    await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    await browserFleetJoinRequest({ offer: offerB, idbName: s.idbName });
    expect(await readKeystoreRow(s.idbName, `fleet-join-pending/${GROUP}`), "face A's own row").toBeDefined();
    expect(await readKeystoreRow(s.idbName, `fleet-join-pending/${GROUP_B}`), "face B's own row").toBeDefined();
    await expect(browserFleetJoinAbandon(s.idbName)).rejects.toThrow(/face-not-named/);
    expect(await browserFleetJoinAbandon(s.idbName, GROUP_B)).toBe(true);
    expect(await readKeystoreRow(s.idbName, `fleet-join-pending/${GROUP}`), "A stands").toBeDefined();
    expect(await browserFleetJoinAbandon(s.idbName)).toBe(true);   // the one left goes without a name
  });

  test("B1 — the browser mints its own face-scoped key and requests; the same offer again answers the kept request", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: JSON.parse(JSON.stringify(s.offer)), idbName: s.idbName });
    expect(request.requests.map((q) => q.scope)).toEqual([s.face.scope]);
    expect(request.requests[0]!.vesselFaceKey).not.toBe(request.atomKey);
    expect(await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName })).toEqual(request);
    const other = fleetJoinOffer({ ...s.offer, nonce: "ef".repeat(32) });
    await expect(browserFleetJoinRequest({ offer: other, idbName: s.idbName })).rejects.toThrow(/join-pending/);
    expect(await browserFleetJoinAbandon(s.idbName)).toBe(true);
    expect(await browserFleetJoinAbandon(s.idbName)).toBe(false);
  });

  test("the selected face atom signs its fleet request; the place key and another face fail the request reader", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const atom = await readBrowserFaceAtom(s.idbName, GROUP);
    const placeKey = placeSignerFromSeed(await placeSeed(s.idbName)).key;
    expect(request.atomKey).toBe(atom?.key);
    expect(request.atomKey).not.toBe(placeKey);
    expect(readFleetJoinRequest(request, s.offer, [s.offer.rootKey])).not.toHaveProperty("refusal");
    expect(readFleetJoinRequest({ ...request, atomKey: placeKey }, s.offer, [s.offer.rootKey])).toHaveProperty("refusal");
    const otherGroup = "0xb7f1c2a9d4e60382";
    const otherOffer = fleetJoinOffer({ ...s.offer, personaGroup: otherGroup, nonce: "ab".repeat(32) });
    const otherRequest = await browserFleetJoinRequest({ offer: otherOffer, idbName: s.idbName });
    expect(otherRequest.atomKey).not.toBe(request.atomKey);
    expect(readFleetJoinRequest({ ...request, atomKey: otherRequest.atomKey }, s.offer, [s.offer.rootKey])).toHaveProperty("refusal");
  });

  test("B2 — the root's answer lands: the admit carries the signed pin, and the secret and record rest here", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const { admit, answer } = await browserFleetJoinLand({ answer: JSON.parse(JSON.stringify(await answerTo(s, request))), idbName: s.idbName });
    expect(admit.hearthGatePubKey).toBe(PIN.signingKey);
    expect(admit.hearthGatePin).toEqual(PIN);
    expect(admit.syncUrl).toBe("ws://hearth.synthetic:7777/ws");
    expect(admit.hearthIslandKind).toBe("anchor");
    expect(answer.certificates[0]!.vesselFaceKey).toBe(request.requests[0]!.vesselFaceKey);
    const db = await openVesselIdb(s.idbName);
    try {
      expect(Array.from((await readKeystoreRow(s.idbName, `fleet-join-secret/${GROUP}`)) as Uint8Array)).toEqual(Array.from(SECRET));
      expect(await idbGet(db, FLEET_JOIN_STORE, `record:${GROUP}`)).toMatchObject({ personaGroup: GROUP, rootKey: s.root.key });
    } finally { db.close(); }
    expect(await pendingOf(s.idbName)).toMatchObject({ landed: true });
    expect(await browserFleetJoinSettle(s.idbName)).toBe(true);
    expect(await pendingOf(s.idbName)).toBeUndefined();
  });

  test("B3 — a moved pin refuses and lands nothing; the good answer lands once", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const good = await answerTo(s, request);
    await expect(browserFleetJoinLand({ answer: { ...good, carriage: { ...good.carriage, gatePin: pinAt(6) } }, idbName: s.idbName }))
      .rejects.toThrow(/answer-admit-other-commit/);
    expect(await pendingOf(s.idbName)).not.toHaveProperty("landed");
    const bare = await openVesselIdb(s.idbName);
    try {
      expect(await readKeystoreRow(s.idbName, `fleet-join-secret/${GROUP}`)).toBeUndefined();
      expect(await idbGet(bare, FLEET_JOIN_STORE, `record:${GROUP}`)).toBeUndefined();
    } finally { bare.close(); }
    // CONTROL: settling a join whose answer never landed leaves it standing.
    expect(await browserFleetJoinSettle(s.idbName)).toBe(false);
    await browserFleetJoinLand({ answer: good, idbName: s.idbName });
    // A boot that never came up retries from the same paste.
    await browserFleetJoinLand({ answer: good, idbName: s.idbName });
    // An answer sealing another secret for the same face refuses, and the landed secret stands.
    await expect(browserFleetJoinLand({ answer: await answerTo(s, request, new Uint8Array(32).fill(9)), idbName: s.idbName }))
      .rejects.toThrow(/secret-other/);
    const db = await openVesselIdb(s.idbName);
    try { expect(Array.from((await readKeystoreRow(s.idbName, `fleet-join-secret/${GROUP}`)) as Uint8Array)).toEqual(Array.from(SECRET)); } finally { db.close(); }
    expect(await browserFleetJoinSettle(s.idbName)).toBe(true);
    await expect(browserFleetJoinLand({ answer: good, idbName: s.idbName })).rejects.toThrow(/join-absent/);
  });

  test("B4 — the custody door signs only under the key its row holds", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const custody = browserVesselFaceKeyCustody(s.idbName);
    const image = new TextEncoder().encode("synthetic image");
    expect(await custody.signAsVesselFace(s.face.scope, request.requests[0]!.vesselFaceKey, image)).toHaveLength(64);
    await expect(custody.signAsVesselFace(s.face.scope, request.atomKey, image)).rejects.toThrow(/face-key-other/);
    await expect(custody.signAsVesselFace({ ...s.face.scope, nexus: "nexus-other.synthetic" } as never, request.atomKey, image)).rejects.toThrow(/face-key-absent/);
  });

  test("B5 — a request that broke after minting retries clean over the same offer, on the key it left at rest", async () => {
    const s = await stage();
    const first = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    // The break: the key rests, but the pending row never came to stand.
    await withCustodyRows(s.idbName, (rows) => rows.delete(`fleet-join-pending/${GROUP}`));
    const again = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    expect(again.requests[0]!.vesselFaceKey).toBe(first.requests[0]!.vesselFaceKey);
  });

  test("B6 — another root's landing under a group this browser joined refuses record-other and writes nothing", async () => {
    const s = await stage();
    await browserFleetJoinLand({ answer: await answerTo(s, await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName })), idbName: s.idbName });
    expect(await browserFleetJoinSettle(s.idbName)).toBe(true);
    // A second root claims the same group; its offer reaches this same browser.
    const other = { ...s, root: await pair("browser fleet other root") };
    const nonce = "ab".repeat(32);
    const offer = fleetJoinOffer({ personaGroup: GROUP, rootKey: other.root.key, nonce, scopes: [s.face.scope] });
    const request = await browserFleetJoinRequest({ offer, idbName: s.idbName });
    await expect(browserFleetJoinLand({ answer: await answerTo({ ...other, offer }, request), idbName: s.idbName })).rejects.toThrow(/record-other/);
    const db = await openVesselIdb(s.idbName);
    try {
      expect(await idbGet(db, FLEET_JOIN_STORE, `record:${GROUP}`)).toMatchObject({ rootKey: s.root.key });
      expect(Array.from((await readKeystoreRow(s.idbName, `fleet-join-secret/${GROUP}`)) as Uint8Array)).toEqual(Array.from(SECRET));
    } finally { db.close(); }
    expect(await pendingOf(s.idbName)).not.toHaveProperty("landed");
  });

  test("B7 — two requests at once keep one pending join", async () => {
    const s = await stage();
    const both = await Promise.allSettled([
      browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName }),
      browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName }),
    ]);
    const kept = (await pendingOf(s.idbName)) as { request: FleetJoinRequest };
    for (const r of both) {
      if (r.status === "fulfilled") expect(r.value.sealKey).toBe(kept.request.sealKey);
      else expect(String(r.reason)).toMatch(/join-pending/);
    }
    expect(both.some((r) => r.status === "fulfilled" && r.value.sealKey === kept.request.sealKey)).toBe(true);
  });
});
