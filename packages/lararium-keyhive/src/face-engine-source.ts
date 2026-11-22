/**
 * face-engine-source — what a LIT sibling face's own engine composes from on the daemon island (`face-engine`, EACH HAT
 * REACHED BY NAME): the island's daemon recipe with its canon following THIS face's relation; this face's own documents off
 * the control document (`makeLitFaceDocs`: its daemon canon, and the working, draft and personal slots its own wear named,
 * each owned by this face, nothing minted); the shared library bags and the oracle the island already holds; and a fresh
 * engine booted from the very bytes the island's engine booted from (`IslandContext.bootSet`, each re-hashed against its CID).
 *
 * The worn face's kahua stage and the place's daemon document stay out: the first folds under the worn face, the second holds
 * the vessel's own state, and neither belongs to the sibling's own wiki.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import {
  DAEMON_BAG_ID, KAHUA_BAG, daemonFaceCanonBag, expandRecipe, sha256HexBytesSync, wikiSlotUri,
  type DocHandle, type FaceActorDoor, type LarDoc, type WikiRecipe,
} from "@lararium/mesh";
import { TW5Engine, modulePinsOf, preloadsFromCasBlob, type FaceEngineSource, type RecipeReadyBinding } from "@lararium/tw5";
import type { LitFace, LitFaceDocs } from "./lit-face-target.js";

export interface SiblingEngineDeps {
  /** The lit sibling the engine answers for. */
  readonly face: LitFace;
  /** The lit set's own documents off the control document. */
  readonly docs: LitFaceDocs;
  /** The island's daemon wiki recipe. */
  readonly recipe: WikiRecipe;
  /** A shared document the island already holds by slot (a library bag, the oracle), or null. */
  readonly shared: (slot: string) => DocHandle<LarDoc> | null;
  /** Open a document by url, for `bag`. */
  readonly open: (url: string, bag: string) => Promise<DocHandle<LarDoc>>;
  /** The boot set the island's engine stood up from, and the CAS that answers it. */
  readonly bootSet: { readonly engineCid: string; readonly pluginCids: readonly string[] } | undefined;
  readonly resolveByCid: ((cid: string) => Promise<Uint8Array | null>) | undefined;
  /** The island Repo's actor door. */
  readonly wear?: FaceActorDoor;
}

const KINDS = ["working", "draft", "personal"] as const;

/** Boot a fresh engine from the island's own boot set, every blob re-hashed against the CID that names it. */
export function bootFromSet(bootSet: SiblingEngineDeps["bootSet"], resolveByCid: SiblingEngineDeps["resolveByCid"]): () => Promise<TW5Engine> {
  return async () => {
    if (!bootSet || !resolveByCid) throw new Error("face-engine-unbootable: this island holds no boot set and CAS to boot a face's own engine from");
    const blob = async (cid: string, what: string): Promise<Uint8Array> => {
      const bytes = await resolveByCid(cid);
      if (!bytes) throw new Error(`face-engine-unbootable: the CAS answers no ${what} ${cid.slice(0, 12)}…`);
      if (sha256HexBytesSync(bytes) !== cid) throw new Error(`face-engine-unbootable: the ${what} ${cid.slice(0, 12)}… read other bytes than its CID names`);
      return bytes;
    };
    const core = await blob(bootSet.engineCid, "engine core");
    const preloads: Record<string, unknown>[] = [];
    for (const cid of bootSet.pluginCids) preloads.push(...preloadsFromCasBlob(await blob(cid, "plugin blob")));
    const engine = new TW5Engine();
    // Each blob re-hashed against its CID above: the core boots on that pin and every module the blobs pack on theirs.
    await engine.boot({ bytes: core, sha256: bootSet.engineCid }, preloads, undefined, { grantedDigests: new Set(bootSet.pluginCids), modulePins: modulePinsOf(preloads) });
    return engine;
  };
}

/** The sibling's engine source: its recipe, its own documents and the shared ones, and the boot. */
export async function composeSiblingEngineSource(deps: SiblingEngineDeps): Promise<FaceEngineSource> {
  const { face } = deps;
  const { canonBag: _mounted, ...base } = deps.recipe;
  const canon = face.relation !== null ? daemonFaceCanonBag(face.relation) : null;
  const recipe: WikiRecipe = canon !== null ? { ...base, canonBag: canon } : base;
  const slug = recipe.wikiSlug;
  const own = [...KINDS.map((kind) => wikiSlotUri(slug, kind)), ...(canon !== null ? [canon] : [])];
  const ready: RecipeReadyBinding[] = [];
  for (const slot of own) {
    const doc = await deps.docs(face.handleIndex, slot);
    if (doc !== null && doc.owner === face.handleIndex) ready.push({ slot: slot as RecipeReadyBinding["slot"], handle: await deps.open(doc.url, slot) });
  }
  const stays = new Set<string>([...own, wikiSlotUri(slug, "temp"), KAHUA_BAG, DAEMON_BAG_ID]);
  for (const slot of expandRecipe(recipe)) {
    if (stays.has(slot)) continue;
    const handle = deps.shared(slot);
    if (handle) ready.push({ slot, handle });
  }
  return { boot: bootFromSet(deps.bootSet, deps.resolveByCid), recipe, ready, ...(deps.wear ? { wear: deps.wear } : {}) };
}
