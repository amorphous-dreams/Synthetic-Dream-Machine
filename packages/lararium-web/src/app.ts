/**
 * lararium-web app bootstrap — STUB.
 *
 * Intent (pending Automerge-native redesign):
 *
 *   LarApp holds the live browser state: runtime, rooms, tldraw emission, view state.
 *   Each "Room" is a tldraw page driven by a TW filter expression.
 *   Portals are navigation arrows between rooms.
 *
 * Boot sequence (target):
 *   1. Read <meta name="lararium-meme-store"> URL from HTML shell
 *   2. Open Automerge doc at that URL (automerge-store.ts handles this)
 *   3. TW5 boots from Automerge doc contents (already live in lararium-browser-host.ts)
 *   4. projectFromTw5(tw5) → tldraw records (already live in LarariumShell.tsx)
 *
 * The snapshot/embedded-bundle boot path below remains as a stub for offline/kiosk
 * scenarios where no Automerge server is reachable.
 */

import type { BrowserRuntime, LarSnapshot } from "./browser-host.js";
import { createBrowserRuntime, loadSnapshotFromUrl } from "./browser-host.js";

// Re-export for callers that shouldn't need to import browser-host directly.
export type { BrowserRuntime, LarSnapshot };

// ---------------------------------------------------------------------------
// LarApp — the live browser application state (interface only)
// ---------------------------------------------------------------------------

export interface LarApp {
  /** Hydrated browser runtime */
  readonly runtime: BrowserRuntime;
  /** Emission state for tldraw (null until renderViews called) */
  emission: LarAppEmission | null;
}

/** Tldraw-ready emission produced by @lararium/tldraw renderAllViews */
export interface LarAppEmission {
  readonly pages: readonly { id: string; typeName: "page"; name: string; index: string; meta: Record<string, unknown> }[];
  readonly shapes: readonly Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Stubs — pending Automerge-native redesign
// ---------------------------------------------------------------------------

/** @stub Boot from a snapshot URL. */
export async function bootApp(_snapshotUrl: string): Promise<LarApp> {
  throw new Error("bootApp: not implemented — use Automerge-native path via lararium-browser-host.ts");
}

/** @stub Boot from a pre-loaded snapshot object (embedded bundle mode). */
export async function bootFromSnapshot(_snapshot: LarSnapshot): Promise<LarApp> {
  const runtime = await createBrowserRuntime(_snapshot);
  return { runtime, emission: null };
}

/** @stub Boot from a snapshot embedded in the HTML document. */
export async function bootFromEmbedded(scriptId = "lararium-snapshot"): Promise<LarApp> {
  const el = document.getElementById(scriptId);
  if (!el) throw new Error(`bootFromEmbedded: no element with id="${scriptId}" found`);
  const snapshot = JSON.parse(el.textContent ?? "") as LarSnapshot;
  return bootFromSnapshot(snapshot);
}

/** @stub Fetch + boot. Delegates to stub chain above. */
export async function bootFromUrl(url: string): Promise<LarApp> {
  const snapshot = await loadSnapshotFromUrl(url);
  return bootFromSnapshot(snapshot);
}

/** @stub Render tldraw views for a LarApp — requires @lararium/tldraw peer. */
export async function renderAppViews(_app: LarApp): Promise<LarApp> {
  throw new Error("renderAppViews: not implemented — pending Automerge-native redesign");
}
