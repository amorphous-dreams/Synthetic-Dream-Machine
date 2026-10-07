/**
 * External scanner — the two counts a regex token cannot carry across lines.
 *
 * FENCE LENGTH. A ``` fence closes only on a backtick run at least as long
 * as its opener's run (CommonMark's rule; `fence-mask` in lararium-tw5's TS
 * layer keeps it reading the corpus, and this scanner holds the grammar's own
 * `fenced_block` to the same law). A shorter run inside the body is content,
 * never a close; every other line rides FENCE_LINE whole.
 *
 * SIGIL PAIRING, BY NAME, AS FORM. Every speaking tooth `<<~` comes from
 * here, and the scanner reads the whole sigil before it hands one out:
 * `_pair_open` to an opener `<<~ name …>>` whose own closing form
 * `<<~/name …>>` follows; `_pair_close` to a closing form naming the
 * innermost open pair; `_sigil_open` to every other sigil, a lone opener or a
 * lone closer alike. A line whose teeth never close gets no tooth, and reads
 * as text. The name is the first word between the teeth, compared as
 * codepoints — the way an HTML tag stack pairs `<x>` with `</x>` without
 * knowing any tag — so this scanner never reads vocabulary.
 *
 * "Follows" reads the text the way the parser will tokenize it: only sigils
 * at a block position count (a line start, or straight after another sigil's
 * `>>`), and every block form that holds its lines raw — ``` fences, `<<<`
 * quotes, `@@` style, `$$$` typed, `"""` hard-break, `<!-- -->` comments —
 * masks what it holds. Pairing is nested: an inner opener that itself pairs
 * swallows everything to its own close, and a close naming any other pair
 * is a lone sigil. So the lookahead answers exactly the question the parser
 * will ask, and a `_pair_open` the scanner hands out always meets its close.
 *
 * Every other block form stays on plain regex tokens.
 */

#include <stdlib.h>
#include <string.h>
#include <tree_sitter/parser.h>

enum TokenType {
  FENCE_OPEN,
  FENCE_LINE,
  FENCE_CLOSE,
  SIGIL_OPEN,
  PAIR_OPEN,
  PAIR_CLOSE,
  ERROR_SENTINEL,
};

// A name the pair stack holds, as codepoints. A name longer than this, or a
// stack that would outgrow the serialization buffer, does not pair: the
// opener reads as a lone sigil rather than as a pair the state cannot keep.
#define NAME_CAP 64
#define STACK_CAP 16

typedef struct {
  int32_t chars[NAME_CAP];
  uint8_t len;
} Name;

typedef struct {
  uint8_t kind;  // 0 open · 1 close
  uint32_t off;  // into the lookahead's name pool
  uint32_t len;
} Event;

typedef struct {
  uint32_t fence_length;  // 0 = not inside a fence
  uint8_t depth;
  Name stack[STACK_CAP];
  // lookahead scratch — never serialized
  Event *ev;
  uint32_t ev_len, ev_cap;
  int32_t *pool;
  uint32_t pool_len, pool_cap;
  int32_t *match;
  uint32_t match_cap;
} Scanner;

void *tree_sitter_memetic_wikitext_external_scanner_create(void) {
  return calloc(1, sizeof(Scanner));
}

void tree_sitter_memetic_wikitext_external_scanner_destroy(void *payload) {
  Scanner *s = (Scanner *)payload;
  free(s->ev);
  free(s->pool);
  free(s->match);
  free(s);
}

unsigned tree_sitter_memetic_wikitext_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *s = (Scanner *)payload;
  unsigned n = 0;
  memcpy(buffer + n, &s->fence_length, sizeof(s->fence_length));
  n += sizeof(s->fence_length);
  buffer[n++] = (char)s->depth;
  for (uint8_t i = 0; i < s->depth; i++) {
    buffer[n++] = (char)s->stack[i].len;
    memcpy(buffer + n, s->stack[i].chars, s->stack[i].len * sizeof(int32_t));
    n += s->stack[i].len * sizeof(int32_t);
  }
  return n;
}

