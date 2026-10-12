/**
 * ed25519-door-families.test — every verifier in the mesh package reads through the one strict door.
 *
 * Two forgeries, each beside an honest CONTROL built the same way:
 *   · THE TORSION HAND (`./ed25519-torsion.ts`): a mixed-order key that passes every acceptance check, signing
 *     through the module's OWN helpers a signature that both curve libraries read true (their default rule and
 *     their strict branch) and the door refuses. A verifier that calls a curve library directly accepts it.
 *   · THE IDENTITY KEY: a small-order key with the signature anyone writes for it. It refuses BY NAME where a
 *     key enters standing state (a seat, a guardian set, an op-key, a Handle key, a device edge, an admit).
 *
 * The census test (`ed25519-door-census.test.ts`) proves no source file calls a curve library's verify; these
 * vectors prove each family's verdict moves with the door. The charter's own vectors (the roll, the stamp, a
 * seat the door refuses) stand in `wax-stamp.test.ts`, the one test that builds an epoch by hand.
 */
import { describe, test, expect } from "vitest";
import * as A from "@automerge/automerge";
import * as ed from "@noble/ed25519";
import { ed25519 as curveEd } from "@noble/curves/ed25519.js";
import { hex, hexToBytes, sha256Hex, utf8Bytes, defaultCryptoProvider } from "../src/crypto.js";
import { acceptEd25519Key, readEd25519 } from "../src/ed25519-door.js";
import { DEVICE_DELEGATION_DOMAIN, ORACLE_POINTER_DOMAIN } from "../src/domains.js";
import { realmBagRegistrationCounts, signRealmBagRegistration } from "../src/realm-bag.js";
import {
  carriageEntryCounts, signCarriageContract, signCarriageQuorum, signCarrierContract, verifyCarriageConsent, verifyCarrierContract,
} from "../src/carriage-registry.js";
import { makeMultiSigQuorumVerifier, signAntigenEntry, type KahuQuorumSeats } from "../src/kapae-antigen.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import { foldOfferingAntigen, presentOffering, signOfferingKapae, verifyOfferingPresentation } from "../src/offering-antigen.js";
import { computePluginsCid } from "../src/genesis-doc.js";
import { signPluginOffering, verifyPluginOffering, type OfferedBlob } from "../src/plugin-offering.js";
import { signRealmFeed, verifyRealmFeedSlot } from "../src/cabal-realm-clock.js";
import { signWitness, verifyWitnessSig } from "../src/persistence-keel.js";
import { buildOraclePointer, exportOracleSnapshot, verifyOraclePointer } from "../src/oracle-substrate.js";
import { mintPersonaInception, mintPersonaRotation, verifyPersonaKelFull, personaPrefixOf, personaEventCidOf, type PersonaKelEvent } from "../src/persona-kel.js";
import { attestAndRotate, provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import { inceptVesselKel, verifyVesselKelInception } from "../src/vessel-kel.js";
import { handleKeyFault, mintHandleInception, mintHandleRotation, verifyHandleKel, verifyHandleKelFull } from "../src/handle-kel.js";
import { signHandleCard, verifyHandleCard } from "../src/handle-card.js";
import { buildDeviceDelegation, verifyDeviceDelegation, type DeviceDelegationTiddler } from "../src/device-delegation.js";
import { mintEnrollmentOffer, mintJoinAck, openPersonaGrant, sealPersonaGrant, verifyJoinAck, type PersonaRef } from "../src/persona-admit.js";
import { mintHostingAct, verifyHostingAct } from "../src/hosting.js";
import { sealGroupSecret } from "../src/persona-group-secret.js";
import { authProofBytes, ed25519VerifyHex, verifyAuthProof } from "../src/auth-wire.js";
import { newcomerKeyOf, signIntroduction, verifyIntroduction, type IntroductionFields } from "../src/introduction.js";
import { IDENTITY_KEY, NOBODYS_SIGNATURE, torsionHand } from "./ed25519-torsion.js";

interface Hand { readonly key: string; readonly sign: (bytes: Uint8Array) => Promise<string> }
const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const honestHand = async (n: number): Promise<Hand> => ({
  key:  hex(await ed.getPublicKeyAsync(seed(n))),
  sign: (bytes) => ed.signAsync(bytes, seed(n)).then(hex),
});
const EPOCH = `epoch0-${"a1".repeat(32)}`;
const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/** One relation, read twice: the honest hand stands, the torsion hand stands nowhere. */
function bothHands(name: string, verdict: (hand: Hand) => Promise<boolean>): void {
  describe(name, () => {
    test("CONTROL: an honest hand stands", async () => { expect(await verdict(await honestHand(11))).toBe(true); });
    test("a signature only a lenient verifier reads stands nowhere", async () => { expect(await verdict(torsionHand(11))).toBe(false); });
  });
}

describe("the torsion hand reads as the vectors claim", () => {
  test("its key seats, its signature passes both library rules, and the door refuses it", async () => {
    const hand = torsionHand(7), bytes = utf8("any bytes at all");
    const sig = await hand.sign(bytes);
    expect(acceptEd25519Key(hand.key)).toEqual({ ok: true });
    expect(curveEd.verify(hexToBytes(sig), bytes, hexToBytes(hand.key))).toBe(true);                     // ZIP-215
    expect(curveEd.verify(hexToBytes(sig), bytes, hexToBytes(hand.key), { zip215: false })).toBe(true);  // library strict
    expect(await ed.verifyAsync(hexToBytes(sig), bytes, hexToBytes(hand.key))).toBe(true);
    expect(readEd25519(sig, bytes, hand.key)).toEqual({ ok: false, refusal: "signature-mismatch" });
    expect(readEd25519(NOBODYS_SIGNATURE, bytes, IDENTITY_KEY)).toEqual({ ok: false, refusal: "key-small-order" });
  });
});

// ── THE QUORUM BOARDS ────────────────────────────────────────────────────────────────────────────────────────
bothHands("realm bag registration (realmBagRegistrationCounts)", async (hand) => {
  const rec = await signRealmBagRegistration(
    { realmId: "realm-1", bagUri: "lar:///bag", docUrl: "automerge:doc", readTier: "contract" }, [{ signer: hand.key, sign: hand.sign }]);
  return realmBagRegistrationCounts(rec, "realm-1");
});

bothHands("carrier seal (verifyCarrierContract)", async (hand) =>
  verifyCarrierContract({ nym: hand.key, sealEpochCid: EPOCH, sig: (await signCarrierContract(hand.key, EPOCH, hand.sign)).sig }));

bothHands("carriage consent (verifyCarriageConsent)", async (hand) =>
  verifyCarriageConsent({ nym: hand.key, sealEpochCid: EPOCH, contractSig: (await signCarriageContract(hand.key, EPOCH, hand.sign)).sig }));

bothHands("carriage membership quorum (carriageEntryCounts)", async (kahu) => {
  // The operator's own contract-in stays honest: the kahu seat alone carries the hand under test.
  const operator = await honestHand(21);
  const roster: KahuQuorumSeats = { keys: [kahu.key], threshold: 1, sealEpochCid: EPOCH };
  const entry = await signCarriageQuorum({ nym: operator.key, action: "admit", parents: [], sealEpochCid: EPOCH },
    [{ signer: kahu.key, sign: kahu.sign }], await signCarriageContract(operator.key, EPOCH, operator.sign));
  return carriageEntryCounts(entry, roster);
});

bothHands("antigen quorum (makeMultiSigQuorumVerifier)", async (kahu) => {
  const entry = await signAntigenEntry({ nym: "ab".repeat(32), action: "kapae", parents: [], sealEpochCid: EPOCH }, [{ signer: kahu.key, sign: kahu.sign }]);
  return makeMultiSigQuorumVerifier().verifyQuorum(entry, { keys: [kahu.key], threshold: 1, sealEpochCid: EPOCH });
});

describe("one key, one seat", () => {
  test("a second spelling of a seated key counts for nothing in a quorum", async () => {
    const kahu = await honestHand(1), upper = kahu.key.toUpperCase();
    const entry = await signAntigenEntry({ nym: "ab".repeat(32), action: "kapae", parents: [], sealEpochCid: EPOCH }, [{ signer: kahu.key, sign: kahu.sign }]);
    const twice = { ...entry, signatures: [...entry.signatures, { signer: upper, sig: entry.signatures[0]!.sig }] };
    // A roster that names both spellings, at threshold 2: one hand, signing once, never reads as two.
    expect(await makeMultiSigQuorumVerifier().verifyQuorum(twice, { keys: [kahu.key, upper], threshold: 2, sealEpochCid: EPOCH })).toBe(false);
    expect(await makeMultiSigQuorumVerifier().verifyQuorum(twice, { keys: [kahu.key, upper], threshold: 1, sealEpochCid: EPOCH })).toBe(true);   // CONTROL
  });
});

bothHands("offering presentation (verifyOfferingPresentation)", async (hand) =>
  (await verifyOfferingPresentation(await presentOffering({ pluginsCid: "bafyOffering", noticed: "noticed", presenter: hand.key }, hand.sign))).ok);

bothHands("offering quorum (foldOfferingAntigen)", async (kahu) => {
  const entry = await signOfferingKapae({ pluginsCid: "bafyOffering", action: "kapae", parents: [], sealEpochCid: EPOCH }, [{ signer: kahu.key, sign: kahu.sign }]);
  return (await foldOfferingAntigen([entry], { keys: [kahu.key], threshold: 1, sealEpochCid: EPOCH })).has("bafyOffering");
});

bothHands("plugin offering (verifyPluginOffering)", async (hand) => {
  const provenance = { source: "https://example.test/upstream", commit: "0".repeat(40), path: "plugins/fixture", licence: "MIT" };
  const blobs: readonly OfferedBlob[] = [{ id: "$:/plugins/sq/streams", version: "1.2.0", sha256: "aa".repeat(32), provenance }];
  const verdict = await verifyPluginOffering(await signPluginOffering({ offeror: hand.key, pluginsCid: computePluginsCid(blobs), blobs }, hand.sign));
  if (!verdict.ok && verdict.code !== "bad-signature") throw new Error(`refused for another reason: ${verdict.code}`);
  return verdict.ok;
});

// ── FEEDS, WITNESSES, POINTERS, THE WIRE ─────────────────────────────────────────────────────────────────────
bothHands("realm feed slot (verifyRealmFeedSlot)", async (hand) => {
  const parts = { realm: "realm-1", writer: hand.key, epoch: 2 };
  return verifyRealmFeedSlot({ ...parts, sig: await signRealmFeed(parts, hand.sign) });
});

bothHands("witness edge (verifyWitnessSig)", async (hand) =>
  verifyWitnessSig("claim-cid", await signWitness({ claimCid: "claim-cid", signer: hand.key, frontier: "f", polarity: 1, sign: hand.sign })));

bothHands("daemon proof of possession (verifyAuthProof, ed25519VerifyHex)", async (peer) => {
  const parts = { nonce: "11".repeat(32), gatePubKey: (await honestHand(6)).key, peerPubKey: peer.key, aud: "mesh" };
  const sig = await peer.sign(authProofBytes(parts));
  const proof = await verifyAuthProof({ ...parts, sig });
  const bare = await ed25519VerifyHex(sig, authProofBytes(parts), peer.key);
  if (proof.ok !== bare) throw new Error("the two wire verifiers disagree");
  return proof.ok;
});

describe("oracle pointer (verifyOraclePointer)", () => {
  // The builder derives its key from a seed, so the forgery re-derives the act cid over the identity key by hand.
  const pointer = async () => buildOraclePointer({ snapshot: await exportOracleSnapshot(A.from({ tiddlers: {} })), parents: [], signerSeed: seed(1) });
  test("CONTROL: a built pointer verifies", async () => { expect(await verifyOraclePointer(await pointer())).toEqual({ ok: true }); });
  test("nobody signs for a small-order publisher", async () => {
    const p = await pointer();
    const actCid = await sha256Hex(utf8Bytes([ORACLE_POINTER_DOMAIN, p.cid, p.heads.join(","), "", "", IDENTITY_KEY].join("|")), defaultCryptoProvider);
    const forged = { ...p, pub: IDENTITY_KEY, actCid, sig: NOBODYS_SIGNATURE };
    expect(await verifyOraclePointer(forged)).toEqual({ ok: false, reason: "signature verify failed" });
  });
});

// ── THE KEY LOGS ─────────────────────────────────────────────────────────────────────────────────────────────
describe("persona KEL", () => {
  const rotate = async (guardian: Hand) => {
    const op = await honestHand(31), fresh = await honestHand(32);
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${op.key}`, guardians: [guardianRecoveryRegistrationCard("mine", guardian.key, null)], recoveryThreshold: 1,
    });
    const rotated = await attestAndRotate({
      head: prov.inception, freshOpKeyDid: `0x${fresh.key}`, guardianRecoveryKeys: [guardian.key], recoveryThreshold: 1,
      guardianSigners: [{ signer: guardian.key, sign: guardian.sign }],
    });
    return { prov, rotated };
  };
  test("CONTROL: a guardian's signature rotates the op-key", async () => {
    const { prov, rotated } = await rotate(await honestHand(33));
    if (!rotated.ok) throw new Error(rotated.reason);
    expect(await verifyPersonaKelFull([prov.inception, rotated.event])).toEqual({ ok: true });
  });
  test("a guardian signature only a lenient verifier reads rotates nothing", async () => {
    const { rotated } = await rotate(torsionHand(33));
    expect(rotated).toMatchObject({ ok: false });
    expect(rotated.ok ? "" : rotated.reason).toMatch(/below-threshold quorum: 0\/1/);
  });
  test("an inception whose op-key the door refuses mints nothing, and a log that carries one refuses by name", async () => {
    expect(() => mintPersonaInception(`0x${IDENTITY_KEY}`, "aa".repeat(32))).toThrow(/op-key refuses at the Ed25519 door \(key-small-order\)/);
    // Hand-built past the minter, every binding re-derived over the identity key: the reader names the key.
    const lawful = mintPersonaInception(`0x${(await honestHand(31)).key}`, "aa".repeat(32));
    const core = { ...lawful, opKeyDid: `0x${IDENTITY_KEY}`, prefix: personaPrefixOf(`0x${IDENTITY_KEY}`, lawful.recoverySetHash) };
    const forged: PersonaKelEvent = { ...core, eventCid: personaEventCidOf(core) };
    expect(await verifyPersonaKelFull([forged])).toEqual({
      ok: false, reason: "structural integrity failed at the inception: the inception's op-key refuses at the Ed25519 door (key-small-order)",
    });
    expect(await verifyPersonaKelFull([lawful])).toEqual({ ok: true });                         // CONTROL
  });
  test("a small-order guardian hidden in a commitment surfaces at its reveal, and a small-order fresh op-key refuses", async () => {
    // Minted past the registration card, which would refuse: the commitment hides the guardian until a rotation reveals it.
    const head = mintPersonaInception(`0x${(await honestHand(31)).key}`, sealKeySetHash([IDENTITY_KEY], 1));
    const fresh = `0x${(await honestHand(32)).key}`;
    const revealed = await mintPersonaRotation({
      head, freshOpKeyDid: fresh, recoveryRoster: [IDENTITY_KEY], recoveryThreshold: 1,
      rotationSigs: [{ signer: IDENTITY_KEY, sig: NOBODYS_SIGNATURE }],
    });
    expect(revealed).toEqual({ ok: false, reason: "a revealed guardian key refuses at the Ed25519 door (key-small-order)" });
    const seated = await mintPersonaRotation({
      head, freshOpKeyDid: `0x${IDENTITY_KEY}`, recoveryRoster: [IDENTITY_KEY], recoveryThreshold: 1, rotationSigs: [],
    });
    expect(seated).toEqual({ ok: false, reason: "the fresh op-key refuses at the Ed25519 door (key-small-order)" });
  });
  test("a guardian key the door refuses never enters a set", async () => {
    expect(() => guardianRecoveryRegistrationCard("mine", IDENTITY_KEY, null)).toThrow(/guardian-key-refused.*key-small-order/);
  });
});

describe("vessel KEL (verifyVesselKelInception)", () => {
  test("CONTROL: a minted inception verifies", () => { expect(verifyVesselKelInception(inceptVesselKel(seed(1), seed(2)).inception)).toBe(true); });
  test("nobody signs an inception for a small-order key", () => {
    // The signature covers `k`, and no digest binds it elsewhere: the identity key with nobody's signature
    // satisfies a lenient verifier over the re-read bytes.
    const { inception } = inceptVesselKel(seed(1), seed(2));
    expect(verifyVesselKelInception({ ...inception, k: [IDENTITY_KEY], sig: NOBODYS_SIGNATURE })).toBe(false);
  });
});

describe("Handle KEL and Handle card", () => {
  const RECOVERY = "ab".repeat(32);
  const cardOf = async (hand: Hand) => {
    const did = `0x${hand.key}`, chain = [mintHandleInception(did, did, RECOVERY)];
    return signHandleCard({ nym: chain[0]!.prefix, chain, glamour: "FastJack", parents: [], standing: null, fleetProof: null }, hand.sign);
  };
  test("CONTROL: the Handle key's card verifies", async () => { expect((await verifyHandleCard(await cardOf(await honestHand(41)))).ok).toBe(true); });
  test("a card signature only a lenient verifier reads refuses bad-signature", async () => {
    expect(await verifyHandleCard(await cardOf(torsionHand(41)))).toEqual({ ok: false, reject: "bad-signature" });
  });
  const rotateBy = async (owner: Hand) => {
    const ownerDid = `0x${owner.key}`, persona = mintPersonaInception(ownerDid, RECOVERY);
    const inception = mintHandleInception(`0x${(await honestHand(42)).key}`, persona.prefix, RECOVERY);
    const minted = await mintHandleRotation({
      head: inception, freshHandleKeyDid: `0x${(await honestHand(43)).key}`,
      ownerAuthMemberPrefix: persona.prefix, ownerHeadOpKeyDid: ownerDid, sign: owner.sign,
    });
    return { inception, minted };
  };
  test("CONTROL: the owner's head op-key rotates the Handle key", async () => {
    const { inception, minted } = await rotateBy(await honestHand(44));
    if (!minted.ok) throw new Error(minted.reason);
    expect(await verifyHandleKelFull([inception, minted.event], async () => true)).toEqual({ ok: true });
  });
  test("an owner signature only a lenient verifier reads rotates nothing", async () => {
    const { minted } = await rotateBy(torsionHand(44));
    expect(minted).toEqual({ ok: false, reason: "rotation signature does not verify against the claimed member head op-key" });
  });
  test("a Handle key the door refuses incepts nothing, and a log that seats one refuses by name", async () => {
    const owner = `0x${(await honestHand(41)).key}`;
    expect(() => mintHandleInception(`0x${IDENTITY_KEY}`, owner, RECOVERY)).toThrow(/Handle key refuses at the Ed25519 door \(key-small-order\)/);
    expect(handleKeyFault(owner)).toBeNull();
    const lawful = mintHandleInception(owner, owner, RECOVERY);
    const forged = { ...lawful, handleKeyDid: `0x${IDENTITY_KEY}` };
    expect(verifyHandleKel([lawful])).toBe(true);                                               // CONTROL
    expect(verifyHandleKel([forged])).toBe(false);
    expect(await verifyHandleKelFull([forged], async () => true)).toEqual({
      ok: false, reason: "inception seq 0: the Handle key refuses at the Ed25519 door (key-small-order)",
    });
  });
});

// ── ADMITS AND DEVICE EDGES ──────────────────────────────────────────────────────────────────────────────────
describe("device edge (verifyDeviceDelegation)", () => {
  const edgeBy = async (root: Hand, deviceKey: string): Promise<DeviceDelegationTiddler> => {
    const fields = { personaRootDid: `0x${root.key}`, deviceDid: `0x${deviceKey}`, deviceVerifyingKey: deviceKey, hearthTrueName: "place", boundEpoch: "5" };
    const bytes = utf8(`${DEVICE_DELEGATION_DOMAIN}|${fields.personaRootDid}|${fields.deviceDid}|${fields.deviceVerifyingKey}|${fields.hearthTrueName}|${fields.boundEpoch}`);
    return { kind: "device-delegation", ...fields, signature: await root.sign(bytes) } as DeviceDelegationTiddler;
  };
  test("CONTROL: the hand-built edge reads exactly as the builder's", async () => {
    const root = await honestHand(3), device = await honestHand(4);
    const built = await buildDeviceDelegation({ personaRootSeed: seed(3), deviceVerifyingKey: device.key, hearthTrueName: "place", boundEpoch: 5 });
    expect(await edgeBy(root, device.key)).toEqual(built);
    expect(await verifyDeviceDelegation(built, `0x${root.key}`)).toEqual({ ok: true });
  });
  test("a root signature only a lenient verifier reads edges no device", async () => {
    const root = torsionHand(3);
    expect(await verifyDeviceDelegation(await edgeBy(root, (await honestHand(4)).key), `0x${root.key}`)).toEqual({ ok: false, reason: "signature mismatch" });
  });
  test("a device key the door refuses never gets edged, by name", async () => {
    await expect(buildDeviceDelegation({ personaRootSeed: seed(3), deviceVerifyingKey: IDENTITY_KEY, hearthTrueName: "place", boundEpoch: 5 }))
      .rejects.toThrow(/deviceVerifyingKey refuses at the Ed25519 door \(key-small-order\)/);
    const root = await honestHand(3);
    expect(await verifyDeviceDelegation(await edgeBy(root, IDENTITY_KEY), `0x${root.key}`))
      .toEqual({ ok: false, reason: "deviceVerifyingKey refuses at the Ed25519 door (key-small-order)" });
  });
  test("a small-order persona root edges nobody, by name", async () => {
    const forged = { ...(await edgeBy(await honestHand(3), (await honestHand(4)).key)), personaRootDid: `0x${IDENTITY_KEY}`, signature: NOBODYS_SIGNATURE } as DeviceDelegationTiddler;
    expect(await verifyDeviceDelegation(forged, `0x${IDENTITY_KEY}`))
      .toEqual({ ok: false, reason: "personaRootDid refuses at the Ed25519 door (key-small-order)" });
  });
});

describe("persona admit (openPersonaGrant, verifyJoinAck)", () => {
  const PREFIX = "EpersonaAID_prefix_0001";
  const ceremony = async (persona: Hand, device: Hand) => {
    const personaRef: PersonaRef = { prefix: PREFIX, verifyingKey: persona.key };
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: device.key });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef, personaSigner: persona.sign });
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: (prefix) => (prefix === PREFIX ? persona.key : null) });
    if (!opened.ok) return { opened, ack: null };
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: device.sign });
    return { opened, ack: await verifyJoinAck({ ack, sent }) };
  };
  test("CONTROL: grant and acknowledgement both stand", async () => {
    const { opened, ack } = await ceremony(await honestHand(51), await honestHand(52));
    expect(opened.ok).toBe(true);
    expect(ack?.ok).toBe(true);
  });
  test("a grant signature only a lenient verifier reads admits nobody", async () => {
    const { opened } = await ceremony(torsionHand(51), await honestHand(52));
    expect(opened.ok).toBe(false);
  });
  test("an acknowledgement only a lenient verifier reads records no join", async () => {
    const { opened, ack } = await ceremony(await honestHand(51), torsionHand(52));
    expect(opened.ok).toBe(true);
    expect(ack).toMatchObject({ ok: false, reason: "ACK signature does not verify against B's device key" });
  });
  test("a device key the door refuses never gets offered or granted, by name", async () => {
    expect(() => mintEnrollmentOffer({ targetVesselId: IDENTITY_KEY })).toThrow(/admit-key-refused.*key-small-order/);
    const persona = await honestHand(51);
    const { offer } = mintEnrollmentOffer({ targetVesselId: (await honestHand(52)).key });
    await expect(sealPersonaGrant({ offer: { ...offer, targetVesselId: IDENTITY_KEY }, personaRef: { prefix: PREFIX, verifyingKey: persona.key }, personaSigner: persona.sign }))
      .rejects.toThrow(/admit-key-refused.*key-small-order/);
  });
});

describe("group secret seal (sealGroupSecret)", () => {
  test("CONTROL: the secret seals to a lawful device key", async () => {
    const seal = await sealGroupSecret({ opSeed: seed(61), prefix: "EpersonaAID_prefix_0001", deviceVerifyingKey: (await honestHand(62)).key });
    expect(Object.values(seal).every((v) => typeof v === "string" && v.length > 0)).toBe(true);
  });
  test("a device key the door refuses receives no seal, by name", async () => {
    await expect(sealGroupSecret({ opSeed: seed(61), prefix: "EpersonaAID_prefix_0001", deviceVerifyingKey: IDENTITY_KEY }))
      .rejects.toThrow(/device-key-refused.*key-small-order/);
    // A second encoding of a small-order point: the curve library's own conversion would map it and refuse later.
    await expect(sealGroupSecret({ opSeed: seed(61), prefix: "EpersonaAID_prefix_0001", deviceVerifyingKey: `ec${"ff".repeat(31)}` }))
      .rejects.toThrow(/device-key-refused.*key-non-canonical/);
  });
});

// ── HOSTING ──────────────────────────────────────────────────────────────────────────────────────────────────
describe("hosting act (verifyHostingAct)", () => {
  const act = async () => (await mintHostingAct({ leafSeed: seed(5), nexusAid: EPOCH, prev: null, cap: 2 })).act;
  test("CONTROL: a minted act verifies", async () => { expect(await verifyHostingAct(await act())).toBe(true); });
  test("nobody signs a hosting act for a small-order hearth leaf", async () => {
    // No cid binds the leaf beyond the signed bytes themselves, which the verifier re-reads over the forged act.
    expect(await verifyHostingAct({ ...(await act()), hearthLeaf: IDENTITY_KEY, sig: NOBODYS_SIGNATURE })).toBe(false);
  });
});

bothHands("introduction (verifyIntroduction)", async (guest) => {
  const hearth = await mintHostingAct({ leafSeed: seed(40), nexusAid: EPOCH, prev: null, cap: 3 });
  const fields: IntroductionFields = { nexus: EPOCH, epoch: hearth.cid, newcomerKey: newcomerKeyOf(seed(9)), introducer: guest.key };
  const verdict = verifyIntroduction(await signIntroduction(fields, guest.sign), { nexus: EPOCH, epochs: [hearth.cid] });
  if (!verdict.ok && verdict.refusal !== "introduction-unsigned") throw new Error(`refused for another reason: ${verdict.refusal}`);
  return verdict.ok;
});
