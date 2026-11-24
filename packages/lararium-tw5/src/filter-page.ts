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

import { VerbRefusal, canonicalJsonBytes, sha256HexBytesSync } from "@lararium/mesh";

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
  /** The collapse lens: the bytes the record (a meme root: its whole carrier) holds, and a meme root's slots, unfolded by `tiddler get --meme --slot`. */
  bytes?: number; slots?: Array<{ slot: string; bytes: number; first: string | null }>;
  /** Slot records of a collapsed meme root that rest in a layer this face may not read, left out of its slots. */
  withheld?: number;
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
 * its largest fields and names them `omitted`.
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
        // A collapsed row's slots shed last, by name: the meme unfolds by `tiddler get --meme --skinny`.
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
