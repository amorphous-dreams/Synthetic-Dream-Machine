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
import { Repo, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId } from "@automerge/automerge-repo";
import { SecretHomeUnavailable, heldHomeSeed, mintVesselDocumentId, secretHomeRestOf } from "./secret-home.js";
import { CONTROL_HOME_ID, SECRET_HOME_ID } from "./lar-uris.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { storedLarRecord } from "./stored-record.js";
import { CompositeStore } from "./composite-store.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";
import type { LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";

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

/** THE ONE NAME A LOCKED VESSEL REFUSES UNDER, on every platform: the node vessel's control store and verb door, the CLI's
 *  direct holder and the browser's locked boot all answer it (operator ruling 2026-11-09, "locked hearth fails closed"). */
export const VESSEL_LOCKED = "vessel-locked";
/** The refusal of a place that holds no face: the control document mints with the face, so a faceless place holds none. */
export const CONTROL_HOME_UNNAMED = "control-home-unnamed";

export type ControlHomeRefusal = typeof VESSEL_LOCKED | typeof CONTROL_HOME_UNNAMED | "control-home-unavailable";

export class ControlHomeUnavailable extends Error {
  override readonly name = "ControlHomeUnavailable";
  constructor(why: string, readonly refusal: ControlHomeRefusal = "control-home-unavailable") {
    super(refusal === "control-home-unavailable" ? `control-home-unavailable: ${why}` : `control-home-unavailable: ${refusal}: ${why}`);
  }
}

const LOCKED_WHY = "the vessel's key stays shut, so no act reads or writes its control document until `lares vault unlock` opens it";
const UNNAMED_WHY = "this place holds no face, and the control document mints with the face; light one with `lares persona new 0`";

/** The refusal each stand-in handle answers: a handle stood while the control document could not be read (`standControlHome`). */
const standIns = new WeakMap<DocHandle<LarDoc>, ControlHomeUnavailable>();

/** The refusal `handle` answers (a stand-in stood locked or unnamed), or null where it holds the control document itself. */
export function controlHomeRefusal(handle: DocHandle<LarDoc>): ControlHomeUnavailable | null {
  return standIns.get(handle) ?? null;
}

/** Throw the stand-in's refusal by name; a handle over the control document itself passes. */
export function assertControlHomeOpen(handle: DocHandle<LarDoc>): void {
  const refused = standIns.get(handle);
  if (refused) throw refused;
}

/**
 * A STAND-IN: the control document's url and nothing of its content, held on a private storage-less, network-less Repo,
 * so no byte of it rests, syncs or merges into the vessel's Repo. Its control store refuses every read and write by name
 * (`controlStoreOf`), and a durability receipt over it refuses the same (`assertControlHomeOpen`). The next composition
 * (an unlock recomposes) stands the control document itself. A faceless place's stand-in names a fresh id no rest holds.
 * One stand-in per Repo and key, so every stand of one composition hands back the same handle.
 */
const standInsByRepo = new WeakMap<Repo, Map<string, DocHandle<LarDoc>>>();
function standIn(repo: Repo, key: string, documentId: string | null, refusal: () => ControlHomeUnavailable): DocHandle<LarDoc> {
  const held = standInsByRepo.get(repo) ?? new Map<string, DocHandle<LarDoc>>();
  standInsByRepo.set(repo, held);
  const standing = held.get(key);
  if (standing) return standing;
  const id = documentId ?? mintVesselDocumentId();
  const handle = new Repo({ network: [] }).import<LarDoc>(heldHomeSeed(id), { docId: id as DocumentId });
  standIns.set(handle, refusal());
  held.set(key, handle);
  return handle;
}

/** A control store that refuses every read and write by name: the shape a stand-in's store takes. */
export function refusingControlStore(refusal: ControlHomeUnavailable): CompositeStore {
  const refuse = async (): Promise<never> => { throw refusal; };
  const store: LarTiddlerStore = {
    listVisible: refuse,
    get: refuse as (title: string) => Promise<LarTiddlerRecord | null>,
    put: refuse,
    tombstone: refuse,
    remove: refuse,
    writeFamily: refuse,
    subscribe: () => () => {},
  };
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store, writable: true, defaultWritable: true });
  return control;
}

