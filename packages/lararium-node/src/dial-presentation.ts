/**
 * dial-presentation — what this vessel presents when it dials a hearth's pinned gate.
 *
 * The Nexus comes from the pin the pair index holds (its `nexus` is the hex of the AID's bytes). The admit comes from
 * the bundle this vessel TOOK for that Nexus (`admit-bundle`), read again at the Nexus's charter held here: the verdict
 * the dial presents is the held-root reader's own (`presentedAdmitReader`), never one this module spelled.
 *
 * WHICH FACE PRESENTS. The face this vessel WEARS, named by `personaGroup`, and no other: the face whose anchors name that
 * group (`loadIdentityAnchors`). Where this vessel holds that face's root it is the face's FOUNDER, and its leaf is that
 * face's own held Nexus key whose admitted key is the admit's nym (`readFounderFaceProof`, the lazy self-certificate). A
 * leaf of ANOTHER face that answers the nym refuses `leaf-other-face`: a grant for group A is never signed with face B's
 * root. Where it holds no root for the mounted face it is a JOINEE: it keeps no roster line, so its scope comes from the
 * certificate its join record keeps at the dialed Nexus, whose admitted key must be the admit's nym, and its proof is
 * read as the join left it (`readJoinedFaceProof`). Where no single face names the group (two do, or none) and this vessel
 * holds any face root, it presents nothing (`face-unworn`). Each absence is named: the pin, the kept admit, the charter, the
 * verdict, the leaf, the face's group, or the proof's own piece.
 *
 * The session table belongs to the dial and is handed in, as the mesh's opener requires. The fleet-edge arm and the
 * walker arm are not composed here: the card-alone and fleet shapes stay with the boot's own presentation owner.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/dial-presentation
 */
import {
  admittedKeyOf, heldNexusRoot, makeMultiSigQuorumVerifier, nexusAidOfPin, presentedAdmitReader, readFaceScope,
  type FaceScope, type GateBundlePin, type JoinedFaceTarget, type PresentationArm,
} from "@lararium/mesh";
import { readKeptAdmitBundle } from "./admit-bundle.js";
import { charterHomeFor, readKeyLine } from "./carried-set.js";
import { readFaceJoinRecord } from "./fleet-join-custody.js";
import type { FounderCertificateDoors } from "./founder-self-certificate.js";
import { listAnchoredPersonas, loadIdentityAnchors } from "./identity-anchors.js";
import { nodeFacePresentation, nodeFaceTarget, type NodeFacePresentation, type NodeFacePresentationRefusal } from "./node-face-presentation.js";
import { heldNexusLeaves, type NexusLeaf } from "./nexus-leaf.js";
import { loadPersonaGroupRootVerifyingKey } from "./node-vessel-identity.js";
import { readNexusDoc } from "./nexus-doc.js";

type FaceInputs = Pick<Parameters<typeof nodeFacePresentation>[0], "table" | "binding" | "profile">;

/** The doors this module reaches beyond the seal home; a vector replaces them, a vessel uses the defaults. */
export interface DialPresentationDoors {
  /** The face whose anchors name `personaGroup`, or null where none does. */
  readonly faceOfGroup?: (personaGroup: string) => Promise<number | null>;
  /** Does this vessel hold the root of face `face`? */
  readonly rootHeld?:    (face: number) => Promise<boolean>;
  /** Does this vessel hold the root of ANY face it anchors? */
  readonly anyRootHeld?: () => Promise<boolean>;
  /** The Nexus keys this vessel's held roots keep at `nexus`. */
  readonly leaves?:      (nexus: string) => Promise<readonly NexusLeaf[]>;
  /** Handed through to the founder's self-certificate. */
  readonly founder?:     FounderCertificateDoors;
}

/** The face whose anchors name `personaGroup`: the face this vessel wears. Two faces naming one group name none. */
export async function faceOfGroup(personaGroup: string): Promise<number | null> {
  const faces: number[] = [];
  for (const face of await listAnchoredPersonas()) {
    if ((await loadIdentityAnchors(face))?.personaGroupId === personaGroup) faces.push(face);
  }
  return faces.length === 1 ? faces[0]! : null;
}

const scopeOfCertificate = (certificate: unknown): FaceScope | null => {
  try {
    const read = readFaceScope((certificate as { scope?: unknown }).scope);
    return "read" in read ? read.read : null;
  } catch { return null; }
};

export async function composeDialPresentation(args: FaceInputs & DialFaceArgs): Promise<{ readonly presentation: NodeFacePresentation } | NodeFacePresentationRefusal> {
  return dialFaceAt(args, (scope, founder, admit, arm) => nodeFacePresentation({
    personaGroup: args.personaGroup!, scope, founder, table: args.table, binding: args.binding, profile: args.profile, admit, arm,
    ...(args.doors?.founder ? { doors: args.doors.founder } : {}),
  }));
}

