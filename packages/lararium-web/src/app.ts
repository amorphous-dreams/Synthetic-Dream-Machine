/**
 * lararium-web app bootstrap — infinite canvas wiki entry point.
 *
 * Architecture (infinite canvas + portals model):
 *
 *   LarApp holds the live browser state: runtime, rooms, tldraw emission, view state.
 *   Each "Room" is a tldraw page driven by a TW filter expression.
 *   Portals are navigation arrows between rooms.
 *   The side panel (story river / control panel) slides in as a CSS overlay — not a
 *   separate tldraw page, following TW's sidebar model: always available, non-destructive.
 *
 * Boot sequence:
 *   1. fetch snapshot.json from URL (or use embedded bundle)
 *   2. createBrowserRuntime(snapshot) — hydrates MemeGraph from carrier texts
 *   3. buildBootClosure(graph) — BFS from AGENTS over control edges → topoUris
 *   4. compileBoot(graph, topoUris, violations) → BootArtifact
 *   5. renderAllViews(artifact, { readText, rooms }) → TldrawEmission (3+ pages)
 *   6. LarApp ready — caller mounts tldraw with emission.pages + emission.shapes
 *
 * TiddlyWiki analogy:
 *   Steps 1-2  → TW boot kernel loading tiddlers from DOM / server
 *   Steps 3-4  → TW story list compilation (which tiddlers to render)
 *   Step 5     → TW rendering pipeline (template cascade → story river)
 *   LarApp     → $:/core/ui/PageTemplate — the live wiki root
 */

import {
  buildBootClosure,
  compileBoot,
  compileBootReceipt,
  type BootArtifact,
  type BootReceipt,
} from "@lararium/core";

import { createBrowserRuntime, loadSnapshotFromUrl, type BrowserRuntime } from "./browser-host.js";
import type { LarSnapshot } from "./browser-host.js";

// Re-export for convenience (callers shouldn't need to import browser-host directly)
export type { BrowserRuntime, LarSnapshot };

// ---------------------------------------------------------------------------
// LarApp — the live browser application state
// ---------------------------------------------------------------------------

export interface LarApp {
  /** Hydrated browser runtime (carriers, graph, resolve, readText) */
  readonly runtime: BrowserRuntime;
  /** The compiled minimal boot artifact */
  readonly artifact: BootArtifact;
  /** Boot receipt (SHA-256 of stable artifact content) */
  readonly receipt: BootReceipt;
  /**
   * Tldraw-ready emission: pages + shapes for all rooms.
   * Feed directly to tldraw's loadSnapshot() or store.put().
   *
   * Available after calling renderViews() or automatically via bootApp().
   */
  emission: LarAppEmission | null;
}

/** Deferred import type — avoids pulling lararium-tldraw into core bundle */
export interface LarAppEmission {
  readonly pages: readonly { id: string; typeName: "page"; name: string; index: string; meta: Record<string, unknown> }[];
  readonly shapes: readonly Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

/**
 * Full browser boot from a snapshot URL.
 * Returns a LarApp ready for tldraw mounting.
 *
 * @param snapshotUrl - URL of the snapshot.json produced by lararium-node build-snapshot
 */
export async function bootApp(snapshotUrl: string): Promise<LarApp> {
  const snapshot = await loadSnapshotFromUrl(snapshotUrl);
  return bootFromSnapshot(snapshot);
}

/**
 * Boot from an already-loaded snapshot object (embedded bundle mode).
 * Synchronous after the snapshot is in memory.
 */
export async function bootFromSnapshot(snapshot: LarSnapshot): Promise<LarApp> {
  const runtime = await createBrowserRuntime(snapshot);
  return bootFromRuntime(runtime);
}

/**
 * Boot from a pre-hydrated BrowserRuntime.
 * Used when the caller has already constructed the runtime (e.g. incremental merge).
 */
export async function bootFromRuntime(runtime: BrowserRuntime): Promise<LarApp> {
  const { topoUris, violations } = buildBootClosure(runtime.graph);
  const artifact = compileBoot(runtime.graph, topoUris, violations);
  const receipt = await compileBootReceipt(artifact);

  return { runtime, artifact, receipt, emission: null };
}

/**
 * Render all views for a LarApp and attach the emission.
 * Call after bootFromRuntime/bootFromSnapshot to get tldraw-ready shapes.
 *
 * This is a separate step because lararium-tldraw is an optional peer
 * dependency — callers that only need the graph/artifact skip this step.
 *
 * Usage:
 *   const app = bootFromSnapshot(snapshot);
 *   const { renderAllViews } = await import("@lararium/tldraw");
 *   app.emission = renderAllViews(app.artifact, {
 *     readText: (uri) => { try { return app.runtime.readText(uri); } catch { return null; } },
 *     includeAhuFrames: true,
 *   });
 */
export async function renderAppViews(app: LarApp): Promise<LarApp> {
  // Dynamic import keeps lararium-tldraw out of the core bundle when not needed
  const { renderAllViews } = await import("@lararium/tldraw");
  const emission = renderAllViews(app.artifact, {
    readText: (uri: string) => {
      try { return app.runtime.readText(uri); } catch { return null; }
    },
    includeAhuFrames: true,
  });
  return { ...app, emission: emission as unknown as LarAppEmission };
}

// ---------------------------------------------------------------------------
// Embedded snapshot support (single-file wiki mode)
// ---------------------------------------------------------------------------

/**
 * Boot from a snapshot embedded in the HTML document.
 * TiddlyWiki analogy: loading tiddlers from <script type="text/plain"> blocks.
 *
 * Usage in HTML:
 *   <script type="application/json" id="lararium-snapshot">{ ... }</script>
 *   <script type="module">
 *     import { bootFromEmbedded } from "./lararium-web.es.js";
 *     const app = await bootFromEmbedded();
 *   </script>
 */
export async function bootFromEmbedded(scriptId = "lararium-snapshot"): Promise<LarApp> {
  const el = document.getElementById(scriptId);
  if (!el) throw new Error(`bootFromEmbedded: no element with id="${scriptId}" found`);
  const snapshot = JSON.parse(el.textContent ?? "") as LarSnapshot;
  return bootFromSnapshot(snapshot);
}
