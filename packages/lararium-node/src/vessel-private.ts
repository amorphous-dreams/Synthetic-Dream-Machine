/**
 * vessel-private — the documents a vessel keeps for its own faces alone, classed by IDENTITY for the one share guard
 * (lane `ralias`; P26's `protectedDocGuard`, class `vessel-private`).
 *
 * WHAT THE CLASS HOLDS: the daemon document, each face's five planes (persona, identities, circles, sessions, intents) and
 * the catalog. The ids come off the vessel's own bootstrap (the founding wrote it; `boot-face-planes` reads every face from
 * it alone) and its catalog pointer: never a catalog title, a realm registration or a peer's word, so a second name for one
 * of these documents changes nothing.
 *
 * WHO READS ONE: a peer whose proven relation already opens it (`vesselPrivateRelationOpens`), measured from the lanes
 * that serve these documents today:
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
import { readPersonaPlanes, type FederationGate } from "@lararium/mesh";
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

/** The daemon document and every face's five planes the bootstrap names, as document ids. A family that faults throws
 *  (the boot halts on it too). */
export function vesselPrivateDocIds(bootstrapTiddlers: BootTiddlers): ReadonlySet<string> {
  const out = new Set<string>();
  const add = (url: string | null | undefined): void => { const id = idOfUrl(url); if (id) out.add(id); };
  add(bootDaemonUrl(bootstrapTiddlers));
  const entries = Object.entries(bootstrapTiddlers).map(([title, t]) => ({ title, text: t?.text ?? null }));
  for (const plane of readPersonaPlanes(entries)) {
    const face = bootFacePlanes(bootstrapTiddlers, plane.personaGroupId);
    add(face.personaUrl); add(face.identitiesUrl); add(face.circlesUrl); add(face.sessionsUrl); add(face.intentsUrl);
  }
  return out;
}

export interface VesselPrivateBook {
  /** Every id classed so far this run; the bootstrap re-reads first where it changed on disk. */
  ids(): ReadonlySet<string>;
  has(documentId: string): boolean;
  /** Class one more document by its url or id (the catalog, once it stands). */
  add(urlOrId: string | null | undefined): void;
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
  const grow = (id: string): boolean => { if (ids.has(id)) return false; ids.add(id); return true; };
  const grew = (): void => { try { opts.onGrow?.(); } catch { /* a listener never breaks the book */ } };
  let seen: string | null = null;
  let torn = false;
  const refresh = (): void => {
    let stamp: string;
    // mtime and ctime both move on an in-place rewrite of the same size (plane urls hold a fixed length).
    try { const st = statSync(opts.bootstrapPath); stamp = `${st.mtimeMs}:${st.ctimeMs}:${st.size}:${st.ino}`; } catch { return; }
    if (stamp === seen) return;
    const tiddlers = readBootTiddlers(opts.bootstrapPath);
    let fresh: ReadonlySet<string> | null = null;
    if (tiddlers !== null) { try { fresh = vesselPrivateDocIds(tiddlers); } catch { fresh = null; } }
    // Torn mid-write (or a family that faults): every class stands, and once a whole read has stood the gap reads torn.
    if (fresh === null) { torn = seen !== null; return; }
    let moved = false;
    for (const id of fresh) moved = grow(id) || moved;
    seen = stamp;
    torn = false;
    if (moved) grew();
  };
  refresh();
  return {
    ids() { refresh(); return ids; },
    has(documentId) { refresh(); return ids.has(String(documentId)); },
    torn() { refresh(); return torn; },
    add(urlOrId) {
      if (!urlOrId) return;
      const id = urlOrId.startsWith("automerge:") ? idOfUrl(urlOrId) : urlOrId;
      if (id && grow(id)) grew();
    },
  };
}

export interface VesselPrivateRelation {
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

/** The `vessel-private` decider: does a relation this peer PROVED open this document? Every other lane stays shut. */
export async function vesselPrivateRelationOpens(r: VesselPrivateRelation): Promise<boolean> {
  const doc = r.documentId as DocumentId, peer = r.peerId as PeerId;
  if (r.sibling) return (await r.siblingGate?.mayFederate(doc, peer)) === true;
  if (r.sameOperator && (await r.sessionFace?.mayFederate(doc, peer)) === true) return true;
  return (await r.faceGrant?.admitsPeer(doc, peer)) === true;
}
