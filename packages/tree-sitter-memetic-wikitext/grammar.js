/**
 * tree-sitter-memetic-wikitext — the CARRIER layer only.
 *
 * The grammar parses the sharktooth FORM generically (a sigil node with
 * name-span and args-span, whatever the name) the way HTML's grammar parses
 * <element> without knowing any tag. The sigil VOCABULARY — which names
 * exist, their arg shapes, their semantics — lives as DATA in the wiki's own
 * shadow tiddlers (the live registry), attached downstream at the fold.
 * An unregistered sigil parses cleanly here and surfaces as a vocabulary
 * diagnostic, never a parse error. A paired block opens only on a sigil whose
 * own closing form `<<~/name>>` follows under the fence mask, and closes only
 * on that name — a FORM check, the way an HTML tag stack pairs `<x>` with
 * `</x>` without knowing any tag. An opener nothing closes reads as a lone
 * sigil; a closer nothing opened reads as a lone sigil too.
 *
 * The TW5 rich forms ride the same carrier discipline, line/block-grained:
 * transclusions, macrocall lines, tables, pragmas (paired with `\end` by
 * form, like ahu), quote/style/typed fences, rules, html lines, and the
 * `.tid` field block (valid only at document top — the grammar position
 * carries that law, no lookahead). Inline forms (emphasis, links, inline
 * transclusion, CamelCase) stay BELOW the carrier: they ride the fold and
 * editor layers over `text_line` spans.
 */
