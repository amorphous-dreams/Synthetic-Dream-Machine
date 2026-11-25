/**
 * canon-rows — the live house-canon documents this vessel reaches, read by bag: the one binding the release cut (`./floor-cut.ts`),
 * the offer's retire and the floor drift (`./floor.ts`) share, so each weighs the same canon.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/offering#/the-canon-offer
 */
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo";
import { AutomergeDocStore } from "@lararium/mesh/automerge-doc-store";
import { bagUri } from "@lararium/mesh/lar-uris";
import { realmStandingDocUrl } from "@lararium/mesh/realm-bag";
import { type LarDoc } from "@lararium/mesh/base-doc";
import { type LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import { type OfferRecordReader } from "@lararium/mesh/canon-offer";

/**
 * The live house-canon document a bag names on this vessel: the Kahu realm's bag row in the vessel's own catalog. `catalogUrl`
 * names that catalog as the store door holds it (`StoreDoorDeps.catalogUrl`: the standing vessel's own catalog handle, or the
 * pointer file beside a store a direct act opened, `readCatalogPointer`). Null where the store names no catalog or no row stands
 * for the bag. A read; it asks nothing.
 */
export async function nodeCanonDocUrl(repo: Repo, catalogUrl: string | null | undefined): Promise<(bag: string) => string | null> {
  const catalog = catalogUrl ? (await repo.find<LarDoc>(catalogUrl as AutomergeUrl)).doc() : null;
  return (bag) => (catalog ? realmStandingDocUrl(catalog, bag) : null);
}

/** One canon bag's live store on this vessel, or null where no document stands for it. */
export async function nodeCanonStore(repo: Repo, docUrlOf: (bag: string) => string | null, bag: string): Promise<(OfferRecordReader & { listVisible(): Promise<string[]> }) | null> {
  const url = docUrlOf(bag);
  return url ? new AutomergeDocStore(await repo.find<LarDoc>(url as AutomergeUrl), bag) : null;
}

/** One house-canon slug's live rows on this vessel, every visible title, or null where no document stands for its bag. */
export async function nodeCanonRows(repo: Repo, docUrlOf: (bag: string) => string | null, slug: string): Promise<Record<string, LarTiddlerRecord> | null> {
  const store = await nodeCanonStore(repo, docUrlOf, bagUri(slug));
  if (!store) return null;
  const rows: Record<string, LarTiddlerRecord> = {};
  for (const title of await store.listVisible()) { const r = await store.get(title); if (r) rows[title] = r; }
  return rows;
}
