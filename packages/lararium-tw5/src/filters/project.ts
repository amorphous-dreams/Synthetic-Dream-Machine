/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/project
type: application/javascript
module-type: filteroperator
\*/
/**
 * meme-project — `[<root>meme-project[mem]]` / `[<root>meme-project[md],[<dialect>],[<tongue>]]`: the
 * text a meme root projects to, from inside a filter.
 *
 * The house templates (`lar:///ha.ka.ba/lararium/templates/meme/*`) and the Export dropdown reach the
 * recompose and the markdown projection through this one operator, so a stock wiki's `--render`
 * carries the same law the face and the daemon carry. The first operand names the text target —
 * `mem` · `md` · `md.meta`; a title that stands as no carrier root yields nothing, and an operand
 * outside the three THROWS (an unregistered operand answers empty in TiddlyWiki, and silence is the
 * one failure a filter's author cannot see).
 *
 * THE SECOND AND THIRD OPERANDS — `md`/`md.meta` alone — name `dialect`/`tongue`. Either given, it
 * wins; both absent, the RECORDED target off the wiki's own `<root>/submission` tiddler
 * ({@link submissionTitleOf}) wins — its `variant`/`tongue` fields are the SAME two keys the CLI's
 * `.md.meta` sidecar carries, loaded here as a tiddler's own fields rather than re-read off raw
 * text; absent that too, CommonMark with no tongue — one law ({@link resolveWeaveTarget}), read the
 * same way every door reads it. An unknown dialect THROWS, same as the first operand's law: a
 * filter that answered empty for a typo would read exactly like a meme that projected to nothing.
 * `resolve` always rides as {@link wikiResolver} — a frozen `aka` edge pins the live wiki, never a
 * stale unresolved fallback, wherever this filter's own recompose can reach the target.
 *
 * A title with a fragment (`lar:///root#/slot`) projects its ROOT: the Export button on a child
 * record exports the meme the child belongs to.
 */
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";
import { projectCarrierText, recomposeMeme, wikiResolver } from "../meme-project.js";
import { resolveWeaveTarget, submissionTitleOf } from "../weave/index.js";

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
  // RUNTIME NOTE: `operator.operands` here is TiddlyWiki's own resolved VALUE array (plain strings —
  // `filters.js`'s own evaluation already folded each operand spec to its `.value`), never the
  // operand-spec objects the type surface's own `operands` field name might suggest.
  const dialectArg = (operator.operands[1] as unknown as string) || "";
  const tongueArg = (operator.operands[2] as unknown as string) || "";
  const results: string[] = [];
  source((_tiddler, title: string) => {
    const root = title.split("#")[0]!;
    const text = recomposeMeme(options.wiki, root);
    if (text === null) return;
    if (operand === "mem") { results.push(text); return; }
    // The RECORDED target — the wiki's own `<root>/submission` tiddler's `variant`/`tongue` fields,
    // the SAME two keys the CLI's `.md.meta` sidecar carries (just already parsed into fields here,
    // never re-read off raw text). Absent that tiddler, the empty recorded target falls through to
    // CommonMark/no-tongue, exactly as a first-time projection on disk does.
    const recordFields = (options.wiki.getTiddler(submissionTitleOf(root)) as { fields?: Record<string, string> } | undefined)?.fields;
    const recorded = {
      ...(recordFields?.["variant"] ? { variant: recordFields["variant"] } : {}),
      ...(recordFields?.["tongue"] ? { tongue: recordFields["tongue"] } : {}),
    };
    const { profile, tongue } = resolveWeaveTarget({ dialect: dialectArg, tongue: tongueArg, recorded });
    const pair = projectCarrierText(text, root, "md", { profile, ...(tongue ? { tongue } : {}), resolve: wikiResolver(options.wiki) });
    results.push(operand === "md" ? pair.text : pair.meta!);
  });
  return results;
}

// TW5 registers a filter operator by its EXPORTED BINDING; the hyphenated name binds here.
export { memeProject as "meme-project" };
