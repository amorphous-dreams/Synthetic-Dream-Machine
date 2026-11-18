/**
 * recovery-registration — the Fork-B recovery contact REGISTRATION, held apart from the Fork-A share card.
 *
 * ── THE TWO CUSTODIES ARE NOT CONFUSABLE (the IdenTrust cure) ────────────────────────────────────
 * A Fork-A custodian card carries a BEARER SHARE of a reconstructable secret; this registration carries
 * a recovery contact's recovery PUBLIC key and nothing else — a full read of it reconstructs nothing. IdenTrust
 * 2024 signed the wrong object type because one tool could select either; the earned cure splits the
 * objects so the wrong one is not selectable: this module, its own confirm DOMAIN (the phone handshake
 * cannot collide with a share card's), its own label stem, and a provisioning that accepts only this
 * type — never bare hex (`provisionThresholdRecoveryAtFounding`).
 *
 * Each recovery contact mints and custodies their OWN recovery keypair; the founding only COMMITS to the
 * public set (`sealKeySetHash`, folded into the persona-KEL prefix). No secret ever leaves a recovery contact.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/identity-classes (#the-two-forks)
 */

import { RECOVERY_CONTACT_REGISTRATION_DOMAIN } from "./domains.js";
import { acceptEd25519Key } from "./ed25519-door.js";
import { confirmationPhrase } from "./custodian-card.js";

/** Which seat a registration card fills: the face's own, or one of the three recovery contacts (a, b, c). */
export type RecoveryContactSlot = "mine" | "contact-a" | "contact-b" | "contact-c";

/** A recovery contact's recovery-pubkey registration — the Fork-B card. */
export interface RecoveryContactRegistration {
  readonly slot:           RecoveryContactSlot;
  /** The human label ("Recovery-contact-A (name)") — a stem one glance apart from a share card's. */
  readonly label:          string;
  /** The recovery contact's recovery PUBLIC key (64-hex) — what the founding pre-commit folds into its digest. */
  readonly recoveryPubKey: string;
  /** The out-of-band handshake phrase, under the REGISTRATION domain — never a share card's phrase. */
  readonly confirmPhrase:  string;
}

/** The registration handshake — same word-list machinery, its OWN domain, so the same material can
 *  never confirm as both a share and a registration over the phone. */
export function registrationConfirmationPhrase(recoveryPubKey: string): string {
  return confirmationPhrase(recoveryPubKey, RECOVERY_CONTACT_REGISTRATION_DOMAIN);
}

/** Render a recovery contact's registration card. The recovery contact minted the keypair; the private half never
 *  reaches this vessel. */
export function recoveryContactRegistrationCard(
  slot:           RecoveryContactSlot,
  recoveryPubKey: string,
  recoveryContactLabel:   string | null,
): RecoveryContactRegistration {
  if (!/^[0-9a-f]{64}$/.test(recoveryPubKey)) {
    throw new Error("[recovery-registration] recovery pubkey must be 64-char lowercase hex");
  }
  // A recovery contact key enters the set HERE: a small-order key holds no secret, so everyone would attest as that recovery contact.
  const accepted = acceptEd25519Key(recoveryPubKey);
  if (!accepted.ok) throw new Error(`[recovery-registration] recovery-contact-key-refused — the recovery pubkey refuses at the Ed25519 door (${accepted.refusal})`);
  const label = slot === "mine"
    ? "Recovery-contact mine"
    : `Recovery-contact-${slot === "contact-a" ? "A" : slot === "contact-b" ? "B" : "C"} (${recoveryContactLabel ?? "unassigned"})`;
  return { slot, label, recoveryPubKey, confirmPhrase: registrationConfirmationPhrase(recoveryPubKey) };
}
