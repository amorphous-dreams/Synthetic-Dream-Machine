/**
 * meme-normalize — canonicalize a meme carrier's framing for round-trip stability.
 *
 * The doctrine: corpus files stay "non-canonical at rest until a deliberate
 * normalization commit" (wiki-layer-ontology; the meme-corpus-roundtrip laws).
 * A freshly-authored or lifted carrier MAY drift from canonical form; this
 * gesture homes it back so the lens laws (single-closer · content-whole ·
 * idempotent) hold — rather than loosening the gate that guards the graph.
 *
 * Classes closed here (the ones a hand-authored or lifted carrier most often trips):
 *   1. **SOH opener.** The opener canonicalizes to `<<^ code="&#x0001;" namespace="[namespace-glyphs]" `
 *      — one space after `<<^`, then the meta-declared namespace as LITERAL glyphs
 *      (or none), then the SOH char. Two drifts trip it: a missing/stale namespace
 *      (the renderer re-injects → round-trip breaks), and a missing space
 *      (`<<^ code="&#x0001;" `, the lifted-corpus form — 10 stragglers against 102 canonical
 *      siblings). The meta field is authoritative; the SOH is derived from it.
 *   2. **Sigil close spacing.** A close carrying whitespace before `>>` tightens.
 *      The reader takes both spellings; the writer emits one.
 *   3. **Child-slot roots.** A slot opens at `#/name`, nested slots carrying the
 *      whole path. Control slots take no root — they open no addressable child.
 *
 * Pure + idempotent (re-running changes nothing). The SOH grammar mirrors the deserializer's own
 * param-aware SOH scan (`deserializer.ts`).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/meme-normalize
 */

// THE FRAME IS ITS OWN PACKAGE, zero workspace dependencies — so this module stays bundleable into the
// TW5 plugin (an import from the mesh would drag its automerge wasm into a bundle that cannot carry it).
// The declaration a carrier opens with is the frame writer's own constant, never a second spelling.
import {
  CARRIER_DECLARATION as DECLARATION, fencedSpans, inMask, META_OPEN_RE, frameAlt, readFrame,
} from "@lararium/memetic-frame";
// GENERATED_SIGILS is pure data (SigilRule[] literals, no runtime deps) — safe in this
// dependency-free-by-constraint file the same way the frame import above reasons about it.
import { GENERATED_SIGILS } from "./meme-ast/grammar-table.generated.js";

// THE CODE SET COMES FROM THE DECLARATION; THESE SHAPES STAY THIS WRITER'S OWN (marks.ts).
// The alternation groups NON-capturing, so the group numbering each rewrite below indexes survives.
const SOH_ALT = frameAlt("SOH");
const EOT_ALT = frameAlt("EOT");

/**
 * The whole SOH opener, up to its closing `>>`, with the namespace param captured where one stands.
 *
 * The opener carries NAMED PARAMS, so canonicalizing it means rewriting the param list rather than
 * splicing glyphs in front of a control entity. Matching the whole head lets one rebuild place the
 * namespace correctly whether the carrier states one, states a stale one, or states none at all.
 */
const SOH_OPENER_RE = new RegExp(
  `(<<\\^)[ \\t]*(?:code="(${SOH_ALT})"(?:[ \\t]+namespace="([^"]*)")?|([^&\\n]*?)(${SOH_ALT}))`);

/** Decode `&#xNNNN;` entities to literal glyphs; non-entity chars pass through. */
function decodeEntities(s: string): string {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)));
}

/** The ROOT toml meta fence (between the ```toml meta fences), or null if absent.
 *  THREE GROUPS, and callers index them: [1] opener, [2] body, [3] closer. The opener comes from the
 *  one spelling; the closer is this reader's own and stays as it stands.
 *
 *  THE ROOT META RIDES THE BODY. Where a frame opens, the search starts at STX (the one span reader
 *  finds it); a carrier with no STX is all body and reads from the top. A carrier still in the
 *  pre-body shape — its meta above STX — is exactly what a REPAIR gesture meets, so where the body
 *  holds no meta the block above the frame answers instead. The match index stays absolute. */
function metaFence(src: string): RegExpExecResult | null {
  const re = new RegExp(`(${META_OPEN_RE.source})([\\s\\S]*?)(\\n\`\`\`)`, "g");
  re.lastIndex = readFrame(src).stx?.end ?? 0;
  const inBody = re.exec(src);
  if (inBody) return inBody;
  re.lastIndex = 0;
  return re.exec(src);
}
type RegExpExecResult = RegExpExecArray;

