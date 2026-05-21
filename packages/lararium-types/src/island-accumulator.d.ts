/**
 * IslandAccumulator — frame-aligned CRDT patch buffer for the Verse mesh.
 *
 * Sits between MemeProvider (Automerge patch fan-out) and the TW5 wiki.
 * Buffers live crdt-remote changes that arrive after the initial sync replay
 * completes; the render loop (rAF browser / setInterval Node) drains the
 * queue into one wiki.transact() per frame.
 *
 * Responsibility split:
 *   IslandAdaptor — initial replay buffering + onSyncComplete batch flush
 *                   + non-CRDT immediate apply + outbound saveTiddler/deleteTiddler
 *   IslandAccumulator — live crdt-remote buffering + frame-aligned drain
 *
 * Platform-agnostic: no requestAnimationFrame import. The render loop in
 * TW5Engine.startRenderLoop() (browser) or a setInterval caller (Node)
 * drives flushAll() on IslandAdaptor.
 *
 * Spec: lar:///ha.ka.ba/@lares/api/v0.1/lararium/island-accumulator
 */
import type { LarTiddlerChange } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
export declare class IslandAccumulator implements MemeProjection {
    private readonly _queue;
    private _syncReady;
    /**
     * MemeProjection.onSyncComplete — marks the initial replay as settled.
     * Only after this fires does the accumulator start buffering live changes.
     * Before it fires, IslandAdaptor owns the initial-replay buffer + batch flush.
     */
    onSyncComplete(_islandId?: string): void;
    /**
     * MemeProjection.onUriChanged — buffers live crdt-remote changes.
     *
     * Skips:
     *   - changes that arrive before initial sync completes (IslandAdaptor handles those)
     *   - non-CRDT origins (canon-hydrate, lares-command, tw-local — IslandAdaptor
     *     applies those immediately via _applyChange)
     */
    onUriChanged(change: LarTiddlerChange): void;
    /** Drain up to `budget` changes from the queue. Caller applies the returned batch. */
    drain(budget?: number): LarTiddlerChange[];
    /** Number of changes waiting in the queue. */
    get pending(): number;
    /** True after the initial sync replay settled — accumulator now accepts live changes. */
    get syncReady(): boolean;
}
//# sourceMappingURL=island-accumulator.d.ts.map