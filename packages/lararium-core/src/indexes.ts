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

/**
 * Derive a lar:/// URI from a lares-relative path (e.g. "ha-ka-ba/api/v0.1/pono/meme.md").
 * Throws if the path does not match a known mapping.
 */
export function laresRelPathToLarUri(relPath: string): string {
  const withoutMd = relPath.endsWith(".md") ? relPath.slice(0, -3) : relPath;
  const parts = withoutMd.split("/");

  // All-caps root files: AGENTS.md → lar:///AGENTS
  if (parts.length === 1 && parts[0] && parts[0] === parts[0].toUpperCase() && /[A-Z]/.test(parts[0])) {
    return `lar:///${parts[0]}`;
  }

  // ha-ka-ba/... → lar:///ha.ka.ba/...
  if (parts[0] === "ha-ka-ba") {
    return "lar:///ha.ka.ba/" + parts.slice(1).join("/");
  }

  // Adjacent tagspace dirs: grammars/... → lar:///grammars/...
  //                         lararium-node/... → lar:///lararium-node/...
  if (parts[0] === "grammars" || parts[0] === "lararium-node") {
    return "lar:///" + withoutMd;
  }

  throw new Error(`cannot derive lar URI for lares-relative path: ${relPath}`);
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
  const invariantUri = "lar:///ha.ka.ba/api/v0.1/pono/invariant";
  const result: string[] = [];
  for (const carrier of carriers) {
    if (carrier.implements.includes(invariantUri)) result.push(carrier.uri);
  }
  return result.sort();
}