/**
 * The face a session at `pin`'s Nexus would wear, described and not yet taken: the same reading the dial makes (the
 * kept admit, the charter's held root, the founder's leaf or the joinee's certificate), ending at the face and its
 * signer's mint (`nodeFaceTarget`) in place of an open. It writes nothing: the founder's certificate stands from the
 * dial's presentation. The session socket's door preflights through this.
 */
export async function composeFaceTarget(args: DialFaceArgs): Promise<{ readonly target: JoinedFaceTarget } | NodeFacePresentationRefusal> {
  return dialFaceAt(args, (scope, _founder, admit) => nodeFaceTarget({ personaGroup: args.personaGroup!, scope, admit }));
}

interface DialFaceArgs {
  readonly sealHome:     string;
  readonly pin:          GateBundlePin;
  readonly personaGroup: string | null | undefined;
  readonly doors?:       DialPresentationDoors;
}

async function dialFaceAt<R>(args: DialFaceArgs,
  presentAt: (scope: FaceScope, founder: { readonly face: number } | null, admit: unknown, arm: PresentationArm) => Promise<R | NodeFacePresentationRefusal>,
): Promise<R | NodeFacePresentationRefusal> {
  const doors = args.doors ?? {};
  const aid = nexusAidOfPin(args.pin);
  if (aid === null) return { refusal: "pin-nexus-unreadable" };
  if (!args.personaGroup) return { refusal: "face-group-absent" };
  const personaGroup = args.personaGroup;
  const kept = readKeptAdmitBundle(args.sealHome, aid);
  if (kept === null) return { refusal: "admit-absent" };
  const home = charterHomeFor(args.sealHome, aid);
  const root = heldNexusRoot({ nexus: aid, charter: home ? readNexusDoc(home) : null, denyBoard: [], antigen: [], antigenVerifier: makeMultiSigQuorumVerifier() });
  if ("absent" in root) return { refusal: "charter-absent", detail: root.absent };
  const arm = { kind: "admit", admit: kept.admit, lineage: kept.lineage } as const;
  const admit = await presentedAdmitReader(() => root).read({ admit: kept.admit, lineage: kept.lineage });
  if ("refusal" in admit) return { refusal: "admit-unread", detail: admit.refusal };
  const nym = kept.admit.nym.toLowerCase();
  const line = readKeyLine(args.sealHome, aid);
  const answers = (key: string): boolean => admittedKeyOf({ nexus: aid, key, carried: line }) === nym;
  const present = (scope: FaceScope, founder: { readonly face: number } | null) => presentAt(scope, founder, admit, arm);

  const worn = await (doors.faceOfGroup ?? faceOfGroup)(personaGroup);
  const rootHeld = doors.rootHeld ?? (async (face: number) => (await loadPersonaGroupRootVerifyingKey(face)) !== undefined);
  if (worn !== null && await rootHeld(worn)) {
    // THE FOUNDER: the mounted face's own leaf, and no other face's.
    const leaves = await (doors.leaves ?? heldNexusLeaves)(aid);
    try {
      const answering = leaves.filter((l) => answers(l.verifyingKey));
      const leaf = answering.find((l) => l.handleIndex === worn);
      if (leaf === undefined) return { refusal: answering.length > 0 ? "leaf-other-face" : "leaf-absent" };
      const scope = readFaceScope({ faceKey: leaf.verifyingKey, nexus: aid });
      if (!("read" in scope)) return { refusal: "leaf-absent", detail: scope.refusal };
      return await present(scope.read, { face: worn });
    } finally { for (const leaf of leaves) leaf.seed.fill(0); }
  }
  // NO SINGLE WORN FACE: two faces name the group, or none does. A vessel holding a face root here is no joinee of this
  // group; it presents nothing rather than fall to the joinee branch under a face it does not wear.
  if (worn === null && await (doors.anyRootHeld ?? (async () => {
    for (const face of await listAnchoredPersonas()) if (await rootHeld(face)) return true;
    return false;
  }))()) {
    return { refusal: "face-unworn", detail: "this vessel holds a face root, yet no single face it wears names the group" };
  }
  // THE JOINEE: no roster line, so its scope is the one its join record's certificate names at this Nexus.
  const record = await readFaceJoinRecord(personaGroup);
  if (record === null) return { refusal: "join-absent" };
  const scopes = new Map<string, FaceScope>();
  for (const certificate of record.certificates) {
    const scope = scopeOfCertificate(certificate);
    if (scope !== null && scope.nexus === aid && answers(scope.faceKey)) scopes.set(scope.faceKey, scope);
  }
  if (scopes.size !== 1) return { refusal: "leaf-absent", ...(scopes.size > 1 ? { detail: "two certificates at this Nexus answer the admit" } : {}) };
  return await present([...scopes.values()][0]!, null);
}
