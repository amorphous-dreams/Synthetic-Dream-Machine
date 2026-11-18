/**
 * recovery-registration — THE TWO CUSTODIES ARE NOT CONFUSABLE (the IdenTrust cure, ruling 2).
 *
 * A Fork-A recovery contact card carries a BEARER SHARE of a reconstructable secret; a Fork-B registration
 * carries a recovery contact's recovery PUBLIC key. IdenTrust 2024 signed the wrong object type because one
 * tool could select either — the earned cure splits the objects so the wrong one is not selectable:
 * two modules, two confirm DOMAINS (the phone handshake cannot collide), two label stems, and a
 * provisioning that accepts only typed registrations, never bare hex.
 */
import { describe, test, expect } from "vitest";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hex } from "../src/crypto.js";
import { splitToCustodianCards, confirmationPhrase } from "../src/custodian-card.js";
import {
  recoveryContactRegistrationCard, registrationConfirmationPhrase,
  type RecoveryContactRegistration,
} from "../src/recovery-registration.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";

// A registration seats a REAL key: the card door refuses a value that names no lawful Ed25519 key.
const pubOf = (n: number): string => hex(ed25519.getPublicKey(new Uint8Array(32).fill(n)));
const PUB = pubOf(1);

function counterRng(): { getRandomValues: (b: Uint8Array) => Uint8Array } {
  let c = 0;
  return { getRandomValues: (b: Uint8Array) => { b.fill(++c); return b; } };
}

describe("the two custodies are not confusable", () => {
  test("★ the SAME material yields DIFFERENT phrases under the two domains — the phone handshake cannot collide ★", () => {
    expect(registrationConfirmationPhrase(PUB)).not.toBe(confirmationPhrase(PUB));
  });

  test("a registration carries a pubkey and NO share; rejects non-hex; label stem names the registration", () => {
    const card = recoveryContactRegistrationCard("contact-a", PUB, "Alice");
    expect(card.recoveryPubKey).toBe(PUB);
    expect(card).not.toHaveProperty("shareCode");
    expect(card.confirmPhrase).toBe(registrationConfirmationPhrase(PUB));
    expect(card.label).toMatch(/^Recovery-contact-A/);
    expect(() => recoveryContactRegistrationCard("mine", "nothex", null)).toThrow(/hex/);
  });

  test("★ the provisioning accepts only TYPED registrations — the pre-commit derives from cards, never bare hex ★", () => {
    const regs: RecoveryContactRegistration[] = [
      recoveryContactRegistrationCard("mine", pubOf(2), null),
      recoveryContactRegistrationCard("contact-a", pubOf(3), "Alice"),
      recoveryContactRegistrationCard("contact-b", pubOf(4), "Bob"),
    ];
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${pubOf(5)}`, recoveryContacts: regs, recoveryThreshold: 2,
    });
    expect(prov.inception.recoverySetHash).not.toBe("");
    expect(prov.recoveryThreshold).toBe(2);
  });

  test("a share card's label stem differs from a registration's — one glance tells them apart", () => {
    const shares = splitToCustodianCards(new Uint8Array(32).fill(5), "Alice", "Bob", 0, counterRng());
    expect(shares.cards[0]!.label).toMatch(/^Recovery-card /);
    const reg = recoveryContactRegistrationCard("contact-a", PUB, "Alice");
    expect(reg.label).toMatch(/^Recovery-contact-/);
  });
});
