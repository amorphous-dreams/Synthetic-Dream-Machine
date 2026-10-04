/**
 * carrier-render — the node-fs shore's one doorway into tw5's OWN canonical render, for the two
 * self-describing carriers this shore mints: a bag's `meta.mem` declaration and a library
 * collection's INDEX.
 *
 * NO BESPOKE CARRIER RENDERER (operator ruling). The retired `bag-carrier.ts` hand-rolled the frame
 * AND decided the canonical body shape itself — key padding, blank-line placement, ahu spacing — a
 * second implementation of the render tw5's own parser∘render pipeline already owns. This module
 * decides NONE of that: it mints the frame through `@lararium/memetic-frame`'s shared `frameCarrier`
 * (the one hand that spells SOH/STX/ETX+check/EOT, so this never re-derives that law either) and then
 * hands the whole draft to `@lararium/tw5/carrier-canonical`'s `canonicalizeCarrierText` —
 * `render(parse(draftText))`, the SAME door `projection-gate` reads for the Confluence's congruence
 * `≈`. Whatever this module's own draft gets wrong about padding, key order, or ahu spacing, that
 * render corrects; the bytes that reach disk are tw5's render, never a second renderer's guess at it.
 *
 * WHY HERE AND NOT IN MESH. `@lararium/mesh` holds the pure data these two carriers render
 * (`BagManifest`, `LibraryEntryMeta`) and nothing about the memetic-wikitext FRAME — mesh has no tw5
 * dependency and never should. Both callers (`bag-declare.ts`, `library-store.ts`) already live in
 * `@lararium/node`, which already depends on `@lararium/tw5`.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */

import { frameCarrier, META_OPEN_RE } from "@lararium/memetic-frame";
import { canonicalizeCarrierText } from "@lararium/tw5/carrier-canonical";
import { parseTaploFields } from "@lararium/tw5";

/**
 * Key-aligned to a column width, so a hand-read draft looks like the `meta.mem` files an operator
 * already authors. Purely cosmetic: the canonical render below decides the bytes that actually land,
 * so a caller's padding choice here never reaches disk unexamined.
 */
export const kv = (key: string, value: string, width = 10): string => `${key.padEnd(width)} = "${value}"`;

/**
 * Frame a draft body and run it through tw5's OWN canonical render — the one place either carrier's
 * final bytes get decided.
 *
 * Throws only on a RENDERER BUG, never an operator's: a draft this module assembled that tw5's own
 * parser cannot round-trip at all (an `error` grade, or a structural slot the render drops) names a
 * defect in the draft shape a caller built above, never a corpus byte a reader wrote.
 */
export function renderCarrier(uri: string, body: string): string {
  const draft = frameCarrier({ head: { uri }, body });
  const canonical = canonicalizeCarrierText(uri, draft);
  if (canonical === null) {
    throw new Error(`carrier-render: ${uri} — tw5's own parser∘render could not round-trip the drafted body; the draft shape carries a defect, not the operator's bytes`);
  }
  return canonical;
}

/**
 * Read a carrier's root `toml meta` fence through tw5's OWN TOML field reader (`parseTaploFields`) —
 * the SAME parser the deserializer's meta-fence pass reads, never a second hand-rolled grammar that
 * only admits quoted strings. The fence span itself is located with `@lararium/memetic-frame`'s own
 * admitted-whitespace grammar (`META_OPEN_RE`), so a two-space `toml  meta` spelling the frame layer
 * already admits does not fall invisible here either.
 *
 * An absent or unlabelled fence reads EMPTY, never a throw — the caller's own fail-closed default
 * takes it from there.
 */
export function metaFieldsFromBody(body: string): Record<string, unknown> {
  const fence = new RegExp(`${META_OPEN_RE.source}([\\s\\S]*?)\\n\`\`\``).exec(body);
  return fence?.[1] ? parseTaploFields(fence[1]) : {};
}
