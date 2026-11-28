/**
 * lit-face-target — THE FACE-NAMED WAVE'S TARGET on the daemon island (the lit set, sealed-store#/the-lit-set).
 *
 * One seed lays every open face's memory, each in its own layer. A wave naming face h<N> resolves h<N>'s OWN document for the
 * target bag: its daemon canon by h<N>'s relation (`daemon-canon/<relation>`), and the daemon wiki's device slots: the worn
 * face's mounted layer, or the document a sibling's own wear named. EACH FACE SEALS UNDER ITS OWN CHAIN (face-seat-table): a lit
 * sibling's session books its own face key, and its saves seal through its own content-key holder. A SIBLING'S DAEMON SLOT
 * OPENS ONLY WHERE ITS OWN WEAR NAMED IT: the state document names the document that face's wear minted under its own group
 * (`daemon-slot/<kind>/<group>`), so the slot opens as that face's own. This island never mints a sibling's slot: a slot
 * document minted ahead of the face's wear would have to stand in the vessel's map and in that wear's attach as the same
 * document, and no vector proves that crossing, so a kind the face's wear never named resolves nothing. The wave refuses
 * `face-unresolved` there, and the seed names the face as waiting for its own wear. The answer carries the document's OWNER as
 * the state document names it, so the action handler lands the wave only where that owner is h<N>, and never on the worn
 * face. A face outside the lit set resolves nothing. The store door's per-face lane (`face-lane`) and each sibling's own
 * engine (`face-engine`, over `makeLitFaceDocs`) reach a lit sibling's daemon canon and named slots through this same
 * resolution.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { VESSEL_STATE_ID } from "@lararium/mesh/lar-uris";
import { documentIdOfUrl } from "@lararium/mesh/sealed-rest";
import { tiddlerText } from "@lararium/mesh/base-doc";
import { type LarTiddlerStore } from "@lararium/mesh/tiddler-store";
import type { FaceTargetResolver } from "@lararium/tw5";

/** One face of the lit set as the island holds it. */
export interface LitFace {
  readonly handleIndex: number;
  readonly group: string;
  readonly relation: string | null;
}

export interface LitFaceTargetDeps {
  /** The worn (mounted) face, or null at the floor. */
  readonly worn: () => LitFace | null;
  /** Every sibling face lit beside it. */
  readonly siblings: () => Iterable<LitFace>;
  /** The state document's reader. */
  readonly state: () => { get(title: string): Promise<unknown> } | null;
  /** The worn face's mounted store for a bag (the composite's layer), or null. */
  readonly wornStore: (bag: string) => LarTiddlerStore | null;
  /** A store over a document url, as `bag`. */
  readonly storeOf: (url: string, bag: string) => Promise<LarTiddlerStore>;
}

const SLOT = /^lar:\/\/\/ha\.ka\.ba\/wikis\/daemon\/(working|draft|personal)$/;
const CANON = /^lar:\/\/\/ha\.ka\.ba\/bags\/daemon-([^/]+)$/;
const slotTitle = (kind: string, group: string): string => `${VESSEL_STATE_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;
const canonTitle = (relation: string): string => `${VESSEL_STATE_ID}/daemon-canon/${encodeURIComponent(relation)}`;

/** The document id a store stands on, or null. */
const docIdOf = (store: unknown): string | null => {
  const id = (store as { documentId?: unknown } | null)?.documentId;
  return typeof id === "string" && id.length > 0 ? id : null;
};

/** A lit face's own document for a daemon bag, as the state document names it: its url and the face that owns it. */
export type LitFaceDocs = (face: number | null, bag: string) => Promise<{ readonly url: string; readonly owner: number | null } | null>;

/**
 * THE LIT FACE'S OWN DOCUMENTS off the state document, read alone (nothing mints): a face's daemon canon by its own
 * relation, and a SIBLING's daemon slot where its own wear named one. The worn face's slots answer through its mounted layer
 * (`makeLitFaceTarget`), never here.
 */
export function makeLitFaceDocs(deps: Pick<LitFaceTargetDeps, "worn" | "siblings" | "state">): LitFaceDocs & { ownerOf(bag: string, documentId: string | null): Promise<number | null> } {
  const lit = (): LitFace[] => [...(deps.worn() ? [deps.worn()!] : []), ...deps.siblings()];
  const named = async (title: string): Promise<string | null> => {
    const state = deps.state();
    return state ? documentIdOfUrl(tiddlerText((await state.get(title)) as never)) : null;
  };
  /** The face of the lit set the state document names as `documentId`'s owner for `bag`, or null. */
  const ownerOf = async (bag: string, documentId: string | null): Promise<number | null> => {
    if (documentId === null) return null;
    const slot = SLOT.exec(bag);
    for (const face of lit()) {
      if (slot && (await named(slotTitle(slot[1]!, face.group))) === documentId) return face.handleIndex;
      if (!slot && face.relation !== null && (await named(canonTitle(face.relation))) === documentId) return face.handleIndex;
    }
    return null;
  };
  const docs = async (face: number | null, bag: string): Promise<{ url: string; owner: number | null } | null> => {
    const slot = SLOT.exec(bag), canon = CANON.exec(bag);
    if (!slot && !canon) return null;
    const worn = deps.worn();
    const target = face === null ? worn : lit().find((f) => f.handleIndex === face) ?? null;
    if (target === null) return null;
    let id: string | null = null;
    if (canon && target.relation !== null && decodeURIComponent(canon[1]!) === target.relation) id = await named(canonTitle(target.relation));
    // A SIBLING'S DAEMON SLOT ITS OWN WEAR NAMED: the state document already names that face's document (minted at its own
    // wear, under its own group), so it opens as that face's own. A kind its wear never named stays unresolved: nothing mints.
    if (slot && (worn === null || target.handleIndex !== worn.handleIndex)) id = await named(slotTitle(slot[1]!, target.group));
    return id ? { url: `automerge:${id}`, owner: await ownerOf(bag, id) } : null;
  };
  return Object.assign(docs, { ownerOf });
}

export function makeLitFaceTarget(deps: LitFaceTargetDeps): FaceTargetResolver {
  const docs = makeLitFaceDocs(deps);
  return async (face, bag) => {
    if (!SLOT.test(bag) && !CANON.test(bag)) return null;
    const worn = deps.worn();
    const target = face === null ? worn : [...(worn ? [worn] : []), ...deps.siblings()].find((f) => f.handleIndex === face) ?? null;
    if (target === null) return null;
    let store: LarTiddlerStore | null = worn !== null && target.handleIndex === worn.handleIndex ? deps.wornStore(bag) : null;
    if (store === null) {
      const doc = await docs(target.handleIndex, bag);
      if (doc) store = await deps.storeOf(doc.url, bag);
    }
    if (store === null) return null;
    return { store, owner: await docs.ownerOf(bag, docIdOf(store)), worn: worn?.handleIndex ?? null };
  };
}
