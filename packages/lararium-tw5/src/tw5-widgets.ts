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

type WidgetCtor = { prototype: unknown };
type WidgetCtorWithProto = WidgetCtor & { prototype: unknown };

export { AhuWidget }          from "./widgets/ahu.js";
export { KauWidget }          from "./widgets/kau.js";
export { LarMemeSplitWidget } from "./widgets/lar-meme-split.js";

import { AhuWidget }          from "./widgets/ahu.js";
import { KauWidget }          from "./widgets/kau.js";
import { LarMemeSplitWidget } from "./widgets/lar-meme-split.js";

import { registerLarariumFilters } from "./tw5-filter.js";

export function createLarariumWidgets(_tw: TW5Instance): Record<string, WidgetCtorWithProto> {
  return {
    "ahu":             AhuWidget          as unknown as WidgetCtorWithProto,
    "kau":             KauWidget          as unknown as WidgetCtorWithProto,
    "lar-meme-split":  LarMemeSplitWidget as unknown as WidgetCtorWithProto,
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
 * Global mount for `<$lar-meme-split>`. The widget self-subscribes to wiki
 * change events on render; tagging this tiddler `$:/tags/Global` ensures
 * TW5 instantiates it once at boot for the lifetime of the wiki. The
 * subscription handles all subsequent memetic-wikitext saves — the fourth
 * call site of the operator's "ONE parser, FOUR call sites" law.
 */
export const LARARIUM_MEME_SPLIT_MOUNT = {
  title: "$:/lararium/mounts/lar-meme-split",
  tags:  ["$:/tags/Global"],
  text:  "<$lar-meme-split/>",
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
/**
 * Cascade ordering — list-before / list-after govern evaluation order.
 *
 * Walked top-to-bottom; first non-empty filter result wins. Operators may
 * insert their own entries by tagging additional tiddlers with
 * `$:/tags/Lar/AhuTemplate` and setting `list-before` / `list-after`.
 *
 * Three markdown-meme entries, distinguished by tiddler shape:
 *
 *   1. **kahea-ref** — when a slot child carries `$:/tags/Lar/MemeRoot`,
 *      the parent's emission emits a `<<~ kahea ahu #slot >>` reference
 *      and DOES NOT inline the body. The tagged child gets its own
 *      file via the disk-projector's separate render pass.
 *   2. **fragment** — slot child without the MemeRoot tag, body-only
 *      content. Parent emission inlines `<<~ ahu #slot >>body<<~/ahu >>`.
 *   3. **html** (default fallback) — live-UI rendering.
 *
 * The discriminator filter `[<currentTiddler>tag[$:/tags/Lar/MemeRoot]]`
 * runs inside each cascade entry's text. TW5 evaluates with the active
 * variable scope, so `<currentTiddler>` resolves to the slot child URI
 * the AhuWidget set before invoking the cascade.
 */
export const LARARIUM_AHU_CASCADE_MARKDOWN_MEME_KAHEA = {
  title:         "$:/config/Lar/AhuTemplate/markdown-meme-kahea",
  tags:          ["$:/tags/Lar/AhuTemplate"],
  "list-before": "$:/config/Lar/AhuTemplate/markdown-meme-fragment",
  text:          "[<lar-export-scope>match[markdown-meme]] :and[<currentTiddler>tag[$:/tags/Lar/MemeRoot]then[lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme-kahea]]",
} as const;

export const LARARIUM_AHU_CASCADE_MARKDOWN_MEME = {
  title:         "$:/config/Lar/AhuTemplate/markdown-meme-fragment",
  tags:          ["$:/tags/Lar/AhuTemplate"],
  "list-before": "$:/config/Lar/AhuTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme]]",
} as const;

export const LARARIUM_AHU_CASCADE_HTML = {
  title:       "$:/config/Lar/AhuTemplate/html",
  tags:        ["$:/tags/Lar/AhuTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/ahu/html]]",
} as const;

/**
 * Default ahu render templates — shipped as preload tiddlers so the cascade
 * always resolves to a valid template at boot. Operators may override per-
 * wiki by writing tiddlers at the same lar:/// titles via the engine corpus
 * meme-loading path; preload tiddlers act as the floor.
 *
 * The `markdown-meme` template emits the canonical disk form:
 *   `<<~ ahu {{slot}} >>\n{{body}}\n<<~/ahu >>`. Slot and body come from
 * the slot-child tiddler's fields; the AhuWidget sets currentTiddler before
 * transcluding the template, so {{!!slot}} and {{!!text}} resolve naturally.
 *
 * The `html` template emits a clickable section with the slot child's body
 * transcluded into it. Operators get click-through inspection of slot
 * metadata directly from the parent meme view.
 */
/**
 * Slot template — markdown-meme scope.
 *
 * The `\rules only` pragma curates a minimal rule set for verbatim emission.
 * `transcludeinline` resolves `{{!!slot}}` and `{{!!text}}` field references;
 * everything else (backticks, dashes, html entities, HTML comments,
 * macrocall, our own lar-sigil rules) STAYS LITERAL. Without `\rules only`
 * the wikifier would interpret `<<~ ahu` as a macro call, ` ``` ` as a code
 * fence, `&#x0001;` as a control char, etc. — round-trip identity breaks.
 *
 * The template emits the canonical disk form for an ahu slot: opener +
 * body + closer. Slot identifier read from the slot child's `slot` field;
 * body from its `text` field. Per-slot iam emission (default-elision
 * against parent fields) lands via macros in Path D.
 */
export const LARARIUM_AHU_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ ahu {{!!slot}} >>\n{{!!text}}\n<<~/ahu >>\n",
} as const;

/**
 * Slot template — markdown-meme scope, kahea-ref variant.
 *
 * Fires when the slot child carries `$:/tags/Lar/MemeRoot`. The tagged
 * child becomes its own file via the disk-projector's separate render
 * pass; the parent's emission emits a `<<~ kahea ahu #slot >>` reference
 * (live-ref form per memetic-wikitext spec §5.3) and stops there. The
 * parent file stays compact; the child file carries its full framing.
 *
 * Round-trip identity: source (parent file with kahea-ref + child file
 * with framing) → ingest into bag (flat tiddler set; child carries the
 * MemeRoot tag) → emit (parent file's kahea-ref + child file's framing).
 * Operator-source-told-you-to: the iam tag drives the split.
 */
export const LARARIUM_AHU_TEMPLATE_MARKDOWN_MEME_KAHEA = {
  title:    "lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme-kahea",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ kahea ahu {{!!slot}} >>",
} as const;

export const LARARIUM_AHU_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/ahu/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<section class="lar-ahu" data-uri=<<currentTiddler>>><header class="lar-ahu-slot"><$link to=<<currentTiddler>>>{{!!slot}}</$link></header><div class="lar-ahu-body"><$transclude $tiddler=<<currentTiddler>> mode="block"/></div></section>',
} as const;

/**
 * Meme-level template — markdown-meme scope.
 *
 * Wraps a parent meme's text field with `\rules only` so the wikifier emits
 * everything literal except the lar-sigil rules and field transclusions. The
 * lar-sigil-block rule then routes ahu sigil openers to AhuWidget (which
 * transcludes the slot child via the cascade-resolved slot template), and
 * the lar-sigil-inline rule emits everything else (aka, kahea, loulou,
 * pranala-header, carrier sentinels) as literal-survival text nodes.
 *
 * Round-trip law: the rendered output equals the operator's source text,
 * with slot bodies reconstructed from their authoritative child tiddlers.
 *
 * Curated rule set:
 *   transcludeinline      — `{{!!text}}` resolves the parent's text field.
 *   lar-sigil-block       — `<<~ ahu #slot >>...<<~/ahu>>` → AhuWidget.
 *   lar-sigil-inline      — every other `<<~ ... >>` → literal source slice.
 *   lar-doctype-comment   — `<!-- <<~ !DOCTYPE = ... >> -->` → literal.
 *
 * Everything else (backticks, dashes, html entities, html comments,
 * macrocall, paragraph wrapping, etc.) does NOT fire — meme content
 * survives byte-for-byte.
 */
/**
 * The `prologue` field carries pre-SOH content (DOCTYPE comment + any
 * leading prose) captured by the deserializer at sync time. Emit it
 * verbatim ahead of the meme body so disk projection round-trips the
 * full operator-authored source — including the framing comment that
 * names the meme's grammar contract.
 */
export const LARARIUM_MEME_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<$list filter=\"[<currentTiddler>has[prologue]]\" variable=\"_\">{{!!prologue}}</$list>{{!!text}}",
} as const;
