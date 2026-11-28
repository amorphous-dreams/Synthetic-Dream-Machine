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
import { Repo, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId } from "@automerge/automerge-repo";
import { SecretHomeUnavailable, heldHomeSeed, mintVesselDocumentId, secretHomeRestOf } from "./secret-home.js";
import { CONTROL_HOME_ID, SECRET_HOME_ID } from "./lar-uris.js";
import { FLOOR_REGISTRY_ROOT } from "./device-daemon-docs.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry, plainEntries } from "./stored-value.js";
import { storedLarRecord, storedRecord } from "./stored-record.js";
import { CompositeStore } from "./composite-store.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";
import type { ChangeOrigin, LarTiddlerChange, LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";
import { EFFECT_URI_PREFIX, OUTCOME_URI_PREFIX } from "./verb-tiddler.js";
import { RETIRED_EVENT_ID, effectRecordUri } from "./effect-record.js";
import { pointMint } from "./mint-census.js";
import { canonicalJsonBytes } from "./crypto.js";

/** The documents the place's daemon document names as the FLOOR's own (`FLOOR_REGISTRY_ROOT`): each stays on this vessel. */
export function floorOnlyDocIds(daemonDoc: LarDoc | null | undefined): Set<string> {
  const ids = new Set<string>();
  for (const [title, record] of Object.entries(daemonDoc?.tiddlers ?? {})) {
    if (!title.startsWith(FLOOR_REGISTRY_ROOT)) continue;
    const url = tiddlerText(record);
    if (url?.startsWith("automerge:") && url.length > 10) ids.add(url.slice(10));
  }
  return ids;
}

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
  let floor = new Set<string>();
  const added = new Set<string>();
  const has = (documentId: string) => named.has(documentId) || floor.has(documentId) || added.has(documentId);
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
    /** Read the floor registry's names afresh off the place's daemon document; answers whether the set grew (and told `onGrow`). */
    refreshFloor: (daemonDoc: LarDoc | null | undefined): boolean => {
      const next = floorOnlyDocIds(daemonDoc);
      const grew = [...next].some((id) => !has(id));
      floor = next;
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
  constructor(readonly why: string, readonly refusal: ControlHomeRefusal = "control-home-unavailable") {
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
  if (refused) throw new ControlHomeUnavailable(refused.why, refused.refusal);
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

/** How many floor answers a floor store holds before the oldest leaves: answers serve the caller that waits on them. */
export const FLOOR_ANSWER_RING = 1024;

/** Whether `title` names a verb's answer (its outcome, or the effect index a done outcome writes beside it). */
export function isFloorAnswerTitle(title: string): boolean {
  return title.startsWith(OUTCOME_URI_PREFIX) || title.startsWith(EFFECT_URI_PREFIX);
}

/**
 * THE FLOOR'S ANSWER CHANNEL: the control store a stand-in stands as (a herm, a hearth before its face, a locked hearth).
 *
 * A place with no readable control document still answers the acts that write no control fact: a read-only query, a row
 * of the place (a herm taking a carry bundle, a lift's founding refused by name). Such an act's ANSWER (its outcome and
 * the effect index beside a done one) is held here in memory alone, for the caller that waits on it, and never rests:
 * no Repo holds it, no document merges it into the control document a later unlock stands, and the oldest leaves once
 * {@link FLOOR_ANSWER_RING} wait. Every other read and write refuses by the stand-in's name, so an act that writes a control
 * fact (a receipt fact, a summons, a mailbox row, a lease slot) refuses `control-home-unnamed` on a faceless place and
 * `vessel-locked` on a locked hearth, at the write it asked for.
 *
 * `onAnswer` hears each answer this store takes: the daemon island hands its answers to the vessel this way, since the
 * island's floor store and the vessel's are two memories in two realms.
 */
export function floorAnswerStore(refusal: ControlHomeUnavailable, onAnswer?: (record: LarTiddlerRecord, origin: ChangeOrigin) => void): CompositeStore {
  // Each refusal throws fresh, so its stack names the act that asked.
  const refuse = async (): Promise<never> => { throw new ControlHomeUnavailable(refusal.why, refusal.refusal); };
  const answers = new Map<string, LarTiddlerRecord>();
  // The control bag's retirement marker, which every write through a composite reads first: a floor never retires it.
  const retiredMarker = effectRecordUri(CONTROL_HOME_ID, RETIRED_EVENT_ID);
  const listeners = new Set<(change: LarTiddlerChange) => void>();
  const store: LarTiddlerStore = {
    listVisible: refuse,
    get: async (title: string) => isFloorAnswerTitle(title) ? answers.get(title) ?? null : title === retiredMarker ? null : refuse(),
    put: async (record: LarTiddlerRecord, origin: ChangeOrigin) => {
      const title = String(record.tiddler.title);
      if (!isFloorAnswerTitle(title)) return refuse();
      answers.delete(title);
      answers.set(title, record);
      while (answers.size > FLOOR_ANSWER_RING) answers.delete(answers.keys().next().value as string);
      for (const fn of [...listeners]) { try { fn({ title, record, origin, bag: CONTROL_HOME_ID }); } catch { /* a listener's fault stays its own */ } }
      onAnswer?.(record, origin);
    },
    tombstone: refuse,
    remove: refuse,
    writeFamily: refuse,
    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
  };
  const control = new CompositeStore();
  control.addLayer({ bagId: CONTROL_HOME_ID, store, writable: true, defaultWritable: true });
  return control;
}

// ── The answer ring: where a verb's whole answer waits for its caller ─────────────────────────────

/** How many whole answers a vessel's answer ring holds before the oldest leaves. */
export const ANSWER_RING_COUNT = 1024;
/** How many bytes of whole answers the ring holds before the oldest leaves (16 MiB). */
export const ANSWER_RING_BYTES = 16 * 1024 * 1024;

/**
 * THE ANSWER RING: the whole outcomes of the verbs a vessel ran, in memory alone, for the callers that wait on them.
 *
 * The control document rests a VERDICT ROW per ledgered call (`verb-tiddler` `verdictRowOf`) and no body. The body (the
 * `results` map, the `touched` report) rides here: the island puts each whole outcome into its ring, the ring's hand-off
 * carries it to the vessel's ring across the island's own message, and the door answers its caller from it. Nothing in a
 * ring rests: no Repo holds it, no document merges it, and a restart begins with an empty one. Two bounds hold it, and
 * neither reads a clock: {@link ANSWER_RING_COUNT} answers or {@link ANSWER_RING_BYTES} bytes, whichever binds first;
 * the oldest leaves, and the answer just put stays through its own put, so its waiter reads it. An id whose body left
 * answers from its verdict row (`releasedBodyOf`), or, for a read that left no row, runs again.
 */
export interface AnswerRing {
  /** Hold one whole outcome under its request id; a second put under one id replaces the first. */
  put(record: LarTiddlerRecord): void;
  /** The whole outcome held for `requestId`, or null once it left (or never came). */
  get(requestId: string): LarTiddlerRecord | null;
  /** Hear each answer as the ring takes it. Answers the unsubscribe. */
  subscribe(fn: (requestId: string, record: LarTiddlerRecord) => void): () => void;
  /** Let every answer go, as a restart does. */
  clear(): void;
  /** How many answers the ring holds, and what they weigh. */
  readonly size: number;
  readonly bytes: number;
}

/** A ring under its own bounds; a vessel's control store carries one (`answerRingOf`). */
export function makeAnswerRing(bounds: { readonly count?: number; readonly bytes?: number } = {}): AnswerRing {
  const count = bounds.count ?? ANSWER_RING_COUNT;
  const limit = bounds.bytes ?? ANSWER_RING_BYTES;
  const held = new Map<string, { readonly record: LarTiddlerRecord; readonly weight: number }>();
  const listeners = new Set<(requestId: string, record: LarTiddlerRecord) => void>();
  let weight = 0;
  const drop = (requestId: string): void => {
    const entry = held.get(requestId);
    if (entry === undefined) return;
    held.delete(requestId);
    weight -= entry.weight;
  };
  return {
    put(record) {
      const title = String(record.tiddler.title ?? "");
      if (!title.startsWith(OUTCOME_URI_PREFIX)) return;
      const requestId = title.slice(OUTCOME_URI_PREFIX.length);
      let measured = 0;
      // An answer whose fields will not canonicalise still answers its caller; it weighs its text alone.
      try { measured = canonicalJsonBytes(record.tiddler).length; } catch { measured = String(record.tiddler["results"] ?? "").length; }
      drop(requestId);
      held.set(requestId, { record, weight: measured });
      weight += measured;
      // The oldest leaves first; the answer just put stays, so a lone answer past the byte bound leaves at the next put.
      while (held.size > 1 && (held.size > count || weight > limit)) drop(held.keys().next().value as string);
      for (const fn of [...listeners]) { try { fn(requestId, record); } catch { /* a listener's fault stays its own */ } }
    },
    get: (requestId) => held.get(requestId)?.record ?? null,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    clear() { held.clear(); weight = 0; },
    get size() { return held.size; },
    get bytes() { return weight; },
  };
}

const answerRings = new WeakMap<object, AnswerRing>();

/**
 * THE RING A CONTROL STORE CARRIES, one per store, minted at its first asking. The island's `writeOutcome` and the door
 * that answers a caller each name the ring by the control store they already hold: where one process holds one store
 * (a suite, a browser vessel's single realm) they share the ring itself, and where the island and the vessel hold two
 * stores in two realms the island's ring hands each answer across (`DaemonMsg_FloorAnswer` with `answer: true`).
 */
export function answerRingOf(control: object): AnswerRing {
  let ring = answerRings.get(control);
  if (ring === undefined) { ring = makeAnswerRing(); answerRings.set(control, ring); }
  return ring;
}

/** A control store that refuses every read and write by name: the shape a stand-in's store takes. */
export function refusingControlStore(refusal: ControlHomeUnavailable): CompositeStore {
  // Each refusal throws fresh, so its stack names the act that asked.
  const refuse = async (): Promise<never> => { throw new ControlHomeUnavailable(refusal.why, refusal.refusal); };
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
    pointMint(handle.url);
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
  await freshBaseOnce(repo, documentId);
  return repo.find<LarDoc>(`automerge:${documentId}` as AutomergeUrl);
}

// ── The fresh base: the control document sheds its history at its stand ──────────────────────────

/** Past this many changes in its history, the control document fresh-bases at its stand. A count decides, never a clock. */
export const CONTROL_FRESH_BASE_AT_CHANGES = 1024;

/** What one fresh base carried: the history it shed and the records it kept. */
export interface ControlFreshBase {
  readonly documentId: string;
  readonly changesBefore: number;
  readonly changesAfter: number;
  readonly tiddlers: number;
  readonly tombstones: number;
}

const freshBaseTried = new WeakMap<Repo, Set<string>>();

/** Fresh-base the control document at most once per Repo; a fault keeps the history whole and says why. */
async function freshBaseOnce(repo: Repo, documentId: string): Promise<void> {
  const tried = freshBaseTried.get(repo) ?? new Set<string>();
  freshBaseTried.set(repo, tried);
  if (tried.has(documentId)) return;
  tried.add(documentId);
  try {
    const based = await freshBaseControlDoc(repo, documentId);
    if (based) console.log(`[control-home] fresh base of ${documentId.slice(0, 8)}…: ${based.changesBefore} changes -> ${based.changesAfter}, ${based.tiddlers} record(s), ${based.tombstones} tombstone(s)`);
  } catch (e) {
    console.warn(`[control-home] the control document keeps its history: its fresh base faulted (${e instanceof Error ? e.message : String(e)})`);
  }
}

/**
 * FRESH-BASE THE CONTROL DOCUMENT: where its stored history holds `atChanges` changes or more, rest in its place one document of
 * its present state alone, and let the history go.
 *
 * THE SAME ID, SO NO READER FOLLOWS ANYWHERE. The custody row, the daemon document's pointer, the daemon island's control grant
 * and every slot and manifest that names the control document name it by its id; the base rests under that id, so each
 * keeps reading what it named. A fresh document under a new id would ask the custody row (sealed under the S key) and the
 * daemon document to re-point, and break whoever held the old url.
 *
 * THE FOUNDING SEED BEGINS IT. The base opens on the control document's own deterministic seed (`heldHomeSeed`), the change
 * its founding began with, then ONE change writes every record and tombstone (`storedRecord`, as a catalog bag's compaction
 * copies them) and every blob. A copy of the old history that merged back would meet the base on shared root maps, and only
 * record against record. No such copy rests: the control document never leaves this vessel, and the base replaces its rest.
 *
 * BEFORE ANY READER HOLDS IT. The base runs through the Repo's own storage, ahead of the Repo's first find: a document this
 * Repo already holds keeps its history (its live handle would merge the old history back on its next save). The storage
 * saves the base as one snapshot and then removes every chunk it loaded, so a stop between the two leaves both readable.
 *
 * Answers what the base carried, or null where it rested nothing (no storage, a held handle, no stored document, a history
 * under the bound).
 */
export async function freshBaseControlDoc(repo: Repo, documentId: string, atChanges: number = CONTROL_FRESH_BASE_AT_CHANGES): Promise<ControlFreshBase | null> {
  const storage = repo.storageSubsystem;
  if (storage === undefined) return null;
  const held = repo.handles[documentId as DocumentId];
  if (held !== undefined) {
    const heldDoc = held.isReady() ? held.doc() : undefined;
    if (heldDoc !== undefined && A.stats(heldDoc).numChanges >= atChanges) console.warn(`[control-home] the control document stood held before its stand, so it keeps its ${A.stats(heldDoc).numChanges} changes; a stand ahead of any other read fresh-bases it`);
    return null;
  }
  const stored = await storage.loadDocData(documentId as DocumentId);
  if (stored === null) return null;
  const old = A.loadIncremental(A.init<LarDoc>(), stored);
  const changesBefore = A.stats(old).numChanges;
  if (changesBefore < atChanges) return null;
  const entries = plainEntries(old.tiddlers);
  let tombstones = 0;
  const fresh = A.change(A.load<LarDoc>(heldHomeSeed(documentId)), { message: "control-fresh-base" }, (d) => {
    for (const [title, record] of entries) {
      d.tiddlers[title] = storedRecord(record);
      if (record.meta?.deleted) tombstones++;
    }
    // Each blob entry copies field by field: an object read off the old document never assigns into another whole.
    const blobs = old.blobs;
    if (blobs !== undefined) {
      const into = ((d as { blobs?: Record<string, unknown> }).blobs ??= {});
      for (const [key, entry] of Object.entries(blobs)) {
        into[key] = Object.fromEntries(Object.entries(entry).map(([field, value]) => [field, value instanceof Uint8Array ? Uint8Array.from(value) : value]));
      }
    }
  });
  if (plainEntries(fresh.tiddlers).length !== entries.length) throw new Error(`the base holds ${plainEntries(fresh.tiddlers).length} record(s) where the history held ${entries.length}`);
  await storage.saveDoc(documentId as DocumentId, fresh);
  return { documentId, changesBefore, changesAfter: A.stats(fresh).numChanges, tiddlers: entries.length - tombstones, tombstones };
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
 * and write by its refusal's name (`vessel-locked`, `control-home-unnamed`), save the floor's verb answers it holds in memory
 * alone (`floorAnswerStore`).
 */
export function controlStoreOf(handle: DocHandle<LarDoc>): CompositeStore {
  const refused = standIns.get(handle);
  if (refused) return floorAnswerStore(refused);
  const control = new CompositeStore();
  const store = new AutomergeDocStore(handle, CONTROL_HOME_ID);
  control.addLayer({ bagId: CONTROL_HOME_ID, store, writable: true, defaultWritable: true });
  store.markSyncComplete();
  return control;
}
