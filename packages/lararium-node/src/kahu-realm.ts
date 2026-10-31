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
 *     mints nothing new, so a founding run again registers no second document; one an earlier key of the steward's line
 *     sealed re-seals under the line's head (`standKahuRegistrations`).
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
  LARARIUM_DOC_URI, LARES_DOC_URI, deterministicDocUrl, faceAtomKeyFromSeed, kahuCabalStanding, kahuRealmGroup, materializeSharedLarDoc,
  canonicalJson, parseRealmBagRegistration, realmBagRegistrationCounts, realmBagRegistrationsFromDoc, realmDocUrl, signRealmBagRegistration,
  writeRealmBagRegistration, ed25519SignerFromSeed, admittedKeyOf, followNexusKeyLine, kahuCabalActsFromBoard, realmBagKey, foundingRoster,
  type LarDoc, type RealmBagRegistration, type StewardSigner,
} from "@lararium/mesh";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { mintNexusLeaf } from "./nexus-leaf.js";
import { nexusKeyPublicOf, readNexusKeys } from "./face-key-custody.js";
import { keyLineAt } from "./nexus-carriage.js";
import { NexusCabalError, cabalCore } from "./commands/nexus-cabal.js";
import { loadFaceAtomOfGroup } from "./face-atom-store.js";
import { loadIdentityAnchors } from "./identity-anchors.js";
import { readNexusDoc } from "./nexus-doc.js";

/** The system bags the Kahu cabal keeps live. */
export const KAHU_REALM_BAGS: readonly string[] = [LARES_DOC_URI, LARARIUM_DOC_URI];

/** THE ONE ACCESSOR for the face whose per-Nexus key stewards the Kahu realm. Pairs with `kahuRealmGroup`; road `P21` swaps both. */
export function kahuRealmHandleIndex(): number { return 0; }

/** The live documents a vessel holds, by bag; a field stays absent where this vessel holds none. */
export interface KahuCanonDocs { readonly lares?: AutomergeUrl; readonly lararium?: AutomergeUrl }

/**
 * THE FOUNDING MINTS A KAHU BAG'S DOCUMENT AT THE STEWARD'S OWN DERIVATION: a MAC under the steward's per-Nexus seed over
 * the Nexus and the bag seeds its id. No other hand can compute it before the registration publishes it, so no peer
 * pre-seeds the canon a founding adopts; one leaf mints one document per bag, so a founding retry under that leaf
 * re-registers the same document. Only the founding computes it: a reader stands what the steward sealed (the
 * registration and the kept copy), so a reader needs no steward secret beyond the seal it checks.
 */
export async function kahuBagDocUrl(nexus: string, bagUri: string): Promise<AutomergeUrl> {
  const leaf = await mintNexusLeaf(kahuRealmHandleIndex(), nexus);
  try {
    return deterministicDocUrl(`kahu-doc:${createHmac("sha256", leaf.seed).update(`kahu-doc|${nexus}|${bagUri}`).digest("hex")}`);
  } finally { leaf.seed.fill(0); }
}

const urlOf = (docs: ReadonlyMap<string, { readonly docUrl: string }>, bag: string): AutomergeUrl | undefined =>
  docs.get(bag)?.docUrl as AutomergeUrl | undefined;

/**
 * THE KAHU STEWARD READS AS ITS KEY LINE (kahu.mem, the gate's shape: a gate stands a presenter under the HEAD of the
 * key's line alone, and reads a line that forks as denied). The steward is persona zero's per-Nexus key at the hearth's
 * Nexus; `lares persona reissue` hands it on by a hand-over both keys sign, so the canon counts a row sealed by ANY key
 * of the line and re-seals it under the head. The head is the key this face holds that heads its own line, read over
 * the carriage board and the hearth's kept copy (`keyLineAt`): mid re-issue the row holds the standing key and its
 * successor, and whichever the line names as head stewards. A held key whose line forks, or that the line handed on,
 * stewards nothing, so a forked line stands no canon. A face that holds no key at this Nexus mints its first (the
 * founding). A paper restore's successor rides the face-key roll (face-proof.mem #/causal-withdrawal), which no code
 * builds yet: its fresh key heads a line of its own, and until a roll names it the canon stands none.
 */
