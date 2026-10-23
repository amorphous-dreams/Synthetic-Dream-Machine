/**
 * face-fleet-view — D3's narrowest caller: a same-operator session reads its face's documents through that face's
 * scoped view, and the class alone grants transport ("Sharing after the gate").
 *
 * O1 ("one face's sessions") owns the live session callers: every interactive surface mounts under a verified face
 * and a `SessionDocumentView` (`mountSurface`), the working address, receipts and the session switch. None of it
 * stands yet. What the share verdict needs of it is far narrower: for a session the gate seated same-operator, the
 * documents ITS face holds on this vessel. This module builds exactly that and nothing more:
 *
 *   · THE FACE comes from the gate alone: the PersonaGroup grant its ring answered for the session (`GateSession.face`).
 *     A session that carries none reads no face document here.
 *   · THE FACETS come from this vessel's bootstrap alone (`boot-face-planes`), for that PersonaGroup: its plane and
 *     the three planes that travel with it (identities, circles, sessions), each in the `plane` layer, and the
 *     vessel's daemon doc, the door the face's joined vessel reads its cap events through. A PersonaGroup this
 *     vessel carries no plane for has no facets: its session reads no face document.
 *   · THE VIEW is the mesh's own (`SessionDocumentView`), opened once per session under the `face` profile, and its
 *     FETCH gate answers the share verdict. It closes when the peer leaves.
 *
 * THE WORN FACE'S BOOKS: A BRIDGE UNTIL O1. A vessel tags no wiki, catalog or bag document by face today: it wears
 * ONE face, and its catalog, its wikis (their working, personal and draft slot docs, minted under the daemon's
 * store) and every private bag it registers are that face's (`deriveRegisterBags` already counts the catalog's
 * bags under the worn group alone). The persona-scoped planes are the one thing the vessel tells apart by face.
 * So a session of the WORN face reads its own planes and every other document this vessel holds, save the
 * persona-scoped planes of any OTHER face it carries; a session of any other face reads that face's planes
 * alone. O1 replaces the bridge with per-surface facets.
 *
 * Two faces on one vessel thereby read different books: neither reads the other's planes, and only the worn face
 * reads the vessel's wikis, catalog and bags.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("Sharing after the gate");
 *        lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { PERSONA_GROUP_ID_TIDDLER, SessionDocumentView, catalogNamedBags, faceTagOfBag, personaScopeTag, tiddlerText, type LarDoc, type DocumentFacet, type FaceGrantReading, type FederationGate, type SessionDocumentFacets } from "@lararium/mesh";
import { bootDaemonUrl, bootFacePlanes } from "./boot-face-planes.js";

type BootTiddlers = Readonly<Record<string, { text?: string }>>;

/** The documents `personaGroup` holds on this vessel, read off the bootstrap alone; null where it holds none. */
export function faceFleetFacets(bootstrapTiddlers: BootTiddlers, personaGroup: string): SessionDocumentFacets | null {
  let planes: ReturnType<typeof bootFacePlanes>;
  try { planes = bootFacePlanes(bootstrapTiddlers, personaGroup); } catch { return null; }
  // A bootstrap that carries no plane for the named group mounts none: its url reads null.
  if (!planes.personaUrl) return null;
  const documents: DocumentFacet[] = [];
  const add = (name: string, document: string | null): void => { if (document) documents.push({ name, document, layer: "plane" }); };
  add("persona", planes.personaUrl);
  add("identities", planes.identitiesUrl);
  add("circles", planes.circlesUrl);
  add("sessions", planes.sessionsUrl);
  add("daemon", bootDaemonUrl(bootstrapTiddlers));
  return { documents, content: [] };
}

/** Every persona-scoped plane of a face OTHER than `personaGroup` this bootstrap carries, as document IDs. */
export function otherFacePlanes(bootstrapTiddlers: BootTiddlers, personaGroup: string): ReadonlySet<string> {
  const out = new Set<string>();
  let family: ReturnType<typeof bootFacePlanes>["personaPlanes"];
  try { family = bootFacePlanes(bootstrapTiddlers, null).personaPlanes; } catch { return out; }
  for (const plane of family) {
    if (plane.personaGroupId === personaGroup) continue;
    let theirs: ReturnType<typeof bootFacePlanes>;
    try { theirs = bootFacePlanes(bootstrapTiddlers, plane.personaGroupId); } catch { continue; }
    for (const url of [plane.url, theirs.personaUrl, theirs.identitiesUrl, theirs.circlesUrl, theirs.sessionsUrl]) {
      if (!url) continue;
      try { out.add(interpretAsDocumentId(url as AutomergeUrl)); } catch { /* a malformed url names nothing */ }
    }
  }
  return out;
}

