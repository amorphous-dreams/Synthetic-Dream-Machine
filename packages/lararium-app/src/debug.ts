/**
 * __larariumDebug — browser console inspection surface.
 *
 * Typed window augmentation replaces scattered `(window as any)` casts.
 * All fields are optional — they populate progressively as the host opens.
 * Access via: window.__larariumDebug.<key>
 */

import type { LarariumTW5 } from "@lararium/tw5";
import type { AutomergeMemeStore } from "./automerge-store.js";
import type { LarariumOpenPhase } from "@lararium/core";
import type { LarViewAction } from "@lararium/tldraw";
import type React from "react";

export interface LarariumDebug {
  store?:                unknown;       // tldraw useSync store object
  editor?:               unknown;       // tldraw Editor instance
  tiddlerStore?:         AutomergeMemeStore | null;
  hostReceipt?:          string | null;
  receiptShape?:         unknown;       // boot-receipt meta-frame shape record
  openPhase?:            LarariumOpenPhase | null;
  tw5?:                  LarariumTW5 | null;
  projectionCacheCount?: unknown;
  dispatch?:             React.Dispatch<LarViewAction> | null;
}

declare global {
  interface Window {
    __larariumDebug: LarariumDebug;
  }
}

export function debugSet<K extends keyof LarariumDebug>(
  key: K,
  value: LarariumDebug[K],
): void {
  window.__larariumDebug ??= {};
  window.__larariumDebug[key] = value;
}
