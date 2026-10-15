/**
 * session-face — THE ONE SUPPLIER of the face a session wears.
 *
 * A session's `face` holds five references: the PersonaGroup, the proof subject, the verified admit, the
 * causal revision the relation stood at, and the absolute ids of the four planes
 * (`session-contract`). This module builds that value from one verified chain and three readings it joins
 * to that chain, or refuses by name:
 *
 *   · THIS VESSEL'S VERIFIED CHAIN, minted by `checkVesselChain` alone: the face key's certificate over the
 *     vessel's face-scoped key, with no learned denial of that key. It holds no session key: a session
 *     opens on the face this supplier answers, and its signer mints the session's key after the open;
 *   · THIS VESSEL'S OWN KEY for that face, as its custody row names it: a chain another vessel presented
 *     verifies as well as this vessel's own, and only this vessel's chain opens a session here;
 *   · the ADMIT'S VERDICT, as the one held-root door reads it (`readAdmitAtHeldRoot`): the Nexus's quorum
 *     admitted this nym, the relation reads `held`, and the HEAD of the nym's key line names the face key. The
 *     nym stays the anchor the Nexus admitted; a face re-issued by a signed hand-over answers at the head;
 *   · the PRIVATE GRANT: the PersonaGroup's own root-authorized record that this face key speaks for the
 *     group at this Nexus.
 *
 * The supplier JOINS them: one face key and one Nexus across all three, or a refusal that names which
 * reading stood apart. It derives the proof subject and the four planes; it accepts none from a caller, so a
 * plane address a caller supplies grants nothing.
 *
 * What it cannot check, and says so: a chain carries its minter's own mark, and nothing spelled by hand
 * passes for one. The vessel's own key, an admit's verdict and a private grant carry no such mark here: this
 * function JOINS them and verifies none of them. The custody seat and the two readers that produced them
 * owe the verification, and the caller owes the reads: a caller that spells one by hand breaks the contract
 * this function states. It supplies a face; it stands as no verifier of an admit or of a grant.
 *
 * `supplySessionFace` stays pure: no key, no I/O, no timer, no clock. `openJoinedFaceSession` composes it for a
 * vessel the fleet-join door joined: the chain checked over the vessel's own certificate, the face supplied,
 * then the session opened and its signer minted through `openSignedSession`. The node's joined-face proof
 * (`readJoinedFaceProof`) supplies its vessel-side inputs; the dial that holds the table lands at the socket
 * cutover, and the browser holder stays owed.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/what-a-session-carries
 */
import type { PresentedAdmitVerdict } from "./carriage-registry.js";
import {
  checkVesselChain, isVerifiedVesselChain,
  type FaceChainRefusal, type VerifiedVesselChain, type VesselFaceKeyCustody, type WithdrawalMemory,
} from "./face-authority.js";
import type { RandomProvider } from "./crypto.js";
import { faceProofSubjectRef, type FaceProofRefusal, type FaceScope, type KeysHeldApart } from "./face-proof-subjects.js";
import { personaScopedBagIds } from "./persona-scope.js";
import { validateSessionFace, type Session, type SessionBinding, type SessionFace, type SessionTable } from "./session-contract.js";
import { openSignedSession, type SessionSigner, type SessionSignerRefusal } from "./session-signer.js";

/** The admit a face rides at one Nexus, as its verifier read it. */
export interface FaceAdmitReading {
  /** The presenter-verifier's own verdict over the admit and its lineage. */
  readonly verdict:  PresentedAdmitVerdict;
  /** The Nexus whose quorum signed the admit. */
  readonly nexus:    string;
  /** The admit act's own content id. */
  readonly admitRef: string;
  /** The causal position the verdict got read at: the heads the verifier folded. */
  readonly revision: string;
  /** The key the face must hold: the head of the admitted nym's line at that Nexus (the nym itself where no
   *  hand-over stands). */
  readonly head:     string;
}

/** The PersonaGroup's private, root-authorized record that one face key speaks for it at one Nexus. */
export interface FaceGrantReading {
  /** The PersonaGroup's own document id, lower-case hex as Keyhive spells it, its `0x` kept: the planes derive
   *  from the id's exact text, so a stripped prefix names other planes. */
  readonly personaGroup: string;
  readonly faceKey:      string;
  readonly nexus:        string;
  /** The causal position of the group's private authority history the record got read at. */
  readonly revision:     string;
}

