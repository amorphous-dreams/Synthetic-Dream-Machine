/**
 * lararium-browser-host — local-first host opening sequence for the browser.
 *
 * Boot law (Zelenka capability-scoped storage model):
 *   host-opening → authority-opening → authority-ready
 *   → store-opening → store-ready    ← Automerge IDB first, server is peer
 *   → tw5-opening → tw5-ready
 *   → live
 *
 * Scoping model — ONE TW5 instance per room (collaboration space):
 *   Each roomId maps to one Automerge document and one LarariumTW5 wiki.
 *   The TW5 wiki is the capability boundary — kumu defs, filters, and the
 *   CRDT sync adaptor are all scoped to the room, never shared globally.
 *   tldraw page switches (ROOM_SYSTEM → ROOM_INVARIANTS) do NOT create new
 *   TW5 instances — those are filter views of the same corpus doc.
 *   A room change (different roomId) tears down the old adaptor + wiki and
 *   boots fresh, ensuring clean capability isolation per space.
 *
 * Hard rules:
 *   - Local store boots from IndexedDB before any server contact.
 *   - await handle.doc() is the ONLY readiness gate — no synced-event race.
 *   - Server injects Automerge doc URL via <meta name="lararium-meme-store">.
 *   - URL is cached in localStorage for offline subsequent boots.
 *   - No second WebSocket for boot receipt — arrives via tldraw room shape.
 *   - TW5 boots AFTER store-ready.
 *   - getSingleton() in @lararium/tw5 is server-side only; never used here.
 */

import { useState, useEffect, useRef } from "react";
import type { LarariumOpenPhase } from "@lararium/core";
import { LarariumTW5, LarariumCrdtSyncAdaptor, setActiveTW5 } from "@lararium/tw5";
import { initMemeRepo, readMemeStoreUrl, type MemeRepoResult } from "./automerge-store.js";
import type { AutomergeMemeStore } from "./automerge-store.js";
import { getOrCreateBrowserIdentity } from "./operator-key.js";
import type { Repo } from "@automerge/automerge-repo";

// ---------------------------------------------------------------------------
// BrowserHostOptions
// ---------------------------------------------------------------------------

export interface BrowserHostOptions {
  hostId:    string;
  recipeUri: string;
  roomId:    string;
}

// ---------------------------------------------------------------------------
// HostOpenState
// ---------------------------------------------------------------------------

export interface HostOpenState {
  phase:      LarariumOpenPhase | null;
  store:      AutomergeMemeStore | null;
  tw5:        LarariumTW5 | null;
  receipt:    string | null;
  isLive:     boolean;
}

// ---------------------------------------------------------------------------
// useLarariumHostOpen — React hook: sequential local-first boot
// ---------------------------------------------------------------------------

