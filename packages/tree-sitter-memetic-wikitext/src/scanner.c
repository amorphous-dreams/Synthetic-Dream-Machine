/**
 * External scanner — fence-length counting for ``` fenced blocks.
 *
 * INVARIANT: a fence closes only on a backtick run at least as long as its
 * opener's run (CommonMark's rule; `fence-mask` in lararium-tw5's TS layer
 * already keeps it reading the corpus — this scanner brings the grammar's
 * own `fenced_block` into agreement with that mask). A shorter run inside
 * the body is content, never a close; every other line rides FENCE_LINE
 * whole, including any backtick run too short to close.
 *
 * Every other block form (quote/style/typed/hard-break fences) stays on
 * plain regex tokens — none of them are length-counted, so none needs the
 * scanner.
 */

#include <stdlib.h>
#include <string.h>
#include <tree_sitter/parser.h>

enum TokenType {
  FENCE_OPEN,
  FENCE_LINE,
  FENCE_CLOSE,
};

typedef struct {
  uint32_t fence_length;  // 0 = not inside a fence
} Scanner;

void *tree_sitter_memetic_wikitext_external_scanner_create(void) {
  return calloc(1, sizeof(Scanner));
}

void tree_sitter_memetic_wikitext_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_memetic_wikitext_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  memcpy(buffer, &scanner->fence_length, sizeof(scanner->fence_length));
  return sizeof(scanner->fence_length);
}

void tree_sitter_memetic_wikitext_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  scanner->fence_length = 0;
  if (length >= sizeof(scanner->fence_length)) {
    memcpy(&scanner->fence_length, buffer, sizeof(scanner->fence_length));
  }
}

static void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
}

static bool at_eol(TSLexer *lexer) {
  return lexer->eof(lexer) || lexer->lookahead == '\n';
}

bool tree_sitter_memetic_wikitext_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  if (valid_symbols[FENCE_OPEN]) {
    uint32_t run = 0;
    while (lexer->lookahead == '`') {
      run++;
      advance(lexer);
    }
    if (run < 3) return false;
    // consume the rest of the info-string line
    while (!at_eol(lexer)) advance(lexer);
    if (lexer->lookahead == '\n') advance(lexer);
    scanner->fence_length = run;
    lexer->result_symbol = FENCE_OPEN;
    return true;
  }

  if (valid_symbols[FENCE_CLOSE] || valid_symbols[FENCE_LINE]) {
    // INVARIANT: every token this scanner emits advances at least one
    // character, or it returns false — a zero-width true spins `repeat()`
    // forever (an unclosed fence running off the end of the text has
    // nothing left to consume: refuse, so the grammar's own MISSING-node
    // recovery reports it instead of an unbounded parse).
    if (lexer->eof(lexer)) return false;
    uint32_t run = 0;
    while (lexer->lookahead == '`') {
      run++;
      advance(lexer);
    }
    // a candidate close: nothing but the backtick run (plus trailing
    // spaces/tabs) on the line, and the run at least as long as the opener
    bool run_closes = run >= 3 && run >= scanner->fence_length;
    if (run_closes) {
      while (lexer->lookahead == ' ' || lexer->lookahead == '\t') advance(lexer);
      if (at_eol(lexer) && valid_symbols[FENCE_CLOSE]) {
        if (lexer->lookahead == '\n') advance(lexer);
        scanner->fence_length = 0;
        lexer->result_symbol = FENCE_CLOSE;
        return true;
      }
    }
    // not a close: the whole line (backticks already consumed included)
    // rides as content, held text law — the fence-mask reads it the same way.
    if (!valid_symbols[FENCE_LINE]) return false;
    while (!at_eol(lexer)) advance(lexer);
    if (lexer->lookahead == '\n') advance(lexer);
    lexer->result_symbol = FENCE_LINE;
    return true;
  }

  return false;
}
