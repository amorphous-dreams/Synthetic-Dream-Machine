/**
 * @deprecated web2-era — MemeGraph implementation dead. See meme-graph.web2.ts for the original.
 * Rebuild target: remove CarrierShape from Meme; rebuild MemeGraph against MemeRecord.
 */

import type { PranaEdge } from "./pranala-parser.js";

// Type stubs — shape contracts for the rebuild.
export interface Meme {
  uri:          string;
  laresRelPath: string | null;
  contentHash:  string;
  metadata:     Record<string, unknown>;
  edgesOut:     PranaEdge[];
  virtual:      boolean;
  exists:       boolean;
  shape:        null; // @deprecated web2-era: was CarrierShape | null
}

export interface DeclaredUnresolved {
  uri:      string;
  edge:     PranaEdge;
  severity: "error" | "warning" | "info";
}
