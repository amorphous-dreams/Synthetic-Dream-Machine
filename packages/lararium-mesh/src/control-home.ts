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
import { CONTROL_HOME_ID, SECRET_HOME_ID } from "./lar-uris.js";
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

/**
 * THE VESSEL-ONLY DENY SET a share verdict reads: the control document and every device document it names (`refresh`), and
 * each document a caller adds by hand. automerge-repo resolves a document's ACCESS verdict once per peer and asks again only
 * on `shareConfigChanged`, so a set that GROWS calls `onGrow`: the vessel wires it to that re-ask, and a peer whose verdict
 * was asked before the growth meets the new answer.
 */
export function makeVesselOnlyDocs(opts: { readonly onGrow?: () => void } = {}) {
  let named = new Set<string>();
  const added = new Set<string>();
  const has = (documentId: string) => named.has(documentId) || added.has(documentId);
  return {
    has,
    /** Read the control document's names afresh; answers whether the set grew (and told `onGrow`). */
    refresh: (controlDoc: LarDoc | null | undefined, controlUrl: string | null): boolean => {
      const next = vesselOnlyDocIds(controlDoc, controlUrl);
      const grew = [...next].some((id) => !has(id));
      named = next;
      if (grew) opts.onGrow?.();
      return grew;
    },
    /** A document that stays on this vessel whatever the control document names (answers whether the set grew). */
    add: (documentId: string): boolean => {
      if (has(documentId)) { added.add(documentId); return false; }
      added.add(documentId);
      opts.onGrow?.();
      return true;
    },
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

/** THE CONTROL HOME'S STORED COPY, waiting to merge into a handle stood held: by Repo, by document. A merge that fails
 *  stays here, and the next stand (or the next keyed event) tries it again. */
const pendingMerges = new WeakMap<Repo, Map<string, () => Promise<boolean>>>();

/** Does a stored copy of `documentId` still wait to merge into its held handle on `repo` (a failed merge stays pending)? */
export function controlHomeMergePending(repo: Repo, documentId: string): boolean {
  return pendingMerges.get(repo)?.has(documentId) ?? false;
}

function pendMerge(repo: Repo, handle: DocHandle<LarDoc>, documentId: string): () => Promise<boolean> {
  const pending = pendingMerges.get(repo) ?? new Map<string, () => Promise<boolean>>();
  pendingMerges.set(repo, pending);
  let running: Promise<boolean> | null = null;
  const merge = (): Promise<boolean> => (running ??= (async () => {
    try {
      const rested = await repo.storageSubsystem?.loadDoc<LarDoc>(documentId as DocumentId);
      if (rested) handle.update((d) => A.merge(d, rested));
      if (pending.get(documentId) === merge) pending.delete(documentId);
      return true;
    } catch (e) {
      // SURFACED, NEVER SWALLOWED: the stored copy stays pending, and the next stand tries it again.
      console.warn(`[control-home] the control document ${documentId.slice(0, 8)}…'s stored copy did not merge (${e instanceof Error ? e.message : String(e)}); it stays pending and the next stand merges it`);
      return false;
    } finally { running = null; }
  })());
  pending.set(documentId, merge);
  return merge;
}

/** The control document's id the daemon document names, or null. */
function pointedControlId(daemonDoc: LarDoc | null | undefined): string | null {
  const url = controlHomeUrlOf(daemonDoc);
  if (url === null) return null;
  try { return parseAutomergeUrl(url as AutomergeUrl).documentId; } catch { return null; }
}

/**
 * Stand the vessel's control document (operator ruling A6, 2026-11-09).
 *
 * THE CUSTODY ROW NAMES IT; THE DAEMON DOCUMENT POINTS AT IT. The founding mints the control document beside the secret
 * home: one custody row names both, and the daemon document names the control document for a floor whose custody stays
 * shut. The daemon document rests clear and syncs, so a merged concurrent change can move its pointer; the custody row
 * cannot. Where the row reads (the rest's `controlId`, filed by the home's open), its id stands and a daemon document
 * naming another reports and stands refused. No pointer ever files the secret home as control.
 *
 * SEALED UNDER THE VESSEL'S KEY. The control document maps on the store holder's rest under the vessel's held key (bound
 * to its own bag) before its first byte; a stand here maps it again before the Repo reads a byte.
 *
 * HELD IN MEMORY WHILE THE KEY STAYS SHUT. A vessel that stands with its custody locked (the waking floor) maps the
 * document sealed with no key: the stand hands back a handle over the founding's own seed, every write lands there and
 * waits in memory, never clear, and once the key opens the document's rest merges in and the waiting saves seal. A merge
 * that fails reports and stays pending (`controlHomeMergePending`): the next stand merges it.
 *
 * A Repo that rests bytes with no sealed rest bound mints nothing here (`control-home-unavailable`). A storage-less Repo (a
 * suite's) mints one in memory, where nothing rests at all.
 */
export async function standControlHome(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  const rest = secretHomeRestOf(repo);
  if (rest === null) {
    const pointedUrl = controlHomeUrlOf(daemonHandle.doc());
    if (pointedUrl !== null) return repo.find<LarDoc>(pointedUrl as AutomergeUrl);
    if ((repo as unknown as { storageSubsystem?: unknown }).storageSubsystem !== undefined) {
      throw new ControlHomeUnavailable("the daemon document names no control document; the founding mints it beside the secret home");
    }
    const handle = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemonHandle, handle.url);
    return handle;
  }
  // A holder whose custody stands open stands the vessel's key first (a direct holder's act opens the home's row, which
  // files the row's control document).
  if (!rest.holdsKey()) await rest.standKey?.().catch(() => false);
  const pointed = pointedControlId(daemonHandle.doc());
  const custody = rest.controlId?.() ?? null;
  if (custody !== null && pointed !== null && pointed !== custody) {
    console.warn(`[control-home] the daemon document names ${pointed.slice(0, 8)}… as the control document; the custody row names ${custody.slice(0, 8)}…: the custody row's stands, the daemon document's pointer stands refused`);
  }
  const documentId = custody ?? pointed;
  if (documentId === null) {
    throw new ControlHomeUnavailable("the daemon document names no control document; the founding mints it beside the secret home");
  }
  const filed = rest.homeOf?.(documentId) ?? null;
  if (filed === SECRET_HOME_ID) throw new ControlHomeUnavailable("the daemon document names the vessel's secret home as its control document; the secret home never files as control");
  if (filed !== null && filed !== CONTROL_HOME_ID) throw new ControlHomeUnavailable(`the document named as control stands filed under ${filed}`);
  const url = `automerge:${documentId}` as AutomergeUrl;
  if (rest.enrollBeside(documentId, CONTROL_HOME_ID)) {
    const handle = await repo.find<LarDoc>(url);
    await pendingMerges.get(repo)?.get(documentId)?.();
    return handle;
  }
  const held = repo.handles[documentId as DocumentId] as DocHandle<LarDoc> | undefined;
  if (held) return held;
  const handle = repo.import<LarDoc>(heldHomeSeed(documentId), { docId: documentId as DocumentId });
  const merge = pendMerge(repo, handle, documentId);
  rest.whenKeyed(() => { void merge(); });
  return handle;
}

/**
 * READ the vessel's control document for a fence (a lease epoch, an admission's price): stand it through the vessel's own
 * path (`standControlHome`: the custody row first, the key stood before the Repo reads a byte) and answer it only where it
 * reads whole. FAIL CLOSED (M16): a daemon document and custody that name no control document, or a key that stays shut
 * (the handle holds the founding's seed alone, never the rest), refuse `control-home-unavailable` by name. A fence read off
 * an unread control document would price at genesis epoch 0.
 */
export async function readControlHome(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  const rest = secretHomeRestOf(repo);
  if (rest !== null && !rest.holdsKey()) await rest.standKey?.().catch(() => false);
  if (controlHomeUrlOf(daemonHandle.doc()) === null && (rest?.controlId?.() ?? null) === null) {
    throw new ControlHomeUnavailable("neither the daemon document nor the custody row names a control document, so its fence reads unread, never at genesis");
  }
  const handle = await standControlHome(repo, daemonHandle);
  if (rest !== null && !rest.holdsKey()) throw new ControlHomeUnavailable("the vessel's key stays shut, so the control document reads its seed alone, never its rest");
  if (controlHomeMergePending(repo, handle.documentId)) throw new ControlHomeUnavailable("the control document's stored copy has not merged yet");
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
