/**
 * kumu-device.ts — KumuDeviceSpec + ReactionEngine.
 *
 * KumuDeviceSpec:
 *   Isomorphic type describing a kumu device actor (Verse 5.6+ composition model).
 *   A kumu type declares named inputs (triggers it can receive) and outputs (fns
 *   it can call on connected devices). Behavior is assembled via `implements`
 *   edges and `papalohe` reaction bindings — no class hierarchy.
 *
 *   Two identity layers per instance (both stored as tiddlers in the room doc):
 *     lar:///type-path#name-fragment  — user-selected friendly name
 *     lar:///type-path#uuid-fragment  — crypto.randomUUID() instance address
 *   Declared in the type meme body via <<~ kahea kau #fragment >> sigils.
 *
 * ReactionEngine:
 *   MemeProjection that routes CRDT change events through a ReactionGraph.
 *
 *   Scale-1/2 (onUriChanged): fires all reaction triggers for the changed URI.
 *   Scale-3 (onChangeset):    fires all triggers for all URIs in the transaction
 *                             in a single synchronous tick — UEFN game-loop fidelity.
 *
 * Isomorphic: no Node/browser APIs. Works in Node, browser, and TW5-era environments.
 */

import type { LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import type { ReactionBinding } from "./live-protocol.js";
import { ReactionGraph } from "./live-protocol.js";

// ---------------------------------------------------------------------------
// KumuDeviceInput / KumuDeviceOutput — actor event vocabulary
// ---------------------------------------------------------------------------

/** A named trigger this kumu device can receive (reaction:subscription edge). */
export interface KumuDeviceInput {
  /** Trigger name — e.g. "Activated", "Damaged", "Reset". */
  readonly name: string;
  readonly description?: string;
}

/** A named function this kumu device can call on connected devices (reaction:handler edge). */
export interface KumuDeviceOutput {
  /** Function name — e.g. "Enable", "Disable", "SetDamage". */
  readonly name: string;
  readonly description?: string;
}

// ---------------------------------------------------------------------------
// KumuDeviceSpec — type-level device description
// ---------------------------------------------------------------------------

/**
 * Describes a kumu device type.
 *
 * Derived at compile time from a type meme's AST edges:
 *   inputs  ← reaction edges where `role === "subscription"` and `fromUri === typeUri`
 *   outputs ← reaction edges where `role === "handler"` and `fromUri === typeUri`
 *   slots   ← ahu socket URIs declared within the type meme
 *   traits  ← `control:implements` edges out of the type meme
 */
export interface KumuDeviceSpec {
  /** Canonical type URI (no fragment). e.g. `lar:///sdm/devices/button` */
  readonly typeUri: string;
  /** Events this device type can receive. */
  readonly inputs: readonly KumuDeviceInput[];
  /** Events this device type fires / functions it exposes to connected devices. */
  readonly outputs: readonly KumuDeviceOutput[];
  /** Ahu slot URIs declared on this type. */
  readonly slots: readonly string[];
  /** Type URIs this device implements (control:implements edges). */
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

interface EdgeLike {
  fromUri: string;
  family:  string;
  role:    string | null;
  payload: Record<string, unknown>;
}

/**
 * Derive a KumuDeviceSpec from the flat edge list for a type meme.
 * Pass the result of `parseMemeEdges(typeUri, text)` after mapping to EdgeLike.
 *
 * inputs  ← reaction edges with role "subscription" (or trigger-only edges)
 * outputs ← reaction edges with role "handler"
 * slots   ← inferred from ahu socket URIs in fromSocket fields (caller must pass)
 * traits  ← control:implements edges
 */
export function kumuDeviceSpecFromEdges(
  typeUri: string,
  edges:   readonly EdgeLike[],
  slots:   readonly string[] = [],
): KumuDeviceSpec {
  const inputs:  KumuDeviceInput[]  = [];
  const outputs: KumuDeviceOutput[] = [];
  const traits:  string[]           = [];

  for (const e of edges) {
    if (e.fromUri !== typeUri) continue;

    if (e.family === "reaction") {
      const name = (e.payload["trigger"] as string | undefined)
                ?? (e.payload["fn"]      as string | undefined)
                ?? null;
      if (!name) continue;

      const desc = e.payload["description"] as string | undefined;
      if (e.role === "subscription" || e.role === "handler" && !e.payload["fn"]) {
        inputs.push(desc ? { name, description: desc } : { name });
      } else if (e.role === "handler") {
        outputs.push(desc ? { name, description: desc } : { name });
      } else {
        // Bare reaction edge with trigger → treated as input.
        inputs.push(desc ? { name, description: desc } : { name });
      }
    }

    if (e.family === "control" && e.role === "implements") {
      traits.push(e.fromUri === typeUri ? e.fromUri : e.fromUri);
      // target is the trait type URI
      const targetUri = (e.payload["toUri"] as string | undefined) ?? (e as unknown as { toUri: string }).toUri;
      if (targetUri && targetUri !== typeUri) traits.push(targetUri);
    }
  }

  return { typeUri, inputs, outputs, slots, traits };
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
    const bindings: readonly ReactionBinding[] = this.graph.bindings;
    for (const b of bindings) {
      if (b.fromUri === uri && b.trigger) {
        this.graph.fireSync(uri, b.trigger, payload);
      }
    }
  }
}
