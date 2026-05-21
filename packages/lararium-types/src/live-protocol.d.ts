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
 * Instance-level wiring: when `fromUri` emits `listenable`, call `toUri.subscribable`.
 *
 * Derived from papalohe pranala edges (UEFN editor pin-wire).
 *   source = "wired"      — edge originated from the wiki AST (editor-wired)
 *   source = "subscribed" — edge added at runtime via Subscribe() call in code
 */
export interface ReactionBinding {
    readonly fromUri: string;
    readonly toUri: string;
    readonly listenable: string;
    readonly subscribable: string;
    readonly source: "wired" | "subscribed";
}
/** Handler called when a bound reaction fires. Payload carries the event context. */
export type ReactionHandler = (payload: unknown) => void;
/**
 * Minimal edge shape required by `extractReactionBindings`.
 * Matches the `PranalaEdge` interface from `@lararium/mesh/ast`.
 */
export interface EdgeLike {
    readonly fromUri: string;
    readonly toUri: string;
    readonly family: string;
    readonly role: string | null;
    readonly payload: Record<string, unknown>;
}
type FireSyncObserver = (fromUri: string, listenable: string, payload: unknown) => void;
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
export declare class ReactionGraph {
    private readonly _byFrom;
    private readonly _direct;
    private readonly _byFn;
    private readonly _fireSyncObs;
    /** All current bindings as a flat readonly array. */
    get bindings(): readonly ReactionBinding[];
    /** Replace the entire binding set. */
    load(bindings: ReactionBinding[]): void;
    /** Replace all bindings that reference `uri` (as fromUri OR toUri). */
    updateUri(uri: string, bindings: ReactionBinding[]): void;
    /** Remove all bindings that reference `uri` (as fromUri OR toUri). */
    removeUri(uri: string): void;
    private _addBinding;
    /**
     * Subscribe to events emitted by `fromUri` with name `listenable`.
     * Returns a cancellation function.
     * Analogous to Verse `sourceDevice.OutputEvent.Subscribe(handler)`.
     */
    subscribe(fromUri: string, listenable: string, handler: ReactionHandler): () => void;
    /**
     * Subscribe by target fn name. Fires whenever a binding routes to `fnName`.
     * Pass `"*"` as a wildcard to receive all fn-routed dispatches.
     * Returns a cancellation function.
     * Analogous to Verse `@subscribes Enable()` — wired from any matching binding.
     */
    subscribeByFn(fnName: string, handler: ReactionHandler): () => void;
    /**
     * Single-shot: resolves with the next `payload` from `(fromUri, listenable)`.
     * Analogous to Verse `Await(event)<suspends>` (kukali primitive).
     */
    subscribeOnce(fromUri: string, listenable: string): Promise<unknown>;
    /**
     * Register an observer that receives EVERY `fireSync` call before handler dispatch.
     * Intended for cross-boundary forwarding (e.g. Worker → main thread bridge).
     * Returns a cancellation function.
     */
    onFireSync(observer: FireSyncObserver): () => void;
    /**
     * Synchronously dispatch an event — UEFN game-loop tick fidelity.
     *
     * Dispatch order:
     *   1. onFireSync observers (monitoring — full context available)
     *   2. Direct handlers for (fromUri, listenable)
     *   3. Per-fn handlers for every binding where fromUri+listenable matches
     *      (including wildcard "*" subscribers — fired once per fireSync call)
     */
    fireSync(fromUri: string, listenable: string, payload?: unknown): void;
}
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
export declare function extractReactionBindings(edges: readonly EdgeLike[]): ReactionBinding[];
export {};
//# sourceMappingURL=live-protocol.d.ts.map