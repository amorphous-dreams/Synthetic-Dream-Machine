/**
 * face-engine — EACH HAT REACHED BY NAME: a lit sibling face's OWN TiddlyWiki engine on the daemon island. The tiddler door
 * (`tiddler-verbs`) answers through a live `$tw.wiki` over one composition; the mount's engine composes the worn face's daemon
 * wiki alone, so a sibling face reached by name stands its own engine over the anchor composition of ITS OWN documents (its
 * daemon canon by its relation, and the working, draft and personal slots its own wear named), laid by the one recipe model
 * (`buildIslandRecipe`) with the one adaptor and bridge every island runs. The engine boots from the bytes the island's own
 * engine booted from, so the sibling reads through the same grammar and module gate.
 *
 * One engine per face: `faceEngines` composes a face's engine on its first ask and answers the same one after, until the face
 * drops (`drop`) and the engine closes: its adaptor drains every owed save, the bridge detaches and the VM releases. A face
 * with no source (shut, or outside the lit set) composes nothing.
 *
 * THE ONE POOL (`enginePool`) holds engines by any key: a face by its handle index here, a named wiki by its slug in
 * `wiki-engine`. A pool given `idleMs` closes an engine no ask touched for that long (cold), and the next ask composes afresh.
 *
 * A LIT FACE RECEIVES VISITS (`cross-face-reach`, operator ruling 2026-11-20): a seat wearing another face reads this face
 * through a CROSS-FACE VIEW (`composeCrossFaceView`), never through this face's own engine, which carries its personal layer.
 * The view lays the layers `crossFaceViewSlots` names (working, canon, libraries, floor) and asks for no other
 * (`crossFaceViewSource`); it refuses a source that binds a PRIVATE layer before any engine boots, and lays every layer
 * read-only, so a visit takes no write.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import {
  CompositeStore, VerbRefusal, wikiSlotUri, crossFacePrivateRefusal, crossFaceViewSlots, CROSS_FACE_PRIVATE,
  type FaceActorDoor, type WikiRecipe,
} from "@lararium/mesh";
import { buildIslandRecipe, seedDrained, type RecipeReadyBinding } from "./island-recipe.js";
import { bridgeWikiToAdaptor } from "./outbound-bridge.js";
import type { TW5Engine } from "./tw5-vm.js";

/** What one face's engine composes from. */
export interface FaceEngineSource {
  /** A fresh engine, booted from the island's own boot set. */
  readonly boot: () => Promise<TW5Engine>;
  /** The face's daemon wiki recipe: the island's own, its canon following this face's relation. */
  readonly recipe: WikiRecipe;
  /** The face's own documents by slot (and any shared library the recipe names); a slot absent here stays unmounted. */
  readonly ready: readonly RecipeReadyBinding[];
  /** The island Repo's actor door: a write this engine lands under a session's face takes that face's actor. */
  readonly wear?: FaceActorDoor;
  /** The face holds no writer's seat in the wiki's workbench: its `personal` slot takes the default write. */
  readonly writeSlot?: "personal";
  /** Every layer but the engine's own temp lays read-only (a cross-face view). */
  readonly readOnly?: true;
}

/** One face's engine and the composition it answers over: the tiddler door's options for that face. */
export interface FaceEngine {
  readonly tw5: TW5Engine;
  readonly composite: CompositeStore;
  /** Drain the engine's owed saves, detach its bridge and release the VM. */
  close(): Promise<void>;
}

/** Compose one face's engine: boot, lay the recipe over its own documents, bridge the wiki, and wait for the seed to land. */
export async function composeFaceEngine(source: FaceEngineSource): Promise<FaceEngine> {
  const tw5 = await source.boot();
  const composite = new CompositeStore();
  const { adaptor } = buildIslandRecipe({
    tw5, composite, recipe: source.recipe, ready: source.ready,
    ...(source.wear ? { wear: source.wear } : {}),
    ...(source.writeSlot ? { writeSlot: source.writeSlot } : {}),
    ...(source.readOnly ? { readOnly: true as const } : {}),
  });
  const unbridge = bridgeWikiToAdaptor(tw5, adaptor);
  let closed: Promise<void> | null = null;
  const close = (): Promise<void> => (closed ??= (async () => {
    try { await adaptor.stop(); } finally { unbridge(); tw5.dispose(); }
  })());
  try { await seedDrained(tw5); }
  catch (error) { await close().catch(() => {}); throw error; }
  return { tw5, composite, close };
}

