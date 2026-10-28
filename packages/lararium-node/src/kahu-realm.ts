/**
 * kahu-realm — where the live `lares` and `lararium` documents REST: as realm bags of the hearth's own realm, kept
 * by the Kahu cabal, and held by no vessel outside it.
 *
 * The ruling (`lar:///ha.ka.ba/lares/docs/stable-founding-road` #/rulings, one owner per registry): the Kahu realm holds
 * the live system documents; `bags/` projects on the Kahu's vessel alone; a vessel without a counted admission holds
 * no pointer and no layer, and reads the floor through the read-face.
 *
 *   · THE FOUNDING LANDS THE REALM (`landKahuRealm`). Beside the counted admission, the one-seat founding mints one
 *     document per system bag and registers each as a realm bag on the realm doc the charter names (the Nexus AID's
 *     deterministic doc), sealed by persona zero's per-Nexus key as the steward. A registration that already counts
 *     stands untouched, so a founding run again registers nothing new.
 *   · A VESSEL STANDS ITS CANON AT BOOT (`standKahuCanon`). It names the documents only where the cabal's board
 *     carries a counted admission for the Kahu realm's group: the registrations come off the realm doc, folded and
 *     seal-verified, and a vessel with no charter, no admission, a removed group or no registration holds none. The
 *     keel mounts exactly what this returns; no catalog row names a system bag any more.
 *
 * THE GROUP SEAM. The group is named by `kahuRealmGroup` and the steward's face by `kahuRealmHandleIndex`: persona zero
 * for now. The Kahu face's own group (road `P21`) swaps in at these two accessors alone; the registrations key on the Nexus AID, so no data
 * moves (`w26-floor-lane#/the-seam-owed-to-wave-c`).
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-slices
 */
import { interpretAsDocumentId, type AutomergeUrl, type Repo } from "@automerge/automerge-repo";
import {
  LARARIUM_DOC_URI, LARES_DOC_URI, emptyLarDoc, foldRealmBags, kahuCabalStanding, kahuRealmGroup, materializeSharedLarDoc,
  realmBagRegistrationCounts, realmDocUrl, signRealmBagRegistration, writeRealmBagRegistration, ed25519SignerFromSeed,
  type LarDoc, type StewardSigner,
} from "@lararium/mesh";
import { mintNexusLeaf } from "./nexus-leaf.js";
import { NexusCabalError, cabalCore, readKahuCabalBoard } from "./commands/nexus-cabal.js";

/** The system bags the Kahu cabal keeps live. */
export const KAHU_REALM_BAGS: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

/** THE ONE ACCESSOR for the face whose per-Nexus key stewards the Kahu realm. Pairs with `kahuRealmGroup`; road `P21` swaps both. */
export function kahuRealmHandleIndex(): number { return 0; }

/** The live documents a vessel holds, by bag; a field stays absent where this vessel holds none. */
export interface KahuCanonDocs { readonly lares?: AutomergeUrl; readonly lararium?: AutomergeUrl }

const urlOf = (docs: ReadonlyMap<string, { readonly docUrl: string }>, bag: string): AutomergeUrl | undefined =>
  docs.get(bag)?.docUrl as AutomergeUrl | undefined;

/**
 * Land the Kahu realm at the founding: one live document per system bag, registered on the hearth's realm doc under
 * persona zero's per-Nexus key. Idempotent. Refuses (`NexusCabalError`) where this vessel holds no seated charter.
 */
