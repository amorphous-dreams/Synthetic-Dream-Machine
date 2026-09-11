/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/host-globals
type: application/javascript
module-type: startup
\*/
/**
 * host-globals — lend the module sandbox the web globals the host already holds.
 *
 * A plain TiddlyWiki server executes every module in ONE shared `vm.createContext({})`
 * (`boot.js` `$tw.utils.sandbox`), lending it `Buffer`, `process`, timers and `$tw` — no `TextEncoder`,
 * no `crypto`. The meme gate hashes through `new TextEncoder()`, so without this shore every hashing
 * module (the routes, the grammar cache, the deserializer past boot) dies on a plain server with
 * `TextEncoder is not defined`. Node ≥ 24 hands the host's own copies back through
 * `process.getBuiltinModule`; `??=` respects any global the runtime already holds, so a browser or a
 * lararium worker (both already carry them) reads this as a no-op.
 *
 * What this cannot reach: a carrier deserialized DURING boot, before any startup module runs. That
 * slot belongs to `boot.js` lending the globals into the context it creates.
 */

export const name = "lar-host-globals";
export const synchronous = true;
export const before = ["startup"];

interface HostGlobals {
  TextEncoder?: unknown;
  TextDecoder?: unknown;
  crypto?: unknown;
}

export function startup(): void {
  const g = globalThis as HostGlobals;
  if (g.TextEncoder && g.TextDecoder && g.crypto) return;
  // `process` reaches a sandboxed module as a wrapper PARAMETER, never as a property of `globalThis`.
  if (typeof process === "undefined") return;
  const builtin = (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  if (typeof builtin !== "function") return;
  const util = builtin("node:util") as { TextEncoder: unknown; TextDecoder: unknown };
  const nodeCrypto = builtin("node:crypto") as { webcrypto: unknown };
  g.TextEncoder ??= util.TextEncoder;
  g.TextDecoder ??= util.TextDecoder;
  g.crypto ??= nodeCrypto.webcrypto;
}
