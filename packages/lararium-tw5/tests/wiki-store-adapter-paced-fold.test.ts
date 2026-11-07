/**
 * THE COLD COHERENCE FOLD GIVES THE ISLAND'S LOOP BACK BETWEEN SLICES.
 *
 * Measured on the browser weld (W3): the wiki island answered a click 10.8-11.2 s after dispatch. The click was not
 * lost: it waited in the island's queue while the coherence projection's FIRST fold seeded the corpus index in one
 * synchronous stretch (a CPU profile names `WikiStoreAdapter.snapshot -> IncrementalCorpusFold.update`, ~10.8 s). Every
 * act a person made in that window waited with it. The fold now runs in slices and yields to the host between them,
 * so a queued message runs before the fold resumes.
 *
 * RED: a host task queued at the fold's first derivation runs before the fold derives its last stalk.
 * CONTROL: the sliced fold reads exactly the planes the cold projection reads; with no slice spent the fold never
 * yields (the instrument reads a yield only where one happens).
 */
import { describe, expect, test, vi } from "vitest";

vi.mock("../src/memetic-wikitext-sensorium.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/memetic-wikitext-sensorium.js")>();
  return { ...original, stratify: vi.fn(original.stratify) };
});

const { stratify } = await import("../src/memetic-wikitext-sensorium.js");
const derivations = (): number => vi.mocked(stratify).mock.calls.filter((call) => call[1] === "wiki-sense-stalk").length;
const { WikiStoreAdapter, buildFixtureIsland, projectWikiSensorium } = await import("../src/wiki-store-adapter.js");
const { compositeCorpusReader } = await import("../src/wiki-corpus-reader.js");

const seeds = Array.from({ length: 30 }, (_, i) => ({ title: `Carrier ${i}`, text: `<<~ ahu slot=\`#/a${i}\`>>\n\n! Head ${i}\n\nbody words number ${i} recurring grammar here\n\n<<~/ahu>>` }));

/** Queue one host task at the fold's first derivation; answer how many stalks the fold had derived when it ran. */
function hostTaskAtFirstDerivation(): { readonly ranAt: () => number | null } {
  let ranAt: number | null = null;
  let armed = false;
  vi.mocked(stratify).mockClear();
  const original = vi.mocked(stratify).getMockImplementation()!;
  vi.mocked(stratify).mockImplementation((...args) => {
    if (!armed && args[1] === "wiki-sense-stalk") {
      armed = true;
      // A message a person's act would ride: a host task queued behind the running fold.
      setTimeout(() => { ranAt = derivations(); }, 0);
    }
    return original(...args);
  });
  return { ranAt: () => ranAt };
}

describe("the cold coherence fold yields to the island's loop", () => {
  test("RED: a host task queued at the first derivation runs before the fold derives its last stalk", async () => {
    const store = await buildFixtureIsland("w", seeds);
    const adapter = new WikiStoreAdapter(store, compositeCorpusReader(store, { sliceMs: 0 }));
    const probe = hostTaskAtFirstDerivation();
    await adapter.snapshot();
    expect(derivations()).toBe(seeds.length);
    expect(probe.ranAt(), "the queued host task ran inside the fold").not.toBeNull();
    expect(probe.ranAt()!).toBeLessThan(seeds.length);
  });

  test("CONTROL: the sliced fold reads the planes the cold projection reads; an unspent slice never yields", async () => {
    const store = await buildFixtureIsland("w", seeds);
    const sliced = await new WikiStoreAdapter(store, compositeCorpusReader(store, { sliceMs: 0 })).snapshot();
    const cold = projectWikiSensorium(await store.entries());
    expect(sliced.readings).toEqual(cold.readings);
    expect(sliced.restrictions.map((r) => [...r.value.entries()])).toEqual(cold.restrictions.map((r) => [...r.value.entries()]));
    const probe = hostTaskAtFirstDerivation();
    await new WikiStoreAdapter(store, compositeCorpusReader(store, { sliceMs: Number.POSITIVE_INFINITY })).snapshot();
    expect(probe.ranAt(), "no slice spent, no yield inside the fold").toBeNull();
  });

  test("two snapshots on one adapter fold one after the other, never interleaved on the shared index", async () => {
    const store = await buildFixtureIsland("w", seeds);
    const adapter = new WikiStoreAdapter(store, compositeCorpusReader(store, { sliceMs: 0 }));
    const [a, b] = await Promise.all([adapter.snapshot(), adapter.snapshot()]);
    const cold = projectWikiSensorium(await store.entries());
    expect(a.readings).toEqual(cold.readings);
    expect(b.readings).toEqual(cold.readings);
  });
});
