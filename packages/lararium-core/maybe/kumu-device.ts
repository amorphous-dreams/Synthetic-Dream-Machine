/**
 * kumu-device.ts — KumuDeviceSpec + ReactionEngine.
 *
 * ## Verse 5.6+ device model (NOT Blueprint)
 *
 * UEFN Verse 5.6+ uses pure composition — no class inheritance for behavior.
 * A `creative_device` class gains behavior by:
 *   - Declaring `listenable` event values as OUTPUT pins (others subscribe to them)
 *   - Declaring callable `@subscribes` functions as INPUT function pins (others call them)
 *   - Using `using` to compose traits (Lararium: `control:implements` pranala edges)
 *
 * Wiring is type-safe and directional:
 *   sourceDevice.OutputEvent → targetDevice.InputHandler
 *
 * Verse async: `Await(event)<suspends>` = single-shot coroutine (our `subscribeOnce()`).
 * Verse sync tick: game-loop actors fire in declaration order — our `fireSync()` + `onChangeset`.
 *
 * ## Lararium vocabulary mapping
 *
 *   Verse `listenable` event   → `KumuListenable`     (OUTPUT pin; `reaction:listenable` role)
 *   Verse `@subscribes` fn     → `KumuSubscribable`   (INPUT fn pin; `reaction:subscribable` role)
 *   Verse `using` / trait      → `control:implements` pranala edge → `KumuDeviceSpec.traits`
 *   UEFN editor event→fn wire  → `papalohe` pranala edge (instance-level binding)
 *   `Await(event)<suspends>`   → `ReactionGraph.subscribeOnce()`
 *   UEFN game-loop actor tick  → `ReactionEngine.onChangeset()` — Scale-3 synchronous tick
 *
 * ## KumuDeviceSpec
 *   Isomorphic type describing a kumu device type. Derived from the type meme's
 *   pranala edge list (not from class hierarchy — there is none).
 *
 *   Two identity layers per instance (both tiddlers in the room doc):
 *     lar:///type-path#name-fragment  — user-selected friendly name (human label)
 *     lar:///type-path#uuid-fragment  — crypto.randomUUID() stable wiring address
 *   Declared in the type meme body via <<~ kahea kau #fragment >> sigils.
 *
 * ## ReactionEngine
 *   MemeProjection that routes CRDT change events through a ReactionGraph.
 *   Scale-1/2 (onUriChanged): fires all unique listenables for the changed URI.
 *   Scale-3 (onChangeset):    one synchronous tick across all changed URIs.
 *
 * Isomorphic: no Node/browser APIs. Works in Node, browser, and TW5-era environments.
 */

