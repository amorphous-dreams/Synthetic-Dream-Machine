/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/loulou
type: application/javascript
module-type: widget
\*/
/**
 * LoulouWidget — `<<~ loulou <uri> >>` bidirectional relation edge sugar
 * (relation family). No body transclusion — relation declaration only.
 */

import { makeCascadeSigilWidget } from "./_cascade-sigil-base.js";

const LoulouWidget = makeCascadeSigilWidget({
  cascadeTag:       "$:/tags/Lar/LoulouTemplate",
  fallbackTemplate: "lar:///ha.ka.ba/@lararium/templates/loulou/html",
  buildBindings:    (w) => ({ "loulou-uri": w.getAttribute("uri", "") }),
  placeholder:      (w) => `<-> loulou ${w.getAttribute("uri", "")}`,
});

export { LoulouWidget as loulou };
