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
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { CompositeStore, wikiSlotUri, type FaceActorDoor, type WikiRecipe } from "@lararium/mesh";
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
export function faceEngines(sourceOf: (face: number) => Promise<FaceEngineSource | null>): FaceEngines {
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
        if (fresh !== null && bindsWorking(fresh)) await pool.drop(face);
      }
      return pool.of(face);
    },
    drop: (face) => { unslotted.delete(face); return pool.drop(face); },
    dropAll: () => { unslotted.clear(); return pool.dropAll(); },
  };
}
