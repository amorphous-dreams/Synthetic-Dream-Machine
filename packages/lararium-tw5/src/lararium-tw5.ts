/**
 * lararium-tw5 — isomorphic TW5 interface for Lararium.
 * Home: @lararium/tw5
 *
 * Architecture law:
 *   The live lar:/// CRDT documents ARE the source of truth — parse tree,
 *   widget tree, render tree all derive from them. TW5 acts as a guest
 *   interpreter: it owns TW-compatible interpretation of authorized tiddler
 *   state, but it does not own Lararium state, identity, or canon.
 *
 * Boot model:
 *   import tw from "tiddlywiki"  →  Node: CJS default import via ESM interop
 *                                    Browser: Vite CJS→ESM transform at build time
 *   argv = []  →  TW5 boots its core modules from node_modules without
 *                 reading any wiki directory.
 *   $tw.browser detection  →  TW5 auto-detects its environment via
 *                              typeof window !== "undefined". We do NOT force
 *                              $tw.browser = true — forcing it in Node causes
 *                              TW5 to execute browser code paths that reference
 *                              window directly, breaking the Node runtime.
 *   preloadTiddlerArray  →  seeds lar:/// documents before boot completes.
 *
 * wikitext-filter pre-processing (lar:///grammars/wikitext-filter):
 *   all[memes]         → all[tiddlers]
 *   toml:key[value]    → field:key[value]
 *   edge:FAMILY[ROLE]  → has[edge-out-FAMILY-ROLE]
 *   edge:FAMILY[]      → has[edge-out-FAMILY]
 *
 * ClosureEntry → tiddler field mapping:
 *   title        uri           — primary key
 *   tags         implements    — [tag[X]] = implement-set membership
 *   depth        String(depth) — [nsort[depth]]
 *   rating       kind          — [field:rating[meme]]
 *   confidence   String        — [toml:confidence[0.82]]
 *   register     register      — [toml:register[CS]]
 *   manaoio      String        — [toml:manaoio[0.78]]
 *   mana / manao String        — [toml:mana[0.9]]
 *   role         role          — [toml:role[...]]
 *   exists       String(bool)  — [field:exists[true]]
 *   edge-out-FAMILY          space-separated toUri list (any role)
 *   edge-out-FAMILY-ROLE     space-separated toUri list (specific role)
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — tiddlywiki is CJS; Node ESM interop and Vite CJS→ESM both expose
// module.exports as the default export, giving us { TiddlyWiki: [Function] }.
import tw from "tiddlywiki";

import type { ClosureEntry, EdgeRecord, FilterEngineFn } from "@lararium/core";

// Re-export so callers can get FilterEngineFn from @lararium/tw5 directly.
export type { FilterEngineFn };

// ---------------------------------------------------------------------------
// wikitext-filter pre-processor
// ---------------------------------------------------------------------------

export function toCanonicalWikitext(expr: string): string {
  return expr
    .replace(/\ball\[memes\]/g, "all[tiddlers]")
    .replace(/\btoml:([\w-]+)\[/g, "field:$1[")
    .replace(/\bedge:([\w-]+)\[([\w-]+)\]/g, "has[edge-out-$1-$2]")
    .replace(/\bedge:([\w-]+)\[\]/g, "has[edge-out-$1]");
}

// ---------------------------------------------------------------------------
// ClosureEntry → tiddler field mapping
// ---------------------------------------------------------------------------

export function entryToFields(
  entry: ClosureEntry,
  extra?: Record<string, string>,
): Record<string, string | string[]> {
  return {
    title:        entry.uri,
    tags:         entry.implements,
    depth:        String(entry.depth),
    rating:       entry.kind,
    confidence:   String(entry.confidence),
    register:     entry.register,
    manaoio:      String(entry.manaoio),
    mana:         String(entry.mana),
    manao:        String(entry.manao),
    role:         entry.role ?? "",
    exists:       String(entry.exists),
    laresRelPath: entry.laresRelPath ?? "",
    contentHash:  entry.contentHash,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Edge field pre-loading
// ---------------------------------------------------------------------------

export function buildEdgeFieldMap(edges: readonly EdgeRecord[]): Map<string, Record<string, string>> {
  const byUri = new Map<string, Record<string, string[]>>();
  for (const e of edges) {
    let fields = byUri.get(e.fromUri);
    if (!fields) { fields = {}; byUri.set(e.fromUri, fields); }
    const fKey = `edge-out-${e.family}`;
    (fields[fKey] ??= []).push(e.toUri);
    if (e.role) {
      const frKey = `edge-out-${e.family}-${e.role}`;
      (fields[frKey] ??= []).push(e.toUri);
    }
  }
  const result = new Map<string, Record<string, string>>();
  for (const [uri, fields] of byUri) {
    const str: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) str[k] = v.join(" ");
    result.set(uri, str);
  }
  return result;
}

// ---------------------------------------------------------------------------
// LarariumTW5 — primary isomorphic TW5 interface
// ---------------------------------------------------------------------------

/**
 * A booted TW5 wiki seeded from lar:/// CRDT documents.
 *
 * Lifecycle:
 *   const ltw = new LarariumTW5();
 *   await ltw.boot();                         // one-time async boot (~10ms)
 *   ltw.loadClosure(closure, edges);          // load current lar:/// documents
 *   const titles = ltw.filterTiddlers("[all[memes]toml:register[CS]]");
 *   const entries = ltw.filterClosure(expr, closure);  // titles → ClosureEntry[]
 *
 * renderText / renderTiddler:
 *   After boot(), ltw.wiki.renderText("text/html", "text/vnd.tiddlywiki", wikitext)
 *   produces clean HTML. Use for MemeDetailPanel TW5 render mode.
 */
