/**
 * VesselIslandPoolCore — the one platform-blind island pool.
 *
 * Holds all island residency ONCE — wela/anu + pin, LRU, sweeper, placeWikiVerb,
 * diskMirror. Node and browser each supply only a VesselIslandHost (worker spawn,
 * sync channel, per-wiki storage, the ready handshake flag) and pool config
 * (mainRepo, diskMirrorGrant, hotCap); the browser runs the same residency on a
 * smaller hotCap. `pinned` turns load-bearing wherever a finite hotCap creates
 * eviction pressure.
 *
 * TWO DOORS, ONE SLOT TABLE. `mountSurface` mounts a SESSION's island: it keys the island by the whole
 * session key `(sessionId, generation, surfaceId, wikiId, facePlaneId, recipeRevision, capabilityProfile)`,
 * opens the session's scoped document view over exactly what its effective recipe resolved, attaches the
 * island's port through that view, and hands the island no durable store. The pool's bookkeeping, pending
 * calls, failure accounting and leases all read that one key. A session's end (`closeSession`) and its
 * fence (`fenceSession`) reach every surface it holds, a mount in flight among them. `mountWiki` mounts an island outside any
 * session, keyed by its wiki and reaching the Repo over a broad port; every interactive surface leaves that
 * door when its caller opens a session (lar:///ha.ka.ba/lares/api/pono/session-contract#/islands).
 *
 * No TW5 dependency — pure protocol + transport + residency, so it lives in mesh.
 * The vessel main thread holds NO engine reference; every TW5 VM runs inside the
 * island worker (no-VM-on-main-thread law).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/vessel-island-pool-core
 */

import { attachMessageChannelSync } from "./island-repo.js";
import { awaitIslandMsg } from "./vessel-host.js";
import { wikiBagUri, wikiSlotUri, type WikiSlotKind } from "./wiki-recipe.js";
import type { VesselWorkerHandle, VesselIslandHost } from "./vessel-host.js";
import {
  isIslandToVesselMsg,
  mkManifest,
  mkTeardown,
  mkWikiPlaceVerb,
  mkWikiDomEvent, mkWikiDomInput,
  mkSensoriumSignal,
} from "./island-protocol.js";
import type { SensoriumSignalType } from "./island-protocol.js";
import type {
  AutomergeUrl,
  DocHandle,
  DocumentId,
  Repo,
} from "@automerge/automerge-repo";
import { hasHeads } from "@automerge/automerge";
import type {
  IslandMsg_Event,
  IslandMsg_Ea,
  IslandMsg_Ready,
  IslandMsg_TeardownAck,
  WikiMsg_VerbResult,
} from "./island-protocol.js";
import type { WikiMountSpec, WikiRecipe } from "./wiki-recipe.js";
import type { ResidencyTemperature } from "./bag-residency.js";
import { SessionDocumentView } from "./session-document-view.js";
import { isCapabilityProfile, type CapabilityProfile } from "./session-contract.js";
import { facetsOfSurfaceRecipe, resolvedSlotsOf, type SurfaceRecipe } from "./surface-recipe.js";
import { ORACLE_BAG } from "./wiki-recipe.js";
import { verifyCidBytes } from "./cas-transit.js";
import { ISLAND_PROTOCOL_VERSION } from "./island-protocol.js";
import type { IslandGrants, IslandMsg_ViewCatalog, IslandMsg_ViewContent, IslandMsg_ViewSettle } from "./island-protocol.js";

// ── Slots — two-state thermal axis (wela/anu) + orthogonal pin flag ──────────

interface IslandSlot {
  temperature: "wela";
  pinned:      boolean;
  /** The slot's key: a wiki id for an island outside any session, the whole session key for a surface. */
  wikiId:      string;
  worker:      VesselWorkerHandle;
  /** Vessel side of the island sync channel. Close on unmount (Law §7). */
  mainPort:    MessagePort;
  /** True from the moment a teardown begins: an island on its way down takes no new placement. */
  closing:     boolean;
  /** A session surface's standing: its key parts, the scoped view its port rides, and whether the owner has
   *  confirmed it holds what the island wrote (`view:settle`). Null outside a session. */
  surface:     { readonly parts: IslandKeyParts; readonly view: SessionDocumentView; readonly standing: SurfaceStanding } | null;
}

/**
 * What the owner knows of one surface island's writes. `settled` reads true once a settle ask answered true
 * WITHIN THE CURRENT EPOCH; a teardown opens a new epoch, so an ask that began before it counts for nothing
 * and frees the one waiting place for the teardown's own ask.
 */
interface SurfaceStanding { settled: boolean; settling: boolean; epoch: number }

/** How one island's unmount ended. `settled` rides a session surface alone: true when the owner confirmed,
 *  before the island went, that it holds every write the island named. An island that keeps no store and
 *  ends unsettled may have taken a write with it, and the caller reads that here. */
export interface IslandEnd {
  readonly wikiId:   string;
  readonly acked:    boolean;
  readonly settled?: boolean;
}

// ── The island's identity ──────────────────────────────────────────────────────────────────────

/** The seven parts that name one session surface's island. */
export interface IslandKeyParts {
  readonly sessionId:         string;
  readonly generation:        number;
  readonly surfaceId:         string;
  readonly wikiId:            string;
  readonly facePlaneId:       string;
  readonly recipeRevision:    string;
  readonly capabilityProfile: CapabilityProfile;
}

/** The most heads one document may carry in a settle ask, and the shape of each: a hex change hash. */
const SETTLE_MAX_HEADS = 1024;
const HEAD_HASH = /^[0-9a-f]{64}$/;

/**
 * The session a caller acts for, as the owner checked it against its own table before it placed anything.
 * A placement toward a SURFACE island names it, and the pool passes the placement only when the island's
 * own key carries that session and that generation: a caller that holds one session's key reaches no other
 * session's island, and a call from an earlier generation reaches no later one.
 */
export interface PlacingSession {
  readonly sessionId:  string;
  readonly generation: number;
}

/** A fault in what a caller handed the pool as a surface mount. Its message leads with the fault's name. */
export class SurfaceMountError extends Error {}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0;

/** Every surface key starts here, and the wiki door refuses an id that does: the two doors share no slot. */
export const SURFACE_KEY_PREFIX = "surface:";

/**
 * THE ISLAND KEY. One string per distinct seven-part key, and never one string for two: the parts ride a JSON
 * array in a fixed order, so no part's content can read as a boundary between two others. A part that fails
 * its type throws; nothing defaults.
 */