/** What a cross-face view composes from: the face engine's source, with no actor door, no write slot and no write. */
export type CrossFaceViewSource = Pick<FaceEngineSource, "boot" | "recipe" | "ready">;

/**
 * The target face's cross-face view source for `recipe`: each layer `crossFaceViewSlots` names, as `bind` resolves it for that
 * face (null where the face holds none). `bind` never hears a private slot, a draft, the temp layer, the kahua stage or the
 * vessel's own daemon document.
 */
export async function crossFaceViewSource(deps: {
  readonly boot: () => Promise<TW5Engine>;
  readonly recipe: WikiRecipe;
  readonly bind: (slot: string) => Promise<RecipeReadyBinding | null>;
}): Promise<CrossFaceViewSource> {
  const ready: RecipeReadyBinding[] = [];
  for (const slot of crossFaceViewSlots(deps.recipe)) {
    const bound = await deps.bind(slot);
    if (bound !== null) ready.push(bound);
  }
  return { boot: deps.boot, recipe: deps.recipe, ready };
}

/** What a view checks each binding's DOCUMENT against: every document a lit face's private slot names. */
export interface CrossFaceViewGuard {
  readonly privateDocs: ReadonlySet<string>;
  /** What the deny set could not read (a source absent, a private record naming no document): the view refuses while any stands. */
  readonly unread?: readonly string[];
}

