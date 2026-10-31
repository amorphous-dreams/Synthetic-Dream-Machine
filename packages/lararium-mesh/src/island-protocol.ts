/**
 * island-protocol — GP-1 schema: discriminated union for all vessel ↔ causal-island messages.
 *
 * Every message crossing the vessel / causal-island boundary MUST use this envelope.
 *
 * ## Island Sovereignty Law (isomorphic across all vessel types)
 *
 *   1. Every island boots a Repo-in-island via a transferred `syncPort` (MessagePort). A SESSION's island
 *      (a manifest that carries `view`) reaches the vessel's Repo through that session's scoped document
 *      view: the port carries the documents its recipe resolved and no other, its replica stays ephemeral,
 *      it asks the vessel for a catalog name or for content by address over `view:catalog` / `view:content`,
 *      and before it tears down it waits on `view:settle` until the vessel holds what it wrote.
 *   2. The island derives tiddler state from its own CRDT doc — never from vessel oracle deltas.
 *   3. The island owns its timing. The wiki shore lands inbound changes from ONE ordered queue
 *      across all bags, in slices paced by host tasks (`host-task.ts`); the in-wiki nalu engine
 *      applies each change synchronously. No frame, no timer and no raw-message-receipt drain
 *      decides when a change lands.
 *   4. No frame-completion ACK signal — drain timing stays island-internal.
 *   5. No vessel oracle delta delivery: CRDT sync via `syncPort` is the sole
 *      source of tiddler truth for causal islands.
 *   6. `IslandMsg_Manifest` carries `syncPort` (transferred, not cloned), `recipe` (WikiRecipe
 *      slot structure), `grants` (IslandGrants — typed structural capabilities), and `coreHash`
 *      (content-address intent vector; null = pre-CAS). TW5 core bytes are NOT transferred
 *      in the manifest — islands read them from `LarDoc.blobs[ENGINE_CORE_ID]` on the
 *      lararium CRDT doc after `handle.whenReady()`. Two vessels federating the lararium doc
 *      share the engine automatically via Automerge sync.
 *   7. The vessel MUST close `mainPort` at evict/unmount time — before or after worker.terminate().
 *      Failure to close leaks the Automerge NetworkAdapter silently. This invariant is structural:
 *      every vessel implementation (node, browser, future) holds a `mainPort: MessagePort` on its
 *      hot slot and calls `mainPort.close()` in its teardown path. No exceptions.
 *   8. Federation shore — when a grant carries a non-empty AutomergeUrl, two obligations
 *      activate. Vessel: the vessel MUST wire the `MessageChannelNetworkAdapter(mainPort)` on the
 *      vessel Repo before delivering `manifest`, so the CRDT graph reaches the island-side Repo
 *      automatically. Island-side: the island MUST call `repo.find(docUrl).whenReady()` and await
 *      readiness before seeding TW5 and declaring `ea`. Failure on either side leaves the island
 *      holding a disconnected doc; the slot MUST transition to disposed within HANDSHAKE_TIMEOUT_MS.
 *      Gate proof: `federation-shore.test.ts` (node, pure Repo — vessel→island + island→vessel) +
*                  `browser-repo-in-island.test.ts` test 2 (browser pool, docUrl non-null path).
 *      When this law holds, two vessels sharing a bag converge without any explicit sync call —
 *      the archipelago forms the moment the AutomergeUrl crosses the boundary.
 *   9. No sovereign VM and no key on a surface. A page never stands as a vessel: it holds a
 *      surface with a port onto one. Every sovereign `TW5Engine` lives inside a Worker (Node
 *      `worker_threads`, browser `Web Worker`, future WASM/UE5 runtimes). The main thread holds
 *      `DocHandle` references and `CompositeStore` layers; it does not hold or reference a
 *      sovereign `TW5Engine`. Any code that calls `bootTw5()` or instantiates `TW5Engine`
 *      outside a Worker constitutes a sovereignty violation, save the page mirror: a camera
 *      booted through its one private door, fed by the port alone, holding no truth and no key.
 *      Boot sites (all inside Workers): `node-daemon-island.ts` (Node daemon),
 *      `node-wiki-island.ts` (Node wiki), `browser-wiki-worker.ts` (browser wiki),
 *      `browser-daemon-island.ts` (browser daemon). Main-thread entry files carry no TW5 import.
 *
 * GP-1: every message names its `type`, and no version counter rides beside it: a vessel and its islands run
 *       one build, so a frame shape changes once, everywhere, in one commit.
 * GP-2: all payloads are plain objects; no class instances, no functions, no DOM.
 * GP-4: CryptoKey — NOT on this protocol surface; key material stays in-thread.
 *
 * Platform-neutral: no Node `worker_threads` import, no browser `self` import.
 * Vessel entrypoints bind the I/O; this module names the envelopes only.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/island-protocol
 */

import type { DeviceDelegationTiddler } from "./device-delegation.js";
import type { FaceAnchor } from "./face-anchor.js";
import type { WorkingFloorAnchor } from "./wiki-recipe.js";
import type { PersonaKelEvent } from "./persona-kel.js";
import type { WorldlineEdgeTriple, WorldlineEdgeClose } from "./worldline-edge.js";
import type { SparseFormVector } from "./worldline-trajectory.js";
import {
  LAR_CONTROL_EVENT, LAR_CONTROL_RESULT, LAR_FRAME, LAR_RESEND, LAR_SERVICE,
  readLarControlEvent, readLarControlResult, readLarFrame, readLarResend, readLarService,
  type LarMsg_ControlEvent, type LarMsg_ControlResult, type LarMsg_Frame, type LarMsg_Resend, type LarMsg_Service,
} from "./lar-camera.js";
import { isPortKind, readPortIslandMsg, readPortVesselMsg, type PortIslandToVesselMsg, type PortVesselToIslandMsg } from "./record-port.js";


// ── Island storage configuration ──────────────────────────────────────────

/**
 * Storage adapter configuration for the island-side Automerge Repo.
 *
 * Islands that own a storage adapter hold persistent CRDT state independently
 * of the vessel relay Repo. The vessel passes this config at manifest
 * delivery time; the island constructs the adapter.
 *
 * - `nodefs`  — Node.js `NodeFSStorageAdapter`; island receives a filesystem `dir`.
 * - `idb`     — Browser `IndexedDBStorageAdapter`; island receives a `dbName`.
 * - `memory`  — ephemeral in-memory storage; cold boot or test path.
 */
export type IslandStorageConfig =
  | { type: "nodefs";  dir:    string }
  | { type: "idb";     dbName: string }
  | { type: "memory" };

/** A single worker-owned document crossing. This is deliberately one scope,
 * rather than a storage registry: the first D-VR-C cut owns the daemon doc. */
export interface IslandOwnedDocumentScope {
  documentUrl: string;
  syncPort: MessagePort;
  storage?: IslandStorageConfig;
}

/** What a session island holds of its scoped document view: the one peer ID its Repo announces. */
export interface IslandViewStanding {
  readonly peerId: string;
}

// ── Recipe + bag resolution ────────────────────────────────────────────────
//
// The manifest carries a WikiRecipe (the slot structure, vessel-independent)
// and IslandGrants (typed structural capabilities) — plain objects so they
// survive structuredClone across worker boundaries.
//
// `AutomergeUrl` IS the CapTP-style capability token for each CRDT bag's doc.
// A grant absent or null = in-memory / cold; library bags resolve island-side
// from the catalog registry (boot = first reconcile), never from the manifest.

// ── Vessel → island ──────────────────────────────────────────────────────────

/**
 * Deliver the materials a sovereign causal island needs to establish itself (boot TW5 + Repo-in-island).
 *
 * Island Sovereignty Law:
 *   - `syncPort` MUST be transferred (not cloned): `postMessage(msg, [msg.syncPort])`.
 *   - The island creates its own Automerge Repo with `MessageChannelNetworkAdapter(syncPort)`.
 *   - The island calls `repo.find(docUrl)` and awaits `handle.whenReady()` before declaring `ea`.
 *   - If `docUrl` is null the island creates a fresh empty doc (cold boot).
 *   - `coreHash` carries a SHA-256 hex of the TW5 core blob stored in `LarDoc.blobs[ENGINE_CORE_ID]` on the lararium CRDT doc; null = pre-content-addressed trust-on-delivery.
 *     This field is an intent vector: once a CAS store exists, null MUST be rejected at boot.
 *
 * BA-5 (revised): TW5 core bytes live in `LarDoc.blobs[ENGINE_CORE_ID]` on the lararium doc.
 * Islands read bytes from the CRDT after `handle.whenReady()`. The manifest carries only
 * `coreHash` (SHA-256 hex) as an integrity gate — never the raw bytes.
 * The vessel acts as courier — delivering capabilities, not raw bytes.
 * The island establishes its own sovereignty (`ea`) upon receipt.
 *
 * Prerequisite fields (island cannot think without these — not cargo):
 *   - `recipe` is the WikiRecipe slot structure (wikiSlug + optional libraryBags).
 *   - `grants` carries the island's typed structural capabilities (engine doc,
 *     own bag, keyhive-bound personal/draft, catalog registry ACCESS). Library bags
 *     never ride the manifest: the island resolves them itself from the catalog registry
 *     (recipe-watch reconcile — boot runs the same path as live composition).
 *
 * Plugin tiddlers travel via the lararium CRDT blob store (application/json blobs).
 * Islands read and apply them from the CRDT after `handle.whenReady()` — no manifest field needed.
 */

