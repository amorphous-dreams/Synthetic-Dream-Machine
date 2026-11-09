/**
 * island-context — shared IslandContext and IslandBehavior types.
 *
 * These types hold identical structure on all platforms (Node worker_threads,
 * browser Web Workers, future WASM/UE5 runtimes). The sovereign island kernel
 * on each platform constructs and passes this context; behaviors depend only
 * on this contract, never on platform-specific APIs.
 *
 * Lives in @lararium/tw5 because TW5Engine is the only non-mesh import —
 * placing it here avoids a circular dependency while keeping it isomorphic.
 *
 * Island Sovereignty Law §9: no sovereign VM and no key on a surface. Every
 * sovereign TW5Engine lives inside a Worker. Behaviors therefore always receive
 * this context from within a Worker — never from a main-thread caller.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/island-context
 */

import type { DocHandle }                        from "@lararium/mesh";
import type { CompositeStore, IslandToVesselMsg, LarDoc, Repo, SecretHomeStore, SecretRestAnswer, WikiRecipe } from "@lararium/mesh";
import type { TW5Engine }                        from "./tw5-vm.js";
import type { ReceiptCapability }                        from "./receipt.js";

export interface IslandContext {
  wikiUri:   string;
  composite: CompositeStore;
  tw5:       TW5Engine;
  handles:   Map<string, DocHandle<LarDoc>>;
  post:      (msg: IslandToVesselMsg) => void;
  /** Request a best-effort drain; no persistence acknowledgement follows. */
  requestDrain?: () => void;
  /**
   * The island-side Automerge Repo. Island behaviors that mint docs (e.g. the
   * daemon island's personal/draft binding resolver) create them here; the docs
   * sync to the host relay via the manifest syncPort. Isomorphic-vessel Stage 1.
   */
  repo:      Repo;
  /**
   * The `catalog` registry doc URL (null if the island carries no catalog slot).
   * The isomorphic base for catalog-driven reach: a worker behavior builds
   * `makeCatalogAccessor(ctx.repo, ctx.catalogUrl)` to reach ANY registered bag
   * on demand — access≠load (the catalog is NOT a render layer). Carried in the
   * manifest's `grants.catalogUrl`; the kernel lifts it here.
   */
  catalogUrl: string | null;
  /** The lit face's own catalog laid over `catalogUrl` (`grants.faceCatalogUrl`); null at the floor. */
  faceCatalogUrl?: string | null;
  /** The face's kahua stage the manifest granted (`IslandGrants.kahuaUrl`); `bags/kahua` mounts from this alone. */
  kahuaUrl?: string | null;
  /** The face the kahua stage folds under (its group and its grant); null or absent, the stage reads empty. */
  kahuaFace?: () => import("@lararium/mesh").KahuaStageFace | null;
  /** Wakes the kahua layer's re-fold when the face's lineage moves under the running island (`liveKahuaFace`). */
  kahuaFaceWatch?: (fn: () => void) => () => void;
  /**
   * The oracle runtime system-island doc URL (= `grants.islandUrl`). The
   * **system** oracle plane: system bags (the oracle,
   * lararium and lares docs) + the system wiki-recipes resolve from here, the way
   * user bags resolve from the catalog registry. recipe-watch reads a system wiki's recipe
   * via `recipeUri("oracle", slug)` and resolves system bags from this doc.
   */
  oracleUrl: string | null;
  /**
   * The engine this island actually booted. `sha256` is its identity: the hash the
   * kernel computed over the core bytes it eval'd (never the blob entry's self-claim).
   * `version` is the blob entry's display label; nothing compares it. The engine-watch
   * reads the live `lararium` doc's core sha against `sha256` to see a different engine
   * waiting (alert-only; reboot adopts).
   */
  engine: { sha256: string; version: string };
  /**
   * The WikiRecipe this island mounted from (the manifest's slot structure).
   * The recipe-watch reads `wikiSlug` to find its own `catalog` recipe record
   * and reconcile composition changes live.
   */
  recipe: WikiRecipe;
  /**
   * Resolve immutable bytes by content-address (hex sha256) from the platform CAS —
   * the fs-less island's shore onto the process-shared byte plane. The kernel already
   * pulls engine/plugin bytes by CID at boot through the host callback of the same
   * name; this lifts it to behaviors so a residency handler (INGEST/LOAD) can resolve
   * a carrier body a verb rode BY REFERENCE, never inline. Absent on a memory-storage
   * island (no CAS dir). The resolver returns bytes only; the caller re-verifies
   * `cid == hash(bytes)` — content-addressed trust, never host trust.
   */
  resolveByCid?: (cid: string) => Promise<Uint8Array | null>;
  /** The island's half of the vessel's receipt capability: a save act's result and the coherence fold wait on it. Absent where no vessel issues one. */
  receipt?: ReceiptCapability;
  /**
   * True when this island mounted from a RESOLVED recipe (a session surface): every slot arrived with its
   * absolute id, the island reaches no catalog, and its composition never changes while it stands. A recipe
   * write reaches the next mount (session-contract#/the-effective-recipe), so no watch reconciles this one.
   */
  resolvedMount?: boolean;
  /**
   * Resolve a catalog name through the session's scoped document view: the document, or null when the view
   * refuses. Present only on a session island, which holds no catalog document of its own.
   */
  viewCatalog?: (name: string) => Promise<string | null>;
  /** The vessel's concrete disk mirror grants intersected with this recipe; absent for older/test contexts. */
  diskMirrors?: readonly { readonly bagId: string; readonly mirrorRoot: string; readonly scope: string; readonly mirrorClass?: "recovery" | "observe"; readonly titlePaths?: boolean; readonly tempLayer?: boolean }[];
  /** THE VESSEL'S SECRET HOME, on the daemon island alone (`islandSecretHome`): never composed into a recipe, a composite
   *  or a mirror. Absent on every wiki island and on a daemon whose vessel named no home. */
  secretStore?: SecretHomeStore;
  /** The vessel's rest answering whether it holds the secret home sealed; asked before each secret act. */
  secretRest?: SecretRestAnswer;
}

