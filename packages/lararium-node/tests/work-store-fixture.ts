import { vesselWorkFromSnapshot, type VesselWork } from "@lararium/mesh/vessel-work";
import { floorAnswerStore } from "@lararium/mesh/floor-answers";
import { vesselStateRefusal } from "@lararium/mesh/vessel-state";
import type { DocHandle } from "@automerge/automerge-repo";
import type { LarDoc } from "@lararium/mesh/base-doc";
import { bytesEqual } from "@lararium/mesh/crypto";

export function snapshotWork(initial: Uint8Array | null = null) {
  let bytes: Uint8Array | null = initial;
  const rest = { read: async () => bytes, replace: async (next: Uint8Array, previous: Uint8Array | null) => {
    if ((bytes === null) !== (previous === null) || (bytes && previous && !bytesEqual(bytes, previous))) throw new Error("snapshot compare failed");
    bytes = Uint8Array.from(next);
  } };
  return { open: () => vesselWorkFromSnapshot(rest, bytes), bytes: () => bytes };
}
const fixtures = new WeakMap<object, { work: VesselWork; rest: ReturnType<typeof snapshotWork> }>();
export function memoryWorkOf(handle: DocHandle<LarDoc>) {
  const refusal = vesselStateRefusal(handle);
  if (refusal) return floorAnswerStore(refusal);
  let held = fixtures.get(handle);
  if (!held) { const rest = snapshotWork(); held = { rest, work: rest.open() }; fixtures.set(handle, held); }
  return held.work.store;
}
export function reopenWorkOf(handle: DocHandle<LarDoc>) {
  const held = fixtures.get(handle); if (!held) return memoryWorkOf(handle);
  held.work = held.rest.open(); return held.work.store;
}
