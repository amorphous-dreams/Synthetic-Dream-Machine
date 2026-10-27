/*\
title: lar:///ha.ka.ba/lararium/tw5/lib/wiki-sense-fold
type: application/javascript
module-type: library
\*/
/**
 * wiki-sense-fold — the ONE pure corpus fold every wiki-sense mouth rides. Its PONO HOME sits
 * INSIDE the TW5 VM: this file ships as a `module-type: library` plugin tiddler, and the in-VM
 * WikiSenseIndexer + `wikisense` filter operator require it by URI —
 *
 *   require("lar:///ha.ka.ba/lararium/tw5/lib/wiki-sense-fold")
 *
 * (Vite externalizes the relative import in every other module build, so the fold travels ONCE in
 * the plugin.) VM-less islands (composite-store workers with no TW5 boot) import the same source
 * host-side through wiki-sensorium-cap — one math, wherever a wiki lives.
 *
 * THE SENSED ENTITY (operator law): a tiddler carries the nameless-entity-with-#has-caps pattern —
 * an OPEN field record with NO set schema. The `title` serves ONLY as the pet-name/index key;
 * `text` rides as one field among many; unknown fields flow through untouched (has-stack clause 4:
 * no fixed enum of blessed caps). The current plane lenses read title+text; the fold hands the
 * whole record through so field-aware lenses (tags, plugin-type, has-stack edges) compose later
 * WITHOUT a shore change.
 *
 * THE HULL RUNS PLATFORM-BLIND and store-blind: no node builtins, no store imports — the fold
 * takes docs, never a store.
 *
 * Meme: lar:///ha.ka.ba/lares/api/wiki-sensorium-cap
 */

// mesh SUBPATH imports (the grammar-cache precedent) — the root index drags automerge/wasm, which
// the VM library bundle must never carry; these organ modules stand self-contained and pure.
import type { ComparisonStalk, PlaneRestriction, ConsistencyRadius } from "@lararium/mesh/sensorium-consistency";
import { consistencyRadius, jaccardDistance } from "@lararium/mesh/sensorium-consistency";
import { cohomologyObstruction } from "@lararium/mesh/sensorium-fusion";
import type { TW5Wiki, TW5Tiddler } from "./types/tiddlywiki.js";
import { collectEvents } from "./meme-ast/index.js";
import { stratify } from "./memetic-wikitext-sensorium.js";

// ── the sensed entity — the WHOLE open record crosses the shore ──────────────────────────────────────

/** One sensed entity — the whole tiddler, an open field record. Title keys; it never schemas. */
export interface WikiSenseDoc {
  /** the pet-name/index key — addressing only, no schema weight beyond keying. */
  readonly title: string;
  /** the WHOLE open field record, pass-through — tiddlers carry no set schema; nothing here narrows it. */
  readonly fields: Readonly<Record<string, unknown>>;
  /** the causal stamp when the face carries one; null on faces with no CRDT backing (the TW5 VM face). */
  readonly heads: readonly string[] | null;
  /** optional provenance a face may carry (the composite face stamps these) — pass-through, never required. */
  readonly bagId?: string;
  readonly changeId?: string | null;
}

/** Pull the body text — the `text` field read as ONE field among many (the current lens's probe). */
export function senseBodyOf(fields: Readonly<Record<string, unknown>>): string {
  const text = fields["text"];
  return typeof text === "string" ? text : "";
}

// ── the per-title lenses (the CURRENT plane math — title+text; the shore carries more) ───────────────

/** The shingle width the form lens mines — a small char k-gram, cheap and deterministic. */
export const FORM_SHINGLE_K = 6;

/** Per-doc shingle budget — a megabyte-scale tiddler contributes a BOUNDED, deterministic census
 *  (measured unguarded: a 2.3MB tiddler minted ~298k shingles / ~37MB heap). */
export const MAX_DOC_SHINGLES = 4096;

/**
 * Shred a text into its DISTINCT char k-gram shingles (the form lens's atomic patterns).
 * A doc whose position count exceeds `cap` samples at a FIXED stride — deterministic (the same
 * text always yields the same census on every face; the cross-beat agreement rides that).
 */
export function shingles(text: string, k: number = FORM_SHINGLE_K, cap: number = MAX_DOC_SHINGLES): Set<string> {
  const out = new Set<string>();
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length === 0) return out;
  if (t.length <= k) { out.add(t); return out; }
  const positions = t.length - k + 1;
  const stride = positions > cap ? Math.ceil(positions / cap) : 1;
  for (let i = 0; i + k <= t.length; i += stride) out.add(t.slice(i, i + k));
  return out;
}

