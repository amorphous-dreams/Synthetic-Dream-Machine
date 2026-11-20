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
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-lit-set
 */
import { CompositeStore, type FaceActorDoor, type WikiRecipe } from "@lararium/mesh";
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

/** One engine per face, composed on its first ask. */
export interface FaceEngines {
  /** The face's engine, or null where the face has no source (shut, or outside the lit set). */
  of(face: number): Promise<FaceEngine | null>;
  /** Close and forget the face's engine (the face dropped). */
  drop(face: number): Promise<void>;
  /** Close every engine. */
  dropAll(): Promise<void>;
}

export function faceEngines(sourceOf: (face: number) => Promise<FaceEngineSource | null>): FaceEngines {
  const engines = new Map<number, Promise<FaceEngine | null>>();
  const drop = async (face: number): Promise<void> => {
    const pending = engines.get(face);
    engines.delete(face);
    const engine = await pending?.catch(() => null);
    await engine?.close();
  };
  return {
    of: (face) => {
      const standing = engines.get(face);
      if (standing) return standing;
      const composing = (async () => {
        const source = await sourceOf(face);
        return source ? composeFaceEngine(source) : null;
      })();
      engines.set(face, composing);
      // A face with no source, or a composition that failed, leaves no entry: the next ask reads afresh.
      composing.then((engine) => { if (engine === null && engines.get(face) === composing) engines.delete(face); },
        () => { if (engines.get(face) === composing) engines.delete(face); });
      return composing;
    },
    drop,
    dropAll: async () => { await Promise.all([...engines.keys()].map(drop)); },
  };
}
