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
  LARARIUM_DOC_URI, LARES_DOC_URI, emptyLarDoc, faceAtomKeyFromSeed, kahuCabalStanding, kahuRealmGroup, materializeSharedLarDoc,
  realmBagRegistrationCounts, realmBagRegistrationsFromDoc, realmDocUrl, signRealmBagRegistration, writeRealmBagRegistration, ed25519SignerFromSeed,
  type LarDoc, type RealmBagRegistration, type StewardSigner,
} from "@lararium/mesh";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { mintNexusLeaf } from "./nexus-leaf.js";
import { NexusCabalError, cabalCore, readKahuCabalBoard } from "./commands/nexus-cabal.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadIdentityAnchors } from "./identity-anchors.js";

/** The system bags the Kahu cabal keeps live. */
export const KAHU_REALM_BAGS: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

/** THE ONE ACCESSOR for the face whose per-Nexus key stewards the Kahu realm. Pairs with `kahuRealmGroup`; road `P21` swaps both. */
export function kahuRealmHandleIndex(): number { return 0; }

/** The live documents a vessel holds, by bag; a field stays absent where this vessel holds none. */
export interface KahuCanonDocs { readonly lares?: AutomergeUrl; readonly lararium?: AutomergeUrl }

const urlOf = (docs: ReadonlyMap<string, { readonly docUrl: string }>, bag: string): AutomergeUrl | undefined =>
  docs.get(bag)?.docUrl as AutomergeUrl | undefined;

/** THE KAHU STEWARD: persona zero's per-Nexus leaf at the hearth's Nexus, the one name that keeps a system bag (kahu.mem). */
async function kahuSteward(nexus: string): Promise<string> {
  const leaf = await mintNexusLeaf(kahuRealmHandleIndex(), nexus);
  leaf.seed.fill(0);
  return leaf.verifyingKey.toLowerCase();
}

/** Where the hearth keeps each registration its steward sealed: `<sealHome>/nexus/kahu-realm/<nexus>/<slug>.json`. */
function keptRegistrationPath(sealHome: string, nexus: string, bagUri: string): string {
  return join(sealHome, "nexus", "kahu-realm", nexus, `${encodeURIComponent(bagUri)}.json`);
}
function keepRegistration(sealHome: string, rec: RealmBagRegistration): void {
  const path = keptRegistrationPath(sealHome, rec.realmId, rec.bagUri);
  mkdirSync(join(path, ".."), { recursive: true });
  atomicWriteFileSync(path, JSON.stringify(rec, null, 2));
}
function keptRegistration(sealHome: string, nexus: string, bagUri: string): RealmBagRegistration | null {
  const path = keptRegistrationPath(sealHome, nexus, bagUri);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, "utf8")) as RealmBagRegistration; } catch { return null; }
}

/**
 * THE CANON'S FOLD READS ONE STEWARD. `foldRealmBags` verifies every self-named steward's seal and never that the hand
 * holds the hearth's canon, so a peer with sync-write on the registry could seal its own `@lares` row (beside the genuine
 * one: equivocal; in its place: its document stands). The Kahu canon counts only registrations kept by EXACTLY the
 * hearth's Kahu steward, so another hand's row names nothing and equivocates nothing (one owner per registry).
 */
async function foldKahuCanon(doc: LarDoc | undefined | null, nexus: string, steward: string): Promise<ReadonlyMap<string, RealmBagRegistration>> {
  const standing = new Map<string, RealmBagRegistration>();
  for (const rec of realmBagRegistrationsFromDoc(doc)) {
    if (rec.keptBy.length !== 1 || rec.keptBy[0]!.toLowerCase() !== steward) continue;
    if (!KAHU_REALM_BAGS.includes(rec.bagUri)) continue;
    if (!(await realmBagRegistrationCounts(rec, nexus))) continue;
    standing.set(rec.bagUri, rec);
  }
  return standing;
}

/**
 * The steward restores its own seal: a kept registration absent from the registry (a hostile deletion, a
 * replaced row) lands again under the steward's key. Its bytes are the steward's own, so nothing new is signed.
 */
