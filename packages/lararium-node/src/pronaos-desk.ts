/**
 * The desk's names for the prepared Pronaos inputs.
 *
 * A desk checkout builds its Web root at `packages/lararium-web/dist` and the finite receipt at
 * `.pronaos-build/pronaos-artifact.json`. This helper names those two paths when BOTH stand, and nothing
 * else: it reads no byte, holds no trust and mounts nothing. The composition (`composePronaosFromEnv`)
 * stays the one verifier, hashing every routed file against the receipt, so a stale or torn build refuses
 * there. The container names its own inputs in compose (image paths); both reach the same composition.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

export interface PronaosDeskInputs {
  readonly webRoot: string;
  readonly artifactRecord: string;
}

export function derivePronaosDeskInputs(checkoutRoot: string): PronaosDeskInputs | null {
  const webRoot = join(checkoutRoot, "packages", "lararium-web", "dist");
  const artifactRecord = join(checkoutRoot, ".pronaos-build", "pronaos-artifact.json");
  const standsDir = existsSync(webRoot) && statSync(webRoot).isDirectory();
  const standsFile = existsSync(artifactRecord) && statSync(artifactRecord).isFile();
  return standsDir && standsFile ? { webRoot, artifactRecord } : null;
}
