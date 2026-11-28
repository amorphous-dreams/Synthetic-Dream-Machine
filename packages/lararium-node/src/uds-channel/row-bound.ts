/**
 * THE VERDICT ROWS HOLD A COUNT. A write leaves its verdict row in the control document (`verb-tiddler` `verdictRowOf`)
 * and, under an effect key, its effect row. Every change to a LarDoc costs about a microsecond per title its map holds,
 * on every replica that applies it, so rows that only ever arrive grow every later change's cost. The door keeps the
 * newest {@link VERDICT_ROW_COUNT} rows: past that count the oldest {@link VERDICT_ROW_SHED} leave the document whole, each
 * with the effect row that still names its request, by retract (the key drops, no tombstone stays: the control document
 * never leaves this vessel), in one change per batch.
 *
 * A COUNT, NEVER A CLOCK OR A DIAL. The order reads the order rows arrived in this life; at the door's opening the rows
 * a prior life left read as the oldest, in the order the document lists them. A re-ask past the kept rows runs fresh, or
 * refuses on a changed input the ask book still holds (`AskBook`).
 *
 * THE SEAM: the bound takes the store the rows rest in (today the control store's `CONTROL_HOME_ID` layer). A landing that
 * moves outcomes and effect rows into another store hands that store here, and the bound rides with them.
 * Heleuma ha: see lararium/mesh/uds-channel-row-bound.
 */

import type { CompositeStore } from "@lararium/mesh/composite-store";
import { ANSWER_RING_COUNT } from "@lararium/mesh/control-home";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX } from "@lararium/mesh/verb-tiddler";

/** How many verdict rows the control document keeps: four answer rings' worth. */
export const VERDICT_ROW_COUNT = 4 * ANSWER_RING_COUNT;
/** How many rows leave in one change once the count passes: a batch, so a write costs one change and a shed one more. */
export const VERDICT_ROW_SHED = 512;

export interface VerdictRowBound {
  /** Resolves once every shed this bound began has settled (a suite's handshake; the door never waits on it). */
  idle(): Promise<void>;
  close(): void;
}

export function boundVerdictRows(a: {
  readonly composite: CompositeStore;
  /** The layer the rows rest in. */
  readonly bagId: string;
  /** Whether the layer stands readable now (a stand-in control document sheds nothing). */
  readonly open: () => boolean;
  readonly count?: number;
  readonly shed?: number;
  readonly onFault?: (line: string) => void;
}): VerdictRowBound {
  const count = a.count ?? VERDICT_ROW_COUNT;
  const shed = Math.min(a.shed ?? VERDICT_ROW_SHED, count);
  /** Request ids whose verdict row stands, oldest first. */
  let order = new Map<string, true>();
  let turn: Promise<void> = Promise.resolve();
  let closed = false;
  const store = () => a.composite.storeForBag(a.bagId);

  // THE ROWS A PRIOR LIFE LEFT read as the oldest, ahead of every row this life saw arrive.
  const seeded: Promise<void> = (async () => {
    const s = store();
    if (!s || !a.open()) return;
    const titles = await s.listVisible();
    const prior = new Map<string, true>();
    for (const title of titles) if (title.startsWith(OUTCOME_URI_PREFIX)) prior.set(title.slice(OUTCOME_URI_PREFIX.length), true);
    for (const id of order.keys()) { prior.delete(id); prior.set(id, true); }
    order = prior;
  })().catch((e: unknown) => { a.onFault?.(`verdict-row bound could not read the rows a prior life left: ${e instanceof Error ? e.message : String(e)}`); });

  const leave = async (): Promise<void> => {
    await seeded;
    if (closed || order.size <= count || !a.open()) return;
    const s = store();
    if (!s) return;
    // Down to `count - shed`: the next `shed` writes land before the next shed.
    const victims = [...order.keys()].slice(0, order.size - (count - shed));
    const retracts: string[] = [];
    for (const requestId of victims) {
      const rowTitle = `${OUTCOME_URI_PREFIX}${requestId}`;
      const fields = (await s.get(rowTitle))?.tiddler as Record<string, unknown> | undefined;
      retracts.push(rowTitle);
      const effectKey = fields?.["effect-key"];
      if (typeof effectKey === "string" && effectKey !== "") {
        const effectTitle = `${EFFECT_URI_PREFIX}${effectKey}`;
        const effect = (await s.get(effectTitle))?.tiddler as Record<string, unknown> | undefined;
        if (effect?.["request-id"] === requestId) retracts.push(effectTitle);
      }
    }
    const origin = { kind: "lares-verb", requestId: victims[0]! } as const;
    if (s.writeFamily) await s.writeFamily([], [], origin, { retracts });
    else for (const title of retracts) await s.remove(title, origin);
    for (const id of victims) order.delete(id);
  };

  const fault = (e: unknown): void => { a.onFault?.(`verdict-row bound failed a shed, and the next row's shed retries it: ${e instanceof Error ? e.message : String(e)}`); };
  // A prior life's rows may already pass the count: the first shed runs once they read.
  turn = seeded.then(leave).catch(fault);

  const unsubscribe = a.composite.subscribe((change) => {
    if (!change.record || change.record.meta?.deleted || !change.title.startsWith(OUTCOME_URI_PREFIX)) return;
    const requestId = change.title.slice(OUTCOME_URI_PREFIX.length);
    if (order.has(requestId)) return;
    order.set(requestId, true);
    if (order.size <= count) return;
    turn = turn.then(leave).catch(fault);
  });

  return {
    idle: async () => { await seeded; let seen: Promise<void>; do { seen = turn; await seen; } while (seen !== turn); },
    close: () => { closed = true; unsubscribe(); },
  };
}
