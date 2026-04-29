/**
 * lararium-tw5 — TW5 as the active isomorphic render engine for Lararium.
 * Home: @lararium/tw5
 *
 * Model: local-first async quine-wiki on a tldraw canvas.
 *   Automerge (AutomergeMemeStore) is the source of truth for carrier text.
 *   TW5 is the active render engine: parseTree → widgetTree → fakeDOM → VDomNode[].
 *   tldraw is the canvas shell: layout, navigation, CRDT shape sync.
 *   The three are independent stores; content flows through renderMeme().
 *
 * Three-tree pipeline:
 *   MemeticParser  →  TW5ParseNode[]  (lararium-* tagged nodes)
 *   TW5 makeWidget →  Widget instances (internal TW5 widgetTree, lararium-* classes)
 *   render()       →  TW_Element tree  →  VDomNode[]  →  React
 *
 * wikitext-filter dialect (toCanonicalWikitext):
 *   all[memes]         → all[tiddlers]
 *   toml:key[value]    → field:key[value]
 *   edge:FAMILY[ROLE]  → has[edge-out-FAMILY-ROLE]
 *   edge:FAMILY[]      → has[edge-out-FAMILY]
 *
 * ClosureEntry → tiddler field mapping (entryToFields):
 *   title uri / tags implements / depth / rating (kind) / confidence / register
 *   manaoio / mana / manao / role / exists / laresRelPath / contentHash
 *   edge-out-FAMILY / edge-out-FAMILY-ROLE  (space-separated toUri lists)
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — tiddlywiki is CJS; Node ESM interop and Vite CJS→ESM both expose
// module.exports as the default export, giving us { TiddlyWiki: [Function] }.
import tw from "tiddlywiki";

import type { ClosureEntry, EdgeRecord, FilterEngineFn, KumuDef, LarTiddlerStore } from "@lararium/core";
import { parsePranalaEdges, extractReactionBindings, ReactionGraph, collectKumuDefs } from "@lararium/core";
import { createLarariumWidgets, LARARIUM_WIDGETS_TIDDLER } from "./tw5-widgets.js";
import { parseCarrierToTw5 } from "./memetic-parser.js";
import type { TW5ParseNode } from "./memetic-parser.js";
import { tw5ElementToVdom } from "./fake-dom.js";
import type { VDomNode } from "./fake-dom.js";

// Re-export so callers can get FilterEngineFn from @lararium/tw5 directly.
export type { FilterEngineFn };

// ---------------------------------------------------------------------------
// ZoomLayout — tldraw canvas layout props for a zoom level, read from kumu def TOML
// ---------------------------------------------------------------------------

export interface ZoomLayout {
  w:           number;
  h:           number;
  color:       string;
  includeAhu:  boolean;
  showCarrier: boolean;
  opacity:     number;
}

function parseZoomLayoutTOML(text: string): ZoomLayout | null {
  // Find a TOML block inside the carrier text (<<~ iam >> or <<~ toml >>).
  const m = /```toml\n([\s\S]*?)```|<<~\s*(?:iam|toml)\s*>>([\s\S]*?)<<~\/(?:iam|toml)\s*>>/i.exec(text);
  const toml = m ? (m[1] ?? m[2] ?? "") : text; // fall back to treating whole text as TOML

  const get = (key: string): string | undefined => {
    const r = new RegExp(`^${key}\\s*=\\s*(.+)$`, "m").exec(toml);
    return r ? r[1]!.trim().replace(/^["']|["']$/g, "") : undefined;
  };
  const num  = (k: string, d: number): number  => { const v = get(k); return v ? (parseFloat(v) || d) : d; };
  const bool = (k: string, d: boolean): boolean => { const v = get(k); return v !== undefined ? v === "true" : d; };

  // If none of the layout keys are present, return null — not a layout tiddler.
  if (!get("w") && !get("h") && !get("color")) return null;

  return {
    w:           num("w",             220),
    h:           num("h",             100),
    color:       get("color")      ?? "rating",
    includeAhu:  bool("include-ahu",  false),
    showCarrier: bool("show-carrier", false),
    opacity:     num("opacity",       1.0),
  };
}

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

      // Suppress TW5's boot banner (Node only — globalThis.process is undefined in browser).
      let restoreStdout: (() => void) | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const proc = (globalThis as any).process;
      if (proc?.stdout?.write) {
        const orig = proc.stdout.write.bind(proc.stdout);
        proc.stdout.write = () => true;
        restoreStdout = () => { proc.stdout.write = orig; };
      }

      // Pre-load plugin tiddlers before boot so TW5 discovers them at startup.
      instance.preloadTiddlers = instance.preloadTiddlers ?? [];
      // Widget module marker — prototype chain wired by _registerWidgets() after boot.
      instance.preloadTiddlers.push(LARARIUM_WIDGETS_TIDDLER);
      // Content-type config — maps text/x-memetic-wikitext to our parser in TW5's MIME registry.
      instance.preloadTiddlers.push({
        title: "$:/config/FileTypeMappings/text/x-memetic-wikitext",
        text:  "text/x-memetic-wikitext",
        tags:  [],
      });
      // Kumu def tag shadow — gives [[all[shadows]tag[$:/tags/LarariumKumu]]] a stable home.
      instance.preloadTiddlers.push({
        title: "$:/tags/LarariumKumu",
        text:  "Lararium kumu device type definitions.",
        tags:  ["$:/tags/Global"],
      });

      instance.boot.boot(() => {
        restoreStdout?.();
        this._tw = instance;
        // Register content-type parser + widget classes synchronously after boot.
        this._registerMemeticParser();
        this._registerWidgets();
        resolve();
      });
    });
    return this._bootPromise;
  }

  /**
   * Register MemeticParser into TW5's parser registry for text/x-memetic-wikitext.
   * Called automatically after boot(). Safe to call again to re-register.
   */
  private _registerMemeticParser(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsers: Record<string, unknown> = (this._tw as any)?.Wiki?.parsers ?? {};
    import("./memetic-parser.js").then(({ MemeticParser }) => {
      parsers["text/x-memetic-wikitext"] = MemeticParser;
    }).catch(() => { /* parser not critical for boot */ });
  }

  /**
   * Register lararium-* widget classes into Widget.prototype.widgetClasses.
   * Called synchronously in the boot callback — no async required.
   *
   * Widget base class: $:/core/modules/widgets/widget.js → exports.widget
   * widgetClasses is lazily built by applyMethods("widget") on first render.
   * We trigger it once here so our patch sticks on the singleton map.
   */
  private _registerWidgets(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = this._tw as any;

    // Get the canonical Widget base class.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const WidgetCtor: any =
      tw.modules?.types?.widget?.["$:/core/modules/widgets/widget.js"]?.exports?.widget;
    if (!WidgetCtor) return;

    // Trigger lazy widgetClasses population so we can patch the singleton.
    if (!WidgetCtor.prototype.widgetClasses) {
      tw.modules.applyMethods("widget", {});
    }

    const widgetClasses = createLarariumWidgets(tw);

    for (const [name, cls] of Object.entries(widgetClasses)) {
      // Wire prototype chain so renderChildren / makeChildWidgets / initialise work.
      Object.setPrototypeOf(
        (cls as { prototype: object }).prototype,
        WidgetCtor.prototype,
      );
      // Patch the singleton widgetClasses map directly — picked up by makeChildWidgets.
      WidgetCtor.prototype.widgetClasses ??= {};
      WidgetCtor.prototype.widgetClasses[name] = cls;
    }
  }

  /**
   * Render a carrier document through the full TW5 widget pipeline.
   *
   * Flow:
   *   parseMemeCarrier → TW5ParseNode[] → TW5 widget tree → $tw.fakeDocument
   *   → TW_Element tree → VDomNode[] (via tw5ElementToVdom)
   *
   * The TW5 widget pipeline fires through our lararium-* widget classes,
   * so worksite boundaries become <span data-lar-slot="..."> nodes in the output.
   *
   * Requires boot() to have resolved.
   */
  renderCarrierVDom(uri: string, text: string): VDomNode[] {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before renderCarrierVDom()");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = this._tw as any;
    const parseTree = { tree: parseCarrierToTw5(uri, text) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const container: any = tw.fakeDocument.createElement("div");
    container.setAttribute("data-lar-uri", uri);
    tw.wiki.makeWidget(parseTree, { document: tw.fakeDocument }).render(container, null);
    return tw5ElementToVdom(container);
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
   * Inject kumu device type definitions as TW5 tiddlers.
   *
   * Each KumuDef becomes a tiddler with:
   *   title:  lar:///kumu/<name>  (stable URI, addressable by TW5 filter)
   *   type:   text/x-memetic-wikitext
   *   tags:   $:/tags/LarariumKumu
   *   text:   the kumu carrier body (params + body nodes serialised as wikitext)
   *
   * KumuWidget.render() resolves defs by calling this.wiki.getTiddler(name) so
   * TW5 is the single registry — no parallel KumuRegistry class needed.
   *
   * Call after boot() and before any renderMeme() that uses kumu instances.
   * loadClosure() does NOT call this automatically — kumu defs arrive via the
   * compiler artifact (BootArtifact.kumuDefs), not the tiddler closure.
   */
  injectKumuDefs(defs: readonly KumuDef[]): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before injectKumuDefs()");
    for (const def of defs) {
      this._tw.wiki.addTiddler(new this._tw.Tiddler({
        title:  `lar:///kumu/${def.name}`,
        type:   "text/x-memetic-wikitext",
        tags:   ["$:/tags/LarariumKumu"],
        text:   def.body.map((n) => ("content" in n ? (n as { content: string }).content : "")).join("\n"),
        // Structured fields for filter queries: [[$:/tags/LarariumKumu]has[kumu-name]]
        "kumu-name":       def.name,
        "kumu-params":     def.params.join(" "),
        "kumu-source-uri": def.carrierUri,
      }));
    }
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
   * One-time initial population of the TW5 wiki from a LarTiddlerStore.
   *
   * Call once after boot() and after the store reaches store-ready phase.
   * The LarariumCrdtSyncAdaptor keeps TW5 live after this — do NOT call
   * loadClosure() on every filter request (that wipes all tiddlers).
   *
   * Also scans carrier texts for kumu defs and injects them via injectKumuDefs().
   */
  async loadFromStore(store: LarTiddlerStore): Promise<void> {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before loadFromStore()");
    const uris = await store.listVisible();
    const kumuDefs: KumuDef[] = [];

    await Promise.all(uris.map(async (uri) => {
      const rec = await store.get(uri);
      if (!rec || rec.deleted) return;
      const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
      if (rec.text !== undefined) fields["text"] = rec.text;
      this._tw.wiki.addTiddler(new this._tw.Tiddler(fields));
      if (rec.text) {
        const { parseMemeCarrier } = await import("@lararium/core");
        const ast = parseMemeCarrier(uri, rec.text);
        kumuDefs.push(...collectKumuDefs(uri, ast));
      }
    }));

    this._loadedUris = new Set(uris);
    if (kumuDefs.length > 0) this.injectKumuDefs(kumuDefs);
  }

  /**
   * Subscribe to TW5 wiki change events.
   *
   * The callback fires whenever tiddlers are added, updated, or deleted in the
   * TW5 wiki — including changes applied by LarariumCrdtSyncAdaptor. Use to
   * rebuild derived state (ReactionGraph, kumu def index) reactively.
   *
   * Returns an unsubscribe function. Call it on component unmount.
   */
  onWikiChange(cb: (changes: Record<string, unknown>) => void): () => void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before onWikiChange()");
    const wiki = this._tw.wiki;
    // TW5 wiki emits "change" with a map of modified titles → change descriptor.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (changes: any) => cb(changes as Record<string, unknown>);
    wiki.addEventListener("change", handler);
    return () => wiki.removeEventListener("change", handler);
  }

  /**
   * Build a ReactionGraph from all pranala edges currently in the TW5 wiki.
   *
   * Reads carrier text for every non-system tiddler via getTiddlerText(),
   * parses papalohe/reaction edges, and loads them into a fresh ReactionGraph.
   * Cheap enough to call on every wiki change event (no Automerge round-trip).
   *
   * Returns null if TW5 is not yet booted.
   */
  buildReactionGraph(): ReactionGraph | null {
    if (!this._tw) return null;
    const wiki = this._tw.wiki;
    const titles: string[] = wiki.filterTiddlers("[all[tiddlers]!prefix[$:/]]");
    const allEdges: { fromUri: string; toUri: string; family: string; role: string | null; payload: Record<string, unknown> }[] = [];

    for (const uri of titles) {
      const text: string | undefined = wiki.getTiddlerText(uri);
      if (!text) continue;
      try {
        const edges = parsePranalaEdges(uri, text);
        for (const e of edges) {
          allEdges.push({
            fromUri: e.fromUri, toUri: e.toUri,
            family: e.family, role: e.role,
            payload: (e as unknown as { payload?: Record<string, unknown> }).payload ?? {},
          });
        }
      } catch { /* malformed carrier — skip */ }
    }

    const g = new ReactionGraph();
    g.load(extractReactionBindings(allEdges));
    return g;
  }

  /**
   * Render wikitext to HTML using TW5's native renderer.
   * Use for MemeDetailPanel TW5 render mode.
   * Returns an empty string before boot() resolves.
   */
  /**
   * Read zoom-level layout props from a kumu def tiddler (`lar:///kumu/meme-<level>`).
   *
   * The kumu def body may contain a TOML block with layout keys:
   *   w, h, color, include-ahu, show-carrier, opacity
   *
   * Returns null when TW5 is not booted or the tiddler has no TOML block.
   * Callers (applyZoomTemplate) fall back to their own hardcoded defaults.
   */
  getZoomLayout(level: string): ZoomLayout | null {
    if (!this._tw) return null;
    const text: string | undefined = this._tw.wiki.getTiddlerText(`lar:///kumu/meme-${level}`);
    if (!text) return null;
    return parseZoomLayoutTOML(text);
  }

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

  /**
   * Inject cascade rules as shadow tiddlers in the TW5 wiki.
   *
   * Each rule becomes a `$:/lararium/cascade/<n>` shadow tiddler with:
   *   filter   — wikitext-filter expression (evaluated by wiki.filterTiddlers)
   *   template — tiddler title of the view template to apply on match
   *   priority — rule index (lower = higher priority, first match wins)
   *
   * Call at boot after boot(), before renderMeme() is invoked.
   * Rules are evaluated by resolveCascadeTemplate() using native TW5 filter evaluation.
   */
  injectCascadeRules(rules: readonly { filter: string; template: string }[]): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before injectCascadeRules()");
    for (let i = 0; i < rules.length; i++) {
      this._tw.wiki.addTiddler(new this._tw.Tiddler({
        title:    `$:/lararium/cascade/${i}`,
        tags:     ["$:/tags/LarariumCascade"],
        filter:   rules[i]!.filter,
        template: rules[i]!.template,
        priority: String(i),
      }));
    }
  }

  /**
   * Resolve which view template applies to a given meme URI.
   *
   * Evaluates cascade rules (shadow tiddlers tagged $:/tags/LarariumCascade,
   * sorted by priority) against the current wiki state using native
   * wiki.filterTiddlers(). First matching rule wins — TW5 cascade semantics.
   *
   * Returns the template tiddler title, or null if no rule matches.
   * Callers fall back to AST-derived view classification when null.
   */
  resolveCascadeTemplate(uri: string): string | null {
    if (!this._tw) return null;
    const wiki = this._tw.wiki;
    const rules: string[] = wiki.filterTiddlers(
      "[all[shadows+tiddlers]tag[$:/tags/LarariumCascade]sort[priority]]"
    );
    for (const ruleTitle of rules) {
      const tiddler = wiki.getTiddler(ruleTitle);
      if (!tiddler) continue;
      const filterExpr: string = tiddler.fields["filter"] as string ?? "";
      if (!filterExpr) continue;
      // Scope the filter to just this URI: add a title-exact prefix so the
      // expression is evaluated with the meme as the current tiddler context.
      const scoped = `[[${uri}]${toCanonicalWikitext(filterExpr)}]`;
      const matched: string[] = wiki.filterTiddlers(scoped);
      if (matched.includes(uri)) {
        return (tiddler.fields["template"] as string | undefined) ?? null;
      }
    }
    return null;
  }

  /**
   * renderMeme — ViewTemplate cascade for a single meme URI.
   *
   * Cascade pipeline (TW5-native):
   *   resolveCascadeTemplate(uri) → template tiddler title (from $:/tags/LarariumCascade rules)
   *   If a template tiddler is found, renderTiddler(template) → VDomNode[]
   *   Otherwise: AST-derived view classification → renderCarrierVDom(uri, text) → VDomNode[]
   *
   * View kinds (for callers to branch on):
   *   "kumu-view"     — carrier contains kumu device instances
   *   "reaction-view" — carrier contains papalohe wires only
   *   "meme-view"     — standard meme prose / worksite content (default)
   *   "cascade-view"  — view selected by an injected cascade rule
   *
   * Cascade results flow: wiki filterTiddlers → template render → VDomNode[] → canvas.
   * No tldraw shape-meta stamping involved.
   */
  renderMeme(uri: string, text: string): {
    view: "kumu-view" | "reaction-view" | "meme-view" | "cascade-view";
    vdom: VDomNode[];
    kumuInstances: { name: string; props: string; el: unknown }[];
  } {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before renderMeme()");
    const wiki = this._tw.wiki as { _larKumuInstances?: { name: string; props: string; el: unknown }[] };

    // Clear instance accumulator before render so each call gets a clean slate.
    wiki._larKumuInstances = [];

    // Check cascade rules first — TW5 shadow tiddler filter evaluation.
    const cascadeTemplate = this.resolveCascadeTemplate(uri);
    if (cascadeTemplate) {
      const vdom = this._renderTiddlerVDom(cascadeTemplate);
      const kumuInstances = wiki._larKumuInstances ?? [];
      wiki._larKumuInstances = [];
      return { view: "cascade-view", vdom, kumuInstances };
    }

    // AST-derived view classification (no cascade rule matched).
    const tw5Tree = parseCarrierToTw5(uri, text);
    const hasKumu     = tw5Tree.some((n) => containsType(n, "lararium-kumu"));
    const hasPapalohe = tw5Tree.some((n) => containsType(n, "lararium-papalohe"));
    const view = hasKumu ? "kumu-view" : hasPapalohe ? "reaction-view" : "meme-view";

    // TW5 widget pipeline: parseTree → widgetTree (KumuWidget.render records instances)
    // → fakeDOM → VDomNode[]
    const vdom = this.renderCarrierVDom(uri, text);

    // Harvest kumu instances recorded by KumuWidget during render.
    const kumuInstances = wiki._larKumuInstances ?? [];
    wiki._larKumuInstances = [];

    return { view, vdom, kumuInstances };
  }

  /** Render a tiddler by title through the fakeDOM pipeline → VDomNode[]. */
  private _renderTiddlerVDom(title: string): VDomNode[] {
    if (!this._tw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = this._tw as any;
    const tiddler = tw.wiki.getTiddler(title);
    if (!tiddler) return [];
    const parseTree = tw.wiki.parseTiddler(title);
    if (!parseTree) return [];
    const container = tw.fakeDocument.createElement("div");
    container.setAttribute("data-lar-cascade-template", title);
    tw.wiki.makeWidget(parseTree, { document: tw.fakeDocument }).render(container, null);
    return tw5ElementToVdom(container);
  }
}

