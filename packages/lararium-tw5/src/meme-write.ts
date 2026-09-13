/**
 * meme-write — disk export of memes: the recompose shore.
 *
 * Architecture (carrier-whole at rest):
 *   `exportMemeText` routes through `expandMemeRefs` (deserializer.ts) — the
 *   recompose inverse the doctrine names (disk-projection#granularity). The
 *   shore module owns BOTH directions: ingest decomposes a carrier into
 *   parent + ahu-child records; export splices every `<<~ kahea ahu #slot>>`
 *   marker back into its child's definition form and reassembles the whole
 *   carrier envelope. One meme, one file — a child change re-flushes its
 *   GROUP (the projector routes to the carrier root), never its own file.
 *
 *   No per-node markdown-meme template renders each record to its own file;
 *   the HTML templates serve the live story river, and the projection-snapshot
 *   mode gets built fresh when a consumer exists. The carrier definition form
 *   recomposes in the shore (expandMemeRefs, on the face as `$tw.lares.meme.recompose`), where
 *   the round-trip harness proves parse∘render ≡ records. Wikifying the
 *   text field cannot carry byte-fidelity: `\rules` does not propagate
 *   through `<$transclude>` (memetic-parser.ts, Jermolene #6712), and the
 *   full ruleset mangles markdown under text/plain render.
 *
 * Canonical-form law (handoff #pattern-integrities §2): idempotent render;
 * framing (meta order/alignment, sigil spacing, block margins) normalizes
 * once; operator content bytes survive whole.
 *
 * Schema: lar:///ha.ka.ba/lares/api/lararium/schema/meme-write
 */

import type { TiddlerFields } from "./deserializer.js";
import { recomposeMeme } from "./meme-project.js";
import type { TW5Engine } from "./tw5-vm.js";
import { makeTw5FileInfo, readSitingCascades, ruledBasePath, type Tw5FileInfo } from "./tw5-file-info.js";
import type { TW5Instance } from "./types/tiddlywiki.js";

import { skinnyCid } from "./lazy-resolver.js";

import { isCarrierType } from "@lararium/mesh/carrier-type";
import { MEME_EXT, stripMemeExt } from "@lararium/mesh/mirror-paths";

/**
 * Return the canonical memetic-wikitext for a meme URI — the whole carrier,
 * children recomposed inline at full depth.
 *
 * @param tw5     - Live TW5Engine VM instance
 * @param memeUri - lar:/// URI of the meme parent tiddler
 * @returns       - Canonical memetic-wikitext; falls back to the raw text
 *                  field (then empty string) when recompose cannot run
 */
export function exportMemeText(tw5: TW5Engine, memeUri: string): string {
  const wiki = tw5.$tw.wiki;
  try {
    const carrier = recomposeMeme(wiki, memeUri);
    if (carrier !== null) return carrier;
  } catch { /* fall through to raw text */ }
  return wiki.getTiddlerText?.(memeUri, "") ?? "";
}

/** One projected carrier file: the chosen extension, the main bytes, and (for a
 *  content+`.meta` filetype) the sidecar bytes. The projector sites the file at
 *  `<uri-path><ext>` and writes `metaBody` at `<uri-path><ext>.meta`. */
export interface CarrierFile {
  readonly ext:       string;
  readonly body:      string;
  readonly metaBody?: string;
  /** "base64" when the body is base64 text the projector must decode to raw
   *  bytes (a binary filetype — image/PDF); "utf8"/absent for a text carrier. */
  readonly encoding?: string;
  /** A POINTER's content-address (hex sha256 of the RAW bytes): `body` is empty and the projector
   *  writes the bytes it resolves from the local cid/ tier beside `metaBody` — the whole file
   *  beside its `.meta` (THE BLOB LAW). Where the tier lacks the bytes the projector writes the
   *  `.meta` alone. Absent for every carrier whose bytes ride in `body`. */
  readonly pointerCid?: string;
  /** The mirror-relative path a `$:/config/FileSystemPaths` rule sited this carrier at, extension
   *  included — present ONLY when a rule reached the title. Absent, the projector sites by the loci
   *  law (`carrierBaseRelPath`), which is where a stock server with no such rule and an island
   *  part ways: the server flattens the title, the island reads the uri-path. */
  readonly relPath?:  string;
}