interface KahuStewardLine {
  readonly head: string;
  /** The line from the admitted key to the head; a row sealed by any of them counts. */
  readonly keys: ReadonlySet<string>;
  /** The head's signer, read at the moment it seals and zero-filled after. */
  readonly signHead: () => Promise<StewardSigner & { readonly done: () => void }>;
}
async function kahuStewardLine(sealHome: string, nexus: string, board: LarDoc | undefined): Promise<KahuStewardLine | null> {
  let held = await readNexusKeys(kahuRealmHandleIndex(), nexus);
  if (held.length === 0) {
    const leaf = await mintNexusLeaf(kahuRealmHandleIndex(), nexus);
    held = [leaf.seed];
  }
  try {
    const carried = keyLineAt(sealHome, nexus, board);
    for (const seed of held) {
      const key = nexusKeyPublicOf(seed).toLowerCase();
      const admitted = admittedKeyOf({ nexus, key, carried });
      if (admitted === null) continue;
      const walk = followNexusKeyLine({ nexus, admitted, carried });
      if (!("head" in walk) || walk.head !== key) continue;
      const keys = new Set(walk.keys.map((k) => k.toLowerCase()));
      return {
        head: key, keys,
        signHead: async () => {
          const seeds = await readNexusKeys(kahuRealmHandleIndex(), nexus);
          const again = seeds.find((s) => nexusKeyPublicOf(s).toLowerCase() === key);
          for (const other of seeds) if (other !== again) other.fill(0);
          if (!again) throw new NexusCabalError("the Kahu steward's head key left this vessel while it sealed");
          return { signer: key, sign: ed25519SignerFromSeed(again), done: () => again.fill(0) };
        },
      };
    }
    return null;
  } finally { for (const seed of held) seed.fill(0); }
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
/** The hearth's kept registration for a bag, where it reads whole and verifies as a seal of the steward's line over this Nexus and bag; else none. */
async function keptRegistration(sealHome: string, nexus: string, bagUri: string, line: KahuStewardLine): Promise<RealmBagRegistration | null> {
  const path = keptRegistrationPath(sealHome, nexus, bagUri);
  if (!existsSync(path)) return null;
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { return null; }
  const rec = parseRealmBagRegistration(text);
  if (!rec || rec.realmId !== nexus || rec.bagUri !== bagUri) return null;
  if (rec.keptBy.length !== 1 || !line.keys.has(rec.keptBy[0]!.toLowerCase())) return null;
  return (await realmBagRegistrationCounts(rec, nexus)) ? rec : null;
}

/** The registry's rows for each Kahu bag sealed by exactly one key of the hearth's Kahu steward's line and counted at this Nexus. */
async function stewardRows(doc: LarDoc | undefined | null, nexus: string, line: KahuStewardLine): Promise<ReadonlyMap<string, readonly RealmBagRegistration[]>> {
  const rows = new Map<string, RealmBagRegistration[]>();
  for (const rec of realmBagRegistrationsFromDoc(doc)) {
    if (rec.keptBy.length !== 1 || !line.keys.has(rec.keptBy[0]!.toLowerCase())) continue;
    if (!KAHU_REALM_BAGS.includes(rec.bagUri)) continue;
    if (!(await realmBagRegistrationCounts(rec, nexus))) continue;
    rows.set(rec.bagUri, [...(rows.get(rec.bagUri) ?? []), rec]);
  }
  return rows;
}

/**
 * THE KAHU CANON STANDS ON ONE STEWARD AND ITS SEAL. `foldRealmBags` verifies every self-named steward's seal
 * and never that the hand holds the hearth's canon, so the Kahu canon counts only registrations sealed by one key of the
 * hearth's Kahu steward's LINE (one owner per registry; kahu.mem: kept by that one name, whose line a re-issue moves), and
 * re-seals under the line's head any an earlier key sealed. The registration the hearth KEEPS
 * stands first where it verifies, and lands on the registry again where no row there carries it; a bag the hearth keeps
 * none for stands on the steward's one counted document and is kept from then on, and the steward's seals over two
 * documents stand none (`equivocal`). A kept file stands only where it verifies. No reader recomputes the founding's
 * derivation: one leaf mints one document per bag, so the steward's seals name one document.
 */
async function standKahuRegistrations(
  realm: { doc(): LarDoc | undefined; change(fn: (d: LarDoc) => void): void }, sealHome: string, nexus: string, line: KahuStewardLine,
): Promise<{ readonly standing: ReadonlyMap<string, RealmBagRegistration>; readonly restored: readonly string[]; readonly equivocal: readonly string[] }> {
  const rows = await stewardRows(realm.doc(), nexus, line);
  const standing = new Map<string, RealmBagRegistration>();
  const restored: string[] = [], equivocal: string[] = [];
  for (const bagUri of KAHU_REALM_BAGS) {
    const onRegistry = rows.get(bagUri) ?? [];
    let kept = await keptRegistration(sealHome, nexus, bagUri, line);
    if (!kept) {
      if (new Set(onRegistry.map((rec) => rec.docUrl)).size > 1) { equivocal.push(bagUri); continue; }
      if (onRegistry.length === 0) continue;
      kept = onRegistry[0]!;
      keepRegistration(sealHome, kept);
    }
    // THE HEAD RE-SEALS. A registration an earlier key of the line sealed re-seals under the head, over the same document:
    // kept before it publishes, and the predecessor's row retires in the same change, so the registry names the head alone.
    const sealedBy = kept.keptBy[0]!.toLowerCase();
    if (sealedBy !== line.head) {
      const head = await line.signHead();
      try {
        const { realmId, docUrl, readTier, charters, expiry } = kept;
        const resealed = await signRealmBagRegistration({ realmId, bagUri, docUrl, readTier, ...(charters ? { charters } : {}), ...(expiry !== undefined ? { expiry } : {}) }, [head]);
        if (!(await realmBagRegistrationCounts(resealed, nexus))) throw new NexusCabalError(`the Kahu steward's head could not re-seal ${bagUri}: its seal does not verify`);
        keepRegistration(sealHome, resealed);
        realm.change((draft) => {
          writeRealmBagRegistration(draft, resealed, line.head, true);
          delete draft.tiddlers[realmBagKey(bagUri, sealedBy)];
        });
        kept = resealed;
        restored.push(bagUri);
      } finally { head.done(); }
      standing.set(bagUri, kept);
      continue;
    }
    standing.set(bagUri, kept);
    const bytes = canonicalJson(kept);
    if (!onRegistry.some((rec) => canonicalJson(rec) === bytes)) {
      realm.change((draft) => writeRealmBagRegistration(draft, kept!, line.head, true));
      restored.push(bagUri);
    }
  }
  return { standing, restored, equivocal };
}

/**
 * Land the Kahu realm at the founding: one live document per system bag (derived, `kahuBagDocUrl`), registered on the hearth's realm doc under
 * persona zero's per-Nexus key. Idempotent. Refuses (`NexusCabalError`) where this vessel holds no seated charter.
 */
export async function landKahuRealm(opts: {
  readonly repo: Repo; readonly sealHome: string;
  /** The steward's signer at the Nexus; absent, persona zero's per-Nexus key (minted where none stands). */
  readonly steward?: (nexusAid: string) => Promise<StewardSigner>;
}): Promise<{ readonly nexus: string; readonly docs: Required<KahuCanonDocs>; readonly registered: readonly string[] }> {
  const core = await cabalCore(opts.repo, opts.sealHome, undefined);
  const realm = await materializeSharedLarDoc(opts.repo, realmDocUrl(core.nexus), "realm");
  const line = await kahuStewardLine(opts.sealHome, core.nexus, core.handle.doc());
  if (line === null) throw new NexusCabalError("the Kahu steward's key line at this Nexus forks, or this face's key handed its standing on: no canon stands under a line that forks");
  const { standing, restored, equivocal } = await standKahuRegistrations(realm, opts.sealHome, core.nexus, line);
  // AN EQUIVOCAL REGISTRY IS NO ABSENCE: the steward's own seals naming two documents for a bag, with no kept copy to
  // pin one, refuse the founding rather than mint a replacement canon over them.
  if (equivocal.length > 0) {
    throw new NexusCabalError(`the Kahu realm's registry holds the steward's seals over two documents for ${equivocal.join(", ")}, and this hearth keeps no registration to pin one; restore the kept registration (<sealHome>/nexus/kahu-realm/) before founding again`);
  }
  const registered: string[] = [...restored];
  let signer: StewardSigner | null = null;
  for (const bagUri of KAHU_REALM_BAGS) {
    if (standing.has(bagUri)) continue;
    signer ??= opts.steward ? await opts.steward(core.nexus) : await line.signHead();
    const doc = await materializeSharedLarDoc(opts.repo, await kahuBagDocUrl(core.nexus, bagUri), bagUri);
    const rec = await signRealmBagRegistration({ realmId: core.nexus, bagUri, docUrl: doc.url, readTier: "contract" }, [signer]);
    if (!(await realmBagRegistrationCounts(rec, core.nexus))) throw new NexusCabalError(`the Kahu realm's registration of ${bagUri} counts nothing: the steward's seal does not verify`);
    // KEPT BEFORE IT IS PUBLISHED: no registry row of the steward's ever stands without the hearth's own copy.
    keepRegistration(opts.sealHome, rec);
    realm.change((draft) => writeRealmBagRegistration(draft, rec, signer!.signer, true));
    registered.push(bagUri);
  }
  if (signer && "done" in signer) (signer as { done: () => void }).done();
  const { standing: landed } = await standKahuRegistrations(realm, opts.sealHome, core.nexus, line);
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
  let core: Awaited<ReturnType<typeof cabalCore>>;
  try { core = await cabalCore(opts.repo, opts.sealHome, undefined, opts.vesselKey); }
  catch (err) { if (err instanceof NexusCabalError) return {}; throw err; }
  let group: string;
  try { group = kahuRealmGroup(opts.personaGroupId); } catch { return {}; }
  if (kahuCabalStanding(kahuCabalActsFromBoard(core.handle.doc()), group, core.roster, core.nexus).standing !== "admitted") return {};
  const realm = await materializeSharedLarDoc(opts.repo, realmDocUrl(core.nexus), "realm");
  const line = await kahuStewardLine(opts.sealHome, core.nexus, core.handle.doc());
  if (line === null) return {};
  const { standing, restored } = await standKahuRegistrations(realm, opts.sealHome, core.nexus, line);
  if (restored.length > 0) console.log(`[kahu-realm] the steward restored its own registration of ${restored.join(", ")} on the realm doc`);
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

/** The document ids of the live system documents this vessel holds: the Kahu canon a realm gate closes (road `P26`). */
export function kahuCanonDocIds(canon: KahuCanonDocs): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const url of [canon.lares, canon.lararium]) {
    if (!url) continue;
    try { ids.add(String(interpretAsDocumentId(url))); } catch { /* a malformed url names nothing */ }
  }
  return ids;
}

/**
 * KAHU REACH AT THE WIRE (road `P26`): a peer holds it at this hearth exactly where its session wears the custody face,
 * proven same-operator by this gate's grant ring, that face's own proof has passed, and the face's group stands ADMITTED
 * to the Kahu cabal as the board reads NOW (`watchKahuStanding`). A counted removal closes the wire at the board's next
 * change, never at the next boot (kahu.mem #/cabal-admission: a removal closes the access path for every reader that
 * consults it). The sentinel half of the predicate reads in the daemon island, whose write doors consult it; this wire
 * reads the admission, the act that closes access.
 *
 * Every other peer reads none, fail closed: a contracted member, a sibling, a place's seat, a session of another
 * face. A hand of ANOTHER admitted group stays open: across operators no wire proof binds a peer to a PersonaGroup
 * (the root map stays empty at the seat), and the sentinel half of the predicate reads in the daemon island, so such a
 * hand reaches the canon through the write doors of its own vessel's cabal, never this wire, until both stand.
 */
export function kahuHandAtWire(input: {
  readonly session: { readonly class: string; readonly face: { readonly personaGroup: string } | null } | undefined;
  readonly custodyGroup: string | null; readonly faceProven: boolean; readonly canon: KahuCanonDocs;
  /** The custody group's Kahu admission as the board reads NOW (`watchKahuStanding`), never the boot's snapshot. */
  readonly kahuStanding: boolean;
}): boolean {
  if (!input.kahuStanding || !input.faceProven || input.custodyGroup === null) return false;
  if (!input.canon.lares && !input.canon.lararium) return false;
  const session = input.session;
  if (!session || session.class !== "same-operator" || !session.face) return false;
  return session.face.personaGroup.toLowerCase() === input.custodyGroup.toLowerCase();
}

