/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/lar-refs
type: application/javascript
module-type: filteroperator
\*/
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";

/** Read addresses from carrier text, retaining fragments and removing prose punctuation. */
function references(text: string): string[] {
  return Array.from(text.matchAll(/lar:\/\/[^\s`"'<>\[\]{}|]+/g), (match) =>
    match[0].replace(/[.,;:!?\)]+$/, ""));
}

export function larRefs(source: TW5FilterSource, operator: TW5FilterOperator, { wiki }: { wiki: TW5Wiki }): string[] {
  const mode = (operator.suffix ?? "").trim();
  if (mode !== "out" && mode !== "in" && mode !== "tagged") throw new Error(`[lar-refs] unknown suffix "${mode}"; use out, in or tagged`);
  const result = new Set<string>();
  source((_tiddler, title) => {
    if (mode === "out") {
      const text = wiki.getTiddler(title)?.fields.text;
      if (typeof text === "string") for (const ref of references(text)) result.add(ref);
    } else {
      const bare = title.split("#", 1)[0];
      wiki.each((tiddler, candidate) => {
        const text = tiddler.fields.text;
        if (mode === "tagged") {
          const tags = tiddler.fields.tags;
          if (Array.isArray(tags) && tags.includes(title)) result.add(candidate);
          return;
        }
        if (typeof text === "string" && references(text).some((ref) => ref === title || (!title.includes("#") && ref.split("#", 1)[0] === bare))) result.add(candidate);
      });
    }
  });
  return [...result];
}
export { larRefs as "lar-refs" };
