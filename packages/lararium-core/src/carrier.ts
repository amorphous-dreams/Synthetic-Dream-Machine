/**
 * @deprecated web2-era — implementation dead. See carrier.web2.ts for the original.
 * Do NOT import from this file in new code.
 * Rebuild target: MemeRecord type in @lararium/core/meme-ast; parseCarrier → parseMemeText.
 */

// Type stubs kept for shape-reference only. Rebuild replaces with MemeRecord.
import type { PranaEdge } from "./ast.js";

export type CarrierRating = "kapu" | "ano" | "meme" | "data" | "noise";
export type DepthState    = "resolved" | "absent";

export interface CarrierShape {
  readonly valid:       boolean;
  readonly rating:      CarrierRating;
  readonly depthState:  DepthState;
  readonly diagnostics: readonly import("./diagnostics.js").Diagnostic[];
}

export interface CarrierRecord {
  readonly uri:        string;
  readonly metadata:   Record<string, unknown>;
  readonly implements: readonly string[];
  readonly shape:      CarrierShape;
}
