/**
 * tw5-widgets — barrel: re-exports all lararium widget classes and filter operators.
 *
 * Each widget lives in its own file under src/widgets/.
 * Each filter operator lives in its own file under src/filters/.
 * The build script (sync-heleuma --sync-modules) reads these files, strips types,
 * and injects compiled JS into the corresponding lares/ module tiddlers.
 *
 * Widget registry (createLarariumWidgets) → TW5 tag name mapping:
 *   ahu        → AhuWidget       <$ahu>      carrier slot
 *   pranala    → PranalaWidget   <$pranala>  explicit edge metadata
 *   papalohe   → PapaloheWidget  <$papalohe> reaction wire edge
 *   lele       → LeleWidget      <$lele>     fire-and-forget dispatch
 *   kukali     → KukaliWidget    <$kukali>   reactive wait posture
 *   kumu       → KumuWidget      <$kumu>     device instance
 *   toml       → TomlWidget      <$toml>     data block
 *   sigil      → SigilWidget     <$sigil>    generic sigil container
 *   dynamic    → DynamicWidget   <$dynamic>  grammar-meme extension
 *   pae        → PaeWidget       <$pae>      phase boundary marker
 *
 * Filter operators (registerImplementorsOperator):
 *   implementors  exact-token match on implements field
 *   edge          edge-out-family-role field presence
 *   toml          TOML field name equality
 */

import type { TW5Instance } from "./types/tiddlywiki.js";

type WidgetCtor = { prototype: unknown };
type WidgetCtorWithProto = WidgetCtor & { prototype: unknown };

export { PranalaWidget }  from "./widgets/pranala.js";
export { PaeWidget }      from "./widgets/pae.js";
export { LeleWidget }     from "./widgets/lele.js";
export { PapaloheWidget } from "./widgets/papalohe.js";
export { KukaliWidget }   from "./widgets/kukali.js";
export { TomlWidget }     from "./widgets/toml.js";
export { SigilWidget }    from "./widgets/sigil.js";
export { DynamicWidget }  from "./widgets/dynamic.js";
export { AhuWidget }      from "./widgets/ahu.js";
export { KumuWidget }     from "./widgets/kumu.js";
export { KauWidget }      from "./widgets/kau.js";

import { PranalaWidget }  from "./widgets/pranala.js";
import { PaeWidget }      from "./widgets/pae.js";
import { LeleWidget }     from "./widgets/lele.js";
import { PapaloheWidget } from "./widgets/papalohe.js";
import { KukaliWidget }   from "./widgets/kukali.js";
import { TomlWidget }     from "./widgets/toml.js";
import { SigilWidget }    from "./widgets/sigil.js";
import { DynamicWidget }  from "./widgets/dynamic.js";
import { AhuWidget }      from "./widgets/ahu.js";
import { KumuWidget }     from "./widgets/kumu.js";
import { KauWidget }      from "./widgets/kau.js";

import { registerLarariumFilters } from "./tw5-filter.js";

export function createLarariumWidgets(_tw: TW5Instance): Record<string, WidgetCtorWithProto> {
  return {
    "ahu":      AhuWidget      as unknown as WidgetCtorWithProto,
    "pranala":  PranalaWidget  as unknown as WidgetCtorWithProto,
    "papalohe": PapaloheWidget as unknown as WidgetCtorWithProto,
    "lele":     LeleWidget     as unknown as WidgetCtorWithProto,
    "kukali":   KukaliWidget   as unknown as WidgetCtorWithProto,
    "kumu":     KumuWidget     as unknown as WidgetCtorWithProto,
    "kau":      KauWidget      as unknown as WidgetCtorWithProto,
    "toml":     TomlWidget     as unknown as WidgetCtorWithProto,
    "sigil":    SigilWidget    as unknown as WidgetCtorWithProto,
    "dynamic":  DynamicWidget  as unknown as WidgetCtorWithProto,
    "pae":      PaeWidget      as unknown as WidgetCtorWithProto,
  };
}

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

/**
 * Cascade config tiddlers for sigil-widget template selection.
 *
 * Each entry's `text` field holds a TW5 filter expression. AhuWidget walks
 * the cascade (highest-priority `list` order first), evaluates each entry's
 * filter, and the first non-empty result names the template tiddler URI to
 * transclude. The template renders the slot child as `currentTiddler`.
 *
 * Two entries ship by default:
 *   - markdown-meme: matches when the export-scope variable is set, returns
 *     the disk-export template URI. Used by `exportMemeText`.
 *   - html (default): no scope filter, always matches; returns the live UI
 *     template URI. Active for the wiki shell and ordinary view rendering.
 *
 * Operators may override per-wiki by tagging additional tiddlers with
 * `$:/tags/Lar/AhuTemplate` (cascade re-evaluates dynamically).
 */
export const LARARIUM_AHU_CASCADE_MARKDOWN_MEME = {
  title:       "$:/config/Lar/AhuTemplate/markdown-meme",
  tags:        ["$:/tags/Lar/AhuTemplate"],
  "list-before": "$:/config/Lar/AhuTemplate/html",
  text:        "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme]]",
} as const;

export const LARARIUM_AHU_CASCADE_HTML = {
  title:       "$:/config/Lar/AhuTemplate/html",
  tags:        ["$:/tags/Lar/AhuTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/ahu/html]]",
} as const;
