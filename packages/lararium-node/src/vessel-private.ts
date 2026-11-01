/**
 * vessel-private — the documents a vessel keeps for its own faces alone, classed by IDENTITY for the one share guard
 * (lane `ralias`; P26's `protectedDocGuard`, class `vessel-private`).
 *
 * WHAT THE CLASS HOLDS: the daemon document, each face's five planes (persona, identities, circles, sessions, intents),
 * the catalog, and the device's own edge ledger (owner `device`, road `T33`), which crosses to no peer at all. The ids come off the vessel's own bootstrap (the founding wrote it; `boot-face-planes` reads every face from
 * it alone) and its catalog pointer: never a catalog title, a realm registration or a peer's word, so a second name for one
 * of these documents changes nothing.
 *
 * OWNERSHIP DECIDES FIRST (the train's Sol read, controller ruling): each id carries its owning face, the PersonaGroup
 * whose plane it holds, or `vessel` for the daemon document and the catalog (the vessel wears one face, so `vessel` reads
 * as the worn face). A classed document crosses only to a peer proven as its owner. No catalog pointer, alias or bridge
 * widens that: the worn face's bridge admits whatever a catalog row names, so it never decides a vessel-private id alone.
 *
 * WHO READS ONE: a peer proven as its owner whose relation also opens it (`vesselPrivateRelationOpens`), measured from the
 * lanes that serve these documents today:
 *   · a SAME-OPERATOR session (inbound gate or same-face dial) through the scoped view of the face it proved: that face's
 *     planes and the daemon document, and for the worn face the catalog across the bridge (`face-fleet-view`);
 *   · a SIBLING through the sibling gate: the face's own planes, never the daemon document;
 *   · a FACE-JOIN GRANT holder through the PersonaGroup ring: the face's own planes, never anything else.
 * No realm lane, registration, contract, carriage or shelf opens one. The vessel's own in-process islands stand inside the
 * house and never reach the guard.
 *
 * DURABLE FOR THE RUN: the book re-reads the bootstrap when it changes (a face added while the vessel runs), and a class
 * never drops: a rewrite that loses a name, or a torn file, keeps every id already classed. A file that tears AFTER a whole
 * read reads `torn` until a whole re-read: a face that write added would stand unclassed meanwhile, so the composer
 * withholds every document from every guarded peer for that span (fail closed). A file absent, or torn from the first
 * read, tears nothing: the boot reads it as none, and no face stands on it.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/stable-founding-road#/P26
 */
import { readFileSync, statSync } from "node:fs";
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { edgeLedgerDocUrl, type FederationGate } from "@lararium/mesh";
import { bootDaemonUrl, bootFacePlanes } from "./boot-face-planes.js";

type BootTiddlers = Readonly<Record<string, { text?: string }>>;

const idOfUrl = (url: string | null | undefined): string | null => {
  if (!url || !url.startsWith("automerge:")) return null;
  try { return String(interpretAsDocumentId(url as AutomergeUrl)); } catch { return null; }
};

/** The bootstrap file's tiddlers, both parses guarded: a torn or absent file reads `null` (the boot reads it as none). */
export function readBootTiddlers(bootstrapPath: string): Record<string, { text?: string }> | null {
  try {
    const plugin = JSON.parse(readFileSync(bootstrapPath, "utf8")) as Record<string, unknown>;
    const packed = JSON.parse(String(plugin["text"] ?? "{}")) as { tiddlers?: Record<string, { text?: string }> };
    return packed.tiddlers ?? {};
  } catch { return null; }
}

/** The owner the daemon document and the catalog carry: the vessel itself, read as the face it wears. */
export const VESSEL_OWNER = "vessel";

/** The owner a document only THIS DEVICE keeps carries: its edge ledger (road `T33`). No relation opens it, the worn face's
 *  own session and siblings included: no other device ever reads or writes this device's roll marks. */
export const DEVICE_OWNER = "device";

/**
 * Class the edge ledger of every face whose atom key this vessel holds (road `T33`): the worn face, each joined face, each
 * face lit later. Each ledger's id derives from its atom key (`edgeLedgerDocUrl`), which the fleet board shows in the
 * clear, so no other relation decides it: each classes under `device`. An absent key classes nothing.
 */
export function classDeviceLedgers(book: VesselPrivateBook, keys: Iterable<string | null | undefined>): void {
  for (const key of keys) if (key) book.add(edgeLedgerDocUrl(key), DEVICE_OWNER);
}

/** Every id the bootstrap classes, with its owner: each face's five planes by that face's group, the daemon document by the
 *  vessel. A family that faults throws (the boot halts on it too). */
export function vesselPrivateOwners(bootstrapTiddlers: BootTiddlers): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const add = (url: string | null | undefined, owner: string): void => { const id = idOfUrl(url); if (id && !out.has(id)) out.set(id, owner); };
  add(bootDaemonUrl(bootstrapTiddlers), VESSEL_OWNER);
  // The family through the one enumerator (`bootFacePlanes`), then each face's five planes by its own group.
  for (const plane of bootFacePlanes(bootstrapTiddlers, null).personaPlanes) {
    const face = bootFacePlanes(bootstrapTiddlers, plane.personaGroupId);
    for (const url of [face.personaUrl, face.identitiesUrl, face.circlesUrl, face.sessionsUrl, face.intentsUrl]) add(url, plane.personaGroupId);
  }
  return out;
}

