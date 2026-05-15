/**
 * kumu-device.ts — KumuDeviceSpec + ReactionEngine.
 *
 * ## Verse 5.6+ device model (NOT Blueprint)
 *
 * UEFN Verse 5.6+ uses single-inheritance class composition. A `creative_device` subclass
 * gains behavior by:
 *   - Declaring `listenable(payload)` fields as OUTPUT event pins (built-in devices only;
 *     custom device listenable fields not yet DEB-bindable in UEFN editor as of 2025)
 *   - Declaring public methods matching the payload signature as INPUT function pins
 *   - `using { /Path }` is a MODULE IMPORT directive (namespace scope), NOT trait composition
 *   - Class hierarchy: `my_device := class(creative_device)` — single inheritance only
 *
 * Verse event type hierarchy:
 *   `event(T)`      — implements signalable + awaitable; NOT subscribable
 *   `listenable(T)` — implements awaitable + subscribable; built-in device events use this
 *   `Subscribe()`   → returns `cancelable` (our `() => void` unsubscribe)
 *   `Await()<suspends>` → single-shot coroutine (our `subscribeOnce()`)
 *
 * Verse concurrency (all require `<suspends>` context):
 *   `spawn`  → lele / \branch: detached fiber, not scope-bound (fire-and-forget)
 *   `branch` → scope-bound fiber, auto-canceled when enclosing function returns
 *   `sync`   → hui / \sync: await-all
 *   `race`   → holo / \race: first wins, losers CANCEL
 *   `rush`   → puka / \rush: first wins, losers CONTINUE in background
 *
 * ## Lararium vocabulary mapping
 *
 *   Verse `listenable(T)` field  → `KumuListenable`     (OUTPUT pin; `reaction:listenable` role)
 *   Verse `event(T)` field       → `KumuListenable`     (verseKind: "event"; Await-only, not Subscribe)
 *   Verse public input method    → `KumuSubscribable`   (INPUT fn pin; `reaction:subscribable` role)
 *   Verse class inheritance      → `control:implements` pranala edge → `KumuDeviceSpec.traits`
 *   UEFN editor DEB wire         → `papalohe` pranala edge (instance-level binding)
 *   `Await(event)<suspends>`     → `ReactionGraph.subscribeOnce()`
 *   UEFN game-loop actor tick    → `ReactionEngine.onChangeset()` — Scale-3 synchronous tick
 *
 * ## KumuDeviceSpec
 *   Isomorphic type describing a kumu device type. Derived from the type meme's
 *   pranala edge list — class hierarchy expressed as `control:implements` edges.
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
 *
 * Meme: lar:///ha.ka.ba/@lararium/core/v0.1/kumu-device
 */

import type { LarTiddlerChange, ChangeOrigin } from "./tiddler-store.js";
import type { MemeProjection } from "./meme-provider.js";
import type { ReactionBinding, ReactionHandler } from "./live-protocol.js";
import { extractReactionBindings, ReactionGraph } from "./live-protocol.js";
import { parseMemeEdges } from "./meme-ast/index.js";

// ---------------------------------------------------------------------------
// KumuListenable / KumuSubscribable — UEFN Verse 5.6+ pin vocabulary
// ---------------------------------------------------------------------------

/**
 * A named output event this kumu device EMITS (Verse OUTPUT pin).
 *
 * `verseKind` distinguishes the two Verse event types:
 *   "listenable" — implements awaitable + subscribable; DEB-wireable in UEFN editor
 *   "event"      — implements signalable + awaitable only; NOT subscribable via Subscribe();
 *                  custom user-declared events (`MyEvent : event() = event(){}`) land here
 *
 * When absent, treat as "listenable" (built-in device events, the common case).
 *
 * Declared via `reaction:listenable` pranala edges on the kumu type meme.
 * e.g. "OnActivated", "OnDamaged", "OnExploded"
 */
export interface KumuListenable {
  /** Event name — e.g. "OnActivated", "OnDamaged", "OnReset". */
  readonly name: string;
  readonly description?: string;
  /** Verse event type: "listenable" supports Subscribe(); "event" supports Await()/Signal() only. */
  readonly verseKind?: "listenable" | "event";
  /** Verse payload type string (e.g. "agent", "int", "[]void"). Absent = void payload. */
  readonly payloadType?: string;
}

/**
 * A named input function this kumu device EXPOSES (Verse INPUT function pin).
 *
 * In Verse: a public method on the device class whose signature matches the wired listenable's
 * payload type. `@subscribes` decorator appears in older docs but current UEFN uses public
 * method matching by signature — any public method of matching arity serves as an input pin.
 *
 * Declared via `reaction:subscribable` pranala edges on the kumu type meme.
 * e.g. "Enable", "Disable", "SetDamage"
 */
