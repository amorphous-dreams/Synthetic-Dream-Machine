/**
 * lit-face-target — THE FACE-NAMED WAVE'S TARGET on the daemon island (the lit set, sealed-store#/the-lit-set).
 *
 * One seed lays every open face's memory, each in its own layer. A wave naming face h<N> resolves h<N>'s OWN document for the
 * target bag: its daemon canon by h<N>'s relation (`daemon-canon/<relation>`), and the daemon wiki's device slots at h<N>'s own
 * wear alone, the worn face's mounted layer. A SIBLING'S DAEMON SLOT OPENS NOTHING HERE: the island seals under the worn face's
 * session alone, so a document it stood for a sibling would refuse its seal (`session-face-foreign`), leave unsealed at the next
 * composition, and leave the control row naming a document no store holds; that face's own wear would then refuse to attach its
 * working layer. The wave refuses `face-unresolved`, and the seed names the face as waiting for its own wear. The answer carries
 * the document's OWNER as the control document names it, so the action handler lands the wave only where that owner is h<N>,
 * and never on the worn face. A face outside the lit set resolves nothing.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { CONTROL_HOME_ID, documentIdOfUrl, tiddlerText, type LarTiddlerStore } from "@lararium/mesh";
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
  /** The control document's reader. */
  readonly control: () => { get(title: string): Promise<unknown> } | null;
  /** The worn face's mounted store for a bag (the composite's layer), or null. */
  readonly wornStore: (bag: string) => LarTiddlerStore | null;
  /** A store over a document url, as `bag`. */
  readonly storeOf: (url: string, bag: string) => Promise<LarTiddlerStore>;
}

const SLOT = /^lar:\/\/\/ha\.ka\.ba\/wikis\/daemon\/(working|draft|personal)$/;
const CANON = /^lar:\/\/\/ha\.ka\.ba\/bags\/daemon-([^/]+)$/;
const slotTitle = (kind: string, group: string): string => `${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;
const canonTitle = (relation: string): string => `${CONTROL_HOME_ID}/daemon-canon/${encodeURIComponent(relation)}`;

/** The document id a store stands on, or null. */
const docIdOf = (store: unknown): string | null => {
  const id = (store as { documentId?: unknown } | null)?.documentId;
  return typeof id === "string" && id.length > 0 ? id : null;
};

export function makeLitFaceTarget(deps: LitFaceTargetDeps): FaceTargetResolver {
  const lit = (): LitFace[] => [...(deps.worn() ? [deps.worn()!] : []), ...deps.siblings()];
  const named = async (title: string): Promise<string | null> => {
    const control = deps.control();
    return control ? documentIdOfUrl(tiddlerText((await control.get(title)) as never)) : null;
  };
  /** The face of the lit set the control document names as `documentId`'s owner for `bag`, or null. */
  const ownerOf = async (bag: string, documentId: string | null): Promise<number | null> => {
    if (documentId === null) return null;
    const slot = SLOT.exec(bag);
    for (const face of lit()) {
      if (slot && (await named(slotTitle(slot[1]!, face.group))) === documentId) return face.handleIndex;
      if (!slot && face.relation !== null && (await named(canonTitle(face.relation))) === documentId) return face.handleIndex;
    }
    return null;
  };
  return async (face, bag) => {
    const slot = SLOT.exec(bag), canon = CANON.exec(bag);
    if (!slot && !canon) return null;
    const worn = deps.worn();
    const target = face === null ? worn : lit().find((f) => f.handleIndex === face) ?? null;
    if (target === null) return null;
    let store: LarTiddlerStore | null = worn !== null && target.handleIndex === worn.handleIndex ? deps.wornStore(bag) : null;
    if (store === null && canon && target.relation !== null && decodeURIComponent(canon[1]!) === target.relation) {
      const id = await named(canonTitle(target.relation));
      if (id) store = await deps.storeOf(`automerge:${id}`, bag);
    }
    if (store === null) return null;
    return { store, owner: await ownerOf(bag, docIdOf(store)), worn: worn?.handleIndex ?? null };
  };
}
