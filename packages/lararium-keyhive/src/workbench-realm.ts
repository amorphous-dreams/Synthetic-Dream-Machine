/**
 * workbench-realm — EVERY WIKI'S WORKING LAYER RESTS IN A REALM WORKBENCH, kept by a private cabal of one human's faces
 * (cabal-realm#/the-workbench). The daemon wiki alone keeps its face-private working document.
 *
 * THE RULINGS (operator, 2026-11-11): "the multitude of faces reads as a private cabal for 1 human. Pattern integrities!" and
 * "Unpono, rip out old code, enact the full new design, early-alpha law holds." This module carries the Keyhive half:
 *
 *   · THE NAME CONVERGES (`privateCabalRealmId`, mesh): a private cabal of one takes a realm id derived from the owning face
 *     and the wiki's NFC slug, so two devices of one face that stand the wiki offline name one realm and one workbench address,
 *     and their islands converge with no person settling a tie.
 *   · THE KEY STAYS LOCAL (`foundWorkbench`): Keyhive mints a Document's identity from a fresh signing key, and no input
 *     derives it, so each vessel mints its own sentinel Document for the derived realm (through `foundCabalRealm`, with NO
 *     glamour and NO announce) and adopts the wiki's working slot (`wikis/<slug>/working`) onto it: that vessel's roster and
 *     its readers of the layer stay ONE list. The vessel's ledger names the Document (`noteWorkbenchKey`).
 *   · STAND (`standWorkbench`): a wiki's first stand under a face notes the derived realm and founds this vessel's key
 *     Document; every later stand finds both. A replay, reboot or retry lands nothing new: every row names its content.
 *   · ONE WORKBENCH ON A VESSEL, AND THE SEAT DECIDES THE MOUNT (`seatedWorkbenches`, `faceWorkbenchRealm`): one vessel's
 *     ledger serves every face it holds and binds a slug to ONE realm, the cabal of the first face that stood the wiki. A
 *     face mounts the realm whose OWN key Document seats that face's hive (read on that Document, never on whichever
 *     Document the hive maps the slot's bag to); a face no realm seats mounts none and founds none for a slug the ledger
 *     already binds (`workbench-slug-bound`): it writes its own `personal` layer. Two seats refuse `workbench-two-realms`.
 *   · THE SEAT READS ITS HAND (`workbenchWriterSeat`): `admin` writes the workbench, `read` reads it and writes `personal`.
 *   · ADMIT / REMOVE: a member face takes a Keyhive delegation on the key Document (`admin` writer, `read` reader); a removal
 *     rides Keyhive's convergent revoke. No lease, no epoch, no counter. A hard cut forks the realm.
 *   · THE ROSTER'S PROJECTION (`projectWorkbenchRoster`): the ledger's seat rows mirror what the key Document answers on this
 *     replica, written by this function alone. Keyhive owns membership; a thread with no hive (the wire guard) reads the
 *     mirror and withholds where a row stands absent.
 *   · LAND (`landWorkbench`): the share door's one call per `kind: "wiki"` row: stand, seat each named face, revoke each face
 *     the roster seats that the row stopped naming, then project the roster.
 *
 * SCOPE: one vessel, one human's faces (2a). A face of ANOTHER operator (2b) joins once the realm's member consult answers for
 * a peer across operators (cabal-realm#/many-realms OWED: the root map nothing fills); `admitWorkbenchFace` already takes any
 * Keyhive agent the provider knows, so that seam opens at the consult and nowhere here.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import {
  dropWorkbench, ledgerWorkbenchRealms, noteWorkbench, noteWorkbenchKey, privateCabalRealmId, realmWorkbenchDocUrl, requireWorkbenchShareable,
  wikiSlotUri, noteWorkbenchSeat, dropWorkbenchSeat, workbenchKeyDocs, workbenchSeats, WorkbenchRefusal,
  type AutomergeUrl, type CabalRealm, type LarDoc,
} from "@lararium/mesh";
import { foundCabalRealm } from "./cabal-realm-ceremony.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";

const bare = (hex: string): string => hex.trim().toLowerCase().replace(/^0x/, "");

/** A document as the ledger writes through it. */
export interface LedgerDoc {
  doc(): LarDoc | undefined;
  change(fn: (d: LarDoc) => void): void;
}

