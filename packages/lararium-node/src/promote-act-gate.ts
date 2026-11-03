/**
 * The promote act gate: the RAISING device's own raise completes before its daemon island restarts, and nothing else holds an arrival.
 *
 * A raise runs as a face row on the daemon island; the board watcher sees its act land before the row's reply leaves, and a holder restart
 * then rejects the row `daemon-restarting` though the act landed. The vessel begins each promote or kapae session act here, the channel
 * ends it once the reply left, and `after(kinds, run)` hands a restart to the completion of the acts of those kinds standing NOW. It never
 * awaits and holds no promise: the holder keeps its law (a restart never waits on a call), a hung act leaves a plain restart (the owner
 * door's `island.restart`) free to force the swap, and an arrival with no such act in flight (a remote raise, a sync) restarts at once.
 * Narrow residual, named: a hung reply of this device's own raise holds only the deferred run for the raise standing at the request.
 */
import { promoteEdgeKey } from "@lararium/mesh";

/** The (wiki, digest) edge a promote act names; a verb that names no wiki means the daemon wiki, as the door reads it. */
export function promoteActEdge(args: Readonly<Record<string, unknown>>): string | undefined {
  const digest = args["digest"], wiki = args["wiki"];
  if (typeof digest !== "string" || !/^[0-9a-f]{64}$/i.test(digest)) return undefined;
  return promoteEdgeKey(typeof wiki === "string" && wiki.trim() ? wiki : "daemon", digest.toLowerCase());
}
export const isPromoteAct = (act: string): boolean => /^(promote|kapae)-/.test(act);

export interface PromoteActGate {
  begin(act: object, kind: string, edge?: string): void;
  end(act: object): void;
  /** True when acts of `kinds` stand and `run` waits on their completion; false when none stand and the caller acts now. */
  /** With `edges`, the run defers only when a standing act names EVERY one of them; an edge nobody here raised restarts now. */
  after(kinds: readonly string[], run: () => void, edges?: readonly string[]): boolean;
}

export function promoteActGate(): PromoteActGate {
  const open = new Map<object, { kind: string; edge: string | undefined }>();
  const waiters = new Set<{ left: Set<object>; run: () => void }>();
  return {
    begin(act, kind, edge) { open.set(act, { kind, edge }); },
    end(act) {
      if (!open.delete(act)) return;
      for (const w of [...waiters]) {
        w.left.delete(act);
        if (!w.left.size) { waiters.delete(w); w.run(); }
      }
    },
    after(kinds, run, edges) {
      const standing = [...open].filter(([, a]) => kinds.includes(a.kind));
      // With edges, EVERY carried edge needs a standing local act: an edge nobody here raised restarts now, whatever else stands.
      if (edges !== undefined && !edges.every(edge => standing.some(([, a]) => a.edge === edge))) return false;
      const left = new Set(standing.filter(([, a]) => edges === undefined || (a.edge !== undefined && edges.includes(a.edge))).map(([act]) => act));
      if (!left.size) return false;
      waiters.add({ left, run });
      return true;
    },
  };
}