export function useLarariumHostOpen(options: BrowserHostOptions): HostOpenState {
  const [phase,   setPhase]   = useState<LarariumOpenPhase | null>(null);
  const [store,   setStore]   = useState<AutomergeMemeStore | null>(null);
  const [tw5,     setTw5]     = useState<LarariumTW5 | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isLive,  setIsLive]  = useState(false);

  const repoRef         = useRef<Repo | null>(null);
  const tw5Ref          = useRef<LarariumTW5 | null>(null);
  const stopAdaptorRef  = useRef<(() => void) | null>(null);
  const optionsRef      = useRef(options);
  optionsRef.current    = options;

  useEffect(() => {
    let cancelled = false;
    // Snapshot roomId at effect start — this is the capability scope for this boot cycle.
    const { hostId, recipeUri, roomId } = optionsRef.current;

    // Reset derived state for the new room before kicking off the async boot.
    setPhase(null); setStore(null); setTw5(null); setIsLive(false);

    async function run() {
      // ── Authority ──────────────────────────────────────────────────────────
      if (!cancelled) setPhase({ kind: "host-opening", hostId });
      if (!cancelled) setPhase({ kind: "authority-opening", hostId });
      const r = `local-operator:${hostId}`;
      if (!cancelled) { setPhase({ kind: "authority-ready", receipt: r }); setReceipt(r); }

      // ── Store (local-first) ───────────────────────────────────────────────
      if (!cancelled) setPhase({ kind: "store-opening", recipeUri });

      // /meme-sync WS — read from explicit meta tag; fall back to same-origin derivation.
      const syncWsUrl: string = (typeof document !== "undefined"
        ? document.querySelector('meta[name="lararium-meme-sync"]')?.getAttribute("content")
        : null)
        ?? (() => {
          const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
          return `${proto}//${typeof location !== "undefined" ? location.host : "localhost:4321"}/meme-sync`;
        })();

      const storeUrl  = readMemeStoreUrl(hostId);
      const identity  = await getOrCreateBrowserIdentity();
      const serverDid = (typeof document !== "undefined"
        ? document.querySelector('meta[name="lararium-operator-did"]')?.getAttribute("content")
        : undefined) ?? undefined;

      let repoResult: MemeRepoResult;
      try {
        repoResult = await initMemeRepo({ hostId, syncWsUrl, storeUrl, identity, ...(serverDid && { serverDid }) });
      } catch (err: unknown) {
        const msg = err instanceof Error ? `${err.message}` : String(err);
        console.error("[lararium] meme store init failed:", err);
        if (!cancelled) setPhase({ kind: "error", message: `Meme store init failed: ${msg}` });
        return;
      }
      if (cancelled) { return; }

      repoRef.current = repoResult.repo;
      const s = repoResult.store;

      const seedCount = (await s.listVisible()).length;
      setStore(s);
      setPhase({ kind: "store-ready", titleCount: seedCount });

      // ── TW5 ───────────────────────────────────────────────────────────────
      if (!cancelled) setPhase({ kind: "tw5-opening", hostId });
      const t = new LarariumTW5();
      try {
        await t.boot();
        tw5Ref.current = t;
        setActiveTW5(t);
      } catch (err: unknown) {
        console.warn("[lararium-browser-host] TW5 boot failed:", err);
        if (!cancelled) setPhase({ kind: "error", message: `TW5 boot failed: ${String(err)}` });
        return;
      }

      // Seed TW5 wiki from the Automerge store before signaling tw5-ready.
      // buildReactionGraph() fires as soon as tw5 state is set, so the wiki
      // must be populated first — otherwise the reaction graph sees an empty store.
      await t.loadFromStore(s, (loaded, total) => {
        if (!cancelled) setPhase({ kind: "tw5-hydrating", loaded, total });
      });

      if (!cancelled) { setTw5(t); setPhase({ kind: "tw5-ready", hostId }); }

      // Bind TW5 to the AutomergeMemeStore via CRDT sync adaptor.
      // crdt-remote changes (Automerge → TW5): adaptor.start() subscribes to store.
      // tw-local changes (TW5 → Automerge): onWikiChange wires TW5 wiki edits back
      // to the store via adaptor.saveTiddler — completing the local-first write ring.
      // Two-direction sync via adaptor + isomorphic TW5 syncer:
      //   adaptor.start()   → Automerge → TW5  (crdt-remote changes apply to wiki)
      //   t.startSyncer()   → TW5 → Automerge  (wiki edits write back to store)
      const adaptor   = new LarariumCrdtSyncAdaptor(t, s, `${hostId}:${roomId}`);
      const stopStore  = adaptor.start();
      const stopSyncer = t.startSyncer(adaptor);

      stopAdaptorRef.current = () => { stopStore(); stopSyncer(); };

      if (!cancelled) { setPhase({ kind: "live", offset: 0 }); setIsLive(true); }
    }

    run().catch((err: unknown) => {
      if (!cancelled) setPhase({ kind: "error", message: String(err) });
    });

    return () => {
      cancelled = true;
      stopAdaptorRef.current?.();
      stopAdaptorRef.current = null;
      setActiveTW5(null);
      // Note: Repo does not need explicit teardown — IndexedDB adapter flushes on close.
    };
  // roomId is the capability scope boundary — a room change tears down the
  // old adaptor + TW5 wiki and boots a fresh isolated instance for the new space.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.roomId]);

  return { phase, store, tw5, receipt, isLive };
}


