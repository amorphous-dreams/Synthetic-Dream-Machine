/**
 * recovery-contact-weld — pins today's behaviour of enrolment, the seed-share card and the recovery rotation through
 * their public names, so the guardian -> recovery contact / custodian rename moves names and nothing else
 * (house law: lar:///ha.ka.ba/lares/api/pono/one-name-one-relation, "weld test before rename").
 *
 * Every value below comes off fixed seeds and a counter rng, so a moved byte shows as a moved pin. The rename commit
 * may edit the NAMES this file imports and the DOMAIN-bearing pins it names (a signing domain that rides bytes is a
 * format cut); every other pin stays exactly as written here.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import { sha256HexSync, hex, type RandomProvider } from "../src/crypto.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  mintPersonaInception, personaEnrolmentSigningBytes, verifyPersonaKelFull, GUARDIAN_ENROLMENT_KIND, type PersonaKelEvent,
} from "../src/persona-kel.js";
import { attestAndRotate, enrolGuardians, guardianPossessionBytes } from "../src/recovery-keel-core.js";
import { guardianRecoveryRegistrationCard } from "../src/recovery-registration.js";
import {
  splitToGuardianCards, GUARDIAN_CARD_THRESHOLD, GUARDIAN_SLOT_CUSTODIAN, GUARDIAN_CONFIRM_DOMAIN,
} from "../src/guardian-card.js";
import { GUARDIAN_REGISTRATION_DOMAIN, GUARDIAN_POSSESSION_DOMAIN, FACE_BUNDLE_DOMAIN } from "../src/domains.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const pubOf = (s: Uint8Array): Promise<string> => ed.getPublicKeyAsync(s).then(hex);
const signerOf = (s: Uint8Array) => async (bytes: Uint8Array): Promise<string> => hex(await ed.signAsync(bytes, s));
const digest = (b: Uint8Array): string => sha256HexSync(hex(b));

function counterRng(start = 1): RandomProvider {
  let n = start;
  return {
    getRandomValues<T extends Uint8Array<ArrayBuffer>>(array: T): T { for (let i = 0; i < array.length; i++) array[i] = (n++) & 0xff; return array; },
    randomUUID() { return "00000000-0000-4000-8000-000000000000"; },
  };
}

async function faceAndOffers(): Promise<{ inception: PersonaKelEvent; keys: string[]; offers: Parameters<typeof enrolGuardians>[0]["guardians"] }> {
  const inception = mintPersonaInception(`0x${await pubOf(seed(11))}`, sealKeySetHash([await pubOf(seed(5))], 1));
  const keys = await Promise.all([1, 2, 3].map((n) => pubOf(seed(n))));
  const offers = await Promise.all(keys.map(async (k, i) => ({
    registration:  guardianRecoveryRegistrationCard(i % 2 === 0 ? "guardian-a" : "guardian-b", k, null),
    possessionSig: await signerOf(seed(i + 1))(guardianPossessionBytes(inception.prefix, k)),
  })));
  return { inception, keys, offers };
}

describe("the weld: enrolment, the seed-share card and the recovery rotation, by their public names", () => {
  test("enrolment: the set digest, the typed event and its signing bytes", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const r = await enrolGuardians({ head: inception, guardians: offers, threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.guardianSetHash).toBe(sealKeySetHash(keys, 2));
    expect(r.event.kind).toBe(GUARDIAN_ENROLMENT_KIND);
    expect(r.event.nextRecoverySetHash).toBe(r.guardianSetHash);
    expect(digest(personaEnrolmentSigningBytes(inception, r.guardianSetHash))).toBe("47251fe458b9cfe7990381b54f185b0b56de1978aa45232709718675e8bfab60");
    expect(r.event.eventCid).toBe("pkel1-9d0bab85bffa65d323f8242c00cef1e2d4a475f4dd3b4d27591b64a070a022c0");
    expect((await verifyPersonaKelFull([inception, r.event])).ok).toBe(true);
  });

  test("enrolment refusals, by name: a repeated key, a bad proof, an unmeetable threshold, a key serving another face", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const sign = signerOf(seed(11));
    const refusal = async (o: typeof offers, threshold: number, held = [] as { handleIndex: number; keys: string[] }[]) =>
      (await enrolGuardians({ head: inception, guardians: o, threshold, heldByOtherFaces: held, sign }) as { refusal?: string }).refusal;
    expect(await refusal([offers[0]!, offers[0]!, offers[1]!], 2)).toBe("guardian-key-repeated");
    expect(await refusal([{ ...offers[0]!, possessionSig: offers[1]!.possessionSig }, offers[1]!, offers[2]!], 2)).toBe("possession-unproven");
    expect(await refusal(offers, 4)).toBe("threshold-unmeetable");
    expect(await refusal(offers, 0)).toBe("threshold-unmeetable");
    expect(await refusal(offers, 2, [{ handleIndex: 3, keys: [keys[1]!] }])).toBe("guardian-key-serves-another-face");
  });

  test("the possession and registration handshakes: bytes and phrases", async () => {
    const { inception, keys } = await faceAndOffers();
    expect(digest(guardianPossessionBytes(inception.prefix, keys[0]!))).toBe("ec416f4bcaab9b003981060eab0e854da9522b15dd8ab6f95f0582bbfb9fa0a3");
    const card = guardianRecoveryRegistrationCard("guardian-a", keys[0]!, "Aki");
    expect(card.label).toBe("Recovery-guardian-A (Aki)");
    expect(card.confirmPhrase).toBe("aster-wind-mesa");
  });

  test("the seed-share card: three slots, distinct custodians, the 2-of-3 floor and each card's phrase", () => {
    const { cards } = splitToGuardianCards(seed(42), "A", "B", 1, counterRng());
    expect(GUARDIAN_CARD_THRESHOLD).toBe(2);
    expect(cards.map((c) => c.slot)).toEqual(["mine", "guardian-a", "guardian-b"]);
    expect(cards.map((c) => c.custodian)).toEqual(["device", "guardian", "escrow-peer"]);
    expect(Object.keys(GUARDIAN_SLOT_CUSTODIAN)).toEqual(["mine", "guardian-a", "guardian-b"]);
    expect(cards.map((c) => c.label)).toEqual(["Recovery-card mine", "Recovery-card guardian-A (A)", "Recovery-card guardian-B (B)"]);
    expect(cards.map((c) => c.confirmPhrase)).toEqual(["dawn-opal-wave", "vine-anchor-crest", "mesa-heron-wind"]);
  });

  test("the recovery rotation: the quorum rotates the enrolled set under the same prefix", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const r = await enrolGuardians({ head: inception, guardians: offers, threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)) });
    if (!r.ok) throw new Error(r.reason);
    const fresh = `0x${await pubOf(seed(22))}`;
    const rot = await attestAndRotate({
      head: r.event, freshOpKeyDid: fresh, guardianRecoveryKeys: keys, recoveryThreshold: 2,
      guardianSigners: [{ signer: keys[0]!, sign: signerOf(seed(1)) }, { signer: keys[2]!, sign: signerOf(seed(3)) }],
    });
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    expect(rot.event.prefix).toBe(inception.prefix);
    expect(rot.event.eventCid).toBe("pkel2-8f47d2afe78d31bb1d6c8b6520deb9b108868ac07753cca493b2038d2acf86d9");
    expect((await verifyPersonaKelFull([inception, r.event, rot.event])).ok).toBe(true);
    const one = await attestAndRotate({
      head: r.event, freshOpKeyDid: fresh, guardianRecoveryKeys: keys, recoveryThreshold: 2,
      guardianSigners: [{ signer: keys[0]!, sign: signerOf(seed(1)) }],
    });
    expect(one.ok).toBe(false);
  });

  test("the domains that ride bytes", () => {
    expect([GUARDIAN_REGISTRATION_DOMAIN, GUARDIAN_POSSESSION_DOMAIN, GUARDIAN_CONFIRM_DOMAIN, FACE_BUNDLE_DOMAIN, GUARDIAN_ENROLMENT_KIND])
      .toEqual(["lar:///ha.ka.ba/lares/domain/guardian-registration/v1", "lar:///ha.ka.ba/lares/domain/guardian-possession", "lar:///ha.ka.ba/lares/domain/guardian-confirm/v1", "lar:///ha.ka.ba/lares/domain/face-bundle-guardian-set", "guardian-enrolment"]);
  });
});
