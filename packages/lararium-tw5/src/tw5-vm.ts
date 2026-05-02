/**
 * tw5-vm.ts — TW5Engine: clean isomorphic TW5 VM for web3 Lararium.
 *
 * JKD principle: absorb what is useful (boot, render, tiddler mutation,
 * deserialize, wiki events), discard the carrier/closure/store/syncer web2 cruft.
 *
 * TW5Engine owns the raw VM lifecycle. Store sync lives in MemeSyncAdaptor.
 * Reaction indexing lives in ReactionEngine. No globals.
 */

import type {
  TW5Instance,
  TW5Wiki,
  TW5FakeElement,
  TW5ChangeRecord,
  TW5TiddlerFields,
  TW5WidgetConstructor,
} from "./types/tiddlywiki.js";
import { MemeStreamParser } from "@lararium/core";
import type { TiddlerFields } from "./deserializer.js";
import {
  createLarariumWidgets,
  registerImplementorsOperator,
  LARARIUM_WIDGETS_TIDDLER,
} from "./tw5-widgets.js";
import { loadUiTiddlers, loadVendorTiddlers } from "./lares-preloads.js";
import { getZoomLayout } from "./zoom-layout.js";
import type { ZoomLayout } from "./zoom-layout.js";
import { toCanonicalWikitext } from "./tw5-filter.js";

export type { ZoomLayout };

// ---------------------------------------------------------------------------
// Re-export filter pre-processor so callers can import from one place.
// ---------------------------------------------------------------------------
export { toCanonicalWikitext } from "./tw5-filter.js";

async function loadNodeTiddlyWiki(): Promise<{ TiddlyWiki: () => unknown }> {
  // @ts-ignore — tiddlywiki has no local ESM declaration; Node path only.
  const mod = await import(/* @vite-ignore */ "tiddlywiki");
  return ((mod as { default?: unknown }).default ?? mod) as { TiddlyWiki: () => unknown };
}

// ---------------------------------------------------------------------------
// TW5Engine — clean isomorphic TW5 VM
// ---------------------------------------------------------------------------

export class TW5Engine {
  private _tw: TW5Instance | null = null;
  private _bootPromise: Promise<void> | null = null;