/** The meta `namespace` value (raw, possibly entity-encoded), or null if absent. */
function metaNamespace(src: string): string | null {
  const fence = metaFence(src);
  if (!fence) return null;
  const m = /^[ \t]*namespace[ \t]*=[ \t]*"([^"]*)"/m.exec(fence[2]!);
  return m ? m[1]! : null;
}

/**
 * The meta `tongue` value — the EXPLICIT MARK (RULED, operator): a carrier whose meta declares
 * `tongue = "<bcp47>"` (e.g. `tongue = "en"`) rests in its authored
 * mirror spellings; `fold MIRROR_FOLD`'s head below never touches a tongue-marked carrier. No
 * existing field already said this (measured: `git grep 'tongue ='` over bags/ found none) — report
 * the exact spelling (`tongue`, a bare BCP-47 tag) to the parent so canon can state it.
 */
function metaTongue(src: string): string | null {
  const fence = metaFence(src);
  if (!fence) return null;
  const m = /^[ \t]*tongue[ \t]*=[ \t]*"([^"]*)"/m.exec(fence[2]!);
  return m ? m[1]! : null;
}


/**
 * The command word a `<<` … `>>` opens with, definition registers named.
 *
 * TiddlyWiki's parameter-list syntax takes `:` and refuses `=`, so a definition keeps the colon it carries.
 * The registers are THE SHELF'S: every sigil kinded `pragma` or `pragma-alias` opens a definition — the
 * backslash pragmas, their unslashed English mirrors (`define` · `procedure` · `function` · `widget` ·
 * `typos` · `type` · the `let`/`var`/`const` binders) and the Hawaiian spellings (`wehe` · `kumu` · `helu`
 * · `waiho`). DERIVED from GENERATED_SIGILS (grammar-table.generated.ts) by `lar-kind`, never
 * hand-listed — a tiddler that gains/loses `pragma`/`pragma-alias` kind moves this set without a
 * second edit here.
 */
export const DEFINITION_WORDS = GENERATED_SIGILS
  .filter((s) => s.kind === "pragma" || s.kind === "pragma-alias")
  .map((s) => s.name)
  .sort();
const DEFINITION_HEAD = new RegExp(
  `^[~^!]?\\s*(\\\\[A-Za-z_]|(?:${DEFINITION_WORDS.join("|")})(?![\\w-]))`);

/**
 * Every READ-ONLY mirror — `lar-mirror-of` set, no `lar-weave: primary` — and the canonical head it
 * folds to (RULED, operator: normalize folds every read-only mirror's HEAD TOKEN to its canonical
 * house name; a `lar-weave: primary` mirror is a canonical spelling in its own tongue and never
 * folds). DERIVED from GENERATED_SIGILS, never hand-listed.
 */
const READ_ONLY_MIRRORS: ReadonlyArray<{ readonly name: string; readonly canonical: string }> =
  GENERATED_SIGILS
    .filter((s) => s.aliasFor && !s.weave)
    .map((s) => ({ name: s.name, canonical: s.aliasFor! }))
    .sort((a, b) => b.name.length - a.name.length); // longest-first: no mirror here prefixes another

const MIRROR_CANONICAL_OF = new Map(READ_ONLY_MIRRORS.map((m) => [m.name, m.canonical]));

/**
 * The HEAD TOKEN ALONE — split by each mirror's OWN declared prefix shape, never one loosened
 * alternation. `fragment` alone opens bare (`<<fragment` / `</fragment>>` — no `~`, a TW5-native
 * compatibility spelling); every other read-only mirror requires the sharktooth (`<<~ NAME`,
 * `<<~! NAME` pragma form, `<<~/NAME` close). A regex that made `~` universally optional would fold
 * a bare `<<link …>>` that matches NO declared pattern for `link` at all — not the sigil, just text
 * that resembles one — measured against the real corpus (ai-phrasebook.mem:14) before this split
 * landed. Group 1 (the prefix, untouched) and group 2 (the mirror word, the only text rewritten).
 */