/**
 * IslandGrants — the typed structural capabilities a vessel HANDS an island at
 * manifest. Each names a capability granted (ocap: arrives as a grant, never
 * looked up from a main-owned dictionary). The island resolves everything else
 * — the lares bag, library bags, oracle moves — from the catalog registry itself, sovereign-side.
 */
export interface IslandGrants {
  /** The lararium engine/system doc — REQUIRED (engine bytes precede TW5 boot). */
  islandUrl:    string;
  /** catalog registry ACCESS (never layered; access≠load). Absent/null = no watch. */
  catalogUrl?:  string | null;
  /** The island's OWN bag (<wikiSlug>; daemon under the one-recipe model). */
  wikiUrl?:     string | null;
  /** Keyhive-bound sovereign slots (daemon resolveBinding grants). */
  personalUrl?: string | null;
  draftUrl?:    string | null;
  /** working — the SAVED live write layer (PersonaGroup×fingerprint-bound, like
   *  personal); normal edits route here, canon publishes on a promotion MOVE. */
  workingUrl?:  string | null;
}
export interface IslandMsg_Manifest {
  type: "manifest";
  wikiUri: string;
  /**
   * SHA-256 hex of the TW5 core blob (`LarDoc.blobs[ENGINE_CORE_ID]`).
   * null = pre-CAS trust-on-delivery. Islands verify on read from the lararium CRDT doc.
   */
  coreHash: string | null;
  /**
   * CIDs (sha256) of the engine's plugin-tiddler blobs (application/json). The worker
   * resolves these — and the core (coreHash) — via the host's content-addressed
   * `resolveByCid` (local CAS), NOT by reading a CRDT-synced blob doc. NO FALLBACK STANDS
   * on either platform (M6/R4): `sovereign-kernel.ts` reads `msg.pluginCids ?? []`
   * and resolves exactly that list by CID — nothing else — so an absent or empty list boots the
   * engine with no plugin tiddlers at all, never a silent "read every blob off the oracle doc"
   * scan. `resolvePluginCids` is REQUIRED on both `VesselIslandPoolCore` (node and browser alike,
   * M6) and the daemon-VM boot path, so this field is always resolver-derived before a worker ever
   * sees it — there is no caller-side path left that could hand it absent for the pool to catch.
   *
   * THE RECIPE → SELECTOR → MANIFEST LINE (RECIPE: plugins load by recipe). The vessel never reads
   * `recipe.pluginOfferings` straight into this field: a per-island resolver (node:
   * `resolveNodeIslandPluginCids`; browser: `resolveBrowserIslandPluginCids`) resolves that ordered
   * CID list through `selectPluginBlobs` (`plugin-offering-selector.ts`) — which verifies each
   * named offering whole (signature, `pluginsCid` fold, provenance), refuses a duplicate plugin id
   * across offerings, and refuses outright any blob id inside the fixed boot set
   * (`boot-set-collision`, M3) — then checks every selected CID's bytes against the local CAS
   * (`cas.ts#verifyCasBytes`; missing or corrupt bytes refuse by name, never a silent empty
   * selection). ONLY THEN does the resolver fold the result together with the FIXED boot-set
   * floor's own plugin-tiddler CIDs (`cas.ts#bootSetPluginCids` — grammar + boot shadows, read off
   * the island doc's own blobs, independent of any recipe) into the one list this field carries.
   * `pluginCids` on the wire is therefore the UNION of that fixed floor and a VERIFIED,
   * byte-checked selection, in the recipe's order for its own portion — never a half-trusted CID
   * list read straight off a record, and never the recipe's selection ALONE: the resolver always
   * folds the floor in, so once it resolves at all the field carries the floor, or the engine boots
   * with no grammar. An empty or absent `recipe.pluginOfferings` selects no OPTIONAL plugins; the
   * field still stays present whenever the floor itself is non-empty (which, past genesis, it
   * always is).
   */
  pluginCids?: readonly string[];
  /** Slot structure for this wiki — wikiSlug + optional libraryBags. */
  recipe: import("./wiki-recipe.js").WikiRecipe;
  /** Typed structural capabilities (see IslandGrants). Libraries resolve via the catalog registry. */
  grants: IslandGrants;
  /**
   * Storage adapter configuration for the island-side Automerge Repo.
   * When present, the island creates a persistent Repo (NodeFS or IDB).
   * Absent or `{ type: "memory" }` = ephemeral relay-only Repo (test / cold-boot path).
   */
  storage?: IslandStorageConfig;
  /** Optional bounded worker-owned document crossing (D-VR-C). */
  ownedDocument?: IslandOwnedDocumentScope;
  /** MessagePort for island-side Repo ↔ vessel Repo sync. MUST be transferred. */
  syncPort: MessagePort;
  /**
   * A SESSION ISLAND's standing under its scoped document view (session-contract#/the-document-view). Present:
   * the island's Repo announces `peerId` and no other (the view's leg admits that ID alone), holds no durable
   * store, and lays the slots `resolved` names without resolving any name itself. Absent: the island stands
   * outside any session (the vessel's own face-blind daemon).
   */
  view?: IslandViewStanding;
  /**
   * The absolute id of every slot that holds a document, by slot name: the session's effective recipe as the
   * one mesh resolver returned it at surface mount (session-contract#/the-effective-recipe). An island that
   * carries it lays exactly these documents and never re-resolves: a recipe write reaches the next mount.
   */
  resolved?: Readonly<Record<string, string>>;
  /**
   * Serializable disk mirror configs for island-hosted LarDiskProjector.
   * Each entry carries `bagId`, `mirrorRoot` (absolute path), and `scope`
   * (e.g. "@lares", "@lararium") so the island can reconstruct `BagMirrorConfig`
   * via `namedBagMirror(scope, mirrorRoot)` from `bag-paths`.
   * Absent = no disk projection for this island.
   */
  diskMirrors?: readonly { bagId: string; mirrorRoot: string; scope: string; guardNexusHandles?: boolean }[];
  /**
   * DAEMON-ISLAND ONLY — operator authn/z material for in-worker keyhive boot
   * (isomorphic-vessel epic, Stage 1). The daemon worker's `onEa` calls
   * `bootDaemonKeyhive` with this + its daemon CompositeStore (the cap-event
   * EventStore backing). Populated ONLY by openDaemonVm / openBrowserDaemonVm;
   * wiki manifests leave it absent, so the operator seed never reaches a wiki
   * worker. The seed crossing the worker boundary is the deliberate custody
   * boundary (operator-confirmed): the daemon island is the authn/z home.
   */
  daemonAuth?: {
    joinedFaces?: readonly JoinedFaceAuth[];
    /** The mounted face's random atom seed and its verifying key. */
    atom?: { readonly seed: string; readonly key: string };
    /** The veil identity's prior archive — restores its prekeys so material keyed to the veil's card
     *  keeps opening across boots. */
    veilArchiveBytes?: Uint8Array;
    /** Public place key for place checks; the face's atom supplies Keyhive identity. */
    placeVerifyingKey:     string;
    /** THE FLOOR'S OWN ANCHOR, read by the opener from what the vessel holds (`WorkingFloorAnchor`): a node's place KEL prefix,
     *  or a browser leaf's private Nexus of one. A faceless floor keys its working documents by it. Absent only where the
     *  vessel holds neither, and then a floor working layer refuses `no-place`. */
    workingFloorAnchor?:   WorkingFloorAnchor;
    /** THE MOUNTED FACE'S ADDRESS SECRET, hex, read from main-thread custody at the manifest's build (the node's
     *  `face-address-secret` row, the browser's keystore row): the face's working documents derive their addresses from
     *  it (`faceWorkingDocUrl`). It crosses the worker boundary beside the atom seed, and only with a face lit. */
    faceAddressSecret?:    string;
    /** The FACE's pins, present only when a face stands. A place founded and never lit carries NONE of
     *  them, and that names the WAKING FLOOR rather than a fault — canon has a vessel boot permissionlessly
     *  on its own key. The worker refuses a TORN face (some pins, not all), so absence buys FEWER CAPS and
     *  never a softened gate. */
    personaGroupId?:   string;
    faceAnchor?: FaceAnchor | null;
    meshCabalDocIdHex?:    string;
    /** Writable bag URIs to register so verify/delegate resolve (lar: URIs). */
    registerBags:          readonly string[];
    /** The PINNED signer DID — provenance only (the founding op-key = the KEL inception op-key). The Binding
     *  Gate does not PIN this; it pins `personaKel.prefix` and walks the KEL to the current head (no hybrid). */
    signerDid?:            string;
    /** The persona-KEL PIN + the LOCAL-replica chain the worker walks. `prefix` is the stable identifier (AID)
     *  read from the daemon bag (the pin's root of trust); `chain` is the seq-sorted key-event-log the MAIN thread read
     *  from its per-Nexus KEL board replica "as of last sync" (no-global-now). The Binding Gate asserts
     *  `chain[0].prefix === prefix`, walks to the current head op-key, and verifies the edge against THAT head —
     *  fail-closed on an absent/broken chain (never a global lookup). `board` names that KEL board's document, so a door that
     *  must read the lineage LIVE (the intent door: a rotation merged after boot reaches its next effect) reads the island's
     *  own replica of it; a door that needs it holds shut where the composer names none. */
    personaKel?:           { readonly prefix: string; readonly chain: readonly PersonaKelEvent[]; readonly board?: string };
    /** This vessel's signed device-delegation edge (root→vessel) — the public, Beelay-free binding. */
    deviceEdge?:           DeviceDelegationTiddler;
    /**
     * THE OUTBOX KEY, opened from its custody row and handed across at unlock. The island seals and opens its outbox's parcels under it for the life
     * of this composition. Absent on a floor composition: the outbox holds shut and every parcel verb refuses.
     */
    outboxKey?:            Uint8Array;
    /**
     * Whether the selected face's veil archive opens. The worker's archive writer requires `true`;
     * a faceless or locked composition exports no Keyhive identity bytes.
     */
    archiveOpens:          boolean;
  };
}

