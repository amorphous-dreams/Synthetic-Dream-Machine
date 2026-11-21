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
 * A LIT FACE RECEIVES VISITS (`composeCrossFaceViewSource`): a face's CROSS-FACE VIEW lays its daemon canon and working layer
 * and the shared libraries and floor (`crossFaceViewSlots`), and asks for no other: never its personal layer (PRIVATE), never a
 * draft. The worn face's own layers answer from the documents its island mounted; a sibling's from the documents its own wear
 * named, each only where the control document names that face as the owner. The view takes no actor door: it reads.
 * `crossFacePrivateDocs` names every document a private slot names on this island, which the view refuses by identity, so a
 * binding's label never carries a private document past it.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import {
  CONTROL_HOME_ID, DAEMON_BAG_ID, KAHUA_BAG, PRIVATE_SLOT_KINDS, daemonFaceCanonBag, documentIdOfUrl, expandRecipe, sha256HexBytesSync,
  tiddlerText, wikiSlotUri, type DocHandle, type FaceActorDoor, type LarDoc, type LarTiddlerStore, type WikiRecipe, type WikiSlotKind,
} from "@lararium/mesh";
import { TW5Engine, crossFaceViewSource, preloadsFromCasBlob, type CrossFaceViewSource, type FaceEngineSource, type RecipeReadyBinding } from "@lararium/tw5";
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
    await engine.boot(core, preloads, undefined, { grantedDigests: new Set(bootSet.pluginCids) });
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

/** What a face's cross-face view composes from: the sibling engine's doors, and the worn face's own mounted documents. */
export interface CrossFaceViewDeps extends Omit<SiblingEngineDeps, "wear"> {
  /** The worn face's own document for a slot its island mounted (its working layer, its daemon canon), or null. Asked only
   *  where the face visited is the worn face. */
  readonly worn: ((slot: string) => DocHandle<LarDoc> | null) | null;
}

/** A face's cross-face view source over its daemon wiki: its canon by its own relation, its working layer, and the shared slots. */
export async function composeCrossFaceViewSource(deps: CrossFaceViewDeps): Promise<CrossFaceViewSource> {
  const { face } = deps;
  const { canonBag: _mounted, ...base } = deps.recipe;
  const canon = face.relation !== null ? daemonFaceCanonBag(face.relation) : null;
  const recipe: WikiRecipe = canon !== null ? { ...base, canonBag: canon } : base;
  const own = new Set<string>([wikiSlotUri(recipe.wikiSlug, "working"), ...(canon !== null ? [canon] : [])]);
  return crossFaceViewSource({
    boot: bootFromSet(deps.bootSet, deps.resolveByCid),
    recipe,
    bind: async (slot) => {
      if (!own.has(slot)) { const handle = deps.shared(slot); return handle ? { slot, handle } : null; }
      const mounted = deps.worn?.(slot) ?? null;
      if (mounted) return { slot, handle: mounted };
      const doc = await deps.docs(face.handleIndex, slot);
      return doc !== null && doc.owner === face.handleIndex ? { slot, handle: await deps.open(doc.url, slot) } : null;
    },
  });
}

/** Where the documents a private slot names rest on this island. */
export interface CrossFacePrivateDocsDeps {
  /** Every lit face: the worn one and each sibling. */
  readonly faces: readonly LitFace[];
  /** The worn face's own document for a daemon slot its island mounted, or null. */
  readonly mounted: (slot: string) => Pick<DocHandle<LarDoc>, "documentId"> | null;
  /** The control document's reader (each face's daemon slots, `daemon-slot/<kind>/<group>`), or null. */
  readonly control: { get(title: string): Promise<unknown> } | null;
  /** The daemon document's store (each wiki's slot bindings), or null. */
  readonly daemon: Pick<LarTiddlerStore, "listVisible" | "get"> | null;
}

/**
 * THE DOCUMENTS A VISIT NEVER COMPOSES: every document a PRIVATE slot names here. Each lit face's daemon personal and draft
 * documents (the worn face's as its island mounted them, every face's as the control document names them), and each personal or
 * draft binding the daemon document records for any wiki (`kind`, or a mint row's `binding-kind`). A url that names no document
 * adds nothing.
 */
export async function crossFacePrivateDocs(deps: CrossFacePrivateDocsDeps): Promise<Set<string>> {
  const docs = new Set<string>();
  const add = (id: string | null | undefined): void => { if (typeof id === "string" && id.length > 0) docs.add(id); };
  const kinds = [...PRIVATE_SLOT_KINDS];
  for (const kind of kinds) add(deps.mounted(wikiSlotUri("daemon", kind))?.documentId);
  if (deps.control) {
    for (const face of deps.faces) {
      for (const kind of kinds) add(documentIdOfUrl(tiddlerText((await deps.control.get(`${CONTROL_HOME_ID}/daemon-slot/${kind}/${encodeURIComponent(face.group)}`)) as never)));
    }
  }
  if (deps.daemon) {
    for (const title of await deps.daemon.listVisible()) {
      const fields = (await deps.daemon.get(title))?.tiddler as Record<string, unknown> | undefined;
      const kind = fields?.["kind"] === "binding-mint" ? fields["binding-kind"] : fields?.["kind"];
      if (typeof kind === "string" && PRIVATE_SLOT_KINDS.has(kind as WikiSlotKind)) add(documentIdOfUrl(typeof fields?.["text"] === "string" ? fields["text"] : null));
    }
  }
  return docs;
}
