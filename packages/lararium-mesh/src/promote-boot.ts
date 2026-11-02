import { promotions, type PromoteItem, type PromotionPorts } from "./promote-door.js";
import { promoteEdgeKey } from "./promote.js";
import { encodeKapaeLocal, kapaeNoteArrival } from "./promote-kapae.js";

export interface PromoteBootReport {
  orphans: string[];
  updateWaits: string[];
  voided: { digest: string; reason: string }[];
  shadowed: string[];
}

export function promoteBoot(opts: {
  stores: { ledger: PromotionPorts["ledger"]; local: PromotionPorts["local"] };
  cas: PromotionPorts["cas"];
  board: PromotionPorts["board"];
  itemsOf: (wiki: string) => Promise<readonly PromoteItem[]>;
  restart: (wiki: string) => Promise<void>;
  onReport?: (wiki: string, report: PromoteBootReport) => void;
  onRestartFailed?: (wiki: string, error: unknown) => void;
  onFault?: (reason: "ledger-unreadable" | "board-unreadable" | "board-unpinned") => void;
}) {
  const loaded = new Map<string, Set<string>>();
  return {
    async promotedFor(wiki: string): Promise<readonly string[]> {
      let storeFailed = false;
      const wrap = <T>(store: { read(): Promise<T>; write(value: T): Promise<void> }) => ({
        read: async () => { try { return await store.read(); } catch (error) { storeFailed = true; throw error; } },
        write: async (value: T) => { try { await store.write(value); } catch (error) { storeFailed = true; throw error; } },
      });
      try {
        const result = await promotions({ wiki, ledger: wrap(opts.stores.ledger), local: wrap(opts.stores.local),
          items: () => opts.itemsOf(wiki), board: opts.board, cas: opts.cas,
          loaded: () => new Set(), restart: async () => {}, who: { kind: "seat", id: "boot" } }).boot();
        loaded.set(wiki, new Set(result.pluginCids.map(digest => promoteEdgeKey(wiki, digest))));
        opts.onReport?.(wiki, { orphans: result.orphans, updateWaits: result.updateWaits, voided: result.voided, shadowed: result.shadowed });
        return result.pluginCids;
      } catch (error) {
        loaded.delete(wiki);
        if (storeFailed) opts.onFault?.("ledger-unreadable");
        return [];
      }
    },
    async arrive(): Promise<readonly string[]> {
      let board: Awaited<ReturnType<typeof opts.board>>;
      try { board = await opts.board(); } catch { opts.onFault?.("board-unreadable"); return []; }
      let local: Awaited<ReturnType<typeof opts.stores.local.read>>;
      try { local = await opts.stores.local.read(); } catch { opts.onFault?.("ledger-unreadable"); return []; }
      const edges = board.edges();
      const allLoaded = new Set([...loaded.values()].flatMap(set => [...set]));
      // The cache records the whole shadow before any restart: an offline boot honors it whatever a restart did. A wiki restarts while
      // any edge it LOADED sits in the current shadow, so a restart that failed is tried again by the next arrive.
      const next = kapaeNoteArrival(local, edges, allLoaded).local;
      if (new TextDecoder().decode(encodeKapaeLocal(local)) !== new TextDecoder().decode(encodeKapaeLocal(next))) await opts.stores.local.write(next);
      const restarted: string[] = [];
      for (const [wiki, held] of [...loaded]) {
        const hit = [...held].filter(edge => edges.has(edge));
        if (hit.length === 0) continue;
        try { await opts.restart(wiki); } catch (error) { opts.onRestartFailed?.(wiki, error); continue; }
        for (const edge of hit) held.delete(edge);
        restarted.push(wiki);
      }
      return restarted.sort();
    },
  };
}
