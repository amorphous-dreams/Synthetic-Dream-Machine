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

/**
 * Global mount for `<$lar-meme-split>`. The widget self-subscribes to wiki
 * change events on render; tagging this tiddler `$:/tags/Global` ensures
 * TW5 instantiates it once at boot for the lifetime of the wiki. The
 * subscription handles all subsequent memetic-wikitext saves — the fourth
 * call site of the operator's "ONE parser, FOUR call sites" law.
 */
// Mount tiddler TITLE moves into lar: namespace (sync-eligible); tag
// VALUE stays `$:/tags/Global` (TW5 core requirement for global widget
// instantiation — tag values aren't titles).
export const LARARIUM_MEME_SPLIT_MOUNT = {
  title: "lar:///mounts/lar-meme-split",
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
 * Cascade ordering — `list-before` / `list-after` govern evaluation order.
 *
 * Walked top-to-bottom; first non-empty filter result wins. Operators may
 * insert their own entries between these by tagging additional tiddlers
 * with `$:/tags/Lar/AhuTemplate`.
 *
 * **Architectural law (operator-confirmed):** always-split, always-kahea.
 * The deserializer + action widget split every ahu sigil into its own
 * tiddler at sync/save time; the parent's text always carries kahea-refs
 * for its slot children. Disk emission therefore collapses to one shape:
 * the slot template emits `<<~ kahea ahu #slot >>`. Each child becomes
 * its own file. Round-trip is canonical: parent file + N child files.
 *
 * Operator-installable cascades may opt into "single long-form meme"
 * projection by registering an entry that inlines child bodies — that's
 * a non-default render mode, shipped via operator-authored cascade
 * entries, not baked into the core. Roslyn / recast / XInclude consensus:
 * serialization is a function of the tree, never of external metadata.
 */
// Cascade config tiddler TITLES live in the lar: namespace so operator
// customizations sync to peers. Tag VALUES (`$:/tags/Lar/AhuTemplate`)
// remain TW5-conventional — tag values aren't titles, don't intersect
// the sync filter, and let our cascade entries plug into TW5's standard
// cascade-tag discovery.
export const LARARIUM_AHU_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/AhuTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/AhuTemplate"],
  "list-before": "lar:///config/Lar/AhuTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme]]",
} as const;

export const LARARIUM_AHU_CASCADE_HTML = {
  title:       "lar:///config/Lar/AhuTemplate/html",
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
/**
 * Slot template — markdown-meme scope. Single canonical shape.
 *
 * Always emits `<<~ kahea ahu #slot >>` — the spec's live-ref form,
 * per memetic-wikitext.md §5.3. The slot child is authoritative for
 * its own body; disk-projector emits each child as its own file. The
 * parent file holds invocation references; the child files hold body
 * bytes. Round-trip is canonical: parent file + N child files.
 *
 * No "inline body" variant ships in the default cascade. Operators
 * who want a single-long-form projection author their own cascade
 * entry that points at an inline-emitting template — non-default,
 * non-canonical, opt-in.
 */
export const LARARIUM_AHU_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/ahu/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ kahea ahu {{!!slot}} >>",
} as const;

export const LARARIUM_AHU_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/ahu/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<section class="lar-ahu" data-uri=<<currentTiddler>>><header class="lar-ahu-slot"><$link to=<<currentTiddler>>>{{!!slot}}</$link></header><div class="lar-ahu-body"><$transclude $tiddler=<<currentTiddler>> mode="block"/></div></section>',
} as const;

/**
 * Aka cascade — selects the render template for `<<~ aka <uri> >>` URI
 * sigil widgets. Same shape as the ahu cascade. The `aka-uri` variable
 * (set by AkaWidget) lets the markdown-meme template re-emit the literal
 * sigil source verbatim; `currentTiddler` resolves to the aka target so
 * the html template transcludes its body.
 */
export const LARARIUM_AKA_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/AkaTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/AkaTemplate"],
  "list-before": "lar:///config/Lar/AkaTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/aka/markdown-meme]]",
} as const;

export const LARARIUM_AKA_CASCADE_HTML = {
  title:       "lar:///config/Lar/AkaTemplate/html",
  tags:        ["$:/tags/Lar/AkaTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/aka/html]]",
} as const;

/**
 * Aka templates. The markdown-meme template emits the canonical literal
 * source `<<~ aka <uri> >>` so disk round-trip preserves it byte-for-byte;
 * the html template transcludes the URI's body inside a clickable section.
 *
 * The `aka-uri` variable is bound by AkaWidget before transclusion so the
 * markdown-meme template can read the source URI without depending on
 * `currentTiddler` (which is set to the target tiddler for body access).
 */
export const LARARIUM_AKA_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/aka/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ aka <<aka-uri>> >>",
} as const;

export const LARARIUM_AKA_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/aka/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<span class="lar-aka" data-aka-uri=<<aka-uri>>><$link to=<<aka-uri>>><<aka-uri>></$link><span class="lar-aka-shadow"><$transclude $tiddler=<<aka-uri>> mode="inline"/></span></span>',
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
 * The `prologue` and `postamble` fields carry pre-SOH and post-ETX content
 * (DOCTYPE comment + leading prose, and trailing comments / closing prose)
 * captured by the deserializer at sync time. Emit both verbatim around the
 * meme body so disk projection round-trips the full operator-authored
 * source — including the framing comment that names the meme's grammar
 * contract and any trailing edge declarations or commentary.
 */
export const LARARIUM_MEME_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<$list filter=\"[<currentTiddler>has[prologue]]\" variable=\"_\">{{!!prologue}}</$list>{{!!text}}<$list filter=\"[<currentTiddler>has[postamble]]\" variable=\"_\">{{!!postamble}}</$list>",
} as const;