import type { LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import type { ReactionBinding } from "./live-protocol.js";
import { extractReactionBindings, ReactionGraph } from "./live-protocol.js";
import { parseMemeEdges } from "./meme-ast/index.js";
import type { ReactionHandler } from "./live-protocol.js";

// ---------------------------------------------------------------------------
// KumuListenable / KumuSubscribable — UEFN Verse 5.6+ pin vocabulary
// ---------------------------------------------------------------------------

/**
 * A named `listenable` event this kumu device EMITS (Verse OUTPUT pin).
 * In Verse: `OnActivated : listenable([]void) = event[]void{}`
 * Others subscribe to this event; declared via `reaction:listenable` pranala edges.
 * e.g. "OnActivated", "OnDamaged", "OnExploded"
 */
export interface KumuListenable {
  /** Event name — e.g. "OnActivated", "OnDamaged", "OnReset". */
  readonly name: string;
  readonly description?: string;
}

/**
 * A named subscribable function this kumu device EXPOSES (Verse INPUT function pin).
 * In Verse: `Enable()<suspends>` decorated with `@subscribes`.
 * Others call this function by wiring their listenable to it; declared via `reaction:subscribable` pranala edges.
 * e.g. "Enable", "Disable", "SetDamage"
 */
export interface KumuSubscribable {
  /** Handler name — e.g. "Enable", "Disable", "SetDamage". */
  readonly name: string;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// KumuDeviceSpec — type-level device description
// ---------------------------------------------------------------------------

/**
 * Describes a kumu device type (Verse 5.6+ composition model).
 *
 * Derived from the type meme's pranala edge list — not from a class hierarchy.
 *
 *   listenables   ← `reaction:listenable` edges where `fromUri === typeUri`
 *                  payload.listenable = event name (Verse `listenable` OUTPUT pin)
 *   subscribables ← `reaction:subscribable` edges where `fromUri === typeUri`
 *                  payload.subscribable = handler name (Verse `@subscribes` INPUT pin)
 *   slots        ← ahu socket URIs declared within the type meme (Verse `@editable`)
 *   traits       ← `control:implements` edges out of the type meme (Verse `using` trait)
 */
export interface KumuDeviceSpec {
  /** Canonical type URI (no fragment). e.g. `lar:///sdm/devices/button` */
  readonly typeUri: string;
  /** Listenable events this device type emits — OUTPUT pins (Verse `listenable`). */
  readonly listenables: readonly KumuListenable[];
  /** Subscribable functions this device type exposes — INPUT pins (Verse `@subscribes`). */
  readonly subscribables: readonly KumuSubscribable[];
  /** Ahu slot URIs declared on this type (Verse `@editable` attributes). */
  readonly slots: readonly string[];
  /** Trait type URIs this device implements (control:implements edges — Verse `using`). */
  readonly traits: readonly string[];
}

// ---------------------------------------------------------------------------
// KumuInstanceRef — runtime device instance address
// ---------------------------------------------------------------------------

/**
 * Identifies a live kumu device instance.
 *
 * Both fragments produce tiddler addresses in the room Automerge doc:
 *   lar:///type-path#nameFragment  — human-readable room-local label
 *   lar:///type-path#uuidFragment  — stable UUID address for wiring
 */
export interface KumuInstanceRef {
  readonly typeUri: string;
  /** User-selected friendly name fragment (e.g. "player-spawn-a"). */
  readonly nameFragment: string;
  /** crypto.randomUUID() — stable wiring address. */
  readonly uuidFragment: string;
}

/** Derive both tiddler title URIs from a KumuInstanceRef. */
export function kumuInstanceUris(ref: KumuInstanceRef): { named: string; uuid: string } {
  return {
    named: `${ref.typeUri}#${ref.nameFragment}`,
    uuid:  `${ref.typeUri}#${ref.uuidFragment}`,
  };
}

// ---------------------------------------------------------------------------
// kumuDeviceSpecFromEdges — derive KumuDeviceSpec from a flat edge list
// ---------------------------------------------------------------------------

/**
 * Minimal edge shape required by `kumuDeviceSpecFromEdges`.
 * Matches the `PranalaEdge` interface from `@lararium/core/ast`.
 */
interface EdgeLike {
  fromUri: string;
  toUri:   string;
  family:  string;
  role:    string | null;
  payload: Record<string, unknown>;
}

/**
 * Derive a `KumuDeviceSpec` from the flat edge list for a type meme.
 *
 * Pass the result of `parseMemeEdges(typeUri, text)` directly — `PranalaEdge`
 * satisfies the `EdgeLike` shape.
 *
 * events   ← `reaction:triggers` edges with `fromUri === typeUri`; name = payload.trigger
 * handlers ← `reaction:handles` edges with `fromUri === typeUri`; name = payload.fn
 * slots    ← inferred from ahu socket URIs (caller must pass; no AST field for these yet)
 * traits   ← `control:implements` edges; toUri = trait type URI (Verse `using`)
 */
export function kumuDeviceSpecFromEdges(
  typeUri: string,
  edges:   readonly EdgeLike[],
  slots:   readonly string[] = [],
): KumuDeviceSpec {
  const listenables:   KumuListenable[]   = [];
  const subscribables: KumuSubscribable[] = [];
  const traits:        string[]           = [];

  for (const e of edges) {
    if (e.fromUri !== typeUri) continue;

    if (e.family === "reaction") {
      const desc = e.payload["description"] as string | undefined;

      if (e.role === "listenable") {
        // OUTPUT pin — listenable event this device emits (Verse `listenable`)
        const name = e.payload["listenable"] as string | undefined;
        if (name) listenables.push(desc ? { name, description: desc } : { name });
      } else if (e.role === "subscribable") {
        // INPUT pin — subscribable function this device exposes (Verse `@subscribes`)
        const name = e.payload["subscribable"] as string | undefined;
        if (name) subscribables.push(desc ? { name, description: desc } : { name });
      }
      // roles: observes, throttles, debounces — not reflected in spec
    }

    if (e.family === "control" && e.role === "implements") {
      // toUri is the trait type URI (Verse `using` target)
      if (e.toUri && e.toUri !== typeUri) traits.push(e.toUri);
    }
  }

  return { typeUri, listenables, subscribables, slots, traits };
}

// ---------------------------------------------------------------------------
// ReactionEngine — MemeProjection that routes change events through ReactionGraph
// ---------------------------------------------------------------------------

// Minimal wiki surface needed for boot scan — avoids @lararium/tw5 import.
interface BootScanSurface {
  filterTiddlers(filter: string): string[];
  getTiddlerText(uri: string): string | undefined;
}

function _bindingsFromText(uri: string, text: string): ReactionBinding[] {
  try {
    const edges = parseMemeEdges(uri, text);
    return extractReactionBindings(
      edges.map((e) => ({
        fromUri: e.fromUri, toUri: e.toUri,
        family:  e.family,  role:  e.role,
        payload: e.payload,
      }))
    );
  } catch { return []; }
}

/**
 * Routes CRDT change events through a ReactionGraph, and owns the graph.
 *
 * Replaces the web2 buildReactionGraph / bindingsForUri wiki-scan pattern.
 * Call boot() once after TW5Engine.boot() for the initial full scan;
 * onUriChanged() maintains the graph incrementally thereafter.
 *
 * Usage:
 *   const engine = new ReactionEngine();
 *   engine.boot(tw5);
 *   peer.store.addProjection(engine);
 *   engine.subscribeByFn("navigate", handler);
 */
export class ReactionEngine implements MemeProjection {
  private readonly _graph: ReactionGraph;
  private _ready = false;

  constructor(graph?: ReactionGraph) {
    this._graph = graph ?? new ReactionGraph();
  }

  /** Full wiki scan — call once after TW5Engine.boot(). */
  boot(wiki: BootScanSurface): void {
    const uris = wiki.filterTiddlers("[all[tiddlers]!prefix[$:/]]");
    const allEdges: { fromUri: string; toUri: string; family: string; role: string | null; payload: Record<string, unknown> }[] = [];
    for (const uri of uris) {
      const text = wiki.getTiddlerText(uri);
      if (!text) continue;
      try {
        for (const e of parseMemeEdges(uri, text)) {
          allEdges.push({
            fromUri: e.fromUri, toUri: e.toUri,
            family:  e.family,  role:  e.role,
            payload: e.payload,
          });
        }
      } catch { /* malformed — skip */ }
    }
    this._graph.load(extractReactionBindings(allEdges));
    this._ready = true;
  }

  get ready(): boolean { return this._ready; }

  // ── MemeProjection ──────────────────────────────────────────────────────

  /** Scale-1/2: maintain graph + fire all reaction triggers for changed URI. */
  onUriChanged(change: LarTiddlerChange): void {
    const { title, record } = change;
    if (!title.startsWith("lar:")) return;
    if (!record || record.deleted) {
      this._graph.removeUri(title);
    } else {
      const bindings = _bindingsFromText(title, record.text ?? "");
      if (bindings.length > 0) this._graph.updateUri(title, bindings);
      else this._graph.removeUri(title);
    }
    this._fireForUri(title, { uri: title });
  }

  /**
   * Scale-3: maintain + fire all triggers for every URI in the changeset.
   * All handlers run in declaration order — UEFN game-loop fidelity.
   */
  onChangeset(uris: ReadonlySet<string>, origin: ChangeOrigin): void {
    for (const uri of uris) {
      this._fireForUri(uri, { origin });
    }
  }

  // ── ReactionGraph delegation ───────────────────────────────────────────

  subscribeByFn(fnName: string, handler: ReactionHandler): () => void {
    return this._graph.subscribeByFn(fnName, handler);
  }

  subscribe(fromUri: string, listenable: string, handler: ReactionHandler): () => void {
    return this._graph.subscribe(fromUri, listenable, handler);
  }

  fireSync(fromUri: string, listenable: string, payload: unknown = {}): void {
    this._graph.fireSync(fromUri, listenable, payload);
  }

  private _fireForUri(uri: string, payload: Record<string, unknown>): void {
    const listenables = new Set<string>();
    for (const b of this._graph.bindings) {
      if (b.fromUri === uri && b.listenable) listenables.add(b.listenable);
    }
    for (const listenable of listenables) {
      this._graph.fireSync(uri, listenable, payload);
    }
  }
}