/**
 * THE CANON THE SAME-FACE BRIDGE NAMES (road `P26`): the keel's canon while the custody group's Kahu admission stands as
 * the board reads now, and none once a removal counts. The bridge returns ahead of the realm gate, so it reads the same
 * live standing the wire consult reads; a session it no longer names falls through to the realm gate, which answers the
 * canon to reach alone.
 */
export function kahuCanonAtWire(canon: KahuCanonDocs, kahuStanding: boolean): KahuCanonDocs {
  return kahuStanding ? canon : {};
}

/**
 * THE KAHU STANDING, LIVE (road `P26`): whether the custody group stands admitted to the Kahu cabal, read off the carriage
 * board as of its last sync and re-read on every board change, and on `refresh` (a charter import or roll moves the roster
 * the acts count under). `onChange` hears each flip, so the composer re-asks its cached share verdicts. A vessel with no
 * face, no seated charter or no readable group reads not admitted and never changes.
 */
export async function watchKahuStanding(opts: {
  readonly repo: Repo; readonly sealHome: string; readonly vesselKey: string; readonly personaGroupId: string | null;
  readonly onChange?: (held: boolean) => void;
}): Promise<{ held(): boolean; refresh(): void; close(): void }> {
  const inert = { held: () => false, refresh: () => {}, close: () => {} };
  if (opts.personaGroupId === null) return inert;
  let group: string;
  try { group = kahuRealmGroup(opts.personaGroupId); } catch { return inert; }
  let core: Awaited<ReturnType<typeof cabalCore>>;
  try { core = await cabalCore(opts.repo, opts.sealHome, undefined, opts.vesselKey); }
  catch (err) { if (err instanceof NexusCabalError) return inert; throw err; }
  const read = (): boolean => {
    try {
      const roster = foundingRoster(readNexusDoc(core.home));
      return kahuCabalStanding(kahuCabalActsFromBoard(core.handle.doc()), group, roster, core.nexus).standing === "admitted";
    } catch { return false; }
  };
  let held = read();
  let closed = false;
  const refresh = (): void => {
    if (closed) return;
    const now = read();
    if (now === held) return;
    held = now;
    try { opts.onChange?.(held); } catch { /* a listener never breaks the reading */ }
  };
  core.handle.on("change", refresh);
  return { held: () => held, refresh, close: () => { closed = true; core.handle.off("change", refresh); } };
}