/** Authentication material carried by one unlocked joined face. */
export type JoinedFaceAuth = Required<Pick<NonNullable<IslandMsg_Manifest["daemonAuth"]>,
  "atom" | "personaGroupId" | "faceAnchor" | "personaKel" | "deviceEdge" | "signerDid" | "registerBags">> &
  Pick<NonNullable<IslandMsg_Manifest["daemonAuth"]>, "meshCabalDocIdHex" | "veilArchiveBytes" | "faceAddressSecret">;

/**
 * Cool the wiki slot from `wela` (hot) to `anu` (cold) — teardown; thread
 * terminates. Type literal `"hooanu"` — Hawaiian: hoʻoanu, "to cool."
 *
 * The temperature register replaces an organizational rank register (the old
 * `"demote"`) that would conflict with the residency-model ACTION verb surface.
 * The two thermal states wear ʻōlelo Hawaiʻi: `wela` / `anu` (see
 * residency-tiers.md).
 *
 * Counterpart: `anu` → `wela` (hoʻowela, "to heat") happens at the vessel layer
 * via `vessel-island-pool.mountWiki` — a fresh worker boots and runs `ea` — not
 * via a worker-side signal. A `warm` middle tier (suspended-not-terminated,
 * resume by a hoʻomahana signal) was proposed and CUT: a
 * suspended Worker still holds its heap, so it did not shed memory, and the
 * proven virtual-actor runtimes use two states. Reintroduce only behind a
 * measured resume-cost problem AND a memory-shedding suspend — reopening
 * condition in residency-tiers.md #warm-cut. No HooMahana signal type today.
 */
export interface IslandMsg_HooAnu {
  type: "hooanu";
  wikiUri: string;
}

/**
 * Begin the GP-5 teardown handshake.
 * Island MUST complete in-flight reactions, cancel all live handles, export Repo doc bytes,
 * then respond with `teardown:ack` before the vessel calls worker.terminate().
 */
export interface IslandMsg_Teardown {
  type: "teardown";
}

// ── Daemon island protocol ─────────────────────────────────────────────────
//
// Three-message round-trip for daemon island verb coordination.
//
// Vessel → island: DaemonMsg_PlaceVerb   — place a volatile verb invocation in the daemon TW5 wiki.
// Island → vessel: DaemonMsg_DelegateVerb — delegate a wiki-scope verb whose handler lives on main.
// Vessel → island: DaemonMsg_VerbResult  — deliver delegation result or error back to island.
//
// The daemon island owns the TW5 wiki event surface (kumu device law).
// All verbs pass through the daemon wiki change event → VerbDispatcher tick.
// Wiki-scope handlers that need vessel resources (repo, catalogHandle, etc.)
// delegate via DaemonMsg_DelegateVerb; the island awaits DaemonMsg_VerbResult before writing outcome.

/** Vessel → island: place a volatile verb invocation in the daemon island's TW5 wiki. */
export type PlaceOrigin = "channel" | "surface" | "content";

export interface DaemonMsg_PlaceVerb {
  origin: PlaceOrigin;
  type: "daemon:place-verb";
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
  face?: string;
  targets?: string[];
  batchMode?: string;
  requestId?: string;
  fromUri?: string;
  listenable?: string;
  /** The content id of the EFFECT this verb would produce (D1, P2.5 iter 4) — see
   *  `Verb.effectKey` in verb-tiddler.ts for the dedup contract. Absent = no dedup. */
  effectKey?: string;
}

/**
 * Vessel → island: FEED one captured turn to the daemon's idempotent telemetry capture cap.
 * The cap (hasCapture) claims this signal type and enqueues (turnText, sourceFile) into the nalu
 * (accumulate IN → WAL → flush via `mine --source ndjson`). Distinct from daemon:place-verb (which
 * the DISPATCH cap claims for VerbDispatcher verbs) — caps are independent, so a separate signal.
 */
export interface DaemonMsg_TelemetryPlaceVerb {
  type: "telemetry:place-verb";
  turnText: string;
  sourceFile: string;
  /**
   * The branch-frontier — the head turn-uuid(s) the producer (cli) derived from the transcript's
   * parentUuid turn-DAG (branchContextForTurn). Absent on a non-forked turn (the common case),
   * so the handle stays byte-identical to before. Carried as flat uuid strings; the in-VM annotate
   * rebuilds the {@link BranchContext} and feeds it to buildPatch's 3rd arg (the fork-cut).
   */
  frontier?: readonly string[];
  /**
   * The USER turn's uuid — the PROVENANCE key the node AST split lifts into the .structurepalace, so a
   * later rewind (kapae) can set-aside exactly this turn's recurrence tally. Absent ⇒ no key (the
   * turn's AST is stored, but not kapae-addressable). Stripped from the content drawer.
   */
  turnKey?: string;
  /**
   * The producer's stable per-source ordinal (the exchange index within the transcript) — the
   * ndjson `chunk_index` half of the deterministic drawer id (`sha256(source_file)_chunk`), so
   * the verb leg and the daemon-down direct-mine fallback converge on ONE drawer per turn.
   * Absent ⇒ the engine derives a stable ordinal from the turnKey / content hash.
   */
  chunkIndex?: number;
}

/**
 * Vessel → island: REWIND (kapae) one turn's .structurepalace tally — the convergence twin of the KG
 * valid-close + the Measure salience down-weight. Fire-and-forget (symmetric with telemetry
 * capture): the daemon owns the warm .structurepalace serve holder (a flock-singleton the CLI cannot
 * re-open), so the producer routes the rewind here. The capture cap (hasCapture) holds the engine
 * that holds the holder; it set-asides the turn's tally AND down-weights the turn's content drawers.
 */
export interface DaemonMsg_StructurepalaceKapae {
  type: "structurepalace:kapae";
  /** The USER turn's uuid to rewind (matched against the .structurepalace provenance turn_key). */
  turnKey: string;
  /** Optional rewind timestamp (the tombstone `valid_to`); defaults to now in the holder. */
  ended?: string;
}

/**
 * Vessel → island: derive a recall query's move-skeleton IN the daemon VM (the recall twin of the
 * telemetry capture). The host's recall verb routes a sigil-bearing query string here so the
 * markers→vector recall runs the SAME Move→Vec functor capture runs — parse with the full self-hosted
 * grammar + emit the skeleton (structural plane present) against the LIVE grammar-cache basis. One
 * runtime, no node-side fallback. The island calls `$tw.lares.deriveQuerySkeletonVm` and answers with
 * {@link DaemonMsg_DeriveSkeletonResult}.
 */
export interface DaemonMsg_DeriveSkeletonRequest {
  type: "daemon:derive-skeleton-request";
  requestId: string;
  /** The recall query — sniffed in-VM for sigil markers, parsed with the full grammar. */
  query: string;
}

/** Island → vessel: the in-VM query-derive result. `skeleton`+`basis` (plain objects — the move-
 *  skeleton + the serialized `{axes, dimension}` basis) when the query carried a derivable move-form;
 *  BOTH absent (a graceful null) when it did not (→ the recall fuses content-only). `error` carries a
 *  derive fault (the VM unavailable degrades to null at the host, never an error). */
