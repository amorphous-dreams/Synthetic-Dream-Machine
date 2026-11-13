import { describe, expect, test } from "vitest";
import { IncrementalCorpusFold, corpusPlanes, foldCorpus, type WikiSenseDoc } from "../src/wiki-sense-fold.js";

const doc = (title: string, text: string): WikiSenseDoc => ({ title, fields: { title, text }, heads: null });
const signature = (docs: readonly WikiSenseDoc[], fold: ReturnType<IncrementalCorpusFold["update"]>) => {
  const planes = corpusPlanes(fold);
  return {
    units: planes.stalk.units,
    values: planes.restrictions.map((restriction) => [...restriction.value]),
    frequency: [...fold.shingleDocFreq].sort(([a], [b]) => a.localeCompare(b)),
  };
};

describe("incremental document frequency", () => {
  test("incremental-frequency-200-steps: each add, edit, delete, empty corpus and moving stop threshold equals a cold fold; CONTROL: cold initial fold", () => {
    const titles = new Map<string, WikiSenseDoc>();
    const index = new IncrementalCorpusFold();
    let state = 0x51f15e;
    const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
    const corpus = () => [...titles.values()];
    expect(signature([], index.update([]))).toEqual(signature([], foldCorpus([])));
    for (let step = 0; step < 200; step++) {
      const title = `Title ${next() % 31}`;
      if (step % 19 === 0) titles.clear();
      else if (step % 4 === 0) titles.delete(title);
      else {
        const words = ["shared chorus phrase", "another shared chorus", "unique branch", "alpha beta gamma", "sigma delta omega"];
        const body = Array.from({ length: 6 }, () => words[next() % words.length]).join(" ") + ` ${next() % 8}`;
        titles.set(title, doc(title, body));
      }
      const docs = corpus();
      expect(signature(docs, index.update(docs)), `step ${step}`).toEqual(signature(docs, foldCorpus(docs)));
    }
  });

  test("CONTROL: a skipped decrement changes the same comparison", () => {
    const docs = [doc("a", "shared chorus phrase"), doc("b", "shared chorus phrase")];
    const index = new IncrementalCorpusFold();
    index.update(docs);
    const surviving = [docs[0]!];
    const fold = index.update(surviving);
    const broken = new Map(fold.shingleDocFreq);
    for (const shingle of fold.docs[0]!.stalk.shingleSet) broken.set(shingle, 2);
    const mutant = { ...fold, shingleDocFreq: broken, formByTitle: undefined };
    expect(signature(surviving, mutant)).not.toEqual(signature(surviving, foldCorpus(surviving)));
  });
});
