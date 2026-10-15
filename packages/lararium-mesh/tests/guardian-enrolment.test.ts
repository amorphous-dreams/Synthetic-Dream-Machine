/**
 * guardian-enrolment — a face founded one-of-one takes its guardians by its OWN key, under its own prefix.
 *
 * The ruling ("Guardian enrolment's shape", lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings): each face
 * founds one-of-one with no guardians; its log's verifier knows a TYPED first-enrolment event from the start; the
 * face's own CURRENT key signs it; it commits the guardian set and threshold; the prefix stays as it stands; every
 * later change to the set takes the guardians' authority.
 *
 * Proven:
 *   · the current op-key enrols a set over a one-of-one head; prefix, op-key and every device edge stand,
 *   · after a self-rotation the CURRENT key enrols and the retired key cannot,
 *   · a second enrolment refuses, at the mint and at the reader; the guardians' quorum then rotates and the self set
 *     refuses,
 *   · a stranger's, a tampered, an untyped or a padded enrolment moves nothing; a veto never names one,
 *   · the board carries the type and its signature through,
 *   · no prefix incepts unarmed, at the mint or at the reader,
 *   · the verb's refusals: possession unproven, a repeated key, an unmeetable threshold, a key serving another face.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import { buildDeviceDelegation } from "../src/device-delegation.js";
import {
  mintPersonaInception, mintPersonaRotation, mintGuardianEnrolment, mintVeto, personaRotationSigningBytes,
  personaEnrolmentSigningBytes, personaEventBytes, personaEventCidOf, personaPrefixOf, sealedEnrolmentBytes,
  verifyPersonaKel, verifyPersonaKelFull,
  foldPersonaContests, headOpKey, verifyEdgeAgainstPersonaKel, enrolmentDigestOf, GUARDIAN_ENROLMENT_KIND,
  type PersonaKelEvent,
} from "../src/persona-kel.js";
import { writePersonaKelEvent, personaKelEventsFromBoard } from "../src/persona-kel-board.js";
import {
  attestAndRotate, enrolGuardians, guardianCompartmentCheck, guardianPossessionBytes,
  type GuardianEnrolmentOffer,
} from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import type { LarDoc } from "../src/base-doc.js";

const SEEDS = {
  opA:      new Uint8Array(32).fill(11),
  opB:      new Uint8Array(32).fill(22),
  self:     new Uint8Array(32).fill(5),
  vessel:   new Uint8Array(32).fill(33),
  g1:       new Uint8Array(32).fill(1),
  g2:       new Uint8Array(32).fill(2),
  g3:       new Uint8Array(32).fill(3),
  g4:       new Uint8Array(32).fill(4),
  stranger: new Uint8Array(32).fill(9),
};
const pubOf    = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const didOf    = async (s: Uint8Array): Promise<string> => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, s));

/** A face founded one-of-one: its genesis set names its own self-recovery key alone, at threshold one. */
async function oneOfOne(): Promise<{ inception: PersonaKelEvent; selfPub: string }> {
  const selfPub = await pubOf(SEEDS.self);
  return { inception: mintPersonaInception(await didOf(SEEDS.opA), sealKeySetHash([selfPub], 1)), selfPub };
}

async function friends(threshold = 2): Promise<{ keys: string[]; hash: string }> {
  const keys = await Promise.all([pubOf(SEEDS.g1), pubOf(SEEDS.g2), pubOf(SEEDS.g3)]);
  return { keys, hash: sealKeySetHash(keys, threshold) };
}

async function enrolled(head: PersonaKelEvent, seed: Uint8Array = SEEDS.opA): Promise<PersonaKelEvent> {
  const { hash } = await friends();
  const r = await mintGuardianEnrolment({ head, guardianSetHash: hash, sign: signerOf(seed) });
  if (!r.ok) throw new Error(r.reason);
  return r.event;
}

/** Re-address an event after a field changed, so a probe reaches the authority check past the cid check. */
function readdressed(e: PersonaKelEvent): PersonaKelEvent {
  return { ...e, eventCid: personaEventCidOf(e) };
}

/** Re-address AND re-sign under `seed`, so a probe passes the cid and the signature and meets the shape rule alone. */
async function resigned(e: PersonaKelEvent, seed: Uint8Array = SEEDS.opA): Promise<PersonaKelEvent> {
  const r = readdressed(e);
  return { ...r, enrolSig: await signerOf(seed)(personaEventBytes(r)) };
}

