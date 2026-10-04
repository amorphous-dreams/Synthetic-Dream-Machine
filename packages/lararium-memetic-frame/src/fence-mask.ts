/**
 * fence-mask — quoted-code spans for structural sigil scans.
 *
 * The shore's structural scanners (carrier framing, ahu blocks, kahea
 * refs) MUST NOT match sigils the operator merely QUOTES: a teaching doc
 * that shows `<<^ code="&#x0003;">>` inside a code fence does not close its own
 * body, and a fenced `<<~ ahu #example>>` opens no child. Before this
 * mask landed, a fenced ETX mention truncated everything
 * after it at ingest — silent content loss on real corpus files.
 *
 * Two span kinds, CommonMark-shaped, conservative:
 *   - fenced code blocks: a line opening with 0–3 spaces then 3+ backticks OR 3+ tildes closes at
 *     the next line with a same-or-longer run of the SAME character (or end-of-text when unclosed —
 *     the open tail stays masked);
 *   - inline code spans: equal-length backtick runs paired within a line, outside fenced blocks.
 *
 * TILDE FENCES, FOUND BY FUZZING (lararium-memetic-frame/tests/fence-edge-fuzz.test.ts). CommonMark
 * §4.5 admits a tilde fence (`~~~`) as a full peer of a backtick fence — a corpus author quoting a
 * frame mark inside one is exactly the "conformant corpus quotes every mark in a fence" case
 * #/the-touchstone promises. `fencedSpans` (this module's own scan, which the ONE span reader in
 * `span.ts` reads through) now masks both; a quoted ETX the fuzz generated inside a `~~~` fence used
 * to read as LIVE, closing the carrier's real span early at the quoted mark and naming it a
 * `second-etx` fault over a carrier that was, in fact, well-formed.
 *
 * ONE FAMILY, BOTH CHARACTERS. `fenceLineOpen` answers the run a line opens — its length and its
 * character — and `fenceLineClose` closes only against that same character; `fencedSpans` and every
 * line-at-a-time walk (weave's transposer, its slot extractor) read the same pair, so no reader can
 * mask a tilde fence while another reads through it.
 *
 * Isomorphic; no TW5/fs/DOM dependencies — same law in every caller.
 */

export interface MaskSpan { readonly start: number; readonly end: number }

