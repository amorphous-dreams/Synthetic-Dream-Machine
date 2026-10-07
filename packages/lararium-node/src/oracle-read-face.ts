/**
 * oracle-read-face — the node-side wiring of the Two-Faced Substrate.
 *
 * Serves the oracle doc's signed causal pointer and the content-addressed snapshot it names (Automerge.save)
 * to PEERS WHO PROVED FIRST, over the vessel's own gate handshake on one upgrade path:
 *   ws <ORACLE_SOCKET_ROUTE> → lar:challenge · lar:auth · lar:auth-ok → pointer frame · snapshot frame · close
 *
 * The face is NOT an HTTP face. It claims no request path, so every HTTP request for the oracle draws the
 * vessel's closed door, exactly as a path nobody claims; a dialer that cannot prove a key at the gate reads
 * nothing (pronaos#/the-rung-ladder: the oracle rung answers proven peers alone).
 *
 * The gate is the vessel's own (`DaemonAuthGate`, armed with the daemon island's verify shore and the
 * vessel key), so the pointer's signer is the very key the dialer's proof committed to: a peer learns no key
 * from the pointer that the handshake had not already named to it.
 *
 * Write-refusal is by construction: the face only sends, the bytes are named by their own hash, and there is
 * no sync session. On each oracle-doc change the face re-exports the snapshot and publishes a fresh causal
 * pointer. The local causal frontier persists to disk so a reboot can continue the same lineage.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 * (the content-addressed floor; Hypercore live-streaming rides above it as the
 * deferred end-goal). The pure core (export/build/verify) lives in @lararium/mesh.
 */

import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import WebSocket from "isomorphic-ws";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { DaemonAuthGate } from "./daemon-auth-gate.js";
import { readFileSync, mkdirSync } from "node:fs";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { join } from "node:path";
import type { DocHandle } from "@automerge/automerge-repo";
import type { Doc } from "@automerge/automerge";
import {
  ORACLE_SOCKET_ROUTE, ORACLE_POINTER_FRAME, DAEMON_BAG_ID, ed25519VerifyingKeyFromSeed, ed25519SignerFromSeed,
  type AuthVerifierShore, type OraclePointerFrame,
} from "@lararium/mesh";
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
 * Mount the read-face on a running HTTP server's upgrade path, exporting from the oracle handle and
 * signing pointers with the vessel's seed. Idempotent in effect — re-exports only when the oracle doc's
 * content hash actually changes.
 */
export async function mountOracleReadFace(args: {
  readonly httpServer:   Server;
  readonly oracleHandle: DocHandle<unknown>;
  /** The VESSEL seed — it signs the pointer, and its key is the gate key a dialer proves against. */
  readonly signerSeed:   Uint8Array;
  readonly storageDir:   string;
  /** The daemon island's verify shore — the gate admits a dialer on its verdict, as the vessel's relay gate does. */
  readonly authShore:    AuthVerifierShore;
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

  // THE GATE — the vessel's own handshake on its own socket server. Only a socket that passed it reaches
  // `connection`; every other socket was denied and closed by the gate before a frame of the map was sent.
  const wss  = new WebSocket.Server({ noServer: true });
  const gate = new DaemonAuthGate(wss);
  // The vessel key is the gate key: it signs each verdict back to the dialer, and the same key signs the pointer.
  gate.arm(args.authShore, DAEMON_BAG_ID, {
    pubKey: await ed25519VerifyingKeyFromSeed(signerSeed), sign: ed25519SignerFromSeed(signerSeed),
  });
  gate.on("connection", (socket: WebSocket) => {
    // Read the pair once, so the pointer and the bytes it names always leave together.
    const p = pointer, snap = snapshot;
    if (!p || !snap) { socket.close(1000); return; }
    const frame: OraclePointerFrame = { type: ORACLE_POINTER_FRAME, pointer: p };
    socket.send(JSON.stringify(frame));
    socket.send(Buffer.from(snap.bytes));
    socket.close(1000);
  });
  const upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  };
  const unregister = args.dispatcher?.registerUpgrade({ name: "oracle", path: ORACLE_SOCKET_ROUTE, handle: upgrade });
  // A bare server (no dispatcher) carries one listener that answers this path alone and leaves every other.
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (new URL(req.url ?? "/", "http://localhost").pathname === ORACLE_SOCKET_ROUTE) upgrade(req, socket, head);
  };
  if (!unregister) httpServer.on("upgrade", onUpgrade);

  return {
    dispose: () => {
      oracleHandle.off("change", onChange);
      if (unregister) unregister();
      else httpServer.off("upgrade", onUpgrade);
      for (const client of wss.clients) client.terminate();
      wss.close();
    },
  };
}

/**
 * Mount a vessel's FLOW-map (the mesh-palace projection) as a read-face. The disclosure shore applies
 * BEFORE the snapshot (snapshotPublicFlowMap), so only coarse public FLOW crosses the wire — the private
 * territory never leaves. A Herm serves this as its sole substrate; a proven peer pulls it with the same
 * `pullAndVerifyOracle`. The Lares Viales floor on the wire.
 */
export function mountFlowMapReadFace(args: {
  readonly httpServer:       Server;
  readonly meshPalaceHandle: DocHandle<unknown>;
  readonly signerSeed:       Uint8Array;
  readonly storageDir:       string;
  readonly authShore:        AuthVerifierShore;
  readonly dispatcher?:      HttpFaceDispatcher;
  readonly onLog?:           (line: string) => void;
}): Promise<OracleReadFace> {
  return mountOracleReadFace({
    httpServer:     args.httpServer,
    oracleHandle:   args.meshPalaceHandle,
    signerSeed:     args.signerSeed,
    storageDir:     args.storageDir,
    authShore:      args.authShore,
    ...(args.dispatcher ? { dispatcher: args.dispatcher } : {}),
    ...(args.onLog ? { onLog: args.onLog } : {}),
    exportSnapshot: (doc: unknown) => snapshotPublicFlowMap(doc as LarDoc),
  });
}