describe("the typed first enrolment", () => {
  test("★ the face's own current key enrols a guardian set; the prefix, the op-key and the device edge stand ★", async () => {
    const { inception } = await oneOfOne();
    const { hash } = await friends();
    const edge = await buildDeviceDelegation({
      personaRootSeed: SEEDS.opA, deviceVerifyingKey: await pubOf(SEEDS.vessel), hearthTrueName: "", boundEpoch: 0,
    });
    const r = await mintGuardianEnrolment({ head: inception, guardianSetHash: hash, sign: signerOf(SEEDS.opA) });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.event.kind).toBe(GUARDIAN_ENROLMENT_KIND);
    expect(r.event.prefix).toBe(inception.prefix);
    expect(r.event.opKeyDid).toBe(inception.opKeyDid);
    expect(r.event.recoverySetHash).toBe(inception.recoverySetHash);
    expect(r.event.nextRecoverySetHash).toBe(hash);
    const chain = [inception, r.event];
    expect(verifyPersonaKel(chain)).toBe(true);
    expect((await verifyPersonaKelFull(chain)).ok).toBe(true);
    expect(foldPersonaContests(chain).kel.map((e) => e.eventCid)).toEqual(chain.map((e) => e.eventCid));
    expect(await headOpKey(chain)).toBe(inception.opKeyDid);
    expect((await verifyEdgeAgainstPersonaKel(edge, chain)).ok).toBe(true);
  });

  test("the signed bytes name the kind, so an untyped copy of the same fields reads another event", async () => {
    const { inception } = await oneOfOne();
    const e = await enrolled(inception);
    const { kind: _kind, ...untyped } = e;
    expect(personaEventCidOf(untyped)).not.toBe(e.eventCid);
    expect(hex(personaEnrolmentSigningBytes(inception, e.nextRecoverySetHash))).toBe(hex(personaEventBytes(e)));
    expect(verifyPersonaKel([inception, { ...untyped, eventCid: e.eventCid }])).toBe(false);
  });

  test("★ after a self-rotation the CURRENT key enrols, and the retired key cannot ★", async () => {
    const { inception, selfPub } = await oneOfOne();
    const fresh = await didOf(SEEDS.opB);
    const sig = await signerOf(SEEDS.self)(personaRotationSigningBytes(inception, fresh));
    const rotated = await mintPersonaRotation({
      head: inception, freshOpKeyDid: fresh, recoveryRoster: [selfPub], recoveryThreshold: 1,
      rotationSigs: [{ signer: selfPub, sig }],
    });
    expect(rotated.ok).toBe(true);
    if (!rotated.ok) return;
    const { hash } = await friends();
    const byRetired = await mintGuardianEnrolment({ head: rotated.event, guardianSetHash: hash, sign: signerOf(SEEDS.opA) });
    expect(byRetired.ok).toBe(false);
    const byCurrent = await mintGuardianEnrolment({ head: rotated.event, guardianSetHash: hash, sign: signerOf(SEEDS.opB) });
    expect(byCurrent.ok, byCurrent.ok ? "" : byCurrent.reason).toBe(true);
    if (byCurrent.ok) expect((await verifyPersonaKelFull([inception, rotated.event, byCurrent.event])).ok).toBe(true);
  });

  test("★ a later change takes the guardians: a second enrolment refuses; their quorum rotates; the self set refuses ★", async () => {
    const { inception, selfPub } = await oneOfOne();
    const first = await enrolled(inception);
    const g = await friends();
    const g4 = await pubOf(SEEDS.g4);
    const again = await mintGuardianEnrolment({ head: first, guardianSetHash: sealKeySetHash([g4], 1), sign: signerOf(SEEDS.opA) });
    expect(again.ok).toBe(false);
    // The reader refuses the same act forged past the mint.
    const forgedCore = { ...first, seq: first.seq + 1, prevEventCid: first.eventCid, nextRecoverySetHash: sealKeySetHash([g4], 1) };
    const forged = readdressed({ ...forgedCore, enrolSig: await signerOf(SEEDS.opA)(personaEventBytes(forgedCore)) });
    expect((await verifyPersonaKelFull([inception, first, forged])).ok).toBe(false);
    expect(foldPersonaContests([inception, first, forged]).kel).toHaveLength(2);

    const quorum = await attestAndRotate({
      head: first, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys: g.keys, recoveryThreshold: 2,
      guardianSigners: [
        { signer: g.keys[0]!, sign: signerOf(SEEDS.g1) },
        { signer: g.keys[1]!, sign: signerOf(SEEDS.g2) },
      ],
    });
    expect(quorum.ok, quorum.ok ? "" : quorum.reason).toBe(true);
    const bySelf = await attestAndRotate({
      head: first, freshOpKeyDid: await didOf(SEEDS.opB), guardianRecoveryKeys: [selfPub], recoveryThreshold: 1,
      guardianSigners: [{ signer: selfPub, sign: signerOf(SEEDS.self) }],
    });
    expect(bySelf.ok).toBe(false);
  });

  test("an enrolment over a set an inception already names for guardians refuses: only a one-of-one face enrols", async () => {
    // A genesis that grafts no set reads one-of-one; a head whose rolling set moved off the genesis set reads enrolled.
    const { inception } = await oneOfOne();
    const g = await friends();
    const moved = readdressed({ ...inception, seq: 1, prevEventCid: inception.eventCid, nextRecoverySetHash: g.hash, rotationSigs: [] });
    const r = await mintGuardianEnrolment({ head: moved, guardianSetHash: sealKeySetHash([await pubOf(SEEDS.g4)], 1), sign: signerOf(SEEDS.opA) });
    expect(r.ok).toBe(false);
  });

  test("an enrolment that commits the genesis set again, or no digest at all, refuses", async () => {
    const { inception } = await oneOfOne();
    for (const guardianSetHash of [inception.recoverySetHash, "", "zz"]) {
      const r = await mintGuardianEnrolment({ head: inception, guardianSetHash, sign: signerOf(SEEDS.opA) });
      expect(r.ok, guardianSetHash).toBe(false);
    }
  });

  test("an enrolment over a provisional head refuses: a contested key signs no authority change", async () => {
    const { inception, selfPub } = await oneOfOne();
    const fresh = await didOf(SEEDS.opB);
    const sig = await signerOf(SEEDS.self)(personaRotationSigningBytes(inception, fresh, inception.nextRecoverySetHash, true));
    const provisional = await mintPersonaRotation({
      head: inception, freshOpKeyDid: fresh, recoveryRoster: [selfPub], recoveryThreshold: 1,
      rotationSigs: [{ signer: selfPub, sig }], provisional: true,
    });
    expect(provisional.ok).toBe(true);
    if (!provisional.ok) return;
    const { hash } = await friends();
    const r = await mintGuardianEnrolment({ head: provisional.event, guardianSetHash: hash, sign: signerOf(SEEDS.opB) });
    expect(r.ok).toBe(false);
    const core = { ...provisional.event, seq: 2, prevEventCid: provisional.event.eventCid, nextRecoverySetHash: hash,
      provisional: false, kind: GUARDIAN_ENROLMENT_KIND, recoveryRoster: [], recoveryThreshold: 0, rotationSigs: [] } as PersonaKelEvent;
    const forged = readdressed({ ...core, enrolSig: await signerOf(SEEDS.opB)(personaEventBytes(core)) });
    expect((await verifyPersonaKelFull([inception, provisional.event, forged])).ok).toBe(false);
  });
});

