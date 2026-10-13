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
 *   · the ADMIT'S VERDICT, as the one presenter-verifier reads it (`carriage-registry`): the Nexus's quorum
 *     admitted this nym, and the relation reads `held`;
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
 * Pure: no key, no I/O, no timer, no clock.
 * Stands specified in code until its callers land: the node's session open on the local socket, and the
 * browser holder. Out of the package barrel till then.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/session-contract#/what-a-session-carries
 */
import type { PresentedAdmitVerdict } from "./carriage-registry.js";
import { isVerifiedVesselChain, type VerifiedVesselChain } from "./face-authority.js";
import { faceProofSubjectRef } from "./face-proof-subjects.js";
import { personaScopedBagIds } from "./persona-scope.js";
import { validateSessionFace, type SessionFace } from "./session-contract.js";

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
}

/** The PersonaGroup's private, root-authorized record that one face key speaks for it at one Nexus. */
export interface FaceGrantReading {
  /** The PersonaGroup's own document id, bare lower-case hex. */
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
  "admit-other-face",       // the admit's nym names another key than the chain's face key
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
const PERSONA_GROUP = /^(?:[0-9a-f]{2}){4,64}$/;
const reference = (value: unknown): value is string => typeof value === "string" && REFERENCE.test(value);

/** An OWN field of a record, read once; `undefined` where the record holds none. A prototype supplies nothing. */
function field(record: object, key: string): unknown {
  return Object.hasOwn(record, key) ? (record as Record<string, unknown>)[key] : undefined;
}

interface ReadAdmit { state: string; nym: string; nexus: string; admitRef: string; revision: string }
function readAdmit(value: unknown): ReadAdmit | null {
  try {
    if (typeof value !== "object" || value === null) return null;
    const [verdict, nexus, admitRef, revision] = [field(value, "verdict"), field(value, "nexus"), field(value, "admitRef"), field(value, "revision")];
    if (typeof verdict !== "object" || verdict === null) return null;
    const [state, nym] = [field(verdict, "state"), field(verdict, "nym")];
    if (typeof state !== "string" || typeof nym !== "string") return null;
    if (!reference(nexus) || !reference(admitRef) || !reference(revision)) return null;
    return { state, nym, nexus, admitRef, revision };
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
  if (admit.nym !== chain.scope.faceKey) return { refusal: "admit-other-face" };
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
