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

/** `card`: a founding's cold card to write on paper and type back (the place card); its lines ride the brokered port alone. */
export type CeremonyAskKind = "unlock" | "bind-first" | "clear" | "ward" | "card";

/**
 * THE RESET ASK (browser-vessel-lift#/the-reset): the page's own ask, never the vessel's. It carries no secret and no port, so
 * no broker moves it: the ceremony document reads its id off its own navigation (`#reset=<askId>`), checks it against the
 * record the asking page wrote (`reset-core.ts`: an id no page raised refuses `reset-unasked`), takes the holder's
 * confirmation through the confirm gate (`ceremony/critical-gate.ts`: a passphrase where this browser holds custody, typed
 * words at a bare floor), burns the place itself, and speaks to every tab of the origin on one BroadcastChannel. A tab
 * honours a signal only for an ask that record names (`reset-tab.ts`).
 */
export type PageAskKind = CeremonyAskKind | "reset";
export const RESET_CHANNEL = "lares:reset";
export type ResetSignal =
  /** The gate passed: every tab stands its vessel worker down, so no tab holds a store the burn deletes. */
  | { readonly t: "reset:stand-down"; readonly askId: string }
  /** The place burned: every tab clears its own session keys and boots afresh at the anon floor. */
  | { readonly t: "reset:burned"; readonly askId: string }
  /** The person declined: the ask's notice leaves the page, and nothing moved. */
  | { readonly t: "reset:declined"; readonly askId: string };

/**
 * THE CUSTODY PROOF (browser-vessel-lift#/the-confirm-gate): the ceremony document's own worker, spawned for one question and
 * ended with its answer. It reads the stores' slot trees and writes nothing; a passphrase reaches it as bytes on a
 * transferred buffer, and its answers name a count or a reading alone.
 */
export type ProofAsk =
  /** How many of these stores' slot trees read. */
  | { readonly t: "proof:read"; readonly stores: readonly string[] }
  /** Whether the passphrase on `bytes` (UTF-8) opens a slot tree in these stores. */
  | { readonly t: "proof:prove"; readonly stores: readonly string[]; readonly bytes: ArrayBuffer };
export type ProofAnswer =
  | { readonly t: "proof:readable"; readonly readable: number }
  | { readonly t: "proof:proved"; readonly reading: "opens" | "no-slot-opens" | "unverifiable" }
  | { readonly t: "proof:failed"; readonly why: string };

/** A passkey pin's public half: the authenticator's credential id and the PRF salt it evaluates. */
export interface CeremonyPasskey { readonly credentialId: Uint8Array; readonly prfSalt: Uint8Array }

/** The ask as the ceremony paints it: a public label and its digest, the face, the kind. Never a route, key or row; a card
 *  ask alone carries its card's printed lines, for the person to copy, on this brokered port and never to the page. */
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
  /** A card ask's printed card (its fields, its three code rows, its confirm phrase). Absent on every other ask. */
  readonly card?: readonly string[];
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
  /** A page its active broker controls not asks for the claim an activation would have made (`standCeremonyBroker`). */
  | { readonly t: "broker:claim" }
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
