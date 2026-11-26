/**
 * home-wiki — a face's HOME PREFERENCE, the one wiki that face lands on when it lights.
 *
 * The preference is a record the FACE writes in its own daemon wiki's working layer (the shape `$:/config/lares/law/pins`
 * models): a filter whose first title names the home wiki's slug. It rests where only that face reads it, so the vessel
 * chooses nothing on a wearer's behalf (research/pin-mu#S2). No record, a blank one, or a filter naming no title reads as
 * the floor. A boot reads no `bags/daemon/active-wiki` marker: every boot stands on the floor, and the lit face's record
 * selects its wiki at light.
 *
 * Pure: a record in, a slug or the floor out. The skins reach this module; the vessels wire the light read.
 */
import { tiddlerText } from "@lararium/mesh/base-doc";
import type { LarTiddlerRecord } from "@lararium/mesh/tiddler-store";
import type { StoredLarRecord } from "@lararium/mesh/stored-value";

export const HOME_WIKI_TITLE = "$:/config/lares/home/wiki";

/** The record a face holds before it names a home: an empty filter, which reads as the floor. */
export const HOME_WIKI_DEFAULT = "";

export type HomeWikiSelectionSource = "boot-arg" | "home-preference";

/** The filter text naming `slug` as a face's home wiki: `[[slug]]`. */
export function homeWikiFilter(slug: string): string {
  return `[[${slug}]]`;
}

/** The home slug a preference record names (`[[slug]]` or a bare slug), or null where it names none (the floor). */
export function readHomeWikiSlug(record: StoredLarRecord | Pick<LarTiddlerRecord, "tiddler"> | null | undefined): string | null {
  const text = tiddlerText(record);
  if (typeof text !== "string") return null;
  const t = text.trim();
  const bracketed = /^\[\[([^\[\]\s]+)\]\]/.exec(t);
  if (bracketed) return bracketed[1]!;
  const bare = /^[^\s\[\]{}<>]+/.exec(t);
  return bare ? bare[0] : null;
}

/** The boot's wiki: the lit face's home preference where it names one, else the boot's own ask (the floor's wiki). */
export function selectHomeWikiSlug(
  fallbackSlug: string,
  record: StoredLarRecord | Pick<LarTiddlerRecord, "tiddler"> | null | undefined,
): { slug: string; source: HomeWikiSelectionSource } {
  const selected = readHomeWikiSlug(record);
  return selected ? { slug: selected, source: "home-preference" } : { slug: fallbackSlug, source: "boot-arg" };
}
