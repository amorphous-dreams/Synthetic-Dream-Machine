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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDeviceDelegation, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, hexToBytes,
  deriveSelfRecoveryKey, sealKeySetHash, mintPersonaInception, personaRotationSigningBytes, mintPersonaRotation,
  enrolmentDigestOf, personaEventCidOf, DEVICE_DELEGATION_DOMAIN, DEVICE_ATOM_COUNTERSIGN_DOMAIN, type DeviceDelegationTiddler, type PersonaKelEvent,
} from "@lararium/mesh";
import { faceGrantTitle, faceGrantRecordCid, signFaceGrantRecord, verifyFaceGrantRecord, type FaceGrantRecord } from "../src/face-grant-record.js";

const ROOT_SEED    = new Uint8Array(32).fill(7);
const OTHER_ROOT   = new Uint8Array(32).fill(9);
const FOUNDER_SEED = new Uint8Array(32).fill(21);
const HEARTH       = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";
const GROUP        = "ab".repeat(16);
const JOINEE_KEY   = "6".repeat(64);

const CLOCK_KEY = /^(issuedAt|expiresAt|timestamp|createdAt|notBefore|notAfter|exp|iat|nbf)$/i;
/** Every key path in `v` that names a clock. */
function clockKeys(v: unknown, path = ""): string[] {
  if (v === null || typeof v !== "object") return [];
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
    [...(CLOCK_KEY.test(k) ? [`${path}${k}`] : []), ...clockKeys(x, `${path}${k}.`)]);
}