void tree_sitter_memetic_wikitext_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *s = (Scanner *)payload;
  s->fence_length = 0;
  s->depth = 0;
  unsigned n = 0;
  if (length < sizeof(s->fence_length) + 1) return;
  memcpy(&s->fence_length, buffer, sizeof(s->fence_length));
  n += sizeof(s->fence_length);
  uint8_t depth = (uint8_t)buffer[n++];
  for (uint8_t i = 0; i < depth && i < STACK_CAP && n < length; i++) {
    uint8_t len = (uint8_t)buffer[n++];
    if (len > NAME_CAP || n + len * sizeof(int32_t) > length) break;
    s->stack[i].len = len;
    memcpy(s->stack[i].chars, buffer + n, len * sizeof(int32_t));
    n += len * sizeof(int32_t);
    s->depth = i + 1;
  }
}

static void advance(TSLexer *lexer) {
  lexer->advance(lexer, false);
}

static bool at_eol(TSLexer *lexer) {
  return lexer->eof(lexer) || lexer->lookahead == '\n';
}

static bool is_ws(int32_t c) {
  return c == ' ' || c == '\t';
}

/** The rest of the line, its newline included. */
static void skip_line(TSLexer *lexer) {
  while (!at_eol(lexer)) advance(lexer);
  if (!lexer->eof(lexer)) advance(lexer);
}

/** Bytes of the serialized state with one more name of `len` on the stack. */
static unsigned state_size_with(Scanner *s, uint32_t len) {
  unsigned n = sizeof(s->fence_length) + 1;
  for (uint8_t i = 0; i < s->depth; i++) n += 1 + s->stack[i].len * sizeof(int32_t);
  return n + 1 + len * sizeof(int32_t);
}

/** A sigil's name: the first word between the teeth, up to whitespace, `>`, or the line's end. */
static uint32_t read_name(TSLexer *lexer, Scanner *s) {
  uint32_t start = s->pool_len;
  while (!at_eol(lexer) && !is_ws(lexer->lookahead) && lexer->lookahead != '>') {
    if (s->pool_len == s->pool_cap) {
      s->pool_cap = s->pool_cap ? s->pool_cap * 2 : 256;
      s->pool = realloc(s->pool, s->pool_cap * sizeof(int32_t));
    }
    s->pool[s->pool_len++] = lexer->lookahead;
    advance(lexer);
  }
  return s->pool_len - start;
}

/**
 * The rest of a sigil, to its `>>`, on one line — the `sigil_body` token's own
 * law (`([^>\n]|>[^>\n])+` then `>>`). False when the line ends first.
 */
static bool finish_sigil(TSLexer *lexer) {
  for (;;) {
    if (at_eol(lexer)) return false;
    if (lexer->lookahead == '>') {
      advance(lexer);
      if (lexer->lookahead == '>') {
        advance(lexer);
        return true;
      }
      if (at_eol(lexer)) return false;
    }
    advance(lexer);
  }
}

static void push_event(Scanner *s, uint8_t kind, uint32_t off, uint32_t len) {
  if (s->ev_len == s->ev_cap) {
    s->ev_cap = s->ev_cap ? s->ev_cap * 2 : 64;
    s->ev = realloc(s->ev, s->ev_cap * sizeof(Event));
  }
  s->ev[s->ev_len++] = (Event){kind, off, len};
}

/** A line whose first characters are `ch` × 3, then the line skipped. */
static bool line_opens_with_three(TSLexer *lexer, int32_t ch) {
  int run = 0;
  while (run < 3 && lexer->lookahead == ch) {
    advance(lexer);
    run++;
  }
  return run == 3;
}

/** Skip lines until one opens with `ch` × 3 (that line consumed too), or the text ends. */
static void skip_to_triple_close(TSLexer *lexer, int32_t ch) {
  while (!lexer->eof(lexer)) {
    bool closes = line_opens_with_three(lexer, ch);
    skip_line(lexer);
    if (closes) return;
  }
}

/**
 * Walk from a block position to the end of the text, recording every sigil
 * open and close the parser will meet at a block position, and masking the
 * interior of every block form that holds its lines raw.
 */
