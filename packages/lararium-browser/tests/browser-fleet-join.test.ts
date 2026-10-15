/**
 * browser-fleet-join — the fleet-join door's joining half in a real browser origin: real IndexedDB, real WebCrypto.
 *
 *   B1  the browser reads an offer, mints its own face-scoped key per scope, and requests; the request reads back
 *       against the offer, and the same offer again answers the request already kept
 *   B2  an answer the root signed lands: the admit carries the signed pin, canon and reach, the address secret and
 *       the record rest in this browser's store, and the pending join stays, landed, until the boot settles it
 *   B3  an answer whose pin a carrier moved refuses `answer-unsigned` and lands nothing; the good answer lands again
 *       until settled, then refuses `join-absent`; a standing secret under other bytes refuses untouched
 *   B4  the custody door signs only under the key its row holds
 *   B5  a request that broke after minting retries clean over the same offer, on the key it left at rest
 */
import { describe, expect, test } from "vitest";
import {
  faceKeyGrantImage, fleetJoinAnswerImage, fleetJoinOffer, sealAddressSecret,
  type FleetJoinOffer, type FleetJoinRequest, type VesselFaceKey,
} from "@lararium/mesh";
import { certificateImage } from "../../lararium-mesh/src/face-proof-subjects.js";
import { generateOrLoadBrowserVesselIdentity, openVesselIdb, idbDelete, idbGet, FLEET_JOIN_STORE } from "../src/browser-vessel-identity.js";
import {
  browserFleetJoinAbandon, browserFleetJoinLand, browserFleetJoinRequest, browserFleetJoinSettle, browserVesselFaceKeyCustody,
} from "../src/browser-fleet-join.js";
import { chain, pair, signHex } from "../../lararium-mesh/tests/face-proof-fixture.js";

const GROUP = "0xb7f1c2a9d4e60381";
const PIN = "cd".repeat(32);
const SECRET = new Uint8Array(32).fill(7);
let seq = 0;

async function stage(): Promise<{ idbName: string; offer: FleetJoinOffer; root: Awaited<ReturnType<typeof pair>>; face: Awaited<ReturnType<typeof chain>> }> {
  const idbName = `lares:fleet-join-${Date.now()}-${seq++}`;
  await generateOrLoadBrowserVesselIdentity(idbName);
  const root = await pair("browser fleet root");
  const face = await chain("browser fleet face", "nexus-browser.synthetic");
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
  return { idbName, root, face, offer: fleetJoinOffer({ personaGroup: GROUP, rootKey: root.key, nonce, scopes: [face.scope] }) };
}

async function answerTo(s: Awaited<ReturnType<typeof stage>>, request: FleetJoinRequest, secret: Uint8Array = SECRET) {
  const body = {
    nonce: request.nonce, vesselKey: request.vesselKey, personaGroup: GROUP,
    edge: { kind: "device-admit/v1", personaGroupId: GROUP, deviceEdge: "synthetic" },
    carriage: { gatePin: PIN, canon: { "lar:///ha.ka.ba/bags/lares": "automerge:canon-lares" } },
    reach: { syncUrl: "ws://hearth.synthetic:7777/ws", islandKind: "anchor", islandScope: null },
    secret: sealAddressSecret({ secret, request }),
  };
  const key = request.requests[0]!.vesselFaceKey as VesselFaceKey;
  const certificates = [{ scope: s.face.scope, vesselFaceKey: key, signature: await signHex(certificateImage(s.face.scope, key), s.face.face) }];
  const grants = [{ personaGroup: GROUP, scope: s.face.scope, signature: await signHex(faceKeyGrantImage(GROUP, s.face.scope), s.root) }];
  return { kind: "fleet-join-answer", ...body, certificates, grants, signature: await signHex(fleetJoinAnswerImage(body), s.root) };
}

const pendingOf = async (idbName: string) => { const db = await openVesselIdb(idbName); try { return await idbGet(db, FLEET_JOIN_STORE, "pending"); } finally { db.close(); } };

