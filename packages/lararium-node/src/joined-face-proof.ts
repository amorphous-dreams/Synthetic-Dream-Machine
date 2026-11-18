/**
 * joined-face-proof — what a joined vessel opens its session with at one Nexus: its OWN certificate from the join.
 *
 * The fleet-join door left two things on this vessel: its face-scoped key for each scope, sealed in custody
 * (`vessel-face-key`), and the face's record (`face-join-record`), holding the root holder's certificates over
 * those keys and the root's grants. This door reads them, re-reads each grant under the record's root key, names
 * the vessel's key from its custody row and never from a certificate, and hands back the inputs
 * `openJoinedFaceSession` takes beside the session table: that mesh door checks the chain, supplies the face,
 * opens the session and mints its signer, and refuses a certificate over any key but the custody row's.
 *
 * The session table stays private to the mesh; the node's sovereign dial holds it, and brings what this
 * vessel learned at the Nexus (the admit as the held-root reader read it, and the face's withdrawal memory).
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/face-proof#/the-key-hierarchy
 */
import {
  faceKeyGrantRevision, readFaceKeyGrant,
  type FaceGrantReading, type FaceScope, type VesselFaceKeyCustody,
} from "@lararium/mesh";
import { nodeVesselFaceKeyCustody, readVesselFaceKeyPublic } from "./face-key-custody.js";
import { readFaceJoinRecord } from "./fleet-join-custody.js";

/** A joined vessel's proof at one scope, as `openJoinedFaceSession` takes it. */
export interface JoinedFaceProof {
  /** The certificate the root holder issued at the join, as the record keeps it: the mesh door re-reads it. */
  readonly certificate:   unknown;
  readonly grant:         FaceGrantReading;
  /** This vessel's face-scoped key at the scope, read from its custody row. */
  readonly vesselFaceKey: string;
  readonly apart:         readonly string[];
  readonly custody:       VesselFaceKeyCustody;
}

/** Why no proof stands: no join of this face, or no certificate, grant or key at the scope. */
export type JoinedFaceAbsence = { readonly refusal: "join-absent" | "certificate-absent" | "grant-absent" | "vessel-face-key-absent" };

const atScope = (value: unknown, scope: FaceScope): boolean => {
  try {
    const at = (value as { scope?: { faceKey?: unknown; nexus?: unknown } }).scope;
    return at?.faceKey === scope.faceKey && at?.nexus === scope.nexus;
  } catch { return false; }
};

/** This joined vessel's proof for `personaGroup` at `scope`, or the piece that stands absent. */
export async function readJoinedFaceProof(args: { personaGroup: string; scope: FaceScope }): Promise<JoinedFaceProof | JoinedFaceAbsence> {
  const record = await readFaceJoinRecord(args.personaGroup);
  if (record === null) return { refusal: "join-absent" };
  const certificate = record.certificates.find((c) => atScope(c, args.scope));
  if (certificate === undefined) return { refusal: "certificate-absent" };
  const read = record.grants.map((g) => readFaceKeyGrant(g, record.rootKey)).find((g) => g !== null && atScope(g, args.scope));
  if (!read) return { refusal: "grant-absent" };
  const vesselFaceKey = await readVesselFaceKeyPublic(args.scope);
  if (vesselFaceKey === null) return { refusal: "vessel-face-key-absent" };
  return {
    certificate, vesselFaceKey, apart: [record.rootKey], custody: nodeVesselFaceKeyCustody,
    grant: { personaGroup: read.personaGroup, faceKey: read.scope.faceKey, nexus: read.scope.nexus, revision: faceKeyGrantRevision(read) },
  };
}
