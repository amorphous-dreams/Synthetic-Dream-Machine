/**
 * lararium-browser-host — async host opening sequence for the browser.
 *
 * Opening law (authority-first, mirrors Keyhive/Beelay sync ordering):
 *   host-opening → authority-opening → authority-ready
 *   → manifest-opening → manifest-ready
 *   → store-opening → store-ready
 *   → tw5-opening → tw5-ready
 *   → projection-opening → projection-ready
 *   → live
 *
 * Hard rules:
 *   - No full-page blocking; caller mounts tldraw immediately.
 *   - No second WebSocket; boot receipt arrives through tldraw room metadata.
 *   - MemoryTiddlerStore receives projection-cache origin when seeded from shape.meta.
 *   - projection-cache origin must never be promoted to canon.
 *   - TW5 boots AFTER store-ready; store-ready precedes tw5-ready.
 */

import { useState, useEffect, useRef } from "react";
import type { Editor } from "tldraw";
import type { LarariumOpenPhase } from "@lararium/core";
import { LarariumTW5, MemoryTiddlerStore } from "@lararium/tw5";

// Stable shape ID for the boot-receipt meta-frame emitted by serve.ts.
const BOOT_RECEIPT_SHAPE_ID = "shape:lararium_boot_receipt";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface BrowserHostOptions {
  hostId:     string;
  recipeUri:  string;
  /** Room ID used for projection phase label. */
  roomId:     string;
  /** Only boot TW5 when renderMode === "tw5". Native mode skips TW5 entirely. */
  renderMode: "native" | "tw5";
}

// ---------------------------------------------------------------------------
// openBrowserLarariumHost — async generator yielding opening phases
// ---------------------------------------------------------------------------

export async function* openBrowserLarariumHost(
  options: BrowserHostOptions,
): AsyncGenerator<LarariumOpenPhase> {
  const { hostId, recipeUri, roomId } = options;

  yield { kind: "host-opening", hostId };

  // Authority phase — in development: local-operator, no Orichalcum round-trip.
  yield { kind: "authority-opening", hostId };
  // Boot receipt is delivered through the tldraw room metadata record (Q3 ruling).
  // The generator does not wait for WS here; caller feeds receipt when available.
  const receipt = `local-operator:${hostId}`;
  yield { kind: "authority-ready", receipt };

  // Manifest phase — enumerate visible tiddler titles (empty until store loads).
  yield { kind: "manifest-opening", recipeUri };
  yield { kind: "manifest-ready", titles: [] };

  // Store phase — MemoryTiddlerStore opens immediately; projection-cache seeding
  // happens separately via bridgeProjectionCache() after editor mounts.
  yield { kind: "store-opening", recipeUri };
  const store = new MemoryTiddlerStore();
  yield { kind: "store-ready", titleCount: 0 };

  // TW5 phase — boot AFTER store-ready (store-ready → tw5-opening ordering law).
  yield { kind: "tw5-opening", hostId };
  const tw5 = new LarariumTW5();
  await tw5.boot();
  yield { kind: "tw5-ready", hostId };

  // Projection phase — canvas shapes will be bridged by useLarariumHostOpen effect.
  yield { kind: "projection-opening", roomId };
  yield { kind: "projection-ready", roomId };

  yield { kind: "live", offset: 0 };

  // Yield store and tw5 as a sentinel so the caller can extract them.
  // Convention: the generator ends with { kind: "live" }; caller reads store/tw5 from hook state.
  (openBrowserLarariumHost as unknown as Record<string, unknown>)["__last_store"] = store;
  (openBrowserLarariumHost as unknown as Record<string, unknown>)["__last_tw5"]   = tw5;
}

// ---------------------------------------------------------------------------
// useLarariumHostOpen — React hook wrapping the async generator
// ---------------------------------------------------------------------------

export interface HostOpenState {
  phase:      LarariumOpenPhase | null;
  store:      MemoryTiddlerStore | null;
  tw5:        LarariumTW5 | null;
  receipt:    string | null;
  isLive:     boolean;
}

