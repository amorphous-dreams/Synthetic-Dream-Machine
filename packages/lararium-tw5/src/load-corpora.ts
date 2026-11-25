/**
 * load-corpora — the shared catalog-corpus loader, ONE body for both vessels (the node↔browser YIN
 * collapse the saga missed; node + browser carried ~40 byte-identical lines apart from a provenance
 * string + the local-mint factory).
 *
 * Each catalog `corpus:` entry becomes one read-only top-level bag. An entry DECLARING a mesh scale
 * federates via the tideline resolver (`resolveBootDoc` — StillJoining skips its layer, reconciling
 * later, never a blank ghost); an undeclared entry mints local. The per-vessel pieces collapse to a
 * single injected `mintLocalHandle` (node = waitHandle + blankMemeStore; browser = waitHandle
 * + repo.create) plus the provenance `source`. Adopts the browser twin's terser shape.
 *
 * Home = tw5 (it owns `addReadOnlyLayer` and imports the mesh helpers; mesh cannot import tw5).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/load-corpora
 */

import { addReadOnlyLayer } from "./vessel-steps.js";
import { CATALOG_CORPUS_PREFIX, parseMeshScale, corpusLarUri, catalogCorpusEntryUri, type MeshScale } from "@lararium/mesh/lar-uris";
import { resolveBootDoc, isStillJoining } from "@lararium/mesh/boot-resolver";
import { corpusBagId, type CompositeStore } from "@lararium/mesh/composite-store";
import { storedLarRecord } from "@lararium/mesh/stored-record";
import { tiddlerText, type LarDoc } from "@lararium/mesh/base-doc";
import { type Repo, type DocHandle, type AutomergeUrl } from "@lararium/mesh/automerge";
import { ownEntry } from "@lararium/mesh/stored-value";
import { sealedUnopened } from "@lararium/mesh/automerge-doc-store";
import { plainField } from "@lararium/mesh/stored-value";

export interface CorpusLoaderDeps {
  readonly repo: Repo;
  readonly catalogHandle: DocHandle<LarDoc>;
  /** Per-vessel local mint: each vessel's `waitHandle` bound to its blank-doc factory. */
  /** The corpus's own bag rides with its URL: the mint names the document for that bag before any byte moves. */
  readonly mintLocalHandle: (docUrl: string, bagId: string) => Promise<DocHandle<LarDoc>>;
  /** Provenance stamped on the corpus + registry records (`"lararium-seed"` / `"browser-boot"`). */
  readonly source: string;
}

/** Load every catalog `corpus:` entry as a read-only layer on the composite. */
export async function loadCatalogCorpora(deps: CorpusLoaderDeps, composite: CompositeStore): Promise<void> {
  const { repo, catalogHandle, mintLocalHandle, source } = deps;

  const entries = Object.entries(catalogHandle.doc()?.tiddlers ?? {})
    .filter(([uri]) => uri.startsWith(CATALOG_CORPUS_PREFIX))
    .map(([uri, t]) => ({
      id:    uri.slice(CATALOG_CORPUS_PREFIX.length),
      docUrl: tiddlerText(t),
      // a corpus entry MAY declare its federation scale (the residency-bag layer); absent → local.
      scale: parseMeshScale(plainField(t, "scale") as string | undefined),
    }))
    .filter((e): e is { id: string; docUrl: string; scale: MeshScale | undefined } => Boolean(e.docUrl));

  await Promise.all(entries.map(async (entry) => {
    let h: DocHandle<LarDoc>;
    if (entry.scale) {
      // declared mesh scale → tideline resolver; StillJoining skips (no blank), reconciles later.
      const resolved = await resolveBootDoc<LarDoc>(repo, entry.docUrl as AutomergeUrl, {
        tideline: "mesh-shared", scale: entry.scale, label: `@${entry.id} (joined corpus)`,
      });
      if (isStillJoining(resolved)) return;
      h = resolved;
    } else {
      h = await mintLocalHandle(entry.docUrl, corpusBagId(entry.id));
    }
    addReadOnlyLayer(composite, corpusBagId(entry.id), h);

    const cu = corpusLarUri(entry.id);
    const stamp = (): void => {
      if (tiddlerText(ownEntry(h.doc()?.tiddlers, cu)) !== h.url) {
        h.change((doc) => { doc.tiddlers[cu] = storedLarRecord(cu, { text: h.url }, source); });
      }
    };
    // A SEALED CORPUS HELD READ-ONLY over its own id (`waitHandle`) takes its stamp once its keyed load opens it, never before.
    if (sealedUnopened(h) === undefined) stamp();
    else void h.whenReady().then(stamp, () => { /* the load never opened: no stamp, nothing written */ });
    const ru = catalogCorpusEntryUri(entry.id);
    if (tiddlerText(ownEntry(catalogHandle.doc()?.tiddlers, ru)) !== entry.docUrl) {
      catalogHandle.change((doc) => { doc.tiddlers[ru] = storedLarRecord(ru, { text: entry.docUrl }, source); });
    }
  }));
}
