/**
 * tw5-widgets — barrel: re-exports lararium widget classes + filter operators.
 *
 * Each widget lives in its own file under src/widgets/.
 * Each filter operator lives in its own file under src/filters/.
 *
 * Widget registry (createLarariumWidgets) → TW5 tag name mapping:
 *   ahu        → AhuWidget       <$ahu>      carrier slot (cascade-routed
 *                                            template; lives in templates
 *                                            tagged $:/tags/Lar/AhuTemplate)
 *   kau        → KauWidget       <$kau>      Keyhive UCAN slot (port to
 *                                            template-cascade in Path G)
 *
 * Other sigils (pranala, papalohe, lele, kukali, kumu, toml, sigil, dynamic,
 * pae, etc.) ride the lar-sigil wikirule's literal-survival path — their
 * raw source survives intact through disk export. Per-sigil HTML rendering
 * gets ported to the template-cascade pattern in follow-up sprints.
 *
 * Filter operators (registerImplementorsOperator):
 *   implementors  exact-token match on implements field
 *   edge          edge-out-family-role field presence
 *   toml          TOML field name equality
 */

import type { TW5Instance } from "./types/tiddlywiki.js";

import { registerLarariumFilters } from "./tw5-filter.js";

export function registerImplementorsOperator(tw: TW5Instance): void {
  if (!tw?.filterOperators) return;
  registerLarariumFilters(tw);
}

export const LARARIUM_WIDGETS_TIDDLER = {
  title:         "lar:///lararium-node/tw5/widgets",
  type:          "application/javascript",
  "module-type": "widget",
  tags:          ["$:/tags/Global"],
  text:          "// Lararium widget bindings — registered via LarariumTW5._registerWidgets()",
  role:          "tw5-widget-module",
  cacheable:     "true",
  hydrate:       "true",
} as const;

// All cascade configs, templates, macros, and the meme-split mount have
// moved to tiddlers/*.tid and src/macros/*.ts.
// Build pipeline: Vite → tiddlers/src/*.js → TW5 plugin pack → dist-plugin/
