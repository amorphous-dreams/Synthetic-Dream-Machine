/**
 * corpus-sources — typed registry of all corpus bag targets in this monorepo.
 *
 * Each entry describes one Automerge doc target (bag). The loader uses
 * these paths at hydration time to discover and import carrier files.
 * Heleuma: lar:///ha.ka.ba/api/v0.1/lararium/schema/corpus-sources
 */

export interface CorpusSource {
  /** pnpm workspace package name */
  name: string;
  /** path relative to monorepo root */
  path: string;
  /** Automerge bag name — matches LarTiddlerRecord["bag"] */
  bag: string;
  /** quine-corpus: this corpus defines the infrastructure the machinery reads */
  quine?: true;
}

export const CORPUS_SOURCES: CorpusSource[] = [
  { name: "@lararium/lares",         path: "lares",   bag: "lares",   quine: true },
  { name: "@lararium/corpus-elyncia", path: "elyncia", bag: "elyncia" },
  { name: "@lararium/corpus-ftls",    path: "ftls",    bag: "ftls" },
  { name: "@lararium/corpus-sdm",     path: "sdm",     bag: "sdm" },
  { name: "@lararium/corpus-wtf",     path: "wtf",     bag: "wtf" },
];

/** The quine-corpus — infrastructure definitions read by the machinery itself. */
export const LARES_CORPUS = CORPUS_SOURCES.find((c) => c.quine)!;
