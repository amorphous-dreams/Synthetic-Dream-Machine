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

import type { ClosureEntry, EdgeRecord, FilterEngineFn, KumuDef, LarTiddlerStore, ReactionBinding } from "@lararium/core";
import { parsePranalaEdges, extractReactionBindings, ReactionGraph, collectKumuDefs } from "@lararium/core";
import { splitCarrierToTiddlers } from "./carrier-split.js";
import { createLarariumWidgets, registerImplementorsOperator, LARARIUM_WIDGETS_TIDDLER } from "./tw5-widgets.js";
import { UI_PRELOAD_TIDDLERS } from "./generated-ui-preloads.js";

// Re-export so callers can get FilterEngineFn from @lararium/tw5 directly.
export type { FilterEngineFn };

/**
 * TW5SyncAdaptor — minimal interface startSyncer() requires from an adaptor.
 *
 * Matches the subset of the TW5 SyncAdaptor contract that the isomorphic
 * syncer drives. Backends implement the full contract; startSyncer() only
 * needs these two write methods.
 */
export interface TW5SyncAdaptor {
  saveTiddler(tiddler: unknown, callback: (err: Error | null, adaptorInfo: unknown, revision: string) => void): void;
  deleteTiddler(title: string, callback: (err: Error | null) => void, options?: unknown): void;
}

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
    .replace(/\bimplements\[([\w:/.-]+)\]/g, "field:implements[$1]")
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
    tags:         entry.tags,
    implements:   entry.implements.join(" "),
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

      // UI preloads — ViewTemplate tab + iam-panel character sheet template.
      // Generated from lares/ha-ka-ba/api/v0.1/lararium/ui/ by scripts/write-ui-preloads.ts.
      // Must be present before first render so the Metadata tab appears immediately.
      for (const t of UI_PRELOAD_TIDDLERS) {
        instance.preloadTiddlers.push(t as Record<string, unknown>);
      }

      // Palette pointer — $:/palette is a TW5 system tiddler (can't be a lar: URI).
      // The actual palette data lives in lares/ha.ka.ba/api/v0.1/lararium/palette/
      // and arrives via the normal disk → Automerge → TW5 pipeline.
      // This pointer defaults to dark; setPalette() updates it on theme toggle.
      instance.preloadTiddlers.push({
        title: "$:/palette",
        text:  "lar:///ha.ka.ba/api/v0.1/lararium/palette/gruvbox-dark",
        tags:  [],
      });

      // -----------------------------------------------------------------------
      // No-op render startup — prevents TW5 from planting rootWidget in
      // document.body. mountPanel(container) calls rootWidget.render() instead.
      // -----------------------------------------------------------------------
      instance.preloadTiddlers.push({
        title:          "$:/core/modules/startup/render.js",
        type:           "application/javascript",
        "module-type":  "startup",
        text: `
exports.name = "render";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;
exports.startup = function() {
  // Lararium mounts rootWidget via mountPanel(). No render to document.body.
};
`,
      });

      // stylesheet.js startup left at default — it runs but targets document.head.
      // mountPanel() creates its own style widget scoped to the shadow root,
      // so panel styles never reach document.head. Canvas is unaffected.

      instance.boot.boot(() => {
        restoreStdout?.();
        this._tw = instance;
        // Inject parser + widget modules — corpus-gated path with imperative fallback.
        this._bootModules().then(resolve).catch(() => resolve());
      });
    });
    return this._bootPromise;
  }

  /**
   * Mount the full TW5 story river into a React-provided container element.
   *
   * Mirrors TW5's render.js startup — uses makeTranscludeWidget for both
   * the page (RootTemplate) and the stylesheet (PageStylesheet), so TW5's
   * full widget refresh cascade covers both. Styles are scoped to a shadow
   * root on the container so they cannot leak into the canvas or React tree.
   *
   * Safe to call once per container. Returns a cleanup function.
   * Requires boot() to have resolved.
   */
  mountPanel(container: HTMLElement): () => void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before mountPanel()");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = this._tw as any;

    // Shadow root — reuse if already attached (guard against double-mount).
    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });

    // ── Styles ────────────────────────────────────────────────────────────────
    // Mirrors TW5's render.js: makeTranscludeWidget("$:/core/ui/PageStylesheet")
    // into fakeDocument, then copy textContent into a real <style> in shadow root.
    const styleWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/PageStylesheet", {
      document:     tw.fakeDocument,
      parentWidget: tw.rootWidget,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const styleContainer: any = tw.fakeDocument.createElement("style");
    styleWidget.render(styleContainer, null);

    const styleEl = shadow.querySelector("#lar-tw5-styles") as HTMLStyleElement | null
      ?? (() => { const el = document.createElement("style"); el.id = "lar-tw5-styles"; shadow.insertBefore(el, shadow.firstChild); return el; })();
    styleEl.textContent = styleContainer.textContent ?? "";

    // ── Page ──────────────────────────────────────────────────────────────────
    // Mirrors TW5's render.js: makeTranscludeWidget("$:/core/ui/RootTemplate")
    // into real document, parented to rootWidget, rendered into inner div.
    const inner = shadow.querySelector(".tc-page-container-wrapper") as HTMLElement | null
      ?? (() => { const el = document.createElement("div"); el.className = "tc-page-container-wrapper"; shadow.appendChild(el); return el; })();

    const pageWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/RootTemplate", {
      document:         document,
      parentWidget:     tw.rootWidget,
      recursionMarker:  "no",
    });
    pageWidget.render(inner, null);

    // Wire rootWidget → pageWidget so TW5's internal bookkeeping is consistent.
    tw.rootWidget.domNodes = [inner];
    tw.rootWidget.children = [pageWidget];

    // ── Refresh cascade ───────────────────────────────────────────────────────
    const handler = (changes: Record<string, unknown>) => {
      if (styleWidget.refresh(changes, styleContainer, null)) {
        styleEl.textContent = styleContainer.textContent ?? "";
      }
      pageWidget.refresh(changes);
    };
    tw.wiki.addEventListener("change", handler);

    return () => {
      tw.wiki.removeEventListener("change", handler);
      // Remove page widget DOM nodes; leave shadow root intact for potential remount.
      pageWidget.domNodes?.forEach((n: Node) => n.parentNode?.removeChild(n));
    };
  }

  /**
   * Switch the active TW5 palette. Triggers stylesheet recompile automatically
   * via the wiki "change" event wired in the stylesheet startup.
   *
   * paletteName: "lar:///ha.ka.ba/api/v0.1/lararium/palette/gruvbox-dark" | "...gruvbox-light"
   */
  setPalette(paletteName: string): void {
    if (!this._tw) return;
    this._tw.wiki.addTiddler(new this._tw.Tiddler({ title: "$:/palette", text: paletteName, tags: [] }));
  }

  // ---------------------------------------------------------------------------
  // Module injection — three-layer capability gate with imperative fallback.
  //
  // Gate layers (all three must pass):
  //   1. Threshold  — mana ≥ 0.90, manao ≥ 0.85, manaoio ≥ 0.85, confidence ≥ 0.90
  //   2. Hash       — sha256(body) === fields["body-sha256"] (set at build time)
  //   3. Ceremony   — fields["promoted-at"] present (set by /admin/promote)
  //
  // Falls back to imperative registration if no memes pass all three layers.
  // Memes that fail any layer never receive the $tw.wiki reference.
  // ---------------------------------------------------------------------------

  private static readonly MODULE_MANA_THRESHOLD       = 0.90;
  private static readonly MODULE_MANAO_THRESHOLD      = 0.85;
  private static readonly MODULE_MANAOIO_THRESHOLD    = 0.85;
  private static readonly MODULE_CONFIDENCE_THRESHOLD = 0.90;
  private static readonly MODULE_INTERFACE_URI =
    "lar:///ha.ka.ba/api/v0.1/lararium/tw5-module";

  private async _bootModules(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tw = this._tw as any;
    const wiki = tw?.wiki;

    // --- Corpus-gated path ---------------------------------------------------
    // Register implementors filter operator first so the query below works.
    // Safe to call before corpus load — only needs tw.filterOperators map.
    registerImplementorsOperator(tw);

    let injected = 0;
    try {
      const iface = LarariumTW5.MODULE_INTERFACE_URI;
      const titles: string[] = wiki.filterTiddlers(
        `[all[tiddlers]implementors[${iface}]]`
      ) ?? [];
      for (const title of titles) {
        const t = wiki.getTiddler(title);
        if (!t) continue;
        const f = t.fields as Record<string, string>;

        // Layer 1 — threshold
        const mana       = parseFloat(f["mana"]       ?? "0");
        const manao      = parseFloat(f["manao"]      ?? "0");
        const manaoio    = parseFloat(f["manaoio"]    ?? "0");
        const confidence = parseFloat(f["confidence"] ?? "0");
        if (
          mana       < LarariumTW5.MODULE_MANA_THRESHOLD       ||
          manao      < LarariumTW5.MODULE_MANAO_THRESHOLD       ||
          manaoio    < LarariumTW5.MODULE_MANAOIO_THRESHOLD     ||
          confidence < LarariumTW5.MODULE_CONFIDENCE_THRESHOLD
        ) continue;

        const body = f["text"] ?? "";
        if (!body.trim() || body.startsWith("// Body injected")) continue;

        // Layer 2 — content hash
        const claimedHash = f["body-sha256"] ?? "";
        if (!claimedHash || !(await LarariumTW5._verifySha256(body, claimedHash))) continue;

        // Layer 3 — ceremony stamp
        if (!f["promoted-at"]) continue;

        // All three layers passed — hand $tw.wiki to this meme.
        wiki.addTiddler(new tw.Tiddler({
          title,
          type:           "application/javascript",
          "module-type":  f["module-type"] ?? "library",
          text:           body,
          tags:           [],
        }));
        injected++;
      }
    } catch { /* filter unavailable — fall through to imperative path */ }

    if (injected > 0) {
      try {
        const moduleText = wiki.getTiddler(
          "lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-modules"
        )?.fields?.["text"] ?? "";
        tw.modules.define(moduleText, "library", "lararium-tw5-modules");
      } catch { /* no-op */ }
      return;
    }

    // --- Imperative fallback -------------------------------------------------
    // No corpus module memes passed the threshold. Register directly from the
    // compiled-in classes. This path is permanent for offline/cold-boot and
    // during the transition before pnpm bundle has run.
    // implementors operator already registered above; no-op to call again.
    const parsers: Record<string, unknown> = tw?.Wiki?.parsers ?? {};
    import("./memetic-parser.js").then(({ MemeticParser }) => {
      parsers["text/x-memetic-wikitext"] = MemeticParser;
    }).catch(() => { /* not critical */ });

    const WidgetCtor: any =
      tw.modules?.types?.widget?.["$:/core/modules/widgets/widget.js"]?.exports?.widget;
    if (!WidgetCtor) return;
    if (!WidgetCtor.prototype.widgetClasses) {
      tw.modules.applyMethods("widget", {});
    }
    const widgetClasses = createLarariumWidgets(tw);
    for (const [name, cls] of Object.entries(widgetClasses)) {
      Object.setPrototypeOf((cls as { prototype: object }).prototype, WidgetCtor.prototype);
      WidgetCtor.prototype.widgetClasses ??= {};
      WidgetCtor.prototype.widgetClasses[name] = cls;
    }
  }

  // SHA-256 of body text, compared against the claimed hex digest in #iam.
  // Uses globalThis.crypto.subtle (Node 19+ and all modern browsers, no imports).
  // Returns false if subtle is unavailable — causing graceful fallback to the
  // imperative path rather than injecting unverified code.
  private static async _verifySha256(body: string, claimedHex: string): Promise<boolean> {
    try {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) return false;
      const buf    = await subtle.digest("SHA-256", new TextEncoder().encode(body));
      const actual = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return actual === claimedHex;
    } catch {
      return false;
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
  // renderCarrierVDom removed — TW5 panel (mountPanel) and canvas fakeDOM
  // widgets own rendering. Ephemeral VDom pipeline superseded.

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

  /** Render raw TW5 wikitext to HTML. Returns "" before boot or on render failure. */
  renderText(text: string): string {
    if (!this._tw) return "";
    try {
      return this._tw.wiki.renderText("text/html", "text/vnd.tiddlywiki", text) ?? "";
    } catch {
      return "";
    }
  }

  /** Render a loaded TW5 tiddler to HTML. Returns "" for unknown titles or failures. */
  renderTiddler(title: string): string {
    if (!this._tw) return "";
    if (!this._tw.wiki.getTiddler(title)) return "";
    try {
      return this._tw.wiki.renderTiddler("text/html", title) ?? "";
    } catch {
      return "";
    }
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
  async loadFromStore(
    store: LarTiddlerStore,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before loadFromStore()");
    const uris = await store.listVisible();
    const kumuDefs: KumuDef[] = [];
    const total = uris.length;
    let loaded = 0;

    await Promise.all(uris.map(async (uri) => {
      const rec = await store.get(uri);
      if (!rec || rec.deleted) { loaded++; onProgress?.(loaded, total); return; }

      if (rec.text && (rec.fields["content-type"] === "text/x-memetic-wikitext" || !rec.fields["content-type"])) {
        // Carrier text — split into parent tiddler + ahu child tiddlers.
        const split = splitCarrierToTiddlers(uri, rec.text);
        const parentFields: Record<string, string | string[]> = {
          title: rec.title,
          ...rec.fields,          // store-level fields (revision, bag, etc.)
          ...split.parent.fields, // #iam-derived fields win over store metadata
          text: rec.text,         // raw carrier text kept for MemeticParser
        };
        this._tw.wiki.addTiddler(new this._tw.Tiddler(parentFields));
        for (const child of split.children) {
          this._tw.wiki.addTiddler(new this._tw.Tiddler({ ...child.fields, title: child.title, text: child.text }));
        }
        if (split.warnings.length > 0) {
          console.warn(`[lararium] carrier parse warnings for ${uri}:`, split.warnings);
        }
        // Collect kumu defs from the parsed AST. This is a secondary index; a
        // malformed carrier should still appear in TW5 as a raw parent tiddler
        // via splitCarrierToTiddlers()' graceful fallback.
        try {
          const { parseMemeCarrier } = await import("@lararium/core");
          const ast = parseMemeCarrier(uri, rec.text);
          kumuDefs.push(...collectKumuDefs(uri, ast));
        } catch (e) {
          console.warn(`[lararium] skipping kumu extraction for malformed carrier ${uri}:`, e);
        }
      } else {
        // Non-carrier tiddler (text/plain palette, etc.) — load fields as-is.
        const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
        if (rec.text !== undefined) fields["text"] = rec.text;
        this._tw.wiki.addTiddler(new this._tw.Tiddler(fields));
      }

      loaded++;
      onProgress?.(loaded, total);
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
   * Start an async syncer bound to a TW5SyncAdaptor implementation.
   *
   * This is the isomorphic TW5 syncer — it replaces $tw.syncer for the
   * local-first model where the adaptor backend varies by context:
   *   browser → LarariumCrdtSyncAdaptor (TW5 ↔ Automerge IndexedDB)
   *   server  → LarDiskSyncAdaptor      (TW5 ↔ lares/ files)
   *
   * Drives the TW5 → adaptor write direction:
   *   wiki change event fires
   *   → non-system tiddler added/updated → adaptor.saveTiddler(tiddler)
   *   → non-system tiddler deleted       → adaptor.deleteTiddler(title)
   *
   * The adaptor owns the reverse direction (adaptor → TW5) via its own
   * subscription mechanism (e.g. store.subscribe in LarariumCrdtSyncAdaptor).
   * The adaptor's echo-loop guard (_applying flag) prevents re-entrant writes
   * when a change originated from the adaptor itself.
   *
   * Returns a stop function. Call it to unsubscribe and halt the syncer.
   */
  startSyncer(adaptor: TW5SyncAdaptor): () => void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before startSyncer()");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wiki = this._tw.wiki as any;

    // All Lararium memes have `lar:` URI titles — system tiddlers use `$:` and
    // are TW5-internal. Only sync lar: titles; everything else is TW5 housekeeping.
    return this.onWikiChange((changes) => {
      for (const title of Object.keys(changes)) {
        if (!title.startsWith("lar:")) continue;

        const tiddler = wiki.getTiddler?.(title);
        if (tiddler) {
          adaptor.saveTiddler(tiddler, () => { /* fire-and-forget */ });
        } else {
          adaptor.deleteTiddler(title, () => { /* fire-and-forget */ });
        }
      }
    });
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
  /** Parse reaction bindings for a single URI from its current tiddler text. */
  bindingsForUri(uri: string): ReactionBinding[] {
    if (!this._tw) return [];
    const text: string | undefined = this._tw.wiki.getTiddlerText(uri);
    if (!text) return [];
    try {
      const edges = parsePranalaEdges(uri, text);
      return extractReactionBindings(
        edges.map((e) => ({
          fromUri: e.fromUri, toUri: e.toUri,
          family:  e.family,  role:  e.role,
          payload: (e as unknown as { payload?: Record<string, unknown> }).payload ?? {},
        }))
      );
    } catch { return []; }
  }

  /**
   * Build a full ReactionGraph from all tiddlers.
   * Use once at boot to populate the graph; after that prefer
   * graph.updateUri(uri, tw5.bindingsForUri(uri)) on wiki changes.
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

  /** Read zoom-level layout props from a kumu def tiddler (`lar:///kumu/meme-<level>`). */
  getZoomLayout(level: string): ZoomLayout | null {
    if (!this._tw) return null;
    const text: string | undefined = this._tw.wiki.getTiddlerText(`lar:///kumu/meme-${level}`);
    if (!text) return null;
    return parseZoomLayoutTOML(text);
  }
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
