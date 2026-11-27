/**
 * filter-page — the one page law over a TiddlyWiki filter's answer, and the parse check ahead of it.
 *
 * A LEAF: the daemon's `wiki-filter` verb (`tiddler-verbs.ts`) and the record port's `filter` ask
 * (`record-port-handler.ts`) both page through here, so a page, a cursor and a refusal read the same on the CLI, the
 * MCP seat and the page's own port (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/anti-patterns, the unbounded
 * filter door). It imports the mesh's digest and refusal alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tiddler-verbs
 */

import { VerbRefusal } from "@lararium/mesh/verb-refusal";
import { canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh/crypto";

// ── THE BOUNDS ────────────────────────────────────────────────────────────────────────────────────────

/** The rows one filter page carries at most: the verb outcome's own array cap (`AUDIT_ARRAY_CAP`, `verb-vm.ts`), so a page always
 *  rides whole. A test welds the two numbers. */
export const WIKI_FILTER_ROWS = 32;
/** The bytes one filter page carries by default, and the most a caller may ask for. */
export const WIKI_FILTER_BYTES = 65_536;
export const WIKI_ANSWER_BYTES_MAX = 262_144;

const utf8 = new TextEncoder();
const bytesOf = (value: unknown): number => utf8.encode(typeof value === "string" ? value : JSON.stringify(value)).length;
const digestOf = (value: unknown): string => sha256HexBytesSync(canonicalJsonBytes(value));

// ── THE LINES LENS (S5, lar:///ha.ka.ba/kahua/memory/course/ai-surface-gestures) ──────────────────────

/** The context lines a matching line carries on each side, at most. */
export const FILTER_CONTEXT_MAX = 8;
/** The lines one row carries at most (matches and their context together); `matches` still counts every matching line. */
export const FILTER_LINES_PER_ROW = 64;
/** The bytes one line's text carries at most; a longer line rides cut at a character boundary and says so (`cut: true`). */
export const FILTER_LINE_BYTES = 512;

/** One line of a record's text: its 1-based number and its words, a matching line or the context around one. */
export interface FilterLine { n: number; text: string; cut?: true }

/** What a row's lines read: the line test the ask names, and the context it carries. */
export interface LineLens { readonly test: (line: string) => boolean; readonly context: number }

/**
 * THE LINE TEST AN ASK NAMES. `match` reads as plain words a line must hold, byte for byte; a `/source/flags` spelling
 * reads as a regular expression (`/\b(is|are|was)\b/i`). `context` (0..8) names the lines around each match; it shapes
 * the lines `match` finds, so `context` alone refuses `filter-context-alone`. Neither named answers null: the rows stay as
 * they were. Each refusal names the spelling that cures it.
 */
export function lineLensOf(match: unknown, context: unknown): LineLens | null {
  const words = typeof match === "string" ? match : match === undefined || match === null ? null : String(match);
  const hasContext = context !== undefined && context !== null && context !== "";
  if (words === null || words === "") {
    if (words === "") throw new VerbRefusal("filter-match-empty", "filter-match-empty: `match` names the words a line must hold; name them (`match=' is '`, or `match='/\\bis\\b/'` for a regexp), or drop `match`.");
    if (hasContext) throw new VerbRefusal("filter-context-alone", "filter-context-alone: `context` shapes the lines `match` finds; name `match=<words>` beside it, or drop `context`.");
    return null;
  }
  const n = !hasContext ? 0 : typeof context === "number" ? context : typeof context === "string" && /^[0-9]+$/.test(context.trim()) ? Number(context.trim()) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > FILTER_CONTEXT_MAX) throw new VerbRefusal("filter-context-range", `filter-context-range: \`context\` reads a whole number of lines from 0 to ${FILTER_CONTEXT_MAX} (got ${JSON.stringify(context)}); name one in range, e.g. \`context=2\`.`);
  const spelled = /^\/(.+)\/([a-z]*)$/s.exec(words);
  if (spelled) {
    let re: RegExp;
    // A regexp tests one line at a time: `g` and `y` would carry state from line to line, so the lens drops them.
    try { re = new RegExp(spelled[1]!, spelled[2]!.replace(/[gy]/g, "")); }
    catch (fault) { throw new VerbRefusal("filter-match-malformed", `filter-match-malformed: ${fault instanceof Error ? fault.message : String(fault)}; fix the regexp, or spell plain words without the enclosing slashes.`); }
    return { test: (line) => re.test(line), context: n };
  }
  return { test: (line) => line.includes(words), context: n };
}