/**
 * Caller-supplied behavior module — the domain-specific half of the OTP
 * gen_island pair. The sovereign island kernel owns lifecycle plumbing;
 * behaviors own what distinguishes one island type from another.
 *
 * Under the one-recipe model, write routing happens via the in-wiki cascade
 * (`lar:///ha.ka.ba/lararium/config/bag-paths`) — daemon and wiki behaviors
 * share the same recipe shape; their differences live in `onEa` / `onSignal`.
 *
 * - `onEa`     — called after CompositeStore + IslandAdaptor wired, before ea.
 * - `onSignal` — called for every non-lifecycle message. Return true if handled.
 * - `onHooAnu` — called before drain loop stops.
 */
/**
 * THE WRITABLE OUTCOME. The `lararium-writable` startup marker settles by NAME: `standing` once the working route stands, `no-route` with
 * the reason where none can (a faceless daemon). The marker never hangs on a missing route; promoted modules run either way, and a write
 * made against `no-route` meets the refuse-by-name floor.
 */
export type WritableOutcome = { readonly state: "standing" } | { readonly state: "no-route"; readonly reason: string };

export interface IslandBehavior {
  /** Runs INSIDE the `lararium-writable` marker, after the recipe, bridge and resident seed and before any promoted module: stand the working route (authority, archive, working-only attachment, pointer landed). Absent: the route stands as the recipe left it. */
  onWritable?(ctx: IslandContext): Promise<WritableOutcome>;
  onEa(ctx: IslandContext): void | Promise<void>;
  onSignal(type: string, raw: unknown, ctx: IslandContext): boolean;
  onHooAnu(ctx: IslandContext): void | Promise<void>;
}
