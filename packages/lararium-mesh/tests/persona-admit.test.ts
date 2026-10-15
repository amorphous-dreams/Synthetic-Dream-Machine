/**
 * persona-admit.test.ts — the 3-hop persona-admission ceremony: a simulated device-to-device handoff between
 * two in-test vessels, plus the photograph-inert negatives (a captured QR grants nothing).
 *
 * Proven:
 *   · THE HAPPY 3-HOP — B enrolls → A seals a prefix-signed grant to B's ephemeral → B opens + ACKs → A verifies;
 *     both vessels end holding the SAME mutually-signed JoinRecord (dual-admission composed),
 *   · PHOTOGRAPH-INERT — a captured QR#2 opened WITHOUT B's ephemeral secret fails (decrypt), a captured QR#2
 *     replayed onto a FRESH enrollment fails (sealed to the old ephemeral), a tampered ciphertext fails,
 *   · ROTATE-NOT-RESURRECT — a grant whose op-key is NOT the persona prefix head is refused,
 *   · BINDINGS (§2a gate-removal v2+v3; `expiry` itself now RETIRED) — a wrong-vessel grant and a
 *     tampered/forged ACK refuse (fail-closed); none of the five wire shapes carries an `expiry` key at all,
 *     so no cross-party clock compare can ride back in through it; a tampered nonce_A still refuses (the
 *     decrypt-independent frame-match check), and an ACK carrying a different grantSig still refuses.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  mintEnrollmentOffer, sealPersonaGrant, openPersonaGrant, mintJoinAck, verifyJoinAck,
  ed25519SignerFromSeed,
  type PersonaRef, type EnrollmentOffer,
} from "../src/index.js";
import { hex, hexToBytes, utf8Bytes, canonicalJsonBytes, base64UrlEncode } from "../src/crypto.js";
import { sealToRecipient } from "../src/sealed-box.js";
import { PERSONA_ADMIT_SEAL_INFO, PERSONA_GRANT_DOMAIN, PERSONA_SEALED_DOMAIN } from "../src/domains.js";

const pubOf = (seed: Uint8Array) => ed.getPublicKeyAsync(seed).then(hex);

// A = the granting vessel (holds the persona op-key); B = the target vessel (holds its device key).
const A_PERSONA_SEED = new Uint8Array(32).fill(1);   // the persona's current op-key seed
const B_DEVICE_SEED  = new Uint8Array(32).fill(2);   // B's device key seed
const PERSONA_PREFIX = "EpersonaAID_prefix_0001";

/** A persona-KEL head resolver — the LOCAL replica read. Maps a prefix → its CURRENT op-key (rotate-not-resurrect). */
function headResolver(map: Record<string, string>) {
  return (prefix: string): string | null => map[prefix] ?? null;
}

async function fixtures() {
  const personaKey = await pubOf(A_PERSONA_SEED);   // A's persona current op-key
  const deviceKey  = await pubOf(B_DEVICE_SEED);    // B's device verifying key (targetVesselId)
  const personaRef: PersonaRef = { prefix: PERSONA_PREFIX, verifyingKey: personaKey };
  const personaSigner = ed25519SignerFromSeed(A_PERSONA_SEED);
  const deviceSigner  = ed25519SignerFromSeed(B_DEVICE_SEED);
  const resolveHeadOpKey = headResolver({ [PERSONA_PREFIX]: personaKey });
  return { personaKey, deviceKey, personaRef, personaSigner, deviceSigner, resolveHeadOpKey };
}