/** A line's words cut to `FILTER_LINE_BYTES` at a character boundary. */
function boundLine(n: number, text: string): FilterLine {
  if (bytesOf(text) <= FILTER_LINE_BYTES) return { n, text };
  let end = 0;
  let size = 0;
  while (end < text.length) {
    const point = text.codePointAt(end)!;
    const cost = point < 0x80 ? 1 : point < 0x800 ? 2 : point < 0x10000 ? 3 : 4;
    if (size + cost > FILTER_LINE_BYTES) break;
    size += cost;
    end += point > 0xffff ? 2 : 1;
  }
  return { n, text: text.slice(0, end), cut: true };
}

/**
 * ONE RECORD'S MATCHING LINES. Each line the lens's test holds rides with `context` lines on each side; windows that touch
 * merge, so a line rides once, in text order. A row carries at most `FILTER_LINES_PER_ROW` lines; `matches` counts every
 * matching line in the text, so a sweep sees what the bound left behind.
 */
export function matchingLines(text: string, lens: LineLens): { lines: FilterLine[]; matches: number } {
  const all = text.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
  const keep = new Set<number>();
  let matches = 0;
  for (let i = 0; i < all.length; i++) {
    if (!lens.test(all[i]!)) continue;
    matches++;
    for (let j = Math.max(0, i - lens.context); j <= Math.min(all.length - 1, i + lens.context); j++) keep.add(j);
  }
  const lines = [...keep].sort((a, b) => a - b).slice(0, FILTER_LINES_PER_ROW).map((i) => boundLine(i + 1, all[i]!));
  return { lines, matches };
}

export interface FilterPageQuery {
  /** The cursor a prior page handed back as `next`; absent reads the first page. */
  readonly after?: string | null;
  readonly limit?: number;
  readonly maxBytes?: number;
  /** A title's row where the caller asked for fields; absent, a row reads as its title. */
  readonly rowOf?: (title: string) => FilterRow;
}
export interface FilterRow {
  title: string; fields: Record<string, string>; omitted?: string[];
  /** The depth (`mu=many-relate` or `many-assert`): the record's has line, as a get's card names it. */
  has?: string;
  /** The collapse lens: the bytes the record (a meme root: its whole carrier) holds, and a meme root's slots, unfolded by `lares get title=… slot=#/<name> mu=assert`. */
  bytes?: number; slots?: Array<{ slot: string; bytes: number; first: string | null }>;
  /** Slot records of a collapsed meme root that rest in a layer this face may not read, left out of its slots. */
  withheld?: number;
  /** The lines lens (`match`, `context`): the record's matching lines with their context, and how many lines matched in all. */
  lines?: FilterLine[]; matches?: number;
}
export interface FilterPage {
  readonly titles: string[];
  readonly rows?: FilterRow[];
  /** Every title the filter answered, across all pages. */
  readonly total: number;
  /** The cursor of the page behind this one, or null where the answer ends here. */
  readonly next: string | null;
  /** The answer this page belongs to: a digest of the whole title list. A cursor continues that answer alone. */
  readonly asOf: string;
}

/** The answer a cursor continues and the offset it names: a cursor from another answer refuses `filter-cursor-stale`, a misshapen one `filter-cursor-malformed`. */
export function filterCursor(all: readonly string[], after?: string | null): { asOf: string; offset: number } {
  const asOf = digestOf(all).slice(0, 16);
  if (after === undefined || after === null || after === "") return { asOf, offset: 0 };
  const cursor = /^([0-9]{1,9})\.([0-9a-f]{16})$/.exec(after);
  if (!cursor) throw new VerbRefusal("filter-cursor-malformed", `filter-cursor-malformed: "${after}" reads as no cursor; hand back a page's own \`next\`, or drop \`after\` to read from the first page.`);
  if (cursor[2] !== asOf) throw new VerbRefusal("filter-cursor-stale", "filter-cursor-stale: the wiki moved and this filter answers another list now; drop `after` and read again from the first page.");
  return { asOf, offset: Math.min(Number(cursor[1]), all.length) };
}

