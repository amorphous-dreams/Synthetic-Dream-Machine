/**
 * oracle-read-face — the node-side wiring of the Two-Faced Substrate.
 *
 * Serves the oracle doc as the READ-ONLY PUBLIC substrate over the node's existing HTTP
 * server (no new tech, no new port):
 *   GET /oracle/pointer      → the locally published signed causal pointer (JSON)
 *   GET /oracle/<cid>.bin    → the content-addressed snapshot bytes (Automerge.save)
 *
 * Write-refusal is by construction: only GET is served, the bytes are named by their
 * own hash, and there is no sync session — nothing to write. On each oracle-doc change
 * the face re-exports the snapshot and publishes a fresh causal pointer. The local
 * causal frontier persists to disk so a reboot can continue the same lineage.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 * (the content-addressed floor; Hypercore live-streaming rides above it as the
 * deferred end-goal). The pure core (export/build/verify) lives in @lararium/mesh.
 */

import type { Server, IncomingMessage, ServerResponse } from "node:http";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { readFileSync, mkdirSync } from "node:fs";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { join } from "node:path";
import type { DocHandle } from "@automerge/automerge-repo";
import type { Doc } from "@automerge/automerge";
import { ORACLE_ROUTE_PREFIX, ORACLE_POINTER_ROUTE, ORACLE_SNAPSHOT_RE } from "@lararium/mesh";
import {
  exportOracleSnapshot, buildOraclePointer, oraclePointerId, verifyOraclePointer, snapshotPublicFlowMap,
  type OracleSnapshot, type OraclePointer, type LarDoc,
} from "@lararium/mesh";

/** Persists the local causal head and exact publication so restart preserves the causal closure. */
const STATE_FILE = "oracle-pointer-state.json";

interface PersistedPointerState {
  readonly headIds:        readonly string[];
  readonly cid:           string | null;  // the last published content hash (detect a real change vs a reboot)
  readonly pointer?:       OraclePointer; // exact durable publication for unchanged restart
}

export interface OracleReadFace {
  /** Tear down the change-subscription + the HTTP request handler. */
  readonly dispose: () => void;
}

/**
 * Mount the read-face on a running HTTP server, exporting from the oracle handle and
 * signing pointers with the node's seed. Idempotent in effect — re-exports only when
 * the oracle doc's content hash actually changes.
 */