export interface DaemonMsg_DeriveSkeletonResult {
  type: "daemon:derive-skeleton-result";
  requestId: string;
  skeleton?: unknown;
  basis?: unknown;
  error?: string;
}

// ── Worldline reads (the permainan substrate — sovereign-worker home) ───────
//
// The flow-lens reads run IN the daemon VM, the same one-runtime lock the recall
// query-derive rides (the cap-stack lifts WHOLE — no coordinator carve-out). Two
// reads, two request/result pairs mirroring DeriveSkeleton:
//
//   worldline-compare    — Well 1, the ITC LIVE-READ. The worker holds the
//     WorldlineCausal registry (projected from the edge-DAG it receives) and
//     answers the concurrent-capable causal verdict (before/after/concurrent/equal).
//   worldline-trajectory — Well 3 + Well 4, THE CORE. The worker orders a handle's
//     captured turns by happened-before (orderTrajectory), joins each turn's
//     move-space position (joinFormVectors over the form-vectors the host ships —
//     the formpalace is a node child_process the worker can't reach, so the host
//     fetches the bytes and ships them IN, exactly as it ships the query string to
//     derive), and optionally rides the SAME path through the seeded null shuffle.
//
// All COMPUTE — registry, ITC compare, ordering, joining, shuffling — lives in the
// worker; the host supplies only external data (edges from a transcript, form-vector
// bytes from the python store). Graceful: an unknown handle / empty input degrades
// like the derive (an `error` string or an empty result), never throws across the wire.

/** One captured turn pre-order, on the wire (GP-2 plain object): the join key + the within-handle
 *  happened-before tick + (optionally) the move-space position the host pre-fetched from the form
 *  store. `formVector` absent/null → the worker keeps the turn's TIME slot with a null form slot. */
export interface WorldlineStubWire {
  verbatimSha: string;
  tickCounter: number;
  formVector?: SparseFormVector | null;
}

/**
 * Vessel → island: answer the concurrent-capable causal verdict between two handles, IN the daemon VM.
 * The worker projects the WorldlineCausal registry from the edge-DAG carried here (worldlineCausalFromEdges)
 * — `opens`/`closes` derived host-side from a session transcript — then runs the pure ITC tree-leq. The
 * in-VM fn lives on `$tw.lares.worldlineCompareVm`. An unknown handle answers `error` (never throws the wire).
 */
export interface DaemonMsg_WorldlineCompareRequest {
  type: "daemon:worldline-compare-request";
  requestId: string;
  a: string;
  b: string;
  /** The durable edge-DAG opens (prov:Delegation spawn / prov:Communication inject), plain objects. */
  opens: readonly WorldlineEdgeTriple[];
  /** The edge-DAG closes (prov:Delegation handback) — absent when no handback edges stand. */
  closes?: readonly WorldlineEdgeClose[];
  /** The run-root / common-cause handle the registry seeds from (default "operator"). */
  root?: string;
}

/** Island → vessel: the ITC causal verdict (`order`) — or an `error` (unknown handle / no registry). */
export interface DaemonMsg_WorldlineCompareResult {
  type: "daemon:worldline-compare-result";
  requestId: string;
  /** "before" | "after" | "concurrent" | "equal" — the ItcOrder, carried as a plain string (GP-2). */
  order?: string;
  error?: string;
}

/**
 * Vessel → island: a handle's worldline-ordered path through move-space, IN the daemon VM (Well 3 +
 * Well 4). The worker runs orderTrajectory over the carried stubs, joins the form-vectors the host
 * shipped, and — when `includeNull` — rides the SAME path through the seeded shuffle. The in-VM fn
 * lives on `$tw.lares.worldlineTrajectoryVm`. The trajectory (+ optional null baseline) rides back as
 * a plain object (GP-2). Empty stubs → an empty trajectory (graceful, like a derive null).
 */
export interface DaemonMsg_WorldlineTrajectoryRequest {
  type: "daemon:worldline-trajectory-request";
  requestId: string;
  handle: string;
  stubs: readonly WorldlineStubWire[];
  /** Join move-space positions (default true; false = TIME-only skeleton). */
  joinForm?: boolean;
  /** Also compute the seeded null baseline (the shuffled order). */
  includeNull?: boolean;
  /** PRNG seed — a reproducible null (default 1). */
  seed?: number;
  /** Scale grading: the shuffle window (default full shuffle). */
  window?: number;
}

/** Island → vessel: the worldline-ordered trajectory (+ optional null baseline) as plain objects. */
export interface DaemonMsg_WorldlineTrajectoryResult {
  type: "daemon:worldline-trajectory-result";
  requestId: string;
  trajectory?: unknown;
  nullBaseline?: unknown;
  error?: string;
}

/**
 * Island → vessel: delegate a wiki-scope verb to the vessel handler registry.
 * Emitted when the daemon island's VerbDispatcher encounters a verb not in its local registry.
 * The vessel executes the handler and posts DaemonMsg_VerbResult back.
 */
export interface DaemonMsg_DelegateVerb {
  type: "daemon:delegate-verb";
  requestId: string;
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
  targets?: string[];
  batchMode?: string;
}

/** Vessel → island: delegation result or error. Daemon island resolves the in-flight delegation promise. */
export interface DaemonMsg_VerbResult {
  type: "daemon:verb-result";
  requestId: string;
  result?: Record<string, unknown>;
  error?: string;
}


export interface DaemonMsg_FaceSettled { type: "daemon:face-settled"; atomKey: string; op: "lit" | "dropped"; ok: boolean; reason?: string; }
export const mkDaemonFaceSettled = (atomKey: string, op: "lit" | "dropped", ok: boolean, reason?: string): DaemonMsg_FaceSettled => ({ type: "daemon:face-settled", atomKey, op, ok, ...(reason === undefined ? {} : { reason }) });
export const isDaemonFaceSettled = (v: IslandToVesselMsg): v is DaemonMsg_FaceSettled => v.type === "daemon:face-settled";

export interface DaemonMsg_FaceLit { type: "daemon:face-lit"; entry: JoinedFaceAuth; }
export interface DaemonMsg_FaceDrop { type: "daemon:face-drop"; atomKey: string; }
export const mkDaemonFaceLit = (entry: JoinedFaceAuth): DaemonMsg_FaceLit => ({ type: "daemon:face-lit", entry });
export const mkDaemonFaceDrop = (atomKey: string): DaemonMsg_FaceDrop => ({ type: "daemon:face-drop", atomKey });
export const isDaemonFaceLit = (v: VesselToIslandMsg): v is DaemonMsg_FaceLit => v.type === "daemon:face-lit";
export const isDaemonFaceDrop = (v: VesselToIslandMsg): v is DaemonMsg_FaceDrop => v.type === "daemon:face-drop";

/**
 * PeerClass — the class a gate's sorter answers for an admitted socket, before its verdict; the node
 * sharePolicy reads it to route every document.
 *   · "same-operator" — the keyholder worker vouched it: it holds cap=admin on the daemon bag (only this
 *     operator's PersonaGroup does), OR it presented a device-delegation edge chaining to the PINNED persona-KEL
 *     head. The operator's own device fleet → FULL device sync.
 *   · "contracted"    — it presented a quorum-signed admit that reads HELD against a Nexus this vessel carries.
 *     The federatable shelf, plus blind transit of a provably-sealed plane (carry the ciphertext, never the
 *     read-cap).
 *   · "walker"        — it presented THIS hearth's hosting grant, or redeemed a token at this gate.
 *   · "stranger"      — a proven key that is none of the above, admitted only where some carried Nexus reads
 *     OPEN. The federatable shelf alone.
 *
 * FAIL-CLOSED law: a socket with no class reads as a stranger at the sharePolicy. A stranger the gate does not
 * answer never reaches it: under PRIVATE the sorter answers silence.
 */
export type PeerClass = "same-operator" | "contracted" | "walker" | "stranger";


// ---------------------------------------------------------------------------
// personal / draft binding resolution (isomorphic-vessel epic, Stage 1)
// ---------------------------------------------------------------------------
// resolveOrMintBinding mints + delegates via keyhive, which lives in the daemon
// island after Stage 1. The host posts a request with the recipe fingerprint;
// the island mints/reuses against its Repo + keyhive and returns the doc URLs.

/** Vessel → island: resolve (or mint+delegate) the personal/draft binding pair. */
export interface DaemonMsg_ResolveBindingRequest {
  type: "daemon:resolve-binding-request";
  requestId: string;
  fingerprint: string;
  recipeTrace: { wikiDocId: string; libraryBagDocIds: readonly string[] };
  /** The wiki's slug — the draft floor doc keys under `wikis/{slug}/drafts/{did}` when no seat stands. */
  wikiSlug: string;
}

/**
 * Vessel → island: clear one face row before main runs it as a session's face (K20). The keyholder island meets the
 * row with the clearance a routed verb meets before it delegates (`VerbDispatcher.clearRouted`, as a local ask of the
 * presenter the session door verified), and answers whether it cleared. Nothing is placed or dispatched, so no
 * outcome follows: the row's answer rides the session's socket alone.
 */
