/**
 * content-handle — the whole-carrier skinny handle (content-resolution.mem Scenario B).
 *
 * THE BLOB LAW (blob-carriage.mem #/proposed-law, RULED 2026-09-11): a tiddler's `type` DECIDES
 * its carriage; size DECIDES only the fault line.
 *
 *   1. KIND picks the shape. A body whose `type` registers `encoding: "base64"` in TW5's own
 *      file-type registry — or carries the registry's `image` flag (a picture the wiki shows;
 *      `image/svg+xml` rides here, and an author who wants an inline editable SVG declares
 *      `text/xml`) — MUST ride as a POINTER: the bytes rest in the `cid/` tier, the tiddler in
 *      the CRDT carries the reference and NO `text`. A utf8 body MUST ride INLINE.
 *   2. SIZE stays a wall. A utf8 body past `SKINNY_CARRIER_THRESHOLD` faults at the island —
 *      never a switch that skins it. No size floor reads on a binary.
 *   3. ONE override. `_lar_cas: yes` (the operator's flag) pushes a text body to the `cid/`
 *      tier on purpose (Scenario A's `#source-text` case); nothing else elects a pointer.
 *   4. The CID hashes the RAW bytes (the gesture decodes a base64 carrier before it hashes), so
 *      `_integrity` verifies the file on disk and a foreign verifier agrees.
 *   5. The pointer for a base64 family carries NO `lar:` `_canonical_uri` — TW5's image widget
 *      emits `_canonical_uri` as `src` before it lazy-loads, and `lar:` fetches nothing by law.
 *      A `text/*` pointer keeps the `lar:` cid URI (the lazy path reads it).
 *
 * A CRDT carries convergence and causal order well; it carries megabytes badly — a 16MB
 * scalar-string field OOMs automerge on sync-apply, and every peer that syncs the doc pays the
 * whole weight. The read-side `lazyLoad` resolver (TW5 `getTiddlerText` shore) rehydrates a
 * pointer on render.
 *
 * Publicity-plane addressing: the public plane (crossroads) rides a foreign-verifiable
 * `ni://` multihash (RFC-6920) — a stranger fetches AND verifies with no local context. The
 * private plane (catalog) rides a ciphertext cid; the plane sets the mode.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/content-resolution
 */

import { CARRIER_TYPE } from "./carrier-type.js";
import { cidUri, CROSSROADS_DOC_URI, CATALOG_DOC_URI } from "./lar-uris.js";
import { niUriSha256FromHex } from "./crypto.js";

/**
 * The utf8 FAULT wall. A utf8 body past it MUST leave the CRDT (the `_lar_cas` override) or the
 * ingest faults, never materializing as an automerge scalar-string. Set well UNDER the automerge
 * scalar-string OOM wall (~16MB, the #51/Stage-2 birth) and well ABOVE any normal carrier. The
 * wall is the ONE size the house reads; a binary never reads it (kind already picked its shape).
 */
export const SKINNY_CARRIER_THRESHOLD = 1024 * 1024; // 1 MiB

/** Is a utf8 carrier body (its byte length) past the fault wall? */
export function isOversizedBody(byteLength: number): boolean {
  return byteLength > SKINNY_CARRIER_THRESHOLD;
}

/** One row of TW5's file-type registry: the byte encoding, the extensions, and the `image` flag. */
export interface Tw5FileTypeRow {
  readonly encoding:   "utf8" | "utf16le" | "base64";
  readonly extensions: readonly string[];
  readonly image?:     true;
}

/**
 * TW5's own file-type registry, transcribed row for row from `boot.js` `registerFileType` (the
 * declaration the island's `$tw.config.contentTypeInfo` holds at runtime). The send side holds no
 * `$tw`, so the table stands here, pure; the mesh test `content-handle-blob-law` reads the fork's
 * `boot.js` and pins every row against it.
 */
