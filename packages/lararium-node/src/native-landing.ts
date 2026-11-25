/**
 * native-landing — the one record a NATIVE (non-memetic) carrier's disk bytes say, for a landing that takes the file whole.
 *
 * The projecting leg already reads a native carrier's congruence (`canonicalizeNativeCarrierText`, `@lararium/tw5`): TW5's
 * own deserializer over the body, the `.meta` sidecar merged over the result. This hands back that merged record instead
 * of its render, so the stand-off keeper lands a `.tid` or a file with its `.meta` as the hand's `lares shore keep-disk`
 * lands it (`standoff-drafts.ts`, `keepDisk`).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import type { Tw5Deserializer } from "@lararium/tw5";

/**
 * THE RECORD A NATIVE CARRIER'S DISK BYTES SAY, for a landing that takes the file whole (`lares shore keep-disk`, and the
 * keeper's own keep where the records fell behind their base): the same deserialize and `.meta` merge
 * `canonicalizeNativeCarrierText` reads, handed back as the one record instead of its render. A bundle, a member titled
 * for another carrier, or a parse that throws lands nothing and says why.
 */
export function nativeCarrierLanding(
  deserializer: Tw5Deserializer,
  uri: string,
  ext: string,
  diskBody: string,
  diskMeta: string | undefined,
): { readonly records: ReadonlyArray<Readonly<Record<string, unknown>>> } | { readonly why: string } {
  try {
    const metaFields = diskMeta ? { ...deserializer.parseFields(diskMeta) } : {};
    delete (metaFields as Record<string, unknown>)["title"];
    const fieldsList = deserializer.deserialize(ext || "text/plain", diskBody, {});
    if (fieldsList.length !== 1) return { why: `the file holds ${fieldsList.length} tiddlers (a pack settles member by member, through \`lares ingest\`)` };
    const merged: Record<string, unknown> = { ...fieldsList[0], ...metaFields };
    const ownTitle = typeof merged["title"] === "string" && merged["title"] ? (merged["title"] as string) : uri;
    if (ownTitle !== uri) return { why: `the file names ${ownTitle}, another carrier than ${uri}` };
    merged["title"] = ownTitle;
    return { records: [merged] };
  } catch (err) {
    return { why: `the file's bytes do not parse as ${ext || "text"}: ${err instanceof Error ? err.message : String(err)}` };
  }
}
