/**
 * @deprecated web2-era — implementation dead. See project.web2.ts for the original.
 * Rebuild target: replace parseMemeCarrier → parseMemeText, parsePranalaEdges → parseMemeEdges
 * from @lararium/core/meme-ast. Projection logic is FFZ-aligned — pure, no I/O, keep as-is.
 */

import type { BootArtifact } from "@lararium/core";
import type { LarTLSnapshot } from "./records.js";

export interface ProjectOptions {
  includeAhuFrames?: boolean;
  includeNotes?:     boolean;
  readText?:         (uri: string) => string | null;
}

/** @deprecated web2-era — stub throws. Rebuild: swap parseMemeCarrier → parseMemeText. */
export function projectToTldraw(
  _artifact: BootArtifact,
  _opts: ProjectOptions = {},
): LarTLSnapshot {
  throw new Error("web2-era dead code — rebuild: replace parseMemeCarrier → parseMemeText");
}