/**
 * The STRUCTURE-plane salience of one text [0,1] — the meme-ast RED register load. A text carrying
 * at least one `<<~…>>` sigil island reads structurally load-bearing (1); bare prose reads 0. The
 * load indicator stays deterministic and cheap (the graded-density refinement awaits real grounds).
 */
export function structureSalience(text: string): number {
  return collectEvents(text).length >= 1 ? 1 : 0;
}

/** One title's derived stalk — every per-title parse/shingle read the fold consumes, derived ONCE. */
export interface DocStalk {
  /** the form probe: the doc's distinct char k-gram shingles. */
  readonly shingleSet: ReadonlySet<string>;
  /** the structure probe: sigil-head → how many strata carry it (the memetic-wikitext reader's typed heads). */
  readonly headCounts: ReadonlyMap<string, number>;
  /** the structure-plane load indicator [0,1]. */
  readonly structure: number;
}

/**
 * Derive one title's stalk from its body text — the unit of per-title work. In the VM face this
 * derivation rides `wiki.getCacheForTiddler`, so TW5's own per-title invalidation law carries it.
 */
export function deriveDocStalk(text: string): DocStalk {
  const headCounts = new Map<string, number>();
  // the memetic-wikitext reader stratifies the body; frame sigils bound rather than steer, so they stay out of
  // the head index (a recall for "ahu" would name structure that governs nothing). The explicit
  // sourceCid skips the default sha256 stamp — the stalk reads strata only, and the VM sandbox
  // carries no TextEncoder for the crypto path.
  for (const s of stratify(text, "wiki-sense-stalk").strata) {
    if (s.frame) continue;
    const key = s.head.toLowerCase();
    headCounts.set(key, (headCounts.get(key) ?? 0) + 1);
  }
  return { shingleSet: shingles(text), headCounts, structure: structureSalience(text) };
}

// ── the corpus fold — docs + their stalks + the corpus-level shingle grammar ────────────────────────

/** One folded doc — the sensed entity plus its derived body and stalk. */
export interface FoldedDoc extends WikiSenseDoc {
  readonly body: string;
  readonly stalk: DocStalk;
}

/** The whole fold — every face's verbs read THIS, never a store. */
export interface CorpusFold {
  readonly docs: readonly FoldedDoc[];
  /** corpus form-mine: shingle → how many docs carry it (the recurring-grammar census). */
  readonly shingleDocFreq: ReadonlyMap<string, number>;
  /** A warm fold carries the form values its changed-shingle owners re-derived. */
  readonly formByTitle?: ReadonlyMap<string, number>;
}

/**
 * Fold a corpus of sensed entities. `stalkOf` shores the per-title derivation so a caller with its
 * own cache law (the VM indexer's `getCacheForTiddler`) supplies cached stalks; absent, the fold
 * derives fresh.
 */
export function foldCorpus(
  docs: readonly WikiSenseDoc[],
  stalkOf: (doc: WikiSenseDoc) => DocStalk = (d) => deriveDocStalk(senseBodyOf(d.fields)),
): CorpusFold {
  const folded: FoldedDoc[] = docs.map((d) => ({ ...d, body: senseBodyOf(d.fields), stalk: stalkOf(d) }));
  const shingleDocFreq = new Map<string, number>();
  for (const d of folded) {
    for (const s of d.stalk.shingleSet) shingleDocFreq.set(s, (shingleDocFreq.get(s) ?? 0) + 1);
  }
  return { docs: folded, shingleDocFreq };
}

/** Keep the document-frequency census and its inverse by title across reads. */
export class IncrementalCorpusFold {
  private readonly byTitle = new Map<string, FoldedDoc>();
  private readonly owners = new Map<string, Set<string>>();
  private readonly freq = new Map<string, number>();
  private readonly form = new Map<string, number>();
  private readonly byFrequency = new Map<number, Set<string>>();

  /** A changed corpus identity discards every title and rebuilds on its next read. */
  reset(): void {
    this.byTitle.clear();
    this.owners.clear();
    this.freq.clear();
    this.form.clear();
    this.byFrequency.clear();
  }

  private setFrequency(shingle: string, next: number): void {
    const old = this.freq.get(shingle) ?? 0;
    if (old === next) return;
    this.byFrequency.get(old)?.delete(shingle);
    if (next === 0) this.freq.delete(shingle);
    else this.freq.set(shingle, next);
    if (next > 0) {
      let bucket = this.byFrequency.get(next);
      if (!bucket) { bucket = new Set(); this.byFrequency.set(next, bucket); }
      bucket.add(shingle);
    }
  }

