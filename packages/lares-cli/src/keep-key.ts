/**
 * keep-key — the key the house seals its keep bundle's roster under (`bundle-manifest.ts#sealRedeclare`).
 *
 * A keep's remote crosses to another vessel, so the bundle carries no roster of one human's faces in clear: the re-declare list
 * rests as one sealed value under this key. The key rests at `<config>/keep-key` (64 hex, mode 0600): the config home survives a
 * re-founding, the hearth's reset never reaches it, and the container binds it to the host. The first cut mints it; every later
 * cut seals under the same key, so an unmoved house cuts the same bundle. A restore onto a brand-new house root reads the key the
 * house that cut the bundle held: copy `<old root>/config/keep-key` into the new root's config home before the import.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { mintContentKey } from "@lararium/mesh";
import { atomicWriteFileSync, larConfigHome } from "@lararium/node";

export const KEEP_KEY_FILE = "keep-key";

/** Where the house's keep key rests. */
export function keepKeyPath(): string {
  return join(larConfigHome(), KEEP_KEY_FILE);
}

/** The house's keep key, or null where none rests (or the file holds no 32-byte key in hex). */
export function readKeepKey(): Uint8Array | null {
  let text: string;
  try { text = readFileSync(keepKeyPath(), "utf8").trim(); } catch { return null; }
  return /^[0-9a-f]{64}$/.test(text) ? Uint8Array.from(Buffer.from(text, "hex")) : null;
}

/** The key a cut seals under: the house's own, minted at the first cut where none rests. */
export function keepKeyForCut(): Uint8Array {
  const held = readKeepKey();
  if (held !== null) return held;
  const key = mintContentKey();
  mkdirSync(larConfigHome(), { recursive: true });
  atomicWriteFileSync(keepKeyPath(), `${Buffer.from(key).toString("hex")}\n`, undefined, { mode: 0o600 });
  return key;
}
