/*\
title: lar:///ha.ka.ba/lararium/tw5/modules/draft-compare
type: application/javascript
module-type: startup
\*/
/**
 * draft-compare — a draft reads modified by what it SAYS, never by where it landed from.
 *
 * TiddlyWiki's `isDraftModified` compares a draft with its target field by field, less the five fields a
 * draft always differs in. A landed tiddler also carries the envelope stamp of the bag it landed from, and
 * a draft lands from the draft layer while its target lands from another, so the stock comparison reads
 * every landed draft as modified and Cancel asks to confirm an untouched one. This module installs the
 * same comparison with the envelope fields (`ENVELOPE_FIELDS`, the one spelling) joined to the ignored
 * list; every other answer matches TiddlyWiki's own.
 */
import { ENVELOPE_FIELDS } from "../envelope-fields.js";

export const name = "lar-draft-compare";
export const synchronous = true;
export const before = ["startup"];

interface DraftTiddler {
  fields: Record<string, unknown>;
  isDraft(): boolean;
  isEqual(other: unknown, exclude?: string[]): boolean;
}
interface DraftWiki { getTiddler(title: string): DraftTiddler | undefined }
interface DraftHost {
  Wiki: { prototype: { isDraftModified?: (this: DraftWiki, title: string) => boolean } };
  Tiddler: new (fields: Record<string, unknown>) => DraftTiddler;
}

declare const $tw: DraftHost;

function isDraftModified(this: DraftWiki, title: string): boolean {
  const draft = this.getTiddler(title);
  if (!draft || !draft.isDraft()) return false;
  const target = this.getTiddler(String(draft.fields["draft.of"])) ?? new $tw.Tiddler({ text: "", tags: [] });
  const ignored = ["created", "modified", "title", "draft.title", "draft.of", ...ENVELOPE_FIELDS];
  return draft.fields["draft.title"] !== draft.fields["draft.of"] || !draft.isEqual(target, ignored);
}

export function startup(): void {
  $tw.Wiki.prototype.isDraftModified = isDraftModified;
}
