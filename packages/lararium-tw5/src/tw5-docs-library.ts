/**
 * tw5-docs-library — THE TW5 DOCS LIBRARY: the vendored tw5.com edition as one read-only wiki every face reads, by the recipe
 * slug `tw5-docs`, through the doors that already read a named wiki (`tiddler get`, `wiki filter`, `wiki render`,
 * `wiki status`). A seat unsure how a filter operator or a widget behaves reads the upstream page itself.
 *
 *   · ONE LAYER, A CODE FLOOR. The recipe names the wiki's canon alone (`bags/tw5-docs`), and that slot binds a read-only face
 *     over the packed edition (`floorReadFace`, the floor snapshot's own store): every put, tombstone and remove refuses.
 *   · LAZY. The pack (`tw5-docs.generated`, `scripts/build-tw5-docs.ts`) loads on the first read that names the library, and the
 *     engine composes then (the named-wiki engine pool closes it when cold). A face that never reads the docs pays nothing.
 *   · NO RESIDENCY. The records ride code: no writable bag holds them, no projection mirror renders them, no ingest wave
 *     carries them, and no genesis CAS member names them.
 *   · PUBLIC. The library carries no house record, so its bag answers every face's read without a cap ask (`isTw5DocsBag`).
 *   · NO WRITE. Every write door refuses the slug by name, `tw5-docs-read-only`, before any engine composes.
 *
 * Isomorphic: no process, no disk. A dynamic import on node, a split chunk in a browser bundle.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout
 */
import { VerbRefusal, floorReadFace, wikiBagUri, type LarTiddlerRecord, type LarTiddlerStore, type WikiRecipe } from "@lararium/mesh";

/** The library's recipe slug: `--recipe tw5-docs`. */
export const TW5_DOCS_SLUG = "tw5-docs";
/** The library's one layer: the wiki's canon slot, which the packed edition fills. */
export const TW5_DOCS_BAG: string = wikiBagUri(TW5_DOCS_SLUG);
/** The refusal every write door gives the library. */
export const TW5_DOCS_READ_ONLY = "tw5-docs-read-only";

/** The library's recipe: its canon alone, no instance slot named a write layer. */
export const TW5_DOCS_RECIPE: WikiRecipe = { wikiSlug: TW5_DOCS_SLUG };

/** True for the library's slug. */
export const isTw5Docs = (slug: string | null | undefined): boolean => slug === TW5_DOCS_SLUG;
/** True for the library's bag: a read on it asks no cap. */
export const isTw5DocsBag = (bag: string | null | undefined): boolean => bag === TW5_DOCS_BAG;

/** Refuse a write that names the library, by name. */
export function refuseTw5DocsWrite(slug: string | null | undefined, verb: string): void {
  if (isTw5Docs(slug)) throw new VerbRefusal(TW5_DOCS_READ_ONLY, `${TW5_DOCS_READ_ONLY}: ${verb} — the TW5 docs library (\`--recipe tw5-docs\`, the vendored tw5.com edition) reads and never takes a write`);
}

let packed: Promise<Readonly<Record<string, LarTiddlerRecord>>> | null = null;

/** The edition's records by title, loaded once on the first ask. */
export function tw5DocsRecords(): Promise<Readonly<Record<string, LarTiddlerRecord>>> {
  packed ??= import("./tw5-docs.generated.js").then(({ TW5_DOCS_PACK }) => {
    const rows: Record<string, LarTiddlerRecord> = Object.create(null) as Record<string, LarTiddlerRecord>;
    for (const fields of JSON.parse(TW5_DOCS_PACK) as Array<Record<string, string> & { title: string }>) rows[fields.title] = { tiddler: fields };
    return Object.freeze(rows);
  }).catch((error: unknown) => { packed = null; throw error; });
  return packed;
}

/** The library's one layer: a read-only face over the edition, presented as the library's bag. */
export async function tw5DocsStore(): Promise<LarTiddlerStore> {
  return floorReadFace({ rows: [await tw5DocsRecords()], bagId: TW5_DOCS_BAG });
}
