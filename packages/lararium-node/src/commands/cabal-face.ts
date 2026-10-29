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
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-steward-signer
 */
import type { Repo } from "@automerge/automerge-repo";
import { loadFaceAtomKey } from "../face-atom-store.js";
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
};

export async function runCabalFace(opts: {
  readonly realm:     string;
  readonly nexusAid?: string;
  readonly present:   boolean;
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
  if (opts.present) await noteVesselRealm(opts.repo, vesselKey, realm, nexusAid);
  return { realm, nexusAid, face: leaf.verifyingKey.toLowerCase() };
}
