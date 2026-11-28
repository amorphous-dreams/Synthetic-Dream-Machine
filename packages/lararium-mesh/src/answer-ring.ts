import type { LarTiddlerRecord } from "./tiddler-store.js";
import { OUTCOME_URI_PREFIX } from "./verb-tiddler.js";
import { canonicalJsonBytes } from "./crypto.js";

// ── The answer ring: where a verb's whole answer waits for its caller ─────────────────────────────

/** How many whole answers a vessel's answer ring holds before the oldest leaves. */
export const ANSWER_RING_COUNT = 1024;
/** How many bytes of whole answers the ring holds before the oldest leaves (16 MiB). */
export const ANSWER_RING_BYTES = 16 * 1024 * 1024;

/**
 * THE ANSWER RING: the whole outcomes of the verbs a vessel ran, in memory alone, for the callers that wait on them.
 *
 * The work store rests a VERDICT ROW per ledgered call (`verb-tiddler` `verdictRowOf`) and no body. The body (the
 * `results` map, the `touched` report) rides here: the island puts each whole outcome into its ring, the ring's hand-off
 * carries it to the vessel's ring across the island's own message, and the door answers its caller from it. Nothing in a
 * ring rests: no Repo holds it, no document merges it, and a restart begins with an empty one. Two bounds hold it, and
 * neither reads a clock: {@link ANSWER_RING_COUNT} answers or {@link ANSWER_RING_BYTES} bytes, whichever binds first;
 * the oldest leaves, and the answer just put stays through its own put, so its waiter reads it. An id whose body left
 * answers from its verdict row (`releasedBodyOf`), or, for a read that left no row, runs again.
 */
export interface AnswerRing {
  /** Hold one whole outcome under its request id; a second put under one id replaces the first. */
  put(record: LarTiddlerRecord): void;
  /** The whole outcome held for `requestId`, or null once it left (or never came). */
  get(requestId: string): LarTiddlerRecord | null;
  /** Hear each answer as the ring takes it. Answers the unsubscribe. */
  subscribe(fn: (requestId: string, record: LarTiddlerRecord) => void): () => void;
  /** Let every answer go, as a restart does. */
  clear(): void;
  /** How many answers the ring holds, and what they weigh. */
  readonly size: number;
  readonly bytes: number;
}

/** A ring under its own bounds; a vessel's state store carries one (`answerRingOf`). */
export function makeAnswerRing(bounds: { readonly count?: number; readonly bytes?: number } = {}): AnswerRing {
  const count = bounds.count ?? ANSWER_RING_COUNT;
  const limit = bounds.bytes ?? ANSWER_RING_BYTES;
  const held = new Map<string, { readonly record: LarTiddlerRecord; readonly weight: number }>();
  const listeners = new Set<(requestId: string, record: LarTiddlerRecord) => void>();
  let weight = 0;
  const drop = (requestId: string): void => {
    const entry = held.get(requestId);
    if (entry === undefined) return;
    held.delete(requestId);
    weight -= entry.weight;
  };
  return {
    put(record) {
      const title = String(record.tiddler.title ?? "");
      if (!title.startsWith(OUTCOME_URI_PREFIX)) return;
      const requestId = title.slice(OUTCOME_URI_PREFIX.length);
      let measured = 0;
      // An answer whose fields will not canonicalise still answers its caller; it weighs its text alone.
      try { measured = canonicalJsonBytes(record.tiddler).length; } catch { measured = String(record.tiddler["results"] ?? "").length; }
      drop(requestId);
      held.set(requestId, { record, weight: measured });
      weight += measured;
      // The oldest leaves first; the answer just put stays, so a lone answer past the byte bound leaves at the next put.
      while (held.size > 1 && (held.size > count || weight > limit)) drop(held.keys().next().value as string);
      for (const fn of [...listeners]) { try { fn(requestId, record); } catch { /* a listener's fault stays its own */ } }
    },
    get: (requestId) => held.get(requestId)?.record ?? null,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    clear() { held.clear(); weight = 0; },
    get size() { return held.size; },
    get bytes() { return weight; },
  };
}

const answerRings = new WeakMap<object, AnswerRing>();

/**
 * THE RING A WORK STORE CARRIES, one per store, minted at its first asking. The island's `writeOutcome` and the door
 * that answers a caller each name the ring by the state store they already hold: where one process holds one store
 * (a suite, a browser vessel's single realm) they share the ring itself, and where the island and the vessel hold two
 * stores in two realms the island's ring hands each answer across (`DaemonMsg_FloorAnswer` with `answer: true`).
 */
export function answerRingOf(state: object): AnswerRing {
  let ring = answerRings.get(state);
  if (ring === undefined) { ring = makeAnswerRing(); answerRings.set(state, ring); }
  return ring;
}

