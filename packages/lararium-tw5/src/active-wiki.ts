import {
  DAEMON_BAG_ID,
  tiddlerText,
  type LarTiddlerRecord,
  type StoredLarRecord,
} from "@lararium/mesh";

export const ACTIVE_WIKI_URI = `${DAEMON_BAG_ID}/active-wiki`;

export type ActiveWikiSelectionSource = "boot-arg" | "daemon-marker";

/** The marker's slug, read off a plain record or straight off the daemon document's own. */
export function readActiveWikiSlug(record: StoredLarRecord | Pick<LarTiddlerRecord, "tiddler"> | null | undefined): string | null {
  const text = tiddlerText(record);
  if (typeof text !== "string") return null;
  const slug = text.trim();
  return slug.length > 0 ? slug : null;
}

export function selectActiveWikiSlug(
  fallbackSlug: string,
  record: StoredLarRecord | Pick<LarTiddlerRecord, "tiddler"> | null | undefined,
): { slug: string; source: ActiveWikiSelectionSource } {
  const selected = readActiveWikiSlug(record);
  return selected
    ? { slug: selected, source: "daemon-marker" }
    : { slug: fallbackSlug, source: "boot-arg" };
}

export function buildActiveWikiRecord(
  slug: string,
  authority: string,
  updatedAt = new Date().toISOString(),
): LarTiddlerRecord {
  return {
    tiddler: {
      title: ACTIVE_WIKI_URI,
      text: slug,
      "updated-at": updatedAt,
    },
    meta: { authority },
  };
}
