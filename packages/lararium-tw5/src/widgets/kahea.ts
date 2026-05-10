/**
 * KaheaWidget — `<<~ kahea <uri> >>` live transclusion (dataflow family).
 * Tracks edits to the target at render time. Distinct from aka by
 * projection-boundary semantics: kahea→aka substitution at disk-export
 * time is what makes the live/frozen distinction visible.
 */

import { makeCascadeSigilWidget } from "./_cascade-sigil-base.js";

const KaheaWidget = makeCascadeSigilWidget({
  cascadeTag:        "$:/tags/Lar/KaheaTemplate",
  fallbackTemplate:  "lar:///ha.ka.ba/@lararium/templates/kahea/html",
  buildBindings:     (w) => ({ "kahea-uri": w.getAttribute("uri", "") }),
  setCurrentTiddler: (w) => w.getAttribute("uri", ""),
  refreshUri:        (w) => w.getAttribute("uri", ""),
  placeholder:       (w) => `! kahea ${w.getAttribute("uri", "")}`,
});

export { KaheaWidget as kahea };