function restoreKept(realm: { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void }, sealHome: string, nexus: string, steward: string, standing: ReadonlyMap<string, RealmBagRegistration>): string[] {
  const restored: string[] = [];
  for (const bagUri of KAHU_REALM_BAGS) {
    if (standing.has(bagUri)) continue;
    const kept = keptRegistration(sealHome, nexus, bagUri);
    if (!kept || kept.keptBy.length !== 1 || kept.keptBy[0]!.toLowerCase() !== steward) continue;
    realm.change((draft) => writeRealmBagRegistration(draft, kept, steward, true));
    restored.push(bagUri);
  }
  return restored;
}

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
  const steward = await kahuSteward(core.nexus);
  const standing = await foldKahuCanon(realm.doc(), core.nexus, steward);
  const registered: string[] = [...restoreKept(realm, opts.sealHome, core.nexus, steward, standing)];
  let signer: StewardSigner | null = null;
  const nowStanding = await foldKahuCanon(realm.doc(), core.nexus, steward);
  for (const bagUri of KAHU_REALM_BAGS) {
    if (nowStanding.has(bagUri)) continue;
    signer ??= opts.steward
      ? await opts.steward(core.nexus)
      : await (async () => { const leaf = await mintNexusLeaf(kahuRealmHandleIndex(), core.nexus); return { signer: leaf.verifyingKey.toLowerCase(), sign: ed25519SignerFromSeed(leaf.seed) }; })();
    const doc = opts.repo.create<LarDoc>(emptyLarDoc());
    await doc.whenReady();
    const rec = await signRealmBagRegistration({ realmId: core.nexus, bagUri, docUrl: doc.url, readTier: "contract" }, [signer]);
    if (!(await realmBagRegistrationCounts(rec, core.nexus))) throw new NexusCabalError(`the Kahu realm's registration of ${bagUri} counts nothing: the steward's seal does not verify`);
    realm.change((draft) => writeRealmBagRegistration(draft, rec, signer!.signer, true));
    keepRegistration(opts.sealHome, rec);
    registered.push(bagUri);
  }
  const landed = await foldKahuCanon(realm.doc(), core.nexus, steward);
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
  const steward = await kahuSteward(board.nexus);
  let standing = await foldKahuCanon(realm.doc(), board.nexus, steward);
  const restored = restoreKept(realm, opts.sealHome, board.nexus, steward, standing);
  if (restored.length > 0) {
    console.log(`[kahu-realm] the steward restored its own registration of ${restored.join(", ")} on the realm doc`);
    standing = await foldKahuCanon(realm.doc(), board.nexus, steward);
  }
  const lares = urlOf(standing, LARES_DOC_URI), lararium = urlOf(standing, LARARIUM_DOC_URI);
  return { ...(lares ? { lares } : {}), ...(lararium ? { lararium } : {}) };
}

/**
 * THE CANON DOCUMENTS A HEARTH NAMES TO A JOINEE — `@lares` and `@lararium` by bag title, as the Kahu realm's registry
 * stands them for the face this hearth wears: the one read the keel mounts them by (`standKahuCanon`). A catalog never
 * names them (the realm registry owns the system bags; one owner per registry), so a list read off catalog titles named
 * nothing on every hearth and every joined leaf read "the admit names no hearth canon" (walk R4). They ride the
 * fleet-join answer's signed carriage, so the joinee's gate widens by exactly these documents. `stand` is a named seam
 * for a measure; the keel's own reader rides by default.
 */
export async function admitCanonDocs(
  repo: Repo, sealHome: string, personaGroupId: string | null,
  stand: (opts: { readonly repo: Repo; readonly sealHome: string; readonly vesselKey: string; readonly personaGroupId: string | null }) => Promise<KahuCanonDocs> = standKahuCanon,
): Promise<Readonly<Record<string, string>>> {
  if (personaGroupId === null) return {};
  const seed = await loadFaceAtomOfGroup(personaGroupId).catch(() => null);
  if (!seed) return {};
  const vesselKey = faceAtomKeyFromSeed(seed, personaGroupId).key;
  const docs = await stand({ repo, sealHome, vesselKey, personaGroupId });
  return { ...(docs.lares ? { [LARES_DOC_URI]: docs.lares } : {}), ...(docs.lararium ? { [LARARIUM_DOC_URI]: docs.lararium } : {}) };
}

/** The face this hearth wears under sealed custody: the founding face's anchors' group (the composer's own reading); a locked or faceless place names none. */
export async function hearthCustodyGroup(): Promise<string | null> {
  return (await loadIdentityAnchors(0).catch(() => null))?.personaGroupId ?? null;
}

/**
 * THE CANON WAITS FOR THE PROOF. The keel mounts the Kahu canon during assembly, before the mounted face's proof runs (the proof needs the
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