export interface DaemonMsg_GateVerbRequest {
  type: "daemon:gate-verb-request";
  requestId: string;
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
}

/** Island → vessel: the face row cleared (no `error`), or the clearance's refusal. */
export interface DaemonMsg_GateVerbResult {
  type: "daemon:gate-verb-result";
  requestId: string;
  error?: string;
}

/** Island → vessel: the resolved binding doc URLs (or an error). */
export interface DaemonMsg_ResolveBindingResult {
  type: "daemon:resolve-binding-result";
  requestId: string;
  personalUrl?: string;
  draftUrl?: string;
  workingUrl?: string;
  error?: string;
}

// ── Eviction command (sovereign-worker: policy in worker, mechanism at the pool) ──
// The daemon WORKER owns residency POLICY (who/what to evict, gated by keyhive). The
// pool MECHANISM (mount/teardown of main-thread lanes) stays main-side. So the worker
// INITIATES an eviction by sending this command; the main pool obeys + acks. The worker
// holds a CAPABILITY (this channel) to the pool, never the pool itself.

/** Island → vessel: the worker commands the main pool to evict (unmount) a bag's lane. */
export interface DaemonMsg_EvictRequest {
  type: "daemon:evict-request";
  requestId: string;
  /** The bag (lar: URI) whose live lane the pool should tear down. */
  bagId: string;
}

/** Vessel → island: the pool's ack for an evict-request. */
export interface DaemonMsg_EvictResult {
  type: "daemon:evict-result";
  requestId: string;
  ok: boolean;
  error?: string;
}

/**
 * Island → vessel: the worker commands a residency-state op on the main-resident
 * BagStowage (sovereign-worker: the worker holds the keyhive-gated POLICY,
 * the manager + its LRU/reachability MECHANISM stays at the resource/main). The
 * worker's residency verbs (pin/unpin/register-cold) post this fire-and-forget — the
 * grant records as policy; main executes. (`residency` stats — a read — stays main
 * pending the askMain research.)
 */
export interface DaemonMsg_ResidencyOp {
  type: "daemon:residency-op";
  requestId: string;
  op: "pin" | "unpin" | "register-cold";
  bagId: string;
  reason?: string;
}

/** Vessel → island: ack for a residency-op. */
export interface DaemonMsg_ResidencyOpResult {
  type: "daemon:residency-op-result";
  requestId: string;
  ok: boolean;
  error?: string;
}

/**
 * Island (daemon worker) → vessel: seed a reboot-pending alert into a live wiki's
 * temp. A reboot-requiring daemon change (recipe/oracle/active-marker edit — all in
 * bags the wiki island doesn't load) syncs but only applies on the wiki's next boot;
 * the daemon commands main to deliver a `system-alert` verb to the affected live
 * island so the operator sees it. Fire-and-forget (best-effort UX); main skips wikis
 * that aren't mounted. The daemon computes "affected by content"; main filters "live".
 */
export interface DaemonMsg_WikiAlert {
  type: "daemon:wiki-alert";
  /** The affected wiki's slug — main maps it to `${hostId}:${slug}` to find the island. */
  wikiSlug: string;
  /** Operator-facing message (e.g. "Recipe changed — reboot to apply"). */
  message: string;
  /** The verb that caused the change (audit/display). */
  cause?: string;
  /** Alert kind — selects the alert tiddler ("reboot-pending" default; "disk-ward" etc.). */
  kind?: string;
  /** One instance of a kind: a projection standoff's key. A keyed alert stands at its own title, so two
   *  standoffs show two alerts. Absent = the kind's one coalescing alert. */
  key?: string;
  /** Remove the keyed alert: the condition it named stands resolved. */
  clear?: boolean;
}

/**
 * Vessel → wiki island: one sensorium read-signal ridden over the worker wire. The message
 * TYPE carries the cap-owned signal name (`sensorium:<cap-verb>`), so the kernel's dispatch delivers it
 * STRAIGHT to the island cap that claims it. The wire admits the namespace without enumerating a vessel's
 * possible sensory acts; each cap owns its own verbs. The island answers on its `sensorium:frame` event
 * (IslandMsg_Event), correlated by `requestId`; the vessel routes that frame back through onWorkerEvent.
 * Read-only end to end — no field of this message writes.
 */
export interface WikiMsg_SensoriumSignal {
  type: SensoriumSignalType;
  requestId: string;
  /** verb fields (recall's text/sigilHead/likeTitle/limit) — the cap reads them off `args`. */
  args?: Record<string, unknown>;
}

/** One cap-owned sensorium signal. The open suffix prevents central protocol edits for new vessel caps. */
export type SensoriumSignalType = `sensorium:${string}`;

/** Accept one non-empty lower-kebab cap verb; the cap, not the wire, owns its semantics. */
export function isSensoriumSignalType(value: unknown): value is SensoriumSignalType {
  return typeof value === "string" && /^sensorium:[a-z][a-z0-9-]*$/.test(value);
}

/** All messages the vessel may send to a causal island. */
export type VesselToIslandMsg =
  | IslandMsg_Manifest
  | IslandMsg_HooAnu
  | IslandMsg_Teardown
  | DaemonMsg_PlaceVerb
  | DaemonMsg_TelemetryPlaceVerb
  | DaemonMsg_StructurepalaceKapae
  | DaemonMsg_DeriveSkeletonRequest
  | DaemonMsg_WorldlineCompareRequest
  | DaemonMsg_WorldlineTrajectoryRequest
  | DaemonMsg_VerbResult
  | DaemonMsg_FaceLit
  | DaemonMsg_FaceDrop
  | DaemonMsg_ResolveBindingRequest
  | DaemonMsg_GateVerbRequest
  | DaemonMsg_EvictResult
  | DaemonMsg_ResidencyOpResult
  | WikiMsg_PlaceVerb
  | LarMsg_ControlEvent
  | LarMsg_Resend
  | PortVesselToIslandMsg
  | WikiMsg_SensoriumSignal
  | IslandMsg_CasBlock
  | IslandMsg_DyadRead
  | IslandMsg_DocRested
  | IslandMsg_CustodyWritten
  | IslandMsg_ViewCatalogResult
  | IslandMsg_ViewContentResult
  | IslandMsg_ViewSettled;

// ── Island → vessel ──────────────────────────────────────────────────────────

/**
 * Emit a verse-event reaction to the vessel for cross-wiki routing.
 * GP-2: payload MUST contain only string | number | boolean values.
 */
export interface IslandMsg_Event {
  type: "event";
  wikiUri: string;
  listenable: string;
  payload: Record<string, string | number | boolean>;
}

/**
 * GP-5 handshake completion.
 * Sent after all in-flight reactions complete and all live handles cancelled.
 * Vessel calls worker.terminate() on receipt.
 */
export interface IslandMsg_TeardownAck {
  type: "teardown:ack";
}

/**
 * Sovereignty declaration — the island signals it breathes (`ea`): TW5 live, Repo synced, first frame ready.
 *
 * In Hawaiian: ea = sovereignty, breath, life. The island declares its own standing;
 * the vessel records the declaration and considers the island live.
 * See: lar:///ha.ka.ba/lares/api/pono/ea
 */
export interface IslandMsg_Ea {
  type: "ea";
  wikiUri: string;
}

/**
 * Mount-progress breath — the island signals it still breathes while mounting.
 *
 * The ea-breath law: a mounting island that still emits never reads dead,
 * however long the mount. Vessel watchdogs (daemon VM, island pool) re-arm
 * their silence window on each breath; silence alone times out. `phase`
 * names the mount stage underway, so a silence timeout can say where the
 * breathing stopped. Emission ends at settle (`ea` or `fault`).
 *
 * `progress` carries a monotonic work counter (slots resolved, stages
 * entered) — the progress-kick law: a breath whose (phase, progress) pair
 * freezes proves only that the event loop turns, not that mount advances;
 * watchdogs bound that state with a stall budget. (The embedded-systems
 * "timer-ISR kick" anti-pattern, guarded.)
 */
export interface IslandMsg_Breath {
  type: "breath";
  wikiUri: string;
  phase: string;
  progress: number;
}

/**
 * Island fault signal. Vessel MUST mark the slot as evicted.
 */
export interface IslandMsg_Fault {
  type: "fault";
  wikiUri: string;
  error: string;
}

/**
 * Island → vessel: THE FETCH DOOR's ask. A worker's `resolveByCid` missed every local dir; it asks the vessel
 * (which alone holds a transport) for the bytes a cid names. The vessel answers `cas:block` on the same
 * `requestId` — verified bytes, or `null` when no fleet holder carried them (PENDING stays PENDING, no fault).
 */
export interface IslandMsg_CasWant {
  type: "cas:want";
  requestId: string;
  cid: string;
}

