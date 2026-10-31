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
import { FACE_LOG_VIEW_PARTIES } from "../src/face-log-view.js";
import { sealKeySetHash } from "../src/wax-stamp.js";
import {
  mintPersonaInception, personaEnrolmentSigningBytes, verifyPersonaKelFull, RECOVERY_CONTACT_ENROLMENT_KIND, type PersonaKelEvent,
} from "../src/persona-kel.js";
import { attestAndRotate, enrolRecoveryContacts, recoveryContactPossessionBytes } from "../src/recovery-keel-core.js";
import { recoveryContactRegistrationCard } from "../src/recovery-registration.js";
import {
  splitToCustodianCards, CUSTODIAN_CARD_THRESHOLD, CUSTODIAN_SLOT_TAG, CUSTODIAN_CONFIRM_DOMAIN,
} from "../src/custodian-card.js";
import { RECOVERY_CONTACT_REGISTRATION_DOMAIN, RECOVERY_CONTACT_POSSESSION_DOMAIN, FACE_BUNDLE_DOMAIN } from "../src/domains.js";

/**
 * THE FORMAT CUT (alpha line: no back-compat). The rename moved six signing domains, so exactly these pins moved (the enrolment pins moved a second time with its count and threshold) and
 * no others (the set digest, the refusal outcomes, the quorum verdicts and every structural pin stood unchanged):
 *   guardian-registration/v1        -> recovery-contact-registration   (the registration phrase)
 *   guardian-possession             -> recovery-contact-possession     (the possession bytes)
 *   guardian-confirm/v1             -> custodian-confirm               (each seed-share card's phrase)
 *   face-bundle-guardian-set        -> face-bundle-recovery-contact-set (the bundle's format mark)
 *   kind "guardian-enrolment"       -> "recovery-contact-enrolment"    (the typed event: its bytes, cid and every cid after)
 *   party "guardian"                -> "recovery-contact"              (a face-log view's signed party; FACE_LOG_VIEW_DOMAIN is unchanged, so an old-party view now fails the reader)
 *   the enrolment event               gains enrolCount 3 and enrolThreshold 2 in its signed bytes, and every later rotation and veto on that log carries them forward (the KEL verifier decides the 2-of-3 law; the reveal decides the set)
 * Before the cut: enrolment bytes 47251fe4…, event cid pkel1-9d0bab85…, possession bytes ec416f4b…, registration
 * phrase aster-wind-mesa, card phrases dawn-opal-wave · vine-anchor-crest · mesa-heron-wind, rotation cid pkel2-8f47d2af….
 */

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

async function faceAndOffers(): Promise<{ inception: PersonaKelEvent; keys: string[]; offers: Parameters<typeof enrolRecoveryContacts>[0]["recoveryContacts"] }> {
  const inception = mintPersonaInception(`0x${await pubOf(seed(11))}`, sealKeySetHash([await pubOf(seed(5))], 1));
  const keys = await Promise.all([1, 2, 3].map((n) => pubOf(seed(n))));
  const offers = await Promise.all(keys.map(async (k, i) => ({
    registration:  recoveryContactRegistrationCard(i % 2 === 0 ? "contact-a" : "contact-b", k, null),
    possessionSig: await signerOf(seed(i + 1))(recoveryContactPossessionBytes(inception.prefix, k)),
  })));
  return { inception, keys, offers };
}

