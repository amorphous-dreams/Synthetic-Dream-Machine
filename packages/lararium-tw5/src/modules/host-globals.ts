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
 * The lend itself lives in `host-globals-lend` and defines each global NON-ENUMERABLE, so the fork's
 * per-module `globalCheck` never reports it as a leak. The deserializer calls the same lend at its own
 * entry, so a reader reached before this startup module runs holds too.
 */
import { lendHostGlobals } from "../host-globals-lend.js";

export const name = "lar-host-globals";
export const synchronous = true;
export const before = ["startup"];

export function startup(): void {
  // `process` reaches a sandboxed module as a wrapper PARAMETER, never as a property of `globalThis`.
  lendHostGlobals(globalThis, typeof process === "undefined" ? undefined : process);
}
