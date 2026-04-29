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
import type { Editor } from "tldraw";
import type { LarariumOpenPhase } from "@lararium/core";
import { LarariumTW5, LarariumCrdtSyncAdaptor, setActiveTW5 } from "@lararium/tw5";
import { initMemeRepo, readMemeStoreUrl, type MemeRepoResult } from "./automerge-store.js";
import type { AutomergeMemeStore } from "./automerge-store.js";
import { getOrCreateBrowserIdentity } from "./operator-key.js";
import type { Repo } from "@automerge/automerge-repo";

// Stable shape ID for the boot-receipt meta-frame emitted by serve.ts.
const BOOT_RECEIPT_SHAPE_ID = "shape:lararium_boot_receipt";

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
      // Derive /meme-sync WS URL from the tldraw WS meta tag — same host,
      // different path.  Falls back to relative URL for same-origin serving.
      if (!cancelled) setPhase({ kind: "store-opening", recipeUri });

      const tldrawWsMeta = typeof document !== "undefined"
        ? document.querySelector('meta[name="lararium-ws"]')?.getAttribute("content") ?? null
        : null;

      const syncWsUrl: string = (() => {
        if (tldrawWsMeta) {
          const u = new URL(tldrawWsMeta);
          u.pathname = "/meme-sync";
          u.search   = "";
          return u.toString();
        }
        // Relative fallback — Vite dev proxy or same-origin serve
        const proto = location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${location.host}/meme-sync`;
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
        if (!cancelled) setPhase({ kind: "error", message: `Meme store init failed: ${String(err)}` });
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
        if (!cancelled) { setTw5(t); setPhase({ kind: "tw5-ready", hostId }); }
      } catch (err: unknown) {
        console.warn("[lararium-browser-host] TW5 boot failed:", err);
        if (!cancelled) setPhase({ kind: "error", message: `TW5 boot failed: ${String(err)}` });
        return;
      }

      // Seed TW5 wiki from the Automerge store — one-time initial population.
      // Also scans carrier texts for kumu defs and injects them as tiddlers.
      // After this, LarariumCrdtSyncAdaptor keeps the wiki live via setTiddler/removeTiddler.
      await t.loadFromStore(s);

      // Bind TW5 to the AutomergeMemeStore via CRDT sync adaptor.
      // crdt-remote changes (from Automerge peers) apply to TW5 wiki.
      // tw-local changes (TW5 edits) write back to the Automerge doc.
      const adaptor = new LarariumCrdtSyncAdaptor(t, s, `${hostId}:${roomId}`);
      stopAdaptorRef.current = adaptor.start();

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

// ---------------------------------------------------------------------------
// useBridgeReceiptFromEditor — discovers boot-receipt meta-frame in tldraw store
// ---------------------------------------------------------------------------

/**
 * Reads the real boot-receipt hash from the tldraw CRDT store (shape:lararium_boot_receipt).
 * Separate from the tiddler store boot — the receipt just gates canon-promotion guards.
 */
export function useBridgeReceiptFromEditor(
  editor:    Editor | null,
  onReceipt: (receiptHash: string) => void,
): void {
  const onReceiptRef = useRef(onReceipt);
  onReceiptRef.current = onReceipt;

  useEffect(() => {
    if (!editor) return;

    let found = false;

    function tryFindReceipt(): boolean {
      if (found) return true;

      // Fast path: stable shape ID lookup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const byId = editor!.store.get(BOOT_RECEIPT_SHAPE_ID as any) as Record<string, unknown> | null | undefined;
      if (byId) {
        const m = byId["meta"] as Record<string, unknown> | undefined;
        if (m?.["metaKind"] === "boot-receipt" && typeof m["receiptHash"] === "string") {
          found = true;
          onReceiptRef.current(m["receiptHash"] as string);
          return true;
        }
      }

      // Fallback: full scan
      for (const record of editor!.store.allRecords()) {
        const r = record as unknown as Record<string, unknown>;
        if (r["typeName"] !== "shape") continue;
        const m = r["meta"] as Record<string, unknown> | undefined;
        if (m?.["metaKind"] === "boot-receipt" && typeof m["receiptHash"] === "string") {
          found = true;
          onReceiptRef.current(m["receiptHash"] as string);
          return true;
        }
      }
      return false;
    }

    if (tryFindReceipt()) return;

    const unsub = editor.store.listen(() => { tryFindReceipt(); }, { scope: "document" });
    return unsub;
  }, [editor]);
}
