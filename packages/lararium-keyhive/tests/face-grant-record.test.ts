/**
 * face-grant-record.test — THE LATER GRANT as a RECORD (basket-one #/the-later-grant, ruled 2026-09-11).
 *
 * The founder writes a signed grant record onto the PersonaGroup plane; the joinee's own kit READS it and takes
 * the seat by its own act, verifying offline against the published seal (the persona root it pinned at admit,
 * and the founder's device edge chained to that root). Reading alone re-cuts NOTHING:
 *   · a record whose signature fails → refused, no ingest;
 *   · a record whose founder edge another root signed (an unpublished seal) → refused;
 *   · a record naming another joinee → not ours, nothing taken;
 *   · a record for another group → refused.
 */
import { describe, test, expect } from "vitest";
import {
  buildDeviceDelegation, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, hexToBytes,
  deriveSelfRecoveryKey, sealKeySetHash, mintPersonaInception, personaRotationSigningBytes, mintPersonaRotation,
  type PersonaKelEvent,
} from "@lararium/mesh";
import { faceGrantTitle, signFaceGrantRecord, verifyFaceGrantRecord, type FaceGrantRecord } from "../src/face-grant-record.js";

const ROOT_SEED    = new Uint8Array(32).fill(7);
const OTHER_ROOT   = new Uint8Array(32).fill(9);
const FOUNDER_SEED = new Uint8Array(32).fill(21);
const HEARTH       = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";
const GROUP        = "ab".repeat(16);
const JOINEE_KEY   = "6".repeat(64);
const NOW          = Date.parse("2026-09-11T12:00:00.000Z");

async function founderEdge(rootSeed = ROOT_SEED) {
  const founderKey = await ed25519VerifyingKeyFromSeed(FOUNDER_SEED);
  return buildDeviceDelegation({
    personaRootSeed: rootSeed, deviceVerifyingKey: founderKey, hearthTrueName: HEARTH,
    issuedAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-12-01T00:00:00.000Z", boundEpoch: 0,
  });
}

/** The founder's persona-KEL: an armed inception under ROOT_SEED's op-key (1-of-1 self-recovery, as the live
 *  ceremony mints it), optionally rotated to a FRESH op-key by the self-recovery signer. */
async function personaKel(rotateTo: Uint8Array | null): Promise<{ prefix: string; chain: PersonaKelEvent[] }> {
  const rootDid = `0x${await ed25519VerifyingKeyFromSeed(ROOT_SEED)}`;
  const selfRecovery = await deriveSelfRecoveryKey(ROOT_SEED);
  const inception = mintPersonaInception(rootDid, sealKeySetHash([selfRecovery.verifyingKey], 1));
  const chain = [inception];
  if (rotateTo) {
    const freshOpKeyDid = `0x${await ed25519VerifyingKeyFromSeed(rotateTo)}`;
    const bytes = personaRotationSigningBytes(inception, freshOpKeyDid);
    const sig = await ed25519SignerFromSeed(hexToBytes(selfRecovery.signingKey))(bytes);
    const rotated = await mintPersonaRotation({
      head: inception, freshOpKeyDid, recoveryRoster: [selfRecovery.verifyingKey], recoveryThreshold: 1,
      rotationSigs: [{ signer: selfRecovery.verifyingKey, sig }],
    });
    if (!rotated.ok) throw new Error(rotated.reason);
    chain.push(rotated.event);
  }
  return { prefix: inception.prefix, chain };
}

async function grantFor(overrides: Partial<FaceGrantRecord> = {}, rootSeed = ROOT_SEED): Promise<FaceGrantRecord> {
  const edge = await founderEdge(rootSeed);
  const unsigned = {
    kind: "face-join-grant/v1" as const,
    groupDocIdHex: GROUP,
    joineeAgentIdHex: `0x${JOINEE_KEY}`,
    founderCard: '{"founder":"card"}',
    capEvents: ["AQID", "BAU="],
    reKeyed: true, regranted: 1, reSealed: [],
    founderEdge: edge,
    issuedAt: "2026-09-11T11:00:00.000Z",
    ...overrides,
  };
  return signFaceGrantRecord(unsigned, ed25519SignerFromSeed(FOUNDER_SEED));
}