  /**
   * Boot the TW5 wiki. Idempotent — multiple calls return the same promise.
   *
   * Browser: tiddlywikicore-<ver>.js already loaded as <script>; $tw exists
   *          with suppressBoot set. We reuse the global instance.
   * Node:    npm tiddlywiki loaded dynamically; no external script needed.
   */
  boot(): Promise<void> {
    if (this._bootPromise) return this._bootPromise;
    this._bootPromise = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

      const instance: TW5Instance = isBrowser
        ? (() => {
            if (!g.$tw?.modules?.titles) {
              throw new Error(
                "TW5Engine: tiddlywikicore script not loaded. " +
                "Ensure serve.ts injects <script src=\"/tiddlywikicore-*.js\"> before </head>."
              );
            }
            g.$tw.boot.suppressBoot = true;
            g.$tw.boot.argv = g.$tw.boot.argv ?? [];
            return g.$tw;
          })()
        : (await loadNodeTiddlyWiki()).TiddlyWiki();

      if (!isBrowser) instance.boot.argv = [];

      const uiTiddlers     = await loadUiTiddlers();
      const vendorTiddlers = await loadVendorTiddlers();

      await new Promise<void>((resolve) => {
        let restoreStdout: (() => void) | null = null;
        const proc = g.process;
        if (proc?.stdout?.write) {
          const orig = proc.stdout.write.bind(proc.stdout);
          proc.stdout.write = () => true;
          restoreStdout = () => { proc.stdout.write = orig; };
        }

        instance.preloadTiddlers = instance.preloadTiddlers ?? [];
        instance.preloadTiddlers.push(LARARIUM_WIDGETS_TIDDLER);
        for (const t of uiTiddlers)     instance.preloadTiddlers.push(t as Record<string, unknown>);
        for (const t of vendorTiddlers) instance.preloadTiddlers.push(t as Record<string, unknown>);

        instance.boot.boot(() => {
          restoreStdout?.();
          this._tw = instance;
          this._bootModules().then(resolve).catch(() => resolve());
        });
      });
    })();
    return this._bootPromise;
  }

  /**
   * Mount the full TW5 story river into a container element.
   * Scopes styles to a shadow root. Returns a cleanup function.
   * Requires boot() to have resolved.
   */
  mountPanel(container: HTMLElement): () => void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before mountPanel()");
    const tw = this._tw;

    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });

    const styleWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/PageStylesheet", {
      document:     tw.fakeDocument,
      parentWidget: tw.rootWidget,
    });
    const styleContainer = tw.fakeDocument.createElement("style");
    styleWidget.render(styleContainer, null);

    const styleEl = shadow.querySelector("#lar-tw5-styles") as HTMLStyleElement | null
      ?? (() => {
        const el = document.createElement("style");
        el.id = "lar-tw5-styles";
        shadow.insertBefore(el, shadow.firstChild);
        return el;
      })();
    styleEl.textContent = styleContainer.textContent ?? "";

    const inner = shadow.querySelector(".tc-page-container-wrapper") as HTMLElement | null
      ?? (() => {
        const el = document.createElement("div");
        el.className = "tc-page-container-wrapper";
        shadow.appendChild(el);
        return el;
      })();

    const pageWidget = tw.wiki.makeTranscludeWidget("$:/core/ui/RootTemplate", {
      document:         document,
      parentWidget:     tw.rootWidget,
      recursionMarker:  "no",
    });
    pageWidget.render(inner as unknown as TW5FakeElement, null);
    tw.rootWidget.domNodes = [inner as unknown as TW5FakeElement];
    tw.rootWidget.children = [pageWidget];

    const handler = (changes: Record<string, TW5ChangeRecord>) => {
      if (styleWidget.refresh(changes, styleContainer, null)) {
        styleEl.textContent = styleContainer.textContent ?? "";
      }
      pageWidget.refresh(changes);
    };
    tw.wiki.addEventListener("change", handler);

    return () => {
      tw.wiki.removeEventListener("change", handler);
      pageWidget.domNodes?.forEach((n) =>
        (n as unknown as Node).parentNode?.removeChild(n as unknown as Node)
      );
    };
  }

  /** Switch the active TW5 palette. Triggers stylesheet recompile. */
  setPalette(paletteName: string): void {
    if (!this._tw) return;
    this._tw.wiki.addTiddler(new this._tw.Tiddler({ title: "$:/palette", text: paletteName, tags: [] }));
  }

  /** Add or update a single tiddler. */
  setTiddler(fields: Record<string, string | string[]>): void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before setTiddler()");
    this._tw.wiki.addTiddler(new this._tw.Tiddler(fields));
  }

  /**
   * Apply a batch of tiddler field maps in a single TW5 transaction.
   * Uses wiki.transact() (TW5 5.3+) so hundreds of per-tiddler events coalesce
   * into one widget refresh cycle.
   */
  bulkSetTiddlers(batch: Array<Record<string, string | string[]>>): void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before bulkSetTiddlers()");
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

  /** Remove a single tiddler by title. */
  removeTiddler(title: string): void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before removeTiddler()");
    this._tw.wiki.deleteTiddler(title);
  }

  /**
   * Force TW5 to emit a change notification for a tiddler, triggering widget refresh.
   * Used by the kukali suspension wire when a subscribeOnce trigger fires.
   */
  touchTiddler(uri: string): void {
    if (!this._tw) return;
    const existing = this._tw.wiki.getTiddler(uri);
    if (!existing) return;
    this._tw.wiki.addTiddler(new this._tw.Tiddler(existing.fields));
  }

  /** Set/clear the boot-splash signal tiddler ($:/lararium/boot-splash/active). */
  setBootSplash(active: boolean): void {
    if (!this._tw) return;
    if (active) {
      this.setTiddler({ title: "$:/lararium/boot-splash/active", text: "yes" });
    } else {
      this.removeTiddler("$:/lararium/boot-splash/active");
    }
  }

  /** Render raw TW5 wikitext to HTML. Returns "" before boot or on error. */
  renderText(text: string): string {
    if (!this._tw) return "";
    try {
      return this._tw.wiki.renderText("text/html", "text/vnd.tiddlywiki", text) ?? "";
    } catch {
      return "";
    }
  }

  /** Render a loaded tiddler to HTML by title. Returns "" on miss or error. */
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
   * Deserialize memetic-wikitext into an array of tiddler field objects.
   * Delegates to $tw.wiki.deserializeTiddlers with the registered
   * text/x-memetic-wikitext tiddlerdeserializer.
   */
  deserializeCarrier(
    uri:         string,
    text:        string,
    extraFields?: Record<string, string | string[]>,
    opts?:       { realmOrigin?: string },
  ): TiddlerFields[] {
    if (!this._tw) throw new Error("TW5Engine: call boot() before deserializeCarrier()");
    const base: TiddlerFields = { title: uri, ...extraFields };
    let tiddlers = (
      this._tw.wiki.deserializeTiddlers("text/x-memetic-wikitext", text, base) ?? []
    ) as TiddlerFields[];
    if (opts?.realmOrigin) {
      const ro = opts.realmOrigin;
      tiddlers = tiddlers.map((t) => ({ ...t, "realm-origin": ro }));
    }
    return tiddlers;
  }

  /**
   * Streaming variant — ingests a meme stream arriving as async string chunks.
   * Yields tiddler-field batches as each carrier closes.
   */
  async *streamDeserializeCarrier(
    chunks: AsyncIterable<string>,
    opts?:  { realmOrigin?: string },
  ): AsyncGenerator<TiddlerFields[]> {
    if (!this._tw) throw new Error("TW5Engine: call boot() before streamDeserializeCarrier()");
    const wiki = this._tw.wiki;
    const ro   = opts?.realmOrigin;
    const parser = new MemeStreamParser();

    const yieldCarrier = (uri: string, fullText: string): TiddlerFields[] => {
      const base: TiddlerFields = { title: uri, ...(ro ? { "realm-origin": ro } : {}) };
      const tiddlers = (wiki.deserializeTiddlers("text/x-memetic-wikitext", fullText, base) ?? []) as TiddlerFields[];
      return ro ? tiddlers.map((t) => ({ ...t, "realm-origin": ro })) : tiddlers;
    };

    for await (const chunk of chunks) {
      for (const ev of parser.push(chunk)) {
        if (ev.kind === "carrier-close") yield yieldCarrier(ev.uri, ev.fullText);
      }
    }
    for (const ev of parser.flush()) {
      if (ev.kind === "carrier-close") yield yieldCarrier(ev.uri, ev.fullText);
    }
  }

  /**
   * Run a wikitext-filter expression against the loaded tiddler store.
   * Pre-processes through toCanonicalWikitext().
   */
  filterTiddlers(expr: string): string[] {
    if (!this._tw) throw new Error("TW5Engine: call boot() before filterTiddlers()");
    return this._tw.wiki.filterTiddlers(toCanonicalWikitext(expr));
  }

  /** Subscribe to TW5 wiki change events. Returns unsubscribe fn. */
  onWikiChange(cb: (changes: Record<string, unknown>) => void): () => void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before onWikiChange()");
    const wiki = this._tw.wiki;
    const handler = (changes: Record<string, TW5ChangeRecord>) => cb(changes as Record<string, unknown>);
    wiki.addEventListener("change", handler);
    return () => wiki.removeEventListener("change", handler);
  }

  /**
   * Register a kukali suspension hook — called by KukaliWidget at render time.
   * Returns an unsub function.
   */
  registerKukaliHook(fn: (uri: string, trigger: string) => (() => void) | void): () => void {
    if (!this._tw) return () => {};
    this._tw.wiki._larKukaliHook = fn;
    return () => {
      const wiki = this._tw?.wiki;
      if (wiki?._larKukaliHook === fn) delete wiki._larKukaliHook;
    };
  }

  /** Read zoom-level layout props from the kumu def meme for this zoom level. */
  getZoomLayout(level: string): ZoomLayout | null {
    if (!this._tw) return null;
    return getZoomLayout(this._tw.wiki, level);
  }

  /** True after boot() resolves. */
  get ready(): boolean { return this._tw !== null; }

  /**
   * The raw TW5 $tw.wiki instance. Available after boot().
   */
  get wiki(): TW5Wiki {
    if (!this._tw) throw new Error("TW5Engine: call boot() before accessing wiki");
    return this._tw.wiki;
  }

  /**
   * Dispose this VM — clear internal refs so GC can collect.
   * Caller must invoke any mountPanel cleanup fn first.
   */
  dispose(): void {
    this._tw          = null;
    this._bootPromise = null;
  }

  // ---------------------------------------------------------------------------
  // Module injection — corpus-safety gate with imperative fallback.
  // ---------------------------------------------------------------------------

  private static readonly MODULE_MANA_THRESHOLD       = 0.90;
  private static readonly MODULE_MANAO_THRESHOLD      = 0.85;
  private static readonly MODULE_MANAOIO_THRESHOLD    = 0.85;
  private static readonly MODULE_CONFIDENCE_THRESHOLD = 0.90;
  private static readonly MODULE_INTERFACE_URI =
    "lar:///ha.ka.ba/@lares/api/v0.1/lararium/tw5-module";

  private async _bootModules(): Promise<void> {
    if (!this._tw) return;
    const tw   = this._tw;
    const wiki = tw.wiki;

    registerImplementorsOperator(tw);

    let injected = 0;
    try {
      const iface  = TW5Engine.MODULE_INTERFACE_URI;
      const titles: string[] = wiki.filterTiddlers(`[all[tiddlers]implementors[${iface}]]`) ?? [];
      for (const title of titles) {
        const t = wiki.getTiddler(title);
        if (!t) continue;
        const f = t.fields as Record<string, string>;

        const mana       = parseFloat(f["mana"]       ?? "0");
        const manao      = parseFloat(f["manao"]      ?? "0");
        const manaoio    = parseFloat(f["manaoio"]    ?? "0");
        const confidence = parseFloat(f["confidence"] ?? "0");
        if (
          mana       < TW5Engine.MODULE_MANA_THRESHOLD       ||
          manao      < TW5Engine.MODULE_MANAO_THRESHOLD      ||
          manaoio    < TW5Engine.MODULE_MANAOIO_THRESHOLD    ||
          confidence < TW5Engine.MODULE_CONFIDENCE_THRESHOLD
        ) continue;

        const body = f["text"] ?? "";
        if (!body.trim() || body.startsWith("// Body injected")) continue;

        const claimedHash = f["body-sha256"] ?? "";
        if (!claimedHash || !(await TW5Engine._verifySha256(body, claimedHash))) continue;

        wiki.addTiddler(new tw.Tiddler({
          title,
          type:           "application/javascript",
          "module-type":  f["module-type"] ?? "library",
          text:           body,
          tags:           [],
        }));
        injected++;
      }
    } catch { /* filter unavailable — fall through */ }

    if (injected > 0) {
      try {
        const moduleText = wiki.getTiddler(
          "lar:///ha.ka.ba/@lares/api/v0.1/lararium/modules/tw5-modules"
        )?.fields?.["text"] ?? "";
        tw.modules.define(moduleText, "library", "lararium-tw5-modules");
      } catch { /* no-op */ }
      return;
    }

    // Imperative fallback — no corpus module memes passed threshold.
    const parsers: Record<string, unknown> = tw?.Wiki?.parsers ?? {};
    import("./memetic-parser.js").then(({ MemeticParser }) => {
      parsers["text/x-memetic-wikitext"] = MemeticParser;
    }).catch(() => {});

    TW5Engine._registerDeserializer(tw);
    TW5Engine._registerWidgets(tw);
  }

  private static _registerDeserializer(tw: TW5Instance): void {
    if (!tw?.Wiki?.tiddlerDeserializerModules) return;
    import("./deserializer.js").then(({ memeticWikitextDeserializer }) => {
      tw.Wiki.tiddlerDeserializerModules["text/x-memetic-wikitext"] =
        memeticWikitextDeserializer as unknown as (text: string, fields: Record<string, unknown>) => TW5TiddlerFields[];
    }).catch(() => {});
  }

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
      WidgetCtor.prototype.widgetClasses[name] = cls as unknown as TW5WidgetConstructor;
    }
  }

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
}
