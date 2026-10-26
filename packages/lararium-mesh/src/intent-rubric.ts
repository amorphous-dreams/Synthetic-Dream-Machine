/** Pure counts for the face intent plane; edit traffic never enters these rows. */
import type { LarDoc } from "./base-doc.js";
import { intentEntryCid, intentEntryRecordsOfGroup, readIntentEntry } from "./intent-entry.js";
import { readIntentPlane, type IntentReadInput } from "./intent-read.js";

export interface IntentPlaneCounts {
  readonly intents: number;
  readonly outcomes: number;
  readonly duplicates: number;
  readonly other: number;
}

/** A supplied verified face read decides winners; without one the slot's CID order decides only the count. */
export function countPlaneEntries(plane: LarDoc | null | undefined, group: string, reading?: Omit<IntentReadInput, "group" | "records">): IntentPlaneCounts {
  const entries = intentEntryRecordsOfGroup(plane, group)
    .map((raw) => readIntentEntry(raw, { group, authorize: () => true }))
    .filter((read): read is Extract<typeof read, { ok: true }> => read.ok);
  const kinds = entries.map((read) => read.entry.body.entry);
  const intents = kinds.filter((kind) => kind === "intent").length;
  const outcomes = kinds.filter((kind) => kind === "outcome").length;
  let duplicates: number;
  if (reading) {
    const view = readIntentPlane({ ...reading, group, records: intentEntryRecordsOfGroup(plane, group) });
    duplicates = view.intents.reduce((sum, state) => sum + state.slots.reduce((n, slot) =>
      n + (slot.unknownFrontier ? Math.max(0, slot.duplicates.length - 1) : slot.duplicates.length), 0), 0);
  } else {
    const slots = new Map<string, Set<string>>();
    for (const read of entries) {
      if (read.entry.body.entry !== "outcome") continue;
      const key = `${String(read.entry.body.cause)}:${String(read.entry.body.slot ?? read.entry.signer)}`;
      const cids = slots.get(key) ?? new Set<string>();
      cids.add(intentEntryCid(read.entry));
      slots.set(key, cids);
    }
    duplicates = [...slots.values()].reduce((sum, cids) => sum + Math.max(0, cids.size - 1), 0);
  }
  return { intents, outcomes, duplicates, other: kinds.length - intents - outcomes };
}
