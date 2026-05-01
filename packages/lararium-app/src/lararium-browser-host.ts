/**
 * lararium-browser-host — local-first Automerge-native boot sequence.
 *
 * Authority-first-sync-order (Zelenka / causal-island law):
 *   auth.ready
 *     → openLarariumRepo            (IDB + WS peer — IndexedDB is the first-paint store)
 *       → repo.openOrCreateCatalog  → catalog.ready
 *         → repo.resolveRoomDocUrl
 *           → repo.openOrCreateRoomDoc → room-content.ready
 *             → TW5 boots from CompositeStore (bundle preloads + room content)
 *               → corpus islands arrive async via composite.addLayer (non-blocking)
 *                 → live
 *
 * Single TW5 VM. No server-side snapshot. Bundle preloads (Vite-bundled lares UI
 * tiddlers) are available immediately — TW5 can render a meaningful UI before any
 * corpus doc arrives. Corpus layers arrive non-blocking and are pushed reactively
 * into the live wiki via CompositeStore's addLayer synthetic-change emission.
 *
 * Cold-start: bundle preloads → TW5 live in ~200ms. Corpus arrives over WS.
 * Warm-start (IDB): room + corpus already local → TW5 live in <50ms. WS reconciles.
 *
 * CompositeStore layers (lowest → highest priority):
 *   corpus islands (bag: corpus slug, read-only) — arrive async, non-blocking
 *   room island    (bag: "room",  writable)       — primary content gate
 *
 * One LarariumRepo per browser session.
 * One TW5 instance per roomId (capability/collaboration scope).
 * roomId change triggers clean teardown + reboot.
 */

