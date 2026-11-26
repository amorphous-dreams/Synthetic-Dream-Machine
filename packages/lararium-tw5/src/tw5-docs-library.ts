/**
 * tw5-docs-library — THE TW5 DOCS LIBRARIES: TiddlyWiki5's own native docs, two vendored wiki folders read whole as bags — the
 * tw5.com edition (`tw5-docs`) and the dev edition (`tw5-dev`) — each one read-only wiki every face reads by its recipe slug,
 * through the doors that already read a named wiki (`tiddler get`, `wiki filter`, `wiki render`, `wiki status`). A seat unsure
 * how a filter operator, a widget or the engine's internals behave reads the upstream page itself.
 *
 *   · THE HEARTH STACKS THEM. THE CANON FLOOR BY PLACE (`@lararium/mesh/wiki-recipe` `CANON_FLOOR`) stacks both bags in the
 *     herm/hearth wiki alone, beneath every house layer: the canon of a foreign house, never written, and shadowed by every house
 *     record. Stacked there, the bag withholds the editions' own `$:/` configuration (`tw5LibraryStackStore`), so the docs never
 *     re-skin the hearth; read by its own slug, a library answers whole.
 *
 *   · ONE LAYER, A CODE FLOOR. The recipe names the wiki's canon alone (`bags/tw5-docs`), and that slot binds a read-only face
 *     over the packed edition (`floorReadFace`, the floor snapshot's own store): every put, tombstone and remove refuses.
 *   · LAZY. The pack (`tw5-docs.generated`, `scripts/build-tw5-docs.ts`) loads on the first read that names the library, and the
 *     engine composes then (the named-wiki engine pool closes it when cold). A face that never reads the docs pays nothing.
 *   · NO RESIDENCY. The records ride code: no writable bag holds them, no projection mirror renders them, no ingest wave
 *     carries them, and no genesis CAS member names them.
 *   · PUBLIC. The library carries no house record, so its bag answers every face's read without a cap ask (`isTw5DocsBag`).
 *   · NO WRITE. Every write door refuses the library by name, `tw5-docs-read-only`, by its slug or its bag, before any engine
 *     composes; every door that would stand another store under the name refuses `tw5-docs-reserved` (`tw5-docs-name`).
 *   · BOOT SHADOWS. The engine boots from the island's own boot set, so its shadow tiddlers (the core, the grammar, the stock
 *     theme) read there as they do in every face's engine, beneath the edition's records.
 *
 * Isomorphic: no process, no disk. A dynamic import on node, a split chunk in a browser bundle.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */
import { TW5_DOCS_SLUG, TW5_DEV_SLUG } from "@lararium/mesh/tw5-docs-name";
import { floorReadFace } from "@lararium/mesh/floor-manifest";
import { TW5_DEV_BAG, TW5_DOCS_BAG, type WikiRecipe } from "@lararium/mesh/wiki-recipe";
import { type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh/tiddler-store";

// The name and the two refusals rest in the mesh (`tw5-docs-name`), where the doors that stand a store read them too.
export {
  TW5_DEV_SLUG,
  TW5_DOCS_READ_ONLY,
  TW5_DOCS_RESERVED,
  TW5_DOCS_SLUG,
  namesTw5Docs,
  refuseTw5DocsReserved,
  refuseTw5DocsWrite,
} from "@lararium/mesh/tw5-docs-name";

export { TW5_DEV_BAG, TW5_DOCS_BAG };

/** The libraries' recipes: each names its canon alone, no instance slot named a write layer. */
export const TW5_DOCS_RECIPE: WikiRecipe = { wikiSlug: TW5_DOCS_SLUG };
export const TW5_DEV_RECIPE: WikiRecipe = { wikiSlug: TW5_DEV_SLUG };

/** True for either library's slug. */
export const isTw5Docs = (slug: string | null | undefined): boolean => slug === TW5_DOCS_SLUG || slug === TW5_DEV_SLUG;
/** True for either library's bag: a read on it asks no cap. */
export const isTw5DocsBag = (bag: string | null | undefined): boolean => bag === TW5_DOCS_BAG || bag === TW5_DEV_BAG;
/** True for a bag a recipe stacks as a TW5 docs library (the herm/hearth wiki's foreign floor). */
export const isTw5DocsLibraryBag = isTw5DocsBag;

/** A library's recipe, by its slug. */
export function tw5LibraryRecipe(slug: string): WikiRecipe {
  return slug === TW5_DEV_SLUG ? TW5_DEV_RECIPE : TW5_DOCS_RECIPE;
}

/** A library's bag, by its slug. */
export function tw5LibraryBag(slug: string): string {
  return slug === TW5_DEV_SLUG ? TW5_DEV_BAG : TW5_DOCS_BAG;
}

type Pack = Readonly<Record<string, LarTiddlerRecord>>;
const packed = new Map<string, Promise<Pack>>();

function rowsOf(json: string): Pack {
  const rows: Record<string, LarTiddlerRecord> = Object.create(null) as Record<string, LarTiddlerRecord>;
  for (const fields of JSON.parse(json) as Array<Record<string, string> & { title: string }>) rows[fields.title] = { tiddler: fields };
  return Object.freeze(rows);
}

/** A library's records by title, loaded once on the first ask: `bag` names the library (the tw5.com edition by default). */
export function tw5DocsRecords(bag: string = TW5_DOCS_BAG): Promise<Pack> {
  let pack = packed.get(bag);
  if (pack === undefined) {
    pack = import("./tw5-docs.generated.js")
      .then((generated) => rowsOf(bag === TW5_DEV_BAG ? generated.TW5_DEV_PACK : generated.TW5_DOCS_PACK))
      .catch((error: unknown) => { packed.delete(bag); throw error; });
    packed.set(bag, pack);
  }
  return pack;
}

/** A library's one layer, whole: a read-only face over the edition, presented as the library's bag. */
export async function tw5DocsStore(bag: string = TW5_DOCS_BAG): Promise<LarTiddlerStore> {
  return floorReadFace({ rows: [await tw5DocsRecords(bag)], bagId: bag });
}

/** A system title (`$:/…`): an edition's own configuration, which the stacked layer withholds. */
const SYSTEM_TITLE = (title: string): boolean => title.startsWith("$:/");

/**
 * A library as a STACKED layer of another wiki's recipe (the herm/hearth wiki's foreign floor): read-only, and withholding the
 * edition's `$:/` configuration (its default tiddlers, site title, palette and styles), so the docs read beneath the house and
 * never re-skin it.
 */
export async function tw5LibraryStackStore(bag: string): Promise<LarTiddlerStore> {
  const whole = await tw5DocsRecords(bag);
  const docs: Record<string, LarTiddlerRecord> = Object.create(null) as Record<string, LarTiddlerRecord>;
  for (const [title, record] of Object.entries(whole)) if (!SYSTEM_TITLE(title)) docs[title] = record;
  return floorReadFace({ rows: [Object.freeze(docs)], bagId: bag });
}
