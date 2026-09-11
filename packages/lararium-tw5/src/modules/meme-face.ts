/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/meme-face
type: application/javascript
module-type: startup
\*/
/**
 * meme-face — TW5 startup module publishing `$tw.lares.meme`, every meme law bound to the live wiki.
 *
 * A wiki-side caller — a widget, an action, a filter, a button — holds `$tw` and no `lares` binary.
 * This face hands it the same verbs the daemon reactors and the HTTP routes carry:
 *
 *   place(uri, text, base?)   the placement through the Confluence gate, over `wikiMemeSink($tw.wiki)`
 *   read(uri)                 the whole meme recomposed + the canonical hash a writer hands back
 *   normalize(text)           the framing canonicalization (pure)
 *   check(text)               the carrier's shape · block-check verdict · computed check · edges · the
 *                             grade and diagnostics `place` lands (one reading, the gate's own)
 *   project(uri, to)          the root rendered through the target's template (mem · md · html · tid · json)
 *   recompose(uri)            the whole carrier from its record group, synchronous; null under no root
 *   parse(uri, text, grammar?) the graded meme-ast over any text; absent a grammar, the wiki's own
 *
 * The laws come from the library tiddlers (`meme-laws`, `place-meme`, `meme-project`, `meme-ast`);
 * this module binds them to `$tw.wiki` and nothing more. The face names the ONE namespace a meme law
 * publishes under — no law stands flat on `$tw.lares`.
 */

import type { LaresMemeFace, LaresTw5Extension } from "../types/lares-globals.js";
import type { TW5Instance } from "../types/tiddlywiki.js";
import { placeMeme, readMeme, wikiMemeSink } from "../place-meme.js";
import { bccOf, headUriOf, normalizeMemeSource, readCarrierEdges, readCarrierShape, verifyBcc } from "../meme-laws.js";
import { projectMeme, recomposeMeme } from "../meme-project.js";
import { parseMemeText } from "../meme-ast/index.js";
import { gradeOf } from "../meme-ast/diagnostics.js";
import { memeticIngestOps } from "../ingest-gate.js";
import { getGrammar } from "../grammar-cache.js";

export const name        = "lararium-meme-face";
export const after       = ["startup"];
export const synchronous = true;

// TW5's evalGlobal injects $tw as a direct function parameter.
declare const $tw: (Partial<TW5Instance> & LaresTw5Extension) | undefined;

/** The face over one wiki — exported so a test binds it to a wiki it constructs. */
export function memeFaceOf(wiki: TW5Instance["wiki"]): LaresMemeFace {
  const sink = wikiMemeSink(wiki);
  return {
    place: (uri, text, base) => placeMeme({ uri, text, baseHash: base ?? null }, sink),
    read: (uri) => readMeme(uri, sink),
    normalize: (text) => normalizeMemeSource(text),
    // ONE TEXT, ONE GRADE. The grade rides the gate's own deserialize — the parse under the wiki's
    // grammar plus the shore's faults — so `check` and `place` never read one carrier two ways.
    check: (text) => {
      const { diagnostics } = memeticIngestOps.deserialize(headUriOf(text) ?? "", text);
      return {
        shape: readCarrierShape(text),
        check: verifyBcc(text),
        bcc: bccOf(text),
        edges: readCarrierEdges(text),
        grade: gradeOf(diagnostics),
        diagnostics,
      };
    },
    project: (uri, to) => projectMeme(wiki, uri, to),
    recompose: (uri) => recomposeMeme(wiki, uri),
    parse: (uri, text, grammar) => parseMemeText(uri, text, grammar ?? getGrammar() ?? undefined),
  };
}

export function startup(): void {
  if (!$tw?.wiki) return;
  $tw.lares ??= {};
  $tw.lares.meme = memeFaceOf($tw.wiki);
}
