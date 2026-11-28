/** Orphan record serialization and siting. Heleuma ha: see lararium/mesh/disk-projector-orphan-files. */

/** The host's stamps and the edit buffer's base: fields that never reach a file. */
const ORPHAN_FILE_DENY = new Set(["text", "$origin-bag", "revision", "draft.base.bag", "draft.base.heads"]);

/**
 * AN ORPHAN'S FILE: the record as a plain TiddlyWiki `.tid` (header fields, a blank line, the text), the
 * title first and the rest in name order. A `.tid` header holds one line per field, so a record carrying a
 * field with a newline rides as a one-record `.json` array instead. Either reads back through TiddlyWiki's
 * own deserializer as a plain record under its own title, never as a family.
 */
export function orphanRecordFile(fields: Record<string, string>): { readonly ext: ".tid" | ".json"; readonly body: string } {
  const names = Object.keys(fields).filter((name) => !ORPHAN_FILE_DENY.has(name) && name !== "title").sort();
  if (names.some((name) => /[\r\n]/.test(fields[name]!) || name.includes(":"))) {
    const record: Record<string, string> = { title: fields["title"] ?? "" };
    for (const name of names) record[name] = fields[name]!;
    record["text"] = fields["text"] ?? "";
    return { ext: ".json", body: JSON.stringify([record], null, 2) + "\n" };
  }
  const header = [`title: ${fields["title"] ?? ""}`, ...names.map((name) => `${name}: ${fields[name]}`)].join("\n");
  return { ext: ".tid", body: `${header}\n\n${fields["text"] ?? ""}` };
}

/** The path an orphan takes inside its root's orphan folder: its slot path, one directory per segment. */
export function orphanRelPath(root: string, title: string): string {
  const slot = title.slice(root.length).replace(/^#\/?/, "");
  const safe = slot.split("/").map((segment) => segment.replace(/[^\w$.āēīōūʻ-]/g, "_")).filter((segment) => segment !== "" && segment !== "." && segment !== "..");
  return safe.length > 0 ? safe.join("/") : "_";
}