describe("the later grant — a signed record the joinee verifies offline", () => {
  test("the title keys the record by group and joinee, so a joinee finds its own by name", () => {
    expect(faceGrantTitle(GROUP, `0x${JOINEE_KEY}`)).toContain(GROUP);
    expect(faceGrantTitle(GROUP, `0x${JOINEE_KEY}`)).toContain(JOINEE_KEY);
  });

  test("a record the founder signed, under the pinned root, naming this joinee and group → taken", async () => {
    const rec = await grantFor();
    const edge = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW });
    expect(v.ok).toBe(true);
  });

  test("CONTROL: a tampered record (bad signature) → refused, named", async () => {
    const rec = await grantFor();
    const tampered = { ...rec, capEvents: [...rec.capEvents, "Zm9yZ2Vk"] };
    const edge = await founderEdge();
    const v = await verifyFaceGrantRecord(tampered, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/signature/i);
  });

  test("CONTROL: a founder edge ANOTHER root signed (an unpublished seal) → refused", async () => {
    const rec = await grantFor({}, OTHER_ROOT);
    const pinned = await founderEdge();   // the joinee pins ROOT_SEED's did
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/edge|root/i);
  });

  test("CONTROL: a record naming another joinee, or another group → not taken", async () => {
    const edge = await founderEdge();
    const other = await grantFor({ joineeAgentIdHex: `0x${"5".repeat(64)}` });
    expect((await verifyFaceGrantRecord(other, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW })).ok).toBe(false);
    const wrongGroup = await grantFor({ groupDocIdHex: "cd".repeat(16) });
    expect((await verifyFaceGrantRecord(wrongGroup, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW })).ok).toBe(false);
  });

  // ── THE VERIFY WALKS THE KEL HEAD ─────────────────────────────────────────────────────────────────────
  // A joinee holding the founder's persona-KEL verifies the founder's edge against the CURRENT head op-key,
  // never the frozen root it pinned at admit: a grant a rotated-away key signed refuses; one under the seated
  // key is taken. CONTROL: with no rotation the head IS the pinned root, so the pinned-root case still verifies.
  const FRESH_OP_SEED = new Uint8Array(32).fill(23);

  test("★ a grant whose founder edge a ROTATED-AWAY key signed → refused under the KEL head ★", async () => {
    const kel = await personaKel(FRESH_OP_SEED);
    const rec = await grantFor();                       // edge signed by ROOT_SEED — the superseded op-key
    const pinned = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW, personaKel: kel });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/head|KEL/i);
  });

  test("★ a grant whose founder edge the CURRENT head signed → taken ★", async () => {
    const kel = await personaKel(FRESH_OP_SEED);
    const rec = await grantFor({}, FRESH_OP_SEED);      // edge re-issued under the seated op-key
    const pinned = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW, personaKel: kel });
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
  });

  test("CONTROL: no rotation — the head IS the pinned root; the pinned-root grant still verifies", async () => {
    const kel = await personaKel(null);
    const rec = await grantFor();
    const pinned = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW, personaKel: kel });
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
  });

  test("CONTROL: a KEL that incepts under ANOTHER root than the pinned one → refused (the seal binds the chain)", async () => {
    const kel = await personaKel(null);
    const rec = await grantFor({}, OTHER_ROOT);
    const other = await founderEdge(OTHER_ROOT);        // the joinee pinned OTHER_ROOT; the chain incepts at ROOT_SEED
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: other.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupDocIdHex: GROUP, now: NOW, personaKel: kel });
    expect(v.ok).toBe(false);
  });
});
