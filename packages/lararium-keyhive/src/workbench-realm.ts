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
  ledgerWorkbenchRealm, noteWorkbench, noteWorkbenchKey, privateCabalRealmId, realmWorkbenchDocUrl, requireWorkbenchShareable,
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

/**
 * STAND a wiki's realm under `face`: the ledger's realm for the slug, else the face's derived private cabal of one, noted.
 * This vessel's key Document stands too: the one its ledger names (adopted where the hive has not mapped it), else a fresh
 * one founded and named. The founder's seat projects. Two realms for one slug refuse `workbench-two-realms`; the daemon wiki
 * refuses `workbench-face-private`.
 */
export async function standWorkbench(provider: KeyhiveProvider, ledger: LedgerDoc, slug: string, face: string): Promise<{ readonly realmId: string; readonly founded: boolean; readonly keyDoc: string }> {
  requireWorkbenchShareable({ slug });
  const held = ledgerWorkbenchRealm(ledger.doc(), slug);
  const realmId = held ?? privateCabalRealmId(face, slug);
  const keys = workbenchKeyDocs(ledger.doc(), realmId, slug);
  if (keys.length > 0) {
    if (provider.docIdOfBag(wikiSlotUri(slug, "working")) === null) adoptWorkbench(provider, slug, keys[0]!);
    if (held === null) ledger.change((d) => noteWorkbench(d, realmId, slug));
    return { realmId, founded: false, keyDoc: keys[0]! };
  }
  const f = await foundWorkbench(provider, { slug, face });
  const founder = await provider.whoami();
  ledger.change((d) => {
    noteWorkbench(d, realmId, slug);
    noteWorkbenchKey(d, realmId, slug, f.keyDoc);
    noteWorkbenchSeat(d, realmId, slug, face, founder);
  });
  return { realmId, founded: held === null, keyDoc: f.keyDoc };
}

/**
 * PROJECT THE ROSTER: for each candidate face (its PersonaGroup → the agent this hive knows it by), the seat row stands where
 * the key Document seats the agent on this replica, and leaves where it does not. Keyhive answers; the ledger mirrors it. Rows
 * whose face no candidate names read again through the agent they carry. Returns the faces the projection holds.
 */
export async function projectWorkbenchRoster(
  provider: KeyhiveProvider, ledger: LedgerDoc, realmId: string, slug: string, candidates: ReadonlyMap<string, string> = new Map(),
): Promise<readonly string[]> {
  const all = new Map<string, string>([...workbenchSeats(ledger.doc(), realmId, slug), ...candidates]);
  const held: string[] = [];
  for (const [face, agentHex] of all) {
    const seated = await workbenchFaceHolds(provider, slug, agentHex, "read").catch(() => false);
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
  for (const m of members) {
    if (!(await workbenchFaceHolds(ports.provider, row.slug, m.agentHex, m.access))) await admitWorkbenchFace(ports.provider, row.slug, m.agentHex, m.access);
  }
  const candidates = new Map<string, string>([[ports.ownerFace, await ports.provider.whoami()], ...members.map((m) => [m.face, m.agentHex] as [string, string])]);
  await projectWorkbenchRoster(ports.provider, ports.ledger, realmId, row.slug, candidates);
  return { slug: row.slug, realmId, docUrl: realmWorkbenchDocUrl(realmId, row.slug), founded, members: members.length, removed: removed.sort() };
}
