/**
 * __larariumDebug — browser console inspection surface.
 *
 * Typed window augmentation replaces scattered `(window as any)` casts.
 * All fields are optional — they populate progressively as the host opens.
 * Access via: window.__larariumDebug.<key>
 */

import type { LarariumTW5, VmDebugSurface } from "@lararium/tw5";
import type { LarariumOpenPhase, CompositeStore } from "@lararium/core";
import type { LarViewAction } from "@lararium/tldraw";
import type React from "react";

export interface LarariumDebug {
  editor?:       unknown;                       // tldraw Editor instance
  tiddlerStore?: CompositeStore | null;
  hostReceipt?:  string | null;
  openPhase?:    LarariumOpenPhase | null;
  tw5?:          LarariumTW5 | null;
  dispatch?:     React.Dispatch<LarViewAction> | null;
  /**
   * Isomorphic VM pool debug surface — same shape on every peer.
   *   vmPool.list()                      → active recipe IDs
   *   vmPool.filter(recipeId, expr)      → TW5 filter result
   *   vmPool.filterFirst(expr)           → filter against first VM (single-room shortcut)
   *   vmPool.setTiddler(recipeId, fields) → inject into VM (no Automerge write)
   */
  vmPool?: VmDebugSurface;
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
