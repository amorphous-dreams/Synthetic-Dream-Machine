/**
 * keep-list — a face's KEEP LIST, the wikis that face keeps warm while it stands lit.
 *
 * The list is a record the FACE writes in its own daemon wiki's working layer (the shape `$:/config/lares/home/wiki` and
 * `$:/config/lares/law/pins` model): a filter whose titles name wiki slugs. It rests where only that face reads it. The vessel
 * holds one keep-warm cap over every face's list and refuses by name when the cap stands full; it never drops one face's
 * keep to seat another's (research/pin-mu#S3). A lit face reads its list at light and keeps each wiki the cap grants.
 *
 * Pure: a record in, slugs out; slugs in, a filter text out. The vessels wire the light read and the write.
 */
import { tiddlerText } from "@lararium/mesh/base-doc";
import type { LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import type { StoredLarRecord } from "@lararium/mesh/stored-value";

export const KEEP_LIST_TITLE = "$:/config/lares/keep";

/** The filter text naming `slugs`, one `[[slug]]` each, in order; blank where the face keeps none. */
export function keepListFilter(slugs: readonly string[]): string {
  return slugs.map((slug) => `[[${slug}]]`).join(" ");
}

/** The slugs a keep-list record names, first-named first, each once; empty where the record names none. */
export function readKeepList(record: StoredLarRecord | Pick<LarTiddlerRecord, "tiddler"> | null | undefined): readonly string[] {
  const text = tiddlerText(record);
  if (typeof text !== "string") return [];
  const seen = new Set<string>();
  for (const m of text.matchAll(/\[\[([^\[\]\s]+)\]\]|(?:^|\s)([^\s\[\]{}<>]+)(?=\s|$)/g)) seen.add(m[1] ?? m[2]!);
  return [...seen];
}

/** The slugs after `slug` joins the list (a no-op where it stands), or leaves it. */
export function keepListWith(slugs: readonly string[], slug: string): readonly string[] {
  return slugs.includes(slug) ? slugs : [...slugs, slug];
}
export function keepListWithout(slugs: readonly string[], slug: string): readonly string[] {
  return slugs.filter((s) => s !== slug);
}
