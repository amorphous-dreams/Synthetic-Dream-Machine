/**
 * lar-worker-protocol — GP-1 schema: discriminated union for all main ↔ Worker messages.
 *
 * Every message crossing the main-thread / wiki-Worker boundary MUST use this envelope.
 * Implements GP-1 through GP-4 from the structured-clone-gap ahu.
 *
 * GP-1: schema_version field on every message. Lock at 1; increment on breaking changes.
 * GP-2: all payloads = plain objects; no class instances, no functions, no DOM.
 * GP-3: Tiddler-level delta (added / deleted arrays). Main thread derives the delta
 *        from Automerge patches — Worker never loads the WASM runtime.
 * GP-4: CryptoKey — NOT in this protocol surface; key material stays in-thread.
 *
 * Meme: lar:///ha.ka.ba/@lararium/node/v0.1/lar-worker-protocol
 */

import type { TW5CoreBootBlob } from "@lararium/tw5";

export const WORKER_PROTOCOL_VERSION = 1 as const;
export type ProtocolVersion = typeof WORKER_PROTOCOL_VERSION;

// ── Main → Worker ──────────────────────────────────────────────────────────

/**
 * Deliver a tiddler-level delta to the wiki Worker.
 *
 * GP-3: main thread computes this from Automerge `change` event patches —
 * the Worker never needs to load the Automerge WASM runtime.
 *
 * `added`   — tiddler field objects to upsert into TW5 (plain objects, GP-2).
 * `deleted` — tiddler titles to remove from TW5.
 */
export interface WorkerMsg_Changeset {
  schema_version: ProtocolVersion;
  type: "changeset";
  wikiUri: string;
  added:   readonly Record<string, unknown>[];
  deleted: readonly string[];
}

/**
 * Promote the wiki slot from cold to hot (boot TW5 + RE).
 *
 * `snapshotTiddlers` carries the materialized TW5 tiddler view at the moment
 * of promotion. Worker boots TW5 from these tiddlers; subsequent changesets
 * apply incrementally. Null = boot TW5 empty (first-ever mount or no snapshot).
 *
 * GP-2: snapshotTiddlers MUST be a plain-object array — no class instances.
 */
export interface WorkerMsg_Promote {
  schema_version: ProtocolVersion;
  type: "promote";
  wikiUri: string;
  snapshotTiddlers: readonly Record<string, unknown>[] | null;
  /** TW5 core bytes from the content-addressed LarariumDoc blob. */
  coreBlob: TW5CoreBootBlob;
}

/** Demote the wiki slot from hot to cold (teardown subscriptions, snapshot). */
export interface WorkerMsg_Demote {
  schema_version: ProtocolVersion;
  type: "demote";
  wikiUri: string;
}

/**
 * Begin the GP-5 teardown handshake.
 * Worker MUST complete in-flight RE reactions, call KumuCancelable.cancel()
 * on all live subscriptions, then respond with teardown:ack before main thread
 * calls worker.terminate().
 */
export interface WorkerMsg_Teardown {
  schema_version: ProtocolVersion;
  type: "teardown";
}

/** All messages the main thread may send to a wiki Worker. */
export type MainToWorkerMsg =
  | WorkerMsg_Changeset
  | WorkerMsg_Promote
  | WorkerMsg_Demote
  | WorkerMsg_Teardown;

// ── Worker → Main ──────────────────────────────────────────────────────────

/**
 * Emit a RE reaction event to the main thread for cross-wiki routing.
 *
 * GP-2: payload MUST be a plain object with string | number | boolean values only.
 * No class instances, no nested objects with methods, no Symbols.
 */
export interface WorkerMsg_Event {
  schema_version: ProtocolVersion;
  type: "event";
  wikiUri: string;
  listenable: string;
  payload: Record<string, string | number | boolean>;
}

/**
 * GP-5 handshake completion.
 * Sent after all in-flight reactions complete and all KumuCancelable handles cancelled.
 * Main thread calls worker.terminate() upon receipt.
 *
 * `snapshotTiddlers` captures the Worker's live TW5 tiddler state at teardown,
 * allowing the main thread to update the cold-slot snapshot without re-reading
 * the Automerge doc. Omitted from test fixtures and dev-mode stubs.
 */
export interface WorkerMsg_TeardownAck {
  schema_version: ProtocolVersion;
  type: "teardown:ack";
  snapshotTiddlers?: readonly Record<string, unknown>[];
}

/** Acknowledgement of successful hot-tier boot (TW5 + RE co-located and ready). */
export interface WorkerMsg_PromoteAck {
  schema_version: ProtocolVersion;
  type: "promote:ack";
  wikiUri: string;
}

/**
 * Worker-side fault signal. Main thread MUST mark the slot as evicted and
 * NOT route further messages to this Worker.
 */
export interface WorkerMsg_Fault {
  schema_version: ProtocolVersion;
  type: "fault";
  wikiUri: string;
  error: string;
}

/** All messages a wiki Worker may send to the main thread. */
export type WorkerToMainMsg =
  | WorkerMsg_Event
  | WorkerMsg_TeardownAck
  | WorkerMsg_PromoteAck
  | WorkerMsg_Fault;

// ── Type guards ────────────────────────────────────────────────────────────

function _hasVersion(v: unknown): v is { schema_version: ProtocolVersion; type: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as Record<string, unknown>).schema_version === WORKER_PROTOCOL_VERSION &&
    typeof (v as Record<string, unknown>).type === "string"
  );
}

export function isMainToWorkerMsg(v: unknown): v is MainToWorkerMsg {
  if (!_hasVersion(v)) return false;
  return (["changeset", "promote", "demote", "teardown"] as const).includes(
    v.type as MainToWorkerMsg["type"],
  );
}

export function isWorkerToMainMsg(v: unknown): v is WorkerToMainMsg {
  if (!_hasVersion(v)) return false;
  return (["event", "teardown:ack", "promote:ack", "fault"] as const).includes(
    v.type as WorkerToMainMsg["type"],
  );
}

// ── Envelope factory helpers ───────────────────────────────────────────────

/** Build a teardown signal. Use with worker.postMessage(teardownMsg). */
export function mkTeardown(): WorkerMsg_Teardown {
  return { schema_version: WORKER_PROTOCOL_VERSION, type: "teardown" };
}

/** Build a teardown:ack. Use inside Worker on receipt of teardown or demote. */
export function mkTeardownAck(
  snapshotTiddlers?: readonly Record<string, unknown>[],
): WorkerMsg_TeardownAck {
  const msg: WorkerMsg_TeardownAck = { schema_version: WORKER_PROTOCOL_VERSION, type: "teardown:ack" };
  if (snapshotTiddlers !== undefined) msg.snapshotTiddlers = snapshotTiddlers;
  return msg;
}

/** Build a promote signal with optional cold-slot snapshot tiddlers. */
export function mkPromote(
  wikiUri: string,
  coreBlob: TW5CoreBootBlob,
  snapshotTiddlers: readonly Record<string, unknown>[] | null = null,
): WorkerMsg_Promote {
  return { schema_version: WORKER_PROTOCOL_VERSION, type: "promote", wikiUri, coreBlob, snapshotTiddlers };
}

/** Build a promote:ack. */
export function mkPromoteAck(wikiUri: string): WorkerMsg_PromoteAck {
  return { schema_version: WORKER_PROTOCOL_VERSION, type: "promote:ack", wikiUri };
}

/** Build a fault signal. */
export function mkFault(wikiUri: string, error: string): WorkerMsg_Fault {
  return { schema_version: WORKER_PROTOCOL_VERSION, type: "fault", wikiUri, error };
}
