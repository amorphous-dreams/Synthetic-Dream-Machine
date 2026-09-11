/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/project
type: application/javascript
module-type: filteroperator
\*/
/**
 * meme-project — `[<root>meme-project[mem]]`: the text a meme root projects to, from inside a filter.
 *
 * The house templates (`lar:///ha.ka.ba/lararium/templates/meme/*`) and the Export dropdown reach the
 * recompose and the markdown projection through this one operator, so a stock wiki's `--render`
 * carries the same law the face and the daemon carry. The operand names the text target — `mem` ·
 * `md` · `md.meta`; a title that stands as no carrier root yields nothing, and an operand outside the
 * three THROWS (an unregistered operand answers empty in TiddlyWiki, and silence is the one failure a
 * filter's author cannot see).
 *
 * A title with a fragment (`lar:///root#/slot`) projects its ROOT: the Export button on a child
 * record exports the meme the child belongs to.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { projectCarrierText, recomposeMeme } from "../meme-project.js";

const OPERANDS = new Set(["mem", "md", "md.meta"]);

export function memeProject(
  source: TW5FilterSource,
  operator: TW5FilterOperator,
  options: { wiki: TW5Wiki },
): string[] {
  const operand = operator.operand || "mem";
  if (!OPERANDS.has(operand)) {
    throw new Error(`meme-project: unknown operand "${operand}" — operands: mem · md · md.meta`);
  }
  const results: string[] = [];
  source((_tiddler, title: string) => {
    const root = title.split("#")[0]!;
    const text = recomposeMeme(options.wiki, root);
    if (text === null) return;
    if (operand === "mem") { results.push(text); return; }
    const pair = projectCarrierText(text, root, "md");
    results.push(operand === "md" ? pair.text : pair.meta!);
  });
  return results;
}

// TW5 registers a filter operator by its EXPORTED BINDING; the hyphenated name binds here.
export { memeProject as "meme-project" };
