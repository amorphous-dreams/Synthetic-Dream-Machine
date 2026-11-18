/**
 * THE KĀPAE ON DISK — the shadow file a raised kāpae leaves where its carrier stood.
 *
 * A working layer's exclusion gesture (EVICT · CLEAR · DROP · DELETE) raises a kāpae over a title, and the
 * kāpae shadows every copy beneath it (lar:///ha.ka.ba/lares/api/pono/kapae). The disk projection carries
 * that marker too, or a re-pour of the projection into a fresh root lets the canon copy fall through and
 * the operator's deliberate forgetting undoes itself. So where the carrier's file leaves, a shadow file
 * takes its stem:
 *
 *   <carrier-stem>.kapae   {"title":"<the carrier-root title>","kapae":"raised"}
 *
 * The file sits at the carrier's own siting, so its PLACE names the layer the kāpae stands in (the mirror
 * the file lives under), exactly as the carrier's place named the layer its record stood in. Its BYTES name
 * the title the kāpae shadows and the act it carries (`raised`): the identity a bag-cascade kāpae holds,
 * since a tombstone keys by layer and title alone. A shadow whose title disagrees with the title its
 * siting derives proves nothing and the ingest gesture skips it by name.
 *
 * Extension-independent by design: a carrier's extension varies by filetype (`.mem`, `.tid`, `.md` …), and
 * a shadow stands for the whole carrier whatever filetype it last held. The one-segment `.kapae` extension
 * never counts as a carrier home (`carrierDiskFiles`) and never scans as a carrier (`listCarriers`).
 *
 * A retract-to-absent (MOVE, promotion, an ingest rename re-link) writes no shadow, and removes one that
 * stands: the record fell through, so nothing stays set aside. Lowering a kāpae (a live record returns)
 * removes the shadow when the carrier writes back.
 */

/** The shadow file's extension. */
export const KAPAE_EXT = ".kapae";

/** The one act a shadow file carries. */
export const KAPAE_RAISED = "raised";

/** The bytes a shadow file holds for a title: stable, so a re-projection over a standing shadow writes nothing. */
export function kapaeShadowBody(title: string): string {
  return `${JSON.stringify({ title, kapae: KAPAE_RAISED })}\n`;
}

/**
 * Read a shadow file's bytes. Answers the title it shadows, or a refusal naming why the bytes prove no
 * kāpae: unparseable JSON, a missing title, or an act other than `raised`.
 */
export function readKapaeShadow(text: string): { readonly title: string } | { readonly refusal: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { refusal: "kapae-shadow-unparseable" }; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { refusal: "kapae-shadow-not-an-object" };
  const o = parsed as Record<string, unknown>;
  if (typeof o["title"] !== "string" || o["title"] === "") return { refusal: "kapae-shadow-names-no-title" };
  if (o["kapae"] !== KAPAE_RAISED) return { refusal: "kapae-shadow-names-no-raise" };
  return { title: o["title"] };
}
