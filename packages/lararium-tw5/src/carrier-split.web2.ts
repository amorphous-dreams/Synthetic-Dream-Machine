/**
 * @deprecated web2-era — implementation dead. See carrier-split.web2.ts for the original.
 * Rebuild target: splitting happens inside deserializer.ts (splitMemeToTiddlers).
 * Type contracts kept for reference.
 */

export interface ParentTiddler {
  title:  string;
  fields: Record<string, string | string[]>;
  text:   string;
}

export interface ChildTiddler {
  title:  string;
  fields: Record<string, string | string[]>;
  text:   string;
}

export interface CarrierSplit {
  parent:   ParentTiddler;
  children: ChildTiddler[];
  warnings: string[];
}