function containsType(node: TW5ParseNode, type: string): boolean {
  if (node.type === type) return true;
  return (node.children ?? []).some((c: TW5ParseNode) => containsType(c, type));
}

// ---------------------------------------------------------------------------
// Server-side process singleton — used ONLY by the functional filter API.
//
// NEVER import or call getServerSingleton() from browser code. Each room (collaboration
// space) must own its own LarariumTW5 instance: new LarariumTW5() → boot() →
// injectKumuDefs() → loadClosure(). The singleton exists only so that Node.js
// CLI tools (MCP, serve.ts filter calls) don't re-boot TW5 on every invocation.
// ---------------------------------------------------------------------------

let _serverSingleton: LarariumTW5 | null = null;
let _serverSingletonReady: Promise<LarariumTW5> | null = null;

async function getServerSingleton(): Promise<LarariumTW5> {
  if (typeof window !== "undefined") {
    throw new Error(
      "LarariumTW5 getServerSingleton() called in browser context. " +
      "Use new LarariumTW5() scoped to the room instead.",
    );
  }
  if (_serverSingleton?.ready) return _serverSingleton;
  if (_serverSingletonReady) return _serverSingletonReady;
  _serverSingletonReady = (async () => {
    _serverSingleton = new LarariumTW5();
    await _serverSingleton.boot();
    return _serverSingleton;
  })();
  return _serverSingletonReady;
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
  const inst = await getServerSingleton();
  inst.loadClosure(allEntries, edges);
  return inst.filterClosure(expr, allEntries);
}


/**
 * Pre-compute multiple named filter results in a single boot cycle.
 * Used by the snapshot builder.
 */
export async function precomputeRooms(
  allEntries: readonly ClosureEntry[],
  rooms: Record<string, string>,
  edges?: readonly EdgeRecord[],
): Promise<Record<string, string[]>> {
  const inst = await getServerSingleton();
  inst.loadClosure(allEntries, edges);
  const byUri = new Map(allEntries.map((e) => [e.uri, e]));
  const result: Record<string, string[]> = {};
  for (const [roomId, expr] of Object.entries(rooms)) {
    const titles = inst.filterTiddlers(expr);
    result[roomId] = titles.filter((title: string) => byUri.has(title));
  }
  return result;
}