/** Vessel → island: the fetch door's answer — the bytes (already verified against the cid) or null. */
export interface IslandMsg_CasBlock {
  type: "cas:block";
  requestId: string;
  bytes: Uint8Array | null;
}

/**
 * Island → vessel: a session island asks its scoped document view to resolve a catalog name. The view answers
 * from the session's own facets on the same `requestId`: the document, or null with the refusal's name.
 */
export interface IslandMsg_ViewCatalog {
  type: "view:catalog";
  requestId: string;
  name: string;
}

/** Vessel → island: the view's answer to `view:catalog`. */
export interface IslandMsg_ViewCatalogResult {
  type: "view:catalog-result";
  requestId: string;
  documentUrl: string | null;
  refusal?: string;
}

/**
 * Island → vessel: a session island asks its scoped document view for the content at `cid`. A session island
 * holds no content store of its own; the view decides, and the vessel's owner reads its own store and answers
 * with the bytes on the same `requestId`. The island re-checks the bytes against the address it asked for.
 */
export interface IslandMsg_ViewContent {
  type: "view:content";
  requestId: string;
  cid: string;
}

/** Vessel → island: the view's answer to `view:content`: the bytes, or null with the refusal's name. */
export interface IslandMsg_ViewContentResult {
  type: "view:content-result";
  requestId: string;
  bytes: Uint8Array | null;
  refusal?: string;
}

/**
 * Island → vessel: a session island, about to tear down, names the heads of the documents it holds. A session
 * island keeps no store, so a write that has not yet crossed its port would end with it. The vessel's owner
 * answers `view:settled` once its own replica holds every named head of every document the session may write
 * and that replica rests in the owner's store; the island acks its teardown only then.
 */
export interface IslandMsg_ViewSettle {
  type: "view:settle";
  requestId: string;
  /** Document URL → the heads the island holds, as hex change hashes. */
  heads: Record<string, string[]>;
}

/** Vessel → island: the answer to `view:settle`. `settled: false` names a view that closed first. */
export interface IslandMsg_ViewSettled {
  type: "view:settled";
  requestId: string;
  settled: boolean;
}

/**
 * Island → vessel: THE REST DOOR's ask. An island mints a document its own Repo holds no store for; the vessel's
 * Repo alone saves it. Before the island records any pointer to that document it asks the vessel to rest the
 * named documents durably, and waits for `doc:rested` on the same `requestId`.
 */
export interface IslandMsg_DocRest {
  type: "doc:rest";
  requestId: string;
  documentIds: string[];
  /**
   * The heads the island holds of each named document, keyed by document id. A wiki island that lays its own bag
   * documents asks with them: the vessel answers only once its own Repo holds every head, then flushes.
   */
  heads?: Record<string, string[]>;
}

/** Vessel → island: the rest door's answer — every named document rests in the vessel's store, or `why` it does not. */
export interface IslandMsg_DocRested {
  type: "doc:rested";
  requestId: string;
  rested: boolean;
  /** The vessel names the documents its rest door finished flushing before this acknowledgment. */
  proof?: { documentIds: string[] };
  /** True when the vessel's copy changed `REST_STALL_ROUNDS` times and still lacked the island's heads: a named stall, never a silent hang. */
  stalled?: boolean;
  why?: string;
}

/** The carriers the custody write door lands: the vessel's own keyhive archive, and the mounted face's veil archive. */
export type CustodyWriteCarrier = "veil";
/**
 * Island → vessel: THE CUSTODY WRITE DOOR's ask. The vessel key rests in the vessel's main thread alone, so an
 * island that holds bytes to seal at rest hands them to the vessel, which seals them under the key it holds and
 * answers `custody:written` on the same `requestId`. The island names the CARRIER, never a path: the vessel decides
 * where the bytes rest.
 */
export interface IslandMsg_CustodyWrite { type: "custody:write"; requestId: string; carrier: CustodyWriteCarrier; bytes: Uint8Array; }
/**
 * Island → vessel: THE BINDING GATE'S VERDICT, posted by a persona-bound daemon island once its gate ran. `gate:clear`
 * names the edge (by digest) and the persona root the gate verified, so a holder admits a session only for the edge the
 * island itself cleared. `gate:refused` names why the gate held the boot shut.
 */
export interface IslandMsg_GateClear { type: "gate:clear"; edgeDigest: string; personaRoot: string; }
export interface IslandMsg_GateRefused { type: "gate:refused"; cause: string; }
/** Vessel → island: the custody write door's answer: the bytes rest sealed, or `why` they do not. */
export interface IslandMsg_CustodyWritten { type: "custody:written"; requestId: string; written: boolean; why?: string; }

/** Vessel → island: the fleet-edge standing the vessel read for an island's dyad ask. */
export interface IslandMsg_DyadRead {
  type: "dyad:read";
  requestId: string;
  standing: "clear" | "aside" | "owing" | "returned" | "unknown";
}

/** Island → vessel: ask the vessel's live fleet board for this device's standing. */
export interface IslandMsg_DyadAsk {
  type: "dyad:ask";
  requestId: string;
  fleetRoot: string;
  deviceKey: string;
}

/**
 * Vessel → island: place a wiki-scope verb invocation into a wiki island's TW5 wiki.
 *
 * Parallel to DaemonMsg_PlaceVerb for the daemon island. Any island running a
 * wiki dispatch behavior handles this by calling placeVerb on its TW5 wiki.
 * The wiki change event fires at next tick; the island's VerbDispatcher dispatches it.
 */
export interface WikiMsg_PlaceVerb {
  type:           "wiki:place-verb";
  verb:           string;
  args:           Record<string, unknown>;
  requestedBy:    string;
  targets?:       string[];
  batchMode?:     string;
  requestId?:     string;
}

/**
 * Island → vessel: wiki-scope verb result.
 *
 * Sent by a wiki island's dispatch behavior after completing a verb whose result
 * the vessel needs (e.g. MOVE — result carries the moved record list).
 * For fire-and-forget verbs (no result needed) the island omits this message.
 */
export interface WikiMsg_VerbResult {
  type:           "wiki:verb-result";
  requestId:      string;
  result?:        Record<string, unknown>;
  error?:         string;
}

/**
 * Worker readiness signal — the island's message handler is registered and the Worker
 * is ready to receive the manifest. The vessel MUST NOT send the manifest (with
 * transferred syncPort) until it receives this signal.
 *
 * This is required for ES module Workers that load WASM at startup (top-level await).
 * Messages sent before the listener is registered are dropped in browser Workers.
 * Inversion of control: the Worker initiates; the vessel waits.
 */
export interface IslandMsg_Ready {
  type: "ready";
}

/**
 * Island → vessel: the camera's traffic down (lar:///ha.ka.ba/lararium/mesh/lar-camera). The keyed frame rides
 * its own kind, never an `event` envelope; the answer to a control event rides `lar:control-result`; a host door
 * the engine asks the surface to open rides `lar:service`. The pool hands each to the vessel's handler the way it
 * hands an `event`: an island outside any session reaches `onWorkerEvent`, a session's island its own door.
 */
export type LarIslandToVesselMsg = LarMsg_Frame | LarMsg_ControlResult | LarMsg_Service;

/** All messages a causal island may send to the vessel. */
export type IslandToVesselMsg =
  | IslandMsg_Event
  | IslandMsg_TeardownAck
  | IslandMsg_Ea
  | IslandMsg_Breath
  | IslandMsg_Fault
  | IslandMsg_Ready
  | IslandMsg_GateClear
  | IslandMsg_GateRefused
  | WikiMsg_VerbResult
  | DaemonMsg_FaceSettled
  | DaemonMsg_DelegateVerb
  | DaemonMsg_DeriveSkeletonResult
  | DaemonMsg_WorldlineCompareResult
  | DaemonMsg_WorldlineTrajectoryResult
  | DaemonMsg_ResolveBindingResult
  | DaemonMsg_GateVerbResult
  | DaemonMsg_EvictRequest
  | DaemonMsg_ResidencyOp
  | DaemonMsg_WikiAlert
  | IslandMsg_CasWant
  | IslandMsg_DyadAsk
  | IslandMsg_DocRest
  | IslandMsg_CustodyWrite
  | IslandMsg_ViewCatalog
  | IslandMsg_ViewContent
  | IslandMsg_ViewSettle
  | LarIslandToVesselMsg
  | PortIslandToVesselMsg;

// ── Type guards ────────────────────────────────────────────────────────────

/** A message names its type, and the type names its shape; no counter rides beside it. */
function _hasType(v: unknown): v is { type: string } {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).type === "string";
}

