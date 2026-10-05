/**
 * heleuma-digest — `source-sha256`: what it hashes, and how an anchor takes a new one.
 *
 * ── TWO LAYERS, AND BOTH STAND ──────────────────────────────────────────────────────────────────
 *   (L1) a `ka` anchor's `source-sha256` is the SHA-256 of the module's CODE — exactly the deserialized
 *        record `text` the boot gate (`src/tw5-module-gate.ts`) verifies before it injects a module.
 *   (L2) the block check over STX..ETX covers the anchor's whole body, root meta INCLUDED — so the
 *        meta that holds L1 is itself covered by L2.
 *
 * No circularity, as long as a writer runs in order: hash the code → write the field → re-stamp the
 * check. A digest taken over the module carrier's STX..ETX span never settles — the span carries that
 * carrier's own meta and prose, so it never equals the gate's `text` — and a field patched without a
 * re-stamp leaves the anchor reading `mismatch` at every gate.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-module
 */
import { tagDigest, formatDigest, IMPLICIT_ALGO } from "@lararium/mesh/agile-digest";
import { sha256HexSync } from "@lararium/mesh";
import { stampCarrier } from "@lararium/memetic-frame";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { alignMetaTomlColumns } from "../src/meme-normalize.js";
import { rootMetaFence } from "../src/root-meta.js";

/**
 * The digest the gate verifies: SHA-256 (hex) of the module record's `text`, read through the same
 * deserializer that hands the gate its tiddler, TAGGED (`sha256:…`) — every carrier digest in the
 * house rides tagged now. Null where the carrier yields no record at that address.
 */
export function moduleBodyDigest(content: string, moduleRef: string): string | null {
  const record = memeticWikitextDeserializer(content, { title: moduleRef }).find((r) => r.title === moduleRef);
  if (!record || typeof record.text !== "string") return null;
  return formatDigest(IMPLICIT_ALGO, sha256HexSync(record.text));
}

/**
 * Write `source-sha256` into the anchor's ROOT meta — the first meta block of the body, found by the
 * one span reader — then re-stamp the anchor's check over the body that moved.
 */
export function applySourceSha256Patch(content: string, sha256: string): string {
  const tagged = tagDigest(sha256);
  const fence = rootMetaFence(content);
  if (!fence) return content;
  const { bodyStart, bodyEnd, body } = fence;
  const SHA_FIELD = /^source-sha256\s*=\s*"[^"]*"/m;
  const next = SHA_FIELD.test(body)
    ? body.replace(SHA_FIELD, `source-sha256 = "${tagged}"`)
    : `${body}\nsource-sha256 = "${tagged}"`;
  // The column law holds after the patch, so the anchor stays canonical under `meme check`.
  return stampCarrier(content.slice(0, bodyStart) + alignMetaTomlColumns(next) + content.slice(bodyEnd));
}
