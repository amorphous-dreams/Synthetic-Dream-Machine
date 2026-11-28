/** Memory-only answers at a floor that holds no durable work capability. */
import { CompositeStore } from "./composite-store.js";
import { VESSEL_WORK_ID } from "./lar-uris.js";
import { VesselStateUnavailable } from "./vessel-state.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX, SUMMONS_URI_PREFIX, WIKI_OUTCOME_URI_PREFIX } from "./verb-tiddler.js";
import { RETIRED_EVENT_ID, effectRecordUri } from "./effect-record.js";
/** How many floor answers a floor store holds before the oldest leaves: answers serve the caller that waits on them. */
export const FLOOR_ANSWER_RING = 1024;

/** Whether `title` names a verb's answer (its outcome, or the effect index a done outcome writes beside it). */
export function isFloorAnswerTitle(title: string): boolean {
  return title.startsWith(OUTCOME_URI_PREFIX) || title.startsWith(EFFECT_URI_PREFIX);
}

const holdsFloorDecision = (title: string): boolean => isFloorAnswerTitle(title) || title.startsWith(WIKI_OUTCOME_URI_PREFIX);

/**
 * A floor with no durable work capability answers reads and refused founding attempts in memory.
 * Compact wiki decisions share the bounded answer memory; summons and other durable facts refuse
 * through the named vessel-state refusal. Unlock opens a separate durable work store.
 * onAnswer forwards outcome and effect answers across the daemon island's capability port.
 */
export function floorAnswerStore(refusal: VesselStateUnavailable, onAnswer?: (record: LarTiddlerRecord, origin: ChangeOrigin) => void): CompositeStore {
  // Each refusal throws fresh, so its stack names the act that asked.
  const refuse = async (): Promise<never> => { throw new VesselStateUnavailable(refusal.why, refusal.refusal); };
  const answers = new Map<string, LarTiddlerRecord>();
  // Composite writes read this work bag's marker before placing an answer.
  const retiredMarker = effectRecordUri(VESSEL_WORK_ID, RETIRED_EVENT_ID);
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const store: LarTiddlerStore = {
    listVisible: refuse,
    get: async (title: string) => holdsFloorDecision(title) ? answers.get(title) ?? null : title === retiredMarker ? null : refuse(),
    put: async (record: LarTiddlerRecord, origin: ChangeOrigin) => {
      const title = String(record.tiddler.title);
      if (!holdsFloorDecision(title)) return refuse();
      answers.delete(title);
      answers.set(title, record);
      while (answers.size > FLOOR_ANSWER_RING) answers.delete(answers.keys().next().value as string);
      for (const fn of [...listeners]) { try { fn({ title, record, origin, bag: VESSEL_WORK_ID }); } catch { /* a listener's fault stays its own */ } }
      if (isFloorAnswerTitle(title)) onAnswer?.(record, origin);
    },
    tombstone: refuse,
    remove: refuse,
    writeFamily: async (puts, removes, origin) => {
      if (puts.some(row => !holdsFloorDecision(row.tiddler.title)) || removes.some(title => !title.startsWith(SUMMONS_URI_PREFIX))) return refuse();
      for (const row of puts) await store.put(row, origin);
    },
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  const state = new CompositeStore();
  state.addLayer({ bagId: VESSEL_WORK_ID, store, writable: true, defaultWritable: true });
  return state;
}

