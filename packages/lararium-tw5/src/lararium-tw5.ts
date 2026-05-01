/**
 * lararium-tw5 — TW5 as the isomorphic wiki engine for Lararium (client + server peer).
 * Home: @lararium/tw5
 *
 * Model: local-first. Automerge is source of truth. TW5 is the wiki engine on both
 * client and server. Server is a sync peer, not an authority.
 *
 * Boot sequence:
 *   boot() → preloadTiddlers (UI, palette, system) → TW5 boot callback
 *          → _bootModules() [safety gate: threshold → body-sha256]
 *          → fallback: imperative registration of MemeticParser + lararium-* widgets
 *
 * Content pipeline (TW5 story river path):
 *   MemeticParser  →  TW5ParseNode[]  (lararium-* tagged nodes)
 *   TW5 makeWidget →  Widget instances (lararium-* widget classes)
 *   mountPanel()   →  shadow DOM render (scoped styles, no document.body leak)
 *
 * Filter extensions:
 *   implementors[uri]  — exact token match on space-separated implements field
 *
 * ClosureEntry → tiddler field mapping (entryToFields):
 *   title uri / tags implements / depth / rating (kind) / confidence / register
 *   manaoio / mana / manao / role / exists / laresRelPath / contentHash
 *   edge-out-FAMILY / edge-out-FAMILY-ROLE  (space-separated toUri lists)
 */

import type { ClosureEntry, EdgeRecord, FilterEngineFn, LarTiddlerStore } from "@lararium/core";
import type { TW5Instance, TW5Wiki, TW5FakeElement, TW5ChangeRecord, TW5TiddlerFields, TW5WidgetConstructor } from "./types/tiddlywiki.js";
import { MemeStreamParser } from "@lararium/core";
import { splitCarrierToTiddlers, streamEventsToTiddlers, type TiddlerFields } from "./carrier-codec.js";
import { createLarariumWidgets, registerImplementorsOperator, LARARIUM_WIDGETS_TIDDLER } from "./tw5-widgets.js";
import { loadUiTiddlers, loadVendorTiddlers } from "./lares-preloads.js";
import { entryToFields, buildEdgeFieldMap } from "./closure-fields.js";
import { ZoomLayout, getZoomLayout } from "./zoom-layout.js";
import { bindingsForUri, buildReactionGraph } from "./reaction-query.js";

export type { ZoomLayout };

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

