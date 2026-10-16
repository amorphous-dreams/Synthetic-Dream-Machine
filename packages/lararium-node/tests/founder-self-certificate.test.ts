/**
 * founder-self-certificate — the founding vessel certifies itself under its face's root, through the doors a join uses.
 *
 * A founder holds the root, so it issues its own face-scoped key's certificate and the root's grant, keeps both in the
 * face's record, and opens a session through the SAME reader and the SAME mesh opener a joiner's proof uses.
 *
 *   S1  a founded vessel with no certificate gets one at its first proof read, opens a live session under its own custody
 *       key, and a second read changes nothing
 *   S2  a second scope adds to the record and leaves the first standing
 *   S3  each refusal names itself and keeps nothing: provisional face, no root held, a record under another root, no face
 *       key at the scope, a certificate over a key custody does not hold
 *   S4  RED: a face whose anchors name another PersonaGroup signs nothing for this one (root-other-group), and the record
 *       it would have poisoned is never written; a face with no anchors owns no group. CONTROL: the owning face issues
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { foldWithdrawals, type WithdrawalMemory } from "../../lararium-mesh/src/face-authority.js";
import { openJoinedFaceSession } from "../../lararium-mesh/src/session-face.js";
import { SessionTable, sessionBinding } from "../../lararium-mesh/src/session-contract.js";
import type { FaceScope } from "../../lararium-mesh/src/face-proof-subjects.js";
import { storeFaceProofKey, storeVesselFaceKey } from "../src/face-key-custody.js";
import { FaceProvisional } from "../src/face-provisional.js";
import { keepFaceJoinRecord, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { ensureFounderCertificate, FounderCertificateRefused, readFounderFaceProof } from "../src/founder-self-certificate.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const ROOT = secretOf(11);
const FACE_A = secretOf(3), FACE_B = secretOf(5);
const SIBLING = secretOf(131);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const scopeA = { faceKey: publicOf(FACE_A), nexus: "nexus-founder-a.synthetic" } as FaceScope;
const scopeB = { faceKey: publicOf(FACE_B), nexus: "nexus-founder-b.synthetic" } as FaceScope;
const admitAt = (scope: FaceScope) => ({ verdict: { state: "held", reason: "held", nym: scope.faceKey }, head: scope.faceKey, nexus: scope.nexus, admitRef: "admit-ref", revision: "board-head" }) as never;
const doors = {
  loadRoot: async () => ({ seed: Uint8Array.from(ROOT), verifyingKey: publicOf(ROOT) }),
  vesselKey: async () => "ab".repeat(32),
};
const args = (scope: FaceScope) => ({ face: 0, personaGroup: GROUP, scope });
const memoryAt = (scope: FaceScope): WithdrawalMemory => {
  const fold = foldWithdrawals(scope);
  if (!("memory" in fold)) throw new Error(fold.refusal);
  return fold.memory;
};

let c: SeatedScratchCustody;
beforeEach(async () => {
  c = await seatScratchCustody("founder-self-certificate");
  // Face h0 owns GROUP: its anchors name it, so its root may sign GROUP's grant.
  await persistIdentityAnchors({ personaGroupId: GROUP, meshCabalDocIdHex: "cd".repeat(16) }, 0);
  await storeFaceProofKey(scopeA, FACE_A, 0);
  await storeFaceProofKey(scopeB, FACE_B, 0);
});
afterEach(async () => { await c.drop(); });

const refusalOf = async (run: () => Promise<unknown>): Promise<string> => {
  try { await run(); } catch (error) { if (error instanceof FounderCertificateRefused) return error.refusal; throw error; }
  return "none";
};

describe("the founder's self-certificate", () => {
  test("S1 — a founded vessel with no certificate gets one at its first proof read and opens a live session on it", async () => {
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
    const proof = await readFounderFaceProof(args(scopeA), doors);
    if (!("grant" in proof)) throw new Error(proof.refusal);
    const table = new SessionTable("owner-epoch-founder");
    const opened = await openJoinedFaceSession({ table, binding: sessionBinding("socket"), profile: "verb", admitted: scopeA, admit: admitAt(scopeA), memory: memoryAt(scopeA), ...proof });
    if (!("signer" in opened)) throw new Error(opened.refusal);
    expect(opened.signer.certificate.vesselFaceKey).toBe(proof.vesselFaceKey);
    expect(opened.session.state).toBe("live");
    const kept = await readFaceJoinRecord(GROUP);
    expect(kept?.rootKey).toBe(publicOf(ROOT));
    expect(kept?.certificates).toHaveLength(1);
    expect(kept?.grants).toHaveLength(1);

    // A second read finds it standing and rewrites nothing.
    expect(await ensureFounderCertificate(args(scopeA), doors)).toEqual({ state: "standing" });
    expect(await readFaceJoinRecord(GROUP)).toEqual(kept);
  });

  test("S2 — a second scope adds its own certificate and leaves the first standing", async () => {
    expect(await ensureFounderCertificate(args(scopeA), doors)).toEqual({ state: "issued" });
    const first = await readFaceJoinRecord(GROUP);
    expect(await ensureFounderCertificate(args(scopeB), doors)).toEqual({ state: "issued" });
    const both = await readFaceJoinRecord(GROUP);
    expect(both?.certificates).toHaveLength(2);
    expect(both?.certificates).toContainEqual(first?.certificates[0]);
    expect(both?.grants).toHaveLength(2);
    expect(await ensureFounderCertificate(args(scopeA), doors)).toEqual({ state: "standing" });
  });

  test("S3 — a face standing provisional certifies nothing", async () => {
    const guard = async () => { throw new FaceProvisional(0, "founder self-certificate", "provisional"); };
    expect(await refusalOf(() => ensureFounderCertificate(args(scopeA), { ...doors, guard }))).toBe("face-provisional");
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
  });

  test("S3 — a vessel that holds no root for the face certifies nothing (a joiner is certified by its root holder)", async () => {
    expect(await refusalOf(() => ensureFounderCertificate(args(scopeA), { ...doors, loadRoot: async () => null }))).toBe("root-absent");
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
  });

  test("S3 — a record under another root refuses record-other and is left as it stands", async () => {
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: publicOf(secretOf(77)), certificates: [], grants: [] });
    const before = await readFaceJoinRecord(GROUP);
    expect(await refusalOf(() => ensureFounderCertificate(args(scopeA), doors))).toBe("record-other");
    expect(await readFaceJoinRecord(GROUP)).toEqual(before);
  });

  test("S3 — no face key at the scope refuses face-key-absent and keeps no record", async () => {
    const strange = { faceKey: publicOf(secretOf(9)), nexus: "nexus-unheld.synthetic" } as FaceScope;
    expect(await refusalOf(() => ensureFounderCertificate(args(strange), doors))).toBe("face-key-absent");
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
  });

  test("S3 — a certificate over a key custody does not hold refuses certificate-other-vessel and is not replaced", async () => {
    await ensureFounderCertificate(args(scopeA), doors);
    const record = (await readFaceJoinRecord(GROUP))!;
    // The custody row now holds another key than the one the standing certificate names.
    await storeVesselFaceKey(scopeB, SIBLING);
    const foreign = { ...(record.certificates[0] as object), scope: scopeB };
    await keepFaceJoinRecord({ ...record, certificates: [...record.certificates, foreign] });
    const before = await readFaceJoinRecord(GROUP);
    expect(await refusalOf(() => ensureFounderCertificate(args(scopeB), doors))).toBe("certificate-other-vessel");
    expect(await readFaceJoinRecord(GROUP)).toEqual(before);
  });

  test("S4 RED — face B's root never signs a grant for group A, and no record is kept under A", async () => {
    // Face h1 owns another group; this vessel holds its root (the door hands it), yet the grant would name GROUP.
    await persistIdentityAnchors({ personaGroupId: "0x" + "0badc0ffee000001", meshCabalDocIdHex: "ef".repeat(16) }, 1);
    expect(await refusalOf(() => ensureFounderCertificate({ face: 1, personaGroup: GROUP, scope: scopeA }, doors))).toBe("root-other-group");
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
    // A face with no anchors owns no group at all.
    expect(await refusalOf(() => ensureFounderCertificate({ face: 2, personaGroup: GROUP, scope: scopeA }, doors))).toBe("root-other-group");
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
    // CONTROL: the face that owns GROUP issues.
    expect(await ensureFounderCertificate(args(scopeA), doors)).toEqual({ state: "issued" });
  });
});
