/*\
title: lar:///ha.ka.ba/lararium/tw5/filters/lar-refs
type: application/javascript
module-type: filteroperator
\*/
import type { TW5FilterOperator, TW5FilterSource, TW5Wiki } from "../types/tiddlywiki.js";

/** Read addresses from prose, excluding code examples but retaining sigil parameter values. */
function references(text: string): string[] {
  const prose = text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1[^\n]*(?:\n|$)/gm, "")
    .replace(/(?<!=)(`+)(?!`)[^\n]*?\1(?!`)/g, "");
  return Array.from(prose.matchAll(/lar:\/\/[^\s`"<>\[\]{}|]+/g), (match) => {
    let ref = match[0].replace(/[.,;:!?]+$/, "");
    while (ref.endsWith(")") && (ref.match(/\)/g)?.length ?? 0) > (ref.match(/\(/g)?.length ?? 0)) ref = ref.slice(0, -1);
    if (ref.endsWith("'") && prose[match.index! - 1] === "'") ref = ref.slice(0, -1);
    return ref;
  });
}

export function larRefs(source: TW5FilterSource, operator: TW5FilterOperator, { wiki }: { wiki: TW5Wiki }): string[] {
  const mode = (operator.suffix ?? "").trim();
  if (!["out", "in", "tagged", "unreached"].includes(mode)) throw new Error(`[lar-refs] unknown suffix "${mode}"; use out, in, tagged or unreached`);
  const titles: string[] = [];
  source((_tiddler, title) => titles.push(title));
  const result = new Set<string>();
  if (mode === "out") {
    for (const title of titles) {
      const text = wiki.getTiddler(title)?.fields.text;
      if (typeof text === "string") for (const ref of references(text)) result.add(ref);
    }
  } else {
    // One index per operator evaluation, built through the caller's wiki (including reader views).
    const index = new Map<string, Set<string>>();
    const add = (key: string, candidate: string) => {
      let citers = index.get(key);
      if (!citers) index.set(key, citers = new Set());
      citers.add(candidate);
    };
    wiki.each((tiddler, candidate) => {
      if (mode !== "tagged") {
        const text = tiddler.fields.text;
        if (typeof text === "string") for (const ref of references(text)) {
          add(ref, candidate);
          add(ref.split("#", 1)[0]!, candidate);
        }
      }
      if (mode === "tagged" || mode === "unreached") {
        const tags = tiddler.fields.tags;
        if (Array.isArray(tags)) for (const tag of tags) if (typeof tag === "string") add(tag, candidate);
      }
    });
    for (const title of titles) {
      const citers = index.get(title);
      if (mode === "unreached") {
        if (!citers || [...citers].every((citer) => citer === title)) result.add(title);
      } else if (citers) for (const citer of citers) result.add(citer);
    }
  }
  return [...result];
}
export { larRefs as "lar-refs" };
