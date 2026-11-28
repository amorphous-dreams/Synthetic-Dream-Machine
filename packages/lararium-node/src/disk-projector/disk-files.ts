/** Carrier file discovery and title reading. Heleuma ha: see lararium/mesh/disk-projector-disk-files. */

import { existsSync, readFileSync, readdirSync } from "fs";
import { basename, dirname } from "path";
import { KAPAE_EXT } from "../kapae-shadow.js";
import { ORPHAN_FOLDER_SUFFIX } from "@lararium/mesh/family";

/** Escape a filename stem for a literal match inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a carrier's ACTUAL on-disk files from its confined absolute base
 * (extension-less). A carrier owns exactly one content file at `<stem><ext>`
 * plus an optional `<stem><ext>.meta` sidecar — the extension varies by filetype
 * (the ruling), so the deletion/unlink side cannot assume `.mem`. The match binds
 * the WHOLE stem then a single extension segment (+ optional `.meta`), so a
 * sibling carrier whose stem merely shares a prefix never gets swept. Returns
 * absolute paths; a missing directory reads as no files.
 */
export function carrierDiskFiles(absBase: string): string[] {
  const dir  = dirname(absBase);
  const stem = basename(absBase);
  const re   = new RegExp(`^${escapeRegExp(stem)}\\.[^.]+(?:\\.meta)?$`);
  // A kāpae shadow (`<stem>.kapae`) stands where a carrier left; it never counts as the carrier's home.
  const shadow = `${stem}${KAPAE_EXT}`;
  // The orphan folder (`<stem>.orphans/`) holds the slots a dead root left; it never counts as the carrier's home either.
  const orphans = `${stem}${ORPHAN_FOLDER_SUFFIX}`;
  try {
    return readdirSync(dir).filter((n) => re.test(n) && n !== shadow && n !== orphans).map((n) => `${dir}/${n}`);
  } catch { return []; }
}

/**
 * The `title:` a TW5 field block names. Reads the block the way TW5's own `.tid` parser does —
 * `name: value` lines until the first blank line — and stops at the first line that is not one.
 */
function fieldBlockTitle(text: string): string | undefined {
  for (const line of text.split("\n")) {
    if (line.trim() === "") break;
    const m = /^([^:\s]+)\s*:\s*(.*)$/.exec(line);
    if (!m) break;
    if (m[1] === "title") return m[2]!.trim();
  }
  return undefined;
}

/**
 * WHO OWNS a candidate path — read FROM DISK ALONE, no registry, no memory.
 *
 * The projector reconciles statelessly per carrier root through the keyed queue, so it holds nothing like
 * TW5's `$tw.boot.files` title→path map. Its uniquifier's free-path test must therefore read
 * "absent OR ALREADY MINE" — a plain `existsSync` test would write `title.tid` on the first boot
 * and `title_1.tid` on the second, growing one file per boot, which clobbers worse than the
 * collision it prevents.
 *
 * MINE is provable because every native projection writes its own title: a `.tid` body opens with
 * the field block (`getFieldStringBlock` excludes only `text` and the unpersisted stamps), a
 * `.json` file carries the field object, and a content filetype's `.meta` sidecar carries the
 * fields whole. Returns:
 *   a title  — the file at this path projects that title
 *   null     — no file sits there (free)
 *   undefined— a file sits there and its format proves nothing (a flattened `.mem`, a body whose
 *              sidecar has gone). The caller must neither clobber it nor grow past it.
 */
export function projectedFileTitle(contentPath: string, ext: string, hasMeta: boolean): string | null | undefined {
  const metaPath = `${contentPath}.meta`;
  try {
    if (hasMeta) {
      if (existsSync(metaPath)) return fieldBlockTitle(readFileSync(metaPath, "utf-8"));
      return existsSync(contentPath) ? undefined : null;
    }
    if (!existsSync(contentPath)) return existsSync(metaPath) ? undefined : null;
    if (ext === ".tid") return fieldBlockTitle(readFileSync(contentPath, "utf-8"));
    if (ext === ".json") {
      const parsed: unknown = JSON.parse(readFileSync(contentPath, "utf-8"));
      const first = Array.isArray(parsed) ? (parsed[0] as unknown) : parsed;
      const t = (first as { title?: unknown } | null | undefined)?.title;
      return typeof t === "string" ? t : undefined;
    }
    return undefined;
  } catch { return undefined; }
}

