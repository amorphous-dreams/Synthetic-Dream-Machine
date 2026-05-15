/**
 * @deprecated web2-era — all functions dead. See node-host.web2.ts for the original.
 * Rebuild target: meme-node-host.ts
 *   readCarrier        → readMeme (parseMemeText from @lararium/core/meme-ast)
 *   compileCarrierIndex → compileMemeIndex (MemeRecord not CarrierRecord)
 *   compileBootArtifact → compileBootArtifact (same shape; new parser)
 *   loadGrammarRules   → grammarRulesFromText (@lararium/core/meme-grammar)
 */

import { join } from "path";
import { laresRoot, repoRoot } from "@lares/core";

// Path roots — no carrier dependency; kept verbatim.
export const LARES_ROOT        = laresRoot;
export const BAGS_ROOT         = join(repoRoot, "bags");
export const LARES_MEMES_ROOT  = join(BAGS_ROOT, "@lares");  // legacy alias
export const REPO_ROOT         = repoRoot;

// CorpusSource — structural contract used by serve.ts; no carrier dependency.
export interface CorpusSource {
  name:   string;
  path:   string;
  bag:    string;
  quine?: true;
}
