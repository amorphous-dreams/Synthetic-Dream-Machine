/**
 * recovery-contact-two-of-three — enrolment takes exactly THREE recovery contacts at a threshold of TWO.
 *
 * The ruling (operator, 2026-10-31, "2 of 3"; lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings, "Recovery
 * contacts, custodians and the Handle"): a person enrols three recovery contacts and two of them, together, restore the
 * person's Handle. The face's own self-recovery key counts as none of the three: it stands beside the set as the genesis
 * wall, and a set that names it would let one of the three be the face itself.
 *
 * RED first: 2-of-2, 1-of-3 and 3-of-5 each enrolled before this law; the self-recovery key enrolled as a contact.
 * CONTROL: 2-of-3 enrols.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { hex } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  mintPersonaInception, mintRecoveryContactEnrolment, personaEventBytes, personaEventCidOf, verifyPersonaKelFull, type PersonaKelEvent,
} from "../src/persona-kel.js";
import { enrolRecoveryContacts, recoveryContactPossessionBytes, type RecoveryContactEnrolmentOffer } from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, s));
const SELF = seed(5);

async function face(): Promise<PersonaKelEvent> {
  return mintPersonaInception(`0x${await pubOf(seed(11))}`, sealKeySetHash([await pubOf(SELF)], 1));
}
async function offerOf(s: Uint8Array, prefix: string): Promise<RecoveryContactEnrolmentOffer> {
  const key = await pubOf(s);
  return { registration: recoveryContactRegistrationCard("contact-a", key, null), possessionSig: await signerOf(s)(recoveryContactPossessionBytes(prefix, key)) };
}
async function enrol(seeds: Uint8Array[], threshold: number) {
  const head = await face();
  const offers = await Promise.all(seeds.map((s) => offerOf(s, head.prefix)));
  return enrolRecoveryContacts({ head, recoveryContacts: offers, threshold, heldByOtherFaces: [], sign: signerOf(seed(11)), selfRecoveryKey: await pubOf(SELF) });
}
const contacts = (n: number): Uint8Array[] => Array.from({ length: n }, (_, i) => seed(i + 1));

describe("the 2-of-3 law", () => {
  test("★ CONTROL: three recovery contacts at a threshold of two enrol ★", async () => {
    const r = await enrol(contacts(3), 2);
    expect(r.ok, r.ok ? "" : r.reason).toBe(true);
  });

  test("★ RED: 2-of-2 refuses recovery-contacts-not-three ★", async () => {
    const r = await enrol(contacts(2), 2);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.refusal).toBe("recovery-contacts-not-three"); expect(r.reason).toContain("three"); }
  });

  test("★ RED: 3-of-5 refuses recovery-contacts-not-three ★", async () => {
    const r = await enrol(contacts(5), 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("recovery-contacts-not-three");
  });

  test("★ RED: 1-of-3 refuses threshold-not-two ★", async () => {
    const r = await enrol(contacts(3), 1);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.refusal).toBe("threshold-not-two"); expect(r.reason).toContain("two"); }
  });

  test("a threshold of three over three, zero, or a fraction refuses threshold-not-two", async () => {
    for (const t of [0, 3, 1.5, -2]) {
      const r = await enrol(contacts(3), t);
      expect(r.ok, String(t)).toBe(false);
      if (!r.ok) expect(r.refusal, String(t)).toBe("threshold-not-two");
    }
  });

  test("a single contact at one, and no contact at all, refuse recovery-contacts-not-three", async () => {
    for (const n of [0, 1, 4]) {
      const r = await enrol(contacts(n), 2);
      expect(r.ok, String(n)).toBe(false);
      if (!r.ok) expect(r.refusal, String(n)).toBe("recovery-contacts-not-three");
    }
  });

  test("★ RED: a set that includes the face's own self-recovery key refuses self-recovery-key-offered ★", async () => {
    const r = await enrol([SELF, seed(1), seed(2)], 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("self-recovery-key-offered");
  });

  test("CONTROL: the count and the threshold refuse before the self key is looked at, so each refusal names one cause", async () => {
    const r = await enrol([SELF, seed(1)], 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("recovery-contacts-not-three");
  });
});

describe("P1 — the self-recovery key is excluded by the key itself, whatever shape the genesis set holds", () => {
  test("★ RED: a multi-key genesis that names the self key still refuses it as a contact ★", async () => {
    const selfPub = await pubOf(SELF);
    const head = mintPersonaInception(`0x${await pubOf(seed(11))}`, sealKeySetHash([selfPub, await pubOf(seed(9))], 1));
    const offers = await Promise.all([SELF, seed(1), seed(2)].map((s) => offerOf(s, head.prefix)));
    const r = await enrolRecoveryContacts({ head, recoveryContacts: offers, threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)), selfRecoveryKey: selfPub });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("self-recovery-key-offered");
  });

  test("an upper-case offer of the self key refuses too", async () => {
    const selfPub = await pubOf(SELF);
    const head = await face();
    const offers = await Promise.all([SELF, seed(1), seed(2)].map((s) => offerOf(s, head.prefix)));
    const loud = { ...offers[0]!, registration: { ...offers[0]!.registration, recoveryPubKey: selfPub.toUpperCase() } };
    const r = await enrolRecoveryContacts({ head, recoveryContacts: [loud, offers[1]!, offers[2]!], threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)), selfRecoveryKey: selfPub });
    expect(r.ok).toBe(false);
  });
});

describe("P2 — the KEL verifier decides: an enrolment event carries its count and threshold and refuses any but three-at-two", () => {
  async function realEnrolment() {
    const inception = await face();
    const r = await mintRecoveryContactEnrolment({ head: inception, recoveryContactSetHash: sealKeySetHash(contacts(3).map((_, i) => `${i}`.padStart(64, "a")), 2), sign: signerOf(seed(11)) });
    if (!r.ok) throw new Error(r.reason);
    return { inception, event: r.event };
  }
  /** Re-address and re-sign past the cid and the signature, so the probe meets the shape rule alone. */
  async function resigned(e: PersonaKelEvent): Promise<PersonaKelEvent> {
    const readdressed = { ...e, eventCid: personaEventCidOf(e) };
    return { ...readdressed, enrolSig: await signerOf(seed(11))(personaEventBytes(readdressed)) };
  }

  test("CONTROL: the minted three-at-two enrolment verifies", async () => {
    const { inception, event } = await realEnrolment();
    expect((await verifyPersonaKelFull([inception, event])).ok).toBe(true);
  });

  test("★ RED: a direct 1-of-2 enrolment event refuses at the verifier ★", async () => {
    const { inception, event } = await realEnrolment();
    const forged = await resigned({ ...event, enrolCount: 2, enrolThreshold: 1 } as PersonaKelEvent);
    expect((await verifyPersonaKelFull([inception, forged])).ok).toBe(false);
  });

  test("★ RED: an enrolment event that carries no count and threshold refuses ★", async () => {
    const { inception, event } = await realEnrolment();
    const { enrolCount: _c, enrolThreshold: _t, ...bare } = event as PersonaKelEvent & { enrolCount?: number; enrolThreshold?: number };
    const forged = await resigned(bare as PersonaKelEvent);
    expect((await verifyPersonaKelFull([inception, forged])).ok).toBe(false);
  });
});