/** A founded workbench key: the realm it keys, the derived realm id, the fixed address, and this vessel's key Document. */
export interface FoundedWorkbench {
  readonly realm: CabalRealm;
  readonly realmId: string;
  readonly docUrl: AutomergeUrl;
  /** This vessel's sentinel Document id (64 hex): the Document the working slot adopts here. */
  readonly keyDoc: string;
}

/**
 * FOUND this vessel's key Document for a face's private cabal of one: the realm id derives from the face and the slug, the
 * sentinel Document mints fresh (no glamour, no announce), and the working slot adopts it. The shareable gate runs first.
 */
export async function foundWorkbench(
  provider: KeyhiveProvider,
  input: { readonly slug: string; readonly face: string; readonly checkoutSourced?: boolean; readonly workspace?: string },
): Promise<FoundedWorkbench> {
  requireWorkbenchShareable(input);
  const realmId = privateCabalRealmId(input.face, input.slug);
  const docUrl = realmWorkbenchDocUrl(realmId, input.slug);
  const realm = await foundCabalRealm(provider, wikiSlotUri(input.slug, "working"), () => docUrl);
  provider.adoptBag(wikiSlotUri(input.slug, "working"), realm.realmDocIdHex);
  return { realm, realmId, docUrl, keyDoc: bare(realm.realmDocIdHex) };
}

/** Re-seat a known key Document on a provider after a restart: the working slot maps onto it again. */
export function adoptWorkbench(provider: KeyhiveProvider, slug: string, keyDoc: string): void {
  provider.adoptBag(wikiSlotUri(slug, "working"), `0x${bare(keyDoc)}`);
}

/**
 * THE WORKING BAG RIDES THE REALM'S KEY DOCUMENT, FOR EVERY SEATED FACE. A composition registers the slots of the wiki a face
 * mounts on a Document of that face's own, so a seated hive may map the working bag elsewhere when the mount asks: the seat
 * moves the mapping onto the realm's key Document, where the roster, the write gate and the content key of the ONE shared
 * layer all read. Without it a share's delegation lands on the owner's own bag Document and seats nobody in the realm.
 */
function rideKeyDoc(provider: KeyhiveProvider, slug: string, keyDoc: string): void {
  if (bare(provider.docIdOfBag(wikiSlotUri(slug, "working")) ?? "") !== bare(keyDoc)) adoptWorkbench(provider, slug, keyDoc);
}

/** ADMIT a face (a Keyhive agent the provider knows: exchange contact cards first). A writer takes `admin`, a reader `read`. */
export async function admitWorkbenchFace(provider: KeyhiveProvider, slug: string, faceAgentHex: string, access: "read" | "write"): Promise<void> {
  await provider.delegate({ audience: faceAgentHex, bagUrl: wikiSlotUri(slug, "working"), access: access === "write" ? "admin" : "read" });
}

/** REMOVE a face: Keyhive's convergent revoke on this vessel's key Document. */
export async function removeWorkbenchFace(provider: KeyhiveProvider, keyDoc: string, faceAgentHex: string): Promise<void> {
  await provider.revokeSentinelMember(faceAgentHex, `0x${bare(keyDoc)}`);
}

/** Whether a face reads (any grant) or writes (`admin`) the workbench on this replica now. */
export async function workbenchFaceHolds(provider: KeyhiveProvider, slug: string, faceAgentHex: string, want: "read" | "write"): Promise<boolean> {
  const v = await provider.verify({ bagUrl: wikiSlotUri(slug, "working"), presenter: faceAgentHex, access: want === "write" ? "admin" : "read" });
  return v.ok;
}

/** A write from a face the realm does not hold as a writer refuses `workbench-not-a-member`, before any byte moves. */
export async function requireWorkbenchWriter(provider: KeyhiveProvider, slug: string, faceAgentHex: string): Promise<void> {
  if (!(await workbenchFaceHolds(provider, slug, faceAgentHex, "write"))) {
    throw new WorkbenchRefusal("workbench-not-a-member", `the face ${faceAgentHex.slice(0, 18)}… holds no writer's seat in the workbench of "${slug}"`);
  }
}

/** One realm that seats a hive for a slug: the realm, and the key Document of it that this hive reads the seat on. */
export interface SeatedWorkbench { readonly realmId: string; readonly keyDoc: string }

