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
 *   working  — the binding minted on the vessel's own key, delegated to the face when seated
 *   personal — the same as working (its own layer, per operator ruling)
 *
 * Lives in @lararium/keyhive because the mint sequence needs keyhive (`registerBag` + `delegate`).
 *
 * Canon: lar:///ha.ka.ba/lararium/api/personal-slot · lar:///ha.ka.ba/lares/docs/pono/recipe-layer-model
 */

import {
  DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, WORKING_BINDINGS_PREFIX,
  computeRecipeFingerprint, emptyLarDoc, mutableLarRecord, resolveSlotDoc, tiddlerText,
  SYSTEM_BAGS, wikiBagUri, wikiDraftDocKey, requireLarDid,
  type CompositeStore, type LarDoc, type LarTiddlerRecord, type SlotReach, type WikiSlotKind,
} from "@lararium/mesh";
import type { CatalogAccessor } from "@lararium/tw5";
import type { CapabilityProvider } from "./capability-provider.js";
import { resolveOrMintBinding, type BindingKind, type DocMinter } from "./resolve-binding.js";

/** The Automerge-repo surface the resolver needs: mint (`create`) and the floor mint's readiness. */
export interface SlotDocRepo extends DocMinter {
  create<T = LarDoc>(initialValue: T): { readonly url: string; whenReady(): Promise<unknown> };
}

export interface SlotDocResolverArgs {
  readonly repo: SlotDocRepo;
  /** The daemon-bag composite — binding records live here. */
  readonly daemonStore: CompositeStore;
  readonly keyhive: CapabilityProvider;
  /** The user registry — floor docs and user wikis' canon urls. Null when the vessel holds no catalog grant. */
  readonly catalog: CatalogAccessor | null;
  /** The oracle system plane — system wikis' canon urls (lares, lararium). */
  readonly oracle: CatalogAccessor | null;
  /** The vessel DID, the one spelling (`didFromVerifyingKey`) — the floor key derives from it. */
  readonly vesselDid: () => string | Promise<string>;
  readonly mintedByHex: () => string;
  readonly personaGroupAgentIdHex?: string | undefined;
  readonly faceSeated?: () => Promise<boolean>;
  readonly delegateToFace?: (bagUrl: string, access: "read" | "admin") => Promise<void>;
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
}

type RecipeTrace = { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] };

const PREFIX_OF: Record<Exclude<WikiSlotKind, "temp">, { prefix: string; kind: BindingKind }> = {
  draft:    { prefix: DRAFT_BINDINGS_PREFIX,    kind: "draft-binding" },
  working:  { prefix: WORKING_BINDINGS_PREFIX,  kind: "working-binding" },
  personal: { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
};

export function makeSlotDocResolver(args: SlotDocResolverArgs): SlotDocResolver {
  const seated = async (): Promise<boolean> =>
    args.personaGroupAgentIdHex ? await (args.faceSeated?.() ?? Promise.resolve(true)) : false;

  /**
   * THE MOUNT'S TRACE IS THE TRACE. A wiki the vessel has mounted this session fingerprinted the canon
   * doc it actually holds (`bindings`, the mount's call); every later site — a verb, a `where`, an
   * action — reuses that trace, never re-deriving it from a registry pointer that can move under a
   * running session (a shared oracle plane a peer's founding rewrites). A wiki never mounted this
   * session derives its trace from the plane its pointer rides — a SYSTEM bag's (lares, lararium)
   * from the oracle plane's well-known tiddlers, a user wiki's from the catalog registry.
   */
  const mounted = new Map<string, { fingerprint: string; recipeTrace: RecipeTrace }>();

  const wikiUrlOf = async (slug: string): Promise<string> => {
    const key = wikiBagUri(slug);
    const plane = SYSTEM_BAGS.has(key) ? args.oracle : args.catalog;
    const url = (await plane?.urlOf(key).catch(() => null)) ?? null;
    if (!url) throw new Error(`slot-doc: wiki "${slug}" registers no canon doc in any registry plane — run \`lares wiki init ${slug}\` first`);
    return url;
  };

  const bindingKey = (kind: Exclude<WikiSlotKind, "temp">, fingerprint: string): string => `${PREFIX_OF[kind].prefix}/${fingerprint}`;

  /** The PersonaGroup × fingerprint binding (mint-on-absent) — vessel-key when unseated. */
  const binding = async (kind: Exclude<WikiSlotKind, "temp">, fingerprint: string, recipeTrace: RecipeTrace): Promise<SlotDoc> => {
    const r = await resolveOrMintBinding({
      kind: PREFIX_OF[kind].kind, prefix: PREFIX_OF[kind].prefix, fingerprint, recipeTrace,
      repo: args.repo, daemonStore: args.daemonStore, keyhive: args.keyhive,
      ...(args.personaGroupAgentIdHex ? { personaGroupAgentIdHex: args.personaGroupAgentIdHex } : {}),
      ...(args.delegateToFace ? { delegateToFace: args.delegateToFace } : {}),
      ...(args.faceSeated ? { faceSeated: args.faceSeated } : {}),
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
    await handle.whenReady();
    const catalogHandle = await catalog.handle();
    catalogHandle.change((doc) => {
      (doc.tiddlers as Record<string, LarTiddlerRecord>)[key] = mutableLarRecord(key, {
        text: handle.url,
        kind: "oracle",
        "face-reach": "vessel-only",
        "minted-on": new Date().toISOString(),
        "minted-by": args.mintedByHex(),
      }, "slot-doc:floor");
    });
    return handle.url;
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
    if (kind === "temp") return null;
    const mint = opts?.mint ?? true;
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
      mounted.set(slug, { fingerprint, recipeTrace });
      const personal = await binding("personal", fingerprint, recipeTrace);
      const draft    = await draftDoc(slug, fingerprint, recipeTrace);
      const working  = await binding("working", fingerprint, recipeTrace);
      return { personalUrl: personal.url, draftUrl: draft.url, workingUrl: working.url };
    },
    slotDoc,
    draft: async (slug) => (await slotDoc(slug, "draft"))!,
  };
}
