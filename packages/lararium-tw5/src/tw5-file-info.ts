/**
 * tw5-file-info — the native-tiddler PROJECTION cascade, ported PURE and run
 * inside the island VM (the reciprocal of `Tw5Deserializer`, which runs LOAD's
 * deserialize). TW5's `core-server/filesystem.js` lives Node-only and is ABSENT
 * from the island's browser core blob — but every primitive the PURE path-cascade
 * needs IS present in-VM (`$tw.wiki.filterTiddlers`, `makeTiddlerIterator`,
 * `$tw.config.contentTypeInfo`, `getFileExtensionInfo`, `getTypeEncoding`,
 * `transliterate`, and `$tw.Tiddler`'s own field serializers). So we port the
 * pure control flow of `generateTiddlerFileInfo` + `generateTiddlerFilepath`
 * (filesystem.js:213-381) and DELEGATE field/byte serialization to `$tw.Tiddler`
 * — byte-identical to TW5's `saveTiddlerToFileSync` (filesystem.js:459-475).
 *
 * VM-authority: the path, the type-selection, and the exact bytes are all decided
 * HERE, in the VM. The Node disk-projector only resolves under the bag mirror root,
 * confines the path, and writes the bytes — it is never the authority.
 *
 * NOT ported (Node-only, the projector's job): the `fs.existsSync` uniquifier and
 * the `$tw.boot`/`th-make-tiddler-path` write-path encoding (filesystem.js:382-408).
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-file-info
 */

import type { TW5Instance } from "./types/tiddlywiki.js";

/** The native file info the projector writes: a relative path + the exact bytes. */
export interface Tw5FileInfo {
  /** Path relative to the wiki's tiddlers root (forward slashes), extension included — what the stock
   *  filesystem adaptor would site under `tiddlers/`. */
  readonly relPath: string;
  /** True when a `$:/config/FileSystemPaths` rule named the path; false when TW5's flattened-title
   *  default did. The projector honours a ruled path and otherwise sites by the loci law. */
  readonly pathRuled: boolean;
  /** The chosen extension (".tid" / ".json" / a content-type extension). */
  readonly ext: string;
  /** The FILE type (not the tiddler type): application/x-tiddler | application/json | a content-type. */
  readonly type: string;
  /** The file type's byte encoding — "utf8" for text, "base64" for a binary type
   *  (image/PDF). The projector decodes a "base64" body to raw bytes before it
   *  writes, so an image lands as its real bytes, not its base64 text. */
  readonly encoding: string;
  /** True when a companion `<relPath>.meta` sidecar carries the fields. */
  readonly hasMetaFile: boolean;
  /** Bytes for the main file (a "base64" encoding carries base64 text here). */
  readonly body: string;
  /** Bytes for the `.meta` sidecar, present only when hasMetaFile. */
  readonly metaBody?: string;
}

export interface Tw5FileInfoOptions {
  /** Filter cascade for the base path (the lar-native mirror of $:/config/FileSystemPaths). */
  readonly pathFilters?: readonly string[];
  /** Filter cascade for the extension override ($:/config/FileSystemExtensions). */
  readonly extFilters?: readonly string[];
}

/**
 * Fields that never reach disk: `bag` (a runtime residency stamp on a record) and `$origin-bag`
 * (the nalu engine's envelope stamp on the wiki tiddler — the projector routes by it, the outbound
 * save strips it, no persisted field names a bag). A stock server never holds either, so a sidecar
 * carrying one is a file the two doors disagree about.
 */
const UNPERSISTED_FIELDS = ["bag", "$origin-bag"] as const;

/** The two siting cascades TiddlyWiki's filesystem adaptor reads (filesystemadaptor.js:59-65). */
export const FILE_SYSTEM_PATHS_CONFIG      = "$:/config/FileSystemPaths";
export const FILE_SYSTEM_EXTENSIONS_CONFIG = "$:/config/FileSystemExtensions";

/**
 * Read the siting cascades EXACTLY as the stock filesystem adaptor reads them: a REAL tiddler only
 * (`tiddlerExists` sees no shadow), its text split on newlines. One spelling for both doors — a
 * `$:/config/FileSystemPaths` an operator writes into a folder wiki sites the same file there and in
 * an island's mirror. The house carries no `lar:` twin of these tiddlers: a second spelling honoured
 * by one door only would be the disagreement this exists to refuse.
 */
