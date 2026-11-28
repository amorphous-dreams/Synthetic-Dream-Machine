/**
 * host-globals-now — the lend at module load, for a startup module whose own imports hash while they load.
 *
 * A TW5 server executes every startup module's code before any startup function runs, so `modules/host-globals`'s lend (a
 * startup function) arrives too late for a module whose import tree builds a hash or an encoder at load (`modules/watch`, over
 * `@lararium/mesh/crypto`). Imported FIRST, this module lends the host's `TextEncoder` and `crypto` before the imports after
 * it evaluate; `??=` inside the lend keeps any global the runtime already holds, so a browser or a worker reads it as a no-op.
 */
import { lendHostGlobals } from "./host-globals-lend.js";

lendHostGlobals(globalThis, typeof process === "undefined" ? undefined : process);
