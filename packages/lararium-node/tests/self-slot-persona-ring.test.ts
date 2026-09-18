/**
 * self-slot-persona-ring.test — THE NODE SHORE ASSEMBLES THE PERSONAGROUP IDENTITY-SLOT RING.
 *
 * `makePersonaGroupIdentityRing` (mesh) holds the verdict; this factory hands it the four inputs a live node
 * vessel already carries — `governs` (the face's own plane doc-ids, resolved off the catalog exactly as
 * `DeterministicFederationGate` resolves its own set), `provenVesselKey` (the trailing 64 hex of what a peer
 * PROVED at the gate), `isOwnHand` (the same class the shore already vouches), and `grants` (the persona-plane
 * store read that `takeFaceGrantIfPublished` already runs, bound to the real `verifyFaceGrantRecord`).
 *
 * NO CLOCK RIDES IN AT ALL. The factory takes no `now`; admission licenses off the persona-KEL HEAD alone
 * (event order — a rotated-away key refuses under the head, no clock consulted), and ABSTAINS (refuses)
 * whenever it holds no founder persona-KEL chain to walk, rather than falling back to a pinned-root-only
 * check gated on a wall clock.
 *
 * THE INSTRUMENT-LIE THIS FILE REFUSES. A stranger asking a plane doc ALREADY draws false — the base gate denies
 * it. So every vector that must prove the ring BUYS something drives a peer that SHOULD pass (a real signed
 * grant on the plane names its proven key) and measures the flip; and an anti-vacuity counter proves the plane
 * gets read only when the ring truly reaches for it, never short-circuited into a hollow green.
 */