export function readSitingCascades($tw: TW5Instance): Tw5FileInfoOptions {
  const wiki = $tw.wiki;
  const read = (title: string): readonly string[] | undefined =>
    wiki.tiddlerExists(title) ? (wiki.getTiddlerText(title, "") ?? "").split("\n") : undefined;
  const pathFilters = read(FILE_SYSTEM_PATHS_CONFIG);
  const extFilters  = read(FILE_SYSTEM_EXTENSIONS_CONFIG);
  return { ...(pathFilters ? { pathFilters } : {}), ...(extFilters ? { extFilters } : {}) };
}

/** The path a `$:/config/FileSystemPaths` rule names for a title, extension-less; undefined when no rule reaches it. */
export function ruledBasePath($tw: TW5Instance, title: string, opts: Tw5FileInfoOptions): string | undefined {
  const ruled = firstFilterResult($tw, title, opts.pathFilters);
  return ruled === undefined ? undefined : normalizePosix(sanitizeFilepath($tw, ruled));
}

/** Run a filter cascade over a single tiddler title; the first non-empty result wins. */
function firstFilterResult($tw: TW5Instance, title: string, filters: readonly string[] | undefined): string | undefined {
  if (!filters || filters.length === 0) return undefined;
  for (const filter of filters) {
    if (!filter) continue;
    const source = $tw.wiki.makeTiddlerIterator([title]);
    const result = $tw.wiki.filterTiddlers(filter, undefined, source);
    if (result.length > 0) return result[0];
  }
  return undefined;
}

/**
 * Port of generateTiddlerFilepath's PURE sanitization (filesystem.js:352-381), step for step: leading
 * spaces, leading dots, control codes, cross-platform-illegal characters (the backslash among them)
 * then transliteration, and — per segment, AFTER transliteration can mint one — the Windows reserved
 * device names and trailing dots or spaces. The fork is the oracle (`tw5-file-info-parity.test.ts`
 * loads it and compares); a step that drifts from it sites a file the stock adaptor would not.
 */
function sanitizeFilepath($tw: TW5Instance, base: string): string {
  let filepath = base;
  // Leading spaces → underscores
  filepath = filepath.replace(/^ +/, (u) => u.replace(/ /g, "_"));
  // Don't let the filename start with dots (invisible on *nix)
  if (!/^\.{1,2}[/\\]/g.test(filepath)) {
    filepath = filepath.replace(/^\.+/g, (u) => u.replace(/\./g, "_"));
  }
  // Unicode control codes
  filepath = filepath.replace(/[\x00-\x1f\x80-\x9f]/g, "_");
  // Cross-platform-illegal chars, then transliterate
  filepath = $tw.utils.transliterate(filepath.replace(/<|>|~|:|"|\||\?|\*|\^|\\/g, "_"));
  // Per segment: reserved device names, then trailing dots or spaces
  filepath = filepath.split("/").map((segment) => {
    if (segment === "" || segment === "." || segment === "..") return segment;
    segment = segment.replace(/^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i, "_$1_");
    return segment.replace(/[. ]+$/, (u) => u.replace(/[. ]/g, "_"));
  }).join("/");
  return filepath;
}

/** POSIX path normalization (the pure half of `path.resolve`): collapse `//`, drop `.`, fold `..`. */
function normalizePosix(p: string): string {
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      // A leading `..` stays (the disk ward refuses it loudly); an interior one folds its parent.
      if (out.length === 0 || out[out.length - 1] === "..") out.push(seg); else out.pop();
      continue;
    }
    out.push(seg);
  }
  return out.join("/");
}

/**
 * Compute the native file info for a tiddler — path (via the filter cascade),
 * type-selection (.tid / content+.meta / .json), and the exact bytes. Pure on
 * `$tw`; no `fs`, no Node imports. The `relPath` is mirror-root-relative; the
 * projector resolves + confines it.
 */