describe("what a board writer reaches", () => {
  test("★ a stranger's enrolment moves nothing: the fold sets it aside and the head stands ★", async () => {
    const { inception } = await oneOfOne();
    const forged = await enrolled(inception, SEEDS.stranger).catch(() => null);
    expect(forged).toBeNull();   // the mint checks the signature it took
    const honest = await enrolled(inception);
    const strangerSigned = { ...honest, enrolSig: await signerOf(SEEDS.stranger)(personaEventBytes(honest)) };
    const fold = foldPersonaContests([inception, strangerSigned]);
    expect(fold.kel).toHaveLength(1);
    expect(fold.setAside).toHaveLength(1);
    const unsigned = { ...honest, enrolSig: null };
    expect((await verifyPersonaKelFull([inception, unsigned])).ok).toBe(false);
  });

  test("a tampered graft, an unknown kind, or an enrolment that pads the roster, the quorum or the devices refuses", async () => {
    const { inception } = await oneOfOne();
    const e = await enrolled(inception);
    const g4 = sealKeySetHash([await pubOf(SEEDS.g4)], 1);
    const probes: PersonaKelEvent[] = [
      { ...e, nextRecoverySetHash: g4 },                                                        // cid breaks
      await resigned({ ...e, kind: "guardian-revocation" as typeof GUARDIAN_ENROLMENT_KIND }),    // a kind the reader knows not
      { ...e, recoveryRoster: [await pubOf(SEEDS.g1)], recoveryThreshold: 1 },                   // a reveal rides no enrolment
      { ...e, rotationSigs: [{ signer: await pubOf(SEEDS.g1), sig: "00".repeat(64) }] },
      // The face's own key signs an "enrolment" that also seats another op-key: a rotation no guardian attested.
      await resigned({ ...e, opKeyDid: await didOf(SEEDS.opB) }),
    ];
    for (const p of probes) expect((await verifyPersonaKelFull([inception, p])).ok).toBe(false);
    // A device box the face's own key sealed: an enrolment re-enrols no device, so the shape refuses it whole.
    const box = { kind: "sealed-enrolment" as const, e: "11".repeat(32), n: "22".repeat(12), c: "33".repeat(48) };
    const sealed = { ...box, sig: await signerOf(SEEDS.opA)(sealedEnrolmentBytes(e.prefix, e.opKeyDid, box)) };
    const padded = await resigned({ ...e, enrolments: [sealed], enrolmentDigest: enrolmentDigestOf([sealed]) });
    expect((await verifyPersonaKelFull([inception, padded])).ok).toBe(false);
  });

  test("an inception that names a kind refuses", async () => {
    const { inception } = await oneOfOne();
    expect(verifyPersonaKel([readdressed({ ...inception, kind: GUARDIAN_ENROLMENT_KIND })])).toBe(false);
  });

  test("a veto never names an enrolment", async () => {
    const { inception } = await oneOfOne();
    const e = await enrolled(inception);
    const veto = await mintVeto({ contested: e, standing: inception, sign: signerOf(SEEDS.opA) });
    const fold = foldPersonaContests([inception, e, veto]);
    expect(fold.kel.map((x) => x.eventCid)).toEqual([inception.eventCid, e.eventCid]);
    expect(fold.fork).toBeNull();
  });

  test("★ the board carries the kind and its signature through ★", async () => {
    const { inception } = await oneOfOne();
    const e = await enrolled(inception);
    const doc = { tiddlers: {} } as unknown as LarDoc;
    writePersonaKelEvent(doc, inception);
    writePersonaKelEvent(doc, e);
    const read = personaKelEventsFromBoard(doc).sort((a, b) => a.seq - b.seq);
    expect(read[1]!.kind).toBe(GUARDIAN_ENROLMENT_KIND);
    expect(read[1]!.enrolSig).toBe(e.enrolSig);
    expect((await verifyPersonaKelFull(read)).ok).toBe(true);
  });
});

