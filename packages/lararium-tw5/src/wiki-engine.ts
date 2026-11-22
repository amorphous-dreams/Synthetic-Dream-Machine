/**
 * wiki-engine — EVERY WIKI ITS ENGINE: a registered wiki the worn face reaches (one it hosts, or one shared to it) answers the
 * tiddler door (`tiddler-verbs`) through its OWN TiddlyWiki engine, never the daemon wiki's. The engine is the one per-face
 * engine machinery (`face-engine`: `composeFaceEngine` over the one recipe model, adaptor and bridge, held in the one pool),
 * laid over that wiki's own recipe AS THE FACE SEES IT:
 *
 *   · the wiki's recipe record (`recipeOf`: the vessel's own composition first, the oracle's system default after);
 *   · its instance slots through THE ONE slot-doc resolver (`slotStore`): the shared working layer, and the face's own
 *     personal and draft layers, each where it stands (a read mints nothing);
 *   · its canon and libraries by reference (`held`, a document the island already holds; else `reach`, the realm plane and
 *     the registry planes; else the bag's floor snapshot, `floorCanon`), each a store this composition alone replays;
 *   · the face's write layer (`writeSlot`): `working` where it holds a writer's seat in the wiki's workbench, `personal`
 *     where it holds none, none where no layer takes a write.
 *
 * The TW5 docs library (`tw5-docs`) composes apart from every recipe: its one layer, the packed tw5.com edition read-only, for
 * every face, on its first ask (`tw5-docs-library`).
 *
 * A wiki no recipe names, or one none of whose layers stands for the face, composes nothing: the door refuses
 * `wiki-unreached` by name. A WRITE mints the face's write layer where none stood (the meme door's own mint) and recomposes,
 * so a read never mints. The engine boots from the bytes the island's own engine booted from (`boot`), so it reads through the
 * same grammar and module gate, and the daemon wiki's code wards stand unchanged (its seed pass stays gated; a named wiki's
 * landed StartupActions ride inert, `island-recipe`).
 *
 * Isomorphic: no process, no disk. The vessel hands the doors in; the pool closes a cold engine.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */
import {
  DAEMON_BAG_ID, DAEMON_WIKI_SLUG, KAHUA_BAG, ORACLE_BAG, expandRecipe, recipeFromRecord, wikiCanonOf, wikiSlotKindOf,
  type DocHandle, type FaceActorDoor, type LarDoc, type LarTiddlerRecord, type LarTiddlerStore, type WikiSlotKind,
} from "@lararium/mesh";
import { composeFaceEngine, enginePool, type FaceEngine, type FaceEngineSource } from "./face-engine.js";
import type { RecipeReadyBinding } from "./island-recipe.js";
import type { TW5Engine } from "./tw5-vm.js";
import { TW5_DOCS_BAG, TW5_DOCS_RECIPE, isTw5Docs, tw5DocsStore } from "./tw5-docs-library.js";

/** The doors a named wiki's engine composes through: the meme door's own reaches, the island's held documents, and the boot. */
export interface WikiEngineDeps {
  /** A wiki's recipe record by slug, or null when no plane holds one. */
  readonly recipeOf: (slug: string) => Promise<LarTiddlerRecord | null>;
  /** A wiki's instance slot as a store over the doc THE ONE slot-doc resolver names; `mint` mints on absent. */
  readonly slotStore: (slug: string, kind: WikiSlotKind, bag: string, opts: { mint: boolean }) => Promise<LarTiddlerStore | null>;
  /** The layer this face's saves of the wiki land in: `working`, `personal`, or null where none takes a write. */
  readonly writeSlot?: (slug: string) => Promise<"working" | "personal" | null>;
  /** A document the island already holds by slot (the oracle, a library it mounts), or null. */
  readonly held?: (slot: string) => DocHandle<LarDoc> | null;
  /** A registered bag's own store, presented as `bag` (the realm plane first, then the registry planes). */
  readonly reach?: (key: string, bag: string) => Promise<LarTiddlerStore | null>;
  /** A house canon bag's floor snapshot, where the floor this island mounted carries one. */
  readonly floorCanon?: (bag: string) => LarTiddlerStore | null;
  /** A fresh engine, booted from the island's own boot set. */
  readonly boot: () => Promise<TW5Engine>;
  /** The island Repo's actor door. */
  readonly wear?: FaceActorDoor;
}

/** A named wiki's engine source: the face engine's source, and the bag a read gates on where no write layer stands. */
export interface WikiEngineSource extends FaceEngineSource {
  /** The wiki's canon bag: the door's read gate where the face holds no write layer of the wiki. */
  readonly gate: string;
}