export function useLarariumHostOpen(options: BrowserHostOptions): HostOpenState {
  const [phase,   setPhase]   = useState<LarariumOpenPhase | null>(null);
  const [store,   setStore]   = useState<MemoryTiddlerStore | null>(null);
  const [tw5,     setTw5]     = useState<LarariumTW5 | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [isLive,  setIsLive]  = useState(false);

  // Store and tw5 accumulate inside the generator; we extract them on specific phases.
  const storeRef = useRef<MemoryTiddlerStore | null>(null);
  const tw5Ref   = useRef<LarariumTW5 | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let cancelled = false;
    const opts = optionsRef.current;

    async function run() {
      // We need access to store/tw5 allocated inside the generator.
      // Re-implement inline to capture them without the side-channel hack.
      const { hostId, recipeUri, roomId } = opts;

      const phases: LarariumOpenPhase[] = [
        { kind: "host-opening",      hostId },
        { kind: "authority-opening", hostId },
      ];

      for (const p of phases) {
        if (cancelled) return;
        setPhase(p);
      }

      const r = `local-operator:${hostId}`;
      if (!cancelled) { setPhase({ kind: "authority-ready", receipt: r }); setReceipt(r); }

      if (!cancelled) setPhase({ kind: "manifest-opening", recipeUri });
      if (!cancelled) setPhase({ kind: "manifest-ready", titles: [] });

      if (!cancelled) setPhase({ kind: "store-opening", recipeUri });
      const s = new MemoryTiddlerStore();
      storeRef.current = s;
      if (!cancelled) { setStore(s); setPhase({ kind: "store-ready", titleCount: 0 }); }

      if (!cancelled) setPhase({ kind: "tw5-opening", hostId });
      if (opts.renderMode === "tw5") {
        const t = new LarariumTW5();
        try {
          await t.boot();
          tw5Ref.current = t;
          if (!cancelled) { setTw5(t); setPhase({ kind: "tw5-ready", hostId }); }
        } catch (err: unknown) {
          // TW5 browser boot may fail in environments where Node built-ins are stubbed.
          console.warn("[lararium-browser-host] TW5 boot failed:", err);
          if (!cancelled) setPhase({ kind: "error", message: `TW5 boot failed: ${String(err)}` });
          return;
        }
      } else {
        // Native mode — skip TW5 boot entirely.
        if (!cancelled) setPhase({ kind: "tw5-ready", hostId });
      }

      if (!cancelled) setPhase({ kind: "projection-opening", roomId });
      if (!cancelled) setPhase({ kind: "projection-ready", roomId });
      if (!cancelled) { setPhase({ kind: "live", offset: 0 }); setIsLive(true); }
    }

    run().catch((err: unknown) => {
      if (!cancelled) setPhase({ kind: "error", message: String(err) });
    });

    return () => { cancelled = true; };
  }, []); // intentionally empty — opens once per mount

  return { phase, store, tw5, receipt, isLive };
}

// ---------------------------------------------------------------------------
// useBridgeReceiptFromEditor — discovers boot-receipt meta-frame in tldraw store
// ---------------------------------------------------------------------------

/**
 * Two-hook split (O2 ruling):
 *   useLarariumHostOpen — owns store/TW5 opening; returns placeholder receipt
 *   useBridgeReceiptFromEditor — owns editor timing + real receipt discovery
 *
 * When the boot-receipt meta-frame arrives in the tldraw CRDT store (either
 * already present at editor mount or via late delta), calls onReceipt with
 * the real receiptHash, upgrading hostReceipt from null to the artifact hash.
 *
 * Projection-cache intake (in LarariumCanvas) gates on hostReceipt being non-null.
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

      // Fallback: full scan (handles non-standard IDs or future schema)
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

    // Check at mount — receipt may already be present (O1 ruling: snapshot arrival)
    if (tryFindReceipt()) return;

    // Subscribe for late arrival — delta may carry receipt after initial sync
    const unsub = editor.store.listen(() => { tryFindReceipt(); }, { scope: "document" });
    return unsub;
  }, [editor]);
}
