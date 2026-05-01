/**
 * lararium-browser-host — local-first Automerge-native boot sequence.
 *
 * Authority-first-sync-order (Zelenka / causal-island law):
 *   auth.ready
 *     → openLarariumRepo            (IDB + WS peer — IndexedDB is the first-paint store)
 *       → repo.openOrCreateCatalog  → catalog.ready
 *         → repo.resolveRoomDocUrl
 *           → repo.openOrCreateRoomDoc → room-content.ready
 *             → TW5 boots from CompositeStore
 *               → live
 *
 * Cold-start performance: IndexedDB warms the Automerge doc on return visits (<5s).
 * First-visit cold start is addressed by keeping each island doc small — island split
 * (catalog + room + corpus) is the correct gate, not HTTP JSON fossils.
 *
 * CompositeStore layers (lowest → highest priority):
 *   corpus islands (bag: corpus slug, read-only) — arrive async, non-blocking
 *   room island    (bag: "room",  writable)  — primary content gate
 *
 * One LarariumRepo per browser session.
 * One TW5 instance per roomId (capability/collaboration scope).
 * roomId change triggers clean teardown + reboot.
 */

import { useState, useEffect, useRef } from "react";
import type { LarariumOpenPhase } from "@lararium/core";
import { ReadinessMap, CompositeStore } from "@lararium/core";
import { LarariumTW5, LarariumCrdtSyncAdaptor, setActiveTW5 } from "@lararium/tw5";
import { openLarariumRepo, readCatalogUrl, type LarariumRepo } from "./automerge-store.js";
import type { AutomergeMemeStore } from "./automerge-store.js";
import { getOrCreateBrowserAuthReceipt } from "./operator-key.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BrowserHostOptions { hostId: string; roomId: string; }

export interface HostOpenState {
  phase:     LarariumOpenPhase | null;
  repo:      LarariumRepo | null;
  /** Composite store: corpus layers (canon, read-only) + room layer (writable). */
  store:     CompositeStore | null;
  tw5:       LarariumTW5 | null;
  receipt:   string | null;
  isLive:    boolean;
  readiness: ReadinessMap;
}

// ---------------------------------------------------------------------------
// Meta tag helpers
// ---------------------------------------------------------------------------

function readBootReceipt(hostId: string): string {
  if (typeof document !== "undefined") {
    const r = document.querySelector('meta[name="lararium-receipt"]')?.getAttribute("content")?.trim();
    if (r) return r;
  }
  return `local-operator:${hostId}`;
}

function readSyncWsUrl(): string {
  if (typeof document !== "undefined") {
    const meta = document.querySelector('meta[name="lararium-meme-sync"]')?.getAttribute("content");
    if (meta) return meta;
  }
  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss:" : "ws:";
  const host  = typeof location !== "undefined" ? location.host : "localhost:4321";
  return `${proto}//${host}/meme-sync`;
}

// ---------------------------------------------------------------------------
// useLarariumHostOpen
// ---------------------------------------------------------------------------

