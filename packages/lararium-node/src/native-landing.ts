/**
 * native-landing — the one record a NATIVE (non-memetic) carrier's disk bytes say, for a landing that takes the file whole.
 *
 * The projecting leg already reads a native carrier's congruence (`canonicalizeNativeCarrierText`, `@lararium/tw5`): TW5's
 * own deserializer over the body, the `.meta` sidecar merged over the result. This hands back that merged record instead
 * of its render, so the capture door lands a `.tid` or a file with its `.meta` as a hand moved it (`disk-capture.ts`).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection#/write-ward
 */

import type { Tw5Deserializer } from "@lararium/tw5";

/**
 * THE RECORD A NATIVE CARRIER'S DISK BYTES SAY, for a landing that takes the file whole (the capture door's, where only the
 * disk moved or the records fell behind their base): the same deserialize and `.meta` merge
 * `canonicalizeNativeCarrierText` reads, handed back as the one record instead of its render. A bundle, a member titled
 * for another carrier, a record that would act (`executableField`, weighed over the `.meta` and over the merged record), or a
 * parse that throws lands nothing and says why.
 */
export function nativeCarrierLanding(
  deserializer: Tw5Deserializer,
  uri: string,
  ext: string,
  diskBody: string,
  diskMeta: string | undefined,
): { readonly records: ReadonlyArray<Readonly<Record<string, unknown>>> } | { readonly why: string } {
  // THE NFC SHORE (memetic-wikitext-framing#carrier-bytes), as INGEST's scan reads it: text outside NFC never enters.
  if (diskBody !== diskBody.normalize("NFC") || (diskMeta !== undefined && diskMeta !== diskMeta.normalize("NFC"))) {
    return { why: "non-nfc: the file holds text outside NFC, and nothing lands" };
  }
  try {
    const metaFields = diskMeta ? { ...deserializer.parseFields(diskMeta) } : {};
    delete (metaFields as Record<string, unknown>)["title"];
    const code = executableField(metaFields);
    if (code !== null) return { why: `meta-executable: the .meta names ${code}, which a keep with no hand never lands; \`lares ingest\` weighs it by name` };
    const fieldsList = deserializer.deserialize(ext || "text/plain", diskBody, {});
    if (fieldsList.length !== 1) return { why: `the file holds ${fieldsList.length} tiddlers (a pack settles member by member, through \`lares ingest\`)` };
    const merged: Record<string, unknown> = { ...fieldsList[0], ...metaFields };
    // THE RECORD THAT WOULD LAND GETS WEIGHED WHOLE: a `.tid` states its fields in its own header, with no `.meta` beside it.
    const acts = executableField(merged);
    if (acts !== null) return { why: `carrier-executable: the file's own fields name ${acts}, which a keep with no hand never lands; \`lares ingest\` weighs it by name` };
    const ownTitle = typeof merged["title"] === "string" && merged["title"] ? (merged["title"] as string) : uri;
    if (ownTitle !== uri) return { why: `the file names ${ownTitle}, another carrier than ${uri}` };
    merged["title"] = ownTitle;
    return { records: [merged] };
  } catch (err) {
    return { why: `the file's bytes do not parse as ${ext || "text"}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** The tags under which TW5 runs a record's words as an act (`$:/tags/StartupAction` and kin), each with the tags beneath it. */
const ACTING_TAGS = ["$:/tags/StartupAction", "$:/tags/RawMarkup", "$:/tags/RawMarkupWikified"];

/**
 * THE FIELD THAT MAKES A RECORD ACT, in a `.meta` or in the record a file's own header states, or null: a `module-type` or a `plugin-type` (code the engine evaluates), a
 * JavaScript `type`, or a tag under which TW5 runs the record's words. A keep with no hand lands none of these.
 */
export function executableField(fields: Readonly<Record<string, unknown>>): string | null {
  if (fields["module-type"] !== undefined) return "module-type";
  if (fields["plugin-type"] !== undefined) return "plugin-type";
  if (typeof fields["type"] === "string" && /javascript/i.test(fields["type"] as string)) return `type ${String(fields["type"])}`;
  const tags = fields["tags"];
  const list = Array.isArray(tags) ? tags.map(String) : typeof tags === "string" ? (tags.match(/\[\[[^\]]*\]\]|\S+/g) ?? []).map((t) => t.replace(/^\[\[|\]\]$/g, "")) : [];
  const acting = list.find((tag) => ACTING_TAGS.some((root) => tag === root || tag.startsWith(`${root}/`)));
  return acting !== undefined ? `the tag ${acting}` : null;
}
