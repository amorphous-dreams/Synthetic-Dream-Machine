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
 * Pranala-header cascade — `<<~ ? -> uri >>` carrier-to-canonical edge.
 * Same shape as ahu/aka cascades. The `pranala-header-uri` variable carries
 * the source URI; markdown-meme template re-emits the literal sigil; html
 * template emits a small breadcrumb anchor.
 */
export const LARARIUM_PRANALA_HEADER_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/PranalaHeaderTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/PranalaHeaderTemplate"],
  "list-before": "lar:///config/Lar/PranalaHeaderTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/pranala-header/markdown-meme]]",
} as const;

export const LARARIUM_PRANALA_HEADER_CASCADE_HTML = {
  title:       "lar:///config/Lar/PranalaHeaderTemplate/html",
  tags:        ["$:/tags/Lar/PranalaHeaderTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/pranala-header/html]]",
} as const;

export const LARARIUM_PRANALA_HEADER_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/pranala-header/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ ? -> <<pranala-header-uri>> >>",
} as const;

export const LARARIUM_PRANALA_HEADER_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/pranala-header/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<span class="lar-pranala-header" data-canonical-uri=<<pranala-header-uri>>>? &rarr; <$link to=<<pranala-header-uri>>><<pranala-header-uri>></$link></span>',
} as const;

/**
 * Kahea cascade — `<<~ kahea <uri> >>` live transclusion. Same shape as
 * aka cascade. The `kahea-uri` variable carries the source URI;
 * markdown-meme template re-emits the literal sigil; html template
 * transcludes the target's body inside a `.lar-kahea` span.
 */
export const LARARIUM_KAHEA_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/KaheaTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/KaheaTemplate"],
  "list-before": "lar:///config/Lar/KaheaTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/kahea/markdown-meme]]",
} as const;

export const LARARIUM_KAHEA_CASCADE_HTML = {
  title:       "lar:///config/Lar/KaheaTemplate/html",
  tags:        ["$:/tags/Lar/KaheaTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/kahea/html]]",
} as const;

export const LARARIUM_KAHEA_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/kahea/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ kahea <<kahea-uri>> >>",
} as const;

export const LARARIUM_KAHEA_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/kahea/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<span class="lar-kahea" data-kahea-uri=<<kahea-uri>>><$link to=<<kahea-uri>>><<kahea-uri>></$link><span class="lar-kahea-live"><$transclude $tiddler=<<kahea-uri>> mode="inline"/></span></span>',
} as const;

/**
 * Loulou cascade — `<<~ loulou <uri> >>` bidirectional relation edge sugar.
 * No body transclusion (relation edge, not transclusion). Markdown-meme
 * template re-emits the literal sigil; html template emits a plain
 * `.lar-loulou` link annotated as a relation.
 */
export const LARARIUM_LOULOU_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/LoulouTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/LoulouTemplate"],
  "list-before": "lar:///config/Lar/LoulouTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/loulou/markdown-meme]]",
} as const;

export const LARARIUM_LOULOU_CASCADE_HTML = {
  title:       "lar:///config/Lar/LoulouTemplate/html",
  tags:        ["$:/tags/Lar/LoulouTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/loulou/html]]",
} as const;

export const LARARIUM_LOULOU_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/loulou/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text:     "<<~ loulou <<loulou-uri>> >>",
} as const;

export const LARARIUM_LOULOU_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/loulou/html",
  type:     "text/vnd.tiddlywiki",
  text:     '<span class="lar-loulou" data-loulou-uri=<<loulou-uri>>><$link to=<<loulou-uri>>><<loulou-uri>></$link></span>',
} as const;

/**
 * Pranala cascade — `<<~ pranala #slot? from -> to family:f? role:r? >>` and
 * its block form. Templates read pranala-slot / -from / -to / -body /
 * -family / -role variables. Markdown-meme template reconstructs the
 * canonical literal source from the variable bindings; html template emits
 * an arrow-shaped edge widget (with optional `<details>` body for block
 * form when `<<pranala-body>>` is non-empty).
 */
export const LARARIUM_PRANALA_CASCADE_MARKDOWN_MEME = {
  title:         "lar:///config/Lar/PranalaTemplate/markdown-meme",
  tags:          ["$:/tags/Lar/PranalaTemplate"],
  "list-before": "lar:///config/Lar/PranalaTemplate/html",
  text:          "[<lar-export-scope>match[markdown-meme]then[lar:///ha.ka.ba/@lararium/templates/pranala/markdown-meme]]",
} as const;

export const LARARIUM_PRANALA_CASCADE_HTML = {
  title:       "lar:///config/Lar/PranalaTemplate/html",
  tags:        ["$:/tags/Lar/PranalaTemplate"],
  text:        "[[lar:///ha.ka.ba/@lararium/templates/pranala/html]]",
} as const;

/**
 * Pranala templates. The markdown-meme template reconstructs the canonical
 * disk form. Two surface shapes: inline (no body) and block (with body); the
 * template branches on `<<pranala-body>>` non-emptiness.
 *
 * Inline emit:  `<<~ pranala [#slot ]from -> to[ family:f][ role:r] >>`
 * Block emit:   `<<~ pranala [#slot ]from -> to >>body<<~/pranala >>`
 *
 * The `<$list>` filter pattern selects between block and inline based on
 * pranala-body presence; trailing `family:` and `role:` bindings are
 * conditionally appended only when non-empty so the round-trip emits no
 * empty trailing whitespace.
 */