describe("the weld: enrolment, the seed-share card and the recovery rotation, by their public names", () => {
  test("enrolment: the set digest, the typed event and its signing bytes", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const r = await enrolRecoveryContacts({ selfRecoveryKey: await pubOf(seed(5)), head: inception, recoveryContacts: offers, threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.recoveryContactSetHash).toBe(sealKeySetHash(keys, 2));
    expect(r.event.kind).toBe(RECOVERY_CONTACT_ENROLMENT_KIND);
    expect(r.event.nextRecoverySetHash).toBe(r.recoveryContactSetHash);
    expect(digest(personaEnrolmentSigningBytes(inception, r.recoveryContactSetHash))).toBe("64076fdc9e30ac6ff89c75b6bdffa608bab30fb2f3b6a8a1b5ed1553304c3d97");
    expect(r.event.eventCid).toBe("pkel1-45383898cb24551d3c319c30082574f65954013889e794bd00758a1b7e49a915");
    expect((await verifyPersonaKelFull([inception, r.event])).ok).toBe(true);
  });

  test("enrolment refusals, by name: a repeated key, a bad proof, a threshold off the rule, a key serving another face", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const sign = signerOf(seed(11));
    const refusal = async (o: typeof offers, threshold: number, held = [] as { handleIndex: number; keys: string[] }[]) =>
      (await enrolRecoveryContacts({ selfRecoveryKey: await pubOf(seed(5)), head: inception, recoveryContacts: o, threshold, heldByOtherFaces: held, sign }) as { refusal?: string }).refusal;
    expect(await refusal([offers[0]!, offers[0]!, offers[1]!], 2)).toBe("recovery-contact-key-repeated");
    expect(await refusal([{ ...offers[0]!, possessionSig: offers[1]!.possessionSig }, offers[1]!, offers[2]!], 2)).toBe("possession-unproven");
    // The 2-of-3 law (the next commit) moved this one refusal: an unmeetable threshold now reads threshold-not-two.
    expect(await refusal(offers, 4)).toBe("threshold-not-two");
    expect(await refusal(offers, 0)).toBe("threshold-not-two");
    expect(await refusal(offers, 2, [{ handleIndex: 3, keys: [keys[1]!] }])).toBe("recovery-contact-key-serves-another-face");
  });

  test("the possession and registration handshakes: bytes and phrases", async () => {
    const { inception, keys } = await faceAndOffers();
    expect(digest(recoveryContactPossessionBytes(inception.prefix, keys[0]!))).toBe("d76e18830311ff10be4b53d3d917093867f9f7e42bb99f5d2529011586049b45");
    const card = recoveryContactRegistrationCard("contact-a", keys[0]!, "Aki");
    expect(card.label).toBe("Recovery-contact-A (Aki)");
    expect(card.confirmPhrase).toBe("cinder-ember-brook");
  });

  test("the seed-share card: three slots, distinct custodians, the 2-of-3 floor and each card's phrase", () => {
    const { cards } = splitToCustodianCards(seed(42), "A", "B", 1, counterRng());
    expect(CUSTODIAN_CARD_THRESHOLD).toBe(2);
    expect(cards.map((c) => c.slot)).toEqual(["mine", "custodian-a", "custodian-b"]);
    expect(cards.map((c) => c.custodian)).toEqual(["device", "custodian", "escrow-peer"]);
    expect(Object.keys(CUSTODIAN_SLOT_TAG)).toEqual(["mine", "custodian-a", "custodian-b"]);
    expect(cards.map((c) => c.label)).toEqual(["Recovery-card mine", "Recovery-card custodian-A (A)", "Recovery-card custodian-B (B)"]);
    expect(cards.map((c) => c.confirmPhrase)).toEqual(["zinc-frost-amber", "onyx-ridge-ash", "birch-sable-aster"]);
  });

  test("the recovery rotation: the quorum rotates the enrolled set under the same prefix", async () => {
    const { inception, keys, offers } = await faceAndOffers();
    const r = await enrolRecoveryContacts({ selfRecoveryKey: await pubOf(seed(5)), head: inception, recoveryContacts: offers, threshold: 2, heldByOtherFaces: [], sign: signerOf(seed(11)) });
    if (!r.ok) throw new Error(r.reason);
    const fresh = `0x${await pubOf(seed(22))}`;
    const rot = await attestAndRotate({
      head: r.event, freshOpKeyDid: fresh, recoveryContactKeys: keys, recoveryThreshold: 2,
      recoveryContactSigners: [{ signer: keys[0]!, sign: signerOf(seed(1)) }, { signer: keys[2]!, sign: signerOf(seed(3)) }],
    });
    expect(rot.ok).toBe(true);
    if (!rot.ok) return;
    expect(rot.event.prefix).toBe(inception.prefix);
    expect(rot.event.eventCid).toBe("pkel2-6326b3816bff606d924759a88a61ed63c4ea8d4be8c301a7b1b861aa2a29f0ed");
    expect((await verifyPersonaKelFull([inception, r.event, rot.event])).ok).toBe(true);
    const one = await attestAndRotate({
      head: r.event, freshOpKeyDid: fresh, recoveryContactKeys: keys, recoveryThreshold: 2,
      recoveryContactSigners: [{ signer: keys[0]!, sign: signerOf(seed(1)) }],
    });
    expect(one.ok).toBe(false);
  });

  test("the domains that ride bytes", () => {
    expect([RECOVERY_CONTACT_REGISTRATION_DOMAIN, RECOVERY_CONTACT_POSSESSION_DOMAIN, CUSTODIAN_CONFIRM_DOMAIN, FACE_BUNDLE_DOMAIN, RECOVERY_CONTACT_ENROLMENT_KIND])
      .toEqual(["lar:///ha.ka.ba/lares/domain/recovery-contact-registration", "lar:///ha.ka.ba/lares/domain/recovery-contact-possession", "lar:///ha.ka.ba/lares/domain/custodian-confirm", "lar:///ha.ka.ba/lares/domain/face-bundle-recovery-contact-set", "recovery-contact-enrolment"]);
  });

  test("the face-log view's signed parties", () => {
    expect([...FACE_LOG_VIEW_PARTIES]).toEqual(["recovery-contact", "chair", "sibling"]);
  });
});
