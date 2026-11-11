/**
 * workbench-realm — A PRIVATE CABAL OF ONE HUMAN'S FACES, keeping one shared wiki's working layer (cabal-realm#/the-workbench).
 *
 * THE RULING (operator, 2026-11-11): "the multitude of faces reads as a private cabal for 1 human. Pattern integrities!" A face
 * shares a wiki with its sibling faces through the cabal and realm machinery. This module carries the Keyhive half:
 *
 *   · FOUND (`foundWorkbench`): a cabal realm under the seed charter, minted by `foundCabalRealm` with NO glamour and NO
 *     announce (no charter crosses any read-face, no row lands on any realm-announce board, no realm-bag registration), whose
 *     sentinel Document also keys the workbench's content: the provider adopts the workbench slot (`wikis/<slug>/workbench`)
 *     onto that one Document, so the realm's roster and the workbench's readers stay ONE list.
 *   · ADMIT (`admitWorkbenchFace`): a member face takes a Keyhive delegation on that Document, `admin` for a writer (the hand
 *     the house grants a face over a bag it writes) and `read` for a reader. The face's devices reach through the face.
 *   · REMOVE (`removeWorkbenchFace`): Keyhive's convergent revoke on the Document; the tombstone syncs, the key rolls past the
 *     face, and its later writes refuse (`requireWorkbenchWriter`). No lease, no epoch, no counter. A hard cut forks the realm.
 *   · LIFT (`liftIntoWorkbench`): the founding face's private working document moves its content into the workbench ONCE,
 *     one way (precedent: `liftVesselOnlyIntoFace`); view state, session state and drafts stay where they rest.
 *   · LAND (`landWorkbench`): the share door's one call per `kind: "wiki"` row: found where the ledger names no realm,
 *     note the slug in the vessel ledger, admit each named face, lift once.
 *
 * SCOPE: one vessel, one human's faces (2a). A face of ANOTHER operator (2b) joins once the realm's member consult answers for
 * a peer across operators (cabal-realm#/many-realms OWED: the root map nothing fills); `admitWorkbenchFace` already takes any
 * Keyhive agent the provider knows, so that seam opens at the consult and nowhere here.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import {
  ledgerWorkbenchRealm, markWorkbenchLifted, noteWorkbench, realmWorkbenchDocUrl, requireWorkbenchShareable, workbenchAdmits,
  workbenchLifted, wikiWorkbenchUri, ownEntry, noteWorkbenchSeat, dropWorkbenchSeat, workbenchSeats, plainRecordOrNull, storedRecord, WorkbenchRefusal,
  type AutomergeUrl, type CabalRealm, type LarDoc,
} from "@lararium/mesh";
import { foundCabalRealm } from "./cabal-realm-ceremony.js";
import type { KeyhiveProvider } from "./keyhive-provider.js";

/** The realm id a workbench address reads: the sentinel Document's id as 64 lower-case hex (no `0x`). */
export function workbenchRealmIdOf(realmDocIdHex: string): string {
  return realmDocIdHex.trim().toLowerCase().replace(/^0x/, "");
}

/** A founded workbench: its realm, its realm id, its fixed address, and the slot the provider adopted onto the realm's Document. */
export interface FoundedWorkbench {
  readonly realm: CabalRealm;
  readonly realmId: string;
  readonly docUrl: AutomergeUrl;
  readonly bag: string;
}

/**
 * FOUND a private cabal for one wiki's workbench. The shareable gate runs first (the daemon wiki, a checkout-sourced slug and a
 * malformed workspace each refuse by name, before any Document mints). No glamour projects and no announce writes.
 */
export async function foundWorkbench(
  provider: KeyhiveProvider,
  input: { readonly slug: string; readonly checkoutSourced?: boolean; readonly workspace?: string },
): Promise<FoundedWorkbench> {
  requireWorkbenchShareable(input);
  const bag = wikiWorkbenchUri(input.slug);
  const realm = await foundCabalRealm(provider, bag, (id) => realmWorkbenchDocUrl(workbenchRealmIdOf(id), input.slug));
  // ONE ROSTER: the realm's Document keys the workbench's content, so a member of the realm reads the workbench and nobody else.
  provider.adoptBag(bag, realm.realmDocIdHex);
  const realmId = workbenchRealmIdOf(realm.realmDocIdHex);
  return { realm, realmId, docUrl: realmWorkbenchDocUrl(realmId, input.slug), bag };
}

