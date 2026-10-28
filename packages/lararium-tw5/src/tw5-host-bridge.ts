import { sha256HexBytesSync } from "@lararium/mesh/crypto";

import type { TW5Instance } from "./types/tiddlywiki.js";

export interface TW5CoreBootBlob {
  bytes: Uint8Array;
  /** Hex-encoded SHA-256 expected for these exact bytes. */
  sha256?: string;
  /** Human/debug provenance only; never treated as authority. */
  source?: string;
}

export type TW5CoreBootInput = Uint8Array | TW5CoreBootBlob;

/**
 * A projected TW5 event cannot borrow the main Window object. The engine asks its own confirm questions
 * through the wiki (a parked question tiddler, rendered in the frame), so nothing in core reads this view.
 * A plugin that still reaches for `event.view.confirm` meets this worker-local capability, which refuses by
 * name: a blocking prompt holds no place in an island.
 */
export function makeProjectedViewContract(onRefusal?: (capability: "view.confirm", message: string) => void): { confirm(message: string): boolean } {
  return {
    confirm(message: string): boolean {
      console.warn(`[wiki-worker] capability refused: window.confirm is unavailable in the projected island (${message})`);
      onRefusal?.("view.confirm", message);
      return false;
    },
  };
}

/** CSS.escape's identifier serialization for the worker runtime, where utils-browser's window.CSS is absent. */
export function escapeCssIdentifier(value: string): string {
  const input = String(value);
  let result = "";
  for (let index = 0; index < input.length; index++) {
    const code = input.charCodeAt(index);
    if (code === 0) { result += "\uFFFD"; continue; }
    if ((code >= 1 && code <= 31) || code === 127 ||
        (index === 0 && code >= 48 && code <= 57) ||
        (index === 1 && code >= 48 && code <= 57 && input.charCodeAt(0) === 45)) {
      result += `\\${code.toString(16)} `;
      continue;
    }
    if (index === 0 && code === 45 && input.length === 1) { result += "\\-"; continue; }
    if (code >= 128 || code === 45 || code === 95 ||
        (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
      result += input[index];
    } else {
      result += `\\${input[index]}`;
    }
  }
  return result;
}

const TW5_NODE_BOOT_BUILTINS = new Set([
  "crypto", "node:crypto",
  "path",   "node:path",
  "vm",     "node:vm",
  "os",     "node:os",
  "url",    "node:url",
]);
const TW5_BROWSER_BOOT_BUILTINS = new Set([
  "crypto", "node:crypto",
  "path",   "node:path",
  "vm",     "node:vm",
  "os",     "node:os",
  "url",    "node:url",
  "fs",     "node:fs",
  "../package.json",
]);

export function normalizeCoreBootBlob(input?: TW5CoreBootInput): TW5CoreBootBlob | undefined {
  if (!input) return undefined;
  return input instanceof Uint8Array ? { bytes: input } : input;
}

export function verifyCoreBootBlob(core: TW5CoreBootBlob): void {
  if (!core.sha256) return;
  const actual = sha256HexBytesSync(core.bytes);
  if (actual.toLowerCase() !== core.sha256.toLowerCase()) {
    throw new Error(
      `TW5Engine: coreBlob sha256 mismatch` +
      ` expected=${core.sha256}` +
      ` actual=${actual}` +
      (core.source ? ` source=${core.source}` : ""),
    );
  }
}

/** A fault that keeps its name, message and stack and belongs to no built-in class, so `instanceof` reads it as a plain error. */
function namedFault(error: unknown): Error {
  if (!(error instanceof Error)) return new Error(String(error));
  const fault = new Error(error.message);
  fault.name = error.name;
  if (error.stack) fault.stack = error.stack;
  return fault;
}

function makeBrowserVmShim(): Record<string, unknown> {
  function runInCtx(code: string, ctx: Record<string, unknown> | undefined): unknown {
    const c = ctx ?? (Object.create(null) as Record<string, unknown>);
    const keys = Object.keys(c);
    const vals = keys.map((k) => c[k]);
    // RETURN the script's completion value (vm.runInContext semantics). TW5's evalGlobal
    // passes a `(function(){…})` expression and then `.apply()`s the result — so the value
    // must come back; `new Function(...keys, code)` (no `return`) would discard it → undefined.
    // A fault in the code (a SyntaxError above all) reaches the caller as a NAMED fault, the way the
    // real `vm` hands one across its realm: TW5's module executor reads a same-realm SyntaxError
    // under V8 (no line number, no browser flag) as "throw it again", which would end the island's
    // boot on one broken module; a plain fault that keeps the name, message and stack takes the
    // executor's reporting branch, so the module ends by name and the island boots on.
    try {
      return (new Function(...keys, "return " + code) as (...args: unknown[]) => unknown)(...vals);
    } catch (error) {
      throw namedFault(error);
    }
  }
  class BrowserVmScript {
    private readonly code: string;
    constructor(code: string, _options?: unknown) { this.code = code; }
    runInContext(ctx: Record<string, unknown>): unknown { return runInCtx(this.code, ctx); }
    runInNewContext(ctx?: Record<string, unknown>): unknown { return runInCtx(this.code, ctx); }
    runInThisContext(): unknown { try { return new Function("return " + this.code)(); } catch (error) { throw namedFault(error); } }
  }
  return {
    Script: BrowserVmScript,
    createContext(ctx: Record<string, unknown>): Record<string, unknown> {
      return ctx ?? (Object.create(null) as Record<string, unknown>);
    },
    runInContext(code: string, ctx: Record<string, unknown>): unknown { return runInCtx(code, ctx); },
    runInNewContext(code: string, ctx?: Record<string, unknown>): unknown { return runInCtx(code, ctx); },
    // vm.runInThisContext RETURNS the script's completion value — for TW5's evalGlobal the
    // code is a `(function(){…})` expression it then `.apply()`s. `new Function(code)()` would
    // discard that value (→ undefined → `undefined.apply` → every module dies); `return ` keeps it.
    runInThisContext(code: string): unknown { try { return new Function("return " + code)(); } catch (error) { throw namedFault(error); } },
  };
}

function makeBrowserPathShim(): Record<string, unknown> {
  const sep = "/";
  const normalize = (p: string) => p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
  const dirname  = (p: string) => { const i = p.lastIndexOf("/"); return i < 1 ? (i === 0 ? "/" : ".") : p.slice(0, i); };
  const basename = (p: string, ext?: string) => { const b = p.slice(p.lastIndexOf("/") + 1); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; };
  const extname  = (p: string) => { const b = basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; };
  const join     = (...parts: string[]) => normalize(parts.filter(Boolean).join("/"));
  const resolve  = (...parts: string[]) => {
    let acc = "/";
    for (const p of parts) { acc = p.startsWith("/") ? p : join(acc, p); }
    return normalize(acc);
  };
  return { sep, dirname, basename, extname, join, resolve, normalize };
}

/** A neutral `os` for the island runtime — TW5's `$:/core/modules/startup.js` reads
 *  `os.platform()` on the non-browser branch. The island is platform-agnostic. */
function makeBrowserOsShim(): Record<string, unknown> {
  return {
    platform: () => "browser", arch: () => "wasm", EOL: "\n",
    hostname: () => "lararium-island", tmpdir: () => "/tmp", type: () => "Lararium", release: () => "",
  };
}

/** A capability-shim `process` handed to the core blob's eval scope (the WASI law: the host
 *  injects the capability; the guest never assumes ambient authority). Eval-scoped via
 *  `processArg` — NOT a globalThis stub — and `exit` is a no-op: the island never aborts. */
function makeBrowserProcessShim(): Record<string, unknown> {
  return {
    env: {}, argv: [], platform: "browser", browser: true, version: "", versions: {},
    cwd: () => "/", exit: () => { /* the island never aborts a worker */ },
    nextTick: (cb: (...a: unknown[]) => void, ...a: unknown[]) => queueMicrotask(() => cb(...a)),
    on: () => {}, once: () => {}, off: () => {},
    stdout: { write: () => true }, stderr: { write: () => true },
  };
}

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

/**
 * The names the core blob writes on `window` while it evaluates, each measured on a real boot:
 *   sjcl  TW5's bundled crypto: its own module body writes it, and the bundle's loader writes it again
 *   $tw   `$:/boot/bootprefix.js` seats the instance (`window.$tw = _bootprefix(window.$tw)`); the boot flow
 *         reads the instance back from exactly this name
 */
export const LENT_WINDOW_NAMES: ReadonlySet<string> = new Set(["sjcl", "$tw"]);

/**
 * Lend one name on the island's global scope, NON-ENUMERABLE. After each module body the fork's `globalCheck`
 * enumerates the global's own keys and warns `Global assignment detected` for every one it finds, so a lent
 * name defined by plain assignment reads as a leak in every module evaluated after it. A non-enumerable
 * property stays out of `Object.keys` and in reach of every bare reference. Writable and configurable, so the
 * engine's own writes (`window.$tw = …`) and the bridge's restores still land.
 */
function lendGlobal(g: Record<string, unknown>, name: string, value: unknown): void {
  Object.defineProperty(g, name, { value, writable: true, configurable: true, enumerable: false });
}

/** Lend a name only where the global lacks it (`??=` semantics), non-enumerable. */
function lendGlobalIfAbsent(g: Record<string, unknown>, name: string, value: unknown): void {
  if (g[name] === undefined || g[name] === null) lendGlobal(g, name, value);
}

/** Put a name back as the bridge found it: the prior descriptor, or nothing. */
function restoreGlobal(g: Record<string, unknown>, name: string, prior: PropertyDescriptor | undefined): void {
  if (prior) Object.defineProperty(g, name, prior);
  else delete g[name];
}

/**
 * The scoped `window` lend. It admits a write to the names in `LENT_WINDOW_NAMES` and to nothing else: any
 * other property, a define and a delete each refuse by name, so the bundle never grows the worker global
 * through the lend. Reads pass: the bundle probes `window.crypto`, `window.performance` and the like, which a
 * worker holds. `onSjclWrite` fires on the first `sjcl` write, where the caller withdraws the global `window`
 * accessor.
 */
export function makeScopedWindowLend(onSjclWrite: () => void): Record<string, unknown> {
  let acceptedSjclWrite = false;
  const refuse = (act: string, key: string | symbol): never => {
    throw new Error(`CapabilityRefused: window.${String(key)} (${act}) — the worker lends \`window\` for the engine's own names (${[...LENT_WINDOW_NAMES].join(", ")}) and nothing else`);
  };
  return new Proxy(globalThis as unknown as Record<string, unknown>, {
    // A platform accessor (`crypto`, `performance`) answers only to the real global, so every read names it
    // as the receiver; a read through the proxy itself draws "Illegal invocation" from the browser.
    get(target, key) { return Reflect.get(target, key, target); },
    set(target, key, value) {
      if (typeof key !== "string" || !LENT_WINDOW_NAMES.has(key)) return refuse("write", key);
      lendGlobal(target, key, value);
      if (key === "sjcl" && !acceptedSjclWrite) {
        acceptedSjclWrite = true;
        onSjclWrite();
      }
      return true;
    },
    defineProperty(_target, key) { return refuse("define", key); },
    deleteProperty(_target, key) { return refuse("delete", key); },
  });
}

/**
 * HeadlessBootEnv — the composable shore of the headless-island TW5 boot.
 *
 * NOT a platform interface that node/browser "implement": it is exactly what
 * remains after subtracting the identical boot skeleton from the two runtimes —
 * three pieces the ONE boot flow (`loadTiddlyWikiFromBlob`) composes. The runtime
 * is chosen in `prepareHostBootInstance`; the rest of the flow is platform-blind.
 *
 *  - `resolveBuiltin` — native-first/shim-fallback `require` for the core blob:
 *    Node hands back real builtins (allowlist) via createRequire; a browser Worker
 *    hands back synthetic vm/path shims. `fs` is denied on both; the rest rejected.
 *  - `preSeedTw` — the `$tw` seed before blob-eval (a browser Worker pre-seeds
 *    `node:{}` so bootprefix loads the vm shim via `_load`; Node detects via real
 *    `process`).
 *  - `processArg` — the `process` value handed to the blob (real on Node, `undefined`
 *    in a browser Worker, where the eval'd core must see no Node process).
 */
interface HeadlessBootEnv {
  resolveBuiltin: (id: string) => unknown;
  preSeedTw:      Record<string, unknown>;
  processArg:     unknown;
}

async function makeNodeBootEnv(): Promise<HeadlessBootEnv> {
  const { createRequire } = await import("module");
  const nodeRequire = createRequire(import.meta.url);
  return {
    // Native-first: real Node builtins from the allowlist; fs denied; rest rejected.
    resolveBuiltin: (id: string): unknown => {
      if (id === "../package.json")          return { engines: { node: ">=18.0.0" } };
      if (id === "fs" || id === "node:fs")   return makeDeniedFsShim();
      if (TW5_NODE_BOOT_BUILTINS.has(id))    return nodeRequire(id);
      throw new Error(`TW5Engine: coreBlob attempted non-builtin require(${JSON.stringify(id)}) during boot`);
    },
    preSeedTw:  { boot: { suppressBoot: true } },
    processArg: process,
  };
}

function makeBrowserWorkerBootEnv(): HeadlessBootEnv {
  return {
    // Shim-fallback: a browser Worker has no createRequire/vm/path; synthesize them.
    resolveBuiltin: (id: string): unknown => {
      if (id === "../package.json")            return { engines: { node: ">=18.0.0" } };
      if (id === "fs"   || id === "node:fs")   return makeDeniedFsShim();
      if (id === "path" || id === "node:path") return makeBrowserPathShim();
      if (id === "vm"   || id === "node:vm")   return makeBrowserVmShim();
      if (id === "os"   || id === "node:os")   return makeBrowserOsShim();
      throw new Error(`TW5Engine: browser Worker coreBlob attempted require(${JSON.stringify(id)}) — Node built-ins unavailable`);
    },
    // node:{} so bootprefix (run immediately via _load) loads the vm shim instead
    // of detecting node=null and calling vm.createContext({}) with vm=undefined.
    // Neutralized (node=null, loadTiddlersNode stub) after blob eval, before boot().
    preSeedTw:  { boot: { suppressBoot: true }, node: {}, browser: null },
    // The eval-scoped `process` capability (the third runtime is neither browser nor node;
    // the host injects what the kernel's module-execute sandbox closes over). NOT undefined —
    // that was the 77389c01 regression that routed boot into the node `process.exit` branch.
    processArg: makeBrowserProcessShim(),
  };
}

/**
 * The ONE headless boot flow: evaluate the content-addressed core blob with a
 * CommonJS-shaped env composed from `env`, leaving the island's own `$tw` on
 * globalThis (its sovereign TW5 instance) and restoring the eval-only shims.
 */
function loadTiddlyWikiFromBlob(
  coreBlob: TW5CoreBootBlob | undefined,
  env: HeadlessBootEnv,
): { TiddlyWiki: () => unknown } {
  if (!coreBlob) {
    throw new Error("TW5Engine: headless boot requires coreBlob from LarariumDoc.");
  }

  const moduleShim: { exports: Record<string, unknown>; filename: string } = {
    exports: {},
    // TW5's node boot derives bootPath/corePath from module.filename. Keep it
    // virtual: the executable core arrives from coreBlob, and disk reads stay
    // disabled by the preloaded-tiddler boot path.
    filename: "/virtual/lararium/tiddlywiki/boot/boot.js",
  };
  const exportsShim = moduleShim.exports;
  const requireShim = env.resolveBuiltin;

  const g = globalThis as Record<string, unknown>;
  const priorTw      = Object.getOwnPropertyDescriptor(g, "$tw");
  const priorLoad    = g["_load"];
  const priorWindowDescriptor = Object.getOwnPropertyDescriptor(g, "window");
  // A page's own `window` cannot be redefined; the glass keeps it and the bundle's `window` parameter still carries the lend.
  const lendsWindow = priorWindowDescriptor?.configurable !== false;
  const removeWindowAccessor = (): void => { if (lendsWindow) restoreGlobal(g, "window", priorWindowDescriptor); };
  const windowLend = makeScopedWindowLend(removeWindowAccessor);
  const priorRequire = Object.getOwnPropertyDescriptor(g, "require");
  let twFromBlob: unknown;
  try {
    // The bundle gets the lend's two names (`LENT_WINDOW_NAMES`). It never receives the worker global or a
    // browser surface; the global accessor disappears at the first write of the crypto initialization.
    if (lendsWindow) Object.defineProperty(g, "window", { configurable: true, get: () => windowLend });
    lendGlobal(g, "require", requireShim);
    lendGlobal(g, "$tw", env.preSeedTw);
    // Evaluate with CommonJS-shaped `exports` so the standalone TW5 core (the
    // browser/server boot script TiddlyWiki emits) exposes `exports.TiddlyWiki`;
    // the bytes come from the content-addressed LarariumDoc blob, not a package.
    const source   = new TextDecoder().decode(new Uint8Array(coreBlob.bytes));
    const evaluate = new Function("exports", "module", "require", "window", "process", source);
    evaluate(exportsShim, moduleShim, requireShim, windowLend, env.processArg);
    twFromBlob = g["$tw"];
    if (twFromBlob && typeof twFromBlob === "object") {
      const tw = twFromBlob as Record<string, unknown>;
      tw["__larariumRequireShim"] = requireShim;
      tw["__larariumModuleShim"]  = moduleShim;
    }
  } finally {
    // Leave the blob's $tw on globalThis — it is the island's own sovereign TW5
    // instance; startup modules read `$tw.wiki` via globalThis.$tw. Restore only
    // the shims that were needed during blob evaluation.
    if (priorTw !== undefined) restoreGlobal(g, "$tw", priorTw);
    if (priorLoad    === undefined) delete g["_load"];   else g["_load"]   = priorLoad;
    removeWindowAccessor();
    restoreGlobal(g, "require", priorRequire);
  }

  if (typeof exportsShim["TiddlyWiki"] === "function") {
    return exportsShim as { TiddlyWiki: () => unknown };
  }
  if (twFromBlob && typeof twFromBlob === "object") {
    return { TiddlyWiki: () => twFromBlob };
  }
  throw new Error("TW5Engine: coreBlob did not yield a TiddlyWiki instance.");
}

/**
 * Forge the THIRD TW5 runtime — the island VM, neither browser nor node — on BOTH host paths. TW5's OWN
 * platform filter (`doesTaskMatchPlatform`) already builds it: with `$tw.browser` AND `$tw.node` both
 * null, the `["browser"]`/`["node"]` startup modules SKIP and the agnostic ones (load-modules,
 * startup, info, plugins, story) RUN — building `$tw.wiki` with no DOM and no render. The
 * engine stays byte-identical; we only inject the kernel's irreducible capabilities (the WASI
 * law) and neutralize the two platform tails the kernel calls unconditionally. A thin, named
 * shore — the rest of the surface belongs to injected/shadowing tiddlers. (`avaktavya`: the
 * third predication, neither-A-nor-B held as a first-class standpoint.)
 *
 * One forge for the Node `worker_thread` and the browser Worker: the engine names itself by its own
 * bytes, carries the CSS escape, and surfaces a boot error without ending the worker on either.
 */
function configureIslandRuntime(instance: TW5Instance, engineCid?: string): void {
  const tw = instance as unknown as Record<string, any>;
  tw.boot.argv = [];
  // Both platform flags null → the platform filter hands the post-kernel surface to our tiddlers.
  tw.node = null;
  tw.browser = null;
  // The two platform-gated loaders the kernel calls regardless (undefined in the third runtime).
  // Tiddlers arrive via preload, never from the DOM or the filesystem.
  tw.loadTiddlersBrowser = () => {};
  tw.loadTiddlersNode = () => {};
  // `boot.boot()` calls decryptEncryptedTiddlers unconditionally; it is defined only inside the
  // browser/node blocks. Headless: no crypt UI — proceed straight through.
  tw.boot.decryptEncryptedTiddlers = (cb: () => void) => cb();
  // readBrowserTiddlers:true steers initStartup AWAY from the node block (process/path/module);
  // paired with the no-op loadTiddlersBrowser above, it reads nothing from a (absent) DOM.
  tw.boot.tasks = { trapErrors: false, readBrowserTiddlers: true };
  // The ONE agnostic global-`document` leak: utils.extractVersionInfo() (startup.js) reads
  // `$tw.packageInfo.version` when set, else falls to `document.getElementsByTagName("meta")`.
  // Node sets packageInfo before startup; the island does the same — the version guard, not a
  // queryable fake DOM, is the root cure (every other `document.*` sits behind `if($tw.browser)`).
  // The version IS the engine's content-address (its CID = hearthTrueName) — source-ridden-along,
  // not a magic semver. A content-addressed engine has no version but the hash of its own bytes.
  tw.packageInfo ??= { name: "tiddlywiki", version: engineCid ?? "island-engine" };
  // TW5's utils-browser escapecss module reads window.CSS.escape. The island stays DOM-less;
  // provide the same CSS identifier contract as a pure worker capability instead of faking window.
  if (tw.utils) tw.utils.escapeCSS ??= escapeCssIdentifier;
  // The error reporter is the browser-XOR-node crash: `else if(!$tw.browser){ process.exit(1) }`.
  // Headless surfaces and continues — the island never aborts the worker on a boot warning — and
  // raises the fault on the wiki's alert rail where one stands, so a surface paints it and a
  // person reads an island that booted with a dead module as that, never as a green one.
  let faults = 0;
  if (tw.utils) tw.utils.error = (err: unknown): void => {
    const text = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("[island-tw5]", text);
    const wiki = tw.wiki as { addTiddler?: (t: unknown) => void } | undefined;
    if (typeof wiki?.addTiddler === "function" && typeof tw.Tiddler === "function") {
      wiki.addTiddler(new tw.Tiddler({ title: `$:/temp/lares/alert/boot-fault/${++faults}`, text, tags: ["$:/tags/Alert"], component: "island-boot", modified: new Date() }));
    }
  };
}

export async function prepareHostBootInstance(
  coreBlob?: TW5CoreBootBlob,
  options?: { glass?: true },
): Promise<{ instance: TW5Instance; isBrowser: boolean; release?: () => void }> {
  const isBrowserMain = typeof window !== "undefined" && typeof document !== "undefined";
  // Distinguish a browser Worker from a Node worker_thread by a POSITIVE browser signal:
  // `WorkerGlobalScope` exists in every browser worker context (dedicated/module/shared)
  // and is absent in Node + the browser main thread. Process-absence is NOT reliable —
  // Vite 8 / rolldown injects a `process` shim into the worker bundle, which made this
  // mis-detect as Node and call `await import("module")` (throws in a browser Worker).
  const isBrowserWorker = !isBrowserMain &&
    typeof (globalThis as Record<string, unknown>)["WorkerGlobalScope"] !== "undefined";

  if (isBrowserMain && !options?.glass) {
    // §9 sovereignty law: TW5 SHALL NOT instantiate on the main thread.
    // Every TW5Engine lives inside a sovereign Worker. Boot via browser-wiki-worker.ts only.
    throw new Error("TW5Engine: sovereignty violation — TW5 SHALL NOT instantiate on the main thread (§9). Boot TW5 in a Worker only.");
  }

  if (isBrowserMain) {
    const host = globalThis as Record<string, unknown>;
    const lent = ["global", "Buffer", "process", "setImmediate", "clearImmediate"] as const;
    const prior = lent.map(name => Object.getOwnPropertyDescriptor(host, name));
    let nextImmediate = 0;
    const immediate = new Map<number, () => void>();
    // TW5 module bodies resolve `global` by name; the glass lends an empty record, never the page's own scope.
    lendGlobalIfAbsent(host, "global", Object.create(null));
    // TW5's module sandbox names `Buffer` bare; an inert constructor keeps `instanceof Buffer` in page tooling callable.
    lendGlobalIfAbsent(host, "Buffer", function Buffer() { /* inert: the glass reads no Node buffers */ });
    // TW5's headless startup probes `process`; the shim holds no page authority.
    lendGlobalIfAbsent(host, "process", makeBrowserProcessShim());
    // TW5's headless nextTick may call `setImmediate` while booting.
    lendGlobalIfAbsent(host, "setImmediate", (fn: (...a: unknown[]) => void, ...args: unknown[]) => {
      const id = ++nextImmediate;
      immediate.set(id, () => fn(...args));
      queueMicrotask(() => { const run = immediate.get(id); immediate.delete(id); run?.(); });
      return id;
    });
    // TW5 may cancel that boot-time immediate by its matching name.
    lendGlobalIfAbsent(host, "clearImmediate", (id: number) => { immediate.delete(id); });
    const release = () => lent.forEach((name, i) => restoreGlobal(host, name, prior[i]));
    try {
      const instance = loadTiddlyWikiFromBlob(coreBlob, makeBrowserWorkerBootEnv()).TiddlyWiki() as TW5Instance;
      configureIslandRuntime(instance, coreBlob ? sha256HexBytesSync(coreBlob.bytes) : undefined);
      // A later widget refresh uses the page's microtask queue after the boot lends leave.
      instance.utils.nextTick = (callback: () => void) => queueMicrotask(callback);
      return { instance, isBrowser: true, release };
    } catch (error) {
      release();
      throw error;
    }
  }

  if (isBrowserWorker) {
    // Headless-island environment contract (the kupono lift): TW5's core UMD +
    // startup modules read Node's `global`. A browser Worker has none — but its
    // globalThis IS the island's sovereign scope, so alias `global` to it,
    // isomorphic with what a Node worker_thread exposes for free. Set permanently
    // (not a restored boot shim): in the headless island `global` legitimately
    // === globalThis. Completes the window/require/vm/path/fs synthetics this
    // module already presents — the last missing Node-ism the browser must supply.
    lendGlobalIfAbsent(globalThis as Record<string, unknown>, "global", globalThis);
    // The browser vessel's TW5-platform capability shore (role = capability ≠ platform, the
    // isomorphic-worker-VM law — cf. makeCaptureEngine's CaptureFlush/Reserve shores). The
    // kernel's module-execute sandbox (boot.js §execute) runs each module global-scoped via
    // `new Function`, so its bare `process`/`Buffer`/`global` references resolve to globalThis,
    // NOT the boot eval's processArg. The island injects them here — not detected, supplied —
    // lent only where the host lacks them, so any the bundler already provides stand.
    lendGlobalIfAbsent(globalThis as Record<string, unknown>, "Buffer", {});
    lendGlobalIfAbsent(globalThis as Record<string, unknown>, "process", makeBrowserProcessShim());
    // TW5 boots with node={} (so bootprefix loads the vm shim, not the browser DOM
    // path), so its core `$tw.utils.nextTick` binds the Node branch — a BARE
    // `setImmediate`, which the module sandbox resolves to globalThis. A browser
    // Worker has none, so a post-mount render (a story-navigation beat — the daemon
    // switcher surfacing) threw `setImmediate is not defined`. Supply it (macrotask
    // parity, arg-forwarding), the same "last missing Node-ism" contract as global/
    // process/Buffer above, lent only where the host lacks it.
    lendGlobalIfAbsent(globalThis as Record<string, unknown>, "setImmediate", (fn: (...a: unknown[]) => void, ...args: unknown[]) => setTimeout(fn, 0, ...args));
    lendGlobalIfAbsent(globalThis as Record<string, unknown>, "clearImmediate", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));

    const instance = loadTiddlyWikiFromBlob(coreBlob, makeBrowserWorkerBootEnv()).TiddlyWiki() as unknown as TW5Instance;
    // Forge the THIRD runtime AFTER blob eval, BEFORE boot.boot(). The engine's own content-
    // address (= the coreHash the kernel's integrity gate witnesses) rides along as its version.
    configureIslandRuntime(instance, coreBlob ? sha256HexBytesSync(coreBlob.bytes) : undefined);

    // The VM itself is the third runtime, but the outer bridge still runs in a browser Worker:
    // keep Node's require/module shims out of TW5's module evaluator.
    return { instance, isBrowser: true };
  }

  const instance = loadTiddlyWikiFromBlob(coreBlob, await makeNodeBootEnv()).TiddlyWiki() as unknown as TW5Instance;
  configureIslandRuntime(instance, coreBlob ? sha256HexBytesSync(coreBlob.bytes) : undefined);
  return { instance, isBrowser: false };
}

