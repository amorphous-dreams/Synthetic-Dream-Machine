/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/meme-pin
type: application/javascript
module-type: filteroperator
\*/
/**
 * meme-pin — `[<uri>meme-pin[<part>]]`: THE ONE READ a pin's target answers, reached from inside a
 * filter so a template can branch on it without its own resolve/readPin call. The input title may
 * carry a `#/slot` fragment — the same grammar every `aka`/`kanawai` target already carries.
 *
 * `part`:
 *   kind        — `reference` | `content`, read off {@link readPin}'s own discriminant;
 *                 `unresolved` when the title's base answers unknown, or the fragment names no slot.
 *   check       — the `ni:` digest, slot-scoped when a fragment is named (the weave's own law —
 *                 {@link readPin} computes it, never this operator).
 *   title · author · date · seriesinfo · target
 *               — a REFERENCE meme's citation field. Absent on the target's own meta, or asked of a
 *                 content/unresolved pin → no output, never a placeholder — the grammar-stays-tiddlers
 *                 law: this operator owns no citation field list beyond what `readPin` already reads.
 *   citation-keys
 *               — the {@link CITATION_FIELD_KEYS} present on a REFERENCE pin, in that one order, so a
 *                 template drives its rows from this answer instead of hand-listing the five keys.
 *                 Content/unresolved pin → no output.
 *
 * An operand outside this set THROWS — the same law `meme-project` holds: a filter that answered
 * empty for a typo would read exactly like a pin that resolved to nothing.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { wikiResolver } from "../meme-project.js";
import { readPin, type ReadPinReference, CITATION_FIELD_KEYS } from "../weave/index.js";

const PARTS = new Set<string>(["kind", "check", "citation-keys", ...CITATION_FIELD_KEYS]);

export function memePin(
  source: TW5FilterSource,
  operator: TW5FilterOperator,
  options: { wiki: TW5Wiki },
): string[] {
  const part = operator.operand ?? "";
  if (!PARTS.has(part)) {
    throw new Error(`meme-pin: unknown part "${part}" — parts: ${[...PARTS].join(" · ")}`);
  }
  const resolve = wikiResolver(options.wiki);
  const results: string[] = [];
  source((_tiddler, title: string) => {
    const hashIdx = title.indexOf("#");
    const slot = hashIdx === -1 ? null : title.slice(hashIdx + 1);
    const resolved = resolve(title);
    const pin = resolved === null ? null : readPin(resolved, slot);
    if (pin === null) {
      if (part === "kind") results.push("unresolved");
      return;
    }
    if (part === "kind") { results.push(pin.kind); return; }
    if (part === "check") { results.push(pin.check); return; }
    // Citation fields, and the key list itself, live on a REFERENCE pin alone — a content/unresolved
    // pin answers no output, never a placeholder, exactly the law an absent field already follows.
    if (pin.kind !== "reference") return;
    const citation = (pin as ReadPinReference).citation;
    if (part === "citation-keys") {
      for (const k of CITATION_FIELD_KEYS) if (citation?.[k]) results.push(k);
      return;
    }
    const v = citation?.[part as (typeof CITATION_FIELD_KEYS)[number]];
    if (v) results.push(v);
  });
  return results;
}

// TW5 registers a filter operator by its EXPORTED BINDING; the hyphenated name binds here.
export { memePin as "meme-pin" };