export const SESSION_FACE_REFUSALS = [
  "chain-unverified",       // no value `checkVesselChain` minted
  "chain-other-vessel",     // the chain's vessel key names another key than this vessel's custody row
  "admit-malformed",
  "admit-not-held",         // the admit reads denied, unsettled, rejected or at a wrong epoch; `state` names which
  "admit-other-face",       // the head of the admitted nym's key line names another key than the chain's face key
  "admit-other-nexus",
  "grant-malformed",
  "grant-other-face",       // the private grant names another face key than the chain's
  "grant-other-nexus",
] as const;
export type SessionFaceRefusalName = (typeof SESSION_FACE_REFUSALS)[number];
export type SessionFaceSupply =
  | { readonly face: SessionFace }
  | { readonly refusal: SessionFaceRefusalName; readonly state?: string };

/** A reference: printable ASCII with no space and no bar, so a revision joins three of them unambiguously. */
const REFERENCE = /^[\x21-\x7b\x7d\x7e]{1,512}$/;
const PERSONA_GROUP = /^(?:0x)?(?:[0-9a-f]{2}){4,64}$/;
const reference = (value: unknown): value is string => typeof value === "string" && REFERENCE.test(value);

/** An OWN field of a record, read once; `undefined` where the record holds none. A prototype supplies nothing. */
function field(record: object, key: string): unknown {
  return Object.hasOwn(record, key) ? (record as Record<string, unknown>)[key] : undefined;
}

interface ReadAdmit { state: string; head: string; nexus: string; admitRef: string; revision: string }
function readAdmit(value: unknown): ReadAdmit | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const [verdict, head, nexus, admitRef, revision] =
      [field(value, "verdict"), field(value, "head"), field(value, "nexus"), field(value, "admitRef"), field(value, "revision")];
    if (typeof verdict !== "object" || verdict === null) return null;
    const state = field(verdict, "state");
    if (typeof state !== "string" || typeof head !== "string") return null;
    if (!reference(nexus) || !reference(admitRef) || !reference(revision)) return null;
    return { state, head, nexus, admitRef, revision };
  } catch { return null; }
}

function readGrant(value: unknown): FaceGrantReading | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const [personaGroup, faceKey, nexus, revision] = [field(value, "personaGroup"), field(value, "faceKey"), field(value, "nexus"), field(value, "revision")];
    if (typeof personaGroup !== "string" || !PERSONA_GROUP.test(personaGroup)) return null;
    if (typeof faceKey !== "string" || !reference(nexus) || !reference(revision)) return null;
    return { personaGroup, faceKey, nexus, revision };
  } catch { return null; }
}

/**
 * The causal revision a face's relation stood at: the admit's position, the private grant's position and
 * the withdrawal frontier the chain got checked at. One string, three references: a session opened at
 * another position of any of the three wears another revision.
 */
export function sessionFaceRevision(chain: VerifiedVesselChain, admit: Pick<FaceAdmitReading, "revision">, grant: Pick<FaceGrantReading, "revision">): string {
  return `admit:${admit.revision}|grant:${grant.revision}|withdrawal:${chain.frontier.position}:${chain.frontier.head}`;
}

/**
 * Supply the face a session wears, or a named refusal.
 *
 * `vesselFaceKey` names the public half of the key this vessel's custody holds for the face.
 *
 * The order of reading: the chain's mark, the chain against this vessel's own key, the admit's shape and
 * standing, the admit against the chain, the grant's shape, the grant against the chain. The first fault
 * names the refusal, and a refusal supplies nothing.
 */
