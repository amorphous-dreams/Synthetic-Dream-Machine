/**
 * cross-face-reach — A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20, state/decisions "the cross-face reach").
 *
 * A seat wearing one face READS and RENDERS another LIT face's wikis standing, with no lei: its worn presenter and asker
 * stay its own, and the read answers from a CROSS-FACE VIEW of the target, never the target's own engine. Certain bags stand
 * PRIVATE and refuse every cross-face reach: the personal layer of every wiki (`wikis/<slug>/personal`, what one face keeps
 * for itself and carries to its own devices alone) stands as the first, and the draft layer (`wikis/<slug>/draft`, a face's
 * unsaved edits, face-reach as personal is) beside it, on the house lean the operator holds pending. A write naming another
 * face refuses; the cross-face write rite rides a lei, in a later lane.
 *
 * THE CLASSIFICATION READS THE LAYER'S OWN ADDRESS. A layer's kind rides its slot URI (`wikiSlotUri`), the one address the
 * minter writes and every composition lays, so the classification needs no record a hand could edit and no lookup a missing
 * document could answer wrong: an address that names a private kind reads PRIVATE, whatever the recipe, the catalog or the
 * caller says, and so does a kind beneath a wiki's address that the classification does not know (it fails closed). No lei, talk-story or argument lifts it. The address reads canonical first (trimmed, case folded, trailing
 * slashes dropped), so no spelling of a private layer reads visitable, and any wiki's private layer reads private wherever a
 * recipe lays it, as a library or otherwise. A composition checks the DOCUMENT each binding resolves to as well
 * (`composeCrossFaceView`, against the documents the lit faces' private slots name), so a label never carries a private
 * document past it.
 *
 * THE VIEW EXCLUDES BEFORE IT COMPOSES. `crossFaceViewSlots` names the layers a target's view may lay: the wiki's working
 * layer, its canon, its libraries and the floor. The private check runs first on every slot, then the view's own choice
 * (`temp` lives in one engine, the kahua stage folds under the worn face, the daemon document holds the vessel's own state),
 * so a private layer never reaches a composition and nothing redacts after the fact.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { DAEMON_BAG_ID } from "./lar-uris.js";
import { KAHUA_BAG, expandRecipe, wikiSlotKindOf, type SlotUri, type WikiRecipe, type WikiSlotKind } from "./wiki-recipe.js";

/** How a cross-face reach reads a bag: PRIVATE refuses every cross-face reach; visitable admits a designated read. */
export type BagReach = "private" | "visitable";

/** The slot kinds that stand PRIVATE by law: the personal layer (what one face keeps for itself) and the draft layer (its
 *  unsaved edits). */
export const PRIVATE_SLOT_KINDS: ReadonlySet<WikiSlotKind> = new Set(["personal", "draft"]);

/** The read and render verbs a seat may aim at another lit face (`target`); every other verb naming another face refuses. */
export const CROSS_FACE_READ_VERBS: ReadonlySet<string> = new Set(["tiddler-get", "wiki-filter", "wiki-render", "wiki-status", "meme-list"]);

/**
 * The verbs whose `target` names a FACE: the tiddler door and the meme verbs. A read among them visits a lit target; a write
 * among them naming another face refuses. Any other verb's `target` means what that verb says (an intent's, a pin's) and no
 * cross-face door reads it.
 */
export const CROSS_FACE_TARGET_VERBS: ReadonlySet<string> = new Set([
  ...CROSS_FACE_READ_VERBS, "tiddler-put", "tiddler-delete", "meme-put", "meme-delete", "meme-patch", "meme-project",
]);

/** The refusal a private bag answers at a cross-face door. */
export const CROSS_FACE_PRIVATE = "cross-face-private";

/** Anything a wiki holds beneath its own address, canonical: `lar:///ha.ka.ba/wikis/<slug>/<rest>`. */
const UNDER_A_WIKI = /^lar:\/\/\/ha\.ka\.ba\/wikis\/([^/]+)\/(.+)$/;

/** The instance kinds a visit may read beneath a wiki's address (the view still leaves `temp` out by its own choice). */
const VISITABLE_INSTANCE_KINDS: ReadonlySet<string> = new Set<WikiSlotKind>(["working", "temp"]);

/** The address a classification reads: trimmed, case folded, trailing slashes dropped. */
const canonicalBag = (bag: string): string => bag.trim().toLowerCase().replace(/\/+$/, "");

/**
 * How a cross-face reach reads `bag`, by the kind its canonical address names, whichever wiki it names. IT FAILS CLOSED: beneath a
 * wiki's address only the kinds a visit may read stand visitable (`working`, `temp`); a private kind, an unknown kind and any
 * deeper path (a per-place draft key, `drafts/<did>`) read PRIVATE, so no kind minted later reads visitable before a ruling names it.
 */
export function bagReachOf(bag: string): BagReach {
  const under = UNDER_A_WIKI.exec(canonicalBag(bag));
  if (under === null) return "visitable";
  return VISITABLE_INSTANCE_KINDS.has(under[2]!) ? "visitable" : "private";
}

/** True where `bag` stands PRIVATE: no cross-face reach composes, lists, filters, renders or writes it. */
export function isPrivateBag(bag: string): boolean {
  return bagReachOf(bag) === "private";
}

/** The refusal `bag` answers at a cross-face door, or null where it stands visitable. */
export function crossFacePrivateRefusal(bag: string): string | null {
  return isPrivateBag(bag)
    ? `${CROSS_FACE_PRIVATE}: ${bag} stands private (a face's personal or draft layer), and no cross-face reach composes, reads or writes it`
    : null;
}

/**
 * The layers a target face's cross-face view lays for `recipe`, top first: its working layer, its canon, its libraries and
 * the floor. A private layer never appears (checked first, on every slot the recipe names, libraries included, any wiki's);
 * the temp layer, the kahua stage and the vessel's own daemon document stay out by the view's own choice.
 */
export function crossFaceViewSlots(recipe: WikiRecipe): SlotUri[] {
  const slug = recipe.wikiSlug;
  return expandRecipe(recipe).filter((slot) => {
    if (isPrivateBag(slot)) return false;
    if (wikiSlotKindOf(slug, slot) === "temp") return false;
    return slot !== KAHUA_BAG && slot !== DAEMON_BAG_ID;
  });
}