export function islandKey(parts: IslandKeyParts): string {
  const { sessionId, generation, surfaceId, wikiId, facePlaneId, recipeRevision, capabilityProfile } = parts;
  if (!nonEmpty(sessionId) || !nonEmpty(surfaceId) || !nonEmpty(wikiId) || !nonEmpty(facePlaneId) || !nonEmpty(recipeRevision)) {
    throw new SurfaceMountError("island-key-part-absent");
  }
  if (typeof generation !== "number" || !Number.isSafeInteger(generation) || generation < 0) throw new SurfaceMountError("island-key-generation-malformed");
  if (!isCapabilityProfile(capabilityProfile)) throw new SurfaceMountError("island-key-profile-unknown");
  return SURFACE_KEY_PREFIX + JSON.stringify([sessionId, generation, surfaceId, wikiId, facePlaneId, recipeRevision, capabilityProfile]);
}

/**
 * One session surface to mount: the session's route, and the effective recipe the one resolver returned for
 * this mount. The wiki, the face plane, the revision and the profile all read from that recipe, so no caller
 * can state a key that disagrees with what the island lays.
 */
export interface SurfaceMount {
  readonly sessionId:  string;
  readonly generation: number;
  readonly surfaceId:  string;
  readonly recipe:     SurfaceRecipe;
  /** Does the document at `documentId` reference the content at `cid`? The owner answers from its own replica. */
  readonly referencesContent?: (documentId: string, cid: string) => boolean;
}

/** The key parts a surface mount names. */
export function islandKeyPartsOf(mount: SurfaceMount): IslandKeyParts {
  return {
    sessionId: mount.sessionId, generation: mount.generation, surfaceId: mount.surfaceId,
    wikiId: mount.recipe.wikiId, facePlaneId: mount.recipe.facePlaneId,
    recipeRevision: mount.recipe.revision, capabilityProfile: mount.recipe.profile,
  };
}

/** What one activation lays, whichever door it came through. */
interface ActivationPlan {
  readonly wikiUri:     string;
  readonly coreHash:    string | null;
  readonly recipe:      WikiRecipe;
  readonly grants:      IslandGrants;
  /** The plugin CIDs, or the refusal that fails the activation. */
  pluginCids(): Promise<{ readonly ok: true; readonly pluginCids: readonly string[] } | { readonly ok: false; readonly error: string }>;
  /** The session surface this activation mounts, or null for an island outside any session. */
  readonly surface:     { readonly parts: IslandKeyParts; readonly mount: SurfaceMount } | null;
}

interface ColdSlot {
  temperature: "anu";
  wikiId:      string;
  cooledAt:   number;
}

type Slot = IslandSlot | ColdSlot;

export type DiskMirrorGrant = readonly { bagId: string; mirrorRoot: string; scope: string; perWikiSlug?: boolean; selfCanon?: boolean; wikiSlot?: WikiSlotKind; guardNexusHandles?: boolean }[];

/** Resolve a mount's disk mirrors: intersect the held grant (authority) with the
 *  recipe's `mirrorBags` (designation), then fill a per-wiki grant's bag + leaf
 *  from the recipe's `wikiSlug` at mount time.
 *
 *  Two per-wiki authorities expand BOTH bagId and leaf from the slug:
 *  - A `wikiSlot` entry names one of the live "above the fold" layers (e.g.
 *    `working` → bag `wikis/{slug}/working`, disk `wikis/{slug}`) — the live
 *    edit plane.
 *  - A `selfCanon` entry is the per-wiki CANON authority (the wiki's own
 *    `bags/{slug}` bag → disk `bags/{slug}`), yielding only when the recipe
 *    designates that canon AND no literal grant already covers it — so system
 *    wikis (lares/lararium, literal grants) keep their static roots and never
 *    double-project.
 *
 *  OCAP-clean: authority stays in the static grant, designation in the synced
 *  recipe, the per-instance bag + subdir resolved here. */
export function resolveDiskMirrors(
  grant: DiskMirrorGrant,
  mirrorBags: readonly string[] | undefined,
  wikiSlug: string,
): DiskMirrorGrant {
  const perWikiBag = (g: DiskMirrorGrant[number]): string =>
    g.selfCanon ? wikiBagUri(wikiSlug)
    : g.wikiSlot ? wikiSlotUri(wikiSlug, g.wikiSlot)
    : g.bagId;
  const literalBags = new Set(grant.filter((g) => !g.selfCanon && !g.wikiSlot).map((g) => g.bagId));
  return grant
    .filter((g) => {
      const bag = perWikiBag(g);
      return g.selfCanon
        ? Boolean(mirrorBags?.includes(bag)) && !literalBags.has(bag)
        : Boolean(mirrorBags?.includes(bag));
    })
    .map((g) =>
      (g.selfCanon || g.wikiSlot)
        ? { ...g, bagId: perWikiBag(g), mirrorRoot: `${g.mirrorRoot}/${wikiSlug}` }
        : g.perWikiSlug
          ? { ...g, mirrorRoot: `${g.mirrorRoot}/${wikiSlug}` }
          : g,
    );
}

export interface VesselIslandPoolCoreOptions {
  host: VesselIslandHost;
  /** Vessel main Repo — each island's mainPort wires to it for CRDT sync. */
  mainRepo?: Repo | null;
  /** Held disk-write capability — bag → mirror configs this pool MAY project. */
  diskMirrorGrant?: DiskMirrorGrant;
  /** Called when an island OUTSIDE any session emits a verse-event reaction. */
  onWorkerEvent?: (wikiId: string, msg: IslandMsg_Event) => void;
  /**
   * Called when a SESSION's island emits a verse-event reaction, with the key parts that island stands
   * under. A session island's event never reaches `onWorkerEvent`: that door's callers place vessel verbs
   * from an event's payload, and a session acts through a gate bound to its own facets. Absent, a surface
   * island's events drop.
   */
  onSurfaceEvent?: (surface: IslandKeyParts, msg: IslandMsg_Event) => void;
  /**
   * R3/R4 — resolve ONE mount's own `spec.recipe` into the CIDs its manifest should carry (the
   * fixed boot-set floor UNION this wiki's verified, byte-checked offering selection). REQUIRED:
   * the pre-R3 flat `pluginCids` floor (every island getting the SAME vessel-wide list) has
   * retired on BOTH platforms — node supplies `resolveNodeIslandPluginCids`, the browser supplies
   * `resolveBrowserIslandPluginCids`, and the constructor refuses to build a pool with neither, so
   * no blanket-list path can survive by omission. Called once per activation, BEFORE the worker
   * spawns; a refusal here throws, so a wiki whose recipe names an unresolvable, colliding, or
   * byte-missing offering never reads as an empty or successful mount — it fails the activation
   * outright, exactly like any other mount failure (counted in the same OTP intensity ledger).
   */
  resolvePluginCids: (recipe: WikiRecipe) => Promise<
    | { readonly ok: true; readonly pluginCids: readonly string[] }
    | { readonly ok: false; readonly error: string }
  >;
  /**
   * Called when the island's `ea` declaration lands — the island speaks
   * "sovereignty, breath, life" and the vessel RESPONDS (never a synthetic
   * vessel-side lifecycle event; the breath is the event). The durable
   * mailbox drains on ea: parked verbs deliver-to-identity the moment the
   * identity breathes again.
   */
  onEa?: (wikiId: string) => void;
  /**
   * Read content by address from the vessel's own content store. A session island holds no store: its
   * scoped view decides each content read, and this reader then answers it. Absent, a surface's island
   * draws `content-store-absent` for every address.
   */
  readContent?: (cid: string) => Uint8Array | null | Promise<Uint8Array | null>;
  /** Override the mount silence budget in ms (tests). */
  mountSilenceMs?: number;
  /** Override the mount progress-stall budget in ms (default 3x silence). */
  mountStallMs?: number;
  /** Mount failures tolerated per wiki inside the window before the cap trips. */
  maxMountFailures?: number;
  /** The intensity window in ms (OTP MaxR/MaxT discipline). */
  mountFailureWindowMs?: number;
}