export function supplySessionFace(input: { chain: unknown; vesselFaceKey: unknown; admit: unknown; grant: unknown }): SessionFaceSupply {
  let taken: { chain: unknown; vesselFaceKey: unknown; admit: unknown; grant: unknown };
  try { taken = { chain: input.chain, vesselFaceKey: input.vesselFaceKey, admit: input.admit, grant: input.grant }; }
  catch { return { refusal: "chain-unverified" }; }
  const { chain } = taken;
  if (!isVerifiedVesselChain(chain)) return { refusal: "chain-unverified" };
  if (typeof taken.vesselFaceKey !== "string" || taken.vesselFaceKey !== chain.vesselFaceKey) return { refusal: "chain-other-vessel" };

  const admit = readAdmit(taken.admit);
  if (admit === null) return { refusal: "admit-malformed" };
  if (admit.state !== "held") return { refusal: "admit-not-held", state: admit.state };
  // THE ADMITTED NYM ANCHORS; THE LINE'S HEAD ANSWERS. The admit keeps naming the key the Nexus admitted, and a
  // face re-issued by a signed hand-over holds the head of that key's line, as the gate reads it (`face-gate`).
  if (admit.head !== chain.scope.faceKey) return { refusal: "admit-other-face" };
  if (admit.nexus !== chain.scope.nexus) return { refusal: "admit-other-nexus" };

  const grant = readGrant(taken.grant);
  if (grant === null) return { refusal: "grant-malformed" };
  if (grant.faceKey !== chain.scope.faceKey) return { refusal: "grant-other-face" };
  if (grant.nexus !== chain.scope.nexus) return { refusal: "grant-other-nexus" };

  const face = validateSessionFace({
    personaGroup:   grant.personaGroup,
    proofSubject:   faceProofSubjectRef(chain.scope),
    admitRef:       admit.admitRef,
    causalRevision: sessionFaceRevision(chain, admit, grant),
    planes:         personaScopedBagIds(grant.personaGroup),
  });
  // Every field above reads non-empty, so the validator refuses only a contract that moved under this module.
  if (face === null) throw new Error("session-face: the supplied face fails the session contract's own reader");
  return { face };
}

/** Why a joined vessel's session stayed shut: its chain, its face, or its open. */
export type JoinedFaceSessionRefusal =
  | { readonly refusal: "chain-refused"; readonly verdict: "withdrawn" | "incomplete" | "forked" | "invalid"; readonly cause?: FaceChainRefusal; readonly proof?: FaceProofRefusal }
  | { readonly refusal: SessionFaceRefusalName; readonly state?: string }
  | SessionSignerRefusal
  | { readonly refusal: "session-malformed"; readonly open: string };

/**
 * Open the local session of a vessel that joined its face's fleet, and mint its signer.
 *
 * A JOINED VESSEL CERTIFIES ITS OWN FACE-SCOPED KEY. `certificate` names the certificate the root holder issued
 * over the key THIS vessel minted at its join; `vesselFaceKey` names that key as this vessel's custody row holds
 * it, read apart from the certificate. A certificate another vessel of the same face carries verifies as well as
 * this one's own, and the supplier refuses it `chain-other-vessel`: a borrowed certificate opens nothing here.
 *
 * `admitted` names this vessel's own ground at the Nexus (the face key and the Nexus), `memory` the withdrawals
 * it has learned there; `admit` and `grant` come from the held-root reader and the face's join record. The
 * order: the chain, the face, then the open and the mint, which `openSignedSession` closes again on a refusal.
 */
export async function openJoinedFaceSession(args: {
  table: SessionTable; binding: SessionBinding; profile: unknown; caps?: readonly string[];
  admitted: FaceScope; certificate: unknown; memory: WithdrawalMemory; vesselFaceKey: unknown;
  admit: unknown; grant: unknown;
  apart: KeysHeldApart; custody: VesselFaceKeyCustody; random?: RandomProvider;
}): Promise<{ readonly session: Session; readonly signer: SessionSigner } | JoinedFaceSessionRefusal> {
  const checked = checkVesselChain({ admitted: args.admitted, certificate: args.certificate, memory: args.memory });
  if (checked.verdict !== "verified") {
    if (checked.verdict !== "invalid") return { refusal: "chain-refused", verdict: checked.verdict };
    return checked.cause === undefined
      ? { refusal: "chain-refused", verdict: "invalid", cause: checked.refusal }
      : { refusal: "chain-refused", verdict: "invalid", cause: checked.refusal, proof: checked.cause };
  }
  const supplied = supplySessionFace({ chain: checked.chain, vesselFaceKey: args.vesselFaceKey, admit: args.admit, grant: args.grant });
  if (!("face" in supplied)) return supplied;
  return openSignedSession({
    table: args.table, binding: args.binding, face: supplied.face, profile: args.profile,
    certificate: args.certificate, apart: args.apart, custody: args.custody,
    ...(args.caps ? { caps: args.caps } : {}), ...(args.random ? { random: args.random } : {}),
  });
}
