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
 * A FACE'S OWN LAYER REGISTERS BEFORE IT IS NAMED: a wiki's `personal` margin and `draft` binding (`isFaceSlotBag`) seal under
 * the face that resolved them, and a seal the face's hive cannot read as capable refuses. So the worn announcer registers
 * such a bag on the face's hive (`registers`) before the vessel hears its name, and the vessel maps it sealed from the first
 * byte the resolver's caller writes.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { announceSiblingSlotDoc, announceSlotDoc, announceSlotDocFiled, DAEMON_WIKI_SLUG, documentIdOfUrl, isFaceSlotBag, wikiSlotUri, type WikiSlotKind } from "@lararium/mesh";
import type { SlotDocResolver } from "./slot-doc-resolver.js";

/** The vessel's door the island posts across (the daemon island's `docStoreDoor`). */
export interface SlotNoticeDoor { post(msg: unknown): void; listen?(cb: (msg: unknown) => void): () => void }

export interface SlotAnnouncer {
  /** Name `url` as `slug`'s `kind` document (a null or absent url names nothing). */
  readonly announced: (slug: string, kind: WikiSlotKind, url: string | null | undefined) => void;
  /** Name a daemon device slot's document (`announceDevice`). */
  readonly device: (kind: Exclude<WikiSlotKind, "temp">, documentId: string) => void;
  /** The resolver, each answer it gives named before its caller writes. */
  readonly announcing: (resolver: SlotDocResolver) => SlotDocResolver;
}

/** What an announcer does before it names a face's own layer: `registers` stands the bag on the face's hive. */
export interface SlotAnnouncerOpts {
  readonly registers?: (bagId: string) => Promise<void>;
}

/** The announcer for one resolver: `worn` names the worn face's own slots, `sibling` a lit sibling's. */
export function slotAnnouncer(door: SlotNoticeDoor | null | undefined, whose: "worn" | "sibling", opts: SlotAnnouncerOpts = {}): SlotAnnouncer {
  const post = (bagId: string, documentId: string): void => {
    if (!door) return;
    if (whose === "sibling") announceSiblingSlotDoc(door, bagId, documentId);
    else announceSlotDoc(door, bagId, documentId);
  };
  const announced = (slug: string, kind: WikiSlotKind, url: string | null | undefined): void => {
    const documentId = documentIdOfUrl(url);
    if (documentId) post(wikiSlotUri(slug, kind), documentId);
  };
  // A face's own layer stands registered before its name leaves; a registration that faults still names it, so the vessel
  // holds its saves sealed or waiting, never clear, and its log names the refusal.
  const registeredThenAnnounced = async (slug: string, kind: WikiSlotKind, url: string | null | undefined): Promise<void> => {
    const documentId = documentIdOfUrl(url);
    if (!documentId) return;
    const bagId = wikiSlotUri(slug, kind);
    if (opts.registers && isFaceSlotBag(bagId)) {
      await opts.registers(bagId).catch((error: unknown) => {
        console.warn(`[slot] ${bagId} did not register on the face's hive before its naming (${error instanceof Error ? error.message : String(error)}): its saves wait sealed until it does`);
      });
      // The worn face's own layer waits for the vessel's filing, so the caller's first write lands sealed.
      if (door?.listen && whose === "worn") { await announceSlotDocFiled({ post: (m) => door.post(m), listen: (cb) => door.listen!(cb) }, bagId, documentId); return; }
    }
    post(bagId, documentId);
  };
  return {
    announced,
    device: (kind, documentId) => post(wikiSlotUri(DAEMON_WIKI_SLUG, kind), documentId),
    announcing: (resolver) => ({
      ...resolver,
      bindings: async (fingerprint, recipeTrace, slug) => {
        const out = await resolver.bindings(fingerprint, recipeTrace, slug);
        announced(slug, "working", out.workingUrl);
        await registeredThenAnnounced(slug, "draft", out.draftUrl);
        await registeredThenAnnounced(slug, "personal", out.personalUrl);
        return out;
      },
      writeSlot: (slug) => resolver.writeSlot(slug),
      // The call forwards as made: an absent option stays absent, never an explicit undefined.
      slotDoc: async (...call) => {
        const out = await resolver.slotDoc(...call);
        await registeredThenAnnounced(call[0], call[1], out?.url);
        return out;
      },
      draft: async (slug) => {
        const out = await resolver.draft(slug);
        await registeredThenAnnounced(slug, "draft", out.url);
        return out;
      },
    }),
  };
}
