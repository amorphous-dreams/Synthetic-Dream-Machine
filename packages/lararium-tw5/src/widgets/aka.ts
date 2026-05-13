/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/aka
type: application/javascript
module-type: widget
\*/
/**
 * AkaWidget — `<<~ aka <uri> >>` shadow transclusion (observe family).
 * Frozen-at-projection-time read of a remote meme. The cascade
 * `$:/tags/Lar/AkaTemplate` selects the active template; defaults
 * defaults ship as .tid files in tiddlers/.
 */

import { makeCascadeSigilWidget } from "./_cascade-sigil-base.js";

const AkaWidget = makeCascadeSigilWidget({
  cascadeTag:        "$:/tags/Lar/AkaTemplate",
  fallbackTemplate:  "lar:///ha.ka.ba/@lararium/templates/aka/html",
  buildBindings:     (w) => ({ "aka-uri": w.getAttribute("uri", "") }),
  setCurrentTiddler: (w) => w.getAttribute("uri", ""),
  refreshUri:        (w) => w.getAttribute("uri", ""),
  placeholder:       (w) => `? aka ${w.getAttribute("uri", "")}`,
});

export { AkaWidget as aka };
