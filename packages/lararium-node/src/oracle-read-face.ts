/**
 * oracle-read-face — the node-side wiring of the Two-Faced Substrate.
 *
 * Serves the oracle doc's signed causal pointer and the content-addressed snapshot it names (Automerge.save)
 * to PEERS WHO PROVED FIRST, over the FLOOR gate this vessel stands for each Nexus it is handed, on the oracle
 * route behind each gate's own knock (`face-gate-server`):
 *   ws <ORACLE_SOCKET_ROUTE>/<knock> → Noise IK first flight · presentation · verdict → "session" pointer frame ·
 *   "sync" snapshot bytes → close
 *
 * The gates arm with the vessel's ONE sorter over each Nexus's posture, so under PRIVATE a presenter with no arm
 * reads nothing at all — no verdict, no message — exactly like a failed proof. No auth verb rides the channel: the
 * gate's proof is the auth.
 *
 * The face is NOT an HTTP face. It claims no request path, so every HTTP request for the oracle draws the
 * vessel's closed door, exactly as a path nobody claims (pronaos#/the-rung-ladder: the oracle rung answers proven
 * peers alone).
 *
 * THE PUBLISHER'S KEY IS NOT THE GATE'S. The floor bundle derives from the floor key; the pointer is signed by the
 * vessel seed, and a reader names that publisher key out of band (`pullAndVerifyOracle` `verifyingKey`).
 *
 * Write-refusal is by construction: the face only sends, the bytes are named by their own hash, and there is
 * no sync session. On each oracle-doc change the face re-exports the snapshot and publishes a fresh causal
 * pointer. The local causal frontier persists to disk so a reboot can continue the same lineage. A served
 * session closes when its reader closes, or once the linger lapses, so the bytes it sent flush before the cut.
 *
 * Canon: lar:///ha.ka.ba/lares/api/pono/lararium-identity#/the-oracle-plane
 * (the content-addressed floor; Hypercore live-streaming rides above it as the
 * deferred end-goal). The pure core (export/build/verify) lives in @lararium/mesh.
 */