import { useState, useEffect, useRef } from "react";
import type { LarariumOpenPhase, CatalogDoc } from "@lararium/core";
import { ReadinessMap, CompositeStore } from "@lararium/core";
import {
  LarariumTW5, LarariumCrdtSyncAdaptor, setActiveTW5,
  DirectRecipeVm, attachRecipeVm, releaseRecipeVm, makeRecipeId,
} from "@lararium/tw5";
import { openLarariumRepo, readCatalogUrl, type LarariumRepo } from "./automerge-store.js";
import type { AutomergeMemeStore } from "./automerge-store.js";
import type { DocHandleChangePayload } from "@automerge/automerge-repo";
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
  // Mutable ref so the SW message handler always sees the latest catalog engine entry,
  // even if the catalog doc mutates mid-session (new engine version from mesh peer).
  const engineEntryRef    = useRef<{ version: string; sha256: string; docUrl: string } | null>(null);
  const stopCatalogRef    = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { hostId, roomId } = optionsRef.current;

    setPhase(null); setRepo(null); setStore(null); setTw5(null); setIsLive(false);

    const readiness = readinessRef.current;

    async function run() {
      // ── Authority ─────────────────────────────────────────────────────────
      setPhase({ kind: "host-opening",      hostId });
      setPhase({ kind: "authority-opening", hostId });

      const authReceipt = await getOrCreateBrowserAuthReceipt();
      if (cancelled) return;
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

      // Engine island — post catalog entry to SW for sha256 verification.
      // SW caches the verified blob and notifies us if a new version is available.
      const initialEngineEntry = catalogHandle.doc()?.engine;
      if (initialEngineEntry) {
        engineEntryRef.current = { version: initialEngineEntry.version, sha256: initialEngineEntry.sha256, docUrl: initialEngineEntry.docUrl };
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: "engine-entry", entry: engineEntryRef.current });
        }
      }
      // React to mid-session catalog engine updates — a mesh peer may push a new
      // engine version while the browser is live (Keyhive-signed, any peer can seed).
      const onCatalogChange = ({ doc }: DocHandleChangePayload<CatalogDoc>) => {
        if (cancelled) return;
        const incoming = doc.engine;
        if (!incoming) return;
        if (incoming.version === engineEntryRef.current?.version) return;
        engineEntryRef.current = { version: incoming.version, sha256: incoming.sha256, docUrl: incoming.docUrl };
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ type: "engine-entry", entry: engineEntryRef.current });
        }
      };
      catalogHandle.on("change", onCatalogChange);
      stopCatalogRef.current = () => catalogHandle.removeListener("change", onCatalogChange);

      // Listen for SW messages:
      //   "need-engine-blob"   — SW needs blob bytes for a new version; pull from EngineDoc
      //   "engine-update-cached" — SW has cached a new version; set banner tiddler
      if (navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener("message", (ev) => {
          const data = ev.data as { type?: string; version?: string } | null;
          if (!data) return;

          if (data.type === "need-engine-blob" && engineEntryRef.current?.docUrl) {
            void larariumRepo.openEngineDoc(engineEntryRef.current.docUrl).then((engineDoc) => {
              const blob = engineDoc?.blobs["tiddlywikicore"]?.blob;
              if (!blob || !navigator.serviceWorker.controller) return;
              // Transfer as ArrayBuffer — zero-copy across the message channel.
              const buf = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
              navigator.serviceWorker.controller.postMessage(
                { type: "engine-blob", blob: buf, version: data.version },
                [buf as ArrayBuffer],
              );
            });
          }

          if (data.type === "engine-update-cached" && tw5Ref.current) {
            tw5Ref.current.setTiddler({
              title: "$:/lararium/engine/update-available",
              text: data.version ?? "new",
            });
          }
        });
      }

      // ── Room content doc ──────────────────────────────────────────────────
      let roomStore: AutomergeMemeStore;
      try {
        roomStore = await larariumRepo.openOrCreateRoomDoc(catalogHandle, roomId, roomDocUrl);
        if (cancelled) return;
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `Room doc failed: ${String(err)}` });
        return;
      }
      readiness.mark("room-content");

      // ── TW5 — boot before wiring corpus so adaptor is ready when layers arrive ──
      setPhase({ kind: "tw5-opening", hostId });
      const t = new LarariumTW5();
      try {
        await t.boot();
        t.setBootSplash(true);
        tw5Ref.current = t;
        setActiveTW5(t);
      } catch (err: unknown) {
        setPhase({ kind: "error", message: `TW5 boot failed: ${String(err)}` });
        return;
      }

      // Build composite and wire adaptor before addLayer calls so corpus
      // arrivals are routed through the running adaptor immediately.
      const composite = new CompositeStore();
      const adaptor   = new LarariumCrdtSyncAdaptor(t, composite, `${hostId}:${roomId}`);
      const stopStore  = adaptor.start();
      const stopSyncer = t.startSyncer(adaptor);
      stopAdaptorRef.current = () => { stopStore(); stopSyncer(); };

      // Room layer first (highest priority — user content wins over corpus).
      composite.addLayer({ bagId: "room", store: roomStore, writable: true });

      const seedCount = (await composite.listVisible()).length;
      setStore(composite);

      await t.loadFromStore(composite, (loaded, total) => {
        if (!cancelled) setPhase({ kind: "tw5-hydrating", loaded, total });
      });
      if (cancelled) return;

      setTw5(t);
      setPhase({ kind: "tw5-ready", hostId });
      readiness.mark("tw-vm");

      // Register the live in-process VM with the VmPool so filterRecipe /
      // renderCarrier are available to canvas, MCP, and debug tools without
      // React context or prop threading.
      // Non-owning shim — releaseRecipeVm on teardown does not dispose the VM.
      const recipeId = makeRecipeId([roomId]);
      attachRecipeVm(recipeId, composite, new DirectRecipeVm(t));

      // ── Corpus islands — parallel, non-blocking ───────────────────────────
      // addLayer emits synthetic put-events for existing content so the live
      // adaptor pushes them into TW5 without a reload.
      for (const [bagId, docUrl] of Object.entries(corpusDocUrls)) {
        larariumRepo.openCorpusDoc(bagId, docUrl).then((corpusStore) => {
          if (cancelled) return;
          composite.addLayer({ bagId, store: corpusStore, writable: false });
          readiness.mark(`corpus:${bagId}` as Parameters<typeof readiness.mark>[0]);
        }).catch((err: unknown) => {
          console.warn(`[lararium] corpus ${bagId} open failed (non-fatal):`, err);
        });
      }

      t.setBootSplash(false);
      setPhase({ kind: "store-ready", titleCount: seedCount });
      setPhase({ kind: "live", offset: 0 });
      setIsLive(true);
    }

    run().catch((err: unknown) => {
      if (!cancelled) setPhase({ kind: "error", message: String(err) });
    });

    return () => {
      cancelled = true;
      stopCatalogRef.current?.();
      stopCatalogRef.current = null;
      stopAdaptorRef.current?.();
      stopAdaptorRef.current = null;
      releaseRecipeVm(makeRecipeId([options.roomId]));
      setActiveTW5(null);
    };
  // roomId is the capability scope — change triggers clean teardown + reboot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.roomId]);

  return { phase, repo, store, tw5, receipt, isLive, readiness: readinessRef.current };
}
