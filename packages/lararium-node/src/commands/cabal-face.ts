/**
 * runCabalFace — the key the acting face presents in one cabal realm: the name a voucher writes for this face, the
 * writer a feed rolls, the applicant a crossing reads.
 *
 * ONE DOOR PICKS THE KEY (cabal-realm#/the-steward-signer). A realm's boards cross to its members, so a hand there
 * names the acting face's key at the Nexus the realm stands under, never a persona root and never a persona index.
 * The realm's Nexus reads as every act reads it (`actingRealmNexus`): the vessel's own ledger, else the Nexus the
 * call names, else the primary charter's.
 *
 * TWO READINGS. `present` stands the face in the realm: it mints the face's key at that Nexus where none stands
 * and notes the realm under that Nexus in the vessel's own ledger, as any act there does. Without `present` the
 * door only reads: it mints nothing and notes nothing, and a face that holds no key at that Nexus refuses by name.
 *
 * THE BOND, ASKED. With `bond`, the door also answers the face→leaf bond (`face-leaf-bond`): the face's atom and the leaf
 * both sign one image naming the atom, the leaf, the Nexus and the realm, which a feed carries so the daemon binds its
 * writer to the presenting face. Only a feed asks it, so a bond rides no other answer.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-steward-signer
 */
import type { Repo } from "@automerge/automerge-repo";
import { signAsFaceAtom, signFaceLeafBond, type FaceLeafBond } from "@lararium/mesh";
import { loadFaceAtom, loadFaceAtomKey } from "../face-atom-store.js";
import { actingRealmNexus, noteVesselRealm } from "../edge-board.js";
import { mintFaceNexusLeaf, faceNexusLeaf } from "../nexus-leaf.js";

export class CabalFaceError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;

/** What the door answers. A type alias, so a verb's output reads it as a plain record. */
export type CabalFaceResult = {
  readonly realm:    string;
  /** The Nexus the realm stands under at this vessel. */
  readonly nexusAid: string;
  /** The acting face's key at that Nexus. */
  readonly face:     string;
  /** The face whose key it is (its ordinal on this vessel). */
  readonly ordinal:  number;
  /** The face→leaf bond, where the call asked it. */
  readonly bond?:    FaceLeafBond;
};

export async function runCabalFace(opts: {
  readonly realm:     string;
  readonly nexusAid?: string;
  readonly present:   boolean;
  /** Answer the face→leaf bond beside the key (a feed's ask). */
  readonly bond?:     boolean;
  /** The face that acts (`--face N`); absent, the one face standing open. */
  readonly face?:     number;
  readonly sealHome:  string;
  readonly repo:      Repo;
}): Promise<CabalFaceResult> {
  const realm = opts.realm.trim().toLowerCase();
  if (!HEX64.test(realm)) throw new CabalFaceError(`--realm expects a 64-hex cabal-realm doc id, got "${opts.realm}"`);
  const vesselKey = await loadFaceAtomKey(opts.face);
  if (!vesselKey) throw new CabalFaceError("this vessel surfaces no verifying key — it keeps no ledger to read the realm's Nexus off.");
  const nexusAid = await actingRealmNexus({
    repo: opts.repo, vesselKey, realm, sealHome: opts.sealHome,
    ...(opts.nexusAid !== undefined ? { named: opts.nexusAid } : {}), refuse: (m) => new CabalFaceError(m),
  });
  const leaf = opts.present ? await mintFaceNexusLeaf(nexusAid, opts.face) : await faceNexusLeaf(nexusAid, opts.face);
  if (!leaf) {
    throw new CabalFaceError(opts.present
      ? "face-root-absent: this vessel holds no root for the face it acts as — name a face it founded (--face N)"
      : "the acting face presents no key at the Nexus this realm stands under — `lares cabal face --realm <id>` presents it there");
  }
  try {
    if (opts.present) await noteVesselRealm(opts.repo, vesselKey, realm, nexusAid);
    const face = leaf.verifyingKey.toLowerCase();
    if (opts.bond !== true) return { realm, nexusAid, face, ordinal: leaf.handleIndex };
    const atomSeed = await loadFaceAtom(leaf.handleIndex);
    if (!atomSeed) throw new CabalFaceError("face-atom-absent: the acting face holds no atom here, so it signs no bond for its key");
    try {
      const bond = await signFaceLeafBond({ atom: vesselKey, leaf: face, nexusAid, realm },
        { atom: (bytes) => signAsFaceAtom(atomSeed, bytes), leaf: (bytes) => signAsFaceAtom(leaf.seed, bytes) });
      return { realm, nexusAid, face, ordinal: leaf.handleIndex, bond };
    } finally { atomSeed.fill(0); }
  } finally { leaf.seed.fill(0); }
}