/**
 * Every plane document of a face OTHER than `worn` the CATALOG names, as document IDs: a face-scoped bag id (any of the four families) whose
 * tag is not the worn group's. The derived shape recognises them, so an other-face entry the bootstrap omits still stays out of the bridge.
 */
export function foreignFaceDocs(catalog: LarDoc | undefined | null, worn: string): ReadonlySet<string> {
  const out = new Set<string>();
  let wornTag: string | null = null;
  try { wornTag = personaScopeTag(worn); } catch { /* a malformed worn group names no tag: every face-scoped bag is foreign */ }
  for (const bag of catalogNamedBags(catalog)) {
    const tag = faceTagOfBag(bag);
    if (tag === null || tag === wornTag) continue;
    const url = tiddlerText(catalog?.tiddlers?.[bag]);
    if (!url) continue;
    try { out.add(interpretAsDocumentId(url as AutomergeUrl)); } catch { /* a malformed url names nothing */ }
  }
  return out;
}

/** The share verdict's face gate over one view: a document crosses where the view would let the session fetch it. */
export function viewFederationGate(view: SessionDocumentView): FederationGate {
  return { mayFederate: (documentId: DocumentId) => view.fetch(String(documentId)).ok };
}

export interface FaceFleetViews {
  /** Open the view of the face a peer's session proved; a session with no face, or a face with no facets, opens none. */
  seat(peerId: string, face: FaceGrantReading | null): void;
  /** The face gate the share verdict reads for `peerId`, or null where its session proved no face here. */
  gateFor(peerId: PeerId | string): FederationGate | null;
  /** The peer left: close its view. */
  drop(peerId: string): void;
  /** Close every view. */
  close(): void;
}

/**
 * One view per seated peer, its facets read off `bootstrap()` at the seat. `wornGroup` names the face this vessel
 * wears (the bootstrap's pin where none is named): its sessions also read the vessel's books (the bridge above).
 */
export function faceFleetViews(bootstrap: () => BootTiddlers | null, wornGroup?: () => string | null, foreign?: () => ReadonlySet<string>): FaceFleetViews {
  const views = new Map<string, { view: SessionDocumentView; gate: FederationGate }>();
  const drop = (peerId: string): void => {
    const held = views.get(peerId);
    views.delete(peerId);
    try { held?.view.close(); } catch { /* a closed view answers nothing either way */ }
  };
  return {
    seat(peerId, face) {
      drop(peerId);
      if (face === null) return;
      const tiddlers = bootstrap();
      const facets = tiddlers ? faceFleetFacets(tiddlers, face.personaGroup) : null;
      if (facets === null || facets.documents.length === 0) return;
      const view = new SessionDocumentView({ profile: "face", facets });
      // The worn face is the caller's (sealed custody's) when it names one; the bootstrap's group text answers only where no caller does.
      const worn = wornGroup ? wornGroup() : (tiddlers?.[PERSONA_GROUP_ID_TIDDLER]?.text ?? null);
      if (worn !== face.personaGroup || tiddlers === null) {
        views.set(peerId, { view, gate: viewFederationGate(view) });
        return;
      }
      // THE BRIDGE: the worn face reads the vessel's books too, every document but another face's planes.
      // The other faces' planes: the bootstrap's list (it can only add) and the catalog's, recognised by shape (it can not be omitted).
      const named = otherFacePlanes(tiddlers, face.personaGroup);
      const others: ReadonlySet<string> = foreign ? new Set([...named, ...foreign()]) : named;
      const gate: FederationGate = {
        mayFederate: (documentId: DocumentId) => !view.closed && (view.fetch(String(documentId)).ok || !others.has(String(documentId))),
      };
      views.set(peerId, { view, gate });
    },
    gateFor: (peerId) => views.get(String(peerId))?.gate ?? null,
    drop,
    close() { for (const peerId of [...views.keys()]) drop(peerId); },
  };
}