/** The document a binding resolves to: its handle's id, or the id its store stands on; null where none names it. */
function documentIdOf(binding: RecipeReadyBinding): string | null {
  const id = "handle" in binding ? binding.handle.documentId : (binding.store as { documentId?: unknown }).documentId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * Compose a target face's CROSS-FACE VIEW. PRIVATE FIRST, by label and by DOCUMENT: a binding whose slot names a private layer,
 * or whose document a lit face's private slot names (`guard.privateDocs`), refuses `cross-face-private`, and one whose document
 * no id names refuses `cross-face-view-unidentified`, all before anything boots; a binding outside the view's own slots refuses
 * `cross-face-view-holds-its-layers`. The engine then lays every layer read-only, with no actor door and no write slot.
 * IT FAILS CLOSED: a deny set that could not read whole (`guard.unread`) refuses `cross-face-private-unread` before any binding
 * is weighed, since it cannot vouch that a binding stands outside every private layer.
 */
export async function composeCrossFaceView(source: CrossFaceViewSource, guard: CrossFaceViewGuard): Promise<FaceEngine> {
  if (guard.unread !== undefined && guard.unread.length > 0) {
    throw new VerbRefusal("cross-face-private-unread", `cross-face-private-unread: the private layers' documents could not be read whole (${guard.unread.join("; ")}), so no cross-face view composes`);
  }
  for (const binding of source.ready) {
    const refusal = crossFacePrivateRefusal(binding.slot);
    if (refusal !== null) throw new VerbRefusal(CROSS_FACE_PRIVATE, refusal);
    const doc = documentIdOf(binding);
    if (doc === null) throw new VerbRefusal("cross-face-view-unidentified", `cross-face-view-unidentified: ${binding.slot} binds a store no document id names, so a view cannot check it against the private layers, and nothing composed`);
    if (guard.privateDocs.has(doc)) throw new VerbRefusal(CROSS_FACE_PRIVATE, `${CROSS_FACE_PRIVATE}: ${binding.slot} binds a document a face's personal or draft layer names, and no cross-face view composes it`);
  }
  const viewed = new Set<string>(crossFaceViewSlots(source.recipe));
  for (const { slot } of source.ready) {
    if (!viewed.has(slot)) throw new VerbRefusal("cross-face-view-holds-its-layers", `cross-face-view-holds-its-layers: ${slot} lies outside a cross-face view (working, canon, libraries and the floor), and nothing composed`);
  }
  return composeFaceEngine({ boot: source.boot, recipe: source.recipe, ready: source.ready, readOnly: true });
}

/** Engines by key, each composed on its first ask. */
export interface EnginePool<K, E> {
  /** The key's engine, or null where the key has no source. */
  of(key: K): Promise<E | null>;
  /** Close and forget the key's engine. */
  drop(key: K): Promise<void>;
  /** Close every engine. */
  dropAll(): Promise<void>;
}

/**
 * THE ONE POOL: one engine per key, composed on its first ask and answered after until it drops. With `idleMs`, an engine no
 * ask touched for that long closes (owed saves drain first), and the next ask composes afresh. A key with no source, or a
 * composition that failed, leaves no entry: the next ask reads afresh.
 */
export function enginePool<K, E extends { close(): Promise<void> }>(
  compose: (key: K) => Promise<E | null>, opts: { readonly idleMs?: number } = {},
): EnginePool<K, E> {
  const engines = new Map<K, Promise<E | null>>();
  const timers = new Map<K, ReturnType<typeof setTimeout>>();
  const quiet = (key: K): void => { const timer = timers.get(key); if (timer !== undefined) clearTimeout(timer); timers.delete(key); };
  const drop = async (key: K): Promise<void> => {
    quiet(key);
    const pending = engines.get(key);
    engines.delete(key);
    const engine = await pending?.catch(() => null);
    await engine?.close();
  };
  /** Each ask re-arms the cold clock; it never holds the process open. */
  const touch = (key: K, composing: Promise<E | null>): void => {
    if (opts.idleMs === undefined) return;
    quiet(key);
    const timer = setTimeout(() => {
      timers.delete(key);
      if (engines.get(key) === composing) void drop(key).catch(() => {});
    }, opts.idleMs);
    (timer as { unref?: () => void }).unref?.();
    timers.set(key, timer);
  };
  return {
    of: (key) => {
      const standing = engines.get(key);
      if (standing) { touch(key, standing); return standing; }
      const composing = compose(key);
      engines.set(key, composing);
      composing.then((engine) => {
        if (engines.get(key) !== composing) return;
        if (engine === null) engines.delete(key); else touch(key, composing);
      }, () => { if (engines.get(key) === composing) engines.delete(key); });
      return composing;
    },
    drop,
    dropAll: async () => { await Promise.all([...engines.keys()].map(drop)); },
  };
}

/** One engine per face, composed on its first ask. */
export type FaceEngines = EnginePool<number, FaceEngine>;

/** Whether a source binds the face's working slot: the layer a write lands in. */
const bindsWorking = (source: FaceEngineSource): boolean =>
  source.ready.some((binding) => binding.slot === wikiSlotUri(source.recipe.wikiSlug, "working"));

/**
 * One engine per face, composed on its first ask. An engine composed before its face recorded a working slot holds no write
 * layer, so each ask re-reads the source while that stands and rebuilds on the slot's arrival, never at the face's drop.
 */
export function faceEngines(
  sourceOf: (face: number) => Promise<FaceEngineSource | null>,
  /** THE REBUILD SAID ALOUD: whoever reads a face's engine (its projection) lets go of the engine it stood on before that engine closes
   *  (`rebuilding`, awaited), and takes the new one once it composed (`rebuilt`). */
  hooks: { readonly rebuilding?: (face: number) => Promise<void>; readonly rebuilt?: (face: number) => void } = {},
): FaceEngines {
  const unslotted = new Set<number>();
  const pool = enginePool<number, FaceEngine>(async (face) => {
    const source = await sourceOf(face);
    if (source === null) { unslotted.delete(face); return null; }
    if (bindsWorking(source)) unslotted.delete(face); else unslotted.add(face);
    return composeFaceEngine(source);
  });
  return {
    of: async (face) => {
      if (unslotted.has(face)) {
        const fresh = await sourceOf(face);
        if (fresh !== null && bindsWorking(fresh) && unslotted.has(face)) {
          unslotted.delete(face);
          await hooks.rebuilding?.(face).catch(() => {});
          await pool.drop(face);
          const rebuilt = pool.of(face);
          void rebuilt.then((engine) => { if (engine !== null) hooks.rebuilt?.(face); }, () => {});
          return rebuilt;
        }
      }
      return pool.of(face);
    },
    drop: (face) => { unslotted.delete(face); return pool.drop(face); },
    dropAll: () => { unslotted.clear(); return pool.dropAll(); },
  };
}