async function founderEdge(rootSeed = ROOT_SEED, boundEpoch = 0) {
  return buildDeviceDelegation({
    personaRootSeed: rootSeed, atomSeed: FOUNDER_SEED, hearthTrueName: HEARTH,
    boundEpoch,
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

/** The two proofs a joinee holds of its founder's authority: the anchor-pinned lineage and a remove-wins reading. */
const CLEAR = (_key: string) => "clear" as const;
async function proofOf(personaRootDid: string, extra: Record<string, unknown> = {}) {
  return { personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, personaKel: await personaKel(null), dyad: CLEAR, ...extra };
}

/** Two rotations from one inception, each signed by the self-recovery key to a DIFFERENT fresh op-key: duplicity. */
async function forkedKel(): Promise<{ prefix: string; chain: PersonaKelEvent[] }> {
  const rootDid = `0x${await ed25519VerifyingKeyFromSeed(ROOT_SEED)}`;
  const selfRecovery = await deriveSelfRecoveryKey(ROOT_SEED);
  const inception = mintPersonaInception(rootDid, sealKeySetHash([selfRecovery.verifyingKey], 1));
  const chain: PersonaKelEvent[] = [inception];
  for (const seed of [new Uint8Array(32).fill(31), new Uint8Array(32).fill(32)]) {
    const freshOpKeyDid = `0x${await ed25519VerifyingKeyFromSeed(seed)}`;
    const sig = await ed25519SignerFromSeed(hexToBytes(selfRecovery.signingKey))(personaRotationSigningBytes(inception, freshOpKeyDid));
    const rotated = await mintPersonaRotation({
      head: inception, freshOpKeyDid, recoveryRoster: [selfRecovery.verifyingKey], recoveryThreshold: 1,
      rotationSigs: [{ signer: selfRecovery.verifyingKey, sig }],
    });
    if (!rotated.ok) throw new Error(rotated.reason);
    chain.push(rotated.event);
  }
  return { prefix: inception.prefix, chain };
}

async function grantFor(overrides: Partial<FaceGrantRecord> = {}, rootSeed = ROOT_SEED, boundEpoch = 0): Promise<FaceGrantRecord> {
  const edge = await founderEdge(rootSeed, boundEpoch);
  const unsigned = {
    kind: "face-join-grant/v1" as const,
    groupId: GROUP,
    joineeAgentIdHex: `0x${JOINEE_KEY}`,
    founderCard: '{"founder":"card"}',
    capEvents: ["AQID", "BAU="],
    reKeyed: true, serial: 1, reSealed: [],
    founderEdge: edge,
    ...overrides,
  };
  return signFaceGrantRecord(unsigned, ed25519SignerFromSeed(FOUNDER_SEED));
}

describe("the later grant — a signed record the joinee verifies offline", () => {
  test("the title keys the record by group and joinee, so a joinee finds its own by name", () => {
    expect(faceGrantTitle(GROUP, `0x${JOINEE_KEY}`)).toContain(GROUP);
    expect(faceGrantTitle(GROUP, `0x${JOINEE_KEY}`)).toContain(JOINEE_KEY);
  });

  test("a record the founder signed, under the pinned lineage with its dyad standing, naming this joinee and group → taken", async () => {
    const rec = await grantFor();
    const edge = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, await proofOf(edge.personaRootDid));
    expect(v.ok).toBe(true);
  });

  test("CONTROL: a tampered record (bad signature) → refused, named", async () => {
    const rec = await grantFor();
    const tampered = { ...rec, capEvents: [...rec.capEvents, "Zm9yZ2Vk"] };
    const edge = await founderEdge();
    const v = await verifyFaceGrantRecord(tampered, await proofOf(edge.personaRootDid));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/signature/i);
  });

  test("CONTROL: a founder edge ANOTHER root signed (an unpublished seal) → refused", async () => {
    const rec = await grantFor({}, OTHER_ROOT);
    const pinned = await founderEdge();   // the joinee pins ROOT_SEED's did
    const v = await verifyFaceGrantRecord(rec, await proofOf(pinned.personaRootDid));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/edge|root/i);
  });

  test("CONTROL: a record naming another joinee, or another group → not taken", async () => {
    const edge = await founderEdge();
    const other = await grantFor({ joineeAgentIdHex: `0x${"5".repeat(64)}` });
    expect((await verifyFaceGrantRecord(other, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP })).ok).toBe(false);
    const wrongGroup = await grantFor({ groupId: "cd".repeat(16) });
    expect((await verifyFaceGrantRecord(wrongGroup, { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP })).ok).toBe(false);
  });

  // ── THE RECORD'S CONTENT ADDRESS ──────────────────────────────────────────────────────────────────────
  // The join outcome names the record by `recordCid`: sha256 over the record's canonical bytes, tagged. A reader
  // holding the record recomputes it, so ANY byte that moves — a field, an event, the signature — moves the CID.
  test("★ the record's CID is tagged sha256 over its canonical bytes, and moves when any byte moves ★", async () => {
    const rec = await grantFor();
    const cid = faceGrantRecordCid(rec);
    expect(cid).toMatch(/^sha256:[0-9a-f]{64}$/);
    // CONTROL: the same record, its keys inserted in another order, names the same CID (canonical bytes).
    const reordered = Object.fromEntries(Object.entries(rec).reverse()) as unknown as FaceGrantRecord;
    expect(faceGrantRecordCid(reordered)).toBe(cid);
    const moved: Array<[string, FaceGrantRecord]> = [
      ["one more cap event", { ...rec, capEvents: [...rec.capEvents, "Zm9yZ2Vk"] }],
      ["one more re-seal",   { ...rec, reSealed: [...rec.reSealed, { bagUrl: "lar:///b", contentRefB64: "AA==", ciphertextB64: "AQ==" }] }],
      ["reKeyed",            { ...rec, reKeyed: !rec.reKeyed }],
      ["the signature",      { ...rec, sig: `${rec.sig.slice(0, -1)}${rec.sig.endsWith("0") ? "1" : "0"}` }],
      ["the joinee",         { ...rec, joineeAgentIdHex: `0x${"5".repeat(64)}` }],
    ];
    for (const [what, m] of moved) expect(faceGrantRecordCid(m), `moving ${what} left the CID standing`).not.toBe(cid);
  });

  // ── NO GLOBAL NOW IN THE RECORD ───────────────────────────────────────────────────────────────────────
  // The record orders by the plane's causal history, so it carries no wall-clock stamp. The daemon's mint
  // passes only the grant, the group and the founder's edge into the signed bytes.
  test("★ the daemon mints the grant record with no wall-clock stamp ★", () => {
    const src = readFileSync(join(import.meta.dirname, "..", "src", "face-join-operation.ts"), "utf8");
    const start = src.indexOf("await signFaceGrantRecord({");
    const end = src.indexOf("signGrant)", start);
    expect(start, "the daemon's grant-record mint moved").toBeGreaterThan(-1);
    const mint = src.slice(start, end);
    expect(mint).not.toMatch(/issuedAt|Date/);
  });

  test("CONTROL: a record minted with no stamp verifies, and a moved byte still refuses", async () => {
    const rec = await grantFor();
    expect(Object.keys(rec)).not.toContain("issuedAt");
    const edge = await founderEdge();
    const ctx = await proofOf(edge.personaRootDid);
    expect(await verifyFaceGrantRecord(rec, ctx)).toEqual({ ok: true });
    const moved = await verifyFaceGrantRecord({ ...rec, reKeyed: !rec.reKeyed }, ctx);
    expect(moved.ok).toBe(false);
    if (!moved.ok) expect(moved.reason).toMatch(/signature/i);
  });

  test("★ the record carries no clock field anywhere — the founder's edge included ★", async () => {
    const rec = await grantFor();
    expect(clockKeys(rec)).toEqual([]);
  });

  test("CONTROL: the clock scan reaches into the founder's edge", async () => {
    const rec = await grantFor();
    expect(clockKeys({ ...rec, founderEdge: { ...rec.founderEdge, expiresAt: "x" } })).toContain("founderEdge.expiresAt");
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
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, personaKel: kel, dyad: CLEAR });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(/head|KEL/i);
  });

  test("★ a grant whose founder edge the CURRENT head signed → taken ★", async () => {
    const kel = await personaKel(FRESH_OP_SEED);
    const rec = await grantFor({}, FRESH_OP_SEED);      // edge re-issued under the seated op-key
    const pinned = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, personaKel: kel, dyad: CLEAR });
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
  });

  test("CONTROL: no rotation — the head IS the pinned root; the pinned-root grant still verifies", async () => {
    const kel = await personaKel(null);
    const rec = await grantFor();
    const pinned = await founderEdge();
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: pinned.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, personaKel: kel, dyad: CLEAR });
    expect(v.ok, v.ok ? "" : v.reason).toBe(true);
  });

  test("CONTROL: a KEL that incepts under ANOTHER root than the pinned one → refused (the seal binds the chain)", async () => {
    const kel = await personaKel(null);
    const rec = await grantFor({}, OTHER_ROOT);
    const other = await founderEdge(OTHER_ROOT);        // the joinee pinned OTHER_ROOT; the chain incepts at ROOT_SEED
    const v = await verifyFaceGrantRecord(rec, { personaRootDid: other.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, personaKel: kel, dyad: CLEAR });
    expect(v.ok).toBe(false);
  });

  // ── THE FOUNDER STANDS, OR NOTHING GRANTS ────────────────────────────────────────────────────────────
  // Recut from the retired lease fence (stable-founding-road#/rulings, the face lease's end state): the founder's own
  // authority reads off its anchor-pinned lineage and its device-face dyad, never an epoch. Each refusal names its
  // proof; a refusal for proof the joinee lacks reads `pending` (it judges nothing final), a set-aside founder does not.
  describe("★ the founder's own standing decides, never its lease epoch ★", () => {
    test("RED-FIRST: a founder edge bound at ANY epoch grants while its dyad stands; CONTROL: the same record refuses once the founder is set aside", async () => {
      for (const epoch of [0, 1, 3]) {
        const rec = await grantFor({}, ROOT_SEED, epoch);
        const ctx = await proofOf(rec.founderEdge.personaRootDid);
        const v = await verifyFaceGrantRecord(rec, ctx);
        expect(v.ok, v.ok ? "" : v.reason).toBe(true);
        expect(await verifyFaceGrantRecord(rec, { ...ctx, dyad: () => "aside" as const })).toEqual({ ok: false, reason: "founder device set aside" });
      }
    });

    test("the house's lawful readings stand (clear · owing · returned); aside refuses final; unknown refuses pending, by name", async () => {
      const rec = await grantFor();
      const ctx = await proofOf(rec.founderEdge.personaRootDid);
      for (const lawful of ["clear", "owing", "returned"] as const) {
        expect((await verifyFaceGrantRecord(rec, { ...ctx, dyad: () => lawful })).ok, lawful).toBe(true);
      }
      const aside = await verifyFaceGrantRecord(rec, { ...ctx, dyad: () => "aside" as const });
      expect(aside).toEqual({ ok: false, reason: "founder device set aside" });
      const unknown = await verifyFaceGrantRecord(rec, { ...ctx, dyad: () => "unknown" as const });
      expect(unknown).toMatchObject({ ok: false, pending: true, reason: expect.stringMatching(/founder dyad standing unknown/) });
    });

    test("absent proof refuses by name and pending: no lineage, no dyad reading; CONTROL: both present → taken", async () => {
      const rec = await grantFor();
      const { personaKel: _kel, ...noKel } = await proofOf(rec.founderEdge.personaRootDid);
      const { dyad: _dyad, ...noDyad } = await proofOf(rec.founderEdge.personaRootDid);
      expect(await verifyFaceGrantRecord(rec, noKel)).toEqual({ ok: false, reason: "founder persona-KEL proof unavailable", pending: true });
      expect(await verifyFaceGrantRecord(rec, noDyad)).toEqual({ ok: false, reason: "founder dyad standing proof unavailable", pending: true });
      expect(await verifyFaceGrantRecord(rec, await proofOf(rec.founderEdge.personaRootDid))).toEqual({ ok: true });
    });

    test("the reading asked is the FOUNDER's dyad, never the joinee's: a clear joinee beside a set-aside founder refuses", async () => {
      const rec = await grantFor();
      const asked: string[] = [];
      const dyad = (key: string) => { asked.push(key); return key === JOINEE_KEY ? "clear" as const : "aside" as const; };
      const v = await verifyFaceGrantRecord(rec, await proofOf(rec.founderEdge.personaRootDid, { dyad }));
      expect(v).toEqual({ ok: false, reason: "founder device set aside" });
      expect(asked).toEqual([rec.founderEdge.deviceVerifyingKey]);
    });

    test("a FORKED lineage refuses by name, whatever the dyad reads; CONTROL: the unforked chain takes the same record", async () => {
      const rec = await grantFor();
      const forked = await forkedKel();
      const v = await verifyFaceGrantRecord(rec, await proofOf(rec.founderEdge.personaRootDid, { personaKel: forked }));
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toMatch(/^founder lineage forked: the persona-KEL forks at seq 1/);
      expect((await verifyFaceGrantRecord(rec, await proofOf(rec.founderEdge.personaRootDid))).ok).toBe(true);
    });

    test("a chain carrying an event under another prefix refuses: the anchor pins one lineage", async () => {
      const rec = await grantFor();
      const kel = await personaKel(null);
      const stray = { ...kel.chain[0]!, prefix: "stray-prefix" } as PersonaKelEvent;
      const v = await verifyFaceGrantRecord(rec, await proofOf(rec.founderEdge.personaRootDid, { personaKel: { prefix: kel.prefix, chain: [...kel.chain, stray] } }));
      expect(v).toMatchObject({ ok: false, reason: expect.stringMatching(/prefix other than the pinned one/) });
    });
  });
});