export class LarariumTW5 {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _tw: any = null;
  private _bootPromise: Promise<void> | null = null;
  private _loadedUris = new Set<string>();

  /**
   * Boot the TW5 wiki. Idempotent — multiple calls return the same promise.
   *
   * TW5 auto-detects its environment via typeof window !== "undefined".
   * We do NOT set $tw.browser = true manually — forcing it in Node causes
   * TW5 to execute browser code paths that reference window directly,
   * crashing the Node runtime. argv=[] is sufficient for in-memory boot.
   */
  boot(): Promise<void> {
    if (this._bootPromise) return this._bootPromise;
    this._bootPromise = new Promise<void>((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const instance = (tw as any).TiddlyWiki();
      instance.boot.argv = [];

      // Suppress TW5's boot banner (Node only — process.stdout is undefined in browser).
      let restoreStdout: (() => void) | null = null;
      if (typeof process !== "undefined" && process.stdout?.write) {
        const orig = process.stdout.write.bind(process.stdout);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.stdout as any).write = () => true;
        restoreStdout = () => { (process.stdout as any).write = orig; }; // eslint-disable-line
      }

      instance.boot.boot(() => {
        restoreStdout?.();
        this._tw = instance;
        resolve();
      });
    });
    return this._bootPromise;
  }

  /** True after boot() resolves. */
  get ready(): boolean { return this._tw !== null; }

  /**
   * The raw TW5 $tw instance. Available after boot().
   * Exposes the full TW5 API: $tw.wiki.filterTiddlers, $tw.wiki.renderText,
   * $tw.wiki.renderTiddler, $tw.wiki.addTiddler, etc.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get wiki(): any {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before accessing wiki");
    return this._tw.wiki;
  }

  /**
   * Load (or reload) the lar:/// closure into the wiki.
   * Removes tiddlers for URIs no longer in the closure.
   * Adds or updates tiddlers for all current entries.
   * Edge fields are added when edges are supplied.
   */
  loadClosure(closure: readonly ClosureEntry[], edges?: readonly EdgeRecord[]): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before loadClosure()");
    const edgeFieldMap = edges && edges.length > 0 ? buildEdgeFieldMap(edges) : null;
    const newUris = new Set(closure.map((e) => e.uri));

    for (const uri of this._loadedUris) {
      if (!newUris.has(uri)) this._tw.wiki.deleteTiddler(uri);
    }

    for (const entry of closure) {
      const extra = edgeFieldMap?.get(entry.uri);
      this._tw.wiki.addTiddler(new this._tw.Tiddler(entryToFields(entry, extra)));
    }

    this._loadedUris = newUris;
  }

  /**
   * Add or update a single tiddler by field map.
   * Use for TW5 plugin tiddlers and LarTiddlerStore-backed updates.
   */
  setTiddler(fields: Record<string, string | string[]>): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before setTiddler()");
    this._tw.wiki.addTiddler(new this._tw.Tiddler(fields));
  }

  /**
   * Remove a single tiddler by title.
   * Used by LarariumCrdtSyncAdaptor for tombstone propagation.
   */
  removeTiddler(title: string): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before removeTiddler()");
    this._tw.wiki.deleteTiddler(title);
  }

  /**
   * Run a wikitext-filter expression against the loaded tiddler store.
   * Returns raw title strings. Pre-processes the expression through
   * toCanonicalWikitext() before evaluation.
   */
  filterTiddlers(expr: string): string[] {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before filterTiddlers()");
    return this._tw.wiki.filterTiddlers(toCanonicalWikitext(expr));
  }

  /**
   * Run a wikitext-filter expression and map results back to ClosureEntry objects.
   * TW system tiddlers ($:/) are excluded automatically.
   */
  filterClosure(expr: string, closure: readonly ClosureEntry[]): ClosureEntry[] {
    const titles = this.filterTiddlers(expr);
    const byUri = new Map(closure.map((e) => [e.uri, e]));
    return titles.map((t) => byUri.get(t)).filter((e): e is ClosureEntry => e !== undefined);
  }

  /**
   * Render wikitext to HTML using TW5's native renderer.
   * Use for MemeDetailPanel TW5 render mode.
   * Returns an empty string before boot() resolves.
   */
  renderText(wikitext: string, type = "text/vnd.tiddlywiki"): string {
    if (!this._tw) return "";
    return this._tw.wiki.renderText("text/html", type, wikitext) as string;
  }

  /**
   * Render a loaded tiddler by title to HTML.
   * Returns an empty string if the title does not exist or boot() has not run.
   */
  renderTiddler(title: string): string {
    if (!this._tw) return "";
    return (this._tw.wiki.renderTiddler("text/html", title) as string | undefined) ?? "";
  }
}