/**
 * ONE PAGE OF A FILTER'S ANSWER. A filter re-runs for each page, so the cursor names the answer it continues: an offset
 * and the digest of the whole title list (`asOf`). No clock and no counter decides staleness: a re-run that answers
 * another list refuses `filter-cursor-stale`, and the caller reads again from the first page. A page ends at the row
 * cap or the byte cap, whichever comes first, and always carries at least one row; a single row past the byte cap sheds
 * its largest fields and names them `omitted`, then its tail lines (`omitted: ["lines"]`).
 */
export function pageFilterAnswer(all: readonly string[], query: FilterPageQuery = {}): FilterPage {
  const { asOf, offset } = filterCursor(all, query.after);
  const limit = Math.max(1, Math.min(query.limit ?? WIKI_FILTER_ROWS, WIKI_FILTER_ROWS));
  const maxBytes = Math.max(64, Math.min(query.maxBytes ?? WIKI_FILTER_BYTES, WIKI_ANSWER_BYTES_MAX));
  const titles: string[] = [];
  const rows: FilterRow[] = [];
  let size = 2;
  for (let i = offset; i < all.length && titles.length < limit; i++) {
    const title = all[i]!;
    let row: FilterRow | string = query.rowOf ? query.rowOf(title) : title;
    let cost = bytesOf(row) + (titles.length > 0 ? 1 : 0);
    if (size + cost > maxBytes) {
      if (titles.length > 0) break;
      // The first row alone outruns the cap: it sheds its largest fields, by name, until it fits.
      if (typeof row !== "string") {
        const shed: FilterRow = { ...row, fields: { ...row.fields }, omitted: [...(row.omitted ?? [])] };
        for (const name of Object.keys(shed.fields).sort((a, b) => bytesOf(shed.fields[b]) - bytesOf(shed.fields[a]))) {
          if (2 + bytesOf(shed) <= maxBytes) break;
          delete shed.fields[name];
          shed.omitted!.push(name);
        }
        // The lines shed next, from the tail, so the first matches still ride; `matches` keeps the whole count.
        if (2 + bytesOf(shed) > maxBytes && shed.lines && shed.lines.length > 0) {
          shed.lines = [...shed.lines];
          while (shed.lines.length > 0 && 2 + bytesOf(shed) > maxBytes) shed.lines.pop();
          shed.omitted!.push("lines");
        }
        // A collapsed row's slots shed last, by name: the meme unfolds by `lares get title=… mu=relate`.
        if (2 + bytesOf(shed) > maxBytes && shed.slots) { delete shed.slots; shed.omitted!.push("slots"); }
        if (2 + bytesOf(shed) > maxBytes && shed.bytes !== undefined) { delete shed.bytes; shed.omitted!.push("bytes"); }
        row = shed;
        cost = bytesOf(row);
      }
    }
    size += cost;
    titles.push(title);
    if (typeof row !== "string") rows.push(row);
  }
  const end = offset + titles.length;
  return { titles, ...(query.rowOf ? { rows } : {}), total: all.length, next: end < all.length ? `${end}.${asOf}` : null, asOf };
}

/** The slice of the engine a filter check reads. */
export interface FilterWiki {
  parseFilter(filter: string): Array<{ namedPrefix?: string }>;
  getFilterRunPrefixes(): Record<string, unknown>;
}

/**
 * A MALFORMED FILTER REFUSES BY NAME. TiddlyWiki's own `filterTiddlers` answers a parse fault as a one-title list
 * holding the error text, which a caller would read as a result. The parse runs here first, through the engine's own
 * parser, and a fault refuses `filter-malformed` with the engine's words; a run prefix no module names refuses the same.
 */
export function checkFilter(wiki: unknown, filter: string): void {
  const w = wiki as FilterWiki;
  let tree: Array<{ namedPrefix?: string }>;
  try { tree = w.parseFilter(filter); }
  catch (fault) { throw new VerbRefusal("filter-malformed", `filter-malformed: ${String(fault)} (in ${JSON.stringify(filter.slice(0, 200))})`); }
  const prefixes = w.getFilterRunPrefixes();
  for (const run of tree) {
    if (run.namedPrefix && !Object.hasOwn(prefixes, run.namedPrefix)) {
      throw new VerbRefusal("filter-malformed", `filter-malformed: unknown filter run prefix ":${run.namedPrefix}" (in ${JSON.stringify(filter.slice(0, 200))})`);
    }
  }
}