describe("the browser's fleet join", () => {
  test("B1 — the browser mints its own face-scoped key and requests; the same offer again answers the kept request", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: JSON.parse(JSON.stringify(s.offer)), idbName: s.idbName });
    expect(request.requests.map((q) => q.scope)).toEqual([s.face.scope]);
    expect(request.requests[0]!.vesselFaceKey).not.toBe(request.vesselKey);
    expect(await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName })).toEqual(request);
    const other = fleetJoinOffer({ ...s.offer, nonce: "ef".repeat(32) });
    await expect(browserFleetJoinRequest({ offer: other, idbName: s.idbName })).rejects.toThrow(/join-pending/);
    expect(await browserFleetJoinAbandon(s.idbName)).toBe(true);
    expect(await browserFleetJoinAbandon(s.idbName)).toBe(false);
  });

  test("B2 — the root's answer lands: the admit carries the signed pin, and the secret and record rest here", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const { admit, answer } = await browserFleetJoinLand({ answer: JSON.parse(JSON.stringify(await answerTo(s, request))), idbName: s.idbName });
    expect(admit.hearthGatePubKey).toBe(PIN);
    expect(admit.syncUrl).toBe("ws://hearth.synthetic:7777/ws");
    expect(admit.hearthIslandKind).toBe("anchor");
    expect(answer.certificates[0]!.vesselFaceKey).toBe(request.requests[0]!.vesselFaceKey);
    const db = await openVesselIdb(s.idbName);
    try {
      expect(Array.from((await idbGet<Uint8Array>(db, FLEET_JOIN_STORE, `secret:${GROUP}`))!)).toEqual(Array.from(SECRET));
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
    await expect(browserFleetJoinLand({ answer: { ...good, carriage: { ...good.carriage, gatePin: "ee".repeat(32) } }, idbName: s.idbName }))
      .rejects.toThrow(/answer-unsigned/);
    expect(await pendingOf(s.idbName)).not.toHaveProperty("landed");
    // CONTROL: settling a join whose answer never landed leaves it standing.
    expect(await browserFleetJoinSettle(s.idbName)).toBe(false);
    await browserFleetJoinLand({ answer: good, idbName: s.idbName });
    // A boot that never came up retries from the same paste.
    await browserFleetJoinLand({ answer: good, idbName: s.idbName });
    // An answer sealing another secret for the same face refuses, and the landed secret stands.
    await expect(browserFleetJoinLand({ answer: await answerTo(s, request, new Uint8Array(32).fill(9)), idbName: s.idbName }))
      .rejects.toThrow(/secret-other/);
    const db = await openVesselIdb(s.idbName);
    try { expect(Array.from((await idbGet<Uint8Array>(db, FLEET_JOIN_STORE, `secret:${GROUP}`))!)).toEqual(Array.from(SECRET)); } finally { db.close(); }
    expect(await browserFleetJoinSettle(s.idbName)).toBe(true);
    await expect(browserFleetJoinLand({ answer: good, idbName: s.idbName })).rejects.toThrow(/join-absent/);
  });

  test("B4 — the custody door signs only under the key its row holds", async () => {
    const s = await stage();
    const request = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    const custody = browserVesselFaceKeyCustody(s.idbName);
    const image = new TextEncoder().encode("synthetic image");
    expect(await custody.signAsVesselFace(s.face.scope, request.requests[0]!.vesselFaceKey, image)).toHaveLength(64);
    await expect(custody.signAsVesselFace(s.face.scope, request.vesselKey, image)).rejects.toThrow(/face-key-other/);
    await expect(custody.signAsVesselFace({ ...s.face.scope, nexus: "nexus-other.synthetic" } as never, request.vesselKey, image)).rejects.toThrow(/face-key-absent/);
  });

  test("B5 — a request that broke after minting retries clean over the same offer, on the key it left at rest", async () => {
    const s = await stage();
    const first = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    // The break: the key rests, but the pending row never came to stand.
    const db = await openVesselIdb(s.idbName);
    try { await idbDelete(db, FLEET_JOIN_STORE, "pending"); } finally { db.close(); }
    const again = await browserFleetJoinRequest({ offer: s.offer, idbName: s.idbName });
    expect(again.requests[0]!.vesselFaceKey).toBe(first.requests[0]!.vesselFaceKey);
  });
});
