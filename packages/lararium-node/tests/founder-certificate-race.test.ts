/**
 * founder-certificate-race — two certifications of one face at two scopes, run together, both land (the founder's
 * certificate, `ensureFounderCertificate`).
 *
 * Each read the face's record, made its certificate and grant, and wrote the record back from what it read: the write
 * that landed second dropped the first one's certificate. The write now merges its own scope into the record as it
 * stands under the custody hold.
 *
 * Proven:
 *   · RED: two scopes certified at once both stand in the record, each with its grant / CONTROL: a third read finds
 *     each standing;
 *   · the issued book a root holder noted stands through a certification that never named it.
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { FaceScope } from "../../lararium-mesh/src/face-proof-subjects.js";
import { storeFaceProofKey } from "../src/face-key-custody.js";
import { noteIssuedFaceKeys, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { ensureFounderCertificate } from "../src/founder-self-certificate.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const ROOT = secretOf(11);
const FACE_A = secretOf(3), FACE_B = secretOf(5);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const scopeA = { faceKey: publicOf(FACE_A), nexus: "nexus-founder-a.synthetic" } as FaceScope;
const scopeB = { faceKey: publicOf(FACE_B), nexus: "nexus-founder-b.synthetic" } as FaceScope;
const doors = {
  loadRoot: async () => ({ seed: Uint8Array.from(ROOT), verifyingKey: publicOf(ROOT) }),
  vesselKey: async () => "ab".repeat(32),
};
const args = (scope: FaceScope) => ({ face: 0, personaGroup: GROUP, scope });

let c: SeatedScratchCustody;
beforeEach(async () => {
  c = await seatScratchCustody("founder-certificate-race");
  // Face h0 owns GROUP: its anchors name it, so its root may sign GROUP's grant.
  await persistIdentityAnchors({ personaGroupId: GROUP, meshCabalDocIdHex: "cd".repeat(16) }, 0);
  await storeFaceProofKey(scopeA, FACE_A, 0);
  await storeFaceProofKey(scopeB, FACE_B, 0);
});
afterEach(async () => { await c.drop(); });


describe("the founder's certificate under concurrent certification", () => {
  test("RED: two scopes certified at once both stand in the record, each with its grant", async () => {
    const [a, b] = await Promise.all([ensureFounderCertificate(args(scopeA), doors), ensureFounderCertificate(args(scopeB), doors)]);
    expect([a.state, b.state]).toEqual(["issued", "issued"]);
    const kept = await readFaceJoinRecord(GROUP);
    expect(kept?.certificates).toHaveLength(2);
    expect(kept?.grants).toHaveLength(2);
    expect(await ensureFounderCertificate(args(scopeA), doors)).toEqual({ state: "standing" });   // CONTROL
    expect(await ensureFounderCertificate(args(scopeB), doors)).toEqual({ state: "standing" });
  });

  test("the issued book a root holder noted stands through a certification that never named it", async () => {
    const device = "dd".repeat(32);
    await noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: publicOf(ROOT), device, certificates: [{ scope: scopeB, vesselFaceKey: "cc".repeat(32) }] });
    await Promise.all([ensureFounderCertificate(args(scopeA), doors), noteIssuedFaceKeys({ personaGroup: GROUP, rootKey: publicOf(ROOT), device, certificates: [{ scope: scopeA, vesselFaceKey: "ce".repeat(32) }] })]);
    const kept = await readFaceJoinRecord(GROUP);
    expect(kept?.issued?.map((e) => e.nexus).sort()).toEqual([scopeA.nexus, scopeB.nexus].sort());
    expect(kept?.certificates).toHaveLength(1);
  });
});
