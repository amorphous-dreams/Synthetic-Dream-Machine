/**
 * @deprecated web2-era — index builders wired to CarrierRecord. Do NOT add new exports here.
 *
 * Principles worth keeping:
 *   - compileInterfaceIndex / compileInvariantIndex are pure graph utilities;
 *     they operate on PranaEdge sets, not on parsing. Keep the concept.
 *   - Replace CarrierRecord with MemeRecord { uri: string; edges: PranaEdge[] }.
 *     The index functions themselves need no other change.
 *
 * Rebuild target: migrate CarrierRecord → MemeRecord; source from @lararium/core/meme-ast.
 *
 * Pure index builders — no I/O. Host provides carrier records.
 *
 * Also exports URI derivation helpers for mapping corpus-relative file
 * paths back to lar:/// URIs (used by the node host when walking each tree).
 */

import { type CarrierRecord } from "./carrier.js";

// ---------------------------------------------------------------------------
// URI derivation from corpus-relative paths
// ---------------------------------------------------------------------------

const LARES_CAPS_FILES = new Set(["AGENTS", "LARES", "README", "SESSION"]);

/**
 * Derive a lar:/// URI from a packages/lares/memes-relative path.
 * All paths map into the lar:///ha.ka.ba/@lares/ namespace.
 */
export function laresRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  const parts = withoutMd.split("/");
  if (parts.length === 1 && parts[0] && LARES_CAPS_FILES.has(parts[0])) {
    return `lar:///ha.ka.ba/@lares/${parts[0]}`;
  }
  return "lar:///ha.ka.ba/@lares/" + withoutMd;
}

/**
 * Derive a lar:/// URI from a packages/lares-chapel-perilous-opens/memes-relative path.
 * The root dir is the three-segment tuple root: "foo.bar.baz/rest" → "lar:///foo.bar.baz/rest".
 */
export function chapelRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  return `lar:///${withoutMd}`;
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
