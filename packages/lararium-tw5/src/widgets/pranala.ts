/*\
title: lar:///ha.ka.ba/@lararium/tw5/widgets/pranala
type: application/javascript
module-type: widget
\*/
/**
 * PranalaWidget — explicit edge sigil. Two surface forms share the widget:
 *   Inline:  `<<~ pranala #name? <from> -> <to> [family:f] [role:r] >>`
 *   Block:   `<<~ pranala #name? <from> -> <to> >>body<<~/pranala >>`
 *
 * Templates branch on `<<pranala-body>>` non-emptiness to distinguish
 * block from inline at render time.
 */

import { makeCascadeSigilWidget } from "./_cascade-sigil-base.js";

const PranalaWidget = makeCascadeSigilWidget({
  cascadeTag:       "$:/tags/Lar/PranalaTemplate",
  fallbackTemplate: "lar:///ha.ka.ba/@lararium/templates/pranala/html",
  buildBindings:    (w) => ({
    "pranala-slot":   w.getAttribute("slot",   ""),
    "pranala-from":   w.getAttribute("from",   ""),
    "pranala-to":     w.getAttribute("to",     ""),
    "pranala-body":   w.getAttribute("body",   ""),
    "pranala-family": w.getAttribute("family", ""),
    "pranala-role":   w.getAttribute("role",   ""),
  }),
  placeholder: (w) =>
    `pranala ${w.getAttribute("from", "")} -> ${w.getAttribute("to", "")}`,
});

export { PranalaWidget as pranala };
