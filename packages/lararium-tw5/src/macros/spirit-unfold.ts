/*\
title: lar:///ha.ka.ba/lararium/tw5/macros/spirit-unfold
type: application/javascript
module-type: macro
\*/
import { UNFOLD_MACRO, unfoldWikitext } from "@lararium/mesh/spirit-unfold";

/**
 * `<<spirit-unfold pet aperture>>` — a tasked spirit's progressive unfold, built and rendered inside the wiki that holds its
 * records: the card's fields at pulse, the card through its template at beat, the shrine's slots at measure (and arc), the whole
 * shrine carrier at theme.
 *
 * The macro hands the engine wikitext and the engine renders it: every field read, transclusion and slot listing runs as a
 * filter or widget over the wiki's own records, so a browser tab, `lares wiki render` and `lares spirit om | hum` read one
 * render. Where no card stands for the pet the macro renders nothing. The pure core (the rank an aperture names, the wikitext a
 * rank unfolds) stands in `@lararium/mesh/spirit-unfold` and rides bundled here; it reads no wiki, no clock and no env.
 */
export const name = UNFOLD_MACRO;

export const params = [{ name: "pet" }, { name: "aperture" }];

export function run(pet?: string, aperture?: string): string {
  return unfoldWikitext(typeof pet === "string" ? pet.trim() : "", aperture);
}