/** Re-seat a known workbench on a provider that holds its Document (after a restart): the slot maps onto the realm's Document. */
export function adoptWorkbench(provider: KeyhiveProvider, slug: string, realmId: string): string {
  const bag = wikiWorkbenchUri(slug);
  provider.adoptBag(bag, `0x${workbenchRealmIdOf(realmId)}`);
  return bag;
}

/** ADMIT a face (a Keyhive agent the provider knows: exchange contact cards first). A writer takes `admin`, a reader `read`. */
export async function admitWorkbenchFace(
  provider: KeyhiveProvider, slug: string, faceAgentHex: string, access: "read" | "write",
): Promise<void> {
  await provider.delegate({ audience: faceAgentHex, bagUrl: wikiWorkbenchUri(slug), access: access === "write" ? "admin" : "read" });
}

/** REMOVE a face: Keyhive's convergent revoke on the realm's Document. A face with no seat there reads as gone. */
export async function removeWorkbenchFace(provider: KeyhiveProvider, realmId: string, faceAgentHex: string): Promise<void> {
  await provider.revokeSentinelMember(faceAgentHex, `0x${workbenchRealmIdOf(realmId)}`);
}

/** Whether a face reads (any grant) or writes (`admin`) the workbench on this replica now. */
export async function workbenchFaceHolds(provider: KeyhiveProvider, slug: string, faceAgentHex: string, want: "read" | "write"): Promise<boolean> {
  const v = await provider.verify({ bagUrl: wikiWorkbenchUri(slug), presenter: faceAgentHex, access: want === "write" ? "admin" : "read" });
  return v.ok;
}

/** A write from a face the realm does not hold as a writer refuses `workbench-not-a-member`, before any byte moves. */
export async function requireWorkbenchWriter(provider: KeyhiveProvider, slug: string, faceAgentHex: string): Promise<void> {
  if (!(await workbenchFaceHolds(provider, slug, faceAgentHex, "write"))) {
    throw new WorkbenchRefusal("workbench-not-a-member", `the face ${faceAgentHex.slice(0, 18)}… holds no writer's seat in the workbench of "${slug}"`);
  }
}

/** A document as the lift touches it. */
export interface LiftDoc {
  doc(): LarDoc | undefined;
  change(fn: (d: LarDoc) => void): void;
}

/** What one lift moved. `lifted: false` names a lift that already ran (the ledger's one-shot mark). */
export interface WorkbenchLift { readonly lifted: boolean; readonly moved: readonly string[]; readonly kept: readonly string[] }

/**
 * LIFT the founding face's private working document into the workbench, ONCE and one way. Each record the workbench admits
 * (`workbenchAdmits`: never view state, session state or a draft) copies across (a title the workbench already holds keeps the
 * workbench's record) and then leaves the working document, so the private overlay never shadows what it shared. The ledger's
 * mark lands last: a lift cut short re-runs and finds the copies standing, so it converges on the same end. Records the
 * workbench refuses stay in the working document, private.
 */
export function liftIntoWorkbench(input: {
  readonly working: LiftDoc;
  readonly workbench: LiftDoc;
  readonly ledger: LiftDoc;
  readonly realmId: string;
  readonly slug: string;
  readonly byFace: string;
  readonly isPersonal: (title: string) => boolean;
}): WorkbenchLift {
  if (workbenchLifted(input.ledger.doc(), input.realmId, input.slug)) return { lifted: false, moved: [], kept: [] };
  const moved: string[] = [], kept: string[] = [];
  const held = input.working.doc()?.tiddlers ?? {};
  const copies = new Map<string, ReturnType<typeof plainRecordOrNull>>();
  for (const title of Object.keys(held)) {
    const plain = plainRecordOrNull(ownEntry(held, title) as never);
    if (plain === null) continue;
    const fields = (plain as { tiddler?: Record<string, unknown> }).tiddler ?? {};
    if (!workbenchAdmits(title, fields, input.isPersonal)) { kept.push(title); continue; }
    copies.set(title, plain);
  }
  if (copies.size > 0) {
    input.workbench.change((d) => {
      for (const [title, plain] of copies) if (ownEntry(d.tiddlers, title) === undefined) d.tiddlers[title] = storedRecord(plain as never) as never;
    });
    input.working.change((d) => { for (const title of copies.keys()) delete d.tiddlers[title]; });
    moved.push(...copies.keys());
  }
  input.ledger.change((d) => markWorkbenchLifted(d, input.realmId, input.slug, input.byFace));
  return { lifted: true, moved: moved.sort(), kept: kept.sort() };
}