  /** A full first read seeds the index; later reads touch only changed stalks and threshold owners. */
  update(docs: readonly WikiSenseDoc[], stalkOf: (doc: WikiSenseDoc) => DocStalk = (doc) => deriveDocStalk(senseBodyOf(doc.fields))): CorpusFold {
    const oldStop = Math.max(2, this.byTitle.size / 2);
    const incoming = new Set(docs.map((doc) => doc.title));
    const moved = new Set<string>();
    const changedShingles = new Set<string>();
    const remove = (title: string): void => {
      const old = this.byTitle.get(title);
      if (!old) return;
      for (const shingle of old.stalk.shingleSet) {
        this.owners.get(shingle)?.delete(title);
        this.setFrequency(shingle, (this.freq.get(shingle) ?? 0) - 1);
        changedShingles.add(shingle);
      }
      this.byTitle.delete(title);
      this.form.delete(title);
      moved.add(title);
    };
    for (const title of this.byTitle.keys()) if (!incoming.has(title)) remove(title);
    for (const doc of docs) {
      const body = senseBodyOf(doc.fields);
      const old = this.byTitle.get(doc.title);
      if (old?.body === body) {
        this.byTitle.set(doc.title, { ...doc, body, stalk: old.stalk });
        continue;
      }
      const stalk = stalkOf(doc);
      for (const shingle of old?.stalk.shingleSet ?? []) {
        if (stalk.shingleSet.has(shingle)) continue;
        this.owners.get(shingle)?.delete(doc.title);
        this.setFrequency(shingle, (this.freq.get(shingle) ?? 0) - 1);
        changedShingles.add(shingle);
      }
      this.byTitle.set(doc.title, { ...doc, body, stalk });
      moved.add(doc.title);
      for (const shingle of stalk.shingleSet) {
        if (old?.stalk.shingleSet.has(shingle)) continue;
        let owners = this.owners.get(shingle);
        if (!owners) { owners = new Set(); this.owners.set(shingle, owners); }
        owners.add(doc.title);
        this.setFrequency(shingle, (this.freq.get(shingle) ?? 0) + 1);
        changedShingles.add(shingle);
      }
    }
    const stop = Math.max(2, this.byTitle.size / 2);
    // A title's form changes only when its own set moves, a shingle's df moves, or N moves
    // stopAbove across that shingle's df. The frequency buckets locate the last case.
    if (stop !== oldStop) {
      const low = Math.floor(Math.min(oldStop, stop)) + 1;
      const high = Math.floor(Math.max(oldStop, stop));
      for (let df = low; df <= high; df++) for (const shingle of this.byFrequency.get(df) ?? []) changedShingles.add(shingle);
    }
    for (const shingle of changedShingles) {
      const owners = this.owners.get(shingle);
      if (owners?.size === 0) this.owners.delete(shingle);
      for (const title of owners ?? []) moved.add(title);
    }
    for (const title of moved) {
      const doc = this.byTitle.get(title);
      if (!doc) continue;
      let recurring = 0;
      for (const shingle of doc.stalk.shingleSet) {
        const df = this.freq.get(shingle) ?? 0;
        if (df >= 2 && df <= stop) { recurring = 1; break; }
      }
      this.form.set(title, recurring);
    }
    return { docs: docs.map((doc) => this.byTitle.get(doc.title)!), shingleDocFreq: this.freq, formByTitle: this.form };
  }
}

// ── the sensed planes over a fold (structure ⊥ form; the engineered title-universe stalk) ───────────

/** The plane fold — restrictions + stalk ready for the Robinson radius and the H¹ gate. */
export interface CorpusPlanes {
  readonly stalk: ComparisonStalk;
  readonly restrictions: readonly PlaneRestriction[];
}

/**
 * Project a fold into the sensed planes. Structure reads per title (the RED register load); form reads
 * corpus-aware — a title participates in the recurring grammar when ANY of its shingles occurs in
 * ≥2 docs (load indicator), EXCLUDING stop-shingles: a shingle carried by more than half the corpus
 * (floor 2) reads as ambient texture, not grammar — the idf-lite saturation tourniquet (probed: 10k
 * plain-prose docs otherwise read radius=1 with EVERY title in the locus). Both planes key EVERY
 * title, so the engineered stalk carries a genuine overlap — the radius reads non-vacuous by construction.
 */