describe("an event that names no kind keeps the bytes it held", () => {
  // Content addresses read off the encoder before the typed enrolment landed (88e0fedbe): an inception, a provisional
  // self-recovery rotation and the veto that kills it, from fixed seeds.
  test("★ an inception, a rotation and a veto address as they always addressed ★", async () => {
    const { inception, selfPub } = await oneOfOne();
    const fresh = await didOf(SEEDS.opB);
    const sig = await signerOf(SEEDS.self)(personaRotationSigningBytes(inception, fresh, inception.nextRecoverySetHash, true));
    const rot = await mintPersonaRotation({
      head: inception, freshOpKeyDid: fresh, recoveryRoster: [selfPub], recoveryThreshold: 1,
      rotationSigs: [{ signer: selfPub, sig }], provisional: true,
    });
    if (!rot.ok) throw new Error(rot.reason);
    const veto = await mintVeto({ contested: rot.event, standing: inception, sign: signerOf(SEEDS.opA) });
    expect(inception.eventCid).toBe("pkel0-c8c52547cf4f765ee7f88763e58b7d501817759289cf996688c6a25e4cd36502");
    expect(rot.event.eventCid).toBe("pkel1-629b961525e810e19c84303d518ec15c5d6bf3d3ff0d2b1580c636caf9c133d7");
    expect(veto.eventCid).toBe("pkel1-eef28d1afdd4efde09179c14c444e059d63a67fa2de28a7665b8825875553126");
  });
});

describe("no prefix incepts unarmed", () => {
  test("★ the mint and the reader refuse an inception that commits no recovery set ★", async () => {
    const op = await didOf(SEEDS.opA);
    expect(() => mintPersonaInception(op, "")).toThrow(/unarmed/);
    const { inception } = await oneOfOne();
    const unarmed = readdressed({ ...inception, recoverySetHash: "", nextRecoverySetHash: "", prefix: personaPrefixOf(op, "") });
    expect(verifyPersonaKel([unarmed])).toBe(false);
    expect(foldPersonaContests([unarmed]).kel).toHaveLength(0);
  });
});

