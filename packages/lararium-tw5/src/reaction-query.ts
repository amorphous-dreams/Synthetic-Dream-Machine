/**
 * reaction-query — ReactionGraph build and incremental update from TW5 wiki state.
 *
 * These functions feed the readiness-vector model: buildReactionGraph() populates
 * the graph at boot; bindingsForUri() drives incremental updates on wiki change.
 * Both take an explicit wiki parameter rather than closing over class state.
 */

import type { TW5Wiki } from "./types/tiddlywiki.js";
import type { ReactionBinding } from "@lararium/core";
import { parsePranalaEdges } from "./pranala-parser.js";
import { extractReactionBindings, ReactionGraph } from "@lararium/core";

/**
 * Parse reaction bindings for a single URI from its current tiddler text.
 * Call on wiki change events for incremental graph updates.
 */
export function bindingsForUri(wiki: TW5Wiki, uri: string): ReactionBinding[] {
  const text: string | undefined = wiki.getTiddlerText(uri);
  if (!text) return [];
  try {
    const edges = parsePranalaEdges(uri, text);
    return extractReactionBindings(
      edges.map((e) => ({
        fromUri: e.fromUri, toUri: e.toUri,
        family:  e.family,  role:  e.role,
        payload: (e as unknown as { payload?: Record<string, unknown> }).payload ?? {},
      }))
    );
  } catch { return []; }
}

/**
 * Build a full ReactionGraph from all non-system tiddlers in the wiki.
 * Use once at boot; after that prefer graph.updateUri(uri, bindingsForUri(wiki, uri)).
 */
export function buildReactionGraph(wiki: TW5Wiki): ReactionGraph {
  const titles: string[] = wiki.filterTiddlers("[all[tiddlers]!prefix[$:/]]");
  const allEdges: {
    fromUri: string; toUri: string;
    family: string; role: string | null;
    payload: Record<string, unknown>;
  }[] = [];

  for (const uri of titles) {
    const text: string | undefined = wiki.getTiddlerText(uri);
    if (!text) continue;
    try {
      const edges = parsePranalaEdges(uri, text);
      for (const e of edges) {
        allEdges.push({
          fromUri: e.fromUri, toUri: e.toUri,
          family: e.family, role: e.role,
          payload: (e as unknown as { payload?: Record<string, unknown> }).payload ?? {},
        });
      }
    } catch { /* malformed carrier — skip */ }
  }

  const g = new ReactionGraph();
  g.load(extractReactionBindings(allEdges));
  return g;
}
