/**
 * control-home — the vessel's CONTROL document: where the daemon's control families rest.
 *
 * PLACEMENT DECIDES RESIDENCY. A record reaches plaintext disk only through the layer it rests in and that layer's mirror,
 * never through its title. The control families (verb summons, outcomes and their effect index, the receipt facts, ward
 * audits, the durable mailbox, the swarm's live controls, the lease-epoch slots) therefore rest in ONE vessel-scoped
 * document that no recipe mounts and no mirror names: they never stand in a layer a projector reads.
 *
 * THE VESSEL HOLDS THE HANDLE BESIDE ITS DAEMON DOCUMENT. The daemon document names the control document's url under the
 * control home's own bag coordinate (`CONTROL_HOME_ID`), the same pointer shape the daemon document keeps for itself. A
 * vessel whose daemon document names none mints the control document at its first stand and names it there, so the one
 * document outlives every restart and every face.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/control-home
 */
import type { AutomergeUrl, DocHandle, Repo } from "@automerge/automerge-repo";
import { CONTROL_HOME_ID } from "./lar-uris.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { storedLarRecord } from "./stored-record.js";
import { CompositeStore } from "./composite-store.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";

export function vesselOnlyDocIds(controlDoc: LarDoc | null | undefined, controlUrl: string | null): Set<string> {
  const ids = new Set<string>();
  const addUrl = (url: string | null) => { if (url?.startsWith("automerge:") && url.length > 10) ids.add(url.slice(10)); };
  addUrl(controlUrl);
  for (const [title, record] of Object.entries(controlDoc?.tiddlers ?? {})) {
    if (title.startsWith(`${CONTROL_HOME_ID}/daemon-slot/`) || title.startsWith(`${CONTROL_HOME_ID}/daemon-canon/`)) addUrl(tiddlerText(record));
  }
  return ids;
}

export function makeVesselOnlyDocs() {
  let named = new Set<string>();
  const added = new Set<string>();
  return {
    has: (documentId: string) => named.has(documentId) || added.has(documentId),
    refresh: (controlDoc: LarDoc | null | undefined, controlUrl: string | null) => { named = vesselOnlyDocIds(controlDoc, controlUrl); },
    // The secret document joins through add when item A lands.
    add: (documentId: string) => { added.add(documentId); },
  };
}

/** The control document's url, as the daemon document names it; null where it names none. */
export function controlHomeUrlOf(daemonDoc: LarDoc | null | undefined): string | null {
  const url = tiddlerText(ownEntry(daemonDoc?.tiddlers, CONTROL_HOME_ID));
  return url && url.startsWith("automerge:") ? url : null;
}

/**
 * Stand the vessel's control document: the one the daemon document names, else a fresh one, minted here and named in the
 * daemon document in the same breath. The daemon document must already read (the caller resolved it).
 */
export async function standControlHome(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  const named = controlHomeUrlOf(daemonHandle.doc());
  if (named) return repo.find<LarDoc>(named as AutomergeUrl);
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => {
    doc.tiddlers[CONTROL_HOME_ID] = storedLarRecord(CONTROL_HOME_ID, { text: handle.url }, "lararium-control");
  });
  let landed = handle.url as string;
  daemonHandle.change((doc) => {
    const prior = controlHomeUrlOf(doc);
    // Two stands that raced: the first name the daemon document took holds, and this mint stands unused.
    if (prior) { landed = prior; return; }
    doc.tiddlers[CONTROL_HOME_ID] = storedLarRecord(CONTROL_HOME_ID, { text: handle.url }, "lararium-control");
  });
  return landed === handle.url ? handle : repo.find<LarDoc>(landed as AutomergeUrl);
}

/**
 * The control document as a store: one layer under `CONTROL_HOME_ID`, its own default writable, so a control writer's put
 * lands there and nowhere else. No recipe composes it and no mirror names its bag.
 */
export function controlStoreOf(handle: DocHandle<LarDoc>): CompositeStore {
  const control = new CompositeStore();
  const store = new AutomergeDocStore(handle, CONTROL_HOME_ID);
  control.addLayer({ bagId: CONTROL_HOME_ID, store, writable: true, defaultWritable: true });
  store.markSyncComplete();
  return control;
}
