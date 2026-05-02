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

import type {
  TW5Instance,
  TW5FilterSource,
} from "./types/tiddlywiki.js";

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
  // all[memes] — alias for all[tiddlers] via allfilteroperator module type.
  if (tw?.modules?.types) {
    tw.modules.types["allfilteroperator"] = tw.modules.types["allfilteroperator"] ?? {};
    if (!tw.modules.types["allfilteroperator"]["memes"]) {
      tw.modules.types["allfilteroperator"]["memes"] = {
        moduleType: "allfilteroperator",
        definition: null,
        exports: {
          memes: function (_source: TW5FilterSource, _prefix: string, options: { wiki: { each: unknown } }) {
            return options.wiki.each;
          },
        },
      };
    }
  }
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