export interface KumuSubscribable {
  /** Handler name — e.g. "Enable", "Disable", "SetDamage". */
  readonly name: string;
  readonly description?: string;
  /** Verse parameter type string matching the connected listenable's payload. Absent = void. */
  readonly payloadType?: string;
  /** Verse effect specifiers on this function (e.g. ["suspends"], ["decides", "transacts"]). */
  readonly effects?: readonly string[];
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
 *                  payload.listenable = event name; payload.verseKind = "listenable"|"event";
 *                  payload.payloadType = Verse type string
 *   subscribables ← `reaction:subscribable` edges where `fromUri === typeUri`
 *                  payload.subscribable = handler name; payload.payloadType = Verse type string;
 *                  payload.effects = space-separated Verse effect specifiers
 *   slots        ← ahu socket URIs declared within the type meme (Verse `@editable` fields)
 *   traits       ← `control:implements` edges out of the type meme (Verse class inheritance chain)
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
 * listenables  ← `reaction:listenable` edges with `fromUri === typeUri`; name = payload.listenable
 * subscribables← `reaction:subscribable` edges with `fromUri === typeUri`; name = payload.subscribable
 * slots        ← caller must supply (no AST field for ahu socket URIs yet)
 * traits       ← `control:implements` edges; toUri = trait type URI (Verse `using`)
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
      const s = (k: string) => (typeof e.payload[k] === "string" ? e.payload[k] as string : undefined);

      if (e.role === "listenable") {
        const name = s("listenable");
        if (name) {
          const vk = s("verseKind");
          const desc = s("description"); const pt = s("payloadType");
          const entry: KumuListenable = { name };
          if (desc) (entry as { description?: string }).description = desc;
          if (vk === "event" || vk === "listenable") (entry as { verseKind?: "listenable" | "event" }).verseKind = vk;
          if (pt)   (entry as { payloadType?: string }).payloadType = pt;
          listenables.push(entry);
        }
      } else if (e.role === "subscribable") {
        const name = s("subscribable");
        if (name) {
          const efxRaw = s("effects");
          const effects = efxRaw ? efxRaw.split(/\s+/).filter(Boolean) : undefined;
          const desc = s("description"); const pt = s("payloadType");
          const entry: KumuSubscribable = { name };
          if (desc)           (entry as { description?: string }).description = desc;
          if (pt)             (entry as { payloadType?: string }).payloadType = pt;
          if (effects?.length)(entry as unknown as { effects?: string[] }).effects = effects;
          subscribables.push(entry);
        }
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
 *   engine.boot(tw5.$tw.wiki);
 *   peer.store.addProjection(engine);
 *   engine.subscribeByFn("navigate", handler);
 *
 * Worker forwarding (P.3.5):
 *   const cancel = engine.onAnyFire((fromUri, listenable, payload) => {
 *     post({ schema_version: 1, type: "event", wikiUri, eventId: listenable,
 *            payload: sanitize(payload) });
 *   });
 *   liveHandles.add({ cancel });
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
    const allEdges: {
      fromUri: string; toUri: string;
      family:  string; role:  string | null;
      payload: Record<string, unknown>;
    }[] = [];
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
   * Scale-3: maintain graph bindings + fire all triggers for every URI in the changeset.
   * All handlers run in declaration order — UEFN game-loop fidelity.
   *
   * `wiki` — optional live wiki surface (pass TW5 wiki in Worker context) so the
   * graph updates its papalohe edge bindings for changed URIs before firing.
   * When omitted, only reactions fire (bindings remain as-is — correct for the
   * main-thread MemeSyncAdaptor path where onUriChanged already maintains them).
   */
  onChangeset(uris: ReadonlySet<string>, origin: ChangeOrigin, wiki?: BootScanSurface): void {
    if (wiki) {
      for (const uri of uris) {
        if (!uri.startsWith("lar:")) continue;
        const text = wiki.getTiddlerText(uri);
        if (text !== undefined) {
          const bindings = _bindingsFromText(uri, text);
          if (bindings.length > 0) this._graph.updateUri(uri, bindings);
          else this._graph.removeUri(uri);
        } else {
          this._graph.removeUri(uri);
        }
      }
    }
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

  /**
   * Register a monitoring observer that receives EVERY fireSync call with full context.
   * Designed for cross-boundary forwarding — e.g. Worker → main thread event bridge.
   * Returns a cancellation function. Add the return to `liveHandles`.
   */
  onAnyFire(
    observer: (fromUri: string, listenable: string, payload: unknown) => void,
  ): () => void {
    return this._graph.onFireSync(observer);
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
