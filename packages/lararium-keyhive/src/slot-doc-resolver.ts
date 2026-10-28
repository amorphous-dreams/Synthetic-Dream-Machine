/**
 * slot-doc-resolver — THE ONE resolver of a wiki's instance-slot docs (draft · working · personal).
 *
 * Every site that names one of these docs reads through here: the wiki island's slot grants
 * (`resolveBinding`), the host's wiki-slot mount (through the daemon proxy), `meme put --recipe`,
 * `prune-stale`, `wiki init`, and the daemon's own late-attached working layer. One slug on one
 * vessel resolves to ONE doc per slot from every call site.
 *
 * The law (`resolveSlotDoc`, @lararium/mesh): the PersonaGroup × recipe-fingerprint binding WHEN the
 * vessel holds a seated PersonaGroup cap, ELSE the device floor — and the record says which
 * (`face-reach`). It never refuses for want of a group.
 *
 *   draft    — face binding when seated; else the FLOOR doc keyed by the vessel DID in the catalog
 *              registry (`wikiDraftDocKey`: `wikis/{slug}/drafts/{did}`, `face-reach: vessel-only`).
 *   working  — seated, the face's DERIVED address (`resolveFaceWorkingSlot` under its address secret, by wiki slug and
 *              kind), materialized as the pinned blank genesis and registered through the face door: two vessels of
 *              one face find one document with no record between them. At the floor, a document keyed by the
 *              floor's own anchor in the catalog (`wikiWorkingFloorKey`, `face-reach: vessel-only`): a node's place
 *              (its W29 place KEL prefix), a browser leaf's private Nexus of one; the anon-veil lift carries it under
 *              the face's address at the join. A vessel that holds neither refuses `no-place`. No read mints a
 *              secret: a seated face whose secret stands nowhere refuses `no-address-secret` (it re-founds).
 *   personal — the PersonaGroup × fingerprint binding when seated, the vessel's own when not
 *
 * Lives in @lararium/keyhive because the mint sequence needs keyhive (`registerBag` + `delegate`).
 *
 * Canon: lar:///ha.ka.ba/lararium/api/personal-slot · lar:///ha.ka.ba/lares/docs/pono/recipe-layer-model
 */

import {
  DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX,
  computeRecipeFingerprint, emptyLarDoc, storedLarRecord, resolveSlotDoc, resolveFaceWorkingSlot, tiddlerText,
  wikiBagUri, wikiDraftDocKey, wikiWorkingFloorKey, requireLarDid,
  type CompositeStore, type WorkingFloorAnchor, type LarDoc, type SlotReach, type WikiSlotKind,
} from "@lararium/mesh";
import type { CatalogAccessor } from "@lararium/tw5";
import type { CapabilityProvider } from "./capability-provider.js";
import type { FaceBagDoor } from "./face-bag-door.js";
import { resolveOrMintBinding, type BindingKind, type DocMinter } from "./resolve-binding.js";
import { liftVesselOnlyIntoFace, type LiftRepo, type LiftResult } from "./anon-lift.js";

/** The Automerge-repo surface the resolver needs: mint (`create`) and the floor mint's readiness. */
export interface SlotDocRepo extends DocMinter {
  create<T = LarDoc>(initialValue: T): { readonly url: string; readonly documentId: string; whenReady?(): Promise<unknown> };
}

export interface SlotDocResolverArgs {
  readonly repo: SlotDocRepo;
  /** The daemon-bag composite — binding records live here. */
  readonly daemonStore: CompositeStore;
  /** Absent at the faceless floor: a floor document carries no Keyhive registration. */
  readonly keyhive?: CapabilityProvider;
  /** The user registry — floor docs and user wikis' canon urls. Null when the vessel holds no catalog grant. */
  readonly catalog: CatalogAccessor | null;
  /** The vessel DID, the one spelling (`didFromVerifyingKey`) — the floor key derives from it. */
  readonly vesselDid: () => string | Promise<string>;
  readonly mintedByHex: () => string;
  /** The labels the faceless floor gave its documents, so a lit face lifts them (`anon-lift`). */
  readonly floorMinter?: () => { readonly mintedByHex: string; readonly vesselDid: string };
  readonly personaGroupId?: string | undefined;
  /** Read the veil seat without taking a grant. */
  readonly faceSeated?: () => Promise<boolean>;
  readonly seatSettled?: () => Promise<void>;
  readonly faceDoor?: FaceBagDoor;
  /**
   * THE SEATED FACE'S ADDRESS SECRET, served from main-thread custody (a fresh copy per call; the resolver zero-fills
   * what it reads). Null or absent with a face seated refuses the working slot `no-address-secret`: no read mints one.
   */
  readonly faceAddressSecret?: () => Promise<Uint8Array | null>;
  /** The floor's own anchor, read from the vessel (`WorkingFloorAnchor`): the floor's working documents rest keyed by it. */
  readonly floorAnchor?: () => WorkingFloorAnchor | null | Promise<WorkingFloorAnchor | null>;
  /** Find or materialize the face's working document under its derived address, and rest it. */
  readonly faceWorkingDoc?: (url: string, label: string) => Promise<FaceWorkingHandle>;
}

