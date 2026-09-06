/**
 * recovery-registration — THE TWO CUSTODIES ARE NOT CONFUSABLE (the IdenTrust cure, ruling 2).
 *
 * A Fork-A guardian card carries a BEARER SHARE of a reconstructable secret; a Fork-B registration
 * carries a guardian's recovery PUBLIC key. IdenTrust 2024 signed the wrong object type because one
 * tool could select either — the earned cure splits the objects so the wrong one is not selectable:
 * two modules, two confirm DOMAINS (the phone handshake cannot collide), two label stems, and a
 * provisioning that accepts only typed registrations, never bare hex.
 */
import { describe, test, expect } from "vitest";
import { splitToGuardianCards, confirmationPhrase } from "../src/guardian-card.js";
import {
  guardianRecoveryRegistrationCard, registrationConfirmationPhrase,
  type GuardianRecoveryRegistration,
} from "../src/recovery-registration.js";
import { provisionThresholdRecoveryAtFounding } from "../src/recovery-keel-core.js";

const PUB = "ab".repeat(32);

function counterRng(): { getRandomValues: (b: Uint8Array) => Uint8Array } {
  let c = 0;
  return { getRandomValues: (b: Uint8Array) => { b.fill(++c); return b; } };
}

describe("the two custodies are not confusable", () => {
  test("★ the SAME material yields DIFFERENT phrases under the two domains — the phone handshake cannot collide ★", () => {
    expect(registrationConfirmationPhrase(PUB)).not.toBe(confirmationPhrase(PUB));
  });

  test("a registration carries a pubkey and NO share; rejects non-hex; label stem names the registration", () => {
    const card = guardianRecoveryRegistrationCard("guardian-a", PUB, "Alice");
    expect(card.recoveryPubKey).toBe(PUB);
    expect(card).not.toHaveProperty("shareCode");
    expect(card.confirmPhrase).toBe(registrationConfirmationPhrase(PUB));
    expect(card.label).toMatch(/^Recovery-guardian-A/);
    expect(() => guardianRecoveryRegistrationCard("mine", "nothex", null)).toThrow(/hex/);
  });

  test("★ the provisioning accepts only TYPED registrations — the pre-commit derives from cards, never bare hex ★", () => {
    const regs: GuardianRecoveryRegistration[] = [
      guardianRecoveryRegistrationCard("mine", "aa".repeat(32), null),
      guardianRecoveryRegistrationCard("guardian-a", "bb".repeat(32), "Alice"),
      guardianRecoveryRegistrationCard("guardian-b", "cc".repeat(32), "Bob"),
    ];
    const prov = provisionThresholdRecoveryAtFounding({
      foundingOpKeyDid: `0x${"dd".repeat(32)}`, guardians: regs, recoveryThreshold: 2,
    });
    expect(prov.inception.recoverySetHash).not.toBe("");
    expect(prov.recoveryThreshold).toBe(2);
  });

  test("a share card's label stem differs from a registration's — one glance tells them apart", () => {
    const shares = splitToGuardianCards(new Uint8Array(32).fill(5), "Alice", "Bob", 0, counterRng());
    expect(shares.cards[0]!.label).toMatch(/^Recovery-card /);
    const reg = guardianRecoveryRegistrationCard("guardian-a", PUB, "Alice");
    expect(reg.label).toMatch(/^Recovery-guardian-/);
  });
});