/** The refusal a locked vessel's control store answers (the island's grant carries `controlLocked`). */
export function vesselLockedRefusal(): ControlHomeUnavailable {
  return new ControlHomeUnavailable(LOCKED_WHY, VESSEL_LOCKED);
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

/** The control document's id the daemon document names, or null. */
function pointedControlId(daemonDoc: LarDoc | null | undefined): string | null {
  const url = controlHomeUrlOf(daemonDoc);
  if (url === null) return null;
  try { return parseAutomergeUrl(url as AutomergeUrl).documentId; } catch { return null; }
}

/**
 * Stand the vessel's control document (operator ruling A6, 2026-11-09).
 *
 * THE CUSTODY ROW NAMES IT; THE DAEMON DOCUMENT POINTS AT IT. The face's founding (or admission) mints the control
 * document beside the secret home: one custody row names both, and the daemon document names the control document for a
 * floor whose custody stays shut. The daemon document rests clear and syncs, so a merged concurrent change can move its
 * pointer; the custody row cannot. Where the row reads (the rest's `controlId`, filed by the home's open), its id stands
 * and a daemon document naming another reports and stands refused. No pointer ever files the secret home as control.
 *
 * SEALED UNDER THE VESSEL'S KEY. The control document maps on the store holder's rest under the vessel's held key (bound
 * to its own bag) before its first byte; a stand here maps it again before the Repo reads a byte.
 *
 * A LOCKED VESSEL FAILS CLOSED (operator ruling 2026-11-09). A vessel that stands with its custody locked (the waking
 * floor) hands back a STAND-IN: the control document's url over a private Repo, whose store refuses every read and write
 * `vessel-locked` (`controlStoreOf`), so the daemon VM still stands at the floor and every act needing the control
 * document answers that name back. Nothing the floor does lands in memory waiting for a key. A place that holds no face
 * (a herm, or a hearth before its face) names no control document at all: its stand-in refuses `control-home-unnamed`.
 *
 * A HOLDER THAT CANNOT OPEN ITS KEY SAYS WHY. A direct holder stands the vessel's key on demand (`standKey`); a refused
 * open throws by name, carrying the custody's own reason, and never stands a stand-in in its place.
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
      throw new ControlHomeUnavailable(UNNAMED_WHY, CONTROL_HOME_UNNAMED);
    }
    const handle = repo.create<LarDoc>(emptyLarDoc());
    nameControlHome(daemonHandle, handle.url);
    return handle;
  }
  // A holder whose custody stands open stands the vessel's key first (a direct holder's act opens the home's row, which
  // files the row's control document). A refused open names its reason; it never swallows into a stand-in.
  if (!rest.holdsKey() && rest.standKey) {
    try { await rest.standKey(); }
    catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      // A custody that names no secret home holds no face, so it names no control document; any other refusal kept the key shut.
      if (e instanceof SecretHomeUnavailable) throw new ControlHomeUnavailable(`${UNNAMED_WHY} (${why})`, CONTROL_HOME_UNNAMED);
      throw new ControlHomeUnavailable(`the vessel's key did not open: ${why}`, VESSEL_LOCKED);
    }
  }
  const pointed = pointedControlId(daemonHandle.doc());
  const custody = rest.controlId?.() ?? null;
  if (custody !== null && pointed !== null && pointed !== custody) {
    console.warn(`[control-home] the daemon document names ${pointed.slice(0, 8)}… as the control document; the custody row names ${custody.slice(0, 8)}…: the custody row's stands, the daemon document's pointer stands refused`);
  }
  const documentId = custody ?? pointed;
  if (documentId === null) return standIn(repo, `unnamed:${daemonHandle.documentId}`, null, () => new ControlHomeUnavailable(UNNAMED_WHY, CONTROL_HOME_UNNAMED));
  const filed = rest.homeOf?.(documentId) ?? null;
  if (filed === SECRET_HOME_ID) throw new ControlHomeUnavailable("the daemon document names the vessel's secret home as its control document; the secret home never files as control");
  if (filed !== null && filed !== CONTROL_HOME_ID) throw new ControlHomeUnavailable(`the document named as control stands filed under ${filed}`);
  if (!rest.enrollBeside(documentId, CONTROL_HOME_ID)) return standIn(repo, documentId, documentId, vesselLockedRefusal);
  return repo.find<LarDoc>(`automerge:${documentId}` as AutomergeUrl);
}

/**
 * READ the vessel's control document for a fence (a lease epoch, an admission's price): stand it through the vessel's own
 * path (`standControlHome`: the custody row first, the key stood before the Repo reads a byte) and answer it only where it
 * reads whole. FAIL CLOSED (M16): a daemon document and custody that name no control document refuse `control-home-unnamed`,
 * and a key that stays shut refuses `vessel-locked`, each by name. A fence read off an unread control document would price
 * at genesis epoch 0.
 */
export async function readControlHome(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  // A suite's storage-less Repo mints a control document at its stand; a fence read never mints one to price against.
  if (secretHomeRestOf(repo) === null && controlHomeUrlOf(daemonHandle.doc()) === null) throw new ControlHomeUnavailable(UNNAMED_WHY, CONTROL_HOME_UNNAMED);
  const handle = await standControlHome(repo, daemonHandle);
  assertControlHomeOpen(handle);
  return handle;
}

/**
 * The control document as a store: one layer under `CONTROL_HOME_ID`, its own default writable, so a control writer's put
 * lands there and nowhere else. No recipe composes it and no mirror names its bag. A stand-in's store refuses every read
 * and write by its refusal's name (`vessel-locked`, `control-home-unnamed`).
 */
export function controlStoreOf(handle: DocHandle<LarDoc>): CompositeStore {
  const refused = standIns.get(handle);
  if (refused) return refusingControlStore(refused);
  const control = new CompositeStore();
  const store = new AutomergeDocStore(handle, CONTROL_HOME_ID);
  control.addLayer({ bagId: CONTROL_HOME_ID, store, writable: true, defaultWritable: true });
  store.markSyncComplete();
  return control;
}
