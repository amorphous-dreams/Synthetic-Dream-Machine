/**
 * joined-face-proof — a joined vessel opens its session at one Nexus under its OWN certificate from the join.
 *
 * The node reads the proof from its join record and custody; the mesh's `openJoinedFaceSession` opens on it, over
 * the mesh's own session table, as the dial will.
 *
 *   J1  the face's join record and this vessel's custody row open a live session whose signer's certificate
 *       names the custody row's key, and that certificate verifies under it; the face's planes match the planes
 *       the founding seeded under the group's `0x` id
 *   J2  a record carrying a sibling vessel's certificate (same face, same Nexus) opens nothing: the custody row
 *       names another key, so `chain-other-vessel`, and the table stays empty
 *   J3  a grant the root never signed reads as no grant (`grant-absent`); a scope the record never names reads
 *       `certificate-absent`; no join reads `join-absent`; a missing custody row reads `vessel-face-key-absent`
 */
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
// One module instance for the table, the chain's mark and the opener: the mesh's own sources, as its dial holds them.
import { foldWithdrawals, type WithdrawalMemory } from "../../lararium-mesh/src/face-authority.js";
import { personaScopedBagIds } from "../../lararium-mesh/src/persona-scope.js";
import { openJoinedFaceSession } from "../../lararium-mesh/src/session-face.js";
import { SessionTable, sessionBinding } from "../../lararium-mesh/src/session-contract.js";
import { certificateImage, sessionCertificateImage, type FaceScope } from "../../lararium-mesh/src/face-proof-subjects.js";
import { faceKeyGrantImage } from "../../lararium-mesh/src/fleet-join.js";
import { storeVesselFaceKey } from "../src/face-key-custody.js";
import { ensureFaceCustodyOfGroup } from "../src/face-route.js";
import { keepFaceJoinRecord } from "../src/fleet-join-custody.js";
import { readJoinedFaceProof } from "../src/joined-face-proof.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const signHex = (image: Uint8Array, secret: Uint8Array): string => sign(null, Buffer.from(image), keyOf(secret)).toString("hex");
const verifies = (publicHex: string, image: Uint8Array, signature: string): boolean =>
  verify(null, image, createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicHex, "hex")]), format: "der", type: "spki" }), Buffer.from(signature, "hex"));
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const ROOT = secretOf(11);
const FACE = secretOf(3);
const VESSEL = secretOf(101);
const SIBLING = secretOf(131);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const scope = { faceKey: publicOf(FACE), nexus: "nexus-joined.synthetic" } as FaceScope;
const certificateOver = (secret: Uint8Array) => {
  const vesselFaceKey = publicOf(secret);
  return { scope, vesselFaceKey, signature: signHex(certificateImage(scope, vesselFaceKey as never), FACE) };
};
const grantBy = (root: Uint8Array) => ({ personaGroup: GROUP, scope, signature: signHex(faceKeyGrantImage(GROUP, scope), root) });
const admit = { verdict: { state: "held", reason: "held", nym: scope.faceKey }, head: scope.faceKey, nexus: scope.nexus, admitRef: "admit-ref", revision: "board-head" } as never;

let c: SeatedScratchCustody;
let memory: WithdrawalMemory;
beforeEach(async () => {
  c = await seatScratchCustody("joined-face-proof");
  const fold = foldWithdrawals(scope);
  if (!("memory" in fold)) throw new Error(fold.refusal);
  memory = fold.memory;
});
afterEach(async () => { await c.drop(); });

const openAt = async (table: SessionTable, at: FaceScope = scope) => {
  const proof = await readJoinedFaceProof({ personaGroup: GROUP, scope: at });
  if (!("grant" in proof)) return proof;
  return openJoinedFaceSession({ table, binding: sessionBinding("socket"), profile: "verb", admitted: at, admit, memory, ...proof });
};

describe("a joined vessel's session", () => {
  test("J1 — the join record and the custody row open a session signed under this vessel's own key", async () => {
    const face = await ensureFaceCustodyOfGroup(GROUP);
    await storeVesselFaceKey(face.ordinal, scope, VESSEL);
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(ROOT), certificates: [certificateOver(VESSEL)], grants: [grantBy(ROOT)] });
    const table = new SessionTable("owner-epoch-joined");
    const opened = await openAt(table);
    if (!("signer" in opened)) throw new Error(opened.refusal);
    const cert = opened.signer.certificate;
    expect(cert.vesselFaceKey).toBe(publicOf(VESSEL));
    expect(verifies(publicOf(VESSEL), sessionCertificateImage(cert.scope, cert.vesselFaceKey, cert.sessionKey, cert.profile), cert.signature)).toBe(true);
    expect(opened.session.state).toBe("live");
    // The planes derive from the group's id as Keyhive spells it, `0x` and all: the planes the founding seeded.
    expect(opened.session.face.planes).toEqual(personaScopedBagIds(GROUP));
    expect(table.size).toBe(1);
  });

  test("J2 — a sibling vessel's certificate opens nothing here", async () => {
    const face = await ensureFaceCustodyOfGroup(GROUP);
    await storeVesselFaceKey(face.ordinal, scope, VESSEL);
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(ROOT), certificates: [certificateOver(SIBLING)], grants: [grantBy(ROOT)] });
    const table = new SessionTable("owner-epoch-joined");
    expect(await openAt(table)).toEqual({ refusal: "chain-other-vessel" });
    expect(table.size).toBe(0);
  });

  test("J3 — each missing piece refuses by name", async () => {
    const table = new SessionTable("owner-epoch-joined");
    expect(await openAt(table)).toEqual({ refusal: "join-absent" });
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(ROOT), certificates: [certificateOver(VESSEL)], grants: [grantBy(secretOf(77))] });
    expect(await openAt(table)).toEqual({ refusal: "grant-absent" });
    expect(await openAt(table, { ...scope, nexus: "nexus-other.synthetic" } as FaceScope)).toEqual({ refusal: "certificate-absent" });
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(ROOT), certificates: [certificateOver(VESSEL)], grants: [grantBy(ROOT)] });
    expect(await openAt(table)).toEqual({ refusal: "vessel-face-key-absent" });
    expect(table.size).toBe(0);
  });
});
