/**
 * control-home — the vessel's CONTROL document: where the daemon's control families rest.
 *
 * PLACEMENT DECIDES RESIDENCY. A record reaches plaintext disk only through the layer it rests in and that layer's mirror,
 * never through its title. The control families (verb summons, outcomes and their effect index, the receipt facts, ward
 * audits, the durable mailbox, the swarm's live controls, the lease-epoch slots) therefore rest in ONE vessel-scoped
 * document that no recipe mounts and no mirror names: they never stand in a layer a projector reads.
 *
 * THE VESSEL HOLDS THE HANDLE BESIDE ITS DAEMON DOCUMENT. The daemon document names the control document's url under the
 * control home's own bag coordinate (`CONTROL_HOME_ID`), the same pointer shape the daemon document keeps for itself. The
 * founding mints it beside the vessel's secret home and names it there, so the one document outlives every restart and face.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/control-home
 */
import * as A from "@automerge/automerge";
import { parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId, type Repo } from "@automerge/automerge-repo";
import { heldHomeSeed, secretHomeRestOf } from "./secret-home.js";
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

export class ControlHomeUnavailable extends Error {
  override readonly name = "ControlHomeUnavailable";
  constructor(why: string) { super(`control-home-unavailable: ${why}`); }
}

/** Name the control document in the daemon document (the founding does, beside the secret home's custody row). The first
 *  name the daemon document took holds. */
export function nameControlHome(daemonHandle: DocHandle<LarDoc>, controlUrl: string): string {
  let landed = controlUrl;
  daemonHandle.change((doc) => {
    const prior = controlHomeUrlOf(doc);
    if (prior) { landed = prior; return; }
    doc.tiddlers[CONTROL_HOME_ID] = storedLarRecord(CONTROL_HOME_ID, { text: controlUrl }, "lararium-control");
  });
  return landed;
}

/**
 * Stand the vessel's control document, the one the daemon document names (operator ruling A6, 2026-11-09).
 *
 * MINTED AT FOUNDING, SEALED UNDER THE VESSEL'S KEY. The founding mints the control document beside the secret home: it
 * maps on the store holder's rest under the vessel's held key (bound to its own bag) before its first byte, its id rests in
 * the same custody row, and the daemon document names it. A stand here maps it again before the Repo reads a byte.
 *
 * HELD IN MEMORY WHILE THE KEY STAYS SHUT. A vessel that stands with its custody locked (the waking floor) maps the
 * document sealed with no key: the stand hands back a handle over the founding's own seed, every write lands there and
 * waits in memory, never clear, and once the key opens the document's rest merges in and the waiting saves seal.
 *
 * A Repo that rests bytes with no sealed rest bound mints nothing here (`control-home-unavailable`). A storage-less Repo (a
 * suite's) mints one in memory, where nothing rests at all.
 */
export async function standControlHome(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  const named = controlHomeUrlOf(daemonHandle.doc());
  const rest = secretHomeRestOf(repo);
  if (named) {
    if (rest === null) return repo.find<LarDoc>(named as AutomergeUrl);
    const documentId = parseAutomergeUrl(named as AutomergeUrl).documentId;
    if (rest.enrollBeside(documentId, CONTROL_HOME_ID)) return repo.find<LarDoc>(named as AutomergeUrl);
    const held = repo.handles[documentId] as DocHandle<LarDoc> | undefined;
    if (held) return held;
    const handle = repo.import<LarDoc>(heldHomeSeed(documentId), { docId: documentId as DocumentId });
    rest.whenKeyed(() => {
      void (async () => {
        const rested = await repo.storageSubsystem?.loadDoc<LarDoc>(documentId as DocumentId);
        if (rested) handle.update((d) => A.merge(d, rested));
      })().catch(() => { /* the rest's next open merges it */ });
    });
    return handle;
  }
  if (rest !== null || (repo as unknown as { storageSubsystem?: unknown }).storageSubsystem !== undefined) {
    throw new ControlHomeUnavailable("the daemon document names no control document; the founding mints it beside the secret home");
  }
  const handle = repo.create<LarDoc>(emptyLarDoc());
  nameControlHome(daemonHandle, handle.url);
  return handle;
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
