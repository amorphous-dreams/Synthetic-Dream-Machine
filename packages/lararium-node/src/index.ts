/**
 * @deprecated web2-era — recipe VM / renderCarrier exports pending meme-* rebuild.
 * Rebuild target: swap bootRecipeVm → bootMemeRecipeVm once meme-recipe-vm.ts exists.
 */
export type { CorpusSource } from "./node-host.js";
export { LARES_ROOT, LARES_MEMES_ROOT, CHAPEL_MEMES_ROOT, REPO_ROOT } from "./node-host.js";

export {
  seedGrammarTiddler,
  reconcileGrammarTiddlerIfChanged,
  loadGrammarFromStore,
} from "./seed-grammar-tiddler.js";
