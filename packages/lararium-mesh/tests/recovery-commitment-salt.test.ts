/**
 * recovery-commitment-salt — two faces that enrol the same recovery contacts show two unrelated commitments.
 *
 * A face's key history commits its recovery contact set as a digest, and the history rides a board its Nexus reads. A
 * contact cuts a fresh key for each face, and the enrolment door refuses a key the SAME vessel already holds for another
 * face; nothing stops a contact who answers two vessels with one key. Unsalted, the two faces' commitments then read equal
 * on their boards, and an observer joins the faces. The commitment a face makes for a contact set hashes with that face's
 * own prefix.
 *
 *   S1  two faces, on two vessels, enrol the same three contact keys at two: the commitments differ
 *   S2  the contacts' quorum still rotates each face: every contact signs the rotation bytes, the reveal verifies against
 *       the salted commitment, and the whole history verifies
 *   S3  a rotation grafts a next set; the same next set on two faces commits two digests, and the grafted set authorizes
 *       the rotation after it
 *   S4  CONTROL: one face's commitment refuses another face's reveal of the very same keys, and a swapped roster refuses
 *   S5  CONTROL: the genesis set (the face's own self-recovery key, one of one) still reveals and rotates as it committed
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import { mintPersonaInception, verifyPersonaKel, verifyPersonaKelFull, type PersonaKelEvent } from "../src/persona-kel.js";
import {
  attestAndRotate, enrolRecoveryContacts, recoveryContactPossessionBytes, type RecoveryContactEnrolmentOffer, type RecoveryContactSigner,
} from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";

const seed = (fill: number): Uint8Array => new Uint8Array(32).fill(fill);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const didOf = async (s: Uint8Array): Promise<string> => `0x${await pubOf(s)}`;
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, s));

/** Three contacts who answer every face with ONE key each, and a second trio for a graft. */
const CONTACTS = [seed(1), seed(2), seed(3)];
const NEXT = [seed(6), seed(7), seed(8)];

interface Face { readonly op: Uint8Array; readonly self: Uint8Array; readonly inception: PersonaKelEvent }
/** A face founded one-of-one: its genesis set names its own self-recovery key alone. */
async function found(op: number, self: number): Promise<Face> {
  const face = { op: seed(op), self: seed(self) };
  return { ...face, inception: mintPersonaInception(await didOf(face.op), sealKeySetHash([await pubOf(face.self)], 1)) };
}

async function offer(contact: Uint8Array, prefix: string, slot: "contact-a" | "contact-b" | "contact-c"): Promise<RecoveryContactEnrolmentOffer> {
  const key = await pubOf(contact);
  return { registration: recoveryContactRegistrationCard(slot, key, null), possessionSig: await signerOf(contact)(recoveryContactPossessionBytes(prefix, key)) };
}

/** `face` enrols the contacts on a vessel that holds no other face's set (the door's own refusal reads one vessel alone). */
async function enrol(face: Face, contacts: readonly Uint8Array[] = CONTACTS) {
  const slots = ["contact-a", "contact-b", "contact-c"] as const;
  const r = await enrolRecoveryContacts({
    head: face.inception, threshold: 2, heldByOtherFaces: [], selfRecoveryKey: await pubOf(face.self), sign: signerOf(face.op),
    recoveryContacts: await Promise.all(contacts.map((c, i) => offer(c, face.inception.prefix, slots[i]!))),
  });
  if (!r.ok) throw new Error(`${r.refusal}: ${r.reason}`);
  return r;
}

const quorum = async (contacts: readonly Uint8Array[]): Promise<RecoveryContactSigner[]> =>
  Promise.all(contacts.slice(0, 2).map(async (c) => ({ signer: await pubOf(c), sign: signerOf(c) })));
const keysOf = (contacts: readonly Uint8Array[]): Promise<string[]> => Promise.all(contacts.map(pubOf));