/**
 * Render a carrier root back to ITS OWN filetype — the projection reciprocal of
 * the ingest shore. A memetic-wikitext carrier recomposes through
 * `expandMemeRefs` and sites as `.mem` (children spliced whole); ANY other TW5
 * filetype rides TW5's own native file-info cascade (`makeTw5FileInfo`), so a
 * `.tid`/`.json`/`.md`/content-type record projects back as its native file
 * (plus a `.meta` sidecar where the type needs one). One authority — the VM's
 * registry — decides the type, the extension, and the exact bytes for both
 * directions; the Node projector only sites + writes them.
 *
 * Returns null when the root tiddler is absent (nothing to project).
 */
export function exportCarrierFile(tw5: TW5Engine, memeUri: string): CarrierFile | null {
  const wiki = tw5.$tw.wiki;
  const tiddler = wiki.getTiddler?.(memeUri) as { fields?: TiddlerFields } | undefined;
  const fields = tiddler?.fields;
  if (!fields) return null;
  const $tw = tw5.$tw as unknown as TW5Instance;
  // The siting cascades, read as the stock filesystem adaptor reads them — a real
  // `$:/config/FileSystemPaths` / `FileSystemExtensions` tiddler in this wiki, and nothing else.
  const cascades = readSitingCascades($tw);

  // THE POINTER (THE BLOB LAW, content-handle.ts): a carrier whose body left the CRDT for the
  // `cid/` tier. The `text` field is STRIPPED before serialization — even after the read-side
  // lazyLoad resolver rehydrates the body INTO the VM tiddler (for render), the projection never
  // writes a body from the VM and never re-opens the #51 overflow on re-ingest. Two shapes:
  //   · a base64-family pointer (a `type` the registry writes as content + `.meta`, no
  //     `_canonical_uri`) projects as the WHOLE FILE beside its `.meta` — `photo.png` +
  //     `photo.png.meta`, the stock server's own shape; the bytes come from the cid/ tier
  //     (`pointerCid`), the projector resolves + verifies + writes them.
  //   · a `text/*` pointer (the `_lar_cas` override, a `lar:` `_canonical_uri`) rides TW5's own
  //     law for a `_canonical_uri` tiddler: a bodyless `.tid` handle.
  // This wins over the memetic recompose below — a pointer is never a body to recompose.
  const isSkinny = fields["_is_skinny"] === "yes" || typeof fields["textCid"] === "string";
  if (isSkinny) {
    const { text: _body, ...handleFields } = fields as Record<string, unknown>;
    const info = makeTw5FileInfo($tw, memeUri, handleFields, cascades);
    const file = nativeCarrierFile(info);
    const cid = info.hasMetaFile ? skinnyCid(handleFields) : null;
    return cid ? { ...file, body: "", pointerCid: cid } : file;
  }

  const type = typeof fields["type"] === "string" ? (fields["type"] as string) : "";
  // Memetic carriers keep the shore recompose + the `.mem` extension: their
  // ahu children live as separate records and MUST splice back whole (a native
  // file-info pass would emit only the parent's rewritten text). Absent/blank
  // type on a memetic-decomposed carrier still routes here (the recompose
  // returns null for a non-memetic record and we fall through).
  // ROUTING READS WIDE; MINTING WRITES NARROW. This asks "is this a carrier", never "does it spell the
  // type the way I would" — a record stored under the earlier spelling still recomposes to `.mem`.
  if (isCarrierType(type)) {
    // A siting rule reaches a memetic carrier too — the same rule, the same path, `.mem` kept.
    const ruled = ruledBasePath($tw, memeUri, cascades);
    return { ext: MEME_EXT, body: exportMemeText(tw5, memeUri), ...(ruled !== undefined ? { relPath: stripMemeExt(ruled) + MEME_EXT } : {}) };
  }
  return nativeCarrierFile(makeTw5FileInfo($tw, memeUri, fields as Record<string, unknown>, cascades));
}

/** The projector's view of a native file-info: extension, bytes, sidecar, encoding, and a ruled path. */
function nativeCarrierFile(info: Tw5FileInfo): CarrierFile {
  return {
    ext:  info.ext,
    body: info.body,
    ...(info.hasMetaFile && info.metaBody !== undefined ? { metaBody: info.metaBody } : {}),
    ...(info.encoding === "base64" ? { encoding: "base64" } : {}),
    ...(info.pathRuled ? { relPath: info.relPath } : {}),
  };
}
