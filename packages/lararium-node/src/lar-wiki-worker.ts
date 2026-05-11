/**
 * lar-wiki-worker — wiki Worker entry point.
 *
 * One instance runs per hot-tier wiki slot. Owns a TW5Engine (and in P.3.5
 * a ReactionEngine) co-located in the Worker thread, providing synchronous
 * in-thread reads with no StructuredClone overhead on the hot path.
 *
 * ## Lifecycle (GP-5 contract)
 *
 *   main                          Worker
 *   ────                          ──────
 *   new Worker(url)               → thread boots, awaits first message
 *   postMessage(promote)          → boot TW5 from snapshotTiddlers
 *                                 ← promote:ack
 *   postMessage(changeset, [...]) → apply to local AM replica (P.3.5)
 *                                 ← event (RE reaction, P.3.5)
 *   postMessage(teardown)         → cancel live KumuCancelable handles
 *                                 ← teardown:ack (+ snapshotTiddlers)
 *   worker.terminate()            → thread terminates
 *
 * ## What runs in this thread
 *
 *   TW5Engine — full TiddlyWiki kernel, in-memory, booted from snapshotTiddlers.
 *   ReactionEngine — boots after TW5Engine in the promote handler; onAnyFire
 *     forwards fired reactions to main as WorkerMsg_Event for vm-ring routing.
 *   Automerge local replica — TODO P.3.5: apply changeset bytes, diff → TW5 sync.
 *
 * ## What does NOT run in this thread
 *
 *   MemeSyncAdaptor — no CompositeStore access; main thread feeds changesets.
 *   Automerge-repo / DocHandle — Worker holds a local replica, not a live handle.
 *   WebSocket / network — main thread owns all I/O.
 *   CryptoKey material — stays in main thread (GP-4).
 *
 * Meme: lar:///ha.ka.ba/@lararium/node/v0.1/lar-wiki-worker
 */

import { parentPort } from "worker_threads";
import { TW5Engine } from "@lararium/tw5";
import { ReactionEngine } from "@lararium/core";
import {
  isMainToWorkerMsg,
  mkPromoteAck,
  mkTeardownAck,
  mkFault,
} from "./lar-worker-protocol.js";
import type { WorkerToMainMsg, WorkerMsg_Event } from "./lar-worker-protocol.js";

if (!parentPort) {
  throw new Error("[lar-wiki-worker] parentPort is null — must run as a Worker thread.");
}

// ---------------------------------------------------------------------------
// Per-slot state
// ---------------------------------------------------------------------------

let tw5:          TW5Engine | null = null;
let wikiUri:      string | null    = null;

/**
 * Live cancellable handles.
 * In P.3.5 these will be real Cancelable objects from RE subscriptions.
 * For now the set stays empty; teardown always sends ack immediately.
 */
const liveHandles = new Set<{ cancel(): void }>();

// ---------------------------------------------------------------------------
// Post helper — typed send to main
// ---------------------------------------------------------------------------

function post(msg: WorkerToMainMsg): void {
  parentPort!.postMessage(msg);
}

function postFault(uri: string, err: unknown): void {
  post(mkFault(uri, String(err)));
}

// ---------------------------------------------------------------------------
// Tiddler snapshot — materialize TW5 state to plain objects
// ---------------------------------------------------------------------------

function captureTiddlers(): Record<string, unknown>[] {
  if (!tw5) return [];
  try {
    const wiki   = tw5.$tw.wiki;
    const titles = wiki.filterTiddlers("[all[tiddlers]!prefix[$:/]]") as string[];
    return titles
      .map((t: string) => wiki.getTiddler(t) as { fields: Record<string, unknown> } | undefined)
      .filter((t): t is { fields: Record<string, unknown> } => t !== undefined)
      .map((t) => ({ ...t.fields }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// GP-5 teardown sequence (shared by teardown + demote)
// ---------------------------------------------------------------------------

function runTeardown(): void {
  // Cancel all live KumuCancelable handles before sending ack.
  for (const h of liveHandles) h.cancel();
  liveHandles.clear();

  const snapshotTiddlers = captureTiddlers();

  // Dispose TW5Engine — frees V8 heap before main calls worker.terminate().
  tw5?.dispose();
  tw5 = null;

  post(mkTeardownAck(snapshotTiddlers));
  // Thread stays alive until main calls worker.terminate().
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

parentPort.on("message", async (raw: unknown) => {
  if (!isMainToWorkerMsg(raw)) {
    if (wikiUri) postFault(wikiUri, `unexpected message shape: ${JSON.stringify(raw)}`);
    return;
  }

  // ── promote ────────────────────────────────────────────────────────────
  if (raw.type === "promote") {
    wikiUri = raw.wikiUri;
    try {
      tw5 = new TW5Engine();
      const tiddlers = raw.snapshotTiddlers;
      await tw5.boot(
        undefined,
        tiddlers && tiddlers.length > 0
          ? (tiddlers as Record<string, unknown>[])
          : undefined,
      );

      // P.3.5 — ReactionEngine co-located with TW5Engine in the Worker thread.
      // onAnyFire forwards every fired reaction to main as a WorkerMsg_Event so
      // the main thread can route it through the vm-ring on the event bus.
      const re = new ReactionEngine();
      re.boot(tw5.$tw.wiki);
      liveHandles.add({
        cancel: re.onAnyFire((fromUri, listenable, payload) => {
          const safePayload: Record<string, string | number | boolean> = {};
          if (payload && typeof payload === "object") {
            for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
              if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
                safePayload[k] = v;
              }
            }
          }
          const evt: WorkerMsg_Event = {
            schema_version: 1,
            type: "event",
            wikiUri: wikiUri!,
            eventId: listenable,
            payload: safePayload,
          };
          post(evt);
        }),
      });

      post(mkPromoteAck(wikiUri));
    } catch (err) {
      postFault(wikiUri, err);
    }
    return;
  }

  // ── changeset ──────────────────────────────────────────────────────────
  if (raw.type === "changeset") {
    // TODO P.3.5: apply raw.changeset (Uint8Array, already transferred) to a
    // local Automerge replica; diff before/after to get changedUris; call
    // re.onChangeset(changedUris); forward RE events to main as WorkerMsg_Event.
    //
    // For now: changeset bytes arrive correctly (GP-3 transfer confirmed by
    // worker-protocol.test.ts), but the TW5 state does not yet update.
    // Worker acts as a stateless relay until P.3.5 lands.
    return;
  }

  // ── demote ─────────────────────────────────────────────────────────────
  // P.3 alpha: demote = teardown (thread terminates; main re-promotes when needed).
  // P.3.5 upgrade path: demote could instead pause RE and post demote:ack while
  // keeping the thread alive for fast re-promote.
  if (raw.type === "demote") {
    runTeardown();
    return;
  }

  // ── teardown ───────────────────────────────────────────────────────────
  if (raw.type === "teardown") {
    runTeardown();
    return;
  }
});
