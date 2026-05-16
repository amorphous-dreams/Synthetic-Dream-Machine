/**
 * tw5-vm.ts — TW5Engine: clean isomorphic TW5 VM for web3 Lararium.
 *
 * JKD principle: absorb what is useful (boot, render, tiddler mutation,
 * deserialize, wiki events), discard the carrier/closure/store/syncer web2 cruft.
 *
 * TW5Engine owns the raw VM lifecycle. Store sync: IslandAdaptor.
 * Reaction routing: reaction-router.ts TW5 startup module. No globals.
 */

import type {
  TW5Instance,
  TW5FakeElement,
  TW5FakeDocument,
  TW5ChangeRecord,
} from "./types/tiddlywiki.js";
import { MemeStreamParser } from "@lararium/mesh";
import type { IslandAccumulator } from "@lararium/mesh";
import type { TiddlerFields } from "./deserializer.js";

// ---------------------------------------------------------------------------
// CameraRegistration — multi-view projection surface
// ---------------------------------------------------------------------------

/**
 * One camera = one view frustum over the wiki world-state.
 *
 * Each camera holds its own IslandAccumulator and drives its own drain cycle
 * at its own tick rate.  All cameras share one TW5 wiki (world graph).
 *
 * Inverted control: the accumulator drains into the wiki via wiki.transact().
 * The wiki fires a "change" event.  Each widget tree registered via
 * wiki.addEventListener("change", tree.refresh) reacts independently —
 * trees with no dependency on the changed tiddlers return immediately.
 *
 * The view frustum lives in the widget tree's root filter, not in the
 * accumulator.  The accumulator carries no camera identity.
 *
 * Input + output: cameras that accept user input register outbound handlers
 * (saveTiddler / dispatchEvent) on their widget tree.  Rendering priority
 * flows naturally from tickMs — lower tickMs = higher render priority.
 */
/**
 * Static structure of one camera: the parse→widget→fakeDOM chain.
 * Pairs with CameraRegistration for the full camera contract.
 * Spec: lar:///ha.ka.ba/@lares/api/v0.1/lararium/camera-mount (C-1 through C-5)
 */
export interface CameraMount {
  /** Root tiddler whose wikitext body defines the view frustum. */
  rootTiddler: string;
  /** The document this camera renders into. */
  document: TW5FakeDocument | Document;
  /** The container element this camera renders into. */
  container: TW5FakeElement | HTMLElement;
}

export interface CameraRegistration {
  /** The accumulator this camera drains each tick. */
  accumulator: IslandAccumulator;
  /**
   * Tick interval in milliseconds.
   *   0 (default) = requestAnimationFrame (~60fps, browser-only)
   *   N > 0        = setInterval(N) — use for background or non-browser cameras
   */
  tickMs?: number;
  /** Maximum patches to drain per tick. Default: 200. */
  budget?: number;
}

import { createHash } from "crypto";
import { LARES_MEMETIC_WIKITEXT_PLUGIN } from "./plugin-tiddler.generated.js";


export interface TW5CoreBootBlob {
  bytes: Uint8Array;
  /** Hex-encoded SHA-256 expected for these exact bytes. */
  sha256?: string;
  /** Human/debug provenance only; never treated as authority. */
  source?: string;
}

type TW5CoreBootInput = Uint8Array | TW5CoreBootBlob;

function normalizeCoreBootBlob(input?: TW5CoreBootInput): TW5CoreBootBlob | undefined {
  if (!input) return undefined;
  return input instanceof Uint8Array ? { bytes: input } : input;
}

function verifyCoreBootBlob(core: TW5CoreBootBlob): void {
  if (!core.sha256) return;
  const actual = createHash("sha256").update(core.bytes).digest("hex");
  if (actual.toLowerCase() !== core.sha256.toLowerCase()) {
    throw new Error(
      `TW5Engine: coreBlob sha256 mismatch` +
      ` expected=${core.sha256}` +
      ` actual=${actual}` +
      (core.source ? ` source=${core.source}` : ""),
    );
  }
}

