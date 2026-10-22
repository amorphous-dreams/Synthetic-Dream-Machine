/**
 * catalog-row — the vessel's own `@catalog` row resolving a document, in one place.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/base-doc
 */

import type { DocHandle } from "@automerge/automerge-repo";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { storedLarRecord } from "./stored-record.js";

/**
 * resolveCatalogRow — the catalog-row resolution protocol, in one place.
 *
 * A catalog row (a tiddler of the vessel's own `@catalog`) holds the `automerge:` URL of a satellite doc (wiki,
 * draft, …) in its `text` field. Every vessel runs the same three-step protocol
 * for each satellite:
 *   1. read the row's URL — null when the satellite has never been minted,
 *   2. hand the URL (or null) to the vessel's `resolve` strategy, which opens
 *      the existing doc or mints a blank one,
 *   3. write the row back into the catalog on first mint only.
 *
 * Divergence stays in the two arguments, never the protocol: `resolve` carries
 * the platform's repo strategy (node races whenReady; browser uses
 * `findWithProgress` — `allowableStates` reads `@deprecated … no longer has any effect`), and
 * `provenance` carries the authority stamp. The
 * read → resolve → write-back-on-mint shape lives here once; both vessel
 * factories compose it for their wiki and draft satellites.
 */
export async function resolveCatalogRow(
  catalogHandle: DocHandle<LarDoc>,
  rowKey:     string,
  resolve:       (rowUrl: string | null) => Promise<DocHandle<LarDoc>> | DocHandle<LarDoc>,
  provenance:    string,
): Promise<DocHandle<LarDoc>> {
  const rowUrl = tiddlerText(catalogHandle.doc()?.tiddlers?.[rowKey]) ?? null;
  const handle    = await resolve(rowUrl);
  if (!rowUrl) {
    catalogHandle.change((doc) => {
      doc.tiddlers[rowKey] = storedLarRecord(rowKey, { text: handle.url }, provenance);
    });
  }
  return handle;
}
