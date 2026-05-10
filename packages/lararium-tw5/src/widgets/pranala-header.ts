/**
 * PranalaHeaderWidget — `<<~ ? -> uri >>` carrier-to-canonical edge.
 * The leading `?` token names this carrier itself; the URI names the
 * canonical address. Renders as a small breadcrumb anchor.
 */

import { makeCascadeSigilWidget } from "./_cascade-sigil-base.js";

const PranalaHeaderWidget = makeCascadeSigilWidget({
  cascadeTag:       "$:/tags/Lar/PranalaHeaderTemplate",
  fallbackTemplate: "lar:///ha.ka.ba/@lararium/templates/pranala-header/html",
  buildBindings:    (w) => ({ "pranala-header-uri": w.getAttribute("uri", "") }),
  placeholder:      (w) => `? -> ${w.getAttribute("uri", "")}`,
});

export { PranalaHeaderWidget as "pranala-header" };
