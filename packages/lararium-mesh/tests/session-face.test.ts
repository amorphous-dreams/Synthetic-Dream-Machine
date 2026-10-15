/**
 * session-face.test — the one supplier of the face a session wears.
 *
 * Each vector hands the supplier three readings and names the one that stands apart. The control beside it
 * hands the same readings joined, and reads a face the session contract's own table opens.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/what-a-session-carries
 */
import { describe, expect, test } from "vitest";
import { checkFaceChain, checkVesselChain, foldWithdrawals, type VerifiedVesselChain } from "../src/face-authority.js";
import { faceProofSubjectRef, genesisFrontier } from "../src/face-proof-subjects.js";
import { personaScopedBagIds } from "../src/persona-scope.js";
import { SessionTable, sessionBinding, validateSessionFace } from "../src/session-contract.js";
import { SESSION_FACE_REFUSALS, supplySessionFace, type FaceAdmitReading, type FaceGrantReading } from "../src/session-face.js";
import { chain, history, pair, stringLeaves, vesselOf, type Chain } from "./face-proof-fixture.js";

const NEXUS_A = "nexus-a.synthetic";
const NEXUS_B = "nexus-b.synthetic";
const GROUP_ONE = "b7f1c2a9d4e60381";
const GROUP_TWO = "3e5a90cc17bd4f22";

/** This vessel's own chain: its certificate against the history it holds. No session certificate stands in it. */
async function verified(c: Chain, withdrawn: readonly string[] = []): Promise<VerifiedVesselChain> {
  const events = await history(c, withdrawn);
  const fold = foldWithdrawals(c.scope, events);
  if (!("memory" in fold)) throw new Error(fold.refusal);
  const verdict = checkVesselChain({ admitted: c.scope, certificate: c.certificate, memory: fold.memory });
  if (verdict.verdict !== "verified") throw new Error(verdict.verdict);
  return verdict.chain;
}
const admitOf = (c: Chain, over: Partial<FaceAdmitReading> = {}): FaceAdmitReading => ({
  verdict: { state: "held", reason: "held", nym: c.scope.faceKey }, nexus: c.scope.nexus, admitRef: "admit-cid-synthetic", revision: "board-heads-1", ...over,
});
const grantOf = (c: Chain, personaGroup: string, over: Partial<FaceGrantReading> = {}): FaceGrantReading => ({
  personaGroup, faceKey: c.scope.faceKey, nexus: c.scope.nexus, revision: "group-heads-1", ...over,
});

