/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/kahua-shadow
type: application/javascript
module-type: filteroperator
\*/
/**
 * kahua-shadow — `[kahua-shadow[]]`: keeps the input titles that cast a "local draft over shared"
 * shadow on this device, the titles whose topmost live record sits in a device-local daemon layer
 * while `bags/kahua` holds a differing body.
 *
 * The island adaptor stamps one temp-plane record per shadowed title (`kahua-shadow.ts`); this
 * operator reads those stamps, so the answer derives from the local cascade and a plain stock wiki
 * with no stamps answers empty. `[!kahua-shadow[]]` keeps the unshadowed titles.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { kahuaShadowTitle } from "../kahua-shadow-title.js";

export function kahuaShadow(
  source: TW5FilterSource,
  operator: TW5FilterOperator,
  options: { wiki: TW5Wiki },
): string[] {
  const results: string[] = [];
  source((_tiddler, title: string) => {
    const stamped = options.wiki.getTiddler(kahuaShadowTitle(title)) !== undefined;
    if (stamped !== (operator.prefix === "!")) results.push(title);
  });
  return results;
}

// TW5 registers a filter operator by its EXPORTED BINDING; the hyphenated name binds here.
export { kahuaShadow as "kahua-shadow" };