/**
 * THE REALMS THAT SEAT THIS HIVE for `slug`: each realm the ledger binds the slug under, kept where one of the key Documents
 * the ledger names for it seats this hive's own agent, AS THIS HIVE'S REPLICA READS THAT DOCUMENT. The reading asks the
 * realm's own Document: a hive maps the working slot's bag to a Document of its own at every composition, where it always
 * holds a hand, so a reading through the bag would seat every face in every realm.
 */
export async function seatedWorkbenches(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, slug: string): Promise<SeatedWorkbench[]> {
  const self = await provider.whoami();
  const out: SeatedWorkbench[] = [];
  for (const realmId of ledgerWorkbenchRealms(ledger, slug)) {
    for (const keyDoc of workbenchKeyDocs(ledger, realmId, slug)) {
      if (await provider.seatedInDoc(self, keyDoc)) { out.push({ realmId, keyDoc }); break; }
    }
  }
  return out;
}

/** The one realm that seats this hive for `slug`, or null where none does. Two refuse `workbench-two-realms`: a tie never grants. */
async function seatedWorkbench(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, slug: string): Promise<SeatedWorkbench | null> {
  const seated = await seatedWorkbenches(provider, ledger, slug);
  if (seated.length > 1) {
    throw new WorkbenchRefusal("workbench-two-realms", `this face holds a seat in ${seated.length} realms for "${slug}" (${seated.map((r) => r.realmId.slice(0, 12)).join(", ")}…); leave one before the wiki mounts its workbench`);
  }
  return seated[0] ?? null;
}

/** Whether the ledger binds `slug` under a realm other than `face`'s own derived cabal: another face of this vessel owns the workbench. */
function boundElsewhere(ledger: LarDoc | undefined | null, slug: string, face: string): boolean {
  const own = privateCabalRealmId(face, slug);
  return ledgerWorkbenchRealms(ledger, slug).some((realmId) => realmId !== own);
}

/**
 * STAND a wiki's realm under `face`: the realm that already seats this face's hive (its own cabal on a later stand, or one a
 * share seated it in), else the face's derived private cabal of one, noted. This vessel's key Document stands too: the one
 * the ledger names that seats this hive (adopted where the hive has not mapped the slot), else a fresh one founded and
 * named. The founder's seat projects. A face seated in two realms for one slug refuses `workbench-two-realms`; the daemon
 * wiki refuses `workbench-face-private`. A face that holds no seat founds no second realm for a slug the ledger already
 * binds to another face's cabal: it refuses `workbench-slug-bound` (ONE workbench stands for a wiki on a vessel).
 */
export async function standWorkbench(provider: KeyhiveProvider, ledger: LedgerDoc, slug: string, face: string): Promise<{ readonly realmId: string; readonly founded: boolean; readonly keyDoc: string }> {
  requireWorkbenchShareable({ slug });
  const seated = await seatedWorkbench(provider, ledger.doc(), slug);
  if (seated !== null) {
    rideKeyDoc(provider, slug, seated.keyDoc);
    return { realmId: seated.realmId, founded: false, keyDoc: seated.keyDoc };
  }
  if (boundElsewhere(ledger.doc(), slug, face)) {
    throw new WorkbenchRefusal("workbench-slug-bound", `the workbench of "${slug}" stands on this vessel under another face's realm, and this face holds no seat there; it writes its own personal layer of the wiki until a share seats it`);
  }
  const realmId = privateCabalRealmId(face, slug);
  const noted = ledgerWorkbenchRealms(ledger.doc(), slug).includes(realmId);
  const f = await foundWorkbench(provider, { slug, face });
  const founder = await provider.whoami();
  ledger.change((d) => {
    noteWorkbench(d, realmId, slug);
    noteWorkbenchKey(d, realmId, slug, f.keyDoc);
    noteWorkbenchSeat(d, realmId, slug, face, founder);
  });
  return { realmId, founded: !noted, keyDoc: f.keyDoc };
}

/** Who stands a slug's workbench on this vessel, read for one face: every realm the ledger binds it under, and the face's own. */
export interface WorkbenchOwnership {
  readonly bound: readonly string[];
  /** The face's own derived cabal of one for the slug (`privateCabalRealmId`). */
  readonly own: string;
}

/** Read who stands a slug's workbench for `face`: it reads alone and founds nothing. */
export function workbenchOwnership(ledger: LarDoc | undefined | null, slug: string, face: string): WorkbenchOwnership {
  return { bound: ledgerWorkbenchRealms(ledger, slug), own: privateCabalRealmId(face, slug) };
}