// The mount-failure window, the cold-slot `cooledAt`, and every failure timestamp below are
// THIS PROCESS'S OWN local resource-pressure bookkeeping — never persisted, never compared
// across a restart — so they read `performance.now()` rather than `Date.now()`: an adversarial
// or operator wall-clock set-back/set-forward can neither reopen a mount intensity cap early
// nor hold it closed past its real window.
//
// A SILENCE budget, not a mount deadline: the ea-wait re-arms on each island
// breath (resetOnTypes), so a slow mount that keeps breathing never times out.
// The stall budget (3x) bounds breathing-without-advancing; the intensity cap
// (MaxR/MaxT) bounds restart storms on a deterministically failing mount.
const HANDSHAKE_TIMEOUT_MS        = 10_000;
const MAX_MOUNT_FAILURES          = 3;
const MOUNT_FAILURE_WINDOW_MS     = 60_000;

export class VesselIslandPoolCore {
  private readonly _slots = new Map<string, Slot>();
  // Single-flight activation latch — one in-flight mount Promise per grain. The
  // single-owner gate: concurrent references to one cold grain fold into ONE
  // activation, so no stream ever spawns two sovereign workers (no safe epsilon).
  private readonly _activating = new Map<string, Promise<void>>();
  // Retained mount spec per grain — the reactivation source. A cold slot drops its
  // worker + ports, but its spec (recipe/grants/coreHash + pinned) stays here, so a
  // later REFERENCE re-mounts it byte-for-byte (Orleans activation-on-reference: the
  // grain identity outlives its physical activation). `ensureWiki` reads this.
  private readonly _mountSpecs = new Map<string, { spec: WikiMountSpec; pinned: boolean }>();
  private readonly _host:           VesselIslandHost;
  private readonly _mainRepo:       Repo | null;
  private readonly _diskMirrorGrant: DiskMirrorGrant;
  private readonly _onWorkerEvent:  ((wikiId: string, msg: IslandMsg_Event) => void) | null;
  private readonly _onSurfaceEvent: ((surface: IslandKeyParts, msg: IslandMsg_Event) => void) | null;
  private readonly _resolvePluginCids: VesselIslandPoolCoreOptions["resolvePluginCids"];
  private readonly _onEa:           ((wikiId: string) => void) | null;
  private readonly _readContent:    VesselIslandPoolCoreOptions["readContent"] | null;
  private readonly _pendingWikiVerbs = new Map<string, {
    /** The island the call went to: a lease that drops rejects every call still parked on it. */
    key:     string;
    resolve: (r: Record<string, unknown>) => void;
    reject:  (e: Error) => void;
  }>();
  // THE SESSION FENCES. A session that ended mounts nothing again, and a session that switched mounts nothing
  // under a generation it left. Ids and floors alone: no face, no surface, nothing a reader could list.
  private readonly _endedSessions = new Set<string>();
  private readonly _generationFloor = new Map<string, number>();
  // The key parts of each surface activation in flight, so a session's end reaches a mount that has not landed.
  private readonly _activatingSurfaces = new Map<string, { readonly parts: IslandKeyParts; view: SessionDocumentView | null }>();
  // True while `disposeAll` runs: a mount that lands meanwhile takes no slot.
  private _disposing = false;
  // OTP intensity bookkeeping — per-wiki failure timestamps inside the window.
  private readonly _mountFailures = new Map<string, number[]>();
  private readonly _mountSilenceMs:       number;
  private readonly _mountStallMs:         number;
  private readonly _maxMountFailures:     number;
  private readonly _mountFailureWindowMs: number;

