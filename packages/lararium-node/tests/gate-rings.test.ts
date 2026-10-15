/**
 * gate-rings — the grant ring a gate asks answers the union of this vessel's landed join records and the grants
 * its own held roots would sign, over injected readers alone.
 *
 *   G1  a landed record's grant answers its scope, at the signed grant's revision      control: another scope reads null
 *   G2  a grant the record's root never signed, and a grant naming another group than its record, read as no grant
 *   G3  a root holder answers each standing scope at the revision the root's signed grant reads
 *                                                                                      control: a scope the face never stood at reads null
 *   G4  the union: a record and a holding that agree answer once; two groups that claim one scope read null
 *   G5  the ring asks its readers afresh at every presenter, and a reader's fault throws through `grantFor`
 *   G6  the ring stands where `face-gate` asks a `GateFaceGrantRing`
 *   G7  a record naming a held face under another root key reads as no grant      control: under the held root, it answers
 */
import { createPrivateKey, createPublicKey, sign } from "node:crypto";
import { describe, expect, test } from "vitest";
import type { GateFaceGrantRing } from "../../lararium-mesh/src/face-gate.js";
import type { FaceScope } from "../../lararium-mesh/src/face-proof-subjects.js";
import { faceKeyGrantImage, faceKeyGrantRevision } from "../../lararium-mesh/src/fleet-join.js";
import type { FaceJoinRecord } from "../src/fleet-join-custody.js";
import { gateGrantFor, gateGrantRing, type GateRootHolding } from "../src/gate-rings.js";

const keyOf = (secret: Uint8Array) => createPrivateKey({ key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.from(secret)]), format: "der", type: "pkcs8" });
const publicOf = (secret: Uint8Array): string =>
  Buffer.from((createPublicKey(keyOf(secret)).export({ format: "jwk" }) as { x: string }).x, "base64url").toString("hex");
const signHex = (image: Uint8Array, secret: Uint8Array): string => sign(null, Buffer.from(image), keyOf(secret)).toString("hex");
const secretOf = (fill: number): Uint8Array => Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + fill) & 0xff);

const ROOT = secretOf(11);
const STRANGER = secretOf(57);
const GROUP = "0x" + "b7f1c2a9d4e60381";
const OTHER_GROUP = "0x" + "0123456789abcdef";
const at = (fill: number, nexus: string): FaceScope => ({ faceKey: publicOf(secretOf(fill)), nexus }) as FaceScope;
const A = at(3, "nexus-a.synthetic");
const B = at(5, "nexus-b.synthetic");
const C = at(7, "nexus-c.synthetic");

const grant = (scope: FaceScope, root = ROOT, personaGroup = GROUP) =>
  ({ personaGroup, scope, signature: signHex(faceKeyGrantImage(personaGroup, scope), root) });
const record = (grants: unknown[], personaGroup = GROUP, root = ROOT): FaceJoinRecord =>
  ({ personaGroup, rootKey: publicOf(root), certificates: [], grants });
const expected = (scope: FaceScope, personaGroup = GROUP) =>
  ({ personaGroup, faceKey: scope.faceKey, nexus: scope.nexus, revision: faceKeyGrantRevision(grant(scope, ROOT, personaGroup)) });

describe("the grant ring", () => {
  test("G1 — a landed record's grant answers its scope at the signed grant's revision; another scope reads null", () => {
    const records = [record([grant(A), grant(B)])];
    expect(gateGrantFor(A, records, [])).toEqual(expected(A));
    expect(gateGrantFor(B, records, [])).toEqual(expected(B));
    expect(gateGrantFor(C, records, [])).toBeNull();
  });

  test("G2 — a grant the record's root never signed, or one naming another group than its record, reads as no grant", () => {
    expect(gateGrantFor(A, [record([grant(A, STRANGER)])], [])).toBeNull();
    expect(gateGrantFor(A, [record([grant(A, ROOT, OTHER_GROUP)])], [])).toBeNull();
    expect(gateGrantFor(A, [record([{ ...grant(A), signature: "00".repeat(64) }, "garbage", null])], [])).toBeNull();
    // control: the same grant under its own record's root answers
    expect(gateGrantFor(A, [record([grant(A, ROOT, OTHER_GROUP)], OTHER_GROUP)], [])).toEqual(expected(A, OTHER_GROUP));
  });

  test("G3 — a root holder answers each standing scope at the revision its root's signed grant reads", () => {
    const holdings: GateRootHolding[] = [{ personaGroup: GROUP, rootKey: publicOf(ROOT), scopes: [A, B] }];
    expect(gateGrantFor(A, [], holdings)).toEqual(expected(A));
    expect(gateGrantFor(B, [], holdings)).toEqual(expected(B));
    expect(gateGrantFor(C, [], holdings)).toBeNull();
    // a face key the holding names at another Nexus answers nothing here
    expect(gateGrantFor({ faceKey: A.faceKey, nexus: B.nexus } as FaceScope, [], holdings)).toBeNull();
  });

  test("G4 — the union: sources that agree answer once; two groups that claim one scope read null", () => {
    expect(gateGrantFor(A, [record([grant(A)])], [{ personaGroup: GROUP, rootKey: publicOf(ROOT), scopes: [A] }])).toEqual(expected(A));
    expect(gateGrantFor(B, [record([grant(A)])], [{ personaGroup: GROUP, rootKey: publicOf(ROOT), scopes: [B] }])).toEqual(expected(B));
    expect(gateGrantFor(A, [record([grant(A)])], [{ personaGroup: OTHER_GROUP, rootKey: publicOf(ROOT), scopes: [A] }])).toBeNull();
    expect(gateGrantFor(A, [record([grant(A)]), record([grant(A, ROOT, OTHER_GROUP)], OTHER_GROUP)], [])).toBeNull();
  });

  test("G5 — the ring asks its readers afresh at every presenter, and a reader's fault throws through", async () => {
    let records: FaceJoinRecord[] = [];
    let asked = 0;
    const ring = gateGrantRing({ joinRecords: () => { asked++; return records; }, rootHoldings: async () => [] });
    expect(await ring.grantFor(A)).toBeNull();
    records = [record([grant(A)])];
    expect(await ring.grantFor(A)).toEqual(expected(A));
    expect(asked).toBe(2);
    const locked = gateGrantRing({ joinRecords: () => { throw new Error("CustodyLocked"); }, rootHoldings: () => [] });
    await expect(locked.grantFor(A)).rejects.toThrow(/CustodyLocked/);
  });

  test("G6 — the ring stands where face-gate asks a GateFaceGrantRing", async () => {
    const ring: GateFaceGrantRing = gateGrantRing({ joinRecords: () => [], rootHoldings: () => [{ personaGroup: GROUP, rootKey: publicOf(ROOT), scopes: [C] }] });
    expect(await ring.grantFor(C)).toEqual(expected(C));
  });

  test("G7 — a record that names a held face under another root key reads as no grant", () => {
    const held: GateRootHolding[] = [{ personaGroup: GROUP, rootKey: publicOf(ROOT), scopes: [B] }];
    expect(gateGrantFor(A, [record([grant(A, STRANGER)], GROUP, STRANGER)], held)).toBeNull();
    // CONTROL: the same record under the held root answers its scope.
    expect(gateGrantFor(A, [record([grant(A)])], held)).toEqual(expected(A));
  });
});
