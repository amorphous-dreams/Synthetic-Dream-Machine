/**
 * vessel-state — the vessel's FIXED-TITLE STATE, resting in its secret home: the accepted floor pin per Nexus, the signed
 * lease slots per writer, the device daemon documents' pointers, and the share rows (configured, pending, carried).
 *
 * PLACEMENT DECIDES RESIDENCY. These rows belong to this vessel alone: no peer reads them, no recipe composes them, and no
 * mirror projects them. The secret home already holds that placement (`secret-home`: one vessel-held document sealed under
 * the vessel's key, opened only through the vessel's custody, reached by the daemon island over its own sync), so the rows
 * rest there, beside the Keyhive cap events, under titles each family fixes. A row is REWRITTEN IN PLACE (a pin per Nexus, a
 * slot per writer, a pointer per kind and group, a share row per slug): the set of titles stays bounded by what the vessel
 * holds, never by how often it acts. No request, outcome, receipt, mailbox or swarm record rests here.
 *
 * A LOCKED VESSEL FAILS CLOSED. Where the secret home does not open (custody locked, or a place that holds no face), no
 * fixed-title read answers and no write lands: each reader names its refusal (`secret-home-unavailable`), and a floor read
 * falls to the genesis floor by its own law (`floor-pin`).
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store
 */
import type { DocHandle } from "@automerge/automerge-repo";
import { SECRET_HOME_ID } from "./lar-uris.js";
import type { LarDoc } from "./base-doc.js";
import { CompositeStore } from "./composite-store.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";

/** The bag coordinate every fixed-title row titles under: the secret home's own. */
export const VESSEL_STATE_HOME = SECRET_HOME_ID;

/** The secret home as the fixed-title families' store: one layer under the secret home's bag, its own default writable. */
export function vesselStateStoreOf(handle: DocHandle<LarDoc>): CompositeStore {
  const state = new CompositeStore();
  const store = new AutomergeDocStore(handle, SECRET_HOME_ID);
  state.addLayer({ bagId: SECRET_HOME_ID, store, writable: true, defaultWritable: true });
  store.markSyncComplete();
  return state;
}