import { describe, test, expect } from "vitest";
import { Repo, interpretAsDocumentId, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import {
  buildDeviceDelegation, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed, personaScopedBagIds,
  deriveSelfRecoveryKey, sealKeySetHash, mintPersonaInception, personaRotationSigningBytes, mintPersonaRotation,
  hexToBytes, type FederationGate, type PersonaKelEvent,
} from "@lararium/mesh";
import { faceGrantTitle, signFaceGrantRecord, FACE_GRANT_PREFIX, type FaceGrantRecord } from "@lararium/keyhive";
import { makeSelfSlotPersonaGroupRing, provenVesselKeyOf } from "../src/self-slot-persona-ring.js";

// ── The face + its founder, mirroring the keyhive grant recipe ──────────────────────────────────────────
const ROOT_SEED     = new Uint8Array(32).fill(7);
const FOUNDER_SEED  = new Uint8Array(32).fill(21);
const FRESH_OP_SEED = new Uint8Array(32).fill(23);   // the op-key a rotation seats
const HEARTH        = "bafkreift7cvcpxxqusdb4lkxsxnt3mzv5uip6tpytinrh7ibgrvu7ceqwa";
const GROUP         = "ab".repeat(16);
const JOINEE_KEY    = "6".repeat(64);           // the peer's vessel verifying key

async function founderEdge(opKeySeed = ROOT_SEED) {
  const founderKey = await ed25519VerifyingKeyFromSeed(FOUNDER_SEED);
  return buildDeviceDelegation({
    personaRootSeed: opKeySeed, deviceVerifyingKey: founderKey, hearthTrueName: HEARTH,
    issuedAt: "2026-09-01T00:00:00.000Z", expiresAt: "2026-12-01T00:00:00.000Z", boundEpoch: 0,
  });
}
async function validGrant(opKeySeed = ROOT_SEED): Promise<FaceGrantRecord> {
  const edge = await founderEdge(opKeySeed);
  return signFaceGrantRecord({
    kind: "face-join-grant/v1", groupDocIdHex: GROUP, joineeAgentIdHex: `0x${JOINEE_KEY}`,
    founderCard: '{"founder":"card"}', capEvents: ["AQID"], reKeyed: true, regranted: 1, reSealed: [],
    founderEdge: edge, issuedAt: "2026-09-11T11:00:00.000Z",
  }, ed25519SignerFromSeed(FOUNDER_SEED));
}

/**
 * The founder's persona-KEL, INCEPTING UNDER THE SAME ROOT `founderEdge` chains to (`ROOT_SEED`) — a
 * mismatch here makes `verifyEdgeAgainstPersonaKel`'s `genesis.opKeyDid !== ctx.personaRootDid` fail-closed
 * for the wrong reason (an unpublished-seal refusal, not a KEL-head one). Optionally rotated to a FRESH
 * op-key by the self-recovery signer — the same recipe `face-grant-record.test.ts` runs.
 */
async function personaKel(rotateTo: Uint8Array | null = null): Promise<{ prefix: string; chain: PersonaKelEvent[] }> {
  const rootDid = `0x${await ed25519VerifyingKeyFromSeed(ROOT_SEED)}`;
  const selfRecovery = await deriveSelfRecoveryKey(ROOT_SEED);
  const inception = mintPersonaInception(rootDid, sealKeySetHash([selfRecovery.verifyingKey], 1));
  const chain: PersonaKelEvent[] = [inception];
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

// ── A catalog + persona-plane store the factory reads, over a throwaway repo for VALID plane urls ───────
interface PlaneStore { listVisible(): Promise<string[]>; get(title: string): Promise<unknown> }
interface Reads { visible: number; got: number }
function fakeCatalog(planeUrls: Map<string, string>, grantText: Map<string, string>, reads: Reads) {
  const store: PlaneStore = {
    listVisible: async () => { reads.visible++; return [...grantText.keys()]; },
    get: async (title) => { reads.got++; const text = grantText.get(title); return text === undefined ? null : { tiddler: { text } }; },
  };
  return {
    urlOf: async (bagUri: string) => planeUrls.get(bagUri) ?? null,
    storeOf: async (bagUri: string) => (bagUri === personaScopedBagIds(GROUP).persona ? store : null),
  };
}

/** Stand the four plane docs in a real repo → valid urls the factory resolves to doc-ids, plus a foreign doc. */
function standPlanes() {
  const repo = new Repo();
  const planes = personaScopedBagIds(GROUP);
  const urls = new Map<string, string>();
  const docIdOf = (url: string) => interpretAsDocumentId(url as `automerge:${string}`) as DocumentId;
  for (const bag of [planes.persona, planes.circles, planes.identities, planes.sessions]) urls.set(bag, repo.create().url);
  const governedDoc = docIdOf(urls.get(planes.persona)!);
  const foreignDoc  = docIdOf(repo.create().url);
  return { urls, governedDoc, foreignDoc };
}

const PEER   = "peer-holds-grant"   as PeerId;
const NOBODY = "peer-proved-nothing" as PeerId;
const OWN    = "peer-own-island"    as PeerId;
const denyAll:  FederationGate = { mayFederate: () => false };
const allowAll: FederationGate = { mayFederate: () => true };

/**
 * `kelOverride` — omit for the default happy-path chain (inception under `ROOT_SEED`, no rotation, matching
 * `founderEdge()`'s default op-key); pass a chain from `personaKel(...)` to test a rotation; pass `null` to
 * test the RING'S OWN ABSTENTION when it holds no chain at all (never a pinned-root-only fallback).
 */
async function ringOver(
  grantText: Map<string, string>, reads: Reads, identifiers: Map<PeerId, string>,
  kelOverride?: { prefix: string; chain: PersonaKelEvent[] } | null,
) {
  const { urls, governedDoc, foreignDoc } = standPlanes();
  const edge = await founderEdge();
  const kel = kelOverride === null ? undefined : (kelOverride ?? (await personaKel()));
  const ring = await makeSelfSlotPersonaGroupRing({
    catalog: fakeCatalog(urls, grantText, reads),
    personaGroupDocIdHex: GROUP,
    personaRootDid: edge.personaRootDid,
    ...(kel ? { personaKel: kel } : {}),
    provenIdentifierOf: (p) => identifiers.get(p) ?? null,
    isOwnHand: (p) => p === OWN,
  });
  return { ring, governedDoc, foreignDoc };
}

describe("provenVesselKeyOf — the vessel key a peer PROVED, trailing 64 hex", () => {
  test("extracts the trailing 64 hex of a proven identifier", () => {
    expect(provenVesselKeyOf(`0xdid:key:${JOINEE_KEY}`)).toBe(JOINEE_KEY);
    expect(provenVesselKeyOf(JOINEE_KEY)).toBe(JOINEE_KEY);
  });
  test("a peer that proved nothing, or an identifier too short to carry a key, reads null (fail-closed)", () => {
    expect(provenVesselKeyOf(null)).toBeNull();
    expect(provenVesselKeyOf(undefined)).toBeNull();
    expect(provenVesselKeyOf("deadbeef")).toBeNull();
  });
});

describe("the assembled ring — the flip the null-hole leaves unmade today", () => {
  test("a peer holding a VERIFIED grant on the face's plane is admitted to a governed plane doc", async () => {
    const reads = { visible: 0, got: 0 };
    const g = await validGrant();
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]));
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(true);
    // composed over a deny-all base — the ring, and nothing else, opens the door.
    expect(await ring.compose(denyAll).mayFederate(governedDoc, PEER)).toBe(true);
    expect(reads.got).toBeGreaterThan(0);   // it actually READ the plane
  });

  test("a stranger — proved a key no grant names — is refused, and the plane WAS consulted (not vacuous)", async () => {
    const reads = { visible: 0, got: 0 };
    const g = await validGrant();
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${"c".repeat(64)}`]]));
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(false);
    expect(reads.visible).toBeGreaterThan(0);
  });

  test("a peer that PROVED NOTHING is refused, and the plane is never read (fail-closed ahead of the read)", async () => {
    const reads = { visible: 0, got: 0 };
    const { ring, governedDoc } = await ringOver(new Map(), reads, new Map());
    expect(await ring.admitsPeer(governedDoc, NOBODY)).toBe(false);
    expect(reads.visible).toBe(0);
  });

  test("a governed peer asking a NON-governed doc is refused, and the plane is never read (governs short-circuit)", async () => {
    const reads = { visible: 0, got: 0 };
    const g = await validGrant();
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, foreignDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]));
    expect(await ring.admitsPeer(foreignDoc, PEER)).toBe(false);
    expect(reads.visible).toBe(0);
  });

  test("the vessel's OWN hand is admitted without a grant, and the plane is never read", async () => {
    const reads = { visible: 0, got: 0 };
    const { ring, governedDoc } = await ringOver(new Map(), reads, new Map());
    expect(await ring.admitsPeer(governedDoc, OWN)).toBe(true);
    expect(reads.visible).toBe(0);
  });

  test("WIDENS ONLY — a base that already allows is never narrowed, grant or no grant", async () => {
    const reads = { visible: 0, got: 0 };
    const { ring, foreignDoc } = await ringOver(new Map(), reads, new Map([[PEER, `0x${JOINEE_KEY}`]]));
    // foreignDoc: the ring itself would refuse — but the base allows, so the composed gate allows.
    expect(await ring.compose(allowAll).mayFederate(foreignDoc, PEER)).toBe(true);
  });

  test("a torn record on the plane is skipped, and a valid one beside it still admits", async () => {
    const reads = { visible: 0, got: 0 };
    const g = await validGrant();
    const grants = new Map([
      [`${FACE_GRANT_PREFIX}${GROUP}/torn`, "{not json"],
      [faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)],
    ]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]));
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(true);
  });

  // ── NO CLOCK: the ring licenses off the persona-KEL HEAD alone, and ABSTAINS absent one ─────────────────

  test("★ no persona-KEL chain in hand → ABSTAINS (refuses), even though the grant is otherwise signature-valid ★", async () => {
    const reads = { visible: 0, got: 0 };
    const g = await validGrant();
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]), null);
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(false);
  });

  test("★ a grant whose founder edge a ROTATED-AWAY key signed → refused under the KEL head, at the ring's own boundary ★", async () => {
    const reads = { visible: 0, got: 0 };
    const kel = await personaKel(FRESH_OP_SEED);
    const g = await validGrant();   // edge signed by ROOT_SEED — the now-superseded op-key
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]), kel);
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(false);
  });

  test("★ a grant whose founder edge the CURRENT head signed → admitted, clocklessly ★", async () => {
    const reads = { visible: 0, got: 0 };
    const kel = await personaKel(FRESH_OP_SEED);
    const g = await validGrant(FRESH_OP_SEED);   // edge re-issued under the seated op-key
    const grants = new Map([[faceGrantTitle(GROUP, `0x${JOINEE_KEY}`), JSON.stringify(g)]]);
    const { ring, governedDoc } = await ringOver(grants, reads, new Map([[PEER, `0x${JOINEE_KEY}`]]), kel);
    expect(await ring.admitsPeer(governedDoc, PEER)).toBe(true);
  });
});