import type { Server, IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import type { HttpFaceDispatcher } from "./http-face-dispatcher.js";
import { GATE_STRANGER_CHANNEL_BOUNDS, faceGateServer, gatePath, gateSessionRegistry } from "./face-gate-server.js";
import { readFileSync, mkdirSync } from "node:fs";
import { atomicWriteFileSync } from "./fs-atomic.js";
import { join } from "node:path";
import type { DocHandle } from "@automerge/automerge-repo";
import {
  ORACLE_POINTER_FRAME,
  type FaceGate, type GateBundlePin, type GateSessionChannel, type GateSessionTable, type OraclePointerFrame,
} from "@lararium/mesh";
import {
  buildOraclePointer, oraclePointerId, verifyOraclePointer, snapshotPublicFlowMap,
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
  /** Tear down the change-subscription, every floor gate and its upgrade, and every open session. */
  readonly dispose: () => void;
}

/** The oracle face on its floor gates: the upgrade pathnames they stand on, one per Nexus. */
export interface OracleFloorFace extends OracleReadFace {
  readonly paths: () => readonly string[];
}

/** How long a served session waits for its reader to close before the face closes it. */
export const ORACLE_LINGER_MS = 10_000;

/** One floor gate on the oracle route for one Nexus, and the pin it answers under. */
export interface OracleFloorGate {
  readonly gate: FaceGate;
  readonly pin:  GateBundlePin;
}

/**
 * The floor gate source: one floor gate per Nexus on `floorRoute(ORACLE_SOCKET_ROUTE)`, each seating through `sessions`.
 * A source whose Nexus set moves (a carry taken or dropped on a running vessel) names it on `onMoved`: the face then
 * asks it again, stands each gate on a path it did not stand, and stands down each path the source no longer names.
 */
export interface OracleGateSource {
  (sessions: GateSessionTable): Promise<readonly OracleFloorGate[]> | readonly OracleFloorGate[];
  /** Follow the source's moves; answers the unfollow. */
  readonly onMoved?: (listener: () => void) => () => void;
}

/** The face's serving shape: its gates, built over the session table the face hands, and where they answer. */
export interface OracleGateArgs {
  /** Build one floor gate per Nexus on `floorRoute(ORACLE_SOCKET_ROUTE)`, each seating through `sessions`; a source
   *  that moves names it on its `onMoved`, and the face re-sweeps. */
  readonly gates:       OracleGateSource;
  readonly httpServer:  Server;
  /** The vessel's dispatcher: each gate's path registers on it. Absent, one upgrade listener on `httpServer`. */
  readonly dispatcher?: HttpFaceDispatcher;
  /** How long a served session waits for its reader to close (`ORACLE_LINGER_MS`). */
  readonly lingerMs?:   number;
}

/**
 * Mount the read-face on a running HTTP server's upgrade path, exporting from the oracle handle and
 * signing pointers with the vessel's seed. Idempotent in effect — re-exports only when the oracle doc's
 * content hash actually changes.
 */
export async function mountOracleReadFace(args: OracleGateArgs & {
  readonly oracleHandle: DocHandle<unknown>;
  /** The VESSEL seed — it signs the pointer. Its key is the publisher's, never the floor gate's. */
  readonly signerSeed:   Uint8Array;
  readonly storageDir:   string;
  readonly onLog?:       (line: string) => void;
  /** The export shore — REQUIRED, so no caller serves a raw document by omission. The oracle serve passes
   *  `snapshotPublicOracle` (the genesis-named floor) and the FLOW-map serve `snapshotPublicFlowMap`, so ONLY
   *  the public projection ever crosses the wire. A snapshot carrying a `seedCid` has it logged beside the
   *  snapshot cid. */
  readonly exportSnapshot: (doc: unknown) => Promise<OracleSnapshot & { readonly seedCid?: string }>;
}): Promise<OracleFloorFace> {
  const { httpServer, oracleHandle, signerSeed, storageDir, onLog } = args;
  const lingerMs = args.lingerMs ?? ORACLE_LINGER_MS;
  const exportSnapshot = args.exportSnapshot;
  if (typeof exportSnapshot !== "function") throw new Error("oracle read-face: exportSnapshot is required; no raw document serves by omission");
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
    if (initial && snap.seedCid) onLog?.(`oracle read-face: floor seed=${snap.seedCid.slice(0, 12)}… cid=${snap.cid.slice(0, 12)}…`);
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
      onLog?.(`oracle read-face: act=${id.slice(0, 12)}… ${snap.seedCid ? `seed=${snap.seedCid.slice(0, 12)}… ` : ""}cid=${snap.cid.slice(0, 12)}… (${snap.bytes.byteLength}B)`);
    }
  }

  await oracleHandle.whenReady();
  await reissue(true);
  const onChange = (): void => { void reissue(false); };
  oracleHandle.on("change", onChange);

  // THE FLOOR GATES — one per Nexus, each seating through this face's own table. Only a session whose verdict left
  // reaches `serve`; every other socket met silence before a byte of the map was sent.
  const serve = (channel: GateSessionChannel): void => {
    // Read the pair once, so the pointer and the bytes it names always leave together.
    const p = pointer, snap = snapshot;
    if (!p || !snap) { channel.close(); return; }
    const frame: OraclePointerFrame = { type: ORACLE_POINTER_FRAME, pointer: p };
    channel.send("session", new TextEncoder().encode(JSON.stringify(frame)));
    channel.send("sync", Uint8Array.from(snap.bytes));
    // The reader closes once it holds both; a reader that never does meets the linger. Anything it sends ends it.
    const linger = setTimeout(() => channel.close(), lingerMs);
    linger.unref?.();
    void channel.recv().catch(() => null).then(() => { clearTimeout(linger); channel.close(); });
  };
  // A reader of the floor sends nothing but its close, so every seat here holds to a stranger's bounds.
  const registry = gateSessionRegistry((channel) => serve(channel), { bounds: () => GATE_STRANGER_CHANNEL_BOUNDS });
  const server = faceGateServer();
  // Each path stood: its gate's stand-down and its upgrade's unregister.
  const stood = new Map<string, { readonly down: () => void }>();
  const standDownAll = (): void => { for (const held of stood.values()) held.down(); stood.clear(); };
  let disposed = false;
  /** Stand each gate on a path not yet stood; with `prune`, stand down each path the source no longer names. */
  const sweep = async (prune: boolean): Promise<void> => {
    const entries = await args.gates(registry.table);
    if (disposed) return;
    const named = new Set<string>();
    for (const entry of entries) {
      const path = gatePath(entry.pin);
      named.add(path);
      if (stood.has(path)) continue;                    // the gate already standing stays the same gate
      const at = server.stand(entry);
      const unregister = args.dispatcher?.registerUpgrade({
        name: `oracle:${at.path}`, path: at.path,
        handle: (req, socket, head) => { if (!server.handleUpgrade(req, socket, head)) socket.destroy(); },
      });
      stood.set(at.path, { down: () => { unregister?.(); at.unstand(); } });
    }
    if (prune) for (const [path, held] of stood) if (!named.has(path)) { held.down(); stood.delete(path); }
  };
  try {
    await sweep(false);
  } catch (error) {
    standDownAll();
    server.close();
    oracleHandle.off("change", onChange);
    throw error;
  }
  // THE RE-SWEEP. A source that moves (a carry taken or dropped on a running vessel) asks the face again; sweeps run one
  // at a time, and one that fails leaves the gates as they stood and says so.
  let sweeping: Promise<void> = Promise.resolve();
  const unfollow = args.gates.onMoved?.(() => {
    sweeping = sweeping.then(() => sweep(true)).catch((err: unknown) => onLog?.(`oracle read-face: the floor gates did not sweep: ${err instanceof Error ? err.message : String(err)}`));
  });
  // A bare server (no dispatcher) carries one listener that answers the stood knocks alone and leaves every other.
  const onUpgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => { server.handleUpgrade(req, socket, head); };
  if (!args.dispatcher) httpServer.on("upgrade", onUpgrade);

  return {
    paths: () => server.paths(),
    dispose: () => {
      disposed = true;
      unfollow?.();
      oracleHandle.off("change", onChange);
      standDownAll();
      if (!args.dispatcher) httpServer.off("upgrade", onUpgrade);
      registry.close();
      server.close();
    },
  };
}

