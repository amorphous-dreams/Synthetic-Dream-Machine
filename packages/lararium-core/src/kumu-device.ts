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
import { ReactionGraph } from "./live-protocol.js";

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

/**
 * Routes CRDT change events through a ReactionGraph.
 *
 * Register with a MemeProvider to receive change events and automatically fire
 * the matching reaction triggers. At Scale-3 (onChangeset), all triggers for all
 * changed URIs fire in a single synchronous tick — UEFN game-loop fidelity.
 *
 * Usage:
 *   const engine = new ReactionEngine(graph);
 *   provider.addProjection(engine);
 *
 * The graph must be kept current separately (via buildReactionGraph / updateUri).
 * ReactionEngine is a pure dispatcher — it does not mutate the graph.
 */
export class ReactionEngine implements MemeProjection {
  constructor(private readonly graph: ReactionGraph) {}

  /** Scale-1/2: fire all reaction triggers for the one changed URI. */
  onUriChanged(change: LarTiddlerChange): void {
    this._fireForUri(change.title, { uri: change.title });
  }

  /**
   * Scale-3: fire all reaction triggers for every URI in the changeset.
   * All handlers run synchronously in declaration order — equivalent to a
   * single UEFN actor-tick where all wired events fire together.
   */
  onChangeset(uris: ReadonlySet<string>, origin: ChangeOrigin): void {
    for (const uri of uris) {
      this._fireForUri(uri, { origin });
    }
  }

  private _fireForUri(uri: string, payload: Record<string, unknown>): void {
    // Collect unique listenable names for this URI first, then fire once per listenable.
    // fireSync fans out to all subscribers for (uri, listenable) — calling it N times
    // per binding would fire every subscriber N times.
    const listenables = new Set<string>();
    for (const b of this.graph.bindings) {
      if (b.fromUri === uri && b.listenable) listenables.add(b.listenable);
    }
    for (const listenable of listenables) {
      this.graph.fireSync(uri, listenable, payload);
    }
  }
}