describe("the session face supplier", () => {
  test("three joined readings supply a face the session table opens", async () => {
    const c = await chain("supply", NEXUS_A);
    const supply = supplySessionFace({ chain: await verified(c), vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) });
    if (!("face" in supply)) throw new Error(supply.refusal);
    expect(supply.face).toEqual({
      personaGroup: GROUP_ONE,
      proofSubject: faceProofSubjectRef(c.scope),
      admitRef: "admit-cid-synthetic",
      causalRevision: `admit:board-heads-1|grant:group-heads-1|withdrawal:0:${genesisFrontier(c.scope).head}`,
      planes: personaScopedBagIds(GROUP_ONE),
    });
    expect(validateSessionFace(supply.face)).toEqual(supply.face);
    expect(new SessionTable("epoch-synthetic").open(sessionBinding("socket"), supply.face, "verb").ok).toBe(true);
  });

  test("a chain spelled by hand, a verdict object, or nothing supplies no face", async () => {
    const c = await chain("unverified", NEXUS_A);
    const real = await verified(c);
    for (const impostor of [{ ...real }, { verdict: "verified", chain: real }, null, "verified", structuredClone({ ...real })]) {
      expect(supplySessionFace({ chain: impostor, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "chain-unverified" });
    }
    expect("face" in supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toBe(true);   // CONTROL
  });

  test("RED: a chain a gate's check minted, session certificate and all, supplies no face: a session opens before its certificate", async () => {
    const c = await chain("gate-chain", NEXUS_A);
    const fold = foldWithdrawals(c.scope);
    if (!("memory" in fold)) throw new Error(fold.refusal);
    const gates = checkFaceChain({ admitted: c.scope, certificate: c.certificate, sessionCertificate: c.sessionCertificate, frontier: fold.memory.frontier, carried: [], memory: fold.memory });
    if (gates.verdict !== "verified") throw new Error(gates.verdict);
    expect(supplySessionFace({ chain: gates.chain, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "chain-unverified" });
    const supply = supplySessionFace({ chain: await verified(c), vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) });   // CONTROL
    expect("face" in supply && stringLeaves(supply.face).has(c.session.key)).toBe(false);
    expect("face" in supply).toBe(true);
  });

  test("a chain another vessel presented supplies no face here, though it verifies", async () => {
    const c = await chain("other-vessel", NEXUS_A);
    const sibling = await vesselOf(c, "other-vessel sibling");
    const real = await verified(c);
    // This vessel's custody holds the sibling's key, not the key the chain names.
    expect(supplySessionFace({ chain: real, vesselFaceKey: sibling.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "chain-other-vessel" });
    expect(supplySessionFace({ chain: real, vesselFaceKey: undefined, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "chain-other-vessel" });
    expect("face" in supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE) })).toBe(true);   // CONTROL
  });

  test("a reading whose fields rest on a prototype supplies no face", async () => {
    const c = await chain("inherited", NEXUS_A);
    const real = await verified(c);
    const inheritedAdmit = Object.create(admitOf(c)) as unknown;
    const inheritedGrant = Object.create(grantOf(c, GROUP_ONE)) as unknown;
    expect((inheritedAdmit as { nexus: string }).nexus).toBe(c.scope.nexus);          // the setup took: the prototype answers
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: inheritedAdmit, grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "admit-malformed" });
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: inheritedGrant })).toEqual({ refusal: "grant-malformed" });
  });

  test("an admit that reads anything but held supplies no face, and the refusal names the state", async () => {
    const c = await chain("admit-state", NEXUS_A);
    const real = await verified(c);
    for (const state of ["denied", "unsettled", "wrong-epoch", "rejected"] as const) {
      const admit = admitOf(c, { verdict: { state, reason: "synthetic", nym: c.scope.faceKey } });
      expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit, grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "admit-not-held", state });
    }
  });

  test("an admit for another nym or another Nexus supplies no face", async () => {
    const c = await chain("admit-join", NEXUS_A);
    const other = await chain("admit-join other", NEXUS_A);
    const real = await verified(c);
    const otherNym = admitOf(c, { verdict: { state: "held", reason: "held", nym: other.scope.faceKey } });
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: otherNym, grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "admit-other-face" });
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c, { nexus: NEXUS_B }), grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "admit-other-nexus" });
    for (const malformed of [null, {}, admitOf(c, { admitRef: "" }), admitOf(c, { revision: "a|b" }), admitOf(c, { nexus: "nex us" })]) {
      expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: malformed, grant: grantOf(c, GROUP_ONE) })).toEqual({ refusal: "admit-malformed" });
    }
  });

  test("a private grant for another face key or another Nexus supplies no face", async () => {
    const c = await chain("grant-join", NEXUS_A);
    const other = await chain("grant-join other", NEXUS_A);
    const real = await verified(c);
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE, { faceKey: other.scope.faceKey }) })).toEqual({ refusal: "grant-other-face" });
    expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: grantOf(c, GROUP_ONE, { nexus: NEXUS_B }) })).toEqual({ refusal: "grant-other-nexus" });
    for (const malformed of [null, grantOf(c, "B7F1C2A9D4E60381"), grantOf(c, "b7f"), grantOf(c, ""), grantOf(c, GROUP_ONE, { revision: "" })]) {
      expect(supplySessionFace({ chain: real, vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: malformed })).toEqual({ refusal: "grant-malformed" });
    }
  });

  test("a plane address a caller supplies grants nothing: the planes derive from the PersonaGroup alone", async () => {
    const c = await chain("planes", NEXUS_A);
    const hostile = { ...grantOf(c, GROUP_ONE), planes: personaScopedBagIds(GROUP_TWO), proofSubject: "chosen" };
    const supply = supplySessionFace({ chain: await verified(c), vesselFaceKey: c.vessel.key, admit: admitOf(c), grant: hostile });
    if (!("face" in supply)) throw new Error(supply.refusal);
    expect(supply.face.planes).toEqual(personaScopedBagIds(GROUP_ONE));
    expect(supply.face.planes).not.toEqual(personaScopedBagIds(GROUP_TWO));
    expect(supply.face.proofSubject).toBe(faceProofSubjectRef(c.scope));
  });

  test("two faces of one vessel wear faces that share no reference", async () => {
    const one = await chain("vessel-v face-one", NEXUS_A);
    const two = await chain("vessel-v face-two", NEXUS_A);
    const a = supplySessionFace({ chain: await verified(one), vesselFaceKey: one.vessel.key, admit: admitOf(one, { admitRef: "admit-one", revision: "heads-one" }), grant: grantOf(one, GROUP_ONE, { revision: "g-one" }) });
    const b = supplySessionFace({ chain: await verified(two), vesselFaceKey: two.vessel.key, admit: admitOf(two, { admitRef: "admit-two", revision: "heads-two" }), grant: grantOf(two, GROUP_TWO, { revision: "g-two" }) });
    if (!("face" in a) || !("face" in b)) throw new Error("supply refused");
    const [mine, theirs] = [stringLeaves(a.face), stringLeaves(b.face)];
    expect(mine.size).toBe(8);
    expect([...mine].filter((leaf) => theirs.has(leaf))).toEqual([]);
  });

  test("one face at two Nexuses proves as two subjects, and a moved frontier moves the revision", async () => {
    const here = await chain("two-nexus", NEXUS_A);
    const there = await chain("two-nexus", NEXUS_B);
    const a = supplySessionFace({ chain: await verified(here), vesselFaceKey: here.vessel.key, admit: admitOf(here), grant: grantOf(here, GROUP_ONE) });
    const b = supplySessionFace({ chain: await verified(there), vesselFaceKey: there.vessel.key, admit: admitOf(there), grant: grantOf(there, GROUP_ONE) });
    const later = supplySessionFace({ chain: await verified(here, [(await pair("two-nexus gone")).key]), vesselFaceKey: here.vessel.key, admit: admitOf(here), grant: grantOf(here, GROUP_ONE) });
    if (!("face" in a) || !("face" in b) || !("face" in later)) throw new Error("supply refused");
    expect(a.face.proofSubject).not.toBe(b.face.proofSubject);
    expect(a.face.planes).toEqual(b.face.planes);                       // one PersonaGroup, one set of planes
    expect(later.face.causalRevision).not.toBe(a.face.causalRevision);
    expect(later.face.proofSubject).toBe(a.face.proofSubject);
  });

  test("the refusal names stand as a closed list", () => {
    expect(new Set(SESSION_FACE_REFUSALS).size).toBe(SESSION_FACE_REFUSALS.length);
    expect(SESSION_FACE_REFUSALS).toContain("chain-unverified");
  });
});
