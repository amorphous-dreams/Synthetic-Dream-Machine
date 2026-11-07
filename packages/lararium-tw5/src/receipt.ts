/**
 * receipt — the island's half of the vessel's receipt capability for a save act.
 *
 * A confirmed edit lands in the island's Repo at once and reaches storage only after the vessel's Repo holds it and
 * flushes it. The capability lets an act wait for that: the island names the heads it holds of the documents the act
 * wrote, the vessel issues `receipt:issued` once its own Repo holds them and has flushed them, and only then does the
 * act's `lar:control-result` leave. The wait rides the vessel's answer; closing the capability refuses every parked wait.
 *
 * TEARDOWN (L29 ruling, 2026-11-07) settles in one round and holds no clock: the island asks for every owed write and act, waits
 * until each ask has left (`asked`), and tells the vessel `receipt:asks-done`; the vessel answers what remains and sends
 * `receipt:close`. That close, the sync port closing, or the worker leaving closes this capability: every wait still out refuses.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import { replicaHeads, type IslandMsg_ReceiptRequest, type IslandToVesselMsg } from "@lararium/mesh";

export interface ReceiptCapabilityDeps {
  readonly post: (msg: IslandToVesselMsg) => void;
  /** The island's document handles by slot, read live. */
  readonly handles: () => ReadonlyMap<string, { readonly documentId: string; doc(): unknown }>;
  /** Flush the island's own store before the vessel is asked. */
  readonly flushOwn?: () => Promise<void>;
  readonly mintId?: () => string;
}

export interface ReceiptCapability {
  /** An act that writes begins here, in the turn of its dispatch; `done` names the slots it wrote (null when it wrote nothing). */
  begin(): { done(slots: readonly string[] | null): void };
  /** The acts still waiting for their receipt now, or null when none waits. */
  held(): Promise<void> | null;
  /** Resolves once no act waits. */
  idle(): Promise<void>;
  /** Resolves once no ask waits to leave: no act begun without its `done`, no request still before its post (or the capability closed). */
  asked(): Promise<void>;
  /** Offer an inbound message; true when it carried a `receipt:issued` answer. */
  answer(raw: unknown): boolean;
  /** How many asks the vessel answered stalled: a receipt whose heads never arrived reads here by name, and its act's result still leaves. */
  stalledAsks(): number;
  /**
   * A REAL acknowledgement: resolves only when the vessel's storage-backed Repo answered `issued: true` for the slots' heads; rejects on a
   * negative or stalled answer and when the capability closes. (`begin().done` stays warn-only for an act's result; this one never is.) The
   * island's own flush is not an ack: the worker's Repo has no storage.
   */
  ack(slots: readonly string[]): Promise<void>;
  /** True when this island holds a replica of the bag's document (its heads can be named); a bag it holds none of is the vessel's alone. */
  holds(slot: string): boolean;
  /** Release every parked request and unfinished act. */
  close(): void;
}

/** A durable acknowledgement the island requires, asked where no receipt capability stands: the refusal names the absent capability. */
export class ReceiptCapabilityUnavailable extends Error {
  override readonly name = "ReceiptCapabilityUnavailable";
  constructor() { super("ReceiptCapabilityUnavailable: required durable acknowledgement has no receipt capability"); }
}

export function makeReceiptCapability(deps: ReceiptCapabilityDeps): ReceiptCapability {
  const mint = deps.mintId ?? (() => crypto.randomUUID());
  const parked = new Map<string, (ok: boolean) => void>();
  const waiting = new Set<Promise<void>>();
  const releases = new Set<() => void>();
  let closed = false;
  let stalled = 0;
  /** Asks still to leave: acts begun without `done`, and requests before their post. */
  let asking = 0;
  const askedWaiters = new Set<() => void>();
  const leave = (): void => {
    asking--;
    if (asking > 0 && !closed) return;
    const answer = [...askedWaiters];
    askedWaiters.clear();
    for (const resolve of answer) resolve();
  };

  const request = async (slots: readonly string[]): Promise<boolean> => {
    asking++;
    let posted = false;
    const left = (): void => { if (!posted) { posted = true; leave(); } };
    try { return await requestAsking(slots, left); }
    finally { left(); }
  };

  const requestAsking = async (slots: readonly string[], left: () => void): Promise<boolean> => {
    if (closed) return false;
    const held = deps.handles();
    const documentIds: string[] = [];
    const heads: Record<string, string[]> = {};
    for (const slot of slots) {
      const handle = held.get(slot);
      if (!handle) return false;
      if (documentIds.includes(handle.documentId)) continue;
      documentIds.push(handle.documentId);
      heads[handle.documentId] = replicaHeads(handle);
    }
    try { await deps.flushOwn?.(); } catch (error) { console.warn(`[receipt] the island's own flush faulted: ${String(error)}`); }
    if (documentIds.length === 0) return true;
    if (closed) return false;
    const requestId = mint();
    return await new Promise<boolean>((resolve) => {
      parked.set(requestId, resolve);
      const ask: IslandMsg_ReceiptRequest = { type: "receipt:request", requestId, documentIds, heads };
      try { deps.post(ask); }
      catch { parked.delete(requestId); resolve(false); }
      left();
    });
  };

  return {
    begin() {
      let settle!: () => void;
      const wait = new Promise<void>((resolve) => { settle = resolve; });
      waiting.add(wait);
      const release = (): void => { waiting.delete(wait); releases.delete(release); settle(); };
      releases.add(release);
      if (closed) release();
      asking++;
      let finished = false;
      return {
        done(slots) {
          if (finished) return;
          finished = true;
          if (!slots || slots.length === 0) { release(); leave(); return; }
          // The request counts itself asking before the act stops counting, so `asked` never reads a gap between them.
          void request(slots).catch((error: unknown) => console.warn(`[receipt] a receipt request faulted: ${String(error)}`)).finally(release);
          leave();
        },
      };
    },
    held: () => (waiting.size === 0 ? null : Promise.all([...waiting]).then(() => undefined)),
    async idle() {
      while (waiting.size > 0) await Promise.all([...waiting]);
    },
    async asked() {
      while (asking > 0 && !closed) await new Promise<void>((resolve) => { askedWaiters.add(resolve); });
    },
    answer(raw) {
      if (typeof raw !== "object" || raw === null) return false;
      const { type, requestId, issued, why, stalled: stall } = raw as Record<string, unknown>;
      if (type !== "receipt:issued" || typeof requestId !== "string") return false;
      const resolve = parked.get(requestId);
      if (!resolve) return true;
      parked.delete(requestId);
      if (stall === true) stalled++;
      if (issued !== true) console.warn(`[receipt] the vessel issued no receipt for the act's documents: ${typeof why === "string" ? why : "not issued"}`);
      resolve(issued === true && stall !== true);
      return true;
    },
    stalledAsks: () => stalled,
    holds: (slot) => deps.handles().has(slot),
    async ack(slots) {
      if (!(await request(slots))) throw new Error("the vessel issued no receipt for the written documents");
    },
    close() {
      closed = true;
      for (const resolve of parked.values()) resolve(false);
      parked.clear();
      for (const release of releases) release();
      const answer = [...askedWaiters];
      askedWaiters.clear();
      for (const resolve of answer) resolve();
    },
  };
}