export function isVesselToIslandMsg(v: unknown): v is VesselToIslandMsg {
  if (!_hasType(v)) return false;
  // THE CAMERA'S KINDS READ WHOLE AT THE ISLAND DOOR, the one gate every island message passes (the sovereign
  // kernel's listen). A control event reads through the contract's own reader: two targets, an unknown
  // crossing or a whole value past its bound vanish here exactly as a malformed message does, so no behavior,
  // no cap and no TW5 handler ever sees one, and the island keeps running.
  if (v.type === LAR_CONTROL_EVENT) return readLarControlEvent(v) !== null;
  if (v.type === LAR_RESEND) return readLarResend(v) !== null;
  if (isPortKind(v.type)) return readPortVesselMsg(v) !== null;   // the record port reads whole at the door too
  return (["manifest", "hooanu", "teardown", "daemon:place-verb", "telemetry:place-verb", "structurepalace:kapae", "daemon:derive-skeleton-request", "daemon:worldline-compare-request", "daemon:worldline-trajectory-request", "daemon:verb-result", "daemon:face-lit", "daemon:face-drop", "daemon:verify-request", "daemon:resolve-binding-request", "daemon:gate-verb-request", "daemon:evict-result", "daemon:residency-op-result", "wiki:place-verb", "cas:block", "dyad:read", "doc:rested", "custody:written", "view:catalog-result", "view:content-result", "view:settled"] as const)
    .includes(v.type as Exclude<VesselToIslandMsg["type"], SensoriumSignalType | typeof LAR_CONTROL_EVENT | typeof LAR_RESEND | PortVesselToIslandMsg["type"]>) || isSensoriumSignalType(v.type);
}

export function isIslandToVesselMsg(v: unknown): v is IslandToVesselMsg {
  if (!_hasType(v)) return false;
  // The camera's answers read whole at the vessel's door too: a frame whose key paints from two payloads, a
  // refusal that names no reason, a host door the house never named, each vanishes before any handler.
  if (v.type === "daemon:face-settled") {
    const msg = v as Record<string, unknown>;
    return typeof msg.atomKey === "string" && (msg.op === "lit" || msg.op === "dropped") && typeof msg.ok === "boolean" && (msg.reason === undefined || typeof msg.reason === "string");
  }
  if (v.type === LAR_FRAME) return readLarFrame(v) !== null;
  if (v.type === LAR_CONTROL_RESULT) return readLarControlResult(v) !== null;
  if (v.type === LAR_SERVICE) return readLarService(v) !== null;
  if (isPortKind(v.type)) return readPortIslandMsg(v) !== null;
  return (["event", "teardown:ack", "ea", "breath", "fault", "ready", "gate:clear", "gate:refused", "wiki:verb-result", "daemon:face-settled", "daemon:delegate-verb", "daemon:derive-skeleton-result", "daemon:worldline-compare-result", "daemon:worldline-trajectory-result", "daemon:verify-result", "daemon:resolve-binding-result", "daemon:gate-verb-result", "daemon:evict-request", "daemon:residency-op", "daemon:wiki-alert", "cas:want", "dyad:ask", "doc:rest", "custody:write", "view:catalog", "view:content", "view:settle"] as const).includes(
    v.type as Exclude<IslandToVesselMsg["type"], LarIslandToVesselMsg["type"] | PortIslandToVesselMsg["type"]>,
  );
}

// ── Envelope factories ─────────────────────────────────────────────────────

export function mkTeardown(): IslandMsg_Teardown {
  return { type: "teardown" };
}

export function mkTeardownAck(): IslandMsg_TeardownAck {
  return { type: "teardown:ack" };
}

/**
 * Build a manifest delivery message — the courier packet the vessel sends to a causal island.
 *
 * TRANSFER: caller MUST include `syncPort` in the `postMessage` transfer list:
 *   `worker.postMessage(msg, [msg.syncPort])`
 *
 * The manifest carries the WikiRecipe (slot structure) + IslandGrants (typed
 * structural capabilities). The island wires granted slots to doc handles and
 * resolves library bags from the catalog registry itself (boot = first reconcile).
 *
 * No blob bytes travel in the manifest — TW5 core bytes and plugin tiddlers live in
 * the lararium CRDT doc. Islands read them from the CRDT after `handle.whenReady()`.
 */
export function mkManifest(
  wikiUri:  string,
  syncPort: MessagePort,
  recipe:   import("./wiki-recipe.js").WikiRecipe,
  grants:   IslandGrants,
  coreHash: string | null = null,
  opts?: {
    storage?:        IslandStorageConfig;
    ownedDocument?:  IslandOwnedDocumentScope;
    diskMirrors?:    readonly { bagId: string; mirrorRoot: string; scope: string; guardNexusHandles?: boolean }[];
    daemonAuth?:      IslandMsg_Manifest["daemonAuth"];
    pluginCids?:     readonly string[];
    view?:           IslandViewStanding;
    resolved?:       Readonly<Record<string, string>>;
  },
): IslandMsg_Manifest {
  const msg: IslandMsg_Manifest = {
    type: "manifest",
    wikiUri,
    coreHash,
    recipe,
    grants,
    syncPort,
  };
  if (opts?.storage)             msg.storage     = opts.storage;
  if (opts?.ownedDocument)       msg.ownedDocument = opts.ownedDocument;
  if (opts?.diskMirrors?.length) msg.diskMirrors = opts.diskMirrors;
  if (opts?.daemonAuth)           msg.daemonAuth   = opts.daemonAuth;
  if (opts?.pluginCids?.length)  msg.pluginCids  = opts.pluginCids;
  if (opts?.view)                msg.view        = opts.view;
  if (opts?.resolved)            msg.resolved    = opts.resolved;
  return msg;
}

/** Ready signal — Worker has registered its message listener, vessel may now send the manifest. */
export function mkReady(): IslandMsg_Ready {
  return { type: "ready" };
}

/** Build an ea sovereignty declaration — the island signals it breathes and stands ready. */
export function mkEa(wikiUri: string): IslandMsg_Ea {
  return { type: "ea", wikiUri };
}

/** Build a mount-progress breath — `phase` names the stage, `progress` the monotonic work counter. */
export function mkBreath(wikiUri: string, phase: string, progress = 0): IslandMsg_Breath {
  return { type: "breath", wikiUri, phase, progress };
}

export function mkFault(wikiUri: string, error: string): IslandMsg_Fault {
  return { type: "fault", wikiUri, error };
}

export function mkDaemonPlaceVerb(opts: {
  origin: PlaceOrigin;
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
  face?: string;
  targets?: string[];
  batchMode?: string;
  requestId?: string;
  fromUri?: string;
  listenable?: string;
  effectKey?: string;
}): DaemonMsg_PlaceVerb {
  const msg: DaemonMsg_PlaceVerb = {
    type: "daemon:place-verb",
    origin: opts.origin,
    verb: opts.verb,
    args: opts.args,
    requestedBy: opts.requestedBy,
  };
  if (opts.targets?.length)  msg.targets    = opts.targets;
  if (opts.batchMode)        msg.batchMode  = opts.batchMode;
  if (opts.requestId)        msg.requestId  = opts.requestId;
  if (opts.fromUri)          msg.fromUri    = opts.fromUri;
  if (opts.listenable)       msg.listenable = opts.listenable;
  if (opts.effectKey)        msg.effectKey  = opts.effectKey;
  if (opts.face)             msg.face       = opts.face;
  return msg;
}

export function mkTelemetryPlaceVerb(opts: {
  turnText: string;
  sourceFile: string;
  frontier?: readonly string[];
  turnKey?: string;
  chunkIndex?: number;
}): DaemonMsg_TelemetryPlaceVerb {
  return {
    type: "telemetry:place-verb",
    turnText: opts.turnText,
    sourceFile: opts.sourceFile,
    ...(opts.frontier && opts.frontier.length ? { frontier: [...opts.frontier] } : {}),
    ...(opts.turnKey ? { turnKey: opts.turnKey } : {}),
    ...(opts.chunkIndex !== undefined ? { chunkIndex: opts.chunkIndex } : {}),
  };
}

export function mkStructurepalaceKapae(opts: {
  turnKey: string;
  ended?: string;
}): DaemonMsg_StructurepalaceKapae {
  return {
    type: "structurepalace:kapae",
    turnKey: opts.turnKey,
    ...(opts.ended ? { ended: opts.ended } : {}),
  };
}

export function mkDaemonDeriveSkeletonRequest(opts: {
  requestId: string;
  query: string;
}): DaemonMsg_DeriveSkeletonRequest {
  return {
    type: "daemon:derive-skeleton-request",
    requestId: opts.requestId,
    query: opts.query,
  };
}

export function mkDaemonDeriveSkeletonResult(opts: {
  requestId: string;
  skeleton?: unknown;
  basis?: unknown;
  error?: string;
}): DaemonMsg_DeriveSkeletonResult {
  const msg: DaemonMsg_DeriveSkeletonResult = {
    type: "daemon:derive-skeleton-result",
    requestId: opts.requestId,
  };
  if (opts.skeleton !== undefined) msg.skeleton = opts.skeleton;
  if (opts.basis    !== undefined) msg.basis    = opts.basis;
  if (opts.error    !== undefined) msg.error    = opts.error;
  return msg;
}

