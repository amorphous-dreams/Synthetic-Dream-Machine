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
 *     the four planes that travel with it (identities, circles, sessions, intents), each in the `plane` layer, and the
 *     vessel's daemon doc, the door the face's joined vessel reads its cap events through. A PersonaGroup this
 *     vessel carries no plane for has no facets: its session reads no face document.
 *   · THE VIEW is the mesh's own (`SessionDocumentView`), opened once per session under the `face` profile, and its
 *     FETCH gate answers the share verdict. It closes when the peer leaves.
 *
 * THE WORN FACE'S BOOKS: A BRIDGE UNTIL O1. A vessel tags no wiki, catalog or bag document by face today: it wears
 * ONE face, and its catalog, its wikis (their working, personal and draft slot docs, minted under the daemon's
 * store) and every private bag it registers are that face's (`deriveRegisterBags` already counts the catalog's
 * bags under the worn group alone). The persona-scoped planes are the one thing the vessel tells apart by face.
 * So a session of the mounted face reads its own planes and every other document this vessel holds, save the
 * persona-scoped planes of any OTHER face it carries; a session of any other face reads that face's planes
 * alone. O1 replaces the bridge with per-surface facets.
 *
 * Two faces on one vessel thereby read different books: neither reads the other's planes, and only the mounted face
 * reads the vessel's wikis, catalog and bags.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/stable-founding-road#/rulings ("Sharing after the gate");
 *        lar:///ha.ka.ba/lares/api/pono/session-contract#/the-document-view
 */
import { interpretAsDocumentId, type AutomergeUrl, type DocumentId, type PeerId } from "@automerge/automerge-repo";
import { PERSONA_GROUP_ID_TIDDLER, SessionDocumentView, isFaceScopedBag, tiddlerText, type LarDoc, type DocumentFacet, type FaceGrantReading, type FederationGate, type SessionDocumentFacets } from "@lararium/mesh";
import { bootDaemonUrl, bootFacePlanes } from "./boot-face-planes.js";
import type { KahuCanonDocs } from "./kahu-realm.js";

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
  add("intents", planes.intentsUrl);
  add("daemon", bootDaemonUrl(bootstrapTiddlers));
  return { documents, content: [] };
}

/**
 * The documents the mounted face's bridge may read beyond its own view: every document the catalog points at (`automerge:` text) under a
 * title that is NOT a face-scoped bag id: the vessel's books (a wiki, a draft, the catalog, the oracle) and the pointers its planes
 * stand on (a realm's doc, its steward, its standing), as document IDs. An ALLOW-LIST: a document the catalog does not point at
 * reads nothing across the bridge, so a foreign face's plane whose catalog row is absent, withheld or face-scoped is shut out by
 * default and never let in by an omission. The mounted face's own five planes ride its view. The Kahu canon this vessel
 * stands (`@lares`, `@lararium`, registered by the realm and never the catalog) rides the bridge as the vessel's books too.
 */
export function bridgeBooks(catalog: LarDoc | undefined | null, canon: KahuCanonDocs = {}): ReadonlySet<string> {
  const out = new Set<string>();
  const add = (url: string | null | undefined): void => {
    if (!url || !url.startsWith("automerge:")) return;
    try { out.add(interpretAsDocumentId(url as AutomergeUrl)); } catch { /* a malformed url names nothing */ }
  };
  for (const [title, record] of Object.entries(catalog?.tiddlers ?? {})) {
    if (isFaceScopedBag(title)) continue;
    add(tiddlerText(record));
  }
  // THE KAHU CANON IS A BOOK OF THIS VESSEL: the realm registry, never the catalog, names `@lares` and `@lararium` (one
  // owner per registry), so the bridge reads them off the canon the vessel stood at boot (`standKahuCanon`). Without this a
  // seated same-operator leaf read every book and none of the canon (walk R4).
  add(canon.lares); add(canon.lararium);
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
export function faceFleetViews(bootstrap: () => BootTiddlers | null, wornGroup?: () => string | null, books?: () => ReadonlySet<string>): FaceFleetViews {
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
      // The mounted face is the caller's (sealed custody's) when it names one; the bootstrap's group text answers only where no caller does.
      const worn = wornGroup ? wornGroup() : (tiddlers?.[PERSONA_GROUP_ID_TIDDLER]?.text ?? null);
      if (worn !== face.personaGroup || tiddlers === null) {
        views.set(peerId, { view, gate: viewFederationGate(view) });
        return;
      }
      // THE BRIDGE: the mounted face reads the vessel's books too: its own view, plus the allow-list the catalog names (`bridgeBooks`).
      // A caller that names no books opens no bridge, so the default is shut.
      const gate: FederationGate = {
        mayFederate: (documentId: DocumentId) => !view.closed && (view.fetch(String(documentId)).ok || (books?.().has(String(documentId)) ?? false)),
      };
      views.set(peerId, { view, gate });
    },
    gateFor: (peerId) => views.get(String(peerId))?.gate ?? null,
    drop,
    close() { for (const peerId of [...views.keys()]) drop(peerId); },
  };
}
