/**
 * carried-seat-verify — THE FULL VERIFICATION OF A CARRIED GRANT (`verifyCarriedSeatGrant`), run before a joined leaf keeps a
 * grant, before a place session stands on it and before the Lift moves anything under the face. A pasted file costs a forger
 * nothing, so the shape of a grant earns no seat: it must answer this leaf's own request (the pinned hearth's signed outcome
 * for the very intent the leaf composes names its record) and its record must verify under the pinned root, the founder's
 * persona-KEL and standing, and the founder's signature.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/device-capabilities-2026#/device-seats
 */
import { describe, expect, test } from "vitest";
import {
  buildDeviceDelegation, buildOutcome, deriveSelfRecoveryKey, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, intentId,
  mintPersonaInception, sealKeySetHash, type DeviceDelegationTiddler,
} from "@lararium/mesh";
import { composeSeatRequest, verifyCarriedSeatGrant, type FleetSeatGrant, type FleetSeatRequest } from "../src/carried-seat.js";
import { faceGrantRecordCid, faceGrantTitle, signFaceGrantRecord, type FaceGrantRecord } from "../src/face-grant-record.js";

const ROOT_SEED = new Uint8Array(32).fill(7), FOUNDER_SEED = new Uint8Array(32).fill(21), FORGER_SEED = new Uint8Array(32).fill(23);
const seed = (n: number) => new Uint8Array(32).fill(n);
const GROUP = "ab".repeat(16);

async function ground() {
  const edge = await buildDeviceDelegation({ personaRootSeed: ROOT_SEED, atomSeed: FOUNDER_SEED, hearthTrueName: "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa", boundEpoch: 0 });
  const rootDid = `0x${await ed25519VerifyingKeyFromSeed(ROOT_SEED)}`;
  const selfRecovery = await deriveSelfRecoveryKey(ROOT_SEED);
  const inception = mintPersonaInception(rootDid, sealKeySetHash([selfRecovery.verifyingKey], 1));
  return { edge, personaKel: { prefix: inception.prefix, chain: [inception] } };
}

async function house() {
  const g = await ground();
  const device = await ed25519VerifyingKeyFromSeed(seed(3));
  const hearthKey = await ed25519VerifyingKeyFromSeed(seed(4));
  const hearth = { key: hearthKey, sign: ed25519SignerFromSeed(seed(4)) };
  const stranger = { key: await ed25519VerifyingKeyFromSeed(seed(5)), sign: ed25519SignerFromSeed(seed(5)) };
  const atom = { key: device, sign: ed25519SignerFromSeed(seed(3)) };
  const edge = { deviceVerifyingKey: device } as DeviceDelegationTiddler;
  const request = await composeSeatRequest({ group: GROUP, atom, hearthAtom: hearthKey, contactCard: "{\"card\":1}", deviceEdge: edge });
  const reminted = await composeSeatRequest({ group: GROUP, atom, hearthAtom: hearthKey, contactCard: "{\"card\":2}", deviceEdge: edge });
  const record = async (signer = FOUNDER_SEED): Promise<FaceGrantRecord> => signFaceGrantRecord({
    kind: "face-join-grant", groupId: GROUP, joineeAgentIdHex: device, founderCard: "{}", capEvents: ["AQID"], reKeyed: true, serial: 1, reSealed: [], founderEdge: g.edge,
  }, ed25519SignerFromSeed(signer));
  const causeOf = (r: FleetSeatRequest) => intentId(r.entry.body as unknown as { issuer: string; verb: string; args: unknown; nonce: string });
  const grant = async (rec: FaceGrantRecord, answering: FleetSeatRequest | null, signer = hearth): Promise<FleetSeatGrant> => ({
    kind: "fleet-seat-grant", personaGroup: GROUP, title: faceGrantTitle(GROUP, device), record: rec,
    ...(answering ? { outcome: await buildOutcome({ group: GROUP, signer, cause: causeOf(answering), result: { status: "done", recordCid: faceGrantRecordCid(rec) } }) } : {}),
  });
  const ctx = { personaRootDid: g.edge.personaRootDid, personaKel: g.personaKel, selfVerifyingKey: device, groupId: GROUP, dyad: () => "clear" as const };
  return { request, reminted, record, grant, ctx, stranger };
}

describe("a carried grant earns a seat only by its full verification", () => {
  test("RED: a genuine grant answering this request verifies; a forged one, or one for another request, refuses by name", async () => {
    const h = await house();
    const genuine = await h.record();
    expect(await verifyCarriedSeatGrant({ grant: await h.grant(genuine, h.request), request: h.request, ctx: h.ctx }), "CONTROL: the genuine grant").toEqual({ ok: true });
    const refused = async (g: FleetSeatGrant, r = h.request) => { const v = await verifyCarriedSeatGrant({ grant: g, request: r, ctx: h.ctx }); return v.ok ? "verified" : v.reason; };
    expect(await refused(await h.grant(genuine, null))).toMatch(/no outcome/);
    expect(await refused(await h.grant(genuine, h.reminted)), "an outcome for another request").toMatch(/another request/);
    expect(await refused(await h.grant(genuine, h.request, h.stranger)), "an outcome a stranger signed").toMatch(/another request/);
    expect(await refused(await h.grant(genuine, h.request), h.reminted), "a re-minted card meets the old grant").toMatch(/another request/);
    // A forger signs the record under a key the pinned root never licensed, and even names it in a matching outcome.
    expect(await refused(await h.grant(await h.record(FORGER_SEED), h.request)), "a record the founder never signed").toMatch(/signature/);
    // The founder's standing unread: pending, never a pass.
    const pending = await verifyCarriedSeatGrant({ grant: await h.grant(genuine, h.request), request: h.request, ctx: { ...h.ctx, dyad: () => "unknown" as const } });
    expect(pending.ok).toBe(false);
  });
});