export function mkDaemonWorldlineCompareRequest(opts: {
  requestId: string;
  a: string;
  b: string;
  opens: readonly WorldlineEdgeTriple[];
  closes?: readonly WorldlineEdgeClose[];
  root?: string;
}): DaemonMsg_WorldlineCompareRequest {
  const msg: DaemonMsg_WorldlineCompareRequest = {
    type: "daemon:worldline-compare-request",
    requestId: opts.requestId,
    a: opts.a,
    b: opts.b,
    opens: opts.opens,
  };
  if (opts.closes !== undefined) msg.closes = opts.closes;
  if (opts.root   !== undefined) msg.root   = opts.root;
  return msg;
}

export function mkDaemonWorldlineCompareResult(opts: {
  requestId: string;
  order?: string;
  error?: string;
}): DaemonMsg_WorldlineCompareResult {
  const msg: DaemonMsg_WorldlineCompareResult = {
    type: "daemon:worldline-compare-result",
    requestId: opts.requestId,
  };
  if (opts.order !== undefined) msg.order = opts.order;
  if (opts.error !== undefined) msg.error = opts.error;
  return msg;
}

export function mkDaemonWorldlineTrajectoryRequest(opts: {
  requestId: string;
  handle: string;
  stubs: readonly WorldlineStubWire[];
  joinForm?: boolean;
  includeNull?: boolean;
  seed?: number;
  window?: number;
}): DaemonMsg_WorldlineTrajectoryRequest {
  const msg: DaemonMsg_WorldlineTrajectoryRequest = {
    type: "daemon:worldline-trajectory-request",
    requestId: opts.requestId,
    handle: opts.handle,
    stubs: opts.stubs,
  };
  if (opts.joinForm    !== undefined) msg.joinForm    = opts.joinForm;
  if (opts.includeNull !== undefined) msg.includeNull = opts.includeNull;
  if (opts.seed        !== undefined) msg.seed        = opts.seed;
  if (opts.window      !== undefined) msg.window      = opts.window;
  return msg;
}

export function mkDaemonWorldlineTrajectoryResult(opts: {
  requestId: string;
  trajectory?: unknown;
  nullBaseline?: unknown;
  error?: string;
}): DaemonMsg_WorldlineTrajectoryResult {
  const msg: DaemonMsg_WorldlineTrajectoryResult = {
    type: "daemon:worldline-trajectory-result",
    requestId: opts.requestId,
  };
  if (opts.trajectory   !== undefined) msg.trajectory   = opts.trajectory;
  if (opts.nullBaseline !== undefined) msg.nullBaseline = opts.nullBaseline;
  if (opts.error        !== undefined) msg.error        = opts.error;
  return msg;
}

export function mkDaemonDelegateVerb(opts: {
  requestId: string;
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
  targets?: string[];
  batchMode?: string;
}): DaemonMsg_DelegateVerb {
  const msg: DaemonMsg_DelegateVerb = {
    type: "daemon:delegate-verb",
    requestId: opts.requestId,
    verb: opts.verb,
    args: opts.args,
    requestedBy: opts.requestedBy,
  };
  if (opts.targets?.length)  msg.targets   = opts.targets;
  if (opts.batchMode)        msg.batchMode = opts.batchMode;
  return msg;
}

export function mkDaemonVerbResult(opts: {
  requestId: string;
  result?: Record<string, unknown>;
  error?: string;
}): DaemonMsg_VerbResult {
  const msg: DaemonMsg_VerbResult = {
    type: "daemon:verb-result",
    requestId: opts.requestId,
  };
  if (opts.result !== undefined) msg.result = opts.result;
  if (opts.error  !== undefined) msg.error  = opts.error;
  return msg;
}

export function mkDaemonResolveBindingRequest(opts: {
  requestId:   string;
  fingerprint: string;
  recipeTrace: { wikiDocId: string; libraryBagDocIds: readonly string[] };
  wikiSlug:    string;
}): DaemonMsg_ResolveBindingRequest {
  return {
    type: "daemon:resolve-binding-request",
    requestId:   opts.requestId,
    fingerprint: opts.fingerprint,
    recipeTrace: opts.recipeTrace,
    wikiSlug:    opts.wikiSlug,
  };
}

export function mkDaemonGateVerbRequest(opts: {
  requestId:   string;
  verb:        string;
  args:        Record<string, unknown>;
  requestedBy: string;
}): DaemonMsg_GateVerbRequest {
  return { type: "daemon:gate-verb-request", requestId: opts.requestId, verb: opts.verb, args: opts.args, requestedBy: opts.requestedBy };
}

export function mkDaemonGateVerbResult(opts: { requestId: string; error?: string }): DaemonMsg_GateVerbResult {
  return { type: "daemon:gate-verb-result", requestId: opts.requestId, ...(opts.error !== undefined ? { error: opts.error } : {}) };
}

export function mkDaemonResolveBindingResult(opts: {
  requestId:    string;
  personalUrl?: string;
  draftUrl?:    string;
  workingUrl?:  string;
  error?:       string;
}): DaemonMsg_ResolveBindingResult {
  const msg: DaemonMsg_ResolveBindingResult = {
    type: "daemon:resolve-binding-result",
    requestId: opts.requestId,
  };
  if (opts.personalUrl !== undefined) msg.personalUrl = opts.personalUrl;
  if (opts.draftUrl    !== undefined) msg.draftUrl    = opts.draftUrl;
  if (opts.workingUrl  !== undefined) msg.workingUrl  = opts.workingUrl;
  if (opts.error       !== undefined) msg.error       = opts.error;
  return msg;
}

export function mkDaemonEvictResult(opts: { requestId: string; ok: boolean; error?: string }): DaemonMsg_EvictResult {
  const msg: DaemonMsg_EvictResult = {
    type: "daemon:evict-result",
    requestId: opts.requestId,
    ok:        opts.ok,
  };
  if (opts.error !== undefined) msg.error = opts.error;
  return msg;
}

export function mkDaemonResidencyOp(opts: {
  requestId: string;
  op: "pin" | "unpin" | "register-cold";
  bagId: string;
  reason?: string;
}): DaemonMsg_ResidencyOp {
  const msg: DaemonMsg_ResidencyOp = {
    type: "daemon:residency-op",
    requestId: opts.requestId,
    op:        opts.op,
    bagId:     opts.bagId,
  };
  if (opts.reason !== undefined) msg.reason = opts.reason;
  return msg;
}

export function mkDaemonWikiAlert(opts: {
  wikiSlug: string;
  message:  string;
  cause?:   string;
  kind?:    string;
  key?:     string;
  clear?:   boolean;
}): DaemonMsg_WikiAlert {
  const msg: DaemonMsg_WikiAlert = {
    type:     "daemon:wiki-alert",
    wikiSlug: opts.wikiSlug,
    message:  opts.message,
    ...(opts.kind ? { kind: opts.kind } : {}),
    ...(opts.key ? { key: opts.key } : {}),
    ...(opts.clear === true ? { clear: true } : {}),
  };
  if (opts.cause !== undefined) msg.cause = opts.cause;
  return msg;
}

export function mkDaemonResidencyOpResult(opts: { requestId: string; ok: boolean; error?: string }): DaemonMsg_ResidencyOpResult {
  const msg: DaemonMsg_ResidencyOpResult = {
    type: "daemon:residency-op-result",
    requestId: opts.requestId,
    ok:        opts.ok,
  };
  if (opts.error !== undefined) msg.error = opts.error;
  return msg;
}

export function mkWikiPlaceVerb(opts: {
  verb: string;
  args: Record<string, unknown>;
  requestedBy: string;
  targets?: string[];
  batchMode?: string;
  requestId?: string;
}): WikiMsg_PlaceVerb {
  const msg: WikiMsg_PlaceVerb = {
    type: "wiki:place-verb",
    verb: opts.verb,
    args: opts.args,
    requestedBy: opts.requestedBy,
  };
  if (opts.targets?.length)  msg.targets   = opts.targets;
  if (opts.batchMode)        msg.batchMode = opts.batchMode;
  if (opts.requestId)        msg.requestId = opts.requestId;
  return msg;
}

export function mkSensoriumSignal(opts: {
  signal: SensoriumSignalType;
  requestId: string;
  args?: Record<string, unknown>;
}): WikiMsg_SensoriumSignal {
  return {
    type: opts.signal,
    requestId: opts.requestId,
    // the S2 cap reads its fields off `args` when present — carry the requestId inside it too.
    args: { requestId: opts.requestId, ...(opts.args ?? {}) },
  };
}

export function mkWikiVerbResult(opts: {
  requestId: string;
  result?: Record<string, unknown>;
  error?: string;
}): WikiMsg_VerbResult {
  const msg: WikiMsg_VerbResult = {
    type: "wiki:verb-result",
    requestId: opts.requestId,
  };
  if (opts.result !== undefined) msg.result = opts.result;
  if (opts.error  !== undefined) msg.error  = opts.error;
  return msg;
}


