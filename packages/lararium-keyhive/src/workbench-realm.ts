/**
 * workbench-realm — EVERY WIKI'S WORKING LAYER RESTS IN A REALM WORKBENCH, kept by a private cabal of one human's faces
 * (cabal-realm#/the-workbench). The daemon wiki alone keeps its face-private working document.
 *
 * THE RULINGS (operator, 2026-11-11): "the multitude of faces reads as a private cabal for 1 human. Pattern integrities!" and
 * "Unpono, rip out old code, enact the full new design, early-alpha law holds." This module carries the Keyhive half:
 *
 *   · FOUND (`foundWorkbench`): a cabal realm under the seed charter, minted by `foundCabalRealm` with NO glamour and NO
 *     announce (no charter crosses any read-face, no row lands on any realm-announce board, no realm-bag registration), whose
 *     sentinel Document also keys the workbench's content: the provider adopts the wiki's working slot
 *     (`wikis/<slug>/working`) onto that one Document, so the realm's roster and the working layer's readers stay ONE list.
 *   · STAND (`standWorkbench`): a wiki's first stand under a face founds its private cabal of one (the owning face alone)
 *     and notes it in the vessel ledger; every later stand finds it there. Idempotent: a replay, reboot or retry lands nothing
 *     new, since the ledger row names the slug and the realm by content.
 *   · ADMIT (`admitWorkbenchFace`): a member face takes a Keyhive delegation on that Document, `admin` for a writer (the hand
 *     the house grants a face over a bag it writes) and `read` for a reader. The face's devices reach through the face.
 *   · REMOVE (`removeWorkbenchFace`): Keyhive's convergent revoke on the Document; the tombstone syncs, the key rolls past the
 *     face, and its later writes refuse (`requireWorkbenchWriter`). No lease, no epoch, no counter. A hard cut forks the realm.
 *   · LAND (`landWorkbench`): the share door's one call per `kind: "wiki"` row: stand the wiki's realm, seat each named face,
 *     revoke each face the vessel seated earlier that the row stopped naming.
 *
 * SCOPE: one vessel, one human's faces (2a). A face of ANOTHER operator (2b) joins once the realm's member consult answers for
 * a peer across operators (cabal-realm#/many-realms OWED: the root map nothing fills); `admitWorkbenchFace` already takes any
 * Keyhive agent the provider knows, so that seam opens at the consult and nowhere here.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/cabal-realm#/the-workbench
 */
import {
  ledgerWorkbenchRealm, noteWorkbench, realmWorkbenchDocUrl, requireWorkbenchShareable, wikiSlotUri, noteWorkbenchSeat,
  dropWorkbenchSeat, workbenchSeats, WorkbenchRefusal,
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
  const bag = wikiSlotUri(input.slug, "working");
  const realm = await foundCabalRealm(provider, bag, (id) => realmWorkbenchDocUrl(workbenchRealmIdOf(id), input.slug));
  // ONE ROSTER: the realm's Document keys the workbench's content, so a member of the realm reads the workbench and nobody else.
  provider.adoptBag(bag, realm.realmDocIdHex);
  const realmId = workbenchRealmIdOf(realm.realmDocIdHex);
  return { realm, realmId, docUrl: realmWorkbenchDocUrl(realmId, input.slug), bag };
}

/** Re-seat a known workbench on a provider that holds its Document (after a restart): the slot maps onto the realm's Document. */
export function adoptWorkbench(provider: KeyhiveProvider, slug: string, realmId: string): string {
  const bag = wikiSlotUri(slug, "working");
  provider.adoptBag(bag, `0x${workbenchRealmIdOf(realmId)}`);
  return bag;
}

/** ADMIT a face (a Keyhive agent the provider knows: exchange contact cards first). A writer takes `admin`, a reader `read`. */
export async function admitWorkbenchFace(
  provider: KeyhiveProvider, slug: string, faceAgentHex: string, access: "read" | "write",
): Promise<void> {
  await provider.delegate({ audience: faceAgentHex, bagUrl: wikiSlotUri(slug, "working"), access: access === "write" ? "admin" : "read" });
}