describe("the enrolment verb", () => {
  async function offer(seed: Uint8Array, prefix: string, slot: "mine" | "guardian-a" | "guardian-b" = "guardian-a"): Promise<GuardianEnrolmentOffer> {
    const key = await pubOf(seed);
    return {
      registration:  guardianRecoveryRegistrationCard(slot, key, null),
      possessionSig: await signerOf(seed)(guardianPossessionBytes(prefix, key)),
    };
  }

  test("★ CONTROL: a fresh key per face enrols, each guardian proving possession first ★", async () => {
    const { inception } = await oneOfOne();
    const offers = [await offer(SEEDS.g1, inception.prefix), await offer(SEEDS.g2, inception.prefix), await offer(SEEDS.g3, inception.prefix)];
    const r = await enrolGuardians({
      head: inception, guardians: offers, threshold: 2, sign: signerOf(SEEDS.opA),
      heldByOtherFaces: [{ handleIndex: 1, keys: [await pubOf(SEEDS.g4)] }],
    });
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.event.nextRecoverySetHash).toBe((await friends()).hash);
    expect(r.guardianSetHash).toBe((await friends()).hash);
  });

  test("★ RED: one guardian key offered to two faces refuses guardian-key-serves-another-face ★", async () => {
    const { inception } = await oneOfOne();
    const offers = [await offer(SEEDS.g1, inception.prefix), await offer(SEEDS.g2, inception.prefix)];
    const r = await enrolGuardians({
      head: inception, guardians: offers, threshold: 2, sign: signerOf(SEEDS.opA),
      heldByOtherFaces: [{ handleIndex: 3, keys: [await pubOf(SEEDS.g2)] }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal).toBe("guardian-key-serves-another-face");
    expect(r.reason).toContain("3");
  });

  test("the compartment check names the face whose set already holds the key, and passes a disjoint set", async () => {
    const k1 = await pubOf(SEEDS.g1), k2 = await pubOf(SEEDS.g2);
    expect(guardianCompartmentCheck({ offered: [k1], heldByOtherFaces: [{ handleIndex: 2, keys: [k2] }] }).ok).toBe(true);
    const v = guardianCompartmentCheck({ offered: [k1.toUpperCase()], heldByOtherFaces: [{ handleIndex: 2, keys: [k1] }] });
    expect(v.ok).toBe(false);
    if (!v.ok) { expect(v.handleIndex).toBe(2); expect(v.key).toBe(k1); }
  });

  test("a possession proof over another face's prefix, or by another key, refuses possession-unproven", async () => {
    const { inception } = await oneOfOne();
    const other = mintPersonaInception(await didOf(SEEDS.opB), sealKeySetHash([await pubOf(SEEDS.self)], 1));
    const wrongFace = await offer(SEEDS.g1, other.prefix);
    const wrongKey = { ...(await offer(SEEDS.g2, inception.prefix)), possessionSig: (await offer(SEEDS.g3, inception.prefix)).possessionSig };
    for (const bad of [wrongFace, wrongKey]) {
      const r = await enrolGuardians({
        head: inception, guardians: [bad, await offer(SEEDS.g4, inception.prefix)], threshold: 1, sign: signerOf(SEEDS.opA), heldByOtherFaces: [],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal).toBe("possession-unproven");
    }
  });

  test("a repeated key and an unmeetable threshold refuse; the verb sets no count of its own", async () => {
    const { inception } = await oneOfOne();
    const a = await offer(SEEDS.g1, inception.prefix);
    const repeated = await enrolGuardians({ head: inception, guardians: [a, a], threshold: 1, sign: signerOf(SEEDS.opA), heldByOtherFaces: [] });
    expect(repeated.ok).toBe(false);
    if (!repeated.ok) expect(repeated.refusal).toBe("guardian-key-repeated");
    for (const threshold of [0, 2, 1.5]) {
      const r = await enrolGuardians({ head: inception, guardians: [a], threshold, sign: signerOf(SEEDS.opA), heldByOtherFaces: [] });
      expect(r.ok, String(threshold)).toBe(false);
      if (!r.ok) expect(r.refusal).toBe("threshold-unmeetable");
    }
    // One guardian at threshold one enrols: count and threshold stay the person's.
    const one = await enrolGuardians({ head: inception, guardians: [a], threshold: 1, sign: signerOf(SEEDS.opA), heldByOtherFaces: [] });
    expect(one.ok, one.ok ? "" : one.reason).toBe(true);
  });

  test("the verb refuses face-holds-guardians over an enrolled face", async () => {
    const { inception } = await oneOfOne();
    const first = await enrolled(inception);
    const r = await enrolGuardians({
      head: first, guardians: [await offer(SEEDS.g4, inception.prefix)], threshold: 1, sign: signerOf(SEEDS.opA), heldByOtherFaces: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("face-holds-guardians");
  });
});