/** The daemon document and every face's five planes the bootstrap names, as document ids. */
export function vesselPrivateDocIds(bootstrapTiddlers: BootTiddlers): ReadonlySet<string> {
  return new Set(vesselPrivateOwners(bootstrapTiddlers).keys());
}

export interface VesselPrivateBook {
  /** Every id classed so far this run; the bootstrap re-reads first where it changed on disk. */
  ids(): ReadonlySet<string>;
  has(documentId: string): boolean;
  /** The face that owns this classed document (a PersonaGroup, or `vessel`), or null where it stands unclassed. */
  ownerOf(documentId: string): string | null;
  /** Class one more document by its url or id (the catalog, once it stands), owned by the vessel unless named. */
  add(urlOrId: string | null | undefined, owner?: string): void;
  /** The bootstrap changed after a whole read and will not read whole now: ids it may add stand unclassed until it does. */
  torn(): boolean;
}

/** The vessel's private ids, grown off its bootstrap at each change and never shrunk. */
export function vesselPrivateBook(opts: {
  readonly bootstrapPath: string;
  /** Fired at every growth (an id classed for the first time): the composer re-asks its cached share verdicts, so a verdict a
   *  lane cached before the class landed never outlives it. */
  readonly onGrow?: () => void;
}): VesselPrivateBook {
  const ids = new Set<string>();
  // The first owner an id is classed under stands for the run, as the class does.
  const owners = new Map<string, string>();
  const grow = (id: string, owner: string): boolean => { if (ids.has(id)) return false; ids.add(id); owners.set(id, owner); return true; };
  const grew = (): void => { try { opts.onGrow?.(); } catch { /* a listener never breaks the book */ } };
  let seen: string | null = null;
  let torn = false;
  const refresh = (): void => {
    let stamp: string;
    // mtime and ctime both move on an in-place rewrite of the same size (plane urls hold a fixed length).
    try { const st = statSync(opts.bootstrapPath); stamp = `${st.mtimeMs}:${st.ctimeMs}:${st.size}:${st.ino}`; } catch { return; }
    if (stamp === seen) return;
    const tiddlers = readBootTiddlers(opts.bootstrapPath);
    let fresh: ReadonlyMap<string, string> | null = null;
    if (tiddlers !== null) { try { fresh = vesselPrivateOwners(tiddlers); } catch { fresh = null; } }
    // Torn mid-write (or a family that faults): every class stands, and once a whole read has stood the gap reads torn.
    if (fresh === null) { torn = seen !== null; return; }
    let moved = false;
    for (const [id, owner] of fresh) moved = grow(id, owner) || moved;
    seen = stamp;
    torn = false;
    if (moved) grew();
  };
  refresh();
  return {
    ids() { refresh(); return ids; },
    has(documentId) { refresh(); return ids.has(String(documentId)); },
    torn() { refresh(); return torn; },
    ownerOf(documentId) { refresh(); return owners.get(String(documentId)) ?? null; },
    add(urlOrId, owner = VESSEL_OWNER) {
      if (!urlOrId) return;
      const id = urlOrId.startsWith("automerge:") ? idOfUrl(urlOrId) : urlOrId;
      if (id && grow(id, owner)) grew();
    },
  };
}

export interface VesselPrivateRelation {
  /** The document's owner (`ownerOf`): a PersonaGroup, or `vessel`. Null withholds. */
  readonly owner: string | null;
  /** The face this vessel wears: `vessel` reads as it, and a sibling or a face-join grant proves it alone. */
  readonly wornFace: string | null;
  /** The face the peer's same-operator session proved (`faceFleetViews.faceOf`), or null. */
  readonly peerFace: string | null;
  /** True where the sibling channel proved this peer. */
  readonly sibling: boolean;
  readonly siblingGate: FederationGate | null;
  /** The peer's session (inbound gate or same-face dial) sorted same-operator. */
  readonly sameOperator: boolean;
  /** The scoped view of the face that session proved (`faceFleetViews.gateFor`). */
  readonly sessionFace: FederationGate | null;
  /** The PersonaGroup ring's own grant predicate: a face-join grant holder reaches the face's own planes. */
  readonly faceGrant: { admitsPeer(documentId: DocumentId, peerId: PeerId): Promise<boolean> } | null;
  readonly peerId: string;
  readonly documentId: string;
}

const sameFace = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The `vessel-private` decider: is this peer proven as the document's owner, and does its relation open the document?
 *  Ownership reads first, so no gate's own allow-list (the bridge, a view, a ring) widens it. */
export async function vesselPrivateRelationOpens(r: VesselPrivateRelation): Promise<boolean> {
  const doc = r.documentId as DocumentId, peer = r.peerId as PeerId;
  if (r.owner === DEVICE_OWNER) return false;
  const owner = r.owner === VESSEL_OWNER ? r.wornFace : r.owner;
  if (!owner) return false;
  // A sibling and a face-join grant holder each stand for the worn face alone.
  if (r.sibling) return sameFace(owner, r.wornFace) && (await r.siblingGate?.mayFederate(doc, peer)) === true;
  if (r.sameOperator && sameFace(owner, r.peerFace) && (await r.sessionFace?.mayFederate(doc, peer)) === true) return true;
  return sameFace(owner, r.wornFace) && (await r.faceGrant?.admitsPeer(doc, peer)) === true;
}