async function loadNodeTiddlyWiki(): Promise<{ TiddlyWiki: () => unknown }> {
  // Browser uses the vendored public/tiddlywikicore-*.js script and global $tw.
  // Keep the npm tiddlywiki package out of browser analysis/bundles.
  // @ts-ignore — tiddlywiki has no local ESM declaration; Node path only.
  const mod = await import(/* @vite-ignore */ "tiddlywiki");
  return ((mod as { default?: unknown }).default ?? mod) as { TiddlyWiki: () => unknown };
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
 *   produces clean HTML. Use for WikiCommandPalette TW5 render mode.
 */
export class LarariumTW5 {
  private _tw: TW5Instance | null = null;
  private _bootPromise: Promise<void> | null = null;
  private _loadedUris = new Set<string>();

  /**
   * Boot the TW5 wiki. Idempotent — multiple calls return the same promise.
   *
   * Isomorphic boot path (Jeremy Ruston lambda pattern):
   *   1. In browser: $tw.browser is auto-detected as truthy (window/document exist).
   *      The vendored tiddlywikicore-<ver>.js script has already populated
   *      $tw.modules; Lararium reuses that VM and never imports npm tiddlywiki
   *      in the browser bundle.
   *   2. In Node: $tw.node is auto-detected. TW5 reads core modules from
   *      $tw.boot.bootPath via fs. Core module tiddlers are redundant but harmless.
   *
   * Do NOT force $tw.browser = true in code — bootprefix.js detects it correctly
   * via typeof window/document. Forcing it in Node crashes the runtime.
   */
  boot(): Promise<void> {
    if (this._bootPromise) return this._bootPromise;
    this._bootPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;

      // Isomorphic boot split:
      //   Browser — tiddlywikicore-<ver>.js is loaded as a <script> before React
      //             mounts. suppressBoot was set so $tw exists with all modules
      //             defined but boot() not yet called. We reuse that instance.
      //   Node    — no external script; load npm tiddlywiki dynamically only on
      //             this branch. TW5 reads core modules from bootPath via fs.
      const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
      const instance: TW5Instance = isBrowser
        ? (() => {
            if (!g.$tw?.modules?.titles) {
              throw new Error(
                "LarariumTW5: tiddlywikicore script not loaded. " +
                "Ensure serve.ts injects <script src=\"/tiddlywikicore-*.js\"> before </head>."
              );
            }
            g.$tw.boot.suppressBoot = true; // keep suppressed — we call boot() below
            g.$tw.boot.argv = g.$tw.boot.argv ?? [];
            return g.$tw;
          })()
        : (await loadNodeTiddlyWiki()).TiddlyWiki();

      if (!isBrowser) instance.boot.argv = [];

      // Load UI and vendor tiddlers before entering the Promise executor
      // (Promise constructors can't be async).
      const uiTiddlers     = await loadUiTiddlers();
      const vendorTiddlers = await loadVendorTiddlers();

      await new Promise<void>((resolve) => {

      // Suppress TW5's boot banner (Node only — process.stdout not in browser).
      let restoreStdout: (() => void) | null = null;
      const proc = g.process;
      if (proc?.stdout?.write) {
        const orig = proc.stdout.write.bind(proc.stdout);
        proc.stdout.write = () => true;
        restoreStdout = () => { proc.stdout.write = orig; };
      }

      // Pre-load plugin tiddlers before boot so TW5 discovers them at startup.
      instance.preloadTiddlers = instance.preloadTiddlers ?? [];
      // Widget module marker — prototype chain wired by _registerWidgets() after boot.
      instance.preloadTiddlers.push(LARARIUM_WIDGETS_TIDDLER);

      // UI tiddlers — ViewTemplate tab + iam-panel character sheet template.
      // Loaded at runtime from lares/ha-ka-ba/api/v0.1/lararium/{ui,templates}/*.md.
      // Must be present before first render so the Metadata tab appears immediately.
      for (const t of uiTiddlers) {
        instance.preloadTiddlers.push(t as Record<string, unknown>);
      }

      // Boot shadows + vendored third-party TW5 plugins — loaded at runtime from
      // lares/ha-ka-ba/api/v0.1/tw5-plugins/*.json.
      // Includes: MIME config, LarariumKumu tag, $:/palette pointer, render no-op,
      // and sq/streams vendor plugin.
      for (const t of vendorTiddlers) {
        instance.preloadTiddlers.push(t as Record<string, unknown>);
      }

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
    })();
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
    const tw = this._tw;

    // Shadow root — reuse if already attached (guard against double-mount).
    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });

    // ── Styles ────────────────────────────────────────────────────────────────
    // Mirrors TW5's render.js: makeTranscludeWidget("$:/core/ui/PageStylesheet")
    // into fakeDocument, then copy textContent into a real <style> in shadow root.
    const styleWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/PageStylesheet", {
      document:     tw.fakeDocument,
      parentWidget: tw.rootWidget,
    });
    // styleContainer is a TW5FakeElement from fakeDocument — used for stylesheet text extraction.
    const styleContainer = tw.fakeDocument.createElement("style");
    styleWidget.render(styleContainer, null);

    const styleEl = shadow.querySelector("#lar-tw5-styles") as HTMLStyleElement | null
      ?? (() => { const el = document.createElement("style"); el.id = "lar-tw5-styles"; shadow.insertBefore(el, shadow.firstChild); return el; })();
    styleEl.textContent = styleContainer.textContent ?? "";

    // ── Page ──────────────────────────────────────────────────────────────────
    // Mirrors TW5's render.js: makeTranscludeWidget("$:/core/ui/RootTemplate")
    // into real document, parented to rootWidget, rendered into inner div.
    // Cast: real browser Document is structurally compatible with TW5FakeDocument at runtime.
    const inner = shadow.querySelector(".tc-page-container-wrapper") as HTMLElement | null
      ?? (() => { const el = document.createElement("div"); el.className = "tc-page-container-wrapper"; shadow.appendChild(el); return el; })();

    const pageWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/RootTemplate", {
      document:         document,
      parentWidget:     tw.rootWidget,
      recursionMarker:  "no",
    });
    // Cast: TW5 widget.render accepts real DOM elements at runtime in the browser.
    pageWidget.render(inner as unknown as TW5FakeElement, null);

    // Wire rootWidget → pageWidget so TW5's internal bookkeeping is consistent.
    tw.rootWidget.domNodes = [inner as unknown as TW5FakeElement];
    tw.rootWidget.children = [pageWidget];

    // ── Refresh cascade ───────────────────────────────────────────────────────
    const handler = (changes: Record<string, TW5ChangeRecord>) => {
      if (styleWidget.refresh(changes, styleContainer, null)) {
        styleEl.textContent = styleContainer.textContent ?? "";
      }
      pageWidget.refresh(changes);
    };
    tw.wiki.addEventListener("change", handler);

    return () => {
      tw.wiki.removeEventListener("change", handler);
      // Remove page widget DOM nodes; leave shadow root intact for potential remount.
      pageWidget.domNodes?.forEach((n) => (n as unknown as Node).parentNode?.removeChild(n as unknown as Node));
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
  // Module injection — corpus-safety gate with imperative fallback.
  //
  // Gate layers:
  //   1. Threshold  — mana ≥ 0.90, manao ≥ 0.85, manaoio ≥ 0.85, confidence ≥ 0.90
  //   2. Hash       — sha256(body) === fields["body-sha256"] (set at build time)
  //
  // The old mutable promotion-stamp gate has been removed from runtime
  // semantics. When Keyhive lands, module trust should key
  // off a membership/capability receipt rather than a mutable tiddler field.
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
    // Called only from the boot() callback after this._tw = instance — never null here.
    if (!this._tw) return;
    const tw   = this._tw;
    const wiki = tw.wiki;

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

        // Threshold + hash passed — hand $tw.wiki to this meme.
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

    LarariumTW5._registerDeserializer(tw);
    LarariumTW5._registerWidgets(tw);
  }

  // Heleuma: register the text/x-memetic-wikitext tiddler deserializer.
  // Canonical source copy lives at lar:///ha.ka.ba/api/v0.1/lararium/modules/deserializer.
  private static _registerDeserializer(tw: TW5Instance): void {
    if (!tw?.Wiki?.tiddlerDeserializerModules) return;
    tw.Wiki.tiddlerDeserializerModules["text/x-memetic-wikitext"] = function(text: string, fields: Record<string, unknown>) {
      const uri: string = (fields?.title as string) ?? "";
      const split = splitCarrierToTiddlers(uri, text);
      const parent = { title: uri, ...fields, ...split.parent.fields, text };
      const children = split.children.map((c) => ({ ...c.fields, title: c.title, text: c.text }));
      const result: TW5TiddlerFields[] = [parent, ...children];
      if (split.warnings.length > 0) {
        const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
        result.push({
          title: `$:/lararium/parse-warning/${safeSlug}`,
          tags: "$:/lararium/parse-warnings",
          "carrier-uri": uri,
          "warning-count": String(split.warnings.length),
          text: split.warnings.join("\n"),
          modified: new Date().toISOString().replace(/[:.]/g, "-"),
        });
      }
      return result;
    };
  }

  // Heleuma: wire compiled widget classes into the TW5 prototype chain.
  // Canonical source copy lives at lar:///ha.ka.ba/api/v0.1/lararium/modules/widget-wiring.
  private static _registerWidgets(tw: TW5Instance): void {
    const WidgetCtor = tw.modules?.types?.widget?.["$:/core/modules/widgets/widget.js"]
      ?.exports?.["widget"] as TW5WidgetConstructor | undefined;
    if (!WidgetCtor) return;
    if (!WidgetCtor.prototype.widgetClasses) {
      tw.modules.applyMethods("widget", {});
    }
    const widgetClasses = createLarariumWidgets(tw);
    for (const [name, cls] of Object.entries(widgetClasses)) {
      Object.setPrototypeOf((cls as { prototype: object }).prototype, WidgetCtor.prototype);
      WidgetCtor.prototype.widgetClasses ??= {};
      // cls will satisfy TW5WidgetConstructor after prototype chain is set above.
      WidgetCtor.prototype.widgetClasses[name] = cls as unknown as TW5WidgetConstructor;
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

  /** True after boot() resolves. */
  get ready(): boolean { return this._tw !== null; }

  /**
   * The raw TW5 $tw instance. Available after boot().
   * Exposes the full TW5 API: $tw.wiki.filterTiddlers, $tw.wiki.renderText,
   * $tw.wiki.renderTiddler, $tw.wiki.addTiddler, etc.
   */
  get wiki(): TW5Wiki {
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
   * Apply a batch of tiddler field maps in a single TW5 transaction.
   *
   * Uses wiki.transact() when available (TW5 5.3+) so all addTiddler calls
   * emit one aggregated "change" event instead of one per tiddler. This is
   * the flush path for MemeProvider's onSyncComplete gate — turns hundreds of
   * per-tiddler widget refreshes during initial Automerge replay into one.
   *
   * Falls back gracefully to sequential addTiddler calls on older TW5 builds.
   */
  bulkSetTiddlers(batch: Array<Record<string, string | string[]>>): void {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before bulkSetTiddlers()");
    const wiki    = this._tw.wiki;
    const Tiddler = this._tw.Tiddler;
    const apply = () => {
      for (const fields of batch) wiki.addTiddler(new Tiddler(fields));
    };
    if (typeof wiki.transact === "function") {
      wiki.transact(apply);
    } else {
      apply();
    }
  }

  /**
   * Force TW5 to emit a change notification for a tiddler, triggering widget refresh.
   * Used by the kukali suspension wire: when a subscribeOnce trigger fires,
   * call touchTiddler(uri) to re-render the tiddler in the story river.
   */
  touchTiddler(uri: string): void {
    if (!this._tw) return;
    const existing = this._tw.wiki.getTiddler(uri);
    if (!existing) return;
    // Re-adding the same tiddler triggers TW5's change notification machinery.
    this._tw.wiki.addTiddler(new this._tw.Tiddler(existing.fields));
  }

  /**
   * Register a kukali suspension hook — called by KukaliWidget at render time.
   *
   * The hook receives (uri, trigger) and should call reactionGraph.subscribeOnce().
   * When the trigger fires, the handler should call touchTiddler(uri) to refresh.
   * Returns an unsub function that removes the hook.
   *
   * Only one hook is active at a time (last-write-wins). The hook is stored on
   * the live TW5 wiki object so KukaliWidget can call it without a React import.
   */
  registerKukaliHook(fn: (uri: string, trigger: string) => (() => void) | void): () => void {
    if (!this._tw) return () => {};
    // Store on $tw.wiki — same object KukaliWidget sees as `this.wiki`.
    this._tw.wiki._larKukaliHook = fn;
    return () => {
      const wiki = this._tw?.wiki;
      if (wiki?._larKukaliHook === fn) delete wiki._larKukaliHook;
    };
  }

  /**
   * Install or remove the Lararium boot-splash tiddlers.
   *
   * active=true  — inject styles + banner into the wiki; shown in both the
   *                server-side snapshot render and the browser TW5 VM while
   *                Automerge islands are still warming.
   * active=false — remove them; called by the browser when the live surface mounts.
   *
   * Server VMs stay in snapshot mode permanently (they only render snapshots).
   * Browser VMs call setSnapshotMode(false) when isLive fires.
   */
  /**
   * Signal tiddler for the boot-splash.
   *
   * Styles and banner markup live in lares/ha-ka-ba/api/v0.1/lararium/ui/
   * (boot-splash-styles.md, boot-splash-banner.md) and are auto-loaded via
   * lares-preloads. The banner uses <$reveal> conditioned on this signal:
   *   <$reveal type="nomatch" state="$:/lararium/boot-splash/active" text="">
   *
   * active=true  — set signal; banner visible in both snapshot HTML and live VM.
   * active=false — remove signal; banner hides; called when live surface mounts.
   */
  setSnapshotMode(active: boolean): void {
    if (!this._tw) return;
    if (active) {
      this.setTiddler({ title: "$:/lararium/boot-splash/active", text: "yes" });
    } else {
      this.removeTiddler("$:/lararium/boot-splash/active");
    }
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

  /**
   * Deserialize carrier text into an array of tiddler field objects.
   * Delegates to $tw.wiki.deserializeTiddlers — the registered tiddlerdeserializer
   * for text/x-memetic-wikitext splits the carrier into [parent, ...children].
   * Falls back to splitCarrierToTiddlers for the pre-boot window.
   *
   * realmOrigin — lar URI of the source Realm. When set, injected as
   * "realm-origin" on every emitted tiddler for multi-Realm provenance queries:
   *   [all[memes]field:realm-origin[lar:///remote-realm-uri]]
   */
  deserializeCarrier(
    uri:        string,
    text:       string,
    extraFields?: Record<string, string | string[]>,
    opts?:      { realmOrigin?: string },
  ): TiddlerFields[] {
    const base: TiddlerFields = { title: uri, ...extraFields };
    let tiddlers: TiddlerFields[];

    if (this._tw) {
      tiddlers = (this._tw.wiki.deserializeTiddlers("text/x-memetic-wikitext", text, base) ?? []) as TiddlerFields[];
    } else {
      // Pre-boot fallback
      const split = splitCarrierToTiddlers(uri, text);
      const parent: TiddlerFields = { ...base, ...split.parent.fields, text };
      tiddlers = [parent, ...split.children.map((c) => ({ ...c.fields, title: c.title, text: c.text }))];
    }

    if (opts?.realmOrigin) {
      const ro = opts.realmOrigin;
      tiddlers = tiddlers.map((t) => ({ ...t, "realm-origin": ro }));
    }
    return tiddlers;
  }

  /**
   * Streaming variant — ingests a carrier (or a multi-carrier Realm stream)
   * arriving as async string chunks. Yields tiddler-field batches as each ahu
   * section and carrier closes, rather than buffering the full text first.
   *
   * Each yielded batch is [parent, ...children] for a carrier-close, or a
   * single [childFields] for an incremental ahu-child event.
   *
   * Designed for:
   *   - Automerge CRDT patch streams (large carrier arriving in increments)
   *   - Multi-Realm ingestion: connect to a remote Realm's meme stream,
   *     yield tiddler batches, apply to local wiki with realm-origin provenance.
   */
  async *streamDeserializeCarrier(
    chunks:  AsyncIterable<string>,
    opts?:   { realmOrigin?: string },
  ): AsyncGenerator<TiddlerFields[]> {
    const parser = new MemeStreamParser();
    for await (const chunk of chunks) {
      const events = parser.push(chunk);
      for (const batch of streamEventsToTiddlers(events, opts?.realmOrigin)) {
        yield batch;
      }
    }
    // Flush any incomplete carrier at stream end
    const tail = parser.flush();
    for (const batch of streamEventsToTiddlers(tail, opts?.realmOrigin)) {
      yield batch;
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
   * Kumu defs are first-class memes in the tagspace (tag $:/tags/LarariumKumu,
   * field kumu-name) — no secondary extraction needed. They load here like any
   * other carrier and are resolved at render time via TW5 filter.
   */
  async loadFromStore(
    store: LarTiddlerStore,
    onProgress?: (loaded: number, total: number) => void,
  ): Promise<void> {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before loadFromStore()");
    const tw = this._tw;
    const uris = await store.listVisible();
    const total = uris.length;
    let loaded = 0;

    // Process sequentially in chunks of 50, yielding to the event loop between
    // chunks so Playwright and browser animations don't starve. Promise.all on
    // 300+ microtasks blocks the event loop for the entire duration — yielding
    // allows waitForFunction polls and progress renders to sneak through.
    const CHUNK = 50;
    for (let i = 0; i < uris.length; i += CHUNK) {
      const chunk = uris.slice(i, i + CHUNK);
      await Promise.all(chunk.map(async (uri) => {
        const rec = await store.get(uri);
        if (!rec || rec.deleted) { loaded++; onProgress?.(loaded, total); return; }

        const contentType = (rec.fields["type"] as string | undefined) ?? (rec.fields["content-type"] as string | undefined) ?? "";
        if (rec.text !== undefined && (contentType === "text/x-memetic-wikitext" || (!contentType && uri.startsWith("lar:")))) {
          const tiddlers = this.deserializeCarrier(uri, rec.text, rec.fields as Record<string, string | string[]>);
          for (const t of tiddlers) tw.wiki.addTiddler(new tw.Tiddler(t));
        } else {
          const fields: Record<string, string | string[]> = { title: rec.title, ...rec.fields };
          if (rec.text !== undefined) fields["text"] = rec.text;
          tw.wiki.addTiddler(new tw.Tiddler(fields));
        }

        loaded++;
        onProgress?.(loaded, total);
      }));
      // Yield: hand control back to the event loop between chunks.
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    this._loadedUris = new Set(uris);
  }

  /**
   * Ingest a remote Realm's meme stream into the local TW5 wiki.
   *
   * Drives MemeStreamParser over an AsyncIterable<string> of text chunks
   * (HTTP chunked transfer, WebSocket frames, CRDT patch stream, etc.).
   * Each carrier-close event produces a [parent, ...children] batch that
   * is loaded into the wiki with `realm-origin` provenance set to realmUri.
   *
   * Foreign memes are queryable by:
   *   [all[memes]field:realm-origin[lar:///remote-realm-uri]]
   *
   * The caller owns transport and reconnect. This method completes when the
   * iterable ends or a realm-done event is received.
   */
  async loadFromRealmStream(
    realmUri: string,
    chunks: AsyncIterable<string>,
  ): Promise<void> {
    if (!this._tw) throw new Error("LarariumTW5: call boot() before loadFromRealmStream()");
    for await (const batch of this.streamDeserializeCarrier(chunks, { realmOrigin: realmUri })) {
      for (const fields of batch) {
        this._tw.wiki.addTiddler(new this._tw.Tiddler(fields));
      }
    }
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
    const handler = (changes: Record<string, TW5ChangeRecord>) => cb(changes as Record<string, unknown>);
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

    const wiki = this._tw.wiki;

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

  /** Parse reaction bindings for a single URI from its current tiddler text. */
  bindingsForUri(uri: string) {
    if (!this._tw) return [];
    return bindingsForUri(this._tw.wiki, uri);
  }

  /**
   * Build a full ReactionGraph from all tiddlers.
   * Use once at boot; after that prefer graph.updateUri(uri, tw5.bindingsForUri(uri)).
   */
  buildReactionGraph() {
    if (!this._tw) return null;
    return buildReactionGraph(this._tw.wiki);
  }

  /** Read zoom-level layout props from the kumu def meme for this zoom level. */
  getZoomLayout(level: string): ZoomLayout | null {
    if (!this._tw) return null;
    return getZoomLayout(this._tw.wiki, level);
  }
}