describe("persona-admit — the 3-hop ceremony", () => {
  test("THE HAPPY PATH: enroll → seal → open → ack → verify; both hold the SAME join record", async () => {
    const f = await fixtures();

    // 1. B enrolls (QR#1). The ephemeral SECRET stays with B; only the offer travels.
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    expect(offer.targetVesselId).toBe(f.deviceKey);

    // 2. A seals the grant to B's ephemeral pubkey (QR#2), signing with the persona prefix key.
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // 3. B opens + verifies against the prefix head.
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.accepted.transcript.personaRef.prefix).toBe(PERSONA_PREFIX);
    expect(opened.accepted.headOpKey).toBe(f.personaKey);

    // 4. B ACKs (QR#3), signing the join record with its device key.
    const { ack, joinRecord: bRecord } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });

    // 5. A verifies the ACK → A holds the matching mutually-signed record.
    const verified = await verifyJoinAck({ ack, sent });
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;

    // BOTH vessels hold the SAME mutually-signed join record (grantSig from A + ackSig from B).
    expect(verified.joinRecord).toEqual(bRecord);
    expect(verified.joinRecord.grantSig).toBe(sent.grantSig);
    expect(verified.joinRecord.targetVesselId).toBe(f.deviceKey);
    expect(verified.joinRecord.granterKey).toBe(f.personaKey);
  });

  test("PHOTOGRAPH-INERT: a captured QR#2 opened WITHOUT B's ephemeral secret fails (decrypt)", async () => {
    const f = await fixtures();
    const { offer } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // A photographer holds QR#1 (the offer) + QR#2 (the sealed grant) but NOT B's ephemeral secret. Reconstruct
    // an EnrollmentSecret with the offer's public fields but a FRESH (attacker) ephemeral — the seal never opens.
    const forgedSecret = { ...mintEnrollmentOffer({ targetVesselId: f.deviceKey }).secret, nonceB: offer.nonceB, targetVesselId: offer.targetVesselId };
    const verdict = await openPersonaGrant({ sealed, secret: forgedSecret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("decrypt-failed");
  });

  test("PHOTOGRAPH-INERT: a captured QR#2 replayed onto a FRESH enrollment fails (sealed to the old ephemeral)", async () => {
    const f = await fixtures();
    const first = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer: first.offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // B re-enrolls later (a new session → a new ephemeral + a new nonce_B). The OLD sealed grant cannot open
    // against the NEW secret — a replayed photograph is inert.
    const second = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const verdict = await openPersonaGrant({ sealed, secret: second.secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(verdict.ok).toBe(false);
  });

  test("PHOTOGRAPH-INERT: a tampered ciphertext byte fails the AEAD", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    // FLIP A DECODED BYTE, never an encoded character. The ciphertext rides base64url, where the FINAL
    // character carries trailing bits the decoder discards — so for some ciphertext lengths, rewriting
    // that character decodes to the very same bytes and the open correctly succeeds on untampered
    // material. The ciphertext ends differently every run (fresh ephemeral, fresh nonce), which is why
    // editing the string surfaced as a security assertion failing at random rather than as a bad probe.
    const raw = Buffer.from(sealed.ciphertext, "base64url");
    raw[0] = (raw[0] as number) ^ 0x01;                 // one bit, in a byte the AEAD certainly covers
    const flipped = raw.toString("base64url");
    expect(flipped).not.toBe(sealed.ciphertext);        // the probe proves it tampered before it asserts
    const verdict = await openPersonaGrant({ sealed: { ...sealed, ciphertext: flipped }, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(verdict.ok).toBe(false);
  });

  test("ROTATE-NOT-RESURRECT: a grant whose op-key is not the prefix head is refused", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // The persona ROTATED: the live head is now a DIFFERENT key than the grant's op-key. The old key cannot admit.
    const rotatedHead = await pubOf(new Uint8Array(32).fill(9));
    const verdict = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: headResolver({ [PERSONA_PREFIX]: rotatedHead }) });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("prefix head");
  });

  test("BINDING: an unresolvable prefix head refuses (fail-closed — never verify against a self-named key)", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    const verdict = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: () => null });
    expect(verdict.ok).toBe(false);
  });

  test("BINDING (§2a gate-removal, `expiry` RETIRED): none of the five wire shapes carries an `expiry` key", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    expect(Object.keys(offer)).not.toContain("expiry");
    expect(Object.keys(secret)).not.toContain("expiry");

    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    expect(Object.keys(sealed)).not.toContain("expiry");
    expect(Object.keys(sent.transcript)).not.toContain("expiry");

    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });
    expect(Object.keys(ack.joinRecord)).not.toContain("expiry");
  });

  test("BINDING: a third party's tampered cleartext nonce_A refuses — it rides the HKDF salt, so the AEAD refuses first", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // CONTROL: the genuine sealed grant still opens.
    const control = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(control.ok).toBe(true);

    // TAMPER: rewrite the CLEARTEXT nonce_A to a different (still well-formed) value. Because nonce_A rides the
    // HKDF salt, the AEAD decrypt refuses it before any later check runs. The frame-match check itself is proven
    // in isolation by the granter-crafted seal in the next test.
    const tampered = { ...sealed, nonceA: "ff".repeat(16) };
    const verdict = await openPersonaGrant({ sealed: tampered, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(verdict.ok).toBe(false);
  });

  test("BINDING: the frame-match check refuses a grant whose cleartext nonce_A keyed the seal but differs from the SIGNED one — isolated past the AEAD", async () => {
    // A granter-crafted seal: the frame's cleartext nonce_A (X) keys the HKDF salt, so the AEAD OPENS; the signed
    // transcript inside names a DIFFERENT nonce_A (Y), with a valid persona signature. Every other binding passes
    // (nonce_B echoes, target matches, the head signs), so ONLY `t.nonceA !== sealed.nonceA` stands between this
    // grant and an admit — drop that line and this test goes red (an ADMIT).
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const frameNonceA = "11".repeat(16), signedNonceA = "22".repeat(16);
    const transcript = { kind: PERSONA_GRANT_DOMAIN, personaRef: f.personaRef, targetVesselId: offer.targetVesselId, nonceB: offer.nonceB, nonceA: signedNonceA };
    const grantSig = await f.personaSigner(canonicalJsonBytes(transcript));
    const box = sealToRecipient({
      recipientPub: hexToBytes(offer.ephemeralPubkey), plaintext: canonicalJsonBytes({ transcript, grantSig }),
      info: utf8Bytes(PERSONA_ADMIT_SEAL_INFO), extraSalt: [hexToBytes(offer.nonceB), hexToBytes(frameNonceA)],
    });
    const sealed = {
      kind: PERSONA_SEALED_DOMAIN, senderEphemeralPubkey: hex(box.senderEphemeralPub), aeadNonce: hex(box.aeadNonce),
      nonceA: frameNonceA, ciphertext: base64UrlEncode(box.ciphertext),
    } as const;
    const verdict = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.reason).toContain("grant frame does not match the signed transcript");
  });

  test("BINDING: an ACK carrying a different grantSig than the sent memo still refuses", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    // CONTROL: the genuine ACK verifies.
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });
    expect((await verifyJoinAck({ ack, sent })).ok).toBe(true);

    // MUTATION: substitute a different (well-formed-looking) grantSig onto the join record — the ACK device
    // signature no longer covers THIS record (so it fails there too), and even setting that aside the
    // echo-check against the sent memo's OWN grantSig refuses it independently.
    const forgedAck = { ...ack, joinRecord: { ...ack.joinRecord, grantSig: "ff".repeat(64) } };
    expect((await verifyJoinAck({ ack: forgedAck, sent })).ok).toBe(false);
  });

  test("BINDING: a forged ACK (tampered target) fails A's verify; a mismatched sent memo fails too", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });

    // Tamper the join record's target — the ACK signature no longer covers it → refuse.
    const tampered = { ...ack, joinRecord: { ...ack.joinRecord, targetVesselId: "ff".repeat(32) } };
    expect((await verifyJoinAck({ ack: tampered, sent })).ok).toBe(false);

    // A valid ACK checked against a DIFFERENT sent memo (a grant A never issued) → refuse.
    const otherSent = { ...sent, transcript: { ...sent.transcript, nonceA: "00".repeat(16) } };
    expect((await verifyJoinAck({ ack, sent: otherSent })).ok).toBe(false);

    // The genuine pairing still verifies.
    expect((await verifyJoinAck({ ack, sent })).ok).toBe(true);
  });

  test("M12: a supplied resolveHeadSeq rides ADVISORY into headOpKeySeq / JoinRecord.granterSeq, never the verdict", async () => {
    const f = await fixtures();
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner });

    // CONTROL — no resolveHeadSeq supplied: the verdict still admits, and carries no seq (the per-vessel view
    // falls back to its nonce-only tiebreak; nothing here regresses the un-resolved case).
    const noSeq = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey });
    expect(noSeq.ok).toBe(true);
    if (noSeq.ok) expect(noSeq.accepted.headOpKeySeq).toBeUndefined();

    // A resolveHeadSeq that THROWS or returns null never touches the verdict (advisory-only, fail-soft).
    const throwing = await openPersonaGrant({
      sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey,
      resolveHeadSeq: () => { throw new Error("advisory resolver fault"); },
    });
    expect(throwing.ok).toBe(true);
    if (throwing.ok) expect(throwing.accepted.headOpKeySeq).toBeUndefined();

    // A resolveHeadSeq that resolves a number rides into headOpKeySeq, then into the JoinRecord's granterSeq
    // through mintJoinAck — the SAME seq, carried verbatim, never recomputed from a clock.
    const opened = await openPersonaGrant({
      sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey, resolveHeadSeq: () => 7,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.accepted.headOpKeySeq).toBe(7);
    const { ack, joinRecord } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });
    expect(joinRecord.granterSeq).toBe(7);

    // The seq rides as an UNCHECKED field in the ACK's echo-verify — A still accepts (it carries no security
    // weight; `verifyJoinAck` never compares it against the sent memo, which predates M12 and has no opinion).
    const verified = await verifyJoinAck({ ack, sent });
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.joinRecord.granterSeq).toBe(7);
  });

  test("TYPE-BLIND: the same code path admits a 'user' persona with no branch on type", async () => {
    // A different persona seed / prefix — nothing in the ceremony reads a 'type'; the path is identical.
    const userSeed = new Uint8Array(32).fill(7);
    const userKey  = await pubOf(userSeed);
    const userRef: PersonaRef = { prefix: "EuserAID_9", verifyingKey: userKey };
    const deviceKey = await pubOf(B_DEVICE_SEED);

    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: deviceKey });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: userRef, personaSigner: ed25519SignerFromSeed(userSeed) });
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: headResolver({ "EuserAID_9": userKey }) });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: ed25519SignerFromSeed(B_DEVICE_SEED) });
    expect((await verifyJoinAck({ ack, sent })).ok).toBe(true);
  });
});

// Silence an unused-import lint if the offer type is only referenced structurally above.
export type _OfferRef = EnrollmentOffer;
