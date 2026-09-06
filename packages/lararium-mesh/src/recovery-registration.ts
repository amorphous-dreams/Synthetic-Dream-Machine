/**
 * recovery-registration — the Fork-B guardian REGISTRATION, held apart from the Fork-A share card.
 *
 * ── THE TWO CUSTODIES ARE NOT CONFUSABLE (the IdenTrust cure) ────────────────────────────────────
 * A Fork-A guardian card carries a BEARER SHARE of a reconstructable secret; this registration carries
 * a guardian's recovery PUBLIC key and nothing else — a full read of it reconstructs nothing. IdenTrust
 * 2024 signed the wrong object type because one tool could select either; the earned cure splits the
 * objects so the wrong one is not selectable: this module, its own confirm DOMAIN (the phone handshake
 * cannot collide with a share card's), its own label stem, and a provisioning that accepts only this
 * type — never bare hex (`provisionThresholdRecoveryAtFounding`).
 *
 * Each guardian mints and custodies their OWN recovery keypair; the founding only COMMITS to the
 * public set (`sealKeySetHash`, folded into the persona-KEL prefix). No secret ever leaves a guardian.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/identity-classes (#the-two-forks)
 */

import { GUARDIAN_REGISTRATION_DOMAIN } from "./domains.js";
import { confirmationPhrase, type GuardianCardSlot } from "./guardian-card.js";

/** A guardian's recovery-pubkey registration — the Fork-B card. */
export interface GuardianRecoveryRegistration {
  readonly slot:           GuardianCardSlot;
  /** The human label ("Recovery-guardian-A (name)") — a stem one glance apart from a share card's. */
  readonly label:          string;
  /** The guardian's recovery PUBLIC key (64-hex) — what the founding pre-commit folds into its digest. */
  readonly recoveryPubKey: string;
  /** The out-of-band handshake phrase, under the REGISTRATION domain — never a share card's phrase. */
  readonly confirmPhrase:  string;
}

/** The registration handshake — same word-list machinery, its OWN domain, so the same material can
 *  never confirm as both a share and a registration over the phone. */
export function registrationConfirmationPhrase(recoveryPubKey: string): string {
  return confirmationPhrase(recoveryPubKey, GUARDIAN_REGISTRATION_DOMAIN);
}

/** Render a guardian's registration card. The guardian minted the keypair; the private half never
 *  reaches this vessel. */
export function guardianRecoveryRegistrationCard(
  slot:           GuardianCardSlot,
  recoveryPubKey: string,
  guardianName:   string | null,
): GuardianRecoveryRegistration {
  if (!/^[0-9a-f]{64}$/.test(recoveryPubKey)) {
    throw new Error("[recovery-registration] recovery pubkey must be 64-char lowercase hex");
  }
  const label = slot === "mine"
    ? "Recovery-guardian mine"
    : `Recovery-guardian-${slot === "guardian-a" ? "A" : "B"} (${guardianName ?? "unassigned"})`;
  return { slot, label, recoveryPubKey, confirmPhrase: registrationConfirmationPhrase(recoveryPubKey) };
}
