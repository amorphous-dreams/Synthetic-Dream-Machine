/**
 * node-face-presentation — the node composes what it presents at a gate from its face's proof and the mesh's own opener.
 *
 *   P1  a founder's first presentation makes its certificate sure, opens a live session, and presents that session's
 *       signer with the history the face folded and the arm it was handed; RED: the certificate it presents is the
 *       VESSEL's under the face (the one its record keeps), never the session's certificate the signer carries
 *   P2  a joined vessel presents from its join record and custody row, the founder doors never reached
 *   P3  an absent proof names the piece that is absent, a chain the opener refuses names the opener's refusal, and
 *       neither leaves a session in the table
 *   P4  RED: a session's target reads and writes nothing: a founder with no certificate standing refuses by the absent
 *       piece and keeps no record; CONTROL: once the dial's presentation certified it, the target stands
 */
import { createPrivateKey, createPublicKey } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SessionTable, sessionBinding } from "../../lararium-mesh/src/session-contract.js";
import type { FaceScope } from "../../lararium-mesh/src/face-proof-subjects.js";
import { storeFaceProofKey } from "../src/face-key-custody.js";
import { keepFaceJoinRecord, readFaceJoinRecord } from "../src/fleet-join-custody.js";
import { nodeFacePresentation, nodeFaceTarget } from "../src/node-face-presentation.js";
import { persistIdentityAnchors } from "../src/identity-anchors.js";
import { seatScratchCustody, type SeatedScratchCustody } from "./custody-seat-fixture.js";

vi.setConfig({ testTimeout: 120_000 });

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const ROOT = secretOf(11);
const FACE = secretOf(3);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const scope = { faceKey: publicOf(FACE), nexus: "nexus-presented.synthetic" } as FaceScope;
const admit = { verdict: { state: "held", reason: "held", nym: scope.faceKey }, head: scope.faceKey, nexus: scope.nexus, admitRef: "admit-ref", revision: "board-head" } as never;
const doors = { loadRoot: async () => ({ seed: Uint8Array.from(ROOT), verifyingKey: publicOf(ROOT) }), vesselKey: async () => "ab".repeat(32) };
const armOf = { kind: "admit", admit: { synthetic: true }, lineage: [] } as never;

let c: SeatedScratchCustody;
beforeEach(async () => {
  c = await seatScratchCustody("node-face-presentation");
  // Face h0 owns GROUP: its anchors name it, so its root may sign GROUP's grant.
  await persistIdentityAnchors({ personaGroupId: GROUP, meshCabalDocIdHex: "cd".repeat(16) }, 0);
  await storeFaceProofKey(scope, FACE, 0);
});
afterEach(async () => { await c.drop(); });

const base = (table: SessionTable) => ({ personaGroup: GROUP, scope, table, binding: sessionBinding("socket"), profile: "verb", admit, arm: armOf });

describe("what a node presents at a gate", () => {
  test("P1 — a founder's presentation certifies itself, opens a live session and presents that session's signer", async () => {
    const table = new SessionTable("owner-epoch-presented");
    const made = await nodeFacePresentation({ ...base(table), founder: { face: 0 }, doors });
    if (!("presentation" in made)) throw new Error(made.refusal);
    const { presentation } = made;
    // RED: the dial reads the VESSEL's certificate under the face, never the session's (which rides the signer).
    expect(presentation.certificate).not.toBe(presentation.signer.certificate);
    expect(presentation.certificate).not.toHaveProperty("sessionKey");
    expect(presentation.certificate).toEqual((await readFaceJoinRecord(GROUP))?.certificates[0]);
    expect(presentation.signer.certificate.vesselFaceKey).toBe(presentation.certificate.vesselFaceKey);
    expect(presentation.certificate.scope).toEqual(scope);
    expect(presentation.arm).toBe(armOf);
    expect(presentation.history).toBeTypeOf("object");
    expect((await readFaceJoinRecord(GROUP))?.certificates).toHaveLength(1);
    expect(table.size).toBe(1);
  });

  test("P2 — a joined vessel presents from its record, and a founder-less call never reaches the founder doors", async () => {
    const founder = await nodeFacePresentation({ ...base(new SessionTable("owner-epoch-seed")), founder: { face: 0 }, doors });
    if (!("presentation" in founder)) throw new Error(founder.refusal);
    const table = new SessionTable("owner-epoch-joined-presented");
    const joined = await nodeFacePresentation({ ...base(table), founder: null, doors: { loadRoot: async () => { throw new Error("founder door reached"); } } });
    if (!("presentation" in joined)) throw new Error(joined.refusal);
    expect(joined.presentation.certificate.vesselFaceKey).toBe(founder.presentation.certificate.vesselFaceKey);
  });

  test("P3 — an absent proof names the absent piece, and no session opens", async () => {
    const table = new SessionTable("owner-epoch-absent");
    expect(await nodeFacePresentation({ ...base(table), founder: null })).toEqual({ refusal: "join-absent" });
    expect(table.size).toBe(0);
  });

  test("P3 — a record holding a certificate and no grant the root signed refuses grant-absent, and nothing opens", async () => {
    const seed = await nodeFacePresentation({ ...base(new SessionTable("owner-epoch-seed-2")), founder: { face: 0 }, doors });
    if (!("presentation" in seed)) throw new Error(seed.refusal);
    const kept = await readFaceJoinRecord(GROUP);
    await keepFaceJoinRecord({ personaGroup: GROUP, rootKey: kept!.rootKey, certificates: kept!.certificates, grants: [] });
    const table = new SessionTable("owner-epoch-no-grant");
    expect(await nodeFacePresentation({ ...base(table), founder: null })).toEqual({ refusal: "grant-absent" });
    expect(table.size).toBe(0);
  });

  test("P4 — a founder's session target mints no certificate: absent, it refuses by name; the dial's presentation makes it stand", async () => {
    // Before any dial presented, the face's record holds nothing, and the target writes none.
    expect(await nodeFaceTarget({ personaGroup: GROUP, scope, admit })).toEqual({ refusal: "join-absent" });
    expect(await readFaceJoinRecord(GROUP)).toBeNull();
    // CONTROL: the dial's own presentation certifies the founder; the target then reads that certificate.
    const dialed = await nodeFacePresentation({ ...base(new SessionTable("owner-epoch-dialed")), founder: { face: 0 }, doors });
    if (!("presentation" in dialed)) throw new Error(dialed.refusal);
    const target = await nodeFaceTarget({ personaGroup: GROUP, scope, admit });
    expect(target).toHaveProperty("target");
  });
});
