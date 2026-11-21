/** Measure one edit's cold census and warm document-frequency update on a fixed synthetic corpus. */
import { performance } from "node:perf_hooks";
import { IncrementalCorpusFold, corpusPlanes, foldCorpus, type WikiSenseDoc } from "../src/wiki-sense-fold.js";
import { buildFixtureIsland } from "../src/wiki-store-adapter.js";

const vocabulary = "shore rhythm chorus pattern island weave memory signal grammar contour field tide";
const body = Array.from({ length: 18 }, (_, i) => `${vocabulary} passage ${i} recurring words across the corpus`).join(" ");
const docs: WikiSenseDoc[] = Array.from({ length: 2000 }, (_, i) => ({ title: `Title ${i}`, fields: { text: `${body} distinct ${i}` }, heads: null }));
const median = (times: number[]) => times.sort((a, b) => a - b)[Math.floor(times.length / 2)]!;
const cold: number[] = [];
const warm: number[] = [];
const entries: number[] = [];
const store = await buildFixtureIsland("measure", docs.map((doc) => ({ title: doc.title, text: String(doc.fields.text) })));
for (let trial = -1; trial < 7; trial++) {
  const index = new IncrementalCorpusFold();
  index.update(docs);
  const edited = docs.slice();
  edited[17] = { ...docs[17]!, fields: { text: `${body} edited ${trial}` } };
  let start = performance.now();
  corpusPlanes(foldCorpus(edited));
  if (trial >= 0) cold.push(performance.now() - start);
  start = performance.now();
  corpusPlanes(index.update(edited));
  if (trial >= 0) warm.push(performance.now() - start);
  start = performance.now();
  await store.entries();
  if (trial >= 0) entries.push(performance.now() - start);
}
console.log(`cold whole-corpus median of 7: ${median(cold).toFixed(2)} ms`);
console.log(`incremental median of 7: ${median(warm).toFixed(2)} ms`);
console.log(`composite entries() median of 7: ${median(entries).toFixed(2)} ms`);