/**
 * RETIRE a face's workbench of `slug` (`lares wiki retire`, the owner face's hand): the ledger's rows binding the slug to the
 * face's OWN cabal (the binding, its key Documents, its seats) leave, so a later stand by any face founds afresh and none meets
 * `workbench-slug-bound` (the face's hive forgets the working slot's Document through `wikiShellPorts`' `forget`). A slug the ledger binds under another face's
 * realm refuses `workbench-slug-bound` and drops nothing: only the owner retires its workbench. The key Document's capability
 * events stay where they rest; nothing here revokes or deletes one.
 */
export function retireWorkbench(ledger: LedgerDoc, slug: string, face: string): { readonly realmId: string | null; readonly dropped: readonly string[] } {
  const { bound, own } = workbenchOwnership(ledger.doc(), slug, face);
  if (bound.some((realmId) => realmId !== own)) {
    throw new WorkbenchRefusal("workbench-slug-bound", `the workbench of "${slug}" stands on this vessel under another face's realm; that face retires it`);
  }
  let dropped: string[] = [];
  if (bound.includes(own)) ledger.change((d) => { dropped = dropWorkbench(d, own, slug); });
  return { realmId: bound.includes(own) ? own : null, dropped };
}

/**
 * THE WORKBENCH PORT UNDER ONE FACE: the realm a wiki's working layer rests in for `face`, read off the vessel's ledger through
 * the face's own hive. The realm that seats the hive answers (`seatedWorkbenches`). Where none does, a `mint` founds the
 * face's own private cabal of one (`standWorkbench`) ONLY for a slug the ledger binds to no other face's realm; a slug another
 * face of the vessel already stands answers null, mint or no mint, and a read answers null. One vessel holds every face's
 * documents, so the seat gates the mount here as the guard gates the wire: a face never mounts a workbench whose Document
 * seats it nowhere, and it founds no second one.
 */
export async function faceWorkbenchRealm(provider: KeyhiveProvider, ledger: LedgerDoc, slug: string, face: string, mint: boolean): Promise<string | null> {
  const seated = await seatedWorkbench(provider, ledger.doc(), slug);
  if (seated === null) return mint && !boundElsewhere(ledger.doc(), slug, face) ? (await standWorkbench(provider, ledger, slug, face)).realmId : null;
  rideKeyDoc(provider, slug, seated.keyDoc);
  // The mount reads the roster, so the roster's projection follows it (one owner: Keyhive).
  await projectWorkbenchRoster(provider, ledger, seated.realmId, slug, new Map([[face, await provider.whoami()]])).catch(() => [] as readonly string[]);
  return seated.realmId;
}

/**
 * WHETHER A WRITE FROM `face` FOUNDS THE WORKBENCH of `slug`: no realm seats this hive, and the ledger binds the slug under no
 * other face's realm, so the face's first stand founds its private cabal of one (`faceWorkbenchRealm` with `mint`) and the write
 * lands in the workbench. It reads alone and founds nothing.
 */
export async function workbenchFoundsOnWrite(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, slug: string, face: string): Promise<boolean> {
  return (await seatedWorkbenches(provider, ledger, slug)).length === 0 && !boundElsewhere(ledger, slug, face);
}

/**
 * WHETHER THIS HIVE HOLDS A WRITER'S SEAT in the workbench of `slug`: the realm that seats it, read on that realm's own key
 * Document, answers `admin`. A reader's seat, no seat, and two seats all answer false: such a face writes its own `personal`
 * layer of the wiki and never the workbench.
 */
export async function workbenchWriterSeat(provider: KeyhiveProvider, ledger: LarDoc | undefined | null, slug: string): Promise<boolean> {
  const seated = await seatedWorkbenches(provider, ledger, slug);
  if (seated.length !== 1) return false;
  return (await provider.accessInDoc(await provider.whoami(), seated[0]!.keyDoc)) === "admin";
}

/**
 * PROJECT THE ROSTER: for each candidate face (its PersonaGroup → the agent this hive knows it by), the seat row stands where
 * the realm's key Document seats the agent on this replica, and leaves where it does not. Keyhive answers; the ledger mirrors
 * it. The reading asks the key Document the ledger names that seats this hive, else (a replica that adopted the key and
 * noted no row of it) the Document the hive maps the slot to. Rows whose face no candidate names read again through the
 * agent they carry. Returns the faces the projection holds.
 */