module.exports = grammar({
  name: 'memetic_wikitext',

  extras: _ => [],

  // Two context-sensitive counts ride the external scanner (src/scanner.c),
  // because no regex token carries state across lines:
  //   - fence length: a ``` close must match a run AT LEAST as long as its
  //     opener's (the CommonMark rule `fence-mask` keeps in the TS mask);
  //   - sigil pairing: every speaking tooth `<<~` comes from the scanner,
  //     which reads the whole sigil before it answers. `_pair_open` opens a
  //     sigil whose own `<<~/name>>` follows; `_pair_close` opens a closing
  //     form naming the innermost open pair; `_sigil_open` opens every other
  //     sigil, a lone opener or a lone closer alike. The scanner reads the
  //     name as FORM — the first word between the teeth — never as
  //     vocabulary. A line whose teeth never close emits no tooth at all, so
  //     it reads as the `text_line` it is rather than as a broken sigil.
  // `_error_sentinel` is never emitted: it is valid only during error
  // recovery, where the scanner stands aside.
  externals: $ => [
    $._fence_open_tok, $._fence_line_tok, $._fence_close_tok,
    $._sigil_open, $._pair_open, $._pair_close,
    $._error_sentinel,
  ],

  conflicts: $ => [
    // a block-form pragma stands alone when no `\end` ever arrives
    [$._block, $.pragma_block],
  ],

  rules: {
    // `.tid` field lines bind only at the document top (before any block) —
    // the parse position enforces what TW5 enforces by its first blank line.
    document: $ => seq(repeat($.field_line), repeat($._block)),

    _block: $ => choice(
      $.ahu_block,
      $.sigil,
      $.control_sigil,
      $.fenced_block,
      $.quote_block,
      $.style_block,
      $.typed_block,
      $.hard_break_block,
      $.pragma_block,
      $.pragma_open,
      $.pragma_end,
      $.pragma_line,
      $.heading,
      $.list_item,
      $.table,
      $.transclude_block,
      $.filtered_transclude_block,
      $.macrocall_block,
      $.horizontal_rule,
      $.html_line,
      $.comment,
      $.blank_line,
      $.text_line,
    ),

    // A paired span: an opening sigil whose body runs to the closing form
    // `<<~/name>>` of the SAME name. The scanner admits the pair only when
    // that close follows, so an opener nothing closes stays a lone `sigil`
    // and a close naming another pair stays a lone `sigil` inside the body.
    ahu_block: $ => seq(
      field('open', alias($._paired_sigil, $.sigil)),
      repeat($._block),
      field('close', $.sigil_close),
    ),

    // The opener of a pair: a `sigil` in the tree, told apart only by the
    // tooth the scanner handed it.
    _paired_sigil: $ => seq(
      alias($._pair_open, '<<~'),
      optional(field('body', $.sigil_body)),
      '>>',
    ),

    // `<<~ name args…>>` — the SPEAKING set, any vocabulary.
    sigil: $ => seq(
      alias($._sigil_open, '<<~'),
      optional(field('body', $.sigil_body)),
      '>>',
    ),

    // `<<^ &#x0001; …>>` — the CONTROL set, framing the transmission rather than
    // speaking inside it. The caret is the received notation for exactly these
    // characters (`^A`=SOH, `^B`=STX, `^C`=ETX, `^D`=EOT), so the mark is adopted,
    // never minted. Structurally identical to a sigil; separated so a reader can
    // tell the envelope from the letter without inspecting the body.
    control_sigil: $ => seq(
      '<<^',
      optional(field('body', $.sigil_body)),
      '>>',
    ),

    // `<<~/name>>` — the closing form.
    sigil_close: $ => seq(
      // The tooth stands at ONE dispatch position: `<<~`, then LWSP, then the command
      // word — and a close word carries its own slash. Both spellings reach the same
      // word, matching the plain register's `<<fragment …>>` / `<</fragment>>`.
      // The scanner hands the tooth only to a close naming the innermost open pair;
      // the slash follows as its own token, and whatever follows it belongs to the body.
      alias($._pair_close, '<<~'),
      alias(token(/[ \t]*\//), '/'),
      optional(field('body', $.sigil_body)),
      '>>',
    ),

    // Everything between the teeth, single token, on one line: no `>>`
    // inside, and a lone `>` never carries the body across a newline.
    sigil_body: _ => token(prec(1, /([^>\n]|>[^>\n])+/)),

    // ``` fenced blocks — the info string, then lines that never close the
    // fence, then a close whose backtick run is AT LEAST as long as the
    // opener's (CommonMark; `fence-mask` in lararium-tw5 already keeps this
    // law reading the corpus). The external scanner counts the run.
    fenced_block: $ => seq(
      field('info', alias($._fence_open_tok, $.fence_open)),
      repeat(field('line', alias($._fence_line_tok, $.fence_line))),
      alias($._fence_close_tok, $.fence_close),
    ),

    // `<<<` quote fences — raw interior (a quoted voice, held verbatim);
    // classes ride the open line, attribution rides the close line.
    quote_block: $ => seq(
      field('info', alias(token(/<<<[^\n]*\r?\n/), $.quote_open)),
      repeat(alias(token(/(<{0,2}([^<\n][^\n]*)?)?\r?\n/), $.quote_line)),
      alias(token(/<<<[^\n]*\r?\n?/), $.quote_close),
    ),

    // `@@` style fences — the open line carries css/classes and no second
    // `@@` (an inline-styled paragraph keeps its `@@…@@` on one line and
    // stays prose).
    style_block: $ => seq(
      field('info', alias(token(/@@[^@\n]*\r?\n/), $.style_open)),
      repeat(alias(token(/(@?[^@\n][^\n]*|@)?\r?\n/), $.style_line)),
      alias(token(/@@[ \t]*\r?\n?/), $.style_close),
    ),

    // `$$$type` typed fences — the interior is typed content, raw by law.
    typed_block: $ => seq(
      field('info', alias(token(/\$\$\$[^\n]*\r?\n/), $.typed_open)),
      repeat(alias(token(/(\${0,2}([^$\n][^\n]*)?)?\r?\n/), $.typed_line)),
      alias(token(/\$\$\$[ \t]*\r?\n?/), $.typed_close),
    ),

    // `"""` hard-line-break fences — prose whose newlines render literally.
    hard_break_block: $ => seq(
      alias(token(/"""[ \t]*\r?\n/), $.hard_break_open),
      repeat(alias(token(/("{0,2}([^"\n][^\n]*)?)?\r?\n/), $.hard_break_line)),
      alias(token(/"""[ \t]*\r?\n?/), $.hard_break_close),
    ),

    // Definition-family pragmas pair with `\end` by FORM, `\end` naming no pragma:
    // the block form opens only when the line ends at its parameter list —
    // a one-line definition carries its body on the same line and rides
    // `pragma_line` whole.
    pragma_block: $ => prec.right(seq(
      field('open', $.pragma_open),
      repeat($._block),
      field('close', $.pragma_end),
    )),

    pragma_open: _ => token(prec(2, /\\(define|procedure|function|widget)[ \t]+[^(\r\n]+\([^)\r\n]*\)[ \t]*\r?\n/)),

    pragma_end: _ => token(prec(2, /\\end[^\n]*\r?\n?/)),

    // Every other `\word …` line: one-line definitions, `\rules`, `\import`,
    // `\parameters`, `\whitespace`, and whatever the vocabulary grows.
    pragma_line: _ => token(/\\[a-zA-Z][^\n]*\r?\n?/),

    // TW5 `!` headings.
    heading: _ => token(/!{1,6}[ \t][^\n]*\n?/),

    // TW5 list line (`*` unordered · `#` ordered · `;`/`:` definition ·
    // `>` quote-list, mixable) — STRICTER than core TW5: the marker run
    // must carry a following space, so a line opening `**bold**` stays prose.
    list_item: _ => token(/[*#;:>]+[ \t][^\n]*\n?/),

    // A run of `|…|` rows composes one table.
    table: $ => prec.right(repeat1($.table_row)),

    table_row: _ => token(/\|[^\n]*\|[kfch]?[ \t]*\r?\n?/),

    // `{{{filter}}}` and `{{reference}}` alone on a line — block transclusion.
    filtered_transclude_block: _ => token(prec(2, /\{\{\{[^\n]*\}\}\}[^\n]*\r?\n?/)),

    transclude_block: _ => token(/\{\{[^\n]*\}\}[ \t]*\r?\n?/),

    // `<<name args…>>` alone on a line — a macrocall. THE THIRD CHARACTER STILL
    // DECIDES, now four ways: `<<~` speaking sigil · `<<^` control sigil ·
    // `<<<` quote fence · anything else, a macrocall. One character, no lookahead,
    // no precedence rule — which is why the control set took a mark rather than an
    // entity: `<<&#x0001;` would have landed inside this token and parsed as a call.
    macrocall_block: _ => token(/<<[^<~^\s][^\n]*>>[ \t]*\r?\n?/),

    horizontal_rule: _ => token(/-{3,}[ \t]*\r?\n?/),

    // A line opening an HTML element or widget (`<div`, `<$link`, `</div>`).
    html_line: _ => token(/<[a-zA-Z$\/][^\n]*\r?\n?/),

    // A `.tid` header field — reachable only at the document top.
    field_line: _ => token(/[a-zA-Z][\w.\-]*:[^\n]*\r?\n/),

    comment: _ => token(/<!--([^-]|-[^-]|--[^>])*-->\n?/),

    blank_line: _ => token(/[ \t]*\n/),

    // Any other line — wikitext, prose, whatever rides beneath the carrier.
    text_line: _ => token(prec(-1, /[^\n]+\n?/)),
  },
});
