/**
 * live-protocol.ts — ReactionBinding, ReactionGraph, ReactionHandler, extractReactionBindings.
 *
 * Provides the wiring substrate for `ReactionEngine` (kumu-device.ts).
 *
 * Design vocabulary (from ast.ts):
 *   papalohe pranala edge  — instance-level OUTPUT→INPUT wiring (editor pin-wire)
 *   listenable             — OUTPUT event pin on a source kumu device
 *   subscribable           — INPUT fn pin on a target kumu device
 *
 * A `ReactionBinding` represents one papalohe edge: when `fromUri` emits `listenable`,
 * call `toUri.subscribable`. The graph holds all active bindings and routes `fireSync`
 * calls to the correct handlers.
 *
 * Isomorphic: no Node/browser APIs. Works in main thread, Worker, and browser.
 *
 * Meme: lar:///ha.ka.ba/@lararium/mesh/v0.1/live-protocol
 */
/**
 * Holds the active set of `ReactionBinding` records and routes `fireSync` calls
 * to subscribed handlers.
 *
 * Two subscription surfaces:
 *   subscribe(fromUri, listenable, handler) — direct source-pin subscription
 *   subscribeByFn(fnName, handler)          — target-fn subscription (catches all matching bindings)
 *
 * Additional monitoring hook:
 *   onFireSync(observer) — observe EVERY fireSync call (used by Worker forwarding).
 *                          Fires before handler dispatch.
 *
 * `fireSync` dispatch order:
 *   1. onFireSync observers (monitoring)
 *   2. Direct handlers for (fromUri, listenable)
 *   3. Per-fn handlers for each binding where fromUri+listenable matches (via subscribable name)
 */