static void collect_events(TSLexer *lexer, Scanner *s) {
  while (!lexer->eof(lexer)) {
    int32_t c = lexer->lookahead;
    if (c == '<') {
      advance(lexer);
      if (lexer->lookahead == '<') {
        advance(lexer);
        if (lexer->lookahead == '~') {
          advance(lexer);
          while (is_ws(lexer->lookahead)) advance(lexer);
          uint8_t kind = 0;
          if (lexer->lookahead == '/') {
            kind = 1;
            advance(lexer);
            while (is_ws(lexer->lookahead)) advance(lexer);
          }
          uint32_t off = s->pool_len;
          uint32_t len = read_name(lexer, s);
          if (finish_sigil(lexer)) {
            if (len > 0) push_event(s, kind, off, len);
            continue;  // a block position again, straight after `>>`
          }
          skip_line(lexer);
          continue;
        }
        if (lexer->lookahead == '^') {
          advance(lexer);
          if (finish_sigil(lexer)) continue;
          skip_line(lexer);
          continue;
        }
        if (lexer->lookahead == '<') {
          // `<<<` quote: raw to the next line opening `<<<`
          skip_line(lexer);
          skip_to_triple_close(lexer, '<');
          continue;
        }
        skip_line(lexer);
        continue;
      }
      if (lexer->lookahead == '!') {
        advance(lexer);
        if (lexer->lookahead == '-') {
          advance(lexer);
          if (lexer->lookahead == '-') {
            advance(lexer);
            // `<!-- … -->`: raw to the first `-->`
            int dashes = 0;
            while (!lexer->eof(lexer)) {
              int32_t d = lexer->lookahead;
              advance(lexer);
              if (d == '>' && dashes >= 2) break;
              dashes = d == '-' ? dashes + 1 : 0;
            }
            if (lexer->lookahead == '\n') advance(lexer);
            continue;
          }
        }
      }
      skip_line(lexer);
      continue;
    }
    if (c == '`') {
      uint32_t run = 0;
      while (lexer->lookahead == '`') {
        run++;
        advance(lexer);
      }
      skip_line(lexer);
      if (run < 3) continue;
      // a ``` fence: raw to a run at least as long, alone on its line
      while (!lexer->eof(lexer)) {
        uint32_t r = 0;
        while (lexer->lookahead == '`') {
          r++;
          advance(lexer);
        }
        if (r >= 3 && r >= run) {
          while (is_ws(lexer->lookahead)) advance(lexer);
          if (at_eol(lexer)) {
            if (!lexer->eof(lexer)) advance(lexer);
            break;
          }
        }
        skip_line(lexer);
      }
      continue;
    }
    if (c == '@') {
      // `@@` style: opens on a line carrying no second `@`
      advance(lexer);
      if (lexer->lookahead != '@') { skip_line(lexer); continue; }
      advance(lexer);
      bool another = false;
      while (!at_eol(lexer)) {
        if (lexer->lookahead == '@') another = true;
        advance(lexer);
      }
      if (lexer->eof(lexer)) continue;
      advance(lexer);
      if (another) continue;
      while (!lexer->eof(lexer)) {
        bool at = lexer->lookahead == '@';
        if (at) advance(lexer);
        bool closes = at && lexer->lookahead == '@';
        if (closes) {
          advance(lexer);
          while (is_ws(lexer->lookahead)) advance(lexer);
          closes = at_eol(lexer);
        }
        skip_line(lexer);
        if (closes) break;
      }
      continue;
    }
    if (c == '$') {
      // `$$$` typed: raw to the next line opening `$$$`
      bool opens = line_opens_with_three(lexer, '$');
      bool newline = false;
      while (!at_eol(lexer)) advance(lexer);
      if (!lexer->eof(lexer)) { advance(lexer); newline = true; }
      if (opens && newline) skip_to_triple_close(lexer, '$');
      continue;
    }
    if (c == '"') {
      // `"""` hard-break: opens on a line carrying nothing else
      bool opens = line_opens_with_three(lexer, '"');
      while (is_ws(lexer->lookahead)) advance(lexer);
      opens = opens && lexer->lookahead == '\n';
      skip_line(lexer);
      if (opens) skip_to_triple_close(lexer, '"');
      continue;
    }
    skip_line(lexer);
  }
}

