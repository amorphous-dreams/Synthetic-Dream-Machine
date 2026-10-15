/**
 * native-canonical — the projecting leg's `≈` for a NATIVE (non-memetic) filetype:
 * what canonical carrier text do these disk bytes SAY, read through TW5's own
 * deserialize → render round trip, mirroring `carrier-canonical.ts` (the memetic
 * congruence) onto the family the ingest leg already trusts.
 *
 * WHY THIS EXISTS. `action-handler.ts`'s single-native-carrier LOAD path already
 * runs a native carrier through `decideIngest` with a `nativeRender` congruence
 * (deserialize the disk bytes, merge the `.meta` sidecar over the result — TW5's
 * own folder-loader law — then render the merged record back through
 * `renderCarrier`). `disk-projector.ts`'s projecting leg had NO equivalent: its
 * `canonicalizeFn` was gated to `file.ext === MEME_EXT` alone, so a native carrier
 * whose disk and records both moved past the merge base always read `conflict`,
 * even when the two streams said the SAME thing (reordered JSON keys, a
 * reformatted `.tid` field block). This is that congruence, mirrored — NOT a new
 * design; it reuses the SAME three primitives the ingest leg's `nativeRender`
 * closes over (`Tw5Deserializer.deserialize` / `.parseFields` / `.renderCarrier`),
 * so there is exactly one implementation of "what a native carrier's bytes render
 * to" in the tree, read from either shore.
 *
 * FAIL-CLOSED SCOPE, STATED (the ahu-fidelity guard's role, mirrored): native
 * declares NO structural slots (`declaredStructure` returns ∅ on both legs today),
 * so there is no per-slot drop this function can detect — the SAME trust level the
 * ingest leg already extends to a native round trip. Two shapes it refuses to
 * canonicalize rather than guess at, both returning `null` (the standoff, never a
 * guess):
 *   - a BUNDLE (a `.multids`/`.json` file whose deserialize yields more than one
 *     tiddler, or whose sole member's own title differs from `uri`) — a pack's
 *     members are reconciled per-member by the INGEST leg only; the projector
 *     never renders a pack as a single carrier (`isPackMember` suppresses it), so
 *     canonicalizing one here would answer a question the projector never asks
 *     today. Scope stays the single-carrier case until a projecting-side pack
 *     leg exists.
 *   - a deserialize/render THROW (a malformed disk file, an unregistered
 *     filetype) — the caller reads `null` exactly as an absent canonicalizer.
 *
 * Not pure in the sense `carrier-canonical.ts` is (that one closes over no `$tw`
 * at all): this closes over a live `Tw5Deserializer`, which itself closes over the
 * island's booted `$tw`. No I/O, no clock, no hashing of its own — the caller
 * hashes what comes back, exactly as `canonicalizeCarrierText`'s callers do.
 */

import type { Tw5Deserializer } from "./action-handler.js";

/** The canonical BODY + `.meta` a native carrier's disk bytes SAY, folded the
 *  same way the projector folds its own render (`carrierHash(body, metaBody)`
 *  — the caller's job, not this function's). */
export interface NativeCanonicalCarrier {
  readonly body: string;
  readonly metaBody?: string;
}

/**
 * `render(parse(diskBody, diskMeta))` for a native (non-memetic) carrier —
 * the projecting leg's `≈`, mirroring the ingest leg's `nativeRender`
 * (`action-handler.ts`).
 *
 * @param deserializer - the island's live native congruence (`makeTw5Deserializer`).
 * @param uri           - the carrier's own loci URI — the fallback title when the
 *                        deserialized record carries none (a title-less `.md`/content
 *                        file; a `.tid`/`.json` almost always names its own).
 * @param ext           - the extension the disk file sited at (`.tid`, `.json`, …);
 *                        deferred wholly to TW5's own deserializer registry.
 * @param diskBody      - the disk file's own text (never base64 — the caller must
 *                        not invoke this for a binary/base64-encoded filetype; a
 *                        byte-for-byte round trip carries no reformatting to normalize).
 * @param diskMeta      - the `.meta` sidecar's raw text, when the filetype carries one;
 *                        merged OVER the deserialized record exactly as LOAD does.
 * @returns             - the canonical `{ body, metaBody }`, or `null` when no
 *                        trustworthy single-carrier view exists (a bundle, a throw).
 */
export function canonicalizeNativeCarrierText(
  deserializer: Tw5Deserializer,
  uri: string,
  ext: string,
  diskBody: string,
  diskMeta: string | undefined,
): NativeCanonicalCarrier | null {
  try {
    const metaFields = diskMeta ? { ...deserializer.parseFields(diskMeta) } : {};
    delete (metaFields as Record<string, unknown>)["title"];
    const fieldsList = deserializer.deserialize(ext || "text/plain", diskBody, {});
    if (fieldsList.length !== 1) return null;   // a bundle — out of this function's scope, not a guess
    const merged: Record<string, unknown> = { ...fieldsList[0], ...metaFields };
    const ownTitle = typeof merged["title"] === "string" && merged["title"] ? (merged["title"] as string) : uri;
    if (ownTitle !== uri) return null;          // a foreign-titled single member is a pack member, not a single carrier
    merged["title"] = ownTitle;
    const rendered = deserializer.renderCarrier(uri, merged);
    return { body: rendered.body, ...(rendered.metaBody !== undefined ? { metaBody: rendered.metaBody } : {}) };
  } catch {
    return null;   // a malformed disk file / unregistered filetype — the standoff, never a guess
  }
}
