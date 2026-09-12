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
import { buildDeviceDelegation, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "@lararium/mesh";
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
});