const FENCE_OPEN_RE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_RUN_RE: Readonly<Record<FenceChar, RegExp>> = { "`": /^ {0,3}(`{3,})/, "~": /^ {0,3}(~{3,})/ };

/** A fence character this module recognises — the two CommonMark §4.5 admits. */
export type FenceChar = "`" | "~";

/** An opened fence: its run length and the character it opened with. */
export interface FenceOpen { readonly len: number; readonly ch: FenceChar }

/**
 * Does `line` open a fence, CommonMark §4.5? Answers the run — length and character — or null when it
 * does not, including when the leading run WOULD open one but the info string carries the fence's own
 * character: a line shaped like "```memetic-wikitext tangle` more prose" never opens a fence at all; it
 * reads as ordinary text carrying an inline code span. (A backtick info string may carry a tilde and
 * vice versa — only the fence's OWN character is forbidden there.)
 */
export function fenceLineOpen(line: string): FenceOpen | null {
  const m = FENCE_OPEN_RE.exec(line);
  if (m === null) return null;
  const run = m[1]!;
  const ch = run[0] as FenceChar;
  return line.slice(m[0].length).includes(ch) ? null : { len: run.length, ch };
}

/**
 * Does `line` CLOSE the fence `open` records? A closer needs a run of the SAME character, `open.len`
 * or longer, AND NOTHING ELSE ON THE LINE beside it — a content line that happens to start with a
 * shorter or trailed run ("```` example of `backticks`", inside a fence opened at four) never closes;
 * it is BODY. An un-guarded close would close early on a content line and read what followed as if
 * the fence had never opened.
 */
export function fenceLineClose(line: string, open: FenceOpen): boolean {
  const m = FENCE_RUN_RE[open.ch].exec(line);
  if (m === null || m[1]!.length < open.len) return false;
  return line.slice(line.indexOf(open.ch) + m[1]!.length).trim() === "";
}

/** All quoted-code spans of `text`, ordered, non-overlapping. */
export function fencedSpans(text: string): MaskSpan[] {
  const spans: MaskSpan[] = [];
  let open: { len: number; ch: FenceChar; start: number } | null = null;
  let lineStart = 0;
  const flushLine = (lineEnd: number, nextStart: number) => {
    const line = text.slice(lineStart, lineEnd);
    const opened = fenceLineOpen(line);
    if (open) {
      // closing fence: fenceLineClose — same-or-longer run of the SAME character, nothing but
      // the run on the line
      if (fenceLineClose(line, open)) {
        spans.push({ start: open.start, end: nextStart });
        open = null;
      }
    } else if (opened) {
      open = { len: opened.len, ch: opened.ch, start: lineStart };
    } else {
      // inline code spans on a non-fence line
      let i = 0;
      while (i < line.length) {
        if (line[i] !== "`") { i++; continue; }
        let runLen = 1;
        while (line[i + runLen] === "`") runLen++;
        // find a matching equal-length run further on
        let j = i + runLen;
        let closed = -1;
        while (j < line.length) {
          if (line[j] !== "`") { j++; continue; }
          let r = 1;
          while (line[j + r] === "`") r++;
          if (r === runLen) { closed = j + r; break; }
          j += r;
        }
        if (closed >= 0) {
          spans.push({ start: lineStart + i, end: lineStart + closed });
          i = closed;
        } else {
          i += runLen;
        }
      }
    }
    lineStart = nextStart;
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") flushLine(i, i + 1);
  }
  flushLine(text.length, text.length);
  // THE CAST, kept: `open` is reassigned inside the `flushLine` closure above, and TS's
  // control-flow narrowing does not carry a closure's mutations back out to this `!== null` check.
  if (open !== null) spans.push({ start: (open as { start: number }).start, end: text.length });
  return spans;
}

/** True when index `i` falls inside any span. Spans stay ordered — binary search. */
export function inMask(spans: readonly MaskSpan[], i: number): boolean {
  let lo = 0, hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = spans[mid]!;
    if (i < s.start) hi = mid - 1;
    else if (i >= s.end) lo = mid + 1;
    else return true;
  }
  return false;
}

/**
 * True when `i` sits strictly INSIDE a span — past its opening character.
 * A fence opener itself starts its own span; a scanner looking for real
 * fence openers (the meta finder) accepts span-start matches and rejects
 * interior ones (a ````-quoted ```toml meta example).
 */
export function inMaskInterior(spans: readonly MaskSpan[], i: number): boolean {
  let lo = 0, hi = spans.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const s = spans[mid]!;
    if (i < s.start) hi = mid - 1;
    else if (i >= s.end) lo = mid + 1;
    else return i > s.start;
  }
  return false;
}

/**
 * First match of `re` in `text` whose start index falls OUTSIDE the mask.
 * `re` may carry the /g flag or not; lastIndex resets either way.
 * `allowSpanStart` admits matches that begin exactly at a span's opening
 * character — for scanners whose target IS a fence opener.
 */
export function maskedExec(text: string, re: RegExp, spans?: readonly MaskSpan[], allowSpanStart = false): RegExpExecArray | null {
  const mask = spans ?? fencedSpans(text);
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    const blocked = allowSpanStart ? inMaskInterior(mask, m.index) : inMask(mask, m.index);
    if (!blocked) return m;
    // A masked match may have swallowed text containing a real later match
    // (greedy patterns) — re-seek from just past the masked START, never
    // past the whole match.
    g.lastIndex = m.index + 1;
  }
  return null;
}

/**
 * Every unmasked match of `re` in `text`.
 *
 * `allowSpanStart` admits a match beginning exactly ON a span's opening
 * character — for scans whose TARGET is a fence. The meta block spells itself
 * ```toml, so a mask that refused every span erased 840 of the corpus's 852
 * meta reads and took the carriers' identity with them; admitting the opener
 * keeps a carrier's own meta block and still refuses a ````-quoted example of
 * one, which starts in the interior.
 */
export function maskedExecAll(text: string, re: RegExp, spans?: readonly MaskSpan[], allowSpanStart = false): RegExpExecArray[] {
  const mask = spans ?? fencedSpans(text);
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(text)) !== null) {
    const blocked = allowSpanStart ? inMaskInterior(mask, m.index) : inMask(mask, m.index);
    if (!blocked) {
      out.push(m);
      if (g.lastIndex === m.index) g.lastIndex++;   // zero-width guard
    } else {
      g.lastIndex = m.index + 1;                    // masked: re-seek, don't overshoot
    }
  }
  return out;
}
