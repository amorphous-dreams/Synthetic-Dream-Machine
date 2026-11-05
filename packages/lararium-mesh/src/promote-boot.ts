import { mutate, promotions, type PromoteItem, type PromotionPorts, type Store } from "./promote-door.js";
import { promoteEdgeKey } from "./promote.js";
import { EMPTY_KAPAE_LOCAL, kapaeNoteArrival, kapaeStanding } from "./promote-kapae.js";

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
  /** Resolves when the wiki restarted, or answers `{ pending }` when the restart follows a later completion (a raise in flight here): pending until it reports. */
  restart: (wiki: string, hit: readonly string[]) => Promise<void | { pending: Promise<void> }>;
  onReport?: (wiki: string, report: PromoteBootReport) => void;
  onRestartFailed?: (wiki: string, error: unknown) => void;
  /** The stage enumeration rejected at boot: reconciliation reporting is blind, the promoted code still stands. */
  onItemsFault?: (wiki: string, error: unknown) => void;
  /** A boot failure emptied this wiki's promoted code: the error rides out by name, never silent. */
  onSwallowed?: (wiki: string, error: unknown) => void;
  /** The digests this wiki boots with (empty included), for the boot log. */
  onPromoted?: (wiki: string, digests: readonly string[]) => void;
  onFault?: (reason: "ledger-unreadable" | "board-unreadable" | "board-unpinned") => void;
}) {
  const loaded = new Map<string, Set<string>>();
  const pendingRestart = new Map<string, Set<string>>();
  return {
    loadedFor: (wiki: string): ReadonlySet<string> => loaded.get(wiki) ?? new Set(),
    async promotedFor(wiki: string): Promise<readonly string[]> {
      let storeFailed = false;
      // The wrapper keeps the store's atomic `update` (or the serial queue on the UNDERLYING store), so a boot's writes serialize with the verbs'.
      const wrap = <T>(store: Store<T>) => ({
        read: async () => { try { return await store.read(); } catch (error) { storeFailed = true; throw error; } },
        write: async (value: T) => { try { await store.write(value); } catch (error) { storeFailed = true; throw error; } },
        update: async (fn: (standing: T) => T) => { try { return await mutate(store, fn); } catch (error) { storeFailed = true; throw error; } },
      });
      try {
        const result = await promotions({ wiki, ledger: wrap(opts.stores.ledger), local: wrap(opts.stores.local),
          items: () => opts.itemsOf(wiki), board: opts.board, cas: opts.cas,
          who: { kind: "seat", id: "boot" } }).boot();
        loaded.set(wiki, new Set(result.pluginCids.map(digest => promoteEdgeKey(wiki, digest))));
        opts.onReport?.(wiki, { orphans: result.orphans, updateWaits: result.updateWaits, voided: result.voided, shadowed: result.shadowed });
        if (result.itemsError !== null) opts.onItemsFault?.(wiki, result.itemsError);
        opts.onPromoted?.(wiki, result.pluginCids);
        return result.pluginCids;
      } catch (error) {
        loaded.delete(wiki);
        opts.onSwallowed?.(wiki, error);
        opts.onPromoted?.(wiki, []);
        if (storeFailed) opts.onFault?.("ledger-unreadable");
        return [];
      }
    },
    async arrive(): Promise<readonly string[]> {
      // An unreadable board never skips the brake: the cached shadow stands alone (an offline boot honors it the same way).
      let board: Awaited<ReturnType<typeof opts.board>> | null = null;
      try { board = await opts.board(); } catch { opts.onFault?.("board-unreadable"); }
      // THE BRAKE RUNS FIRST. A torn cache read never stops it (the board's own reading stands alone), and the cache is persisted AFTER the
      // restarts: a failed write is named and tried again by the next arrive, never thrown into the brake.
      let local: Awaited<ReturnType<typeof opts.stores.local.read>> = EMPTY_KAPAE_LOCAL;
      let localRead = true;
      try { local = await opts.stores.local.read(); } catch { localRead = false; opts.onFault?.("ledger-unreadable"); }
      const edges = board ? kapaeStanding(local, board) : new Set(local.shadowed);
      const allLoaded = new Set([...loaded.values()].flatMap(set => [...set]));
      const restarted: string[] = [];
      for (const [wiki, held] of [...loaded]) {
        const pending = pendingRestart.get(wiki);
        // A pending restart suppresses only the edges it already carries: the restart passes the edges NO pending restart carries.
        const hit = [...held].filter(edge => edges.has(edge) && !pending?.has(edge));
        if (hit.length === 0) continue;
        let outcome: void | { pending: Promise<void> };
        try { outcome = await opts.restart(wiki, hit); } catch (error) { opts.onRestartFailed?.(wiki, error); continue; }
        if (outcome && "pending" in outcome) {
          // The restart waits on a later completion: the loaded edges stay held, so a failure there converges on the next arrive.
          const carried = pending ?? new Set<string>();
          for (const edge of hit) carried.add(edge);
          pendingRestart.set(wiki, carried);
          const settle = () => { const now = pendingRestart.get(wiki); if (now) { for (const edge of hit) now.delete(edge); if (!now.size) pendingRestart.delete(wiki); } };
          outcome.pending.then(
            () => { settle(); for (const edge of hit) held.delete(edge); },
            (error) => { settle(); opts.onRestartFailed?.(wiki, error); },
          );
          continue;
        }
        for (const edge of hit) held.delete(edge);
        restarted.push(wiki);
      }
      // An UNREAD cache is never replaced: the board-only reading would erase an older shadow the board does not show. The cache is recomputed
      // from its STANDING value under the store's hold, so a concurrent arrival never overwrites a newer shadow.
      if (board && localRead) {
        try { await mutate(opts.stores.local, (standing) => kapaeNoteArrival(standing, kapaeStanding(standing, board!), allLoaded).local); }
        catch { opts.onFault?.("ledger-unreadable"); }
      }
      return restarted.sort();
    },
  };
}