describe("a grant record under a persona-KEL with a junk event beside it", () => {
  test("RED: the junk moves nothing, and the verdict SAYS what the walk set aside; CONTROL: a clean chain says nothing", async () => {
    const kel = await personaKel(null);
    const inception = kel.chain[0]!;
    const core = {
      seq: 1, prefix: inception.prefix, opKeyDid: `0x${"ee".repeat(32)}`, recoverySetHash: inception.recoverySetHash,
      nextRecoverySetHash: inception.nextRecoverySetHash, prevEventCid: inception.eventCid, provisional: false, vetoOfCid: null,
      enrolmentDigest: enrolmentDigestOf([]),
    };
    const junk: PersonaKelEvent = { ...core, eventCid: personaEventCidOf(core), recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] };
    const rec = await grantFor();
    const edge = await founderEdge();
    const ctx = { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP, dyad: CLEAR };
    const planted = await verifyFaceGrantRecord(rec, { ...ctx, personaKel: { prefix: kel.prefix, chain: [...kel.chain, junk] } });
    expect(planted).toMatchObject({ ok: true, unreadable: expect.stringMatching(/do not verify and move nothing/) });
    const clean = await verifyFaceGrantRecord(rec, { ...ctx, personaKel: kel });
    expect(clean).toEqual({ ok: true });
  });
});