export async function projectWorkbenchRoster(
  provider: KeyhiveProvider, ledger: LedgerDoc, realmId: string, slug: string, candidates: ReadonlyMap<string, string> = new Map(),
): Promise<readonly string[]> {
  const self = await provider.whoami();
  let rosterDoc: string | null = null;
  for (const keyDoc of workbenchKeyDocs(ledger.doc(), realmId, slug)) if (await provider.seatedInDoc(self, keyDoc)) { rosterDoc = keyDoc; break; }
  rosterDoc ??= provider.docIdOfBag(wikiSlotUri(slug, "working"));
  const all = new Map<string, string>([...workbenchSeats(ledger.doc(), realmId, slug), ...candidates]);
  const held: string[] = [];
  for (const [face, agentHex] of all) {
    const seated = rosterDoc !== null && await provider.seatedInDoc(agentHex, rosterDoc);
    if (seated) { held.push(face); ledger.change((d) => noteWorkbenchSeat(d, realmId, slug, face, agentHex)); }
    else ledger.change((d) => dropWorkbenchSeat(d, realmId, slug, face));
  }
  return held.sort();
}

/** One member face as the land reads it: its PersonaGroup, its Keyhive agent id on the owner's provider, and its access. */
export interface WorkbenchMember { readonly face: string; readonly agentHex: string; readonly access: "read" | "write" }

/** The ports one `kind: "wiki"` row's landing reaches. */
export interface LandWorkbenchPorts {
  /** The owner face's provider: it stands the realm and seats each member. */
  readonly provider: KeyhiveProvider;
  /** The vessel's own ledger (`edgeLedgerDocUrl` under the vessel's place key). */
  readonly ledger: LedgerDoc;
  readonly ownerFace: string;
  /** True where the wiki's canon stands in the canon source: its one workbench folder rests beside that source and takes no workspace. */
  readonly checkoutSourced?: boolean;
}

/** What one landing did. */
export interface LandedWorkbench {
  readonly slug: string; readonly realmId: string; readonly docUrl: AutomergeUrl;
  readonly founded: boolean; readonly members: number;
  /** How many members this landing seated that the roster did not already hold: a replay seats none. */
  readonly seated: number;
  /** The faces a row stopped naming, whose seats this landing revoked. */
  readonly removed: readonly string[];
}

/**
 * LAND one wiki row: stand the wiki's realm, seat each member face, revoke each face the roster seats that the row now leaves
 * unnamed (Keyhive's convergent revoke), then project the roster into the ledger. A replay lands nothing new.
 */
export async function landWorkbench(
  row: { readonly slug: string; readonly workspace?: string },
  members: readonly WorkbenchMember[],
  ports: LandWorkbenchPorts,
): Promise<LandedWorkbench> {
  requireWorkbenchShareable({ slug: row.slug, ...(ports.checkoutSourced !== undefined ? { checkoutSourced: ports.checkoutSourced } : {}), ...(row.workspace !== undefined ? { workspace: row.workspace } : {}) });
  const { realmId, founded, keyDoc } = await standWorkbench(ports.provider, ports.ledger, row.slug, ports.ownerFace);
  const named = new Set(members.map((m) => m.face));
  const removed: string[] = [];
  for (const [face, agentHex] of workbenchSeats(ports.ledger.doc(), realmId, row.slug)) {
    if (face === ports.ownerFace || named.has(face)) continue;
    await removeWorkbenchFace(ports.provider, keyDoc, agentHex);
    removed.push(face);
  }
  let seated = 0;
  for (const m of members) {
    if (!(await workbenchFaceHolds(ports.provider, row.slug, m.agentHex, m.access))) { await admitWorkbenchFace(ports.provider, row.slug, m.agentHex, m.access); seated++; }
  }
  const candidates = new Map<string, string>([[ports.ownerFace, await ports.provider.whoami()], ...members.map((m) => [m.face, m.agentHex] as [string, string])]);
  await projectWorkbenchRoster(ports.provider, ports.ledger, realmId, row.slug, candidates);
  return { slug: row.slug, realmId, docUrl: realmWorkbenchDocUrl(realmId, row.slug), founded, members: members.length, seated, removed: removed.sort() };
}