/** REMOVE a face: Keyhive's convergent revoke on the realm's Document. A face with no seat there reads as gone. */
export async function removeWorkbenchFace(provider: KeyhiveProvider, realmId: string, faceAgentHex: string): Promise<void> {
  await provider.revokeSentinelMember(faceAgentHex, `0x${workbenchRealmIdOf(realmId)}`);
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

/** A document as the ledger writes through it. */
export interface LedgerDoc {
  doc(): LarDoc | undefined;
  change(fn: (d: LarDoc) => void): void;
}

/**
 * STAND a wiki's realm: the ledger's realm for the slug, else a fresh private cabal of one founded by `provider` (the owning
 * face's hive, its founder the one seated member) and noted there. On a provider that has not yet mapped the working slot onto
 * the realm's Document, the slot adopts it. Two realms for one slug refuse `workbench-two-realms`; the daemon wiki refuses
 * `workbench-face-private`.
 */
export async function standWorkbench(provider: KeyhiveProvider, ledger: LedgerDoc, slug: string, face?: string): Promise<{ readonly realmId: string; readonly founded: boolean }> {
  requireWorkbenchShareable({ slug });
  const held = ledgerWorkbenchRealm(ledger.doc(), slug);
  if (held !== null) {
    if (provider.docIdOfBag(wikiSlotUri(slug, "working")) === null) adoptWorkbench(provider, slug, held);
    return { realmId: held, founded: false };
  }
  const f = await foundWorkbench(provider, { slug });
  // The founding face's own seat notes beside the realm, so its other devices sync the workbench through the wire guard.
  const founder = face !== undefined ? await provider.whoami() : null;
  ledger.change((d) => { noteWorkbench(d, f.realmId, slug); if (face !== undefined && founder !== null) noteWorkbenchSeat(d, f.realmId, slug, face, founder); });
  return { realmId: f.realmId, founded: true };
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
  /** True where the wiki's source stands in the checkout: a SHARED private wiki never projects into the tracked tree. */
  readonly checkoutSourced?: boolean;
}

/** What one landing did. */
export interface LandedWorkbench {
  readonly slug: string; readonly realmId: string; readonly docUrl: AutomergeUrl;
  readonly founded: boolean; readonly members: number;
  /** The faces a row stopped naming, whose seats this landing revoked. */
  readonly removed: readonly string[];
}

/**
 * LAND one wiki row: stand the wiki's realm (`standWorkbench`), seat each member face and note its seat, and revoke each face
 * the vessel seated earlier that the row no longer names (Keyhive's convergent revoke), dropping its note. A replay lands
 * nothing new: a seat that stands takes no second delegation, and a note that reads the same writes nothing.
 */
export async function landWorkbench(
  row: { readonly slug: string; readonly workspace?: string },
  members: readonly WorkbenchMember[],
  ports: LandWorkbenchPorts,
): Promise<LandedWorkbench> {
  requireWorkbenchShareable({ slug: row.slug, ...(ports.checkoutSourced !== undefined ? { checkoutSourced: ports.checkoutSourced } : {}), ...(row.workspace !== undefined ? { workspace: row.workspace } : {}) });
  const { realmId, founded } = await standWorkbench(ports.provider, ports.ledger, row.slug, ports.ownerFace);
  const named = new Set(members.map((m) => m.face));
  const removed: string[] = [];
  for (const [face, agentHex] of workbenchSeats(ports.ledger.doc(), realmId, row.slug)) {
    if (face === ports.ownerFace || named.has(face)) continue;
    await removeWorkbenchFace(ports.provider, realmId, agentHex);
    ports.ledger.change((d) => dropWorkbenchSeat(d, realmId, row.slug, face));
    removed.push(face);
  }
  for (const m of members) {
    if (!(await workbenchFaceHolds(ports.provider, row.slug, m.agentHex, m.access))) await admitWorkbenchFace(ports.provider, row.slug, m.agentHex, m.access);
    ports.ledger.change((d) => noteWorkbenchSeat(d, realmId, row.slug, m.face, m.agentHex));
  }
  const ownerAgent = await ports.provider.whoami();
  ports.ledger.change((d) => noteWorkbenchSeat(d, realmId, row.slug, ports.ownerFace, ownerAgent));
  return { slug: row.slug, realmId, docUrl: realmWorkbenchDocUrl(realmId, row.slug), founded, members: members.length, removed: removed.sort() };
}
