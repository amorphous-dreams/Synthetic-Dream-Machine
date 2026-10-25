/**
 * rest-door — the island's half of the vessel's rest door for a save act.
 *
 * A confirmed edit lands in the island's Repo at once and reaches storage only after the vessel's Repo holds it and
 * flushes it. The door lets an act wait for that: the island names the heads it holds of the documents the act
 * wrote, the vessel answers `doc:rested` once its own Repo holds them and has flushed them, and only then does the
 * act's `lar:control-result` leave. The wait rides the vessel's answer alone: no timer, and a door that closes (the
 * island tears down) lets every parked wait go.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import { replicaHeads, type IslandMsg_DocRest, type IslandToVesselMsg } from "@lararium/mesh";

export interface RestDoorDeps {
  readonly post: (msg: IslandToVesselMsg) => void;
  /** The island's document handles by slot, read live. */
  readonly handles: () => ReadonlyMap<string, { readonly documentId: string; doc(): unknown }>;
  /** Flush the island's own store before the vessel is asked. */
  readonly flushOwn?: () => Promise<void>;
  readonly mintId?: () => string;
}

export interface RestDoor {
  /** An act that writes begins here, in the turn of its dispatch; `done` names the slots it wrote (null when it wrote nothing). */
  begin(): { done(slots: readonly string[] | null): void };
  /** The acts still waiting for their rest now, or null when none waits. */
  held(): Promise<void> | null;
  /** Resolves once no act waits. */
  idle(): Promise<void>;
  /** Offer an inbound message; true when it carried a `doc:rested` answer. */
  answer(raw: unknown): boolean;
  /** How many asks the vessel answered stalled: a rest whose heads never arrived reads here by name, and its act's result still leaves. */
  stalledAsks(): number;
  /** Release every parked wait. */
  close(): void;
}

export function makeRestDoor(deps: RestDoorDeps): RestDoor {
  const mint = deps.mintId ?? (() => crypto.randomUUID());
  const parked = new Map<string, () => void>();
  const waiting = new Set<Promise<void>>();
  let closed = false;
  let stalled = 0;

  const rest = async (slots: readonly string[]): Promise<void> => {
    if (closed) return;
    const held = deps.handles();
    const documentIds: string[] = [];
    const heads: Record<string, string[]> = {};
    for (const slot of slots) {
      const handle = held.get(slot);
      if (!handle || documentIds.includes(handle.documentId)) continue;
      documentIds.push(handle.documentId);
      heads[handle.documentId] = replicaHeads(handle);
    }
    try { await deps.flushOwn?.(); } catch (error) { console.warn(`[rest-door] the island's own flush faulted: ${String(error)}`); }
    if (documentIds.length === 0 || closed) return;
    const requestId = mint();
    await new Promise<void>((resolve) => {
      parked.set(requestId, resolve);
      const ask: IslandMsg_DocRest = { type: "doc:rest", requestId, documentIds, heads };
      deps.post(ask);
    });
  };

  return {
    begin() {
      let settle!: () => void;
      const wait = new Promise<void>((resolve) => { settle = resolve; });
      waiting.add(wait);
      const release = (): void => { waiting.delete(wait); settle(); };
      let finished = false;
      return {
        done(slots) {
          if (finished) return;
          finished = true;
          if (!slots || slots.length === 0) { release(); return; }
          void rest(slots).catch((error: unknown) => console.warn(`[rest-door] a rest ask faulted: ${String(error)}`)).finally(release);
        },
      };
    },
    held: () => (waiting.size === 0 ? null : Promise.all([...waiting]).then(() => undefined)),
    async idle() {
      while (waiting.size > 0) await Promise.all([...waiting]);
    },
    answer(raw) {
      if (typeof raw !== "object" || raw === null) return false;
      const { type, requestId, rested, why, stalled: stall } = raw as Record<string, unknown>;
      if (type !== "doc:rested" || typeof requestId !== "string") return false;
      const resolve = parked.get(requestId);
      if (!resolve) return true;
      parked.delete(requestId);
      if (stall === true) stalled++;
      if (rested !== true) console.warn(`[rest-door] the vessel did not rest the act's documents: ${typeof why === "string" ? why : "unrested"}`);
      resolve();
      return true;
    },
    stalledAsks: () => stalled,
    close() {
      closed = true;
      for (const resolve of parked.values()) resolve();
      parked.clear();
    },
  };
}