export class ReactionGraph {
    // Bindings stored per source URI for O(|bindings per uri|) lookup.
    _byFrom = new Map();
    // Direct subscriptions: key = "${fromUri}\0${listenable}"
    _direct = new Map();
    // Fn-name subscriptions: key = subscribable fn name (or "*" wildcard)
    _byFn = new Map();
    // Monitoring observers (fired before handlers on every fireSync)
    _fireSyncObs = new Set();
    // ---------------------------------------------------------------------------
    // Bindings API
    // ---------------------------------------------------------------------------
    /** All current bindings as a flat readonly array. */
    get bindings() {
        const result = [];
        for (const list of this._byFrom.values())
            result.push(...list);
        return result;
    }
    /** Replace the entire binding set. */
    load(bindings) {
        this._byFrom.clear();
        for (const b of bindings)
            this._addBinding(b);
    }
    /** Replace all bindings that reference `uri` (as fromUri OR toUri). */
    updateUri(uri, bindings) {
        this.removeUri(uri);
        for (const b of bindings)
            this._addBinding(b);
    }
    /** Remove all bindings that reference `uri` (as fromUri OR toUri). */
    removeUri(uri) {
        // Remove direct entries where fromUri === uri
        this._byFrom.delete(uri);
        // Remove dangling toUri refs from other from-groups
        for (const [fromUri, list] of this._byFrom) {
            const filtered = list.filter((b) => b.toUri !== uri);
            if (filtered.length === 0)
                this._byFrom.delete(fromUri);
            else if (filtered.length !== list.length)
                this._byFrom.set(fromUri, filtered);
        }
    }
    _addBinding(b) {
        let list = this._byFrom.get(b.fromUri);
        if (!list) {
            list = [];
            this._byFrom.set(b.fromUri, list);
        }
        list.push(b);
    }
    // ---------------------------------------------------------------------------
    // Subscription API
    // ---------------------------------------------------------------------------
    /**
     * Subscribe to events emitted by `fromUri` with name `listenable`.
     * Returns a cancellation function.
     * Analogous to Verse `sourceDevice.OutputEvent.Subscribe(handler)`.
     */
    subscribe(fromUri, listenable, handler) {
        const key = `${fromUri}\0${listenable}`;
        let set = this._direct.get(key);
        if (!set) {
            set = new Set();
            this._direct.set(key, set);
        }
        set.add(handler);
        return () => { set.delete(handler); };
    }
    /**
     * Subscribe by target fn name. Fires whenever a binding routes to `fnName`.
     * Pass `"*"` as a wildcard to receive all fn-routed dispatches.
     * Returns a cancellation function.
     * Analogous to Verse `@subscribes Enable()` — wired from any matching binding.
     */
    subscribeByFn(fnName, handler) {
        let set = this._byFn.get(fnName);
        if (!set) {
            set = new Set();
            this._byFn.set(fnName, set);
        }
        set.add(handler);
        return () => { set.delete(handler); };
    }
    /**
     * Single-shot: resolves with the next `payload` from `(fromUri, listenable)`.
     * Analogous to Verse `Await(event)<suspends>` (kukali primitive).
     */
    subscribeOnce(fromUri, listenable) {
        return new Promise((resolve) => {
            const unsub = this.subscribe(fromUri, listenable, (payload) => {
                unsub();
                resolve(payload);
            });
        });
    }
    /**
     * Register an observer that receives EVERY `fireSync` call before handler dispatch.
     * Intended for cross-boundary forwarding (e.g. Worker → main thread bridge).
     * Returns a cancellation function.
     */
    onFireSync(observer) {
        this._fireSyncObs.add(observer);
        return () => { this._fireSyncObs.delete(observer); };
    }
    // ---------------------------------------------------------------------------
    // Dispatch
    // ---------------------------------------------------------------------------
    /**
     * Synchronously dispatch an event — UEFN game-loop tick fidelity.
     *
     * Dispatch order:
     *   1. onFireSync observers (monitoring — full context available)
     *   2. Direct handlers for (fromUri, listenable)
     *   3. Per-fn handlers for every binding where fromUri+listenable matches
     *      (including wildcard "*" subscribers — fired once per fireSync call)
     */
    fireSync(fromUri, listenable, payload = {}) {
        // 1. Monitoring observers
        for (const obs of this._fireSyncObs) {
            try {
                obs(fromUri, listenable, payload);
            }
            catch { /* isolate observer errors */ }
        }
        // 2. Direct (fromUri, listenable) handlers
        const directKey = `${fromUri}\0${listenable}`;
        const directSet = this._direct.get(directKey);
        if (directSet) {
            for (const h of directSet)
                try {
                    h(payload);
                }
                catch { /* isolate */ }
        }
        // 3. Binding-routed dispatch → per-fn handlers
        const fromList = this._byFrom.get(fromUri);
        if (!fromList)
            return;
        const wildcard = this._byFn.get("*");
        let wildcardFired = false;
        for (const b of fromList) {
            if (b.listenable !== listenable)
                continue;
            const fnSet = this._byFn.get(b.subscribable);
            if (fnSet) {
                for (const h of fnSet)
                    try {
                        h(payload);
                    }
                    catch { /* isolate */ }
            }
            // Wildcard fires once per fireSync call (not once per matching binding)
            if (wildcard && !wildcardFired) {
                wildcardFired = true;
                for (const h of wildcard)
                    try {
                        h(payload);
                    }
                    catch { /* isolate */ }
            }
        }
    }
}
// ---------------------------------------------------------------------------
// extractReactionBindings — derive bindings from a flat edge list
// ---------------------------------------------------------------------------
/**
 * Extract `ReactionBinding` records from a flat edge list.
 *
 * Identifies papalohe instance-level wiring edges by requiring:
 *   - `payload.listenable`  — non-empty string (source OUTPUT event name)
 *   - `payload.subscribable` — non-empty string (target INPUT fn name)
 *   - `fromUri` and `toUri` both present (wiring requires both endpoints)
 *
 * All extracted bindings carry `source: "wired"` (wiki-AST origin).
 *
 * Ignores type-level `reaction:listenable` / `reaction:subscribable` declarations —
 * those carry only one of the two payload fields and declare the pin type, not a wire.
 */
export function extractReactionBindings(edges) {
    const result = [];
    for (const e of edges) {
        if (!e.fromUri || !e.toUri)
            continue;
        const listenable = e.payload["listenable"];
        const subscribable = e.payload["subscribable"];
        if (typeof listenable === "string" && listenable.length > 0 &&
            typeof subscribable === "string" && subscribable.length > 0) {
            result.push({
                fromUri: e.fromUri,
                toUri: e.toUri,
                listenable,
                subscribable,
                source: "wired",
            });
        }
    }
    return result;
}
//# sourceMappingURL=live-protocol.js.map