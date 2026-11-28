/**
 * Vessel-private fixed-title registry: floor pins, verified lease slots, device daemon pointers
 * and durable share pending/carry rows. The sealed custody address names it before its first
 * byte. Requests, results and swarm custody never rest here. No old history imports here.
 */
import { Repo, parseAutomergeUrl, type AutomergeUrl, type DocHandle, type DocumentId } from "@automerge/automerge-repo";
import { SecretHomeUnavailable, heldHomeSeed, mintVesselDocumentId, secretHomeRestOf } from "./secret-home.js";
import { VESSEL_STATE_ID, SECRET_HOME_ID } from "./lar-uris.js";
import { FLOOR_REGISTRY_ROOT } from "./device-daemon-docs.js";
import { emptyLarDoc, tiddlerText, type LarDoc } from "./base-doc.js";
import { ownEntry } from "./stored-value.js";
import { storedLarRecord } from "./stored-record.js";
import { CompositeStore } from "./composite-store.js";
import { AutomergeDocStore } from "./automerge-doc-store.js";
import type { LarTiddlerRecord, LarTiddlerStore } from "./tiddler-store.js";
import { pointMint } from "./mint-census.js";


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

export function vesselOnlyDocIds(stateDoc: LarDoc | null | undefined, stateUrl: string | null): Set<string> {
  const ids = new Set<string>();
  const addUrl = (url: string | null) => { if (url?.startsWith("automerge:") && url.length > 10) ids.add(url.slice(10)); };
  addUrl(stateUrl);
  for (const [title, record] of Object.entries(stateDoc?.tiddlers ?? {})) {
    if (title.startsWith(`${VESSEL_STATE_ID}/daemon-slot/`) || title.startsWith(`${VESSEL_STATE_ID}/daemon-canon/`)) addUrl(tiddlerText(record));
  }
  return ids;
}

/**
 * THE VESSEL-ONLY DENY SET a share verdict reads: the state document and every device document it names (`refresh`), and
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
    /** Read the state document's names afresh; answers whether the set grew (and told `onGrow`). */
    refresh: (stateDoc: LarDoc | null | undefined, stateUrl: string | null): boolean => {
      const next = vesselOnlyDocIds(stateDoc, stateUrl);
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
    /** A document that stays on this vessel whatever the state document names (answers whether the set grew). */
    add: (documentId: string): boolean => {
      if (has(documentId)) { added.add(documentId); return false; }
      added.add(documentId);
      opts.onGrow?.();
      return true;
    },
  };
}

/** The state document's url, as the daemon document names it; null where it names none. */
export function vesselStateUrlOf(daemonDoc: LarDoc | null | undefined): string | null {
  const url = tiddlerText(ownEntry(daemonDoc?.tiddlers, VESSEL_STATE_ID));
  return url && url.startsWith("automerge:") ? url : null;
}

/** THE ONE NAME A LOCKED VESSEL REFUSES UNDER, on every platform: the node vessel's state store and verb door, the CLI's
 *  direct holder and the browser's locked boot all answer it (operator ruling 2026-11-09, "locked hearth fails closed"). */
export const VESSEL_LOCKED = "vessel-locked";
/** The refusal of a place that holds no face: the state document mints with the face, so a faceless place holds none. */
export const VESSEL_STATE_UNNAMED = "vessel-state-unnamed";

export type VesselStateRefusal = typeof VESSEL_LOCKED | typeof VESSEL_STATE_UNNAMED | "vessel-state-unavailable";

export class VesselStateUnavailable extends Error {
  override readonly name = "VesselStateUnavailable";
  constructor(readonly why: string, readonly refusal: VesselStateRefusal = "vessel-state-unavailable") {
    super(refusal === "vessel-state-unavailable" ? `vessel-state-unavailable: ${why}` : `vessel-state-unavailable: ${refusal}: ${why}`);
  }
}

const LOCKED_WHY = "the vessel's key stays shut, so no act reads or writes its state document until `lares vault unlock` opens it";
const UNNAMED_WHY = "this place holds no face, and the state document mints with the face; light one with `lares persona new 0`";

/** The refusal each stand-in handle answers: a handle stood while the state document could not be read (`standVesselState`). */
const standIns = new WeakMap<DocHandle<LarDoc>, VesselStateUnavailable>();

/** The refusal `handle` answers (a stand-in stood locked or unnamed), or null where it holds the state document itself. */
export function vesselStateRefusal(handle: DocHandle<LarDoc>): VesselStateUnavailable | null {
  return standIns.get(handle) ?? null;
}

/** Throw the stand-in's refusal by name; a handle over the state document itself passes. */
export function assertVesselStateOpen(handle: DocHandle<LarDoc>): void {
  const refused = standIns.get(handle);
  if (refused) throw new VesselStateUnavailable(refused.why, refused.refusal);
}

/**
 * A STAND-IN: the state document's url and nothing of its content, held on a private storage-less, network-less Repo,
 * so no byte of it rests, syncs or merges into the vessel's Repo. Its state store refuses every read and write by name
 * (`stateStoreOf`), and a durability receipt over it refuses the same (`assertVesselStateOpen`). The next composition
 * (an unlock recomposes) stands the state document itself. A faceless place's stand-in names a fresh id no rest holds.
 * One stand-in per Repo and key, so every stand of one composition hands back the same handle.
 */
const standInsByRepo = new WeakMap<Repo, Map<string, DocHandle<LarDoc>>>();
function standIn(repo: Repo, key: string, documentId: string | null, refusal: () => VesselStateUnavailable): DocHandle<LarDoc> {
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

/** A state store that refuses every read and write by name: the shape a stand-in's store takes. */
export function refusingStateStore(refusal: VesselStateUnavailable): CompositeStore {
  // Each refusal throws fresh, so its stack names the act that asked.
  const refuse = async (): Promise<never> => { throw new VesselStateUnavailable(refusal.why, refusal.refusal); };
  const store: LarTiddlerStore = {
    listVisible: refuse,
    get: refuse as (title: string) => Promise<LarTiddlerRecord | null>,
    put: refuse,
    tombstone: refuse,
    remove: refuse,
    writeFamily: refuse,
    subscribe: () => () => {},
  };
  const state = new CompositeStore();
  state.addLayer({ bagId: VESSEL_STATE_ID, store, writable: true, defaultWritable: true });
  return state;
}

/** The refusal a locked vessel's state store answers (the island's grant carries `stateLocked`). */
export function vesselLockedRefusal(): VesselStateUnavailable {
  return new VesselStateUnavailable(LOCKED_WHY, VESSEL_LOCKED);
}

/** Name the state document in the daemon document (the founding does, beside the secret home's custody row). The first
 *  name the daemon document took holds. */
export function nameVesselState(daemonHandle: DocHandle<LarDoc>, stateUrl: string): string {
  let landed = stateUrl;
  daemonHandle.change((doc) => {
    const prior = vesselStateUrlOf(doc);
    if (prior) { landed = prior; return; }
    doc.tiddlers[VESSEL_STATE_ID] = storedLarRecord(VESSEL_STATE_ID, { text: stateUrl }, "lararium-state");
  });
  return landed;
}

/** The state document's id the daemon document names, or null. */
function pointedStateId(daemonDoc: LarDoc | null | undefined): string | null {
  const url = vesselStateUrlOf(daemonDoc);
  if (url === null) return null;
  try { return parseAutomergeUrl(url as AutomergeUrl).documentId; } catch { return null; }
}

/**
 * Stand the vessel's state document (operator ruling A6, 2026-11-09).
 *
 * THE CUSTODY ROW NAMES IT; THE DAEMON DOCUMENT POINTS AT IT. The face's founding (or admission) mints the state
 * document beside the secret home: one custody row names both, and the daemon document names the state document for a
 * floor whose custody stays shut. The daemon document rests clear and syncs, so a merged concurrent change can move its
 * pointer; the custody row cannot. Where the row reads (the rest's `stateId`, filed by the home's open), its id stands
 * and a daemon document naming another reports and stands refused. No pointer ever files the secret home as state.
 *
 * SEALED UNDER THE VESSEL'S KEY. The state document maps on the store holder's rest under the vessel's held key (bound
 * to its own bag) before its first byte; a stand here maps it again before the Repo reads a byte.
 *
 * A LOCKED VESSEL FAILS CLOSED (operator ruling 2026-11-09). A vessel that stands with its custody locked (the waking
 * floor) hands back a STAND-IN: the state document's url over a private Repo, whose store refuses every read and write
 * `vessel-locked` (`stateStoreOf`), so the daemon VM still stands at the floor and every act needing the state
 * document answers that name back. Nothing the floor does lands in memory waiting for a key. A place that holds no face
 * (a herm, or a hearth before its face) names no state document at all: its stand-in refuses `vessel-state-unnamed`.
 *
 * A HOLDER THAT CANNOT OPEN ITS KEY SAYS WHY. A direct holder stands the vessel's key on demand (`standKey`); a refused
 * open throws by name, carrying the custody's own reason, and never stands a stand-in in its place.
 *
 * A Repo that rests bytes with no sealed rest bound mints nothing here (`vessel-state-unavailable`). A storage-less Repo (a
 * suite's) mints one in memory, where nothing rests at all.
 */
export async function standVesselState(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  const rest = secretHomeRestOf(repo);
  if (rest === null) {
    const pointedUrl = vesselStateUrlOf(daemonHandle.doc());
    if (pointedUrl !== null) return repo.find<LarDoc>(pointedUrl as AutomergeUrl);
    if ((repo as unknown as { storageSubsystem?: unknown }).storageSubsystem !== undefined) {
      throw new VesselStateUnavailable(UNNAMED_WHY, VESSEL_STATE_UNNAMED);
    }
    const handle = repo.create<LarDoc>(emptyLarDoc());
    nameVesselState(daemonHandle, handle.url);
    pointMint(handle.url);
    return handle;
  }
  // A holder whose custody stands open stands the vessel's key first (a direct holder's act opens the home's row, which
  // files the row's state document). A refused open names its reason; it never swallows into a stand-in.
  if (!rest.holdsKey() && rest.standKey) {
    try { await rest.standKey(); }
    catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      // A custody that names no secret home holds no face, so it names no state document; any other refusal kept the key shut.
      if (e instanceof SecretHomeUnavailable) throw new VesselStateUnavailable(`${UNNAMED_WHY} (${why})`, VESSEL_STATE_UNNAMED);
      throw new VesselStateUnavailable(`the vessel's key did not open: ${why}`, VESSEL_LOCKED);
    }
  }
  const pointed = pointedStateId(daemonHandle.doc());
  const custody = rest.stateId?.() ?? null;
  if (custody !== null && pointed !== null && pointed !== custody) {
    console.warn(`[vessel-state] the daemon document names ${pointed.slice(0, 8)}… as the state document; the custody row names ${custody.slice(0, 8)}…: the custody row's stands, the daemon document's pointer stands refused`);
  }
  const documentId = custody ?? pointed;
  if (documentId === null) return standIn(repo, `unnamed:${daemonHandle.documentId}`, null, () => new VesselStateUnavailable(UNNAMED_WHY, VESSEL_STATE_UNNAMED));
  const filed = rest.homeOf?.(documentId) ?? null;
  if (filed === SECRET_HOME_ID) throw new VesselStateUnavailable("the daemon document names the vessel's secret home as its state document; the secret home never files as state");
  if (filed !== null && filed !== VESSEL_STATE_ID) throw new VesselStateUnavailable(`the document named as state stands filed under ${filed}`);
  if (!rest.enrollBeside(documentId, VESSEL_STATE_ID)) return standIn(repo, documentId, documentId, vesselLockedRefusal);
  if (pointed === null && custody !== null) nameVesselState(daemonHandle, `automerge:${custody}`);
  return repo.find<LarDoc>(`automerge:${documentId}` as AutomergeUrl);
}

/**
 * READ the vessel's state document for a fence (a lease epoch, an admission's price): stand it through the vessel's own
 * path (`standVesselState`: the custody row first, the key stood before the Repo reads a byte) and answer it only where it
 * reads whole. FAIL CLOSED (M16): a daemon document and custody that name no state document refuse `vessel-state-unnamed`,
 * and a key that stays shut refuses `vessel-locked`, each by name. A fence read off an unread state document would price
 * at genesis epoch 0.
 */
export async function readVesselState(repo: Repo, daemonHandle: DocHandle<LarDoc>): Promise<DocHandle<LarDoc>> {
  // A suite's storage-less Repo mints a state document at its stand; a fence read never mints one to price against.
  if (secretHomeRestOf(repo) === null && vesselStateUrlOf(daemonHandle.doc()) === null) throw new VesselStateUnavailable(UNNAMED_WHY, VESSEL_STATE_UNNAMED);
  const handle = await standVesselState(repo, daemonHandle);
  assertVesselStateOpen(handle);
  return handle;
}

/**
 * The state document as a store: one layer under `VESSEL_STATE_ID`, its own default writable, so a state writer's put
 * lands there and nowhere else. No recipe composes it and no mirror names its bag. A stand-in's store refuses every read
 * and write by its refusal's name (`vessel-locked`, `vessel-state-unnamed`). Floor answers use their separate memory store.
 */
export function stateStoreOf(handle: DocHandle<LarDoc>): CompositeStore {
  const refused = standIns.get(handle);
  if (refused) return refusingStateStore(refused);
  const state = new CompositeStore();
  const store = new AutomergeDocStore(handle, VESSEL_STATE_ID);
  state.addLayer({ bagId: VESSEL_STATE_ID, store, writable: true, defaultWritable: true });
  store.markSyncComplete();
  return state;
}