export const TW5_FILE_TYPES: Readonly<Record<string, Tw5FileTypeRow>> = {
  "text/vnd.tiddlywiki":                { encoding: "utf8",    extensions: [".tid"] },
  "application/x-tiddler":              { encoding: "utf8",    extensions: [".tid"] },
  "application/x-tiddlers":             { encoding: "utf8",    extensions: [".multids"] },
  "application/x-tiddler-html-div":     { encoding: "utf8",    extensions: [".tiddler"] },
  "text/vnd.tiddlywiki2-recipe":        { encoding: "utf8",    extensions: [".recipe"] },
  "text/plain":                         { encoding: "utf8",    extensions: [".txt"] },
  "text/css":                           { encoding: "utf8",    extensions: [".css"] },
  "text/html":                          { encoding: "utf8",    extensions: [".html", ".htm"] },
  "application/hta":                    { encoding: "utf16le", extensions: [".hta"] },
  "application/javascript":             { encoding: "utf8",    extensions: [".js"] },
  "application/json":                   { encoding: "utf8",    extensions: [".json"] },
  "application/pdf":                    { encoding: "base64",  extensions: [".pdf"], image: true },
  "application/zip":                    { encoding: "base64",  extensions: [".zip"] },
  "application/x-zip-compressed":       { encoding: "base64",  extensions: [".zip"] },
  "image/jpeg":                         { encoding: "base64",  extensions: [".jpg", ".jpeg"], image: true },
  "image/jpg":                          { encoding: "base64",  extensions: [".jpg", ".jpeg"], image: true },
  "image/png":                          { encoding: "base64",  extensions: [".png"], image: true },
  "image/gif":                          { encoding: "base64",  extensions: [".gif"], image: true },
  "image/webp":                         { encoding: "base64",  extensions: [".webp"], image: true },
  "image/heic":                         { encoding: "base64",  extensions: [".heic"], image: true },
  "image/heif":                         { encoding: "base64",  extensions: [".heif"], image: true },
  "image/avif":                         { encoding: "base64",  extensions: [".avif"], image: true },
  "image/svg+xml":                      { encoding: "utf8",    extensions: [".svg"], image: true },
  "image/vnd.microsoft.icon":           { encoding: "base64",  extensions: [".ico"], image: true },
  "image/x-icon":                       { encoding: "base64",  extensions: [".ico"], image: true },
  "application/wasm":                   { encoding: "base64",  extensions: [".wasm"] },
  "font/woff":                          { encoding: "base64",  extensions: [".woff"] },
  "font/woff2":                         { encoding: "base64",  extensions: [".woff2"] },
  "font/ttf":                           { encoding: "base64",  extensions: [".ttf"] },
  "font/otf":                           { encoding: "base64",  extensions: [".otf"] },
  "audio/ogg":                          { encoding: "base64",  extensions: [".ogg"] },
  "audio/mp4":                          { encoding: "base64",  extensions: [".mp4", ".m4a"] },
  "video/ogg":                          { encoding: "base64",  extensions: [".ogm", ".ogv", ".ogg"] },
  "video/webm":                         { encoding: "base64",  extensions: [".webm"] },
  "video/mp4":                          { encoding: "base64",  extensions: [".mp4"] },
  "audio/mp3":                          { encoding: "base64",  extensions: [".mp3"] },
  "audio/mpeg":                         { encoding: "base64",  extensions: [".mp3", ".m2a", ".mp2", ".mpa", ".mpg", ".mpga"] },
  "text/markdown":                      { encoding: "utf8",    extensions: [".md", ".markdown"] },
  "text/x-markdown":                    { encoding: "utf8",    extensions: [".md", ".markdown"] },
  "application/enex+xml":               { encoding: "utf8",    extensions: [".enex"] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { encoding: "base64", extensions: [".docx"] },
  "application/msword":                 { encoding: "base64",  extensions: [".doc"] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { encoding: "base64", extensions: [".xlsx"] },
  "application/excel":                  { encoding: "base64",  extensions: [".xls"] },
  "application/vnd.ms-excel":           { encoding: "base64",  extensions: [".xls"] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { encoding: "base64", extensions: [".pptx"] },
  "application/mspowerpoint":           { encoding: "base64",  extensions: [".ppt"] },
  "text/x-bibtex":                      { encoding: "utf8",    extensions: [".bib"] },
  "application/x-bibtex":               { encoding: "utf8",    extensions: [".bib"] },
  "application/epub+zip":               { encoding: "base64",  extensions: [".epub"] },
  "application/octet-stream":           { encoding: "base64",  extensions: [".octet-stream"] },
};

/** Extension → the LAST type registering it, in registry order — `registerFileType` assigns
 *  `fileExtensionInfo[extension]` on every call (boot.js:553-563), so the later row owns the
 *  extension (`.md` → `text/x-markdown`, `.mp4` → `video/mp4`, `.ogg` → `video/ogg`). */
const EXT_TO_TYPE: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [type, row] of Object.entries(TW5_FILE_TYPES)) {
    for (const ext of row.extensions) m.set(ext, type);
  }
  return m;
})();

/**
 * Resolve a file extension to its TW5-registered media type — the send side's reading of the same
 * registry the island's `$tw.config.fileExtensionInfo` holds. `.mem` reads the carrier type. An
 * extension the registry lacks reads by byte-nature: a body that failed the utf8 round-trip rides
 * `application/octet-stream` (a pointer), a utf8-clean body rides `text/plain` (inline).
 */
export function mediaTypeFromExt(ext: string, binary = false): string {
  const e = ext.toLowerCase();
  if (e === ".mem") return CARRIER_TYPE;
  const registered = EXT_TO_TYPE.get(e);
  if (registered) return registered;
  return binary ? "application/octet-stream" : "text/plain";
}

/** The media families that read as a pointer even where the registry lacks the subtype. */
const POINTER_FAMILIES = ["image/", "audio/", "video/", "font/"] as const;