const TW5_NODE_BOOT_BUILTINS = new Set([
  "crypto", "node:crypto",
  "path",   "node:path",
  "vm",     "node:vm",
  "os",     "node:os",
  "url",    "node:url",
]);

function makeDeniedFsShim(): Record<string, unknown> {
  return new Proxy(Object.create(null) as Record<string, unknown>, {
    get(_target, prop) {
      if (prop === "promises") return makeDeniedFsShim();
      if (typeof prop === "symbol") return undefined;
      return () => {
        throw new Error(`TW5Engine: filesystem access denied during content-addressed TW5 boot (fs.${prop})`);
      };
    },
  });
}

async function loadNodeTiddlyWiki(coreBlob?: TW5CoreBootBlob): Promise<{ TiddlyWiki: () => unknown }> {
  if (!coreBlob) {
    throw new Error("TW5Engine: Node boot requires coreBlob from LarariumDoc; refusing node_modules tiddlywiki fallback.");
  }

  const { createRequire } = await import("module");
  const nodeRequire = createRequire(import.meta.url);
  const moduleShim: { exports: Record<string, unknown>; filename: string } = {
    exports: {},
    // TW5's node boot code derives bootPath/corePath from module.filename.
    // Keep this virtual: the executable core arrives from coreBlob, not from an
    // installed tiddlywiki package. Runtime disk reads stay disabled by our
    // preloaded-tiddler boot path below.
    filename: "/virtual/lararium/tiddlywiki/boot/boot.js",
  };
  const exportsShim = moduleShim.exports;
  const requireShim = (id: string): unknown => {
    if (id === "../package.json") {
      return { engines: { node: ">=18.0.0" } };
    }
    if (id === "fs" || id === "node:fs") {
      return makeDeniedFsShim();
    }
    if (TW5_NODE_BOOT_BUILTINS.has(id)) {
      return nodeRequire(id);
    }
    throw new Error(`TW5Engine: coreBlob attempted non-builtin require(${JSON.stringify(id)}) during boot`);
  };
  const priorTw = (globalThis as Record<string, unknown>)["$tw"];
  const priorLoad = (globalThis as Record<string, unknown>)["_load"];
  const priorWindow = (globalThis as Record<string, unknown>)["window"];
  const priorRequire = (globalThis as Record<string, unknown>)["require"];
  let twFromBlob: unknown;
  try {
    // Some bundled TW5 modules use browser-style UMD wrappers that read a
    // global `window` symbol during definition even on Node. Provide a temporary
    // virtual window only while evaluating the content-addressed core blob.
    (globalThis as Record<string, unknown>)["window"] = globalThis;
    (globalThis as Record<string, unknown>)["require"] = requireShim;
    (globalThis as Record<string, unknown>)["$tw"] = { boot: { suppressBoot: true } };
    // The standalone TW5 core blob is the browser/server boot script emitted by
    // TiddlyWiki. Evaluating it with CommonJS-shaped `exports` makes it expose
    // `exports.TiddlyWiki`, while the bytes themselves come from the
    // content-addressed LarariumDoc blob, not from an installed TW5 package.
    const source = new TextDecoder().decode(new Uint8Array(coreBlob.bytes));
    const evaluate = new Function("exports", "module", "require", "window", "process", source);
    evaluate(exportsShim, moduleShim, requireShim, globalThis, process);
    twFromBlob = (globalThis as Record<string, unknown>)["$tw"];
    if (twFromBlob && typeof twFromBlob === "object") {
      const tw = twFromBlob as Record<string, unknown>;
      tw["__larariumRequireShim"] = requireShim;
      tw["__larariumModuleShim"] = moduleShim;
    }
  } finally {
    if (priorTw === undefined) delete (globalThis as Record<string, unknown>)["$tw"];
    else (globalThis as Record<string, unknown>)["$tw"] = priorTw;
    if (priorLoad === undefined) delete (globalThis as Record<string, unknown>)["_load"];
    else (globalThis as Record<string, unknown>)["_load"] = priorLoad;
    if (priorWindow === undefined) delete (globalThis as Record<string, unknown>)["window"];
    else (globalThis as Record<string, unknown>)["window"] = priorWindow;
    if (priorRequire === undefined) delete (globalThis as Record<string, unknown>)["require"];
    else (globalThis as Record<string, unknown>)["require"] = priorRequire;
  }

  if (typeof exportsShim["TiddlyWiki"] === "function") {
    return exportsShim as { TiddlyWiki: () => unknown };
  }
  if (twFromBlob && typeof twFromBlob === "object") {
    return { TiddlyWiki: () => twFromBlob };
  }
  throw new Error("TW5Engine: coreBlob did not yield a TiddlyWiki instance.");
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
   * Browser: injects the tiddlywikicore blob as a suppressed <script>; then boots.
   * Node:    evaluates the same tiddlywikicore blob with a CommonJS-shaped
   *          wrapper; no node_modules tiddlywiki runtime fallback is allowed.
   */
  boot(coreBlob?: TW5CoreBootInput, preloadedTiddlers?: Array<Record<string, unknown>>): Promise<void> {
    if (this._bootPromise) return this._bootPromise;
    this._bootPromise = (async () => {
      const core = normalizeCoreBootBlob(coreBlob);
      if (core) verifyCoreBootBlob(core);
      const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

      // Browser web3 path: suppress auto-boot, inject blob, then boot once with preloads.
      if (isBrowser) {
        if (core && !globalThis.$tw?.modules?.titles) {
          // Pre-set suppressBoot so the blob script does NOT auto-boot.
          globalThis.$tw ??= {} as TW5Instance;
          globalThis.$tw.boot ??= {} as TW5Instance["boot"];
          globalThis.$tw.boot.suppressBoot = true;

          await new Promise<void>((resolve, reject) => {
            const blob    = new Blob([new Uint8Array(core.bytes)], { type: "application/javascript" });
            const blobUrl = URL.createObjectURL(blob);
            const script  = document.createElement("script");
            script.src    = blobUrl;
            script.onload  = () => { URL.revokeObjectURL(blobUrl); resolve(); };
            script.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("TW5Engine: blob script load failed")); };
            document.head.appendChild(script);
          });
        }

        if (!globalThis.$tw?.modules?.titles) {
          throw new Error("TW5Engine: no TW5 core. Pass coreBlob from LarariumDoc to boot().");
        }

        // Fall through to the shared boot path below with instance = globalThis.$tw.
      }

      let instance: TW5Instance;
      if (isBrowser) {
        globalThis.$tw!.boot.suppressBoot = true;
        globalThis.$tw!.boot.argv = globalThis.$tw!.boot.argv ?? [];
        instance = globalThis.$tw as unknown as TW5Instance;
      } else {
        instance = (await loadNodeTiddlyWiki(core)).TiddlyWiki() as unknown as TW5Instance;
        instance.boot.argv = [];
        // The standalone blob already carries $:/core as preloaded tiddlers,
        // but not the separate TW5 core-server package. Run the VM in a
        // neutral host profile: Node supplies host JS execution, while TW5
        // receives all wiki content through preloads/adaptors rather than
        // Node's CLI/wiki-folder machinery.
        (instance as unknown as { node: null; browser: null }).node = null;
        (instance as unknown as { node: null; browser: null }).browser = null;
        // Lares owns tiddler ingress through preloadedTiddlers + IslandAdaptor.
        // Disable TW5's normal Node wiki-folder scan so the VM cannot treat cwd
        // or package files as a boot authority.
        (instance as unknown as { loadTiddlersNode?: () => void }).loadTiddlersNode = () => {};
      }

      const allPreloads = preloadedTiddlers ?? [];

      await new Promise<void>((resolve) => {
        let restoreStdout: (() => void) | null = null;
        const proc = (globalThis as Record<string, unknown>).process as (typeof process) | undefined;
        if (proc?.stdout?.write) {
          const orig = proc.stdout.write.bind(proc.stdout);
          proc.stdout.write = () => true;
          restoreStdout = () => { proc.stdout.write = orig; };
        }

        const hostGlobal = globalThis as Record<string, unknown>;
        const savedRequire = hostGlobal["require"];
        const savedModule = hostGlobal["module"];
        const nodeRequireShim = !isBrowser ? (instance as unknown as Record<string, unknown>)["__larariumRequireShim"] : undefined;
        const nodeModuleShim = !isBrowser ? (instance as unknown as Record<string, unknown>)["__larariumModuleShim"] : undefined;
        if (!isBrowser) {
          if (nodeRequireShim) hostGlobal["require"] = nodeRequireShim;
          if (nodeModuleShim) hostGlobal["module"] = nodeModuleShim;
        }

        instance.preloadTiddlers = instance.preloadTiddlers ?? [];
        // Single plugin tiddler — the lar:// canonical envelope
        // emitted by `pnpm build:plugin`. TW5's standard plugin
        // loader unpacks the JSON envelope, registers each inner
        // module via $tw.modules.define, and materializes the
        // cascade configs / templates / mount as shadow tiddlers.
        // Replaces the imperative widget/parser/wikirule/
        // deserializer registrations that the V.1 boot path used.
        instance.preloadTiddlers.push(LARES_MEMETIC_WIKITEXT_PLUGIN as unknown as Record<string, unknown>);
        for (const t of allPreloads) instance.preloadTiddlers.push(t as Record<string, unknown>);

        instance.boot.boot(() => {
          restoreStdout?.();
          if (!isBrowser) {
            if (savedRequire === undefined) delete hostGlobal["require"];
            else hostGlobal["require"] = savedRequire;
            if (savedModule === undefined) delete hostGlobal["module"];
            else hostGlobal["module"] = savedModule;
          }
          this._tw = instance;
          this._bootModules().then(resolve).catch(() => resolve());
        });
      });
    })();
    return this._bootPromise;
  }

  /**
   * Mount a single camera: constructs the parse→widget→fakeDOM chain once,
   * registers a wiki "change" listener that refreshes the widget tree, and
   * returns a teardown function that removes the listener and detaches DOM nodes.
   *
   * Isomorphic — works with window.document (browser), $tw.fakeDocument (Node/SSR),
   * or any fake-DOM implementation.  The caller pairs this with startRenderLoop()
   * to drive the drain→transact→change→refresh cycle.
   *
   * Spec: lar:///ha.ka.ba/@lares/api/v0.1/lararium/camera-mount (C-1 through C-5)
   */
  mountCamera(mount: CameraMount): () => void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before mountCamera()");
    const tw = this._tw;

    const widget = tw.wiki.makeTranscludeWidget(mount.rootTiddler, {
      document:     mount.document as TW5FakeDocument,
      parentWidget: tw.rootWidget,
    });
    widget.render(mount.container as TW5FakeElement, null);

    const handler = (changes: Record<string, TW5ChangeRecord>) => {
      widget.refresh(changes);
    };
    tw.wiki.addEventListener("change", handler);

    return () => {
      tw.wiki.removeEventListener("change", handler);
      widget.domNodes?.forEach((n) =>
        (n as unknown as Node).parentNode?.removeChild(n as unknown as Node)
      );
    };
  }

  /**
   * Mount the TW5 Story River as a floating HUD layer over the infinite canvas.
   *
   * The shadow root isolates TW5 stylesheet from the canvas surface behind it.
   * Uses window.document intentionally — the story river renders real HTML into
   * the shadow pane; canvas cameras below it use their own fake-DOM documents.
   * The stylesheet camera (fakeDocument) and the story-river camera (window.document)
   * stay separate by design: CSS side-effects are not a view frustum.
   *
   * @browser-only
   * ╔══════════════════════════════════════════════════════════════════════════╗
   * ║  Browser HUD overlay — extract to BrowserTW5Engine when dreamdeck-app  ║
   * ║  arrives and needs to import TW5Engine without pulling browser APIs.    ║
   * ╚══════════════════════════════════════════════════════════════════════════╝
   */
  mountPanel(container: HTMLElement): () => void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before mountPanel()");
    const tw = this._tw;

    const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });

    // Stylesheet camera — renders into fakeDocument, syncs CSS text to shadow DOM.
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

    const styleHandler = (changes: Record<string, TW5ChangeRecord>) => {
      if (styleWidget.refresh(changes, styleContainer, null)) {
        styleEl.textContent = styleContainer.textContent ?? "";
      }
    };
    tw.wiki.addEventListener("change", styleHandler);

    const inner = shadow.querySelector(".tc-page-container-wrapper") as HTMLElement | null
      ?? (() => {
        const el = document.createElement("div");
        el.className = "tc-page-container-wrapper";
        shadow.appendChild(el);
        return el;
      })();

    // Story river camera — the default TW5 view frustum.
    const teardownCamera = this.mountCamera({
      rootTiddler: "$:/core/ui/RootTemplate",
      document:    document as unknown as TW5FakeDocument,
      container:   inner as unknown as TW5FakeElement,
    });

    // Wire rootWidget domNodes so TW5's internal event dispatch traverses the tree.
    tw.rootWidget.domNodes = [inner as unknown as TW5FakeElement];

    return () => {
      tw.wiki.removeEventListener("change", styleHandler);
      teardownCamera();
    };
  }

  /** Switch the active TW5 palette. Triggers stylesheet recompile. @browser-only */
  setPalette(paletteName: string): void {
    if (!this._tw) return;
    this._tw.wiki.addTiddler(new this._tw.Tiddler({ title: "$:/palette", text: paletteName, tags: [] }));
  }

  /** Set/clear the boot-splash signal tiddler ($:/lararium/boot-splash/active). @browser-only */
  setBootSplash(active: boolean): void {
    if (!this._tw) return;
    if (active) {
      this._tw.wiki.addTiddler(new this._tw.Tiddler({ title: "$:/lararium/boot-splash/active", text: "yes" }));
    } else {
      this._tw.wiki.deleteTiddler("$:/lararium/boot-splash/active");
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
   * Wire a VerseEventConsumer to this VM's wiki event bus.
   * KukaliWidget fires "tm-verse-event"; the consumer handles it.
   * Returns a teardown function (Verse cancelable equivalent).
   */
  onVerseEvent(consumer: { handleVerseEvent(uri: string, listenable: string): void }): () => void {
    if (!this._tw) return () => {};
    const handler = (...args: unknown[]) => {
      const event = args[0] as { uri?: string; listenable?: string } | undefined;
      if (event?.uri && event.listenable) {
        consumer.handleVerseEvent(event.uri, event.listenable);
      }
    };
    this._tw.wiki.addEventListener("tm-verse-event", handler);
    return () => this._tw?.wiki.removeEventListener("tm-verse-event", handler);
  }


  /**
   * Multi-camera render loop.
   *
   * Each CameraRegistration drives its own drain cycle:
   *   - tickMs = 0 (default): requestAnimationFrame at ~60fps (browser-only)
   *   - tickMs > 0: setInterval at that interval (browser + node)
   *
   * On each camera tick:
   *   1. rAF cameras write $:/temp/volatile/lararium/tick — arms TW5's
   *      volatile-refresh throttle for 60fps repaint.
   *   2. adaptor.flushAll([camera.accumulator], camera.budget) drains the
   *      accumulator and applies the batch via wiki.transact().
   *   3. wiki fires "change" event. Every widget tree registered via
   *      wiki.addEventListener("change", tree.refresh) reacts — trees with
   *      no dependency on the changed tiddlers return immediately (O(1)).
   *
   * Inverted control: the view frustum lives in each widget tree's root
   * filter, not in the accumulator.  Cameras at different tick rates drain
   * independently; the single wiki is the synchronization point.
   *
   * Returns a teardown fn that cancels all timers.
   */
  startRenderLoop(
    cameras: CameraRegistration[],
    adaptor: { flushAll(accs: IslandAccumulator[], budget?: number): void },
  ): () => void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before startRenderLoop()");
    const teardowns: Array<() => void> = [];

    for (const cam of cameras) {
      const budget = cam.budget ?? 200;
      const acc    = cam.accumulator;
      const tickMs = cam.tickMs ?? 0;

      if (tickMs === 0) {
        let rafId  = 0;
        let running = true;
        const tick = (timestamp: number) => {
          if (!running) return;
          this._tw!.wiki.addTiddler(
            new this._tw!.Tiddler({
              title: "$:/temp/volatile/lararium/tick",
              text:  String(Math.floor(timestamp)),
            }),
          );
          adaptor.flushAll([acc], budget);
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
        teardowns.push(() => { running = false; cancelAnimationFrame(rafId); });
      } else {
        const id = setInterval(() => adaptor.flushAll([acc], budget), tickMs);
        teardowns.push(() => clearInterval(id));
      }
    }

    return () => teardowns.forEach((fn) => fn());
  }

  /** Returns true after boot() resolves. */
  get ready(): boolean { return this._tw !== null; }

  /**
   * Exposes the full TW5Instance ($tw) — wiki, modules, utils, Tiddler constructor,
   * filterOperators, config, etc. Fully typed via TW5Instance from tiddlywiki.d.ts.
   * Accessible after boot(). Prefer the typed facade methods above for common ops;
   * use this when you need TW5 internals the facade doesn't expose.
   */
  get $tw(): TW5Instance {
    if (!this._tw) throw new Error("TW5Engine: call boot() before accessing $tw");
    return this._tw;
  }

  /** Direct access to $tw.wiki after boot. */
  get wiki(): TW5Instance["wiki"] {
    if (!this._tw) throw new Error("TW5Engine: call boot() before accessing wiki");
    return this._tw.wiki;
  }

  /**
   * Render a wikitext string to HTML using TW5's server-side renderer.
   * The text parses as `text/vnd.tiddlywiki` in an anonymous tiddler context.
   */
  renderText(text: string, type = "text/vnd.tiddlywiki"): string {
    if (!this._tw) throw new Error("TW5Engine: call boot() before renderText()");
    return this._tw.wiki.renderText("text/html", type, text);
  }

  /** Add or replace a tiddler by field map. */
  setTiddler(fields: Record<string, string | string[]>): void {
    if (!this._tw) throw new Error("TW5Engine: call boot() before setTiddler()");
    this._tw.wiki.addTiddler(new this._tw.Tiddler(fields as Record<string, unknown>));
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
    "lar:///ha.ka.ba/@lararium/tw5/tw5-module";

  private async _bootModules(): Promise<void> {
    if (!this._tw) return;
    const tw   = this._tw;
    const wiki = tw.wiki;

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
          "lar:///ha.ka.ba/@lararium/tw5/modules/tw5-modules"
        )?.fields?.["text"] ?? "";
        tw.modules.define(moduleText, "library", "lararium-tw5-modules");
      } catch { /* no-op */ }
      return;
    }

    // Plugin-tiddler load path: the bundled `lar:///plugins/lares/
    // memetic-wikitext` envelope (pushed via preloadTiddlers in boot())
    // carries the wikirule, parser, deserializer, widget modules, and
    // cascade/template/mount shadow tiddlers. TW5's standard plugin
    // loader unpacks the JSON envelope and registers each inner module
    // via $tw.modules.define on boot — no imperative wiring needed.
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