// ---------------------------------------------------------------------------
// Singleton — for functional API and serve.ts / MCP call sites
// ---------------------------------------------------------------------------

let _singleton: LarariumTW5 | null = null;
let _singletonReady: Promise<LarariumTW5> | null = null;

async function getSingleton(): Promise<LarariumTW5> {
  if (_singleton?.ready) return _singleton;
  if (_singletonReady) return _singletonReady;
  _singletonReady = (async () => {
    _singleton = new LarariumTW5();
    await _singleton.boot();
    return _singleton;
  })();
  return _singletonReady;
}

// ---------------------------------------------------------------------------
// Functional API — stable surface for @lararium/node / MCP call sites
// ---------------------------------------------------------------------------

/**
 * Filter ClosureEntry objects using the wikitext-filter dialect.
 * Boots TW5 on first call (~10ms), then instant on subsequent calls.
 */
export async function filterMemesWikitext(
  allEntries: readonly ClosureEntry[],
  expr: string,
  edges?: readonly EdgeRecord[],
): Promise<ClosureEntry[]> {
  const inst = await getSingleton();
  inst.loadClosure(allEntries, edges);
  return inst.filterClosure(expr, allEntries);
}

/** Backward-compat alias — prefer filterMemesWikitext for new code. */
export const filterMemesTW = filterMemesWikitext;

/** Legacy browser alias — backward compat. */
export const filterMemesBrowser = filterMemesWikitext;

/**
 * Pre-compute multiple named filter results in a single boot cycle.
 * Used by the snapshot builder.
 */
export async function precomputeRooms(
  allEntries: readonly ClosureEntry[],
  rooms: Record<string, string>,
  edges?: readonly EdgeRecord[],
): Promise<Record<string, string[]>> {
  const inst = await getSingleton();
  inst.loadClosure(allEntries, edges);
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  const result: Record<string, string[]> = {};
  for (const [roomId, expr] of Object.entries(rooms)) {
    const titles = inst.filterTiddlers(expr);
    result[roomId] = titles.filter((t) => byUri.has(t));
  }
  return result;
}