export async function bootWithHostBridge(
  instance: TW5Instance,
  isBrowser: boolean,
  onBoot: () => void | Promise<void>,
): Promise<void> {
  await new Promise<void>((resolve) => {
    let restoreStdout: (() => void) | null = null;
    const proc = (globalThis as Record<string, unknown>).process as (typeof process) | undefined;
    if (proc?.stdout?.write) {
      const orig = proc.stdout.write.bind(proc.stdout);
      proc.stdout.write = () => true;
      restoreStdout = () => { proc.stdout.write = orig; };
    }

    const hostGlobal = globalThis as Record<string, unknown>;
    const savedRequire = Object.getOwnPropertyDescriptor(hostGlobal, "require");
    const savedModule  = Object.getOwnPropertyDescriptor(hostGlobal, "module");
    const browserRequire = isBrowser
      ? (id: string): Record<string, unknown> => {
          const hostShim = (instance as unknown as Record<string, unknown>)["__larariumRequireShim"] as
            ((name: string) => Record<string, unknown>) | undefined;
          if (hostShim && TW5_BROWSER_BOOT_BUILTINS.has(id)) return hostShim(id);
          // TW5's third runtime keeps both platform flags clear. Resolve only engine module-table
          // names here; known boot host names use their injected shim, and every other name refuses.
          if (id.startsWith("$:/")) return instance.modules.execute(id);
          throw new Error(`[wiki-worker] capability refused: unresolved TW5 host module ${JSON.stringify(id)}`);
        }
      : undefined;
    const nodeRequireShim = !isBrowser ? (instance as unknown as Record<string, unknown>)["__larariumRequireShim"] : undefined;
    const nodeModuleShim  = !isBrowser ? (instance as unknown as Record<string, unknown>)["__larariumModuleShim"]  : undefined;
    if (browserRequire) {
      // TW5 module bodies use a direct `require` parameter. Browser Workers need that name,
      // but its authority is the island's TW5 module table, never Node builtins.
      lendGlobal(hostGlobal, "require", browserRequire);
    } else {
      if (nodeRequireShim) lendGlobal(hostGlobal, "require", nodeRequireShim);
      if (nodeModuleShim)  lendGlobal(hostGlobal, "module", nodeModuleShim);
    }

    instance.boot.boot(() => {
      restoreStdout?.();
      if (browserRequire || !isBrowser) restoreGlobal(hostGlobal, "require", savedRequire);
      if (!isBrowser) restoreGlobal(hostGlobal, "module", savedModule);
      Promise.resolve(onBoot()).then(() => resolve()).catch(() => resolve());
    });
  });
}