/** One member face as the land reads it: its PersonaGroup, its Keyhive agent id on the owner's provider, and its access. */
export interface WorkbenchMember { readonly face: string; readonly agentHex: string; readonly access: "read" | "write" }

/** The ports one `kind: "wiki"` row's landing reaches. */
export interface LandWorkbenchPorts {
  /** The owner face's provider: it founds the realm and seats each member. */
  readonly provider: KeyhiveProvider;
  /** The vessel's own ledger (`edgeLedgerDocUrl`). */
  readonly ledger: LiftDoc;
  /** Find or materialize the workbench document at its fixed address. */
  readonly workbench: (url: AutomergeUrl) => Promise<LiftDoc>;
  /** The owner face's private working document for the slug, or null where none stands (nothing to lift). */
  readonly ownerWorking: () => Promise<LiftDoc | null>;
  readonly ownerFace: string;
  readonly isPersonal: (title: string) => boolean;
  readonly checkoutSourced?: boolean;
}

/** What one landing did. */
export interface LandedWorkbench {
  readonly slug: string; readonly realmId: string; readonly docUrl: AutomergeUrl;
  readonly founded: boolean; readonly lifted: boolean; readonly members: number;
  /** The faces a row stopped naming, whose seats this landing revoked. */
  readonly removed: readonly string[];
}

/**
 * LAND one wiki row: the ledger's realm for the slug, else a fresh private cabal noted there (one wiki, one realm: a second
 * refuses `workbench-two-realms`); each member face seated and its seat noted; a face the vessel seated earlier that the row
 * no longer names revoked (Keyhive's convergent revoke) and its note dropped; the owner's working document lifted in once.
 */
export async function landWorkbench(
  row: { readonly slug: string; readonly workspace?: string },
  members: readonly WorkbenchMember[],
  ports: LandWorkbenchPorts,
): Promise<LandedWorkbench> {
  requireWorkbenchShareable({ slug: row.slug, ...(ports.checkoutSourced !== undefined ? { checkoutSourced: ports.checkoutSourced } : {}), ...(row.workspace !== undefined ? { workspace: row.workspace } : {}) });
  let realmId = ledgerWorkbenchRealm(ports.ledger.doc(), row.slug);
  let founded = false;
  if (realmId === null) {
    const f = await foundWorkbench(ports.provider, { slug: row.slug, ...(ports.checkoutSourced !== undefined ? { checkoutSourced: ports.checkoutSourced } : {}) });
    realmId = f.realmId;
    founded = true;
    const id = realmId;
    ports.ledger.change((d) => noteWorkbench(d, id, row.slug));
  } else if (ports.provider.docIdOfBag(wikiWorkbenchUri(row.slug)) === null) {
    adoptWorkbench(ports.provider, row.slug, realmId);
  }
  const named = new Set(members.map((m) => m.face));
  const removed: string[] = [];
  for (const [face, agentHex] of workbenchSeats(ports.ledger.doc(), realmId, row.slug)) {
    if (face === ports.ownerFace || named.has(face)) continue;
    await removeWorkbenchFace(ports.provider, realmId, agentHex);
    const id = realmId;
    ports.ledger.change((d) => dropWorkbenchSeat(d, id, row.slug, face));
    removed.push(face);
  }
  for (const m of members) {
    if (!(await workbenchFaceHolds(ports.provider, row.slug, m.agentHex, m.access))) await admitWorkbenchFace(ports.provider, row.slug, m.agentHex, m.access);
    const id = realmId;
    ports.ledger.change((d) => noteWorkbenchSeat(d, id, row.slug, m.face, m.agentHex));
  }
  const ownerAgent = await ports.provider.whoami();
  { const id = realmId; ports.ledger.change((d) => noteWorkbenchSeat(d, id, row.slug, ports.ownerFace, ownerAgent)); }
  const docUrl = realmWorkbenchDocUrl(realmId, row.slug);
  let lifted = false;
  if (!workbenchLifted(ports.ledger.doc(), realmId, row.slug)) {
    const working = await ports.ownerWorking();
    const workbench = await ports.workbench(docUrl);
    if (working) lifted = liftIntoWorkbench({ working, workbench, ledger: ports.ledger, realmId, slug: row.slug, byFace: ports.ownerFace, isPersonal: ports.isPersonal }).lifted;
    else ports.ledger.change((d) => markWorkbenchLifted(d, realmId!, row.slug, ports.ownerFace));
  }
  return { slug: row.slug, realmId, docUrl, founded, lifted, members: members.length, removed: removed.sort() };
}