/**
 * Mount a vessel's FLOW-map (the mesh-palace projection) as a read-face. The disclosure shore applies
 * BEFORE the snapshot (snapshotPublicFlowMap), so only coarse public FLOW crosses the wire — the private
 * territory never leaves. A Herm serves this as its sole substrate, on the same floor gates; a proven peer pulls
 * it with the same `pullAndVerifyOracle`. The Lares Viales floor on the wire.
 */
export function mountFlowMapReadFace(args: OracleGateArgs & {
  readonly meshPalaceHandle: DocHandle<unknown>;
  readonly signerSeed:       Uint8Array;
  readonly storageDir:       string;
  readonly onLog?:           (line: string) => void;
}): Promise<OracleFloorFace> {
  return mountOracleReadFace({
    httpServer:     args.httpServer,
    oracleHandle:   args.meshPalaceHandle,
    signerSeed:     args.signerSeed,
    storageDir:     args.storageDir,
    gates:          args.gates,
    ...(args.lingerMs !== undefined ? { lingerMs: args.lingerMs } : {}),
    ...(args.dispatcher ? { dispatcher: args.dispatcher } : {}),
    ...(args.onLog ? { onLog: args.onLog } : {}),
    exportSnapshot: (doc: unknown) => snapshotPublicFlowMap(doc as LarDoc),
  });
}