export async function mountOracleReadFace(args: {
  readonly httpServer:   Server;
  readonly oracleHandle: DocHandle<unknown>;
  readonly signerSeed:   Uint8Array;
  readonly storageDir:   string;
  readonly dispatcher?:   HttpFaceDispatcher;
  readonly onLog?:       (line: string) => void;
  /** Export fn — defaults to exportOracleSnapshot (the raw doc). A FLOW-map serve passes a shore
   *  variant (snapshotPublicFlowMap) so ONLY the public projection ever crosses the wire. */
  readonly exportSnapshot?: (doc: unknown) => Promise<OracleSnapshot>;
}): Promise<OracleReadFace> {
  const { httpServer, oracleHandle, signerSeed, storageDir, onLog } = args;
  const exportSnapshot = args.exportSnapshot ?? ((doc: unknown) => exportOracleSnapshot(doc as Doc<unknown>));
  const statePath = join(storageDir, STATE_FILE);

  let snapshot: OracleSnapshot | null = null;
  let pointer:  OraclePointer  | null = null;

  // Load the persisted local causal frontier. Old scalar state is intentionally
  // ignored: early alpha has no compatibility bridge between pointer models.
  let persisted: PersistedPointerState = { headIds: [], cid: null };
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8")) as PersistedPointerState;
    if (Array.isArray(raw.headIds) && raw.headIds.every((id) => typeof id === "string")) persisted = raw;
  } catch { /* first boot — no prior causal frontier */ }

  // Publish the pointer. A content change advances the local causal frontier.
  // An initial re-publish after reboot reconstructs the same causal pointer;
  // there is no heartbeat and no wall-clock validity branch.
  async function reissue(initial = false): Promise<void> {
    const doc = oracleHandle.doc();
    if (!doc) return;
    const snap = await exportSnapshot(doc);
    const changed = snap.cid !== persisted.cid;
    if (!changed && !initial) return;
    if (!changed && initial && persisted.pointer) {
      const durable = await verifyOraclePointer(persisted.pointer);
      if (durable.ok && persisted.pointer.cid === snap.cid && persisted.headIds.length === 1 && persisted.headIds[0] === persisted.pointer.actCid) {
        snapshot = snap;
        pointer = persisted.pointer;
        return;
      }
    }
    const parents = persisted.headIds;
    const ptr = await buildOraclePointer({ snapshot: snap, parents, signerSeed });
    snapshot = snap;
    pointer  = ptr;
    if (changed) {
      const id = await oraclePointerId(ptr);
      persisted = { headIds: [id], cid: snap.cid, pointer: ptr };
      try {
        mkdirSync(storageDir, { recursive: true });
        atomicWriteFileSync(statePath, JSON.stringify(persisted));
      } catch { /* quota — the in-memory pointer still serves this run */ }
      onLog?.(`oracle read-face: act=${id.slice(0, 12)}… cid=${snap.cid.slice(0, 12)}… (${snap.bytes.byteLength}B)`);
    }
  }

  await oracleHandle.whenReady();
  await reissue(true);
  const onChange = (): void => { void reissue(false); };
  oracleHandle.on("change", onChange);

  // The read-face is the PUBLIC read-only plane — it reads to ANY origin (a node-less
  // browser vessel on elyncia.app / localhost dev reads cross-origin). Open CORS is
  // correct + pono here: no credentials, no writes, content verified by hash + signature.
  const CORS: Record<string, string> = {
    "access-control-allow-origin":  "*",
    "access-control-allow-methods": "GET, HEAD, OPTIONS",
    "access-control-allow-headers": "*",
  };
  const onRequest = (req: IncomingMessage, res: ServerResponse): void => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!pathname.startsWith(ORACLE_ROUTE_PREFIX)) return; // not ours — leave for other handlers
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; } // preflight
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { ...CORS, "content-type": "text/plain" });
      res.end("method not allowed");
      return;
    }
    if (pathname === ORACLE_POINTER_ROUTE) {
      if (!pointer) { res.writeHead(503, CORS); res.end("no pointer yet"); return; }
      res.writeHead(200, { ...CORS, "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(pointer));
      return;
    }
    const m = pathname.match(ORACLE_SNAPSHOT_RE);
    if (m && snapshot && m[1] === snapshot.cid) {
      res.writeHead(200, {
        ...CORS,
        "content-type":  "application/octet-stream",
        "cache-control": "public, immutable, max-age=31536000", // content-addressed → never stale
      });
      res.end(Buffer.from(snapshot.bytes));
      return;
    }
    res.writeHead(404, { ...CORS, "content-type": "text/plain" });
    res.end("unknown or stale oracle cid");
  };
  const unregister = args.dispatcher?.register({
    name: "oracle",
    routeKeys: ["oracle:/oracle"],
    owns: (req) => new URL(req.url ?? "/", "http://localhost").pathname.startsWith(ORACLE_ROUTE_PREFIX),
    handle: onRequest,
  });
  if (!unregister) httpServer.on("request", onRequest);

  return {
    dispose: () => {
      oracleHandle.off("change", onChange);
      if (unregister) unregister();
      else httpServer.off("request", onRequest);
    },
  };
}

/**
 * Mount a vessel's PUBLIC FLOW-map (the mesh-palace projection) as a read-face. The disclosure
 * shore applies BEFORE the snapshot (snapshotPublicFlowMap), so only coarse public FLOW crosses
 * the wire — the private territory never leaves. A Herm serves this as its sole substrate (at
 * `/oracle/`); a peer pulls it with the same `pullAndVerifyOracle`. The Lares Viales floor on the wire.
 */
export function mountFlowMapReadFace(args: {
  readonly httpServer:       Server;
  readonly meshPalaceHandle: DocHandle<unknown>;
  readonly signerSeed:       Uint8Array;
  readonly storageDir:       string;
  readonly dispatcher?:      HttpFaceDispatcher;
  readonly onLog?:           (line: string) => void;
}): Promise<OracleReadFace> {
  return mountOracleReadFace({
    httpServer:     args.httpServer,
    oracleHandle:   args.meshPalaceHandle,
    signerSeed:     args.signerSeed,
    storageDir:     args.storageDir,
    ...(args.dispatcher ? { dispatcher: args.dispatcher } : {}),
    ...(args.onLog ? { onLog: args.onLog } : {}),
    exportSnapshot: (doc: unknown) => snapshotPublicFlowMap(doc as LarDoc),
  });
}
