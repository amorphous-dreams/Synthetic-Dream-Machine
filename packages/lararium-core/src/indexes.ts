/**
 * Pure index builders — no I/O. Host provides carrier records.
 *
 * Also exports the URI derivation helper for mapping lares-relative file
 * paths back to lar:/// URIs (used by the node host when walking the tree).
 */

import { type CarrierRecord } from "./carrier.js";

// ---------------------------------------------------------------------------
// URI derivation from lares-relative path
// ---------------------------------------------------------------------------

const LARES_CAPS_FILES = new Set(["AGENTS", "LARES", "README", "SESSION"]);

/**
 * Derive a lar:/// URI from a packages/lares-relative path (e.g. "api/v0.1/pono/meme.md").
 * All paths map into the lar:///ha.ka.ba/@lares/ namespace.
 */
export function laresRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  const parts = withoutMd.split("/");

  // All-caps root files: AGENTS.md → lar:///ha.ka.ba/@lares/AGENTS
  if (parts.length === 1 && parts[0] && LARES_CAPS_FILES.has(parts[0])) {
    return `lar:///ha.ka.ba/@lares/${parts[0]}`;
  }

  // Everything else maps into lar:///ha.ka.ba/@lares/{path}
  return "lar:///ha.ka.ba/@lares/" + withoutMd;
}

// ---------------------------------------------------------------------------
// Index builders
// ---------------------------------------------------------------------------

export function compileInterfaceIndex(carriers: Iterable<CarrierRecord>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const carrier of carriers) {
    for (const ifaceUri of carrier.implements) {
      let list = index.get(ifaceUri);
      if (!list) { list = []; index.set(ifaceUri, list); }
      list.push(carrier.uri);
    }
  }
  for (const list of index.values()) list.sort();
  return new Map([...index.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export function compileInvariantIndex(carriers: Iterable<CarrierRecord>): string[] {
  const invariantUri = "lar:///ha.ka.ba/@lares/api/v0.1/pono/invariant";
  const result: string[] = [];
  for (const carrier of carriers) {
    if (carrier.implements.includes(invariantUri)) result.push(carrier.uri);
  }
  return result.sort();
}