  constructor(opts: VesselIslandPoolCoreOptions) {
    // M6 — no silent ignore. `resolvePluginCids` is REQUIRED in the type above; this runtime
    // guard catches a caller that reaches the constructor from plain JS (no compiler to stop it)
    // and refuses BY NAME rather than mounting every island against an absent resolver.
    if (!opts.resolvePluginCids) {
      throw new Error(
        "[vessel-pool] resolvePluginCids is required — every mount resolves its OWN recipe's " +
        "plugin selection; the flat vessel-wide pluginCids floor has retired on every platform",
      );
    }
    this._host            = opts.host;
    this._mainRepo        = opts.mainRepo ?? null;
    this._diskMirrorGrant = opts.diskMirrorGrant ?? [];
    this._onWorkerEvent   = opts.onWorkerEvent ?? null;
    this._onSurfaceEvent  = opts.onSurfaceEvent ?? null;
    this._resolvePluginCids = opts.resolvePluginCids;
    this._onEa            = opts.onEa ?? null;
    this._readContent     = opts.readContent ?? null;
    this._mountSilenceMs       = opts.mountSilenceMs ?? HANDSHAKE_TIMEOUT_MS;
    this._mountStallMs         = opts.mountStallMs ?? 3 * this._mountSilenceMs;
    this._maxMountFailures     = opts.maxMountFailures ?? MAX_MOUNT_FAILURES;
    this._mountFailureWindowMs = opts.mountFailureWindowMs ?? MOUNT_FAILURE_WINDOW_MS;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  /** Mount a wiki as a live (`wela`) island. `opts.pinned` exempts from LRU.
   *  Single-flight per grain: concurrent activations of one wikiId fold into ONE. */
  async mountWiki(wikiId: string, spec: WikiMountSpec, opts: { pinned?: boolean } = {}): Promise<void> {
    // The wiki door never reaches a session's island: an id spelled as a surface key refuses.
    if (typeof wikiId === "string" && wikiId.startsWith(SURFACE_KEY_PREFIX)) throw new SurfaceMountError("wiki-id-reads-as-surface-key");
    // A pool that closes admits no mount: one that entered now could land after the close returned.
    if (this._disposing) throw new SurfaceMountError("pool-closing");
    // Already live — done.
    const existing = this._slots.get(wikiId);
    if (existing && existing.temperature === "wela") {
      return;
    }
    // Single-flight activation latch: an activation for this grain already runs →
    // FOLD into it. One sovereign body per stream, never two workers for one wikiId
    // (the single-owner law; the strong-consistency Orleans grain-directory, not the
    // eventual-consistency default). A cold→wela activation runs exactly once;
    // concurrent references await the ONE in-flight mount and share its outcome.
    const inFlight = this._activating.get(wikiId);
    if (inFlight) {
      await inFlight;
      return;
    }
    // Retain the spec BEFORE the mount can fail — so a later reference re-mounts the
    // grain identically whether this activation lands or not (the spec is the grain's
    // durable identity; the worker is just its current body).
    this._mountSpecs.set(wikiId, { spec, pinned: opts.pinned ?? false });
    const activation = this._activate(wikiId, {
      wikiUri: wikiId, coreHash: spec.coreHash, recipe: spec.recipe, grants: spec.grants,
      // R3/R4 — PLUGINS LOAD BY THIS WIKI'S OWN RECIPE, on every platform.
      pluginCids: () => this._resolvePluginCids(spec.recipe),
      surface: null,
    }, opts);
    this._activating.set(wikiId, activation);
    try {
      await activation;
    } finally {
      this._activating.delete(wikiId);
    }
  }

  /**
   * Mount one SESSION surface as its own island and return the island's key.
   *
   * The key carries all seven parts, so two sessions that wear one face take two islands, and a mount
   * repeated with the same key opens one (single-flight, like every activation). The recipe arrives resolved:
   * the island lays the documents it names and resolves nothing, so a recipe written after this mount reaches
   * the next mount (a new revision, a new key, a new island) and never this one. The island's port attaches
   * through a scoped document view opened over exactly the recipe's documents, and the island holds no
   * durable store.
   */
  async mountSurface(mount: SurfaceMount, opts: { pinned?: boolean } = {}): Promise<string> {
    const parts = islandKeyPartsOf(mount);
    const key = islandKey(parts);
    if (this._disposing) throw new SurfaceMountError("pool-closing");
    const fenced = this._fenceOf(parts);
    if (fenced) throw new SurfaceMountError(fenced);
    const existing = this._slots.get(key);
    if (existing && existing.temperature === "wela") return key;
    const inFlight = this._activating.get(key);
    if (inFlight) { await inFlight; return key; }
    const floor = mount.recipe.slots.find((slot) => slot.slot === ORACLE_BAG)?.document;
    if (!floor) throw new SurfaceMountError("surface-recipe-floor-absent");
    const pluginCids = mount.recipe.pluginCids;
    this._activatingSurfaces.set(key, { parts, view: null });
    const activation = this._activate(key, {
      wikiUri: mount.recipe.wikiId, coreHash: mount.recipe.coreHash, recipe: mount.recipe.recipe,
      grants: { islandUrl: floor },
      // The one resolver already selected and byte-checked the plugins; the pool resolves nothing again.
      pluginCids: async () => ({ ok: true, pluginCids }),
      surface: { parts, mount },
    }, opts);
    this._activating.set(key, activation);
    try {
      await activation;
    } finally {
      this._activating.delete(key);
      this._activatingSurfaces.delete(key);
    }
    return key;
  }

  /**
   * The live island a placement may reach, or the refusal's name. An island on its way down takes none. A
   * surface island takes a placement only from the session its own key carries, at that generation; an
   * island outside any session takes none that names a session.
   */
  private _placeable(key: string, session: PlacingSession | undefined): IslandSlot | string {
    const slot = this._slots.get(key);
    if (!slot || slot.temperature === "anu") return "no live island";
    if (slot.closing) return "the island tears down";
    const parts = slot.surface?.parts ?? null;
    if (parts === null) return session === undefined ? slot : "no session holds this island";
    if (session === undefined || session.sessionId !== parts.sessionId || session.generation !== parts.generation) {
      return "the placing session holds no such surface";
    }
    return slot;
  }

  /** The fence a surface's key stands behind, by name, or null when its session still mounts. */
  private _fenceOf(parts: IslandKeyParts): "session-ended" | "generation-fenced" | null {
    if (this._endedSessions.has(parts.sessionId)) return "session-ended";
    const floor = this._generationFloor.get(parts.sessionId);
    return floor !== undefined && parts.generation < floor ? "generation-fenced" : null;
  }

  /**
   * CLOSE a session in good order: every surface it holds tears down, and each island first waits until the
   * owner holds what it wrote (`view:settle`), since a session island keeps no store. From this call on the
   * session mounts nothing: a mount still in flight refuses when it lands. Returns each ended key with whether
   * its island acked the teardown.
   */
  async closeSession(sessionId: string): Promise<IslandEnd[]> {
    this._endedSessions.add(sessionId);
    this._generationFloor.delete(sessionId);
    return this._endSurfaces((parts) => parts.sessionId === sessionId);
  }

  /**
   * FENCE a session: its scoped views close AT ONCE, before any island hears of the teardown, and then its
   * surfaces dispose. A write still on its way from a fenced island never lands; an effect in flight resolves
   * through its own receipt. With `beforeGeneration` the fence falls on every earlier generation alone, which
   * is the switch's third step; without it the whole session ends, as an observed revocation ends it.
   */
  async fenceSession(sessionId: string, beforeGeneration?: number): Promise<IslandEnd[]> {
    if (beforeGeneration === undefined) {
      this._endedSessions.add(sessionId);
      this._generationFloor.delete(sessionId);
    } else if (!this._endedSessions.has(sessionId)) {
      this._generationFloor.set(sessionId, Math.max(this._generationFloor.get(sessionId) ?? 0, beforeGeneration));
    }
    const fenced = (parts: IslandKeyParts): boolean =>
      parts.sessionId === sessionId && (beforeGeneration === undefined || parts.generation < beforeGeneration);
    for (const slot of this._slots.values()) {
      if (slot.temperature === "wela" && slot.surface && fenced(slot.surface.parts)) slot.surface.view.close();
    }
    // A surface still mounting already holds an attached view and no slot: the fence closes that view too.
    for (const landing of this._activatingSurfaces.values()) {
      if (fenced(landing.parts)) landing.view?.close();
    }
    return this._endSurfaces(fenced);
  }

  /** Tear down every live surface the predicate names, after any matching activation in flight has settled. */
  private async _endSurfaces(names: (parts: IslandKeyParts) => boolean): Promise<IslandEnd[]> {
    // A mount in flight lands behind the fence and refuses itself; wait for it so no island outlives this call.
    const landing: Promise<unknown>[] = [];
    for (const [key, entry] of this._activatingSurfaces) {
      const activation = this._activating.get(key);
      if (activation && names(entry.parts)) landing.push(activation.catch(() => undefined));
    }
    await Promise.all(landing);
    const ending: string[] = [];
    for (const [key, slot] of this._slots) {
      if (slot.temperature === "wela" && slot.surface && names(slot.surface.parts)) ending.push(key);
    }
    return Promise.all(ending.map((key) => this.unmountWiki(key)));
  }

  /** The scoped view an island's peer ID stands under, or null. The share verdict's caller reads it to keep
   *  a session island's announcements inside its facets before any message forms. */
  viewOfPeer(peerId: string): SessionDocumentView | null {
    for (const slot of this._slots.values()) {
      if (slot.temperature === "wela" && slot.surface?.view.peerId === peerId) return slot.surface.view;
    }
    return null;
  }

  /** The key parts a live surface island stands under, or null for any other key. */
  surfaceOf(key: string): IslandKeyParts | null {
    const slot = this._slots.get(key);
    return slot?.temperature === "wela" ? slot.surface?.parts ?? null : null;
  }

  /**
   * Activation-on-REFERENCE — ensure a grain is live, mounting it from its retained
   * spec if cold/absent (Orleans: a reference activates the grain; the resolver need
   * not know whether it already runs). Idempotent + single-flight (folds through
   * mountWiki), so a cold→wela activation preserves single-owner under concurrent
   * references. Returns true when the grain is live after the call.
   *
   * A grain never mounted here (no retained spec) needs its spec resolved by the
   * CALLER first (the resolver's spec-resolution shore) — `ensureWiki` re-mounts a
   * KNOWN grain; it does not invent a spec. Absent a retained spec it returns false
   * (the caller resolves the spec, then calls `mountWiki`).
   */
  async ensureWiki(wikiId: string): Promise<boolean> {
    if (this.has(wikiId)) {
      return true;
    }
    const retained = this._mountSpecs.get(wikiId);
    if (!retained) return false;
    await this.mountWiki(wikiId, retained.spec, { pinned: retained.pinned });
    return this.has(wikiId);
  }

  /** The activation body proper — intensity gate → LRU evict → spawn → `ea`
   *  handshake → live slot. Runs under mountWiki's single-flight latch, so exactly
   *  one activation runs per grain at a time (single-owner preserved). */
  private async _activate(wikiId: string, plan: ActivationPlan, opts: { pinned?: boolean }): Promise<void> {
    const pinned = opts.pinned ?? false;
    // Intensity gate (MaxR/MaxT): a wiki that keeps failing its mount inside
    // the window fails FAST and NAMED — never another full silence budget per
    // attempt, never a restart storm. The window prunes itself; success clears.
    const failures = (this._mountFailures.get(wikiId) ?? [])
      .filter((t) => performance.now() - t < this._mountFailureWindowMs);
    if (failures.length >= this._maxMountFailures) {
      this._mountFailures.set(wikiId, failures);
      throw new Error(
        `[vessel-pool] mount intensity cap for ${wikiId} — ` +
        `${failures.length} failures inside ${this._mountFailureWindowMs}ms; ` +
        `retry after the window clears`,
      );
    }

    // No self-eviction here: the ONE residency collector (BagStowage +
    // per-grain-type dials) owns reachability + the wiki cap. It evicts the LRU wiki
    // through onEvict → unmountWiki as it drives activation, so the pool stays a pure
    // mount mechanism — one authority, no second collector. `pinned` still rides the
    // slot below (the collector reads pin-exemption on its own side).

    // R3/R4 — PLUGINS LOAD BY THIS WIKI'S OWN RECIPE, on every platform. Resolved BEFORE any
    // port/worker exists, so a refused selection (unknown offering, cid-mismatch, a duplicate or
    // boot-set-collision claim, missing or corrupt bytes) never spends a worker spawn — it fails
    // the activation outright, counted in the SAME intensity ledger as any other mount failure,
    // never a silent empty success. `resolvePluginCids` is required (constructor-enforced), so
    // no mount ever falls through to a flat, unresolved floor.
    const resolved = await plan.pluginCids();
    if (!resolved.ok) {
      failures.push(performance.now());
      this._mountFailures.set(wikiId, failures);
      throw new Error(`[vessel-pool] ${wikiId} plugin resolution refused: ${resolved.error}`);
    }
    const pluginCids = resolved.pluginCids;

    // THE FENCE READS BEFORE ANY VIEW ATTACHES. A session that ended or switched while the plugins resolved,
    // or a pool that began to close, opens no channel at all.
    const fencedEarly = this._disposing ? "pool-closing" : plan.surface ? this._fenceOf(plan.surface.parts) : null;
    if (fencedEarly) throw new SurfaceMountError(fencedEarly);

    // THE SESSION'S SCOPED VIEW OPENS BEFORE ANY PORT EXISTS: malformed facets fail the activation, counted
    // in the same ledger, and no worker spawns for a view that cannot stand.
    let view: SessionDocumentView | null = null;
    const standing: SurfaceStanding = { settled: false, settling: false, epoch: 0 };
    if (plan.surface) {
      try {
        view = new SessionDocumentView({
          profile: plan.surface.parts.capabilityProfile,
          facets:  facetsOfSurfaceRecipe(plan.surface.mount.recipe),
          ...(plan.surface.mount.referencesContent ? { referencesContent: plan.surface.mount.referencesContent } : {}),
        });
      } catch (err) {
        failures.push(performance.now());
        this._mountFailures.set(wikiId, failures);
        throw err;
      }
      // The fence reaches this view from here on, though no slot holds it yet.
      const landing = this._activatingSurfaces.get(wikiId);
      if (landing) landing.view = view;
    }

    const { mainPort, syncPort } = this._host.newSyncChannel();
    // A session island's port rides its view and nothing wider; an island outside any session rides the port bare.
    if (this._mainRepo) {
      if (view) view.attach(this._mainRepo, mainPort);
      else attachMessageChannelSync(this._mainRepo, mainPort);
    }

    // A session's island spawns without the vessel's own doors: its view answers what it may ask.
    const worker = this._host.spawnWorker(plan.surface ? { session: true } : undefined);
    this._wireWorkerListeners(wikiId, worker, view, standing, plan.surface?.parts ?? null);

    // Disk-mirror = designation ∩ grant: the recipe (synced) DESIGNATES bags;
    // this pool's held grant names which it MAY write. A browser pool's empty
    // grant → never mirrors. The unforgeable authority lives in the grant.
    // Authority ∩ designation, with per-wiki-slug leaves filled from the recipe
    // (e.g. working → wikis/{slug}). See resolveDiskMirrors.
    //
    // A SESSION ISLAND HOLDS AN EPHEMERAL REPLICA: no storage rides its manifest, on any platform, and no
    // disk mirror either. The vessel's owner alone persists.
    const diskMirrors = plan.surface ? [] : resolveDiskMirrors(this._diskMirrorGrant, plan.recipe.mirrorBags, plan.recipe.wikiSlug);
    const storage = plan.surface ? undefined : this._host.storage(wikiId);

    const manifestMsg = mkManifest(
      plan.wikiUri, syncPort, plan.recipe, plan.grants, plan.coreHash,
      {
        ...(storage            ? { storage }     : {}),
        ...(diskMirrors.length ? { diskMirrors } : {}),
        ...(pluginCids.length ? { pluginCids } : {}),
        ...(plan.surface && view ? { view: { peerId: view.peerId }, resolved: resolvedSlotsOf(plan.surface.mount.recipe) } : {}),
      },
    );

    try {
      // Browser ES-module workers signal "ready" (WASM loaded) before manifest.
      if (this._host.awaitReady) {
        await awaitIslandMsg<IslandMsg_Ready>({
          expectedType: "ready",
          timeoutMs:    this._mountSilenceMs,
          subscribe:      (h) => worker.listen(h),
          subscribeError: (h) => worker.onError(h),
        });
      }

      // The ea-breath law: the mounting island breathes; each breath re-arms
      // the silence window — a long live mount never reads dead; silence alone
      // does. The stall budget bounds breathing-without-advancing.
      await awaitIslandMsg<IslandMsg_Ea>({
        expectedType:    "ea",
        timeoutMs:       this._mountSilenceMs,
        progressStallMs: this._mountStallMs,
        resetOnTypes:    ["breath"],
        rejectOnTypes:   ["fault"],
        subscribe:      (h) => worker.listen(h),
        subscribeError: (h) => worker.onError(h),
        send: () => worker.post(manifestMsg, [syncPort]),
      });
    } catch (err) {
      // A failed mount cleans up after itself: the spawned worker dies, the
      // sync port closes, the failure lands in the intensity ledger. Without
      // the terminate, every ea timeout stranded a live worker thread.
      worker.terminate();
      view?.close();
      mainPort.close();
      failures.push(performance.now());
      this._mountFailures.set(wikiId, failures);
      throw err;
    }

    // THE FENCE READS AGAIN WHERE THE MOUNT LANDS. A session that ended, or switched, while this island booted
    // takes no slot: the island and its view go down, and the mount refuses by the fence's name.
    const fenced = this._disposing ? "pool-closing" : plan.surface ? this._fenceOf(plan.surface.parts) : null;
    if (fenced) {
      view?.close();
      mainPort.close();
      worker.terminate();
      throw new SurfaceMountError(fenced);
    }

    this._mountFailures.delete(wikiId);   // a clean mount clears the ledger
    this._slots.set(wikiId, {
      temperature: "wela", pinned, wikiId, worker, mainPort, closing: false,
      surface: plan.surface && view ? { parts: plan.surface.parts, view, standing } : null,
    });
    // The breath of an island outside any session drains that wiki's mailbox. A session's island answers to
    // the caller that mounted it, which holds this mount's own promise; no wiki-keyed mailbox reads its key.
    if (!plan.surface) this._onEa?.(wikiId);   // the island breathed; respond
  }

  /** Unmount a live island via teardown handshake; slot goes cold (`anu`). Returns whether
   *  the island ACKED its own teardown, or this door CUT it past the handshake timeout
   *  (H3/M4) — never silently folded into "torn down", so a caller's own shutdown report
   *  can name the cut honestly. */
  async unmountWiki(wikiId: string): Promise<IslandEnd> {
    const slot = this._slots.get(wikiId);
    if (!slot || slot.temperature === "anu") return { wikiId, acked: true };

    const workerSlot = slot;
    // The island takes no placement from here on: a verb placed after its settle would write past what
    // `settled` vouches for.
    workerSlot.closing = true;
    // ONLY A SETTLE THIS TEARDOWN DRAWS COUNTS. An island that settled earlier and wrote again leaves here
    // unsettled unless it asks afresh, so `settled` never vouches for a write the owner may lack.
    if (workerSlot.surface) {
      const standing = workerSlot.surface.standing;
      standing.epoch++;                                    // an ask that began before this teardown counts for nothing
      standing.settled = false;
      standing.settling = false;                           // and holds no place the teardown's own ask needs
    }
    let acked = true;
    try {
      await awaitIslandMsg<IslandMsg_TeardownAck>({
        expectedType: "teardown:ack",
        timeoutMs:    HANDSHAKE_TIMEOUT_MS,
        subscribe:      (h) => workerSlot.worker.listen(h),
        subscribeError: (h) => workerSlot.worker.onError(h),
        send: () => workerSlot.worker.post(mkTeardown()),
      });
    } catch (err) {
      acked = false;
      console.warn(`[vessel-pool] ${wikiId}: teardown handshake failed — ${err}; terminating anyway`);
    }

    // The scoped view closes with its island: the leg stands down and every gate refuses from here on.
    workerSlot.surface?.view.close();
    workerSlot.mainPort.close();
    workerSlot.worker.terminate();
    // A session's island never cools for a later reference to wake: its lease drops with it.
    if (workerSlot.surface) this._slots.delete(wikiId);
    else this._slots.set(wikiId, { temperature: "anu", wikiId, cooledAt: performance.now() });
    // Every call still parked on this island rejects by name: no caller waits out a lease that dropped.
    for (const [requestId, pending] of [...this._pendingWikiVerbs]) {
      if (pending.key !== wikiId) continue;
      this._pendingWikiVerbs.delete(requestId);
      pending.reject(new Error(`[vessel-pool] the island for ${wikiId} went down with this call parked`));
    }
    return workerSlot.surface ? { wikiId, acked, settled: workerSlot.surface.standing.settled } : { wikiId, acked };
  }

  /** Teardown all live islands. Returns which acked their own teardown and which this door
   *  CUT past the handshake timeout — H3/M4: `Promise.allSettled` alone made every cut island
   *  read identically to an acked one, which is exactly how `main.ts` could claim "every
   *  teardown receipt landed" moments after logging a handshake timeout. */
  async disposeAll(): Promise<{ acked: readonly string[]; cut: readonly string[] }> {
    // A mount still in flight would land after this returned and stand with nobody to dispose it. The pool
    // marks itself closing, so each such mount refuses where it lands, and waits for every one of them.
    this._disposing = true;
    const teardowns: Promise<IslandEnd>[] = [];
    let settled: PromiseSettledResult<IslandEnd>[];
    try {
      await Promise.allSettled([...this._activating.values()]);
      for (const slot of this._slots.values()) {
        if (slot.temperature === "wela") teardowns.push(this.unmountWiki(slot.wikiId));
      }
      settled = await Promise.allSettled(teardowns);
    } finally {
      this._disposing = false;
    }
    this._slots.clear();
    const acked: string[] = [];
    const cut: string[] = [];
    for (const s of settled) {
      if (s.status === "fulfilled") (s.value.acked ? acked : cut).push(s.value.wikiId);
      // unmountWiki never rejects (it catches its own handshake failure) — a rejection here
      // would be a harness fault; name it as cut-unnamed rather than silently dropping it.
    }
    return { acked, cut };
  }

  // ── Wiki-scope job dispatch ──────────────────────────────────────────────────

  /** Place a wiki-scope job into a live island and await the result. */
  placeWikiVerb(
    wikiId: string,
    opts: { verb: string; args: Record<string, unknown>; requestedBy: string; targets?: string[]; batchMode?: string },
    session?: PlacingSession,
  ): Promise<Record<string, unknown>> {
    const slot = this._placeable(wikiId, session);
    if (typeof slot === "string") return Promise.reject(new Error(`[vessel-pool] ${slot} for ${wikiId}`));
    const requestId = crypto.randomUUID();
    const worker = slot.worker;
    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingWikiVerbs.delete(requestId);
        reject(new Error(`[vessel-pool] wiki:place-verb timeout for ${wikiId}/${opts.verb}`));
      }, HANDSHAKE_TIMEOUT_MS);
      this._pendingWikiVerbs.set(requestId, {
        key: wikiId,
        resolve: (r) => { clearTimeout(timer); resolve(r); },
        reject:  (e) => { clearTimeout(timer); reject(e); },
      });
      worker.post(mkWikiPlaceVerb({ ...opts, requestId }));
    });
  }

  /** Relay a main-thread DOM event to the wiki island — the interactivity RETURN leg. Accumulate-
   *  family but fire-and-forget: postMessage IS the ordered queue, the sink (TW5's own handler) is
   *  synchronous, so no requestId/timeout/reserve. A cooled slot drops it (Hiatus drop-honesty). */
  placeWikiEvent(
    wikiId: string,
    ev: { renderId: string; eventType: string; fields: Record<string, number | boolean> },
    session?: PlacingSession,
  ): void {
    const slot = this._placeable(wikiId, session);
    if (typeof slot === "string") return;
    slot.worker.post(mkWikiDomEvent(ev));
  }

  /** Relay a main-thread TEXT event to the wiki island — the input leg of the RETURN. Same drop-honest
   *  fire-and-forget as placeWikiEvent; `mkWikiDomInput` refuses a value past the bound at this shore,
   *  and the island door refuses it again on arrival. */
  placeWikiInput(
    wikiId: string,
    ev: { renderId: string; eventType: string; value: string },
    session?: PlacingSession,
  ): void {
    const slot = this._placeable(wikiId, session);
    if (typeof slot === "string") return;
    slot.worker.post(mkWikiDomInput(ev));
  }

  /** Post one sensorium read-signal INTO a live island — the daemon's supervision read ridden
   *  over the worker wire. FAILS LOUD when the designation names no live island (the confused-deputy
   *  ward at the mechanism: the designation carries the authority; nothing falls back to a default
   *  island). Fire-and-forget on the wire — the island answers on its `sensorium:frame` event, which
   *  routes back through onWorkerEvent, correlated by `requestId`. */
  placeSensoriumSignal(
    wikiId: string,
    msg: { signal: SensoriumSignalType; requestId: string; args?: Record<string, unknown> },
    session?: PlacingSession,
  ): void {
    const slot = this._placeable(wikiId, session);
    if (typeof slot === "string") {
      throw new Error(
        `[vessel-pool] sensorium signal refused — ${slot} for ${wikiId} ` +
        `(the designation must name a supervised, live island; no ambient fallback)`,
      );
    }
    slot.worker.post(mkSensoriumSignal(msg));
  }

  // ── Accessors ────────────────────────────────────────────────────────────────

  tier(wikiId: string): ResidencyTemperature | null {
    return this._slots.get(wikiId)?.temperature ?? null;
  }

  isPinned(wikiId: string): boolean {
    const slot = this._slots.get(wikiId);
    return slot?.temperature === "wela" ? slot.pinned : false;
  }

  coldSince(wikiId: string): number | null {
    const slot = this._slots.get(wikiId);
    return slot?.temperature === "anu" ? slot.cooledAt : null;
  }

  has(wikiId: string): boolean {
    return this._slots.get(wikiId)?.temperature === "wela";
  }

  stats(): { pinned: number; wela: number; anu: number } {
    let pinned = 0, wela = 0, anu = 0;
    for (const s of this._slots.values()) {
      if (s.temperature === "anu") anu++;
      else if (s.pinned)           pinned++;
      else                         wela++;
    }
    return { pinned, wela, anu };
  }

  /** The islands OUTSIDE any session, for the residency collector and a status read. A session's island
   *  never appears: a list of surface keys would name which sessions, and which faces, one vessel wears
   *  together, and the owner keeps no such roster. `stats()` counts them and names none. */
  inspect(): Array<{ wikiId: string; temperature: ResidencyTemperature; pinned: boolean }> {
    return [...this._slots.values()].filter((s) => s.temperature === "anu" || !s.surface).map((s) =>
      s.temperature === "wela"
        ? { wikiId: s.wikiId, temperature: s.temperature, pinned: s.pinned }
        : { wikiId: s.wikiId, temperature: s.temperature, pinned: false },
    );
  }

  get size(): number { return this._slots.size; }

  /** Whether a retained mount spec exists for this grain — true when the pool has
   *  mounted it at least once OR a resolver taught it one (so `ensureWiki` can
   *  activate it). The activation cap reads this to distinguish a reactivatable grain
   *  from a never-opened one (which needs the caller's `resolveWikiSpec`). */
  knowsSpec(wikiId: string): boolean {
    return this._mountSpecs.has(wikiId);
  }

  /** TEACH the pool a grain's mount spec WITHOUT mounting it — the resolver's shore
   *  for a never-opened wiki (resolveWikiSpec). Once taught, `ensureWiki` (and so
   *  the collector's onHydrate) can activate it exactly like a reactivated grain,
   *  through the single-flight latch. A no-op once the grain is already known, so a
   *  resolve never clobbers a live grain's retained spec. */
  registerSpec(wikiId: string, spec: WikiMountSpec, opts: { pinned?: boolean } = {}): void {
    if (this._mountSpecs.has(wikiId)) return;
    this._mountSpecs.set(wikiId, { spec, pinned: opts.pinned ?? false });
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  /**
   * One settle ask: true once this Repo's replica holds every head the island named, for every document the
   * session may write, and those documents rest in the owner's store. A document the session may only read
   * counts for nothing here: the view never took the island's change to it. A view that closed, or closes
   * while this waits, answers false at once.
   */
  private async _answerSettle(ask: IslandMsg_ViewSettle, view: SessionDocumentView | null): Promise<boolean> {
    const repo = this._mainRepo;
    if (!view || view.closed || !repo) return false;
    if (typeof ask.heads !== "object" || ask.heads === null) return false;
    const written: DocumentId[] = [];
    const closed = view.whenClosed().then(() => false);
    // THE OWNER WALKS ITS OWN LIST, never the island's: only a document the session may write gets read off
    // the ask, so what the island names beyond that costs nothing, whatever its size.
    for (const url of view.writableDocuments()) {
      if (!Object.hasOwn(ask.heads, url)) continue;
      const heads = ask.heads[url];
      if (!Array.isArray(heads) || heads.length > SETTLE_MAX_HEADS || !heads.every((h) => typeof h === "string" && HEAD_HASH.test(h))) return false;
      if (heads.length === 0) continue;
      let handle: DocHandle<unknown>;
      try { handle = await repo.find(url as AutomergeUrl); } catch { return false; }
      const holds = (): boolean => { try { return hasHeads(handle.doc() as Parameters<typeof hasHeads>[0], heads); } catch { return false; } };
      if (!holds()) {
        let stop = (): void => {};
        const arrived = new Promise<boolean>((resolve) => {
          const onChange = (): void => { if (holds()) resolve(true); };
          handle.on("heads-changed", onChange);
          stop = () => { handle.off("heads-changed", onChange); };
        });
        const reached = await Promise.race([arrived, closed]);
        stop();
        if (!reached) return false;
      }
      written.push(handle.documentId);
    }
    if (view.closed) return false;
    try { if (written.length > 0) await repo.flush(written); } catch { return false; }
    return !view.closed;
  }

  /** One content ask: the view decides first, and only an address it passes ever reaches the store. */
  private async _answerContent(
    ask: IslandMsg_ViewContent, view: SessionDocumentView | null,
  ): Promise<{ bytes: Uint8Array | null; refusal?: string }> {
    if (!view) return { bytes: null, refusal: "view-absent" };
    const verdict = view.content(ask.cid);
    if (!verdict.ok) return { bytes: null, refusal: verdict.refusal };
    if (!this._readContent) return { bytes: null, refusal: "content-store-absent" };
    let bytes: Uint8Array | null = null;
    try { bytes = await this._readContent(ask.cid); } catch { bytes = null; }
    // The view may close while the store reads: a closed view answers nothing.
    if (view.closed) return { bytes: null, refusal: "view-closed" };
    // CONTENT ANSWERS TO ITS ADDRESS. Bytes that fail to recompute to the address they were asked under never
    // leave, and read exactly as bytes the store never held.
    return bytes instanceof Uint8Array && verifyCidBytes(bytes, ask.cid) ? { bytes } : { bytes: null, refusal: "content-absent" };
  }


  private _wireWorkerListeners(
    wikiId: string, worker: VesselWorkerHandle, view: SessionDocumentView | null, standing: SurfaceStanding, surface: IslandKeyParts | null,
  ): void {
    // One settle waits per island at a time: a second ask while one waits answers false at once, so an island
    // cannot stack waiters on the owner by asking for heads that never arrive.
    worker.listen((raw: unknown) => {
      if (!isIslandToVesselMsg(raw)) return;
      // THE VIEW'S TWO ASKED GATES. A catalog name and a content address answer from the island's own view;
      // an island that stands under no view draws the refusal `view-absent`, never another island's answer.
      if (raw.type === "view:catalog") {
        const ask = raw as IslandMsg_ViewCatalog;
        if (typeof ask.requestId !== "string") return;
        const answer = view ? view.catalog(ask.name) : null;
        worker.post({
          schema_version: ISLAND_PROTOCOL_VERSION, type: "view:catalog-result", requestId: ask.requestId,
          documentUrl: answer?.ok ? answer.documentUrl : null,
          ...(answer?.ok ? {} : { refusal: answer ? answer.refusal : "view-absent" }),
        });
        return;
      }
      if (raw.type === "view:settle") {
        const ask = raw as IslandMsg_ViewSettle;
        if (typeof ask.requestId !== "string") return;
        const answer = (settled: boolean): void => {
          try { worker.post({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:settled", requestId: ask.requestId, settled }); }
          catch { /* the island went away: nothing to answer */ }
        };
        if (standing.settling) { answer(false); return; }
        // The owner keeps the outcome: an island that goes down unsettled ends with `settled: false`, whatever
        // it acks. An answer lands in the standing only within the epoch its ask began in.
        const epoch = standing.epoch;
        standing.settling = true;
        standing.settled = false;
        const land = (settled: boolean): void => {
          if (standing.epoch === epoch) { standing.settling = false; standing.settled = settled; }
          answer(settled);
        };
        void this._answerSettle(ask, view).then(land, () => land(false));
        return;
      }
      if (raw.type === "view:content") {
        const ask = raw as IslandMsg_ViewContent;
        if (typeof ask.requestId !== "string") return;
        void this._answerContent(ask, view).then((answer) => {
          try { worker.post({ schema_version: ISLAND_PROTOCOL_VERSION, type: "view:content-result", requestId: ask.requestId, ...answer }); }
          catch { /* the island went away: nothing to answer */ }
        });
        return;
      }
      if (raw.type === "event") {
        // A SESSION ISLAND'S EVENT TAKES ITS OWN DOOR. The wiki door's consumers place vessel verbs from an
        // event's payload; a session's island reaches no such consumer.
        if (surface) this._onSurfaceEvent?.(surface, raw as IslandMsg_Event);
        else if (this._onWorkerEvent) this._onWorkerEvent(wikiId, raw as IslandMsg_Event);
        return;
      }
      if (raw.type === "wiki:verb-result") {
        const result = raw as WikiMsg_VerbResult;
        const pending = this._pendingWikiVerbs.get(result.requestId);
        if (pending) {
          this._pendingWikiVerbs.delete(result.requestId);
          if (result.error) pending.reject(new Error(result.error));
          else              pending.resolve(result.result ?? {});
        }
        return;
      }
      if (raw.type === "fault") {
        console.error(`[vessel-pool] island fault for ${wikiId}: ${(raw as { error: string }).error}`);
      }
    });
    worker.onError((err) => {
      console.error(`[vessel-pool] island error for ${wikiId}:`, err);
    });
  }
}
