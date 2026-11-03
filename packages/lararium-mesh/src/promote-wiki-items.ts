import { parseAutomergeUrl, type AutomergeUrl, type Repo } from "@automerge/automerge-repo";
import { tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry, plainEntries } from "./stored-value.js";
import { wikiBagUri, wikiSlotUri } from "./wiki-recipe.js";
import { findOrThrow } from "./find-or-throw.js";
import { promoteDigest } from "./promote.js";
import type { PromoteItem } from "./promote-door.js";

/** Read a wiki's promotion candidates through its catalog pointers. */
export function promoteWikiItems(opts: { repo: Repo; catalog: () => LarDoc | null | undefined }): (wiki: string) => Promise<PromoteItem[]> {
  return async wiki => {
    const catalog = opts.catalog();
    const items = new Map<string, PromoteItem>();
    for (const bag of [wikiBagUri(wiki), wikiSlotUri(wiki, "working"), wikiSlotUri(wiki, "draft")]) {
      const url = tiddlerText(ownEntry(catalog?.tiddlers, bag));
      if (!url) continue;
      try {
        parseAutomergeUrl(url as AutomergeUrl);
        const handle = await findOrThrow(opts.repo, url, bag);
        for (const [title, record] of plainEntries(handle.doc()?.tiddlers)) {
          if (items.has(title)) continue;
          const fields = Object.fromEntries(Object.entries(record.tiddler).filter(([key, value]) => key !== "title" && key !== "text" && typeof value === "string")) as Record<string, string>;
          const item = { title, text: typeof record.tiddler.text === "string" ? record.tiddler.text : "", fields };
          items.set(title, { ...item, revision: promoteDigest(item), origin: { seat: "", device: "", session: "" } });
        }
      } catch { /* A missing or malformed pointer contributes no items. */ }
    }
    return [...items.values()];
  };
}