/**
 * THE BLOB LAW's one question: does a body of this `type` ride as a POINTER? Yes when TW5's registry
 * registers the type `base64` or flags it `image`; yes by family (`image/` · `audio/` · `video/` ·
 * `font/`) for a subtype the registry lacks; no for every utf8 type — a meme, a pack, markdown, a
 * `text/xml` SVG all inline. Size never enters.
 */
export function ridesAsPointer(mediaType: string): boolean {
  const row = TW5_FILE_TYPES[mediaType];
  if (row) return row.encoding === "base64" || row.image === true;
  return POINTER_FAMILIES.some((f) => mediaType.startsWith(f));
}

/**
 * Build a whole-carrier skinny handle tiddler — the POINTER. The bytes rest in the cid/ tier
 * (staged send-side, keyed by `cid` = hex sha256 of the RAW bytes); this record NEVER carries
 * the body. Fields:
 *   - `_is_skinny`     marks the lazyLoad boundary for the read-side resolver.
 *   - `_canonical_uri` the lar: content-address the lazy path reads — a `text/*` pointer ONLY.
 *                      A base64-family pointer omits it: TW5's image widget would emit it as a
 *                      dead `src` before the lazy branch fires (image.js:61-90).
 *   - `_integrity`     the RFC-6920 ni:// multihash — foreign-verifiable, algorithm-agile.
 *   - `textCid`        the CAS key the daemon `resolveByCid` reads (hex sha256).
 *   - `size`           the body's byte length (metadata; the body is elsewhere).
 *   - `type`           TW5's NATIVE content-type field (from the ext via `$tw.config.contentTypeInfo`)
 *                      — the handle self-describes its media dialect, so a rehydrated body renders
 *                      native (no `_lar_type` shadow field; `type` IS the TW5 slot).
 *   - `_source_ext`    the on-disk extension, so the read path recovers the projection filename.
 */
/**
 * The publicity tier of a cad body — the PLANE sets the addressing mode (content-resolution.mem
 * #cad-storage, "the publicity plane decides the addressing mode"):
 *   · "public"  — a plaintext `ni://` multihash body; a stranger fetches AND verifies foreign-legible.
 *   · "private" — a ciphertext `cid = BLAKE3(ciphertext)` body; capability-gated, member-carry only.
 */
export type BodyPublicity = "public" | "private";

/**
 * The bag a cad body-INDEX (the logical-name → cid indirection map) MUST ride, by publicity —
 * ''map-tier = body-tier''. A public-body index rides `crossroads` (the public floor a stranger mounts);
 * a private-body index rides `catalog` (the sealed / member lane). The tiers NEVER cross: a private map
 * sited on the public floor would leak the private bodies' EXISTENCE + SIZE + re-key CADENCE to any
 * stranger who reads the crossroads floor, breaching the read-lane denial the carry-split keeps absolute.
 */
export function bodyIndexBagUri(publicity: BodyPublicity): string {
  return publicity === "public" ? CROSSROADS_DOC_URI : CATALOG_DOC_URI;
}

/**
 * The fail-closed guard the cad index SITER passes before it writes a body-index: the holding bag matches
 * the body's publicity. It THROWS a named error on any mismatch — a public index off the crossroads plane, a private
 * index off the catalog plane (the load-bearing denial: a private map NEVER rides the public floor), or an unknown
 * bag. `indexHoldingBagUri` names the residency bag the siter chose (`bags/crossroads` / `bags/catalog`),
 * not the full nested index doc URI. The guard enforces canon (content-resolution.mem #cad-storage), never
 * the OPEN indirection-map placement fork (③): it fixes the TIER, never which doc inside the tier holds it.
 */
export function assertBodyIndexTier(indexHoldingBagUri: string, publicity: BodyPublicity): void {
  const expected = bodyIndexBagUri(publicity);
  if (indexHoldingBagUri !== expected) {
    throw new Error(
      // A STACK TRACE CARRIES NO PARAGRAPH. In comments a bare `cad` borrows its name-sense from the
      // prose around it; a thrown line arrives alone, where `cad` reads as an ordinary word. The kind
      // rides in the one register that has no context to lean on.
      `[content-handle] the cad store's ${publicity}-body index MUST ride ${expected}, not ${indexHoldingBagUri} — ` +
        `map-tier=body-tier (a private index on the public crossroads floor leaks existence+size+re-key cadence to a stranger)`,
    );
  }
}

export function skinnyHandleTiddler(
  title: string,
  cid: string,
  size: number,
  ext?: string,
  mediaType?: string,
): Record<string, unknown> {
  return {
    title,
    _is_skinny:     "yes",
    ...(mediaType && ridesAsPointer(mediaType) ? {} : { _canonical_uri: cidUri(cid) }),
    _integrity:     niUriSha256FromHex(cid),
    textCid:        cid,
    size:           String(size),
    ...(mediaType ? { type: mediaType } : {}),
    ...(ext ? { _source_ext: ext } : {}),
  };
}
