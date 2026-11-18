/**
 * tree-sitter-lar-sigil — a thin tree-sitter grammar for the house's OWN
 * `<<~ …>>` sharktooth / ahu-block / sigil-row forms (memetic-wikitext's
 * CODE-mode), so a meme parses into a REAL sigil AST rather than the generic
 * wikitext grammar.
 *
 * THE READ-SIDE TWIN. The WRITE side lives in the TW5 wikirules
 * (packages/lararium-tw5/src/wikirules/lar-sigil*.ts) — block + inline rules that
 * CLAIM these forms while authoring. This grammar RE-PARSES the same surface for
 * the structure plane; its node TYPES match the runnable twin
 * `structure_router.parse_sigils` (Python), so the two agree on the AST:
 *
 *   source_file · doctype · pranala_header · pranala · ahu_block ·
 *   sharktooth_sigil(→ sigil_name, attr*) · text
 *
 * Every value of a call rides NAMED and TICKED (the kupono grammar): `attr` is `name=` plus a
 * `tick_value` (a backtick span; a value holding a backtick takes the triple form). The bearing pair
 * rides as `from=` and `to=` attrs in either order, and no arrow joins two values.
 *
 * Build (when a tree-sitter CLI + cc are present — NOT required for the structure
 * plane, which uses the Python twin):
 *   cd grammars/tree-sitter-lar-sigil && tree-sitter generate && tree-sitter test
 *
 * Grammar form-spec referenced from lar-sigil-shared.ts:
 *   - COMPOUND_OPEN_RE   <<~ WORD [child-slot WORD2] name=`value`*>>
 *   - PRANALA_OPEN_RE    <<~ pranala [slot=`#s`] from=`A` to=`B` [family=`f`] [role=`r`]>>
 *   - PRANALA_HEADER_RE  <<~ ? to=`uri`>>
 *   - BLOCK_CLOSERS      ahu · pranala · kahea  (closed by <<~/word>>)
 */

const SIGIL_WORD = /\\?[A-Za-z?][A-Za-z0-9_-]*/;

module.exports = grammar({
  name: "lar_sigil",

  extras: ($) => [/\s/],

  // `<<~ pranala …>>` MAY stand alone or open a block closed by `<<~/pranala>>`; the parser forks at the
  // first `>>` and keeps the reading the input proves.
  conflicts: ($) => [[$.pranala]],

  rules: {
    // A meme is a run of sigil forms, ahu blocks, and prose text.
    source_file: ($) => repeat($._item),

    _item: ($) =>
      choice(
        $.doctype,
        $.ahu_block,
        $.pranala_header,
        $.pranala,
        $.sharktooth_sigil,
        $.text,
      ),

    // <<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///…`>>  (the meme's opening declaration)
    doctype: ($) =>
      seq("<<!", field("sigil_name", alias("DOCTYPE", $.sigil_name)), repeat($.attr), ">>"),

    // <<~ ? to=`lar:///…`>>  (the carrier→canonical edge; ? is a special self-token, the from end)
    pranala_header: ($) => seq("<<~", field("sigil_name", alias("?", $.sigil_name)), repeat1($.attr), ">>"),

    // <<~ pranala [slot=`#s`] from=`A` to=`B` [family=`f`] [role=`r`]>>  (+ optional block body … <<~/pranala>>)
    // from= and to= ride as attrs in either order; no arrow joins them.
    pranala: ($) =>
      seq(
        "<<~",
        field("sigil_name", alias("pranala", $.sigil_name)),
        repeat1($.attr),
        ">>",
        optional(seq(repeat($._item), $._pranala_close)),
      ),
    _pranala_close: ($) => seq("<<~/", "pranala", ">>"),

    // <<~ ahu slot=`#/slot`>> … <<~/ahu>>  — the container that NESTS inner sigils.
    ahu_block: ($) =>
      seq(
        "<<~",
        field("sigil_name", alias("ahu", $.sigil_name)),
        repeat($.attr),
        ">>",
        repeat($._item),
        seq("<<~/", "ahu", ">>"),
      ),

    // <<~ WORD name=`value` …>>  — the general sharktooth leaf (set · oracle · node · ward · confidence
    // · syad · mu · persona · loops · …). Every value rides as a counted `attr`.
    sharktooth_sigil: ($) =>
      seq(
        "<<~",
        field("sigil_name", alias(SIGIL_WORD, $.sigil_name)),
        repeat($.attr),
        ">>",
      ),

    // name=`value` — a named, ticked value. Cut 3: no bare positional value stands in a call.
    attr: ($) => seq(field("name", $.attr_name), "=", field("value", $.tick_value)),

    attr_name: ($) => /[\w.-]+/,

    // a backtick span; a value that holds a backtick takes the triple form (three ticks each side)
    tick_value: ($) => /```([^`]|`[^`]|``[^`])*```|`[^`]*`/,

    sigil_name: ($) => SIGIL_WORD,

    // prose / non-sigil text between forms
    text: ($) => prec(-1, /[^<\s][^<]*|</),
  },
});