export function corpusPlanes(fold: CorpusFold): CorpusPlanes {
  const structureVal = new Map<string, number>();
  const formVal = new Map<string, number>();
  const stopAbove = Math.max(2, fold.docs.length / 2);
  for (const d of fold.docs) {
    structureVal.set(d.title, d.stalk.structure);
    if (fold.formByTitle) { formVal.set(d.title, fold.formByTitle.get(d.title) ?? 0); continue; }
    let recurring = 0;
    for (const s of d.stalk.shingleSet) {
      const df = fold.shingleDocFreq.get(s) ?? 0;
      if (df >= 2 && df <= stopAbove) { recurring = 1; break; }
    }
    formVal.set(d.title, d.stalk.shingleSet.size > 0 ? recurring : 0);
  }
  const restrictions: PlaneRestriction[] = [
    { plane: "structure", variance: "sheaf", value: structureVal },
    { plane: "form", variance: "sheaf", value: formVal },
  ];
  return { stalk: { units: fold.docs.map((d) => d.title) }, restrictions };
}

// ── cohere — the consistency verdict over a fold (BOTH mesh organs, one assignment) ─────────────────

/** The cohere() verdict — the consistency keystone's planes folded through BOTH mesh organs over one snapshot. */
export interface WikiCoherenceVerdict {
  /** the Robinson li-radius: radius · glues · vacuous · per-pair loci · the union obstruction locus. */
  readonly consistency: ConsistencyRadius;
  /** the H¹ classifier over the SAME assignment — which no-global-now stands (reconcilable ⊥ ontological). */
  readonly gate: {
    readonly kind: "reconcilable" | "ontological";
    readonly dimH1: number;
    /** the reconciliation cost R*_sem = log₂ dim H¹ (0 when reconcilable). */
    readonly cost: number;
  };
  /** how many sensed entities the verdict folded — the corpus grain it speaks over. */
  readonly corpusSize: number;
  /** the as-of stamp: the union of the answering docs' causal heads at the snapshot read
   *  (dedup, sorted; empty for faces with no CRDT backing) — "as of my last sync", never "globally". */
  readonly asOf: readonly string[];
}

/** Fold cohere — one assignment through the Robinson radius AND the H¹ gate. */
export function cohereFold(fold: CorpusFold): WikiCoherenceVerdict {
  const planes = corpusPlanes(fold);
  const consistency = consistencyRadius(planes.restrictions, planes.stalk);
  const obs = cohomologyObstruction({ restrictions: planes.restrictions, stalk: planes.stalk });
  return {
    consistency,
    gate: { kind: obs.kind, dimH1: obs.dimH1, cost: obs.cost },
    corpusSize: fold.docs.length,
    // the snapshot's causal coordinates — the proof-hold's stamp rides these, never a wall clock.
    asOf: [...new Set(fold.docs.flatMap((d) => d.heads ?? []))].sort(),
  };
}

// ── the VM tiddler universe (whole-by-default, narrow-by-designation — operator law) ────────────────

/** Narrowing designations — each one an EXPLICIT opt-in; absent them the WHOLE wiki senses. */
export interface WikiUniverseOptions {
  /** designate: drop shadow/plugin-bundled tiddlers (default false — shadows sense). */
  readonly excludeShadows?: boolean;
  /** designate: drop `$:/` system titles (default false — system titles sense). */
  readonly excludeSystem?: boolean;
}

/** The two universe designations the VM face speaks by name (filter-suffix grammar). */
export type WikiSenseUniverse = "whole" | "ordinary";

/** Map a named universe onto its narrowing designations — "ordinary" = non-shadow, non-system. */
export function universeOptions(universe: WikiSenseUniverse): WikiUniverseOptions {
  return universe === "ordinary" ? { excludeShadows: true, excludeSystem: true } : {};
}

/**
 * Enumerate a TW5 wiki's sensed universe — the WHOLE wiki by default: ordinary tiddlers PLUS
 * shadow/plugin-bundled tiddlers, INCLUDING `$:/` system titles (plugin tiddlers bundling code
 * count as sensed entities like any other). Narrowing happens ONLY by designation. Each tiddler
 * crosses as its WHOLE field record, untouched.
 */
export function readTw5Universe(wiki: TW5Wiki, opts: WikiUniverseOptions = {}): WikiSenseDoc[] {
  const docs: WikiSenseDoc[] = [];
  const visit = (tiddler: TW5Tiddler, title: string): void => {
    if (opts.excludeSystem && wiki.isSystemTiddler(title)) return;
    docs.push({
      title,
      fields: tiddler.fields as Readonly<Record<string, unknown>>,
      // the VM face carries no CRDT stamp — asOf reads empty, honestly (no fabricated now).
      heads: null,
    });
  };
  if (opts.excludeShadows) wiki.each(visit);
  else wiki.eachTiddlerPlusShadows(visit);
  return docs;
}