export const LARARIUM_PRANALA_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/pranala/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text: [
    "<$list filter=\"[<pranala-body>!is[blank]]\" variable=\"_\" emptyMessage=\"<<~ pranala <$list filter='[<pranala-slot>!is[blank]]' variable='_'><<pranala-slot>> </$list><<pranala-from>> -> <<pranala-to>><$list filter='[<pranala-family>!is[blank]]' variable='_'> family:<<pranala-family>></$list><$list filter='[<pranala-role>!is[blank]]' variable='_'> role:<<pranala-role>></$list> >>\">",
    "<<~ pranala <$list filter=\"[<pranala-slot>!is[blank]]\" variable=\"_\"><<pranala-slot>> </$list><<pranala-from>> -> <<pranala-to>> >><<pranala-body>><<~/pranala >>",
    "</$list>",
  ].join(""),
} as const;

export const LARARIUM_PRANALA_TEMPLATE_HTML = {
  title:    "lar:///ha.ka.ba/@lararium/templates/pranala/html",
  type:     "text/vnd.tiddlywiki",
  text: [
    "<span class=\"lar-pranala\" data-from=<<pranala-from>> data-to=<<pranala-to>>",
    "<$list filter=\"[<pranala-family>!is[blank]]\" variable=\"_\"> data-family=<<pranala-family>></$list>",
    "<$list filter=\"[<pranala-role>!is[blank]]\" variable=\"_\"> data-role=<<pranala-role>></$list>",
    ">",
    "<$link to=<<pranala-from>>><<pranala-from>></$link>&rarr;<$link to=<<pranala-to>>><<pranala-to>></$link>",
    "<$list filter=\"[<pranala-body>!is[blank]]\" variable=\"_\"><details class=\"lar-pranala-body\"><summary>note</summary><<pranala-body>></details></$list>",
    "</span>",
  ].join(""),
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
 * The meme-level template emits a tiddler's full disk projection:
 *
 *   prologue?    — pre-SOH framing (DOCTYPE comment + leading prose), parent
 *                  meme only.
 *   preamble?    — pre-first-sigil prose flanking the iam toml. The
 *                  `<<~ iam >>` sentinel inside preamble gets substituted
 *                  with the regenerated iam toml block (operator-authored
 *                  bytes preserved via `iam-source` field).
 *   text         — body proper.
 *   postamble?   — trailing prose (parent meme = post-ETX content; slot
 *                  child = post-last-inner-sigil content).
 *
 * Round-trip law: anything in the operator's source survives the cycle.
 * The sentinel substitution uses TW5's filter operator `search-replace` to
 * rewrite the marker in-place inside the preamble field's text.
 *
 * The fenced toml block re-emits with literal triple-backticks since the
 * meme-template runs under `text/x-memetic-wikitext` — the curated rule
 * set keeps backticks as bytes (codeblock rule does not fire).
 */
export const LARARIUM_MEME_TEMPLATE_MARKDOWN_MEME = {
  title:    "lar:///ha.ka.ba/@lararium/templates/meme/markdown-meme",
  type:     "text/x-memetic-wikitext",
  text: [
    // Prologue / preamble / postamble emit via <$text> — TW5 wiki rules
    // pragma doesn't propagate through field transclude (Jermolene, GH
    // #6712). Field-transcluded content reparses under default wikitext
    // rules, where codeblock eats backticks and macrocall claims `<<...>>`.
    // <$text text={{!!field}}/> emits the field bytes verbatim with no
    // re-parse — bytes survive round-trip exactly.
    //
    // Prologue (DOCTYPE comment + leading prose) emits for all memes that
    // carry it. Parents have it from the original source; slot children
    // inherit it from their parent during deserialization.
    "<$list filter=\"[<currentTiddler>has[prologue]]\" variable=\"_\"><$text text={{!!prologue}}/></$list>",
    // Slot children: SOH/ETX are NOT in {{!!text}} (text = body proper only).
    // Emit SOH here; ETX follows postamble below.
    "<$list filter=\"[<currentTiddler>has[fragment-parent]]\" variable=\"_\"><$text text=\"<<~&#x0001; ? -> \"/><$text text=<<currentTiddler>>/><$text text=\" >>\n\"/></$list>",
    // IAM block for slot children: use preamble-rendered (operator-authored
    // slot bodies with <<~ iam >>) when present; fall back to iam-source
    // (full effective iam, generated at deserialize time) wrapped in toml
    // fences; finally plain preamble if no iam. Parents carry iam inside
    // {{!!text}} so no emission needed here for them.
    "<$list filter=\"[<currentTiddler>has[fragment-parent]has[preamble-rendered]]\" variable=\"_\"><$text text={{!!preamble-rendered}}/></$list>",
    "<$list filter=\"[<currentTiddler>has[fragment-parent]!has[preamble-rendered]has[preamble]]\" variable=\"_\"><$text text={{!!preamble}}/></$list>",
    "<$list filter=\"[<currentTiddler>has[fragment-parent]!has[preamble-rendered]!has[preamble]has[iam-source]]\" variable=\"_\"><$text text=\"`\`\`toml iam\n\"/><$text text={{!!iam-source}}/><$text text=\"`\`\`\n\n\"/></$list>",
    // STX (&#x0002;) opens the body stream after the iam block.
    "<$list filter=\"[<currentTiddler>has[fragment-parent]]\" variable=\"_\"><$text text=\"<<~&#x0002;>>\n\n\"/></$list>",
    // text field continues to wikitext-parse so kahea refs and other
    // sigils route through the wikirule + cascade.
    "{{!!text}}",
    "<$list filter=\"[<currentTiddler>has[postamble]]\" variable=\"_\"><$text text={{!!postamble}}/></$list>",
    // ETX (&#x0003;) closes the body; EOT (&#x0004;) closes transmission.
    "<$list filter=\"[<currentTiddler>has[fragment-parent]]\" variable=\"_\"><$text text=\"\n<<~&#x0003;>>\n<<~&#x0004; -> ? >>\n\"/></$list>",
  ].join(""),
} as const;
