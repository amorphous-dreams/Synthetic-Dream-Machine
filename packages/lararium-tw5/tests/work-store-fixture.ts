/** A memory work store: one `VESSEL_WORK_ID` layer, its own default writable, the shape `work capability` stands. */
import { CompositeStore } from "@lararium/mesh/composite-store";
import { VESSEL_WORK_ID } from "@lararium/mesh/lar-uris";
import { MemoryTiddlerStore } from "../src/memory-store.js";

export function memoryWorkStore(): CompositeStore {
  const state = new CompositeStore();
  state.addLayer({ bagId: VESSEL_WORK_ID, store: new MemoryTiddlerStore(VESSEL_WORK_ID), writable: true, defaultWritable: true });
  return state;
}
