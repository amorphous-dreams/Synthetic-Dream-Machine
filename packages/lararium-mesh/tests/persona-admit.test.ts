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
 *   · BINDINGS (§2a gate-removal v2+v3) — a wrong-vessel grant and a tampered/forged ACK refuse (fail-closed);
 *     an EXPIRED grant now OPENS at B's `open` step (v2) AND A still SEALS onto an already-expired offer (v3
 *     — the cross-party compare, B's stamped expiry judged by A's clock, is gone too), proven under a
 *     set-back AND a set-forward clock alongside the causal gates that still refuse.
 */
import { describe, test, expect } from "vitest";
import * as ed from "@noble/ed25519";
import {
  mintEnrollmentOffer, sealPersonaGrant, openPersonaGrant, mintJoinAck, verifyJoinAck,
  ed25519SignerFromSeed,
  type PersonaRef, type EnrollmentOffer,
} from "../src/index.js";
import { hex } from "../src/crypto.js";

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
    const forgedSecret = { ...mintEnrollmentOffer({ targetVesselId: f.deviceKey }).secret, nonceB: offer.nonceB, targetVesselId: offer.targetVesselId, expiry: offer.expiry };
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

  test("BINDING (§2a gate-removal v2): an expired grant now OPENS — the wall clock decides nothing here any\n" +
       "    more; decrypt, nonce-echo, prefix-head and ACK-signature still refuse, under a set-back AND a\n" +
       "    set-forward clock alike", async () => {
    const f = await fixtures();
    const mintedAt = 1_000_000;
    const { offer, secret } = mintEnrollmentOffer({ targetVesselId: f.deviceKey, now: mintedAt });
    const { sealed, sent } = await sealPersonaGrant({ offer, personaRef: f.personaRef, personaSigner: f.personaSigner, now: mintedAt });

    // CONTROL (set-FORWARD): opened an hour past the OLD expiry window — the retired gate used to refuse
    // this; the held-session shape (the CLI's own patience, auto-withdrawing on its own liveness) is what
    // now decides whether a grant is still live, and `openPersonaGrant` itself admits it.
    const forward = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt + 3600_000 });
    expect(forward.ok).toBe(true);

    // CONTROL (set-BACK): a clock set BEFORE the grant was even minted admits identically — proving no
    // residual comparison against `now` survives anywhere in this path (a set-back that still refused
    // would mean a comparison the removal missed).
    const back = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt - 3600_000 });
    expect(back.ok).toBe(true);

    // MUTATION 1 — decrypt still refuses under EITHER clock: a tampered ciphertext byte fails the AEAD
    // regardless of how `now` is set, because nothing in that gate ever read a clock.
    const raw = Buffer.from(sealed.ciphertext, "base64url");
    raw[0] = (raw[0] as number) ^ 0x01;
    const tamperedCiphertext = { ...sealed, ciphertext: raw.toString("base64url") };
    expect((await openPersonaGrant({ sealed: tamperedCiphertext, secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt + 3600_000 })).ok).toBe(false);
    expect((await openPersonaGrant({ sealed: tamperedCiphertext, secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt - 3600_000 })).ok).toBe(false);

    // MUTATION 2 — nonce-echo still refuses under either clock: a DIFFERENT enrollment's secret (a fresh
    // nonce_B) cannot open this grant, set-forward or set-back.
    const other = mintEnrollmentOffer({ targetVesselId: f.deviceKey, now: mintedAt });
    expect((await openPersonaGrant({ sealed, secret: other.secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt + 3600_000 })).ok).toBe(false);
    expect((await openPersonaGrant({ sealed, secret: other.secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt - 3600_000 })).ok).toBe(false);

    // MUTATION 3 — prefix-head (rotate-not-resurrect) still refuses under either clock: a rotated head
    // refuses the old grant's op-key regardless of when the clock reads.
    const rotatedHead = await pubOf(new Uint8Array(32).fill(9));
    const rotated = headResolver({ [PERSONA_PREFIX]: rotatedHead });
    expect((await openPersonaGrant({ sealed, secret, resolveHeadOpKey: rotated, now: mintedAt + 3600_000 })).ok).toBe(false);
    expect((await openPersonaGrant({ sealed, secret, resolveHeadOpKey: rotated, now: mintedAt - 3600_000 })).ok).toBe(false);

    // MUTATION 4 — ACK-signature still refuses under either clock: the open itself still succeeds (proven
    // above), but a TAMPERED join record (the ACK stage, downstream of open) fails A's verify no matter
    // when either clock reads — the ACK path never read a clock either, before or after this removal.
    const opened = await openPersonaGrant({ sealed, secret, resolveHeadOpKey: f.resolveHeadOpKey, now: mintedAt + 3600_000 });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { ack } = await mintJoinAck({ accepted: opened.accepted, secret, deviceSigner: f.deviceSigner });
    const tamperedAck = { ...ack, joinRecord: { ...ack.joinRecord, targetVesselId: "ff".repeat(32) } };
    expect((await verifyJoinAck({ ack: tamperedAck, sent, now: mintedAt + 3600_000 })).ok).toBe(false);
    expect((await verifyJoinAck({ ack: tamperedAck, sent, now: mintedAt - 3600_000 })).ok).toBe(false);
  });

  test("BINDING (§2a gate-removal v3): A still SEALS a grant onto an offer whose own expiry has already\n" +
       "    passed — under a set-back AND a set-forward clock alike — while causal refusals (malformed target,\n" +
       "    malformed persona ref) still refuse", async () => {
    const f = await fixtures();
    const mintedAt = 1_000_000;
    const { offer } = mintEnrollmentOffer({ targetVesselId: f.deviceKey, now: mintedAt, expiryMs: 1_000 });
    // The offer's own window has already closed by the time A seals — this is EXACTLY the cross-party
    // compare the retired gate made: B's stamped `offer.expiry` judged against A's `now`.
    expect(offer.expiry).toBeLessThan(mintedAt + 3600_000);

    // CONTROL (set-FORWARD): A seals an hour after B's offer expired. The retired gate (`persona-admit.ts`
    // `sealPersonaGrant`) used to throw "enrollment offer has expired" here; it no longer does.
    const forward = await sealPersonaGrant({
      offer, personaRef: f.personaRef, personaSigner: f.personaSigner, now: mintedAt + 3600_000,
    });
    expect(forward.sealed.kind).toBeDefined();

    // CONTROL (set-BACK): A's clock set BEFORE the offer was even minted seals identically — proving no
    // residual `now`-vs-`expiry` comparison survives anywhere in `sealPersonaGrant` (a set-back that still
    // threw would mean a comparison the removal missed).
    const back = await sealPersonaGrant({
      offer, personaRef: f.personaRef, personaSigner: f.personaSigner, now: mintedAt - 3600_000,
    });
    expect(back.sealed.kind).toBeDefined();

    // MUTATION — a causal (non-clock) refusal in `sealPersonaGrant` still refuses, under either clock
    // direction: a malformed `targetVesselId` on the offer, and a malformed `personaRef.verifyingKey`.
    const malformedOffer = { ...offer, targetVesselId: "not-hex" };
    await expect(sealPersonaGrant({
      offer: malformedOffer, personaRef: f.personaRef, personaSigner: f.personaSigner, now: mintedAt + 3600_000,
    })).rejects.toThrow(/targetVesselId malformed/);
    await expect(sealPersonaGrant({
      offer: malformedOffer, personaRef: f.personaRef, personaSigner: f.personaSigner, now: mintedAt - 3600_000,
    })).rejects.toThrow(/targetVesselId malformed/);

    const malformedRef = { ...f.personaRef, verifyingKey: "not-hex" };
    await expect(sealPersonaGrant({
      offer, personaRef: malformedRef, personaSigner: f.personaSigner, now: mintedAt + 3600_000,
    })).rejects.toThrow(/verifyingKey must be 64-hex/);
    await expect(sealPersonaGrant({
      offer, personaRef: malformedRef, personaSigner: f.personaSigner, now: mintedAt - 3600_000,
    })).rejects.toThrow(/verifyingKey must be 64-hex/);
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