function isBarePrefix(name: string, canonical: string): boolean {
  const rule = GENERATED_SIGILS.find((s) => s.name === name) ?? GENERATED_SIGILS.find((s) => s.name === canonical);
  const pat = rule?.openPattern ?? rule?.pattern ?? rule?.pragmaPattern ?? "";
  return pat.length > 0 && !pat.startsWith("<<~");
}
const BARE_MIRROR_NAMES = READ_ONLY_MIRRORS.filter((m) => isBarePrefix(m.name, m.canonical)).map((m) => m.name);
const SHARKTOOTH_MIRROR_NAMES = READ_ONLY_MIRRORS.filter((m) => !isBarePrefix(m.name, m.canonical)).map((m) => m.name);
const MIRROR_FOLD_ALTS = [
  SHARKTOOTH_MIRROR_NAMES.length ? `(<<~[!/]?\\s*)(${SHARKTOOTH_MIRROR_NAMES.join("|")})` : null,
  BARE_MIRROR_NAMES.length ? `(<<\\/?)(${BARE_MIRROR_NAMES.join("|")})` : null,
].filter((s): s is string => s !== null).join("|");
const MIRROR_FOLD_RE = new RegExp(`(?:${MIRROR_FOLD_ALTS})(?![\\w-])`, "g");

/**
 * A `hana`/`task` block's BODY carries a FOREIGN grammar (guest-grammar.mem #/hana-worksite), never
 * this house's own sigil spellings — the same opacity `meme-ast/scanner.ts`'s own worksite exclusion
 * holds the compile layer to. A mirror word appearing inside a hana body is the guest grammar's own
 * text, not an authored sigil call, and folding it would rewrite content this house does not own.
 */
function hanaBodySpans(text: string, mask: readonly { start: number; end: number }[]): [number, number][] {
  const spans: [number, number][] = [];
  const openRe = /<<~\s*(?:hana|task)\s+[^\n>]+?\s*>>/g;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(text))) {
    if (inMask(mask, m.index)) continue;
    const bodyStart = m.index + m[0].length;
    const close = /<<~\/(?:hana|task)\s*>>/.exec(text.slice(bodyStart));
    if (!close) continue;
    spans.push([bodyStart, bodyStart + close.index]);
    openRe.lastIndex = bodyStart + close.index + close[0].length;
  }
  return spans;
}
const inAnySpan = (spans: readonly [number, number][], i: number): boolean => spans.some(([s, e]) => i >= s && i < e);