/** The face's working document as the resolver and the lift touch it. */
export interface FaceWorkingHandle {
  readonly documentId: string;
  change(fn: (doc: LarDoc) => void): void;
}

/** A seated face's working slot cannot derive its address. */
export class WorkingSlotRefusal extends Error {
  override readonly name = "WorkingSlotRefusal";
  constructor(readonly reason: string, detail: string) { super(`working slot: ${reason}: ${detail}`); }
}

export interface SlotDoc {
  readonly url: string;
  readonly reach: SlotReach;
}

export interface SlotDocResolver {
  /** Every instance slot's doc for a wiki, by fingerprint — the mount's call. */
  bindings(fingerprint: string, recipeTrace: RecipeTrace, slug: string): Promise<{ personalUrl: string; draftUrl: string; workingUrl: string }>;
  /** One slot's doc by slug. `mint:false` reads what stands and returns null when nothing does. */
  slotDoc(slug: string, kind: WikiSlotKind, opts?: { mint?: boolean }): Promise<SlotDoc | null>;
  /** The ONE draft resolver: `slotDoc(slug, "draft")`, minting on absent — never null. */
  draft(slug: string): Promise<SlotDoc>;
  /** The anon-veil lift (`anon-lift`): everything this vessel minted at the floor moves under the seated face. Idempotent. */
  liftFloor(): Promise<LiftResult>;
}

type RecipeTrace = { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] };