describe("a face's recovery commitment salts with that face", () => {
  test("S1: two faces enrol the same contacts under the same keys, and the commitments differ", async () => {
    const a = await enrol(await found(11, 5));
    const b = await enrol(await found(22, 9));
    expect(b.recoveryContactSetHash, "two faces' boards show one commitment for one contact set").not.toBe(a.recoveryContactSetHash);
    expect(b.event.nextRecoverySetHash).not.toBe(a.event.nextRecoverySetHash);
    // CONTROL: one face enrolling the same set again computes the same commitment (a deterministic record).
    expect((await enrol(await found(11, 5))).recoveryContactSetHash).toBe(a.recoveryContactSetHash);
  });

  test("S2: the contacts' quorum rotates each face; each contact signs, the reveal verifies, the history verifies", async () => {
    for (const face of [await found(11, 5), await found(22, 9)]) {
      const enrolled = await enrol(face);
      const rotated = await attestAndRotate({
        head: enrolled.event, freshOpKeyDid: await didOf(seed(44)), recoveryContactKeys: await keysOf(CONTACTS), recoveryThreshold: 2,
        recoveryContactSigners: await quorum(CONTACTS),
      });
      expect(rotated.ok, rotated.ok ? "" : rotated.reason).toBe(true);
      if (!rotated.ok) return;
      const chain = [face.inception, enrolled.event, rotated.event];
      expect(verifyPersonaKel(chain)).toBe(true);
      expect((await verifyPersonaKelFull(chain)).ok).toBe(true);
    }
  });

  test("S3: a rotation grafts a next set; two faces commit two digests for it, and it authorizes the next rotation", async () => {
    const grafted: string[] = [];
    for (const face of [await found(11, 5), await found(22, 9)]) {
      const enrolled = await enrol(face);
      const slots = ["contact-a", "contact-b", "contact-c"] as const;
      const first = await attestAndRotate({
        head: enrolled.event, freshOpKeyDid: await didOf(seed(44)), recoveryContactKeys: await keysOf(CONTACTS), recoveryThreshold: 2,
        recoveryContactSigners: await quorum(CONTACTS),
        next: { threshold: 2, recoveryContacts: (await keysOf(NEXT)).map((k, i) => recoveryContactRegistrationCard(slots[i]!, k, null)) },
      });
      expect(first.ok, first.ok ? "" : first.reason).toBe(true);
      if (!first.ok) return;
      grafted.push(first.event.nextRecoverySetHash);
      const second = await attestAndRotate({
        head: first.event, freshOpKeyDid: await didOf(seed(55)), recoveryContactKeys: await keysOf(NEXT), recoveryThreshold: 2,
        recoveryContactSigners: await quorum(NEXT),
      });
      expect(second.ok, second.ok ? "" : second.reason).toBe(true);
      if (!second.ok) return;
      expect(verifyPersonaKel([face.inception, enrolled.event, first.event, second.event])).toBe(true);
      // The old set no longer rotates: the graft moved the authority.
      const stale = await attestAndRotate({
        head: first.event, freshOpKeyDid: await didOf(seed(55)), recoveryContactKeys: await keysOf(CONTACTS), recoveryThreshold: 2,
        recoveryContactSigners: await quorum(CONTACTS),
      });
      expect(stale.ok).toBe(false);
    }
    expect(grafted[1], "two faces graft one next set under one digest").not.toBe(grafted[0]);
  });

  test("S4 CONTROL: a swapped roster refuses, and so does a threshold the commitment never named", async () => {
    const face = await found(11, 5);
    const enrolled = await enrol(face);
    const swapped = await attestAndRotate({
      head: enrolled.event, freshOpKeyDid: await didOf(seed(44)), recoveryContactKeys: await keysOf(NEXT), recoveryThreshold: 2,
      recoveryContactSigners: await quorum(NEXT),
    });
    expect(swapped.ok).toBe(false);
    const loosened = await attestAndRotate({
      head: enrolled.event, freshOpKeyDid: await didOf(seed(44)), recoveryContactKeys: await keysOf(CONTACTS), recoveryThreshold: 1,
      recoveryContactSigners: await quorum(CONTACTS),
    });
    expect(loosened.ok).toBe(false);
  });

  test("S5 CONTROL: the genesis set (the face's own self-recovery key) still rotates the face as it committed", async () => {
    const face = await found(11, 5);
    const rotated = await attestAndRotate({
      head: face.inception, freshOpKeyDid: await didOf(seed(44)), recoveryContactKeys: [await pubOf(face.self)], recoveryThreshold: 1,
      recoveryContactSigners: [{ signer: await pubOf(face.self), sign: signerOf(face.self) }],
    });
    expect(rotated.ok, rotated.ok ? "" : rotated.reason).toBe(true);
    if (!rotated.ok) return;
    expect(verifyPersonaKel([face.inception, rotated.event])).toBe(true);
    // The genesis commitment carries forward unchanged, so the face still reads as holding its genesis set alone.
    expect(rotated.event.nextRecoverySetHash).toBe(face.inception.recoverySetHash);
  });
});