// Retirement contract: the local, verified fleet reading travels with the consuming grant reader.
describe("face grant standing replaces the face lease", () => {
  test("RED: a fresh-epoch founder set aside by the remove-wins reading cannot grant; CONTROL: clear stands", async () => {
    const rec = await grantFor({}, ROOT_SEED, 3);
    const kel = await personaKel(null);
    const base = { personaRootDid: rec.founderEdge.personaRootDid, selfVerifyingKey: JOINEE_KEY,
      groupId: GROUP, personaKel: kel, expectedEpoch: 3 };
    const clear = { ...base, dyad: (_key: string) => "clear" as const };
    const aside = { ...base, dyad: (_key: string) => "aside" as const };
    expect((await verifyFaceGrantRecord(rec, clear)).ok).toBe(true);
    expect((await verifyFaceGrantRecord(rec, aside)).ok).toBe(false);
  });

  test("RED: a signed clear founder edge with no epoch grants; CONTROL: a changed signature refuses", async () => {
    const old = await founderEdge();
    const { boundEpoch: _discard, signature: _rootSig, atomSignature: _atomSig, ...fields } = old;
    // Proposed epoch-free signed shape: the same domain and identity fields, with the epoch component removed.
    const proof = `${DEVICE_DELEGATION_DOMAIN}|${fields.personaRootDid}|${fields.deviceDid}|${fields.deviceVerifyingKey}|${fields.hearthTrueName}`;
    const signature = await ed25519SignerFromSeed(ROOT_SEED)(new TextEncoder().encode(proof));
    const atomSignature = await ed25519SignerFromSeed(FOUNDER_SEED)(new TextEncoder().encode(`${DEVICE_ATOM_COUNTERSIGN_DOMAIN}|${proof}|${signature}`));
    const edge = { ...fields, signature, atomSignature } as DeviceDelegationTiddler;
    const rec = await grantFor({ founderEdge: edge });
    const kel = await personaKel(null);
    const ctx = { personaRootDid: edge.personaRootDid, selfVerifyingKey: JOINEE_KEY, groupId: GROUP,
      personaKel: kel, dyad: (_key: string) => "clear" as const };
    // Use an edge today's verifier accepts so this control reaches the grant signature check.
    // Migrate this control to the epoch-free edge when the reader accepts that shape.
    const control = await grantFor();
    expect((await verifyFaceGrantRecord(control, ctx)).ok).toBe(true);
    expect(await verifyFaceGrantRecord({ ...control, sig: "0".repeat(128) }, ctx))
      .toMatchObject({ ok: false, reason: "the record's signature fails under the founder's licensed key" });
    expect((await verifyFaceGrantRecord(rec, ctx)).ok).toBe(true);
  });
});
