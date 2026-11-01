import { describe, expect, test, vi } from "vitest";
import type { ChangeOrigin } from "@lararium/mesh";

// Every stalk derivation passes through `stratify(text, "wiki-sense-stalk")`, whoever calls `deriveDocStalk`: the
// count sits at the derivation itself, so the same instrument reads the base tree and the cured one alike.
vi.mock("../src/memetic-wikitext-sensorium.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/memetic-wikitext-sensorium.js")>();
  return { ...original, stratify: vi.fn(original.stratify) };
});

const { stratify } = await import("../src/memetic-wikitext-sensorium.js");
const derivations = (): number => vi.mocked(stratify).mock.calls.filter((call) => call[1] === "wiki-sense-stalk").length;
const { WikiStoreAdapter, buildFixtureIsland, projectWikiSensorium } = await import("../src/wiki-store-adapter.js");

const origin: ChangeOrigin = { kind: "canon-hydrate", receipt: "warm-refold" };
const seeds = Array.from({ length: 40 }, (_, i) => ({ title: `Carrier ${i}`, text: `<<~ ahu slot=\`#/a${i}\`>>\n\n! Head ${i}\n\nbody words number ${i} recurring grammar here\n\n<<~/ahu>>` }));

describe("the coherence read refolds warm: one write re-derives one stalk, not the corpus", () => {
  test("RED: a refold after one body edit derives exactly one stalk; CONTROL: the first fold derives every stalk", async () => {
    const store = await buildFixtureIsland("w", seeds);
    const adapter = new WikiStoreAdapter(store);
    vi.mocked(stratify).mockClear();
    await adapter.snapshot();
    expect(derivations()).toBe(seeds.length);   // CONTROL: the instrument counts derivations
    vi.mocked(stratify).mockClear();
    await adapter.snapshot();
    expect(derivations()).toBe(0);              // an unchanged corpus derives nothing
    const bag = store.storeForBag("w")!;
    await bag.put({ tiddler: { title: "Carrier 7", text: "a different body, one tiddler edited" } }, origin);
    vi.mocked(stratify).mockClear();
    await adapter.snapshot();
    expect(derivations()).toBe(1);              // one edit, one stalk
  });

  test("a warm refold reads the same planes as a cold projection of the same corpus", async () => {
    const store = await buildFixtureIsland("w", seeds);
    const adapter = new WikiStoreAdapter(store);
    await adapter.snapshot();
    const bag = store.storeForBag("w")!;
    await bag.put({ tiddler: { title: "Carrier 3", text: "changed words, changed shingles" } }, origin);
    const warm = await adapter.snapshot();
    const cold = projectWikiSensorium(await store.entries());
    expect(warm.readings).toEqual(cold.readings);
    expect(warm.restrictions.map((r) => [...r.value.entries()])).toEqual(cold.restrictions.map((r) => [...r.value.entries()]));
  });
});
