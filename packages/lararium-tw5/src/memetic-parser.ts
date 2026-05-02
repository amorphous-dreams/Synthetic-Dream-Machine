/**
 * @deprecated web2-era — implementation dead. See memetic-parser.web2.ts for the original.
 * Rebuild target: meme-parser.ts — TW5 parser binding using parseMemeText (MemeNode not CarrierNode).
 */

// TW5ParseNode type kept — it is the parse-tree contract between the parser
// and the TW5 widget renderer. The shape is invariant across web2→meme rebuild.
export interface TW5ParseNode {
  type:         string;
  tag?:         string;
  attributes?:  Record<string, { type: string; value: unknown }>;
  children?:    TW5ParseNode[];
  text?:        string;
  isSelfClosing?: boolean;
}
