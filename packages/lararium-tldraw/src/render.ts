/**
 * renderToTldraw — convenience pipeline: project → layout → emit.
 *
 * Equivalent to:
 *   const snap    = projectToTldraw(artifact, projOpts);
 *   const layout  = selectLayout(snap, cascade);
 *   const records = emitTldrawRecords(snap, layout);
 */

import { type BootArtifact } from "@lararium/core";
import { projectToTldraw, type ProjectOptions } from "./project.js";
import { selectLayout, type LayoutStrategy } from "./layout.js";
import { emitTldrawRecords, type TldrawEmission } from "./tldraw-shapes.js";

export interface RenderOptions extends ProjectOptions {
  /** Override the layout cascade. Default: LAYOUT_CASCADE (story-river). */
  cascade?: LayoutStrategy[];
}

export function renderToTldraw(artifact: BootArtifact, opts: RenderOptions = {}): TldrawEmission {
  const { cascade, ...projOpts } = opts;
  const snapshot = projectToTldraw(artifact, projOpts);
  const layout   = selectLayout(snapshot, cascade);
  return emitTldrawRecords(snapshot, layout);
}