static bool name_eq(Scanner *s, const Event *a, const Event *b) {
  return a->len == b->len && memcmp(s->pool + a->off, s->pool + b->off, a->len * sizeof(int32_t)) == 0;
}

/**
 * Does the opener named by `target` (an event outside the list, at its head)
 * meet its own close? Every opener after it is answered first, right to left:
 * an opener that pairs swallows its span whole, and the first close at this
 * level that carries the opener's name closes it.
 */
static bool target_pairs(Scanner *s, const Event *target) {
  if (s->match_cap < s->ev_len) {
    s->match_cap = s->ev_len;
    s->match = realloc(s->match, s->match_cap * sizeof(int32_t));
  }
  for (int64_t k = (int64_t)s->ev_len - 1; k >= -1; k--) {
    const Event *open = k < 0 ? target : &s->ev[k];
    if (k >= 0 && open->kind != 0) continue;
    int32_t m = -1;
    uint32_t j = (uint32_t)(k + 1);
    while (j < s->ev_len) {
      const Event *e = &s->ev[j];
      if (e->kind == 0) {
        j = s->match[j] >= 0 ? (uint32_t)s->match[j] + 1 : j + 1;
        continue;
      }
      if (name_eq(s, e, open)) {
        m = (int32_t)j;
        break;
      }
      j++;
    }
    if (k < 0) return m >= 0;
    s->match[k] = m;
  }
  return false;
}

static bool scan_fence(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[FENCE_OPEN] && lexer->lookahead == '`') {
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

/** The tooth `<<~` at the lexer, read with the whole sigil it opens, then answered. */
static bool scan_tooth(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
  advance(lexer);
  if (lexer->lookahead != '<') return false;
  advance(lexer);
  if (lexer->lookahead != '~') return false;
  advance(lexer);
  lexer->mark_end(lexer);  // every tooth is the three characters `<<~`; the rest reads ahead
  while (is_ws(lexer->lookahead)) advance(lexer);

  s->pool_len = 0;
  s->ev_len = 0;

  if (lexer->lookahead == '/') {
    advance(lexer);
    while (is_ws(lexer->lookahead)) advance(lexer);
    uint32_t len = read_name(lexer, s);
    if (!finish_sigil(lexer)) return false;
    if (valid_symbols[PAIR_CLOSE] && s->depth > 0 && len > 0) {
      Name *top = &s->stack[s->depth - 1];
      if (top->len == len && memcmp(top->chars, s->pool, len * sizeof(int32_t)) == 0) {
        s->depth--;
        lexer->result_symbol = PAIR_CLOSE;
        return true;
      }
    }
    if (!valid_symbols[SIGIL_OPEN]) return false;
    lexer->result_symbol = SIGIL_OPEN;
    return true;
  }

  uint32_t len = read_name(lexer, s);
  if (!finish_sigil(lexer)) return false;
  bool fits = len > 0 && len <= NAME_CAP && s->depth < STACK_CAP
    && state_size_with(s, len) <= TREE_SITTER_SERIALIZATION_BUFFER_SIZE;
  if (valid_symbols[PAIR_OPEN] && fits) {
    Event target = {0, 0, len};
    collect_events(lexer, s);
    if (target_pairs(s, &target)) {
      Name *slot = &s->stack[s->depth++];
      slot->len = (uint8_t)len;
      memcpy(slot->chars, s->pool, len * sizeof(int32_t));
      lexer->result_symbol = PAIR_OPEN;
      return true;
    }
  }
  if (!valid_symbols[SIGIL_OPEN]) return false;
  lexer->result_symbol = SIGIL_OPEN;
  return true;
}

bool tree_sitter_memetic_wikitext_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;

  // Error recovery marks every external valid at once; the scanner stands aside.
  if (valid_symbols[ERROR_SENTINEL]) return false;

  if ((valid_symbols[SIGIL_OPEN] || valid_symbols[PAIR_OPEN] || valid_symbols[PAIR_CLOSE])
      && lexer->lookahead == '<') {
    return scan_tooth(scanner, lexer, valid_symbols);
  }

  return scan_fence(scanner, lexer, valid_symbols);
}
