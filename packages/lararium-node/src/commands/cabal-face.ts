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
 * THE FEED STAYS HERE (`runCabalFeed`). A feed rolls the acting face's own leaf slot through the island's `realm-feed`,
 * carrying the face→leaf bond (`face-leaf-bond`: the atom and the leaf both sign one image naming the atom, the leaf,
 * the Nexus and the realm) and the atom's ask over that one request. Both are signed and handed to the island here, on
 * the main thread that holds the keys, and ride no answer: an outcome names its presenter, so an answer naming the leaf
 * beside it would link the face's leaves across Nexuses through the atom. The feed answers that it fed, and no more.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-steward-signer
 */
import type { Repo } from "@automerge/automerge-repo";
import { newRequestId, realmFeedAskImage, signAsFaceAtom, signFaceLeafBond } from "@lararium/mesh";
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
  leaf.seed.fill(0);
  if (opts.present) await noteVesselRealm(opts.repo, vesselKey, realm, nexusAid);
  return { realm, nexusAid, face: leaf.verifyingKey.toLowerCase() };
}

/** Ask the daemon island one verb as a face, from the main thread: its answer once its outcome lands. */
export type AskIslandAsFace = (verb: string, args: Record<string, unknown>, requestedBy: string, requestId: string) => Promise<Record<string, unknown>>;

/**
 * runCabalFeed — the acting face feeds one realm as its own leaf. The face stands at the realm's Nexus (its key minted
 * there where none stands, the realm noted, as `present` does); its atom signs the bond and the ask over a fresh
 * request; the island's `realm-feed` rolls the leaf's slot. The answer names the realm and that it fed: never the leaf.
 */
export async function runCabalFeed(opts: {
  readonly realm:     string;
  readonly nexusAid?: string;
  /** The face that feeds: the session's face, bound by the store door. */
  readonly face:      number;
  readonly sealHome:  string;
  readonly repo:      Repo;
  readonly askIsland: AskIslandAsFace;
}): Promise<{ readonly realm: string; readonly fed: boolean }> {
  const realm = opts.realm.trim().toLowerCase();
  if (!HEX64.test(realm)) throw new CabalFaceError(`--realm expects a 64-hex cabal-realm doc id, got "${opts.realm}"`);
  const atomKey = await loadFaceAtomKey(opts.face);
  const nexusAid = await actingRealmNexus({
    repo: opts.repo, vesselKey: atomKey, realm, sealHome: opts.sealHome,
    ...(opts.nexusAid !== undefined ? { named: opts.nexusAid } : {}), refuse: (m) => new CabalFaceError(m),
  });
  const leaf = await mintFaceNexusLeaf(nexusAid, opts.face);
  if (!leaf) throw new CabalFaceError("face-root-absent: this vessel holds no root for the face it acts as — name a face it founded (--face N)");
  await noteVesselRealm(opts.repo, atomKey, realm, nexusAid);
  const writer = leaf.verifyingKey.toLowerCase();
  const requestId = newRequestId();
  const atomSeed = await loadFaceAtom(leaf.handleIndex);
  let args: Record<string, unknown>;
  try {
    if (!atomSeed) throw new CabalFaceError("face-atom-absent: the acting face holds no atom here, so it signs no bond for its key");
    const bond = await signFaceLeafBond({ atom: atomKey, leaf: writer, nexusAid, realm },
      { atom: (bytes) => signAsFaceAtom(atomSeed, bytes), leaf: (bytes) => signAsFaceAtom(leaf.seed, bytes) });
    const askSig = await signAsFaceAtom(atomSeed, realmFeedAskImage({ requestId, realm, writer }));
    args = { realm, writer, bond, askSig };
  } finally { atomSeed?.fill(0); leaf.seed.fill(0); }
  const answer = await opts.askIsland("realm-feed", args, `0x${atomKey}`, requestId);
  return { realm, fed: answer["fed"] === true };
}