export function useLarariumHostOpen(options: BrowserHostOptions): HostOpenState {
  const [phase,   setPhase]   = useState<LarariumOpenPhase | null>(null);
  const [repo,    setRepo]    = useState<LarariumRepo | null>(null);
  const [store,   setStore]   = useState<CompositeStore | null>(null);
  const [tw5,     setTw5]     = useState<LarariumTW5 | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isLive,  setIsLive]  = useState(false);

  const readinessRef   = useRef<ReadinessMap>(new ReadinessMap());
  const tw5Ref         = useRef<LarariumTW5 | null>(null);
  const stopAdaptorRef = useRef<(() => void) | null>(null);
  const optionsRef     = useRef(options);
  optionsRef.current   = options;

  useEffect(() => {
    let cancelled = false;
    const { hostId, roomId } = optionsRef.current;

    setPhase(null); setRepo(null); setStore(null); setTw5(null); setIsLive(false);

    const readiness = readinessRef.current;

    async function run() {
      // ── Authority ─────────────────────────────────────────────────────────
      setPhase({ kind: "host-opening",     hostId });
      setPhase({ kind: "authority-opening", hostId });

      const authReceipt = await getOrCreateBrowserAuthReceipt();
      if (cancelled) return;
      // No receipt → caller must show AuthGate; abort boot.
      if (!authReceipt) {
        setPhase({ kind: "authority-opening", hostId }); // stays here — AuthGate takes over
        return;
      }
      const r = readBootReceipt(hostId);
      setPhase({ kind: "authority-ready", receipt: r });
      setReceipt(r);
      readiness.mark("auth");

      // ── Repo ──────────────────────────────────────────────────────────────
      setPhase({ kind: "store-opening", recipeUri: roomId });

      const syncWsUrl  = readSyncWsUrl();
      const catalogUrl = readCatalogUrl(hostId);

      let larariumRepo: LarariumRepo;
      try {
        larariumRepo = await openLarariumRepo({
          hostId, syncWsUrl,
          ...(authReceipt && { authReceipt }),
        });
        if (cancelled) return;
        setRepo(larariumRepo);
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `Repo init failed: ${String(err)}` });
        return;
      }

      // ── Catalog ───────────────────────────────────────────────────────────
      let catalogHandle;
      try {
        catalogHandle = await larariumRepo.openOrCreateCatalog(catalogUrl);
        if (cancelled) return;
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `Catalog failed: ${String(err)}` });
        return;
      }
      const roomDocUrl    = larariumRepo.resolveRoomDocUrl(catalogHandle, roomId);
      const corpusDocUrls = larariumRepo.resolveCorpusDocUrls(catalogHandle);
      readiness.mark("catalog");

      // ── Room content doc ──────────────────────────────────────────────────
      let roomStore: AutomergeMemeStore;
      try {
        roomStore = await larariumRepo.openOrCreateRoomDoc(catalogHandle, roomId, roomDocUrl);
        if (cancelled) return;
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `Room doc failed: ${String(err)}` });
        return;
      }

      // Build composite: room is the writable top layer.
      const composite = new CompositeStore();
      composite.addLayer({ bagId: "room", store: roomStore, writable: true });

      const seedCount = (await composite.listVisible()).length;
      setStore(composite);
      setPhase({ kind: "store-ready", titleCount: seedCount });
      readiness.mark("room-content");

      // ── Corpus islands — parallel, non-blocking ───────────────────────────
      // Each corpus doc opens below room layer; shrine-lights as they arrive.
      for (const [bagId, docUrl] of Object.entries(corpusDocUrls)) {
        larariumRepo.openCorpusDoc(bagId, docUrl).then((corpusStore) => {
          if (cancelled) return;
          composite.addLayer({ bagId, store: corpusStore, writable: false });
          readiness.mark(`corpus:${bagId}` as Parameters<typeof readiness.mark>[0]);
        }).catch((err: unknown) => {
          console.warn(`[lararium] corpus ${bagId} open failed (non-fatal):`, err);
        });
      }

      // ── TW5 ───────────────────────────────────────────────────────────────
      setPhase({ kind: "tw5-opening", hostId });
      const t = new LarariumTW5();
      try {
        await t.boot();
        tw5Ref.current = t;
        setActiveTW5(t);
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `TW5 boot failed: ${String(err)}` });
        return;
      }

      await t.loadFromStore(composite, (loaded, total) => {
        if (!cancelled) setPhase({ kind: "tw5-hydrating", loaded, total });
      });
      if (cancelled) return;

      setTw5(t);
      setPhase({ kind: "tw5-ready", hostId });
      readiness.mark("tw-vm");

      // Adaptor: composite.subscribe() fans out to all layers;
      // composite.put() routes to room layer only.
      const adaptor    = new LarariumCrdtSyncAdaptor(t, composite, `${hostId}:${roomId}`);
      const stopStore  = adaptor.start();
      const stopSyncer = t.startSyncer(adaptor);
      stopAdaptorRef.current = () => { stopStore(); stopSyncer(); };

      setPhase({ kind: "live", offset: 0 });
      setIsLive(true);
    }

    run().catch((err: unknown) => {
      if (!cancelled) setPhase({ kind: "error", message: String(err) });
    });

    return () => {
      cancelled = true;
      stopAdaptorRef.current?.();
      stopAdaptorRef.current = null;
      setActiveTW5(null);
    };
  // roomId is the capability scope — change triggers clean teardown + reboot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.roomId]);

  return { phase, repo, store, tw5, receipt, isLive, readiness: readinessRef.current };
}