export async function landKahuRealm(opts: {
  readonly repo: Repo; readonly sealHome: string;
  /** The steward's signer at the Nexus; absent, persona zero's per-Nexus key (minted where none stands). */
  readonly steward?: (nexusAid: string) => Promise<StewardSigner>;
}): Promise<{ readonly nexus: string; readonly docs: Required<KahuCanonDocs>; readonly registered: readonly string[] }> {
  const core = await cabalCore(opts.repo, opts.sealHome, undefined);
  const realm = await materializeSharedLarDoc(opts.repo, realmDocUrl(core.nexus), "realm");
  const standing = await foldRealmBags(realm.doc(), core.nexus);
  const registered: string[] = [];
  let signer: StewardSigner | null = null;
  for (const bagUri of KAHU_REALM_BAGS) {
    if (standing.has(bagUri)) continue;
    signer ??= opts.steward
      ? await opts.steward(core.nexus)
      : await (async () => { const leaf = await mintNexusLeaf(kahuRealmHandleIndex(), core.nexus); return { signer: leaf.verifyingKey.toLowerCase(), sign: ed25519SignerFromSeed(leaf.seed) }; })();
    const doc = opts.repo.create<LarDoc>(emptyLarDoc());
    await doc.whenReady();
    const rec = await signRealmBagRegistration({ realmId: core.nexus, bagUri, docUrl: doc.url, readTier: "contract" }, [signer]);
    if (!(await realmBagRegistrationCounts(rec, core.nexus))) throw new NexusCabalError(`the Kahu realm's registration of ${bagUri} counts nothing: the steward's seal does not verify`);
    realm.change((draft) => writeRealmBagRegistration(draft, rec, signer!.signer, true));
    registered.push(bagUri);
  }
  const landed = await foldRealmBags(realm.doc(), core.nexus);
  const lares = urlOf(landed, LARES_DOC_URI), lararium = urlOf(landed, LARARIUM_DOC_URI);
  if (!lares || !lararium) throw new NexusCabalError("the Kahu realm's registrations did not fold to standing");
  return { nexus: core.nexus, docs: { lares, lararium }, registered };
}

/**
 * The live system documents THIS vessel holds, read at boot: only where the cabal's board carries a counted admission
 * for the Kahu realm's group, and the realm doc carries a standing registration for the bag. Everything else reads
 * none, and the keel then mounts no layer for it. `personaGroupId` is the face pin the bootstrap carries (null for a
 * place with no face).
 */
export async function standKahuCanon(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly vesselKey: string; readonly personaGroupId: string | null;
}): Promise<KahuCanonDocs> {
  if (opts.personaGroupId === null) return {};
  const board = await readKahuCabalBoard(opts.repo, opts.sealHome, opts.vesselKey);
  if (board === null) return {};
  let group: string;
  try { group = kahuRealmGroup(opts.personaGroupId); } catch { return {}; }
  if (kahuCabalStanding(board.acts, group, board.roster, board.nexus).standing !== "admitted") return {};
  const realm = await materializeSharedLarDoc(opts.repo, realmDocUrl(board.nexus), "realm");
  const standing = await foldRealmBags(realm.doc(), board.nexus);
  const lares = urlOf(standing, LARES_DOC_URI), lararium = urlOf(standing, LARARIUM_DOC_URI);
  return { ...(lares ? { lares } : {}), ...(lararium ? { lararium } : {}) };
}

/**
 * THE CANON WAITS FOR THE PROOF. The keel mounts the Kahu canon during assembly, before the worn face's proof runs (the proof needs the
 * KEL board and the daemon doc that stand later), so the mount itself cannot wait. Everything that could TOUCH the mounted documents
 * does: no verb is wired until the daemon opens, no mirror writes until then, and a peer's sync of a canon document is denied here until
 * the proof passes, for a vessel that owes a face proof (sealed custody names a face). A vessel with no face owes none.
 */
export function canonHeldUntilProof(input: {
  readonly canon: KahuCanonDocs; readonly owesFaceProof: boolean; readonly faceProven: boolean; readonly documentId: string | undefined;
}): boolean {
  if (!input.owesFaceProof || input.faceProven || input.documentId === undefined) return false;
  for (const url of [input.canon.lares, input.canon.lararium]) {
    if (!url) continue;
    try { if (String(interpretAsDocumentId(url as AutomergeUrl)) === input.documentId) return true; } catch { /* a malformed url names nothing */ }
  }
  return false;
}