export function makeTw5FileInfo(
  $tw: TW5Instance,
  title: string,
  fields: Record<string, unknown>,
  opts: Tw5FileInfoOptions = {},
): Tw5FileInfo {
  const tiddler = new $tw.Tiddler(fields as Record<string, string>);

  // ── Type selection (filesystem.js:213-270) ──────────────────────────────
  let fileType: string;
  let hasMetaFile: boolean;
  // Unsafe fields → JSON (control chars, leading/trailing ws, or ':'/'#' in a name)
  let hasUnsafeFields = false;
  const fieldStrings = tiddler.getFieldStrings() as Record<string, string>;
  for (const fieldName of Object.keys(fieldStrings)) {
    const value = fieldStrings[fieldName]!;
    if (fieldName !== "text") {
      hasUnsafeFields = hasUnsafeFields || /[\x00-\x1F]/m.test(value);
      hasUnsafeFields = hasUnsafeFields || $tw.utils.trim(value) !== value;
    }
    hasUnsafeFields = hasUnsafeFields || /:|#/m.test(fieldName);
  }
  let extOverride: string | undefined;
  if (hasUnsafeFields) {
    fileType = "application/json";
    hasMetaFile = false;
  } else {
    const tiddlerType = (fields["type"] as string) || "text/vnd.tiddlywiki";
    if (tiddlerType === "text/vnd.tiddlywiki" || tiddlerType === "text/vnd.tiddlywiki-multiple" || tiddler.hasField("_canonical_uri")) {
      fileType = "application/x-tiddler"; // .tid
      hasMetaFile = false;
    } else {
      fileType = tiddlerType; // content file + .meta sidecar
      hasMetaFile = true;
    }
    // Extension-override cascade
    extOverride = firstFilterResult($tw, title, opts.extFilters);
    if (extOverride) {
      if (extOverride === ".tid") { fileType = "application/x-tiddler"; hasMetaFile = false; }
      else if (extOverride === ".json") { fileType = "application/json"; hasMetaFile = false; }
      else {
        const extInfo = $tw.utils.getFileExtensionInfo(extOverride);
        fileType = extInfo ? extInfo.type : fileType;
        hasMetaFile = true;
      }
    }
  }
  const contentTypeInfo = $tw.config.contentTypeInfo[fileType] || { extension: "" };
  const extRaw = extOverride || contentTypeInfo.extension || "";
  const ext: string = Array.isArray(extRaw) ? (extRaw[0] ?? "") : extRaw;
  // The FILE type's byte encoding — a binary type (image/PDF) reads "base64";
  // the projector decodes the base64 body to raw bytes before it writes.
  const encoding: string = (contentTypeInfo as { encoding?: string }).encoding === "base64" ? "base64" : "utf8";

  // ── Path (filesystem.js:317-381, PURE part) ─────────────────────────────
  const ruled = firstFilterResult($tw, title, opts.pathFilters);
  const pathRuled = ruled !== undefined;
  const base = ruled ?? title.replace(/\/|\\/g, "_"); // no path separators → no stray dirs
  let filepath = sanitizeFilepath($tw, base);
  // Trailing dots or spaces on the extension → underscores; a long extension truncates
  let extSafe = ext.replace(/[. ]+$/, (u) => u.replace(/[. ]/g, "_"));
  if (extSafe.length > 32) extSafe = extSafe.substr(0, 32);
  // Drop a trailing copy of the extension, then truncate
  if (filepath.substring(filepath.length - extSafe.length) === extSafe) {
    filepath = filepath.substring(0, filepath.length - extSafe.length);
  }
  if (filepath.length > 200) filepath = filepath.substr(0, 200);
  if (!filepath || /^_+$/g.test(filepath)) {
    // All-punctuation title → char codes (filesystem.js:371-381)
    filepath = title.split("").map((c) => c.charCodeAt(0).toString()).join("-");
  }
  // The fork resolves the finished path with `path.resolve`, which collapses repeated separators and
  // `.`/`..` segments; the same normalization here, pure, so a rule emitting `x//y` sites `x/y` on both.
  const relPath = normalizePosix(filepath + extSafe);

  // ── Bytes — delegate to $tw.Tiddler (byte-identical to saveTiddlerToFileSync) ──
  let body: string;
  let metaBody: string | undefined;
  if (hasMetaFile) {
    body = String(fields["text"] ?? "");
    metaBody = tiddler.getFieldStringBlock({ exclude: ["text", ...UNPERSISTED_FIELDS] });
  } else if (fileType === "application/x-tiddler") {
    const block = tiddler.getFieldStringBlock({ exclude: ["text", ...UNPERSISTED_FIELDS] });
    const text = fields["text"] ? "\n\n" + String(fields["text"]) : "";
    body = block + text;
  } else {
    // application/json
    const jsonSpaces = $tw.config.preferences?.jsonSpaces ?? 4;
    body = JSON.stringify([tiddler.getFieldStrings({ exclude: [...UNPERSISTED_FIELDS] })], null, jsonSpaces);
  }

  return { relPath, pathRuled, ext: extSafe, type: fileType, encoding, hasMetaFile, body, ...(metaBody !== undefined ? { metaBody } : {}) };
}