const PREFIX_OF: Record<"draft" | "personal", { prefix: string; kind: BindingKind }> = {
  draft:    { prefix: DRAFT_BINDINGS_PREFIX,    kind: "draft-binding" },
  personal: { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
};

export function makeSlotDocResolver(args: SlotDocResolverArgs): SlotDocResolver {
  const seated = async (): Promise<boolean> =>
    args.personaGroupId ? await (args.faceSeated?.() ?? Promise.resolve(true)) : false;

  /**
   * THE MOUNT'S TRACE IS THE TRACE. A wiki the vessel has mounted this session fingerprinted the canon
   * doc it actually holds (`bindings`, the mount's call); every later site — a verb, a `where`, an
   * action — reuses that trace, never re-deriving it from a registry pointer that can move under a
   * running session (a shared oracle plane a peer's founding rewrites). A wiki never mounted this
   * session derives its trace from the vessel catalog, where every bag pointer rides.
   */
  const mounted = new Map<string, { fingerprint: string; recipeTrace: RecipeTrace }>();

  const wikiUrlOf = async (slug: string): Promise<string> => {
    const key = wikiBagUri(slug);
    const url = (await args.catalog?.urlOf(key).catch(() => null)) ?? null;
    if (!url) throw new Error(`slot-doc: wiki "${slug}" registers no canon doc in any registry plane — run \`lares wiki init ${slug}\` first`);
    return url;
  };

  const bindingKey = (kind: "draft" | "personal", fingerprint: string): string => `${PREFIX_OF[kind].prefix}/${fingerprint}`;

  /** The PersonaGroup × fingerprint binding (mint-on-absent) — vessel-key when unseated. */
  const binding = async (kind: "draft" | "personal", fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> => {
    const r = await resolveOrMintBinding({
      kind: PREFIX_OF[kind].kind, prefix: PREFIX_OF[kind].prefix, fingerprint, recipeTrace,
      repo: args.repo, daemonStore: args.daemonStore, ...(args.keyhive ? { keyhive: args.keyhive } : {}),
      ...(args.personaGroupId ? { personaGroupId: args.personaGroupId } : {}),
      ...(args.faceDoor ? { faceDoor: args.faceDoor } : {}),
      ...(args.faceSeated ? { faceSeated: args.faceSeated } : {}),
      ...(args.seatSettled ? { seatSettled: args.seatSettled } : {}),
      mintedByHex: args.mintedByHex(),
    });
    const rec = await args.daemonStore.get(bindingKey(kind, fingerprint));
    const reach = rec?.tiddler["face-reach"] === "face" ? "face" : "vessel-only";
    return { url: r.url, reach };
  };

  /** The draft FLOOR doc — keyed by the vessel DID in the catalog registry; minted on absent. */
  const floor = async (slug: string, mint: boolean): Promise<string | null> => {
    const catalog = args.catalog;
    if (!catalog) throw new Error(`slot-doc: the draft floor for "${slug}" needs the catalog registry, and this vessel holds no catalog grant`);
    const key = wikiDraftDocKey(slug, requireLarDid(await args.vesselDid(), "slot-doc floor"));
    const existing = await catalog.urlOf(key);
    if (existing || !mint) return existing;
    const handle = args.repo.create<LarDoc>(emptyLarDoc());
    await handle.whenReady?.();
    await args.repo.flush([handle.documentId]);
    const catalogHandle = await catalog.handle();
    catalogHandle.change((doc) => {
      doc.tiddlers[key] = storedLarRecord(key, {
        text: handle.url,
        kind: "oracle",
        "face-reach": "vessel-only",
        "minted-by": args.mintedByHex(),
      }, "slot-doc:floor");
    });
    return handle.url;
  };

  /** The face's derived working address for `slug`; refuses where the seated face's secret stands nowhere. */
  const faceWorkingUrl = async (slug: string): Promise<string> => {
    const secret = args.faceAddressSecret;
    if (!secret) throw new WorkingSlotRefusal("no-address-secret", "this vessel serves no address secret for the seated face");
    const r = await resolveFaceWorkingSlot({ wikiId: slug, kind: "working", secret });
    if (!r.ok) {
      throw new WorkingSlotRefusal(r.refusal.reason, r.refusal.reason === "no-address-secret"
        ? "the seated face holds no address secret here: a face founded before the secret minted at its founding re-founds"
        : r.refusal.message);
    }
    return r.url;
  };
  /** The face's documents this resolver registered, so one process registers each once. */
  const registered = new Set<string>();
  const faceWorking = async (slug: string, mint: boolean): Promise<SlotDoc> => {
    const url = await faceWorkingUrl(slug);
    if (mint) {
      if (!args.faceWorkingDoc) throw new WorkingSlotRefusal("no-working-door", "this resolver cannot materialize a derived document");
      const handle = await args.faceWorkingDoc(url, slug);
      await args.repo.flush([handle.documentId]);
      if (args.faceDoor && !registered.has(url)) { await args.faceDoor.mint(url, "admin"); registered.add(url); }
    }
    return { url, reach: "face" };
  };
  /** The working FLOOR doc: keyed by the floor's own anchor in the catalog registry; minted on absent. */
  const workingFloor = async (slug: string, mint: boolean): Promise<string | null> => {
    const catalog = args.catalog;
    if (!catalog) throw new Error(`slot-doc: the working floor for "${slug}" needs the catalog registry, and this vessel holds no catalog grant`);
    const anchor = await args.floorAnchor?.();
    if (!anchor) throw new WorkingSlotRefusal("no-place", `the working floor for "${slug}" rests by the floor's own anchor, and this vessel holds neither a place KEL nor a private Nexus key`);
    const key = wikiWorkingFloorKey(slug, anchor);
    const existing = await catalog.urlOf(key);
    if (existing || !mint) return existing;
    const handle = args.repo.create<LarDoc>(emptyLarDoc());
    await handle.whenReady?.();
    await args.repo.flush([handle.documentId]);
    const catalogHandle = await catalog.handle();
    catalogHandle.change((doc) => {
      doc.tiddlers[key] = storedLarRecord(key, {
        text: handle.url,
        kind: "oracle",
        "face-reach": "vessel-only",
        "minted-by": args.mintedByHex(),
      }, "slot-doc:working-floor");
    });
    return handle.url;
  };
  const workingDoc = async (slug: string, mint: boolean): Promise<SlotDoc | null> => {
    if (await seated()) return faceWorking(slug, mint);
    const url = await workingFloor(slug, mint);
    return url ? { url, reach: "vessel-only" } : null;
  };

  const draftDoc = async (slug: string, fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> =>
    resolveSlotDoc({
      seated,
      faceDoc:  async () => (await binding("draft", fingerprint, recipeTrace)).url,
      floorDoc: async () => (await floor(slug, true))!,
    });

  const traceOf = async (slug: string): Promise<{ fingerprint: string; recipeTrace: RecipeTrace }> => {
    const known = mounted.get(slug);
    if (known) return known;
    const recipeTrace = { wikiDocId: await wikiUrlOf(slug), libraryBagDocIds: [] as readonly string[] };
    return { fingerprint: await computeRecipeFingerprint(recipeTrace), recipeTrace };
  };

  const slotDoc = async (slug: string, kind: WikiSlotKind, opts?: { mint?: boolean }): Promise<SlotDoc | null> => {
    await args.seatSettled?.();
    if (kind === "temp") return null;
    const mint = opts?.mint ?? true;
    // The working kind derives from the face and the wiki's slug, never from the recipe's trace.
    if (kind === "working") return workingDoc(slug, mint);
    const { fingerprint, recipeTrace } = await traceOf(slug);
    if (kind === "draft") {
      if (mint) return draftDoc(slug, fingerprint, recipeTrace);
      if (await seated()) {
        const url = tiddlerText(await args.daemonStore.get(bindingKey("draft", fingerprint)));
        return url ? { url, reach: "face" } : null;
      }
      const url = await floor(slug, false);
      return url ? { url, reach: "vessel-only" } : null;
    }
    if (mint) return binding(kind, fingerprint, recipeTrace);
    const rec = await args.daemonStore.get(bindingKey(kind, fingerprint));
    const url = tiddlerText(rec);
    return url ? { url, reach: rec?.tiddler["face-reach"] === "face" ? "face" : "vessel-only" } : null;
  };

  return {
    bindings: async (fingerprint, recipeTrace, slug) => {
      await args.seatSettled?.();
      mounted.set(slug, { fingerprint, recipeTrace });
      const personal = await binding("personal", fingerprint, recipeTrace);
      const draft    = await draftDoc(slug, fingerprint, recipeTrace);
      const working  = (await workingDoc(slug, true))!;
      return { personalUrl: personal.url, draftUrl: draft.url, workingUrl: working.url };
    },
    slotDoc,
    draft: async (slug) => (await slotDoc(slug, "draft"))!,
    liftFloor: async () => {
      if (!args.faceDoor || !args.personaGroupId || !(await seated())) return { moved: [], finished: [] };   // no seat, nothing to lift into
      const repo = args.repo as unknown as Partial<LiftRepo>;
      if (typeof repo.find !== "function" || typeof repo.delete !== "function") throw new Error("slot-doc: the lift needs a repo that finds and deletes documents");
      // THE SECRET STANDS FIRST: the face's address secret must stand before the lift's first step, or the lift refuses by
      // name and changes nothing (no draft moves ahead of a working floor that cannot derive its address).
      const secret = (await args.faceAddressSecret?.()) ?? null;
      if (!secret) throw new WorkingSlotRefusal("no-address-secret", "the seated face holds no address secret here, so the lift changes nothing");
      secret.fill(0);
      return liftVesselOnlyIntoFace({
        repo: args.repo as unknown as LiftRepo, daemonStore: args.daemonStore, catalog: args.catalog, faceDoor: args.faceDoor,
        mintedByHex: args.mintedByHex(), vesselDid: String(await args.vesselDid()),
        ...(args.floorMinter ? { floor: args.floorMinter() } : {}),
        // THE WORKING FLOOR LIFTS TO THE FACE'S DERIVED ADDRESS: by the floor's own anchor, into the document the face's
        // secret names for each wiki.
        working: {
          anchor: (await args.floorAnchor?.()) ?? null,
          urlOf: faceWorkingUrl,
          ...(args.faceWorkingDoc ? { open: args.faceWorkingDoc } : {}),
        },
        traceOf: async (slug) => {
          const url = await args.catalog?.urlOf(wikiBagUri(slug)).catch(() => null);
          if (!url) return null;
          const recipeTrace = { wikiDocId: url, libraryBagDocIds: [] as readonly string[] };
          return { fingerprint: await computeRecipeFingerprint(recipeTrace), recipeTrace };
        },
      });
    },
  };
}