/** A named wiki's engine: the face engine, its read gate, and the layer a write lands in (null: none stands yet). */
export interface WikiEngine extends FaceEngine {
  readonly gate: string;
  readonly writeLayer: string | null;
}

const INSTANCE: ReadonlySet<WikiSlotKind> = new Set(["draft", "working", "personal"]);
/** The config tiddler the recipe seeds with the bag a `lar:` save lands in (`island-recipe`). */
const CURRENT_WIKI_BAG = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";

/**
 * Compose a named wiki's engine source as the face sees it, or null where no recipe names the wiki or none of its layers
 * stands for the face. `mint` mints the face's write layer first (a write asked for it).
 */
export async function composeWikiEngineSource(deps: WikiEngineDeps, slug: string, need: { readonly mint: boolean }): Promise<WikiEngineSource | null> {
  if (slug === DAEMON_WIKI_SLUG) return null;
  // THE TW5 DOCS LIBRARY: every face reaches it, on its one read-only layer, and no write layer ever stands (`tw5-docs-library`).
  if (isTw5Docs(slug)) return { boot: deps.boot, recipe: TW5_DOCS_RECIPE, ready: [{ slot: TW5_DOCS_BAG, store: await tw5DocsStore() }], gate: TW5_DOCS_BAG };
  const record = await deps.recipeOf(slug);
  if (record === null) return null;
  const recipe = recipeFromRecord(record, slug);
  const write = (await deps.writeSlot?.(slug)) ?? null;
  const ready: RecipeReadyBinding[] = [];
  let reached = 0;
  for (const slot of expandRecipe(recipe)) {
    const kind = wikiSlotKindOf(slug, slot);
    if (kind === "temp" || slot === KAHUA_BAG || slot === DAEMON_BAG_ID) continue;
    if (kind !== null && INSTANCE.has(kind)) {
      const store = await deps.slotStore(slug, kind, slot, { mint: need.mint && kind === write });
      if (store) { ready.push({ slot, store }); reached++; }
      continue;
    }
    const handle = deps.held?.(slot) ?? null;
    if (handle) { ready.push({ slot, handle }); if (slot !== ORACLE_BAG) reached++; continue; }
    const store = (await deps.reach?.(slot, slot).catch(() => null)) ?? deps.floorCanon?.(slot) ?? null;
    if (store) { ready.push({ slot, store }); if (slot !== ORACLE_BAG) reached++; }
  }
  if (reached === 0) return null;
  return {
    boot: deps.boot, recipe, ready, gate: wikiCanonOf(recipe),
    ...(write === "personal" ? { writeSlot: "personal" as const } : {}),
    ...(deps.wear ? { wear: deps.wear } : {}),
  };
}

/** Compose a named wiki's engine from its source. */
export async function composeWikiEngine(source: WikiEngineSource): Promise<WikiEngine> {
  const engine = await composeFaceEngine(source);
  const wiki = engine.tw5.$tw.wiki as { getTiddlerText?: (title: string, fallback?: string) => string };
  const writeLayer = wiki.getTiddlerText?.(CURRENT_WIKI_BAG, "") || null;
  return { ...engine, gate: source.gate, writeLayer };
}

/** One engine per named wiki, under the island's worn face. */
export interface WikiEngines {
  /** The wiki's engine, or null where the face reaches no such wiki. `write` mints the face's write layer first where none stands. */
  of(slug: string, need: { readonly write: boolean }): Promise<WikiEngine | null>;
  /** Close and forget the wiki's engine. */
  drop(slug: string): Promise<void>;
  /** Close every engine. */
  dropAll(): Promise<void>;
}

/** The engines of every named wiki the face reaches, each composed on its first ask and closed when cold (`idleMs`). */
export function wikiEngines(
  sourceOf: (slug: string, need: { readonly mint: boolean }) => Promise<WikiEngineSource | null>, opts: { readonly idleMs?: number } = {},
): WikiEngines {
  const minting = new Set<string>();
  const pool = enginePool<string, WikiEngine>(async (slug) => {
    const source = await sourceOf(slug, { mint: minting.has(slug) });
    return source ? composeWikiEngine(source) : null;
  }, opts);
  return {
    of: async (slug, need) => {
      const engine = await pool.of(slug);
      if (!need.write || engine === null || engine.writeLayer !== null) return engine;
      // A WRITE WHERE NO WRITE LAYER STANDS: mint the face's own layer of the wiki, then recompose over it.
      await pool.drop(slug);
      minting.add(slug);
      try { return await pool.of(slug); } finally { minting.delete(slug); }
    },
    drop: (slug) => pool.drop(slug),
    dropAll: () => pool.dropAll(),
  };
}
