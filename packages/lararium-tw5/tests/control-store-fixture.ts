/** A memory control store: one `CONTROL_HOME_ID` layer, its own default writable, the shape `controlStoreOf` stands. */
import { CompositeStore, CONTROL_HOME_ID } from "@lararium/mesh";
import { MemoryTiddlerStore } from "../src/memory-store.js";

export function memoryControlStore(): CompositeStore {
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
  return control;
}
