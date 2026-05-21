import type { TW5Wiki } from "../types/tiddlywiki.js";

export function isLarTitle(title: string): boolean {
  return title.startsWith("lar:");
}

export function allLarTitles(wiki: TW5Wiki): string[] {
  const results: string[] = [];
  wiki.each(function (_tiddler, title: string) {
    if (isLarTitle(title)) results.push(title);
  });
  return results;
}
