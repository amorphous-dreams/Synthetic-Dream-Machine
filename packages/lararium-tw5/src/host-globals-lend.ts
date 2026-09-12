/**
 * host-globals-lend — lend a module sandbox the web globals its host already holds.
 *
 * A plain TiddlyWiki server evaluates every module inside ONE `vm.createContext({})` that carries
 * `Buffer`, `process`, timers and `$tw` — no `TextEncoder`, no `crypto`. The meme laws hash through
 * `new TextEncoder()`, so without this lend every hashing path dies on a plain server with
 * `TextEncoder is not defined`. Node ≥ 24 hands the host's own copies back through
 * `process.getBuiltinModule`.
 *
 * NON-ENUMERABLE, and that carries the whole point of the property descriptor: after each module body
 * the fork's `globalCheck` enumerates the sandbox's own keys and warns `Global assignment detected` for
 * every one it finds. A lent global defined as a plain assignment reads as a leak in every module
 * evaluated afterwards — 47 warning lines on a stock `--render`. A non-enumerable property stays out
 * of `Object.keys` and in reach of every `new TextEncoder()`.
 *
 * A host that already holds a global keeps it: a browser, a lararium worker and a Node main thread
 * all carry the three, so the lend reads as a no-op there.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/modules/host-globals
 */

interface HostGlobals {
  TextEncoder?: unknown;
  TextDecoder?: unknown;
  crypto?: unknown;
}

/** The slice of `process` the lend reads. Sandboxed modules receive `process` as a wrapper PARAMETER,
 *  never as a property of `globalThis`, so the caller passes it in. */
export interface BuiltinHost {
  getBuiltinModule?: (id: string) => unknown;
}

/** Define one global where the sandbox lacks it — non-enumerable, so a leak check never lists it. */
function lend(g: HostGlobals, name: keyof HostGlobals, value: unknown): void {
  if (g[name] !== undefined && g[name] !== null) return;
  Object.defineProperty(g, name, { value, writable: true, configurable: true, enumerable: false });
}

/**
 * Lend `TextEncoder`, `TextDecoder` and `crypto` into `g` where they stand absent. Idempotent; silent
 * where `process.getBuiltinModule` stands out of reach (a browser, a worker, an older Node).
 */
export function lendHostGlobals(g: HostGlobals = globalThis as HostGlobals, host: BuiltinHost | undefined): void {
  if (g.TextEncoder && g.TextDecoder && g.crypto) return;
  const builtin = host?.getBuiltinModule;
  if (typeof builtin !== "function") return;
  const util = builtin("node:util") as { TextEncoder: unknown; TextDecoder: unknown };
  const nodeCrypto = builtin("node:crypto") as { webcrypto: unknown };
  lend(g, "TextEncoder", util.TextEncoder);
  lend(g, "TextDecoder", util.TextDecoder);
  lend(g, "crypto", nodeCrypto.webcrypto);
}
