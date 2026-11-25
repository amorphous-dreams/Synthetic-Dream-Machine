/*\
title: lar:///ha.ka.ba/lararium/tw5/macros/spirit-unfold
type: application/javascript
module-type: macro
\*/
import { UNFOLD_MACRO, unfoldWikitext } from "@lararium/mesh/spirit-unfold";

/**
 * `<<spirit-unfold pet aperture face>>` — a tasked spirit AS A FOLDED CARRIER, rendered inside the wiki that holds its records:
 * the envelope, the meta and every slot folded at pulse, the entry slot unfolded at beat, the attention and open slots at
 * measure (and arc), the whole carrier at theme. A folded slot stands as its `has` line and the command that fetches it.
 *
 * The macro hands the engine one text node whose value the skin's `spirit-fold` filter answers, so the carrier rides out byte
 * for byte, the same from a browser tab, `lares wiki render` and `lares spirit om | hum`. Where no record stands for the pet the
 * macro renders nothing. The pure core (the rank an aperture names, the call's shape) stands in `@lararium/mesh/spirit-unfold`
 * and rides bundled here; it reads no wiki, no clock and no env.
 */
export const name = UNFOLD_MACRO;

export const params = [{ name: "pet" }, { name: "aperture" }, { name: "face" }];

export function run(pet?: string, aperture?: string, face?: string): string {
  return unfoldWikitext(typeof pet === "string" ? pet.trim() : "", aperture, face);
}
