/**
 * ceremony-protocol — the typed messages of the unlock ceremony (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
 *
 * Three roads, one ask:
 *   page → broker      `ceremony:offer{askId}` with one end of a fresh MessageChannel (the other end goes to the vessel worker)
 *   ceremony → broker  `ceremony:claim{askId}`; the broker answers `ceremony:port{askId}` with that end, or `ceremony:absent`
 *   vessel ⇄ ceremony  on the brokered port: the vessel's public `ask`, the ceremony's `answer` (the secret's bytes on a
 *                      transferred ArrayBuffer), the vessel's `settled`
 *
 * The broker (the service worker) moves the port and never reads it; the surface page mints the channel and keeps neither
 * end. Types alone: this module loads nothing.
 */

/** What the ceremony may take for this ask. The ward takes a passphrase alone; a bind-first takes a passphrase alone. */
export type CeremonyRoute = "passphrase" | "passkey";

export type CeremonyAskKind = "unlock" | "bind-first" | "clear" | "ward";

/** A passkey pin's public half: the authenticator's credential id and the PRF salt it evaluates. */
export interface CeremonyPasskey { readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array }

/** The ask as the ceremony paints it: a public label and its digest, the face, the kind. Never a route, key, seed or row. */
export interface CeremonyAsk {
  readonly t: "ask";
  readonly askId: string;
  readonly kind: CeremonyAskKind;
  /** The act's public label (`boot`, `a kāpae-lower`, `a commit in daemon`). */
  readonly act: string;
  /** The SHA-256 hex of the ask's public words (`askId`, `kind`, `act`), so the person can match what two surfaces name. */
  readonly digest: string;
  /** The face the ask speaks for, where the vessel knows one; null names this browser itself. */
  readonly face: string | null;
  readonly routes: readonly CeremonyRoute[];
  readonly passkeys: readonly CeremonyPasskey[];
  /** Public words: an attempt count, a note. */
  readonly words: string;
}

/** The ceremony's answer. Every byte rides a transferred ArrayBuffer, so it detaches from the ceremony's heap as it leaves. */
export type CeremonyAnswer =
  | { readonly kind: "passphrase"; readonly bytes: ArrayBuffer }
  | { readonly kind: "passkey"; readonly credentialId: ArrayBuffer; readonly prfOutput: ArrayBuffer }
  | null;

export type VesselToCeremony =
  | CeremonyAsk
  | { readonly t: "settled"; readonly askId: string }
  | { readonly t: "refused"; readonly askId: string; readonly refusal: string };

export type CeremonyToVessel = { readonly t: "answer"; readonly askId: string; readonly answer: CeremonyAnswer };

export type PageToBroker =
  | { readonly t: "ceremony:offer"; readonly askId: string }
  | { readonly t: "vessel:claim"; readonly tabSession: string }
  | { readonly t: "vessel:withdraw"; readonly tabSession: string }
  | { readonly t: "vessel:offer"; readonly claimId: string };
export type BrokerToPage =
  | { readonly t: "vessel:want"; readonly claimId: string; readonly tabSession: string }
  | { readonly t: "vessel:port"; readonly tabSession: string }
  | { readonly t: "vessel:absent"; readonly tabSession: string }
  | { readonly t: "vessel:absent"; readonly claimId: string };
export type CeremonyToBroker = { readonly t: "ceremony:claim"; readonly askId: string };
export type BrokerToCeremony =
  | { readonly t: "ceremony:port"; readonly askId: string }
  | { readonly t: "ceremony:absent"; readonly askId: string };

/** The broker's script and the ceremony document's path, as the page and the Pronaos serve them. */
export const CEREMONY_BROKER_PATH = "/ceremony-broker.js";
export const CEREMONY_DOCUMENT_PATH = "/ceremony.html";
