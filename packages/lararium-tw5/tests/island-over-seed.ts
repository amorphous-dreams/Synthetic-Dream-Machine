/**
 * island-over-seed — the one seeded road a test stands an island on, as every engine boots: lay the composition, read wave zero,
 * boot over its preloads, mount the shore from the same seed. It lives apart from `test-wiki` so a test that only boots a wiki
 * never loads the island recipe.
 */
import { layIslandComposition, mountIslandShore, type LayIslandCompositionInput } from "../src/island-recipe.js";
import { readIslandSeed } from "../src/island-seed.js";
import { bootTestWiki } from "./test-wiki.js";

/** Lay the composition, read wave zero, boot over its preloads, and mount the shore. */
export async function standIslandOverSeed(input: LayIslandCompositionInput & { boot?: Parameters<typeof bootTestWiki>[0] }) {
  const { boot, ...composition } = input;
  const laid = layIslandComposition(composition);
  const seed = await readIslandSeed(input.composite, []);
  const tw5 = await bootTestWiki({ ...boot, seed: seed.preloads });
  const { adaptor, stores } = mountIslandShore(tw5, laid, seed);
  return { tw5, adaptor, stores, laid, seed };
}