/** A colon separates a parameter only where a QUOTED value follows — a scheme colon never does. */
const COLON_PARAM = /\b([A-Za-z0-9_-]+):(?=["']|\[\[)/g;

/**
 * The framing opener's two ends, positional.
 *
 * `pranala` and `lares aim` name theirs; the four framing codes carried a bare `?` and a bare address with
 * the bearing arrow between. The arrow stays — TiddlyWiki parses it as an unnamed positional — and the ends
 * it terminates take the names every other sigil already gives them.
 */
const FRAME_OPEN_ENDS = new RegExp(
  `(<<\\^ code="${SOH_ALT}"(?:[ \\t]+namespace="[^"]*")?[ \\t]+)"?\\?"?([ \\t]*->[ \\t]*)(\\S+?)([ \\t]*>>)`, "g");

/** The closer states one end: the arrow reaches an unresolved address. */
const FRAME_CLOSE_ENDS = new RegExp(
  `(<<\\^ code="${EOT_ALT}"[ \\t]*->[ \\t]*)"?\\?"?([ \\t]*>>)`, "g");

/**
 * Rewrite every CALL-site colon separator to `=`, leaving definitions and scheme colons untouched.
 *
 * Exported so a corpus sweep moves the graph by the same law the gate reads it with.
 *
 * A sigil closes on the line it opens. A match crossing a newline reaches from a bare `<<` in prose to the
 * next sigil and rewrites everything between — eight files on this graph moved that way.
 */
export function normalizeParamSeparators(src: string): { text: string; moved: number } {
  let moved = 0;
  // A sigil SHOWN inside a fence or a code span declares and fires nothing, and never moves.
  const mask = fencedSpans(src);
  const text = src.replace(/<<([^\n>]*(?:>(?!>)[^\n>]*)*)>>/g, (whole, inner: string, offset: number) => {
    if (inMask(mask, offset)) return whole;
    if (DEFINITION_HEAD.test(inner)) return whole;
    const next = inner.replace(COLON_PARAM, "$1=");
    if (next === inner) return whole;
    moved += 1;
    return `<<${next}>>`;
  });
  return { text, moved };
}

const META_KV_RE = /^([A-Za-z0-9_.-]+)[ \t]*=[ \t]*(.*)$/;

/**
 * Render one meta line under the column law: the key padded to the longest key, one space, `=`, one
 * space, the value. The ONE spelling both renderers emit — the disk projector re-emitting a carrier's
 * fields, and `meme normalize` re-aligning a fence an author spelled by hand.
 */
export function renderMetaTomlLine(key: string, value: string, pad: number): string {
  return `${key.padEnd(pad)} = ${value}`;
}

/**
 * Re-align a toml meta fence body's top-level `key = value` lines to the column law.
 *
 * Only the block ABOVE the first table header moves; a `[table]` and everything beneath it stays as
 * written, since the carrier's fields ride the top-level block alone. Values keep every byte — the
 * split runs at the first `=` after the key, so a value carrying ` = ` inside its quotes never moves.
 * Idempotent: a body already under the law passes through unchanged.
 */
export function alignMetaTomlColumns(body: string): string {
  const lines = body.split("\n");
  const top: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^[ \t]*\[/.test(lines[i]!)) break;
    if (META_KV_RE.test(lines[i]!)) top.push(i);
  }
  if (top.length === 0) return body;
  const pad = Math.max(...top.map((i) => META_KV_RE.exec(lines[i]!)![1]!.length));
  for (const i of top) {
    const m = META_KV_RE.exec(lines[i]!)!;
    lines[i] = renderMetaTomlLine(m[1]!, m[2]!, pad);
  }
  return lines.join("\n");
}

export interface NormalizeOptions {
  /**
   * Apply GRAMMAR-authority clauses (authored bytes — a call site's separator spelling and
   * anything else a hand wrote to mean something). Default false: grammar clauses are PROPOSED,
   * never applied. FRAME-authority clauses (the envelope the house mints and owns — DOCTYPE
   * address, sigil spellings, child-slot roots, meta columns) always apply; they carry exactly
   * one right answer and the house may fix them unasked. See the FRAME/GRAMMAR split doctrine
   * at the top of this file's sibling doc (`lares meme normalize`/`check` --grammar).
   */
  readonly grammar?: boolean;
}

export interface NormalizeResult {
  readonly text: string;
  readonly changed: boolean;
  readonly notes: readonly string[];
  /** Non-fatal observations the gate will NOT auto-fix — surfaced for human triage. */
  readonly flags: readonly string[];
  /**
   * GRAMMAR-authority notes: a PREFERENCE, never an answer. With `grammar: false` (the default)
   * these name what WOULD move without moving a byte; with `grammar: true` they name what DID
   * move, alongside `notes`.
   */
  readonly grammarNotes: readonly string[];
  /** True when a grammar-authority clause found something to propose (or applied it). */
  readonly grammarChanged: boolean;
}

/** A clause's authority, stated AT THE CLAUSE that writes — never a list a caller keeps in sync. */
export type ClauseClass = "frame" | "grammar";

/**
 * THE ONE DOOR EVERY CLAUSE WRITES `text` THROUGH.
 *
 * The operator's ruling: the class DECLARES ITSELF ON THE CLAUSE, and a clause that declares
 * nothing must never silently auto-apply. `text` stays private-in-spirit — every rewrite in
 * `normalizeMemeSource` below goes through `apply()`, which asks the class FIRST. A clause that
 * forgets to state one (a typo, a future dynamically-registered clause, code exercising this
 * door directly) reads as `"grammar"` — PROPOSE, don't apply — because that is the one class
 * this door may default to without moving a byte nobody asked to move. `"frame"` is never a
 * default; it is only ever an explicit spelling at the call site.
 *
 * FRAME (the envelope the house mints and owns — DOCTYPE address, sigil spellings, child-slot
 * roots, meta columns, the block check the CLI layers on top) carries exactly one right answer
 * and applies unconditionally; its note lands in `notes`.
 *
 * GRAMMAR (authored bytes — today, only the named-parameter separator) is a PREFERENCE, never an
 * answer: both spellings build the identical TiddlyWiki attribute at a CALL site (measured
 * against the fork and pinned 5.4.1 — only the recorded `assignmentOperator` differs), while a
 * DEFINITION's own parameter list refuses `=` outright (`\procedure kue(held="x")` reads the
 * whole token `held="x"` as the parameter's NAME, no default — confirmed on both readers). So a
 * grammar clause applies only when the caller opted in (`opts.grammar`); either way it flips
 * `grammarChanged` and lands a note in `grammarNotes` — applied or proposed, the caller's
 * `noteFor` supplies the wording for each.
 */
export class ClauseSeat {
  text: string;
  readonly notes: string[] = [];
  readonly grammarNotes: string[] = [];
  grammarChanged = false;

  constructor(src: string, private readonly opts: NormalizeOptions) {
    this.text = src;
  }

  /**
   * Write `next` over `this.text` under `clauseClass` — a no-op (`next === this.text`) reports
   * nothing on either class. `noteFor(applied)` supplies the note's wording: for a FRAME clause
   * `applied` is always `true`; for a GRAMMAR clause it reflects whether `opts.grammar` let the
   * write actually land.
   */
  apply(clauseClass: ClauseClass | undefined, next: string, noteFor: (applied: boolean) => string): void {
    if (next === this.text) return;
    // AN UNDECLARED CLASS READS AS GRAMMAR — the one direction a missing declaration can fail
    // safely. `"frame"` is the only spelling that ever unlocks an unconditional write.
    if (clauseClass === "frame") {
      this.text = next;
      this.notes.push(noteFor(true));
      return;
    }
    this.grammarChanged = true;
    const applied = Boolean(this.opts.grammar);
    this.grammarNotes.push(noteFor(applied));
    if (applied) this.text = next;
  }
}

/**
 * Canonicalize a single-carrier meme source. Returns the normalized text, a
 * `changed` flag, and human-readable notes naming each transform applied.
 *
 * FRAME clauses (the envelope) always apply. GRAMMAR clauses (authored bytes) apply only when
 * `opts.grammar` is true — otherwise they are reported through `grammarNotes` and move no byte.
 * Every rewrite below runs through `ClauseSeat.apply`, stating its class at the call site.
 */
export function normalizeMemeSource(src: string, opts: NormalizeOptions = {}): NormalizeResult {
  const flags: string[] = [];
  const seat = new ClauseSeat(src, opts);

  // ── 0. The declaration names the grammar, then the address ───────────────
  //
  // A carrier opening with the address alone parses, renders back to something else, and reads as
  // content drift in a round-trip witness — three library indexes arrived that way from two writers
  // that each spelled the line by hand. The one authority lives beside the type constant; a carrier
  // holding a shorter or older declaration takes it here, which is what a normalize gesture is for.
  const decl = /^<<!DOCTYPE[^>\n]*>>/m.exec(seat.text);
  if (decl && decl[0] !== DECLARATION) {
    const next = seat.text.slice(0, decl.index) + DECLARATION + seat.text.slice(decl.index + decl[0].length);
    seat.apply("frame", next, () => "declaration: took the grammar's name before its address");
    flags.push("declaration");
  }
  // ABSENCE RAISES NOTHING HERE. This gesture repairs what a carrier wrote; whether a `.mem` on disk
  // must carry a declaration at all is the doctype witness's question, and normalize also runs over
  // fragments and authoring drafts that legitimately carry no head.

  // ── 1. SOH opener (namespace embed + spacing) — FRAME AUTHORITY ──────────
  const nsRaw = metaNamespace(seat.text);
  const want = nsRaw === null ? "" : decodeEntities(nsRaw).trim();
  // The carrier's own opener stands outside every fence; an opener SHOWN in a fence ahead of it holds.
  const sohMask = fencedSpans(seat.text);
  const soh = [...seat.text.matchAll(new RegExp(SOH_OPENER_RE.source, "g"))].find((m) => !inMask(sohMask, m.index!));
  if (soh) {
    // BOTH SPELLINGS READ, ONE SPELLING WRITES. A head stating named params reads from them; a head
    // from before the params carries its namespace as bare glyphs in front of the control entity, and
    // this is the door that lifts it. Normalizing is exactly where a grammar migration belongs — the
    // reader stays forgiving so a carrier written under either form still arrives, and every carrier
    // that passes through leaves in the current one.
    const code = soh[2] ?? soh[5]!;
    const have = soh[3] ?? soh[4]?.trim() ?? "";
    // Canonical opener: the control head, the code param, then the namespace param where the meta
    // declares one. Comparing the WHOLE matched head rather than the namespace alone canonicalizes
    // spacing and param order together, so one rewrite settles every drift the head can carry.
    const rebuilt = `${soh[1]} code="${code}"${want ? ` namespace="${want}"` : ""}`;
    if (soh[0]! !== rebuilt) {
      const next = seat.text.slice(0, soh.index) + rebuilt + seat.text.slice(soh.index + soh[0]!.length);
      seat.apply("frame", next, () => have !== want
        ? (want ? `SOH namespace homed to "${want}" (from meta)` : `SOH namespace cleared (meta declares none)`)
        : `SOH opener spacing canonicalized`);
    }
  }

  // ── 2. Sigil close spacing — FRAME AUTHORITY ──────────────────────────────
  //
  // BOTH SPELLINGS READ, ONE SPELLING WRITES — the same law the opener above carries. `lar-sigil`
  // matches a close with or without the space before `>>`, so a carrier written either way arrives;
  // every carrier that passes through leaves tight. The match shape is the one clause 3 states: a
  // sigil closes on the line it opens, and a match crossing a newline reaches from a bare `<<` in
  // prose to the next sigil and rewrites everything between.
  // A close SHOWN inside a fence or a code span is held text, and held text moves no byte.
  // TRAILING WHITESPACE CARRIES NO AUTHORED MEANING — no hand chooses "one space before `>>`" as
  // a spelling — so this stays FRAME even though it touches every sigil, not only framing ones.
  {
    let tightened = 0;
    const mask = fencedSpans(seat.text);
    const next = seat.text.replace(/<<([^\n>]*(?:>(?!>)[^\n>]*)*)>>/g, (whole, inner: string, offset: number) => {
      if (inMask(mask, offset)) return whole;
      const trimmed = inner.replace(/[ \t]+$/, "");
      if (trimmed === inner) return whole;
      tightened += 1;
      return `<<${trimmed}>>`;
    });
    if (tightened > 0) {
      seat.apply("frame", next, () => `sigil close spacing: ${tightened} close${tightened === 1 ? "" : "s"} tightened`);
    }
  }

  // ── 3. Named-parameter separator (call sites only) — GRAMMAR AUTHORITY ───
  //
  // The memetic standard writes key=value; TiddlyWiki reads both spellings, so a carrier holding the colon
  // renders identically and only its spelling drifts. A DEFINITION stays untouched — a parameter list refuses
  // `=` (`\procedure kue(held="x")` reads the whole token `held="x"` as the parameter's NAME, no default —
  // confirmed on both readers) — and so does every scheme colon, which the quoted-value test excludes by shape.
  //
  // THIS IS A HAND'S SPELLING, NOT THE HOUSE'S ENVELOPE. Both spellings build the identical attribute at a
  // CALL site (measured against the TiddlyWiki fork and pinned 5.4.1: only the recorded `assignmentOperator`
  // differs), so rewriting it changes no reading — which is exactly why it must never apply unasked. The
  // house holds a PREFERENCE here, never an answer: it proposes (named per site, below) and only a hand
  // — or an explicit `--grammar` — disposes.
  {
    const sep = normalizeParamSeparators(seat.text);
    if (sep.moved > 0) {
      seat.apply("grammar", sep.text, (applied) => applied
        ? `named parameter separator: ${sep.moved} call site${sep.moved === 1 ? "" : "s"} took the equals sign`
        : `named parameter separator: ${sep.moved} call site${sep.moved === 1 ? "" : "s"} would take the equals sign — rerun with --grammar to apply`);
    }
  }

  // ── 4. Child-slot roots — FRAME AUTHORITY ─────────────────────────────────
  //
  // A CHILD SLOT NAMES THE STRING IT ADDRESSES. The carrier mints `parentUri#/name`, so an open that
  // omits the slash says one thing and resolves another, and every reader pairing them by name carries
  // a special case. A NESTED slot carries its whole path — rooting only the leaf makes a child the
  // sibling of its own parent, which reads as structure and addresses as none. No slot is exempt from a
  // root: every slot a carrier declares opens a child, and a child answers to an address.
  //
  // FLAT PATHS EXPAND (operator ruling). `<<~ ahu #/a/b/c>> … <<~/ahu>>` names THREE nested slots in
  // one open/close pair — the author wrote the whole chain inline rather than opening each level by
  // hand. Any segment already satisfied by the enclosing stack is not "new"; a path already matching
  // its enclosing stack is untouched. Beyond that, each MISSING parent segment mints its own wrapper
  // open before the authored line and its own close after — unless that parent's full path already
  // stands elsewhere in the carrier as some OTHER block's own address, in which case the whole
  // expansion refuses (no bytes move, no duplicate address mints) and names itself in `flags`.
  {
    const lines = seat.text.split("\n");
    const mask = fencedSpans(seat.text);
    const CLOSE_RE = /^<<(?:~\/ahu|\/fragment)\s*>>/;
    // The leading slash is OPTIONAL on read — a bare `#name` is exactly the unrooted drift this
    // clause exists to fix — and always present on write (every output line below mints `#/`).
    const OPEN_RE = /^<<(~ ?ahu|fragment) #\/?([a-z0-9/-]+)(.*)$/i;

    // The enclosing `stack` is ALWAYS the prefix a new open mints onto — a bare leaf (`#ha-fields`)
    // always lands under whatever is physically open around it, regardless of what name it carries.
    // The ONE exception: an author who writes the ABSOLUTE path redundantly, stack included
    // (`#/a/b` while already standing inside `#/a`), is not asking for `a/a/b` — `segs` carrying the
    // whole enclosing stack as its OWN leading prefix means "this is already rooted", so only the
    // trailing segments beyond the stack are new. Anything short of that full-stack match (including
    // a one-segment mismatch, as a bare sibling leaf always is) carries no redeclaration at all.
    const newSegsFor = (segs: string[], stack: string[]): string[] => {
      const isRedeclared = segs.length >= stack.length && stack.every((s, i) => segs[i] === s);
      const fresh = isRedeclared ? segs.slice(stack.length) : segs;
      // Every open introduces at least one new level — a redeclaration of the exact standing
      // address (no trailing segments at all) still names ITS OWN leaf.
      return fresh.length > 0 ? fresh : [segs[segs.length - 1]!];
    };

    // PASS 1 — index every open's OWN (deepest) declared address, so pass 2 can refuse a missing
    // parent that collides with a block some OTHER open already owns in its own right.
    const ownPaths = new Set<string>();
    {
      const stack: string[] = [];
      const closeCounts: number[] = [];
      let offset = 0;
      for (const line of lines) {
        const start = offset;
        offset += line.length + 1;
        if (inMask(mask, start)) continue;
        if (CLOSE_RE.test(line)) {
          for (let i = 0, n = closeCounts.pop() ?? 1; i < n; i++) stack.pop();
          continue;
        }
        const m = OPEN_RE.exec(line);
        if (!m) continue;
        const segs = m[2]!.split("/");
        const newSegs = newSegsFor(segs, stack);
        ownPaths.add([...stack, ...newSegs].join("/"));
        for (const s of newSegs) stack.push(s);
        closeCounts.push(newSegs.length);
      }
    }

    // PASS 2 — rewrite, expanding a flat multi-segment open into its nested chain.
    const stack: string[] = [];
    const closeCounts: number[] = [];
    const refusals: string[] = [];
    let rooted = 0, offset = 0;
    const out: string[] = [];
    for (const line of lines) {
      const start = offset;
      offset += line.length + 1;
      if (inMask(mask, start)) { out.push(line); continue; }
      if (CLOSE_RE.test(line)) {
        const n = closeCounts.pop() ?? 1;
        for (let i = 0; i < n; i++) stack.pop();
        out.push(Array.from({ length: n }, () => line).join("\n"));
        continue;
      }
      const m = OPEN_RE.exec(line);
      if (!m) { out.push(line); continue; }
      const segs = m[2]!.split("/");
      const base = stack.slice();
      const newSegs = newSegsFor(segs, stack);

      if (newSegs.length <= 1) {
        const path = [...base, ...newSegs].join("/");
        stack.push(newSegs[0]!);
        closeCounts.push(1);
        const rebuilt = `<<${m[1]} #/${path}${m[3]}`;
        if (rebuilt !== line) rooted += 1;
        out.push(rebuilt);
        continue;
      }

      // Multi-segment flat open — every MISSING PARENT (never the leaf itself) checks against
      // another block's own address first.
      let conflictParent: string | null = null;
      for (let i = 1; i < newSegs.length && conflictParent === null; i++) {
        const parent = [...base, ...newSegs.slice(0, i)].join("/");
        if (ownPaths.has(parent)) conflictParent = parent;
      }
      if (conflictParent !== null) {
        refusals.push(
          `child slot: #/${segs.join("/")} refuses to expand — its missing parent #/${conflictParent} already stands as its own block`,
        );
        stack.push(segs.join("/"));
        closeCounts.push(1);
        out.push(line);
        continue;
      }

      for (let i = 0; i < newSegs.length; i++) {
        const path = [...base, ...newSegs.slice(0, i + 1)].join("/");
        out.push(i === newSegs.length - 1 ? `<<${m[1]} #/${path}${m[3]}` : `<<${m[1]} #/${path}>>`);
        stack.push(newSegs[i]!);
      }
      closeCounts.push(newSegs.length);
      rooted += 1;
    }

    const rebuilt = out.join("\n");
    if (rebuilt !== seat.text) {
      seat.apply("frame", rebuilt, () => `child slot: ${rooted} open${rooted === 1 ? "" : "s"} rooted at the carrier`);
    }
    for (const r of refusals) flags.push(r);
  }

  // ── 5. Framing ends (positional → named) — FRAME AUTHORITY ───────────────
  // A framing sigil SHOWN inside a fence or a code span is held text, and keeps its spelling.
  {
    let ends = 0;
    const openMask = fencedSpans(seat.text);
    let working = seat.text.replace(FRAME_OPEN_ENDS, (m: string, head: string, arrow: string, target: string, tail: string, offset: number) => {
      if (inMask(openMask, offset)) return m;
      ends += 1;
      // QUOTED IS CANONICAL — TiddlyWiki's own parser reads every control sigil, and a quoted value is
      // the form it types without a special case. A target arriving already quoted keeps its one pair.
      const bare = target.replace(/^"(.*)"$/, "$1");
      return `${head}from="?"${arrow}to="${bare}"${tail}`;
    });
    const closeMask = fencedSpans(working);
    working = working.replace(FRAME_CLOSE_ENDS, (m: string, head: string, tail: string, offset: number) => {
      if (inMask(closeMask, offset)) return m;
      ends += 1;
      return `${head}to="?"${tail}`;
    });
    if (ends > 0) {
      seat.apply("frame", working, () => `framing ends: ${ends} sigil${ends === 1 ? "" : "s"} named from= and to=`);
    }
  }

  // ── 6. Meta columns — FRAME AUTHORITY ─────────────────────────────────────
  //
  // ONE COLUMN LAW, TWO RENDERERS. The disk projector re-emits a carrier's meta from its fields and
  // aligns the equals-signs to the longest key; a fence an author spelled a column wider read clean
  // here and moved under the projector, so the two renders disagreed on bytes no value changed.
  // The same law re-aligns the fence here, and the two renders agree by construction.
  {
    const fence = metaFence(seat.text);
    if (fence) {
      const aligned = alignMetaTomlColumns(fence[2]!);
      if (aligned !== fence[2]!) {
        const next = seat.text.slice(0, fence.index + fence[1]!.length) + aligned + seat.text.slice(fence.index + fence[1]!.length + fence[2]!.length);
        seat.apply("frame", next, () => "meta columns: equals-signs aligned to the longest key");
      }
    }
  }

  // ── 7. Sigil spelling: every READ-ONLY mirror folds to its canonical head — FRAME AUTHORITY ─────
  //
  // RULED (operator): `lares meme normalize` "shall preserve
  // explicitly marked weave/tangle alternates, but otherwise normalize to house memetic-wikitext
  // grammar." A read-only mirror (`lar-mirror-of` set, no `lar-weave: primary`) carries no grammar
  // of its own — folding its HEAD TOKEN to the canonical name loses no authored intent. A
  // `lar-weave: primary` mirror (e.g. `transclude`, `pin`) is itself a canonical spelling in
  // its own tongue and never folds.
  //
  // EXPLICIT MARK = preserve: a carrier whose meta declares `tongue = "<bcp47>"` rests in its
  // authored mirror spellings — this clause never touches it at all. Arguments/URIs/prose, fences,
  // and hana/task guest-grammar bodies never move either way — only the head token, authored
  // outside both.
  if (metaTongue(seat.text) === null) {
    let folded = 0;
    const mask = fencedSpans(seat.text);
    const hanaSpans = hanaBodySpans(seat.text, mask);
    const next = seat.text.replace(
      MIRROR_FOLD_RE,
      (whole, sharkPrefix: string | undefined, sharkName: string | undefined,
        barePrefix: string | undefined, bareName: string | undefined, offset: number) => {
        if (inMask(mask, offset) || inAnySpan(hanaSpans, offset)) return whole;
        const prefix = sharkPrefix ?? barePrefix!;
        const name = sharkName ?? bareName!;
        folded += 1;
        return prefix + MIRROR_CANONICAL_OF.get(name)!;
      },
    );
    if (folded > 0) {
      seat.apply("frame", next, () => `sigil spelling: ${folded} read-only mirror occurrence${folded === 1 ? "" : "s"} folded to its canonical head`);
    }
  }

  return {
    text: seat.text,
    changed: seat.text !== src,
    notes: seat.notes,
    flags,
    grammarNotes: seat.grammarNotes,
    grammarChanged: seat.grammarChanged,
  };
}
