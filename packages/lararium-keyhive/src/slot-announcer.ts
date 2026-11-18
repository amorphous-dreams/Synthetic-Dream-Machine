/**
 * slot-announcer — THE SLOT RESOLVER NAMES EACH DOCUMENT IT ANSWERS (V3), AS WHOSE IT STANDS.
 *
 * Every slot document the daemon island's resolvers answer reaches the vessel's bag map before its first byte moves
 * (`announceSlotDoc`). The island holds two kinds of resolver: the WORN face's own (`slotDocsOf`), and one per SIBLING of
 * the lit set (`litFaceSlotDocs`), which a face-named wave reaches through `siblingSlot`. A sibling's announcement rides
 * marked (`announceSiblingSlotDoc`): the vessel maps it for its seal as any slot, and the host's working layer follows the
 * worn face's own slot alone, never another face's document (a face's daemon layer belongs to that face, opened at its
 * own wear).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { announceSiblingSlotDoc, announceSlotDoc, DAEMON_WIKI_SLUG, documentIdOfUrl, wikiSlotUri, type WikiSlotKind } from "@lararium/mesh";
import type { SlotDocResolver } from "./slot-doc-resolver.js";

/** The vessel's door the island posts across (the daemon island's `docStoreDoor`). */
export interface SlotNoticeDoor { post(msg: unknown): void }

export interface SlotAnnouncer {
  /** Name `url` as `slug`'s `kind` document (a null or absent url names nothing). */
  readonly announced: (slug: string, kind: WikiSlotKind, url: string | null | undefined) => void;
  /** Name a daemon device slot's document (`announceDevice`). */
  readonly device: (kind: Exclude<WikiSlotKind, "temp">, documentId: string) => void;
  /** The resolver, each answer it gives named before its caller writes. */
  readonly announcing: (resolver: SlotDocResolver) => SlotDocResolver;
}

/** The announcer for one resolver: `worn` names the worn face's own slots, `sibling` a lit sibling's. */
export function slotAnnouncer(door: SlotNoticeDoor | null | undefined, whose: "worn" | "sibling"): SlotAnnouncer {
  const post = (bagId: string, documentId: string): void => {
    if (!door) return;
    if (whose === "sibling") announceSiblingSlotDoc(door, bagId, documentId);
    else announceSlotDoc(door, bagId, documentId);
  };
  const announced = (slug: string, kind: WikiSlotKind, url: string | null | undefined): void => {
    const documentId = documentIdOfUrl(url);
    if (documentId) post(wikiSlotUri(slug, kind), documentId);
  };
  return {
    announced,
    device: (kind, documentId) => post(wikiSlotUri(DAEMON_WIKI_SLUG, kind), documentId),
    announcing: (resolver) => ({
      ...resolver,
      bindings: async (fingerprint, recipeTrace, slug) => {
        const out = await resolver.bindings(fingerprint, recipeTrace, slug);
        announced(slug, "working", out.workingUrl); announced(slug, "draft", out.draftUrl); announced(slug, "personal", out.personalUrl);
        return out;
      },
      writeSlot: (slug) => resolver.writeSlot(slug),
      // The call forwards as made: an absent option stays absent, never an explicit undefined.
      slotDoc: async (...call) => {
        const out = await resolver.slotDoc(...call);
        announced(call[0], call[1], out?.url);
        return out;
      },
      draft: async (slug) => {
        const out = await resolver.draft(slug);
        announced(slug, "draft", out.url);
        return out;
      },
    }),
  };
}