/** The boundary loci budget — every SERIALIZED surface (filter wire, proof record, indicator frame)
 *  caps the obstruction locus here and carries the true count as `lociTotal`; in-process verbs keep
 *  the full read. */
export const LOCI_CAP = 32;

/** Cap a locus list for a serialized boundary — deterministic head slice (the loci arrive sorted
 *  from the radius read); the caller carries the true total alongside. */
export function capLoci(loci: readonly string[], cap: number = LOCI_CAP): readonly string[] {
  return loci.length > cap ? loci.slice(0, cap) : loci;
}

/**
 * The COMPACT cohere verdict — the wikitext-idiomatic shape `[wikisense:cohere[]]` answers with
 * (one JSON string): flat scalars + the loci, never Maps, never corpus bytes. `pairs` folds to a
 * count; the full per-pair read stays on the in-process verbs. The locus caps at {@link LOCI_CAP};
 * `lociTotal` carries the uncapped count.
 */
export interface WikiCoherenceSummary {
  readonly radius: number;
  readonly glues: boolean;
  readonly vacuous: boolean;
  readonly obstructionLocus: readonly string[];
  readonly lociTotal: number;
  readonly gate: WikiCoherenceVerdict["gate"];
  readonly corpusSize: number;
  readonly bindingPairs: number;
}

/** Compact a verdict for the filter-operator wire (JSON-clean, deterministic key order). */
export function summarizeCoherence(v: WikiCoherenceVerdict): WikiCoherenceSummary {
  return {
    radius: v.consistency.radius,
    glues: v.consistency.glues,
    vacuous: v.consistency.vacuous,
    obstructionLocus: capLoci(v.consistency.obstructionLocus),
    lociTotal: v.consistency.obstructionLocus.length,
    gate: v.gate,
    corpusSize: v.corpusSize,
    bindingPairs: v.consistency.pairs.filter((p) => !p.vacuous).length,
  };
}

// ── recall tiers — each tier reads the fold through one lens, scores into [0,1] ─────────────────────

/** One recall hit — a title with the score its tier gave it (each tier normalizes into [0,1]). */
export interface WikiRecallHit {
  readonly title: string;
  readonly score: number;
}

/** Default per-tier recall cap. */
export const RECALL_LIMIT = 10;

/** Sort hits score-desc, title-asc (deterministic), then cap at the tier limit. */
export function rankHits(hits: WikiRecallHit[], limit: number): WikiRecallHit[] {
  return hits
    .sort((a, b) => b.score - a.score || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
    .slice(0, limit);
}

/** content floor — the probe matches TITLES (the pet-name key); exact 1 · prefix 0.75 · substring 0.5. */
export function contentTier(fold: CorpusFold, probe: string, limit: number = RECALL_LIMIT): WikiRecallHit[] {
  if (probe.length === 0) return [];
  const p = probe.toLowerCase();
  const hits: WikiRecallHit[] = [];
  for (const d of fold.docs) {
    const t = d.title.toLowerCase();
    const score = t === p ? 1 : t.startsWith(p) ? 0.75 : t.includes(p) ? 0.5 : 0;
    if (score > 0) hits.push({ title: d.title, score });
  }
  return rankHits(hits, limit);
}

/** structure — the sigil-head strata the memetic-wikitext reader typed; score = matching-strata count, max-normalized. */
export function structureTier(fold: CorpusFold, sigilHead: string, limit: number = RECALL_LIMIT): WikiRecallHit[] {
  if (sigilHead.length === 0) return [];
  const head = sigilHead.toLowerCase();
  const counts = fold.docs
    .map((d) => ({ title: d.title, n: d.stalk.headCounts.get(head) ?? 0 }))
    .filter((x) => x.n > 0);
  const maxN = Math.max(1, ...counts.map((x) => x.n));
  return rankHits(counts.map((x) => ({ title: x.title, score: x.n / maxN })), limit);
}

/** form — the seed title's shingle neighbors, ranked by Jaccard SIMILARITY; the seed stays out. */
export function formTier(fold: CorpusFold, likeTitle: string, limit: number = RECALL_LIMIT): WikiRecallHit[] {
  const seed = fold.docs.find((d) => d.title === likeTitle);
  if (!seed) return [];
  const hits: WikiRecallHit[] = [];
  for (const d of fold.docs) {
    if (d.title === seed.title) continue;
    const sim = 1 - jaccardDistance(seed.stalk.shingleSet, d.stalk.shingleSet);
    if (sim > 0) hits.push({ title: d.title, score: sim });
  }
  return rankHits(hits, limit);
}
