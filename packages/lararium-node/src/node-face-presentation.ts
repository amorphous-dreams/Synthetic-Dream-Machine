/**
 * node-face-presentation — what a node vessel presents at a gate: its face's chain, its session's signer, the admit it
 * rides, and the withdrawals its face has learned.
 *
 * A JOINED vessel reads its proof from the join record and its custody row (`readJoinedFaceProof`); a FOUNDER holds the
 * face's root, so the same proof is made sure first (`readFounderFaceProof`, the lazy self-certificate: the first gate
 * open at a scope issues and keeps it) and then read through the one reader a joiner uses. Either proof opens the
 * session on the mesh's own door (`openJoinedFaceSession`: the chain checked, the face supplied, the signer minted). The
 * dial presents TWO certificates and never one for the other: the VESSEL's certificate under the face (the chain's own,
 * which the dial reads first and the gate checks against the admit), and the session's, which rides the signer.
 *
 * WHAT THIS MODULE DOES NOT HOLD: the session table and the reading of the admit. The table is the dial's and is handed
 * in; `admit` is the verdict of the one held-root reader and `arm` the admit the gate will read in turn, both brought by
 * the caller that learned them at the Nexus. A reading this module spelled by hand would be a verdict it never took.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/node-face-presentation
 */
import { checkVesselChain, foldWithdrawals, openJoinedFaceSession, type FaceScope, type LarWSClientOptions, type PresentationArm } from "@lararium/mesh";
import { readFounderFaceProof, type FounderCertificateDoors } from "./founder-self-certificate.js";
import { readJoinedFaceProof } from "./joined-face-proof.js";

export type NodeFacePresentation = LarWSClientOptions["presentation"];
type OpenArgs = Parameters<typeof openJoinedFaceSession>[0];

/** Why no presentation stands: the proof is absent, the history does not fold, or the session stayed shut. */
export type NodeFacePresentationRefusal = { readonly refusal: string; readonly detail?: string };

export async function nodeFacePresentation(args: {
  readonly personaGroup: string;
  readonly scope:        FaceScope;
  /** Present only on the face's founder: the persona index whose root certifies this vessel. A joiner passes null. */
  readonly founder:      { readonly face: number } | null;
  readonly table:        OpenArgs["table"];
  readonly binding:      OpenArgs["binding"];
  readonly profile:      unknown;
  /** The admit's verdict as the held-root reader read it at this Nexus. */
  readonly admit:        unknown;
  /** The admit the gate reads in turn; null for a dial that presents the card alone. */
  readonly arm:          PresentationArm | null;
  readonly doors?:       FounderCertificateDoors;
}): Promise<{ readonly presentation: NodeFacePresentation } | NodeFacePresentationRefusal> {
  const proof = args.founder === null
    ? await readJoinedFaceProof({ personaGroup: args.personaGroup, scope: args.scope })
    : await readFounderFaceProof({ face: args.founder.face, personaGroup: args.personaGroup, scope: args.scope }, args.doors);
  if (!("grant" in proof)) return { refusal: proof.refusal };
  const fold = foldWithdrawals(args.scope);
  if (!("memory" in fold)) return { refusal: "history-unfolded", detail: fold.refusal };
  const opened = await openJoinedFaceSession({
    table: args.table, binding: args.binding, profile: args.profile, admitted: args.scope, admit: args.admit, memory: fold.memory, ...proof,
  });
  if (!("signer" in opened)) return { refusal: opened.refusal };
  // The vessel's certificate as the chain read it: the opener checked this same chain, so a refusal here is a fault.
  const chain = checkVesselChain({ admitted: args.scope, certificate: proof.certificate, memory: fold.memory });
  if (chain.verdict !== "verified") return { refusal: "chain-refused", detail: chain.verdict };
  return { presentation: { certificate: chain.chain.certificate, signer: opened.signer, arm: args.arm, history: fold.memory } };
}
