/**
 * catalog-view — the catalog split by face (sealed-store#/owed, U1).
 *
 * No vessel-wide content key mints, so no document that names several faces' rows seals under one key. The catalog
 * dissolves in two: a FLOOR catalog (F) naming public, signed infrastructure alone, readable at the floor and by a herm,
 * and a per-face catalog (D) naming that face's own rows, at an address the face's secret derives, sealed under that
 * face's content key (`FACE_CATALOG_BAG_ID`, sealed beside the daemon wiki's slots). A herm wears no face, so it reads F
 * alone; a lit face reads F with its own D laid over it. The sealed D hydrates only through the daemon island's holder,
 * so a boot EXPECTS the face (`expectFace`: its rows wait in memory) until that holder stands, then binds it.
 *
 * THE VIEW stands where the one catalog handle stood and keeps its shape, so a consumer that reads `doc()` or writes
 * through `change()` keeps its logic: reads merge the face's rows over the floor's, and each write lands on the half
 * its row class names (`catalogRowHalf`). One change over a canon row and a wiki row lands each on its own half. With no
 * face lit (the anon floor, a herm) every row rests on the floor, and the lift (`liftFaceCatalogRows`) carries the face
 * rows a floor wrote into the face's catalog once that face stands, leaving the floor its public rows alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { stringifyAutomergeUrl, type AutomergeUrl, type BinaryDocumentId, type DocHandle, type Repo } from "@automerge/automerge-repo";
import type { LarDoc } from "./base-doc.js";
import { utf8Bytes } from "./crypto.js";
import { FACE_CATALOG_ADDRESS_DOMAIN } from "./domains.js";
import { materializeSharedLarDoc } from "./deterministic-doc.js";
import { CATALOG_CORPUS_PREFIX, CATALOG_DOC_URI, CROSSROADS_DOC_URI, DAEMON_BAG_ID, LARARIUM_DOC_URI, LARES_DOC_URI, ORACLE_DOC_URI, bagUri, isBagId, recipeUri, wikiUri } from "./lar-uris.js";
import { storedRecord } from "./stored-record.js";
import { ownEntry, plainField, plainRecordOrNull, type StoredLarRecord } from "./stored-value.js";

/** The half of the split catalog a row rests on: `floor` (F, public) or `face` (D, the lit face's own). */
export type CatalogHalf = "floor" | "face";

/** The bag the face's catalog document answers to, sealed under the lit face (sealed-store#/owed, T2). */
export { FACE_CATALOG_BAG_ID } from "./register-bags.js";

const REALM_ROOT = bagUri("realm");
const FLOOR_ROWS: ReadonlySet<string> = new Set([
  CATALOG_DOC_URI, ORACLE_DOC_URI, CROSSROADS_DOC_URI, DAEMON_BAG_ID, LARES_DOC_URI, LARARIUM_DOC_URI, REALM_ROOT,
  // The daemon wiki's recipe and canon bag stand on the floor with the daemon document (U1): its slots are D.
  recipeUri("catalog", "daemon"),
]);
const WIKIS_ROOT = `${wikiUri("")}`;

/** The field a bag's catalog row carries its declared read tier in (the declaring act stamps it). */
export const CATALOG_ROW_TIER_FIELD = "cap-tier";

/**
 * A PUBLIC book's row: a bag id whose row carries the exact tier `public`. Any other value, a missing field or a title
 * that names no bag fails toward the face, never toward F.
 */
export function isPublicBagRow(title: string, row: StoredLarRecord | null | undefined): boolean {
  return isBagId(title) && !!row && plainField(row, CATALOG_ROW_TIER_FIELD) === "public";
}

/**
 * Which half a catalog row rests on. F names public, signed infrastructure: the registry's own pointers (catalog,
 * oracle, crossroads), the joined corpora, the live system canon, the realm plane's pointers and standing, the daemon
 * wiki's floor half, and the floor's own vessel-only slot documents (a draft floor, a working floor), which the anon
 * lift reads and burns. Every other row (a user bag, a wiki and its recipe, a face plane, the kahua stage, a slot
 * binding, a title nothing classes) rests on the face: a row that names no class never lands on the floor. A bag row that
 * carries `cap-tier = public` (the row `bag declare --tier public` stamps) names a public book and rests on F too; given
 * no row, the title alone decides.
 */
export function catalogRowHalf(title: string, row?: StoredLarRecord | null): CatalogHalf {
  if (row !== undefined && row !== null && isPublicBagRow(title, row)) return "floor";
  if (FLOOR_ROWS.has(title)) return "floor";
  if (title.startsWith(CATALOG_CORPUS_PREFIX) || title.startsWith(`${REALM_ROOT}/`)) return "floor";
  if (title.startsWith(WIKIS_ROOT) && (/\/working-floor\/[^/]+\/[^/]+$/.test(title) || /\/drafts\/[^/]+$/.test(title))) return "floor";
  return "face";
}

/**
 * A VESSEL THAT WEARS NO FACE BOOTS NO USER WIKI (the sealing scope): before a face lights, a wiki whose canon bag rests on
 * a face's half (`catalogRowHalf`) reads sealed to a face no session wears, so its documents neither load nor rest. Either
 * shore refuses it by name before the wiki mounts, never on the island's mount silence. `source` names who chose the
 * wiki: the boot's own ask (`boot-arg`) or the daemon's active-wiki marker.
 */
export class FloorWikiRefusal extends Error {
  override readonly name = "FloorWikiRefusal";
  readonly reason = "wiki-awaits-face";
  constructor(readonly wikiId: string, readonly source: string) {
    super(`wiki-awaits-face: a vessel that wears no face boots no user wiki — ${wikiId} (named by ${source}) rests on a face's half; unlock its face, or boot a floor wiki`);
  }
}

/** Refuse `wikiId` by name (`FloorWikiRefusal`) when no face is worn and its canon bag's catalog row rests on a face's half. */
export function refuseFacelessUserWiki(input: {
  readonly wikiId: string;
  readonly source: string;
  readonly wikiBagId: string;
  readonly faceWorn: boolean;
  readonly catalog: Readonly<Record<string, StoredLarRecord>> | undefined;
}): void {
  if (input.faceWorn) return;
  if (catalogRowHalf(input.wikiBagId, input.catalog?.[input.wikiBagId] ?? null) === "face") throw new FloorWikiRefusal(input.wikiId, input.source);
}

export type FaceCatalogRefusalReason = "secret-malformed" | "face-catalog-foreign";

/** A face catalog that the presented face's secret does not name. */
export class FaceCatalogRefusal extends Error {
  override readonly name = "FaceCatalogRefusal";
  constructor(readonly reason: FaceCatalogRefusalReason, detail: string) { super(`face catalog: ${reason}: ${detail}`); }
}

/** The face's catalog document: an address its secret alone derives, so no vessel without that secret finds or mints it. */
export function faceCatalogDocUrl(secret: Uint8Array): AutomergeUrl {
  if (!(secret instanceof Uint8Array) || secret.length !== 32) throw new FaceCatalogRefusal("secret-malformed", "a face's address secret carries 32 bytes");
  const binId = hmac(sha256, secret, utf8Bytes(FACE_CATALOG_ADDRESS_DOMAIN)).slice(0, 16) as BinaryDocumentId;
  return stringifyAutomergeUrl({ documentId: binId });
}

/**
 * Open a face's catalog under that face's secret: the document its secret derives, found or materialized as the pinned
 * blank genesis. A url the secret does not derive (another face's catalog) refuses `face-catalog-foreign` and opens
 * nothing.
 */
export async function openFaceCatalog(repo: Repo, url: string, secret: Uint8Array): Promise<DocHandle<LarDoc>> {
  const own = faceCatalogDocUrl(secret);
  if (url !== own) throw new FaceCatalogRefusal("face-catalog-foreign", `${url.slice(0, 22)}… stands under another face's secret`);
  return materializeSharedLarDoc(repo, own, "board:face-catalog");
}

/** The parts of a catalog view, past its handle shape. */
export interface CatalogViewParts {
  readonly floorHandle: DocHandle<LarDoc>;
  /** The lit face's catalog, or null at the floor. */
  faceHandle(): DocHandle<LarDoc> | null;
  /** Lay a lit face's catalog over the floor (null: the floor alone). The view's listeners follow. A face row the view
   *  held while it expected the face lands in that catalog first. */
  bindFace(face: DocHandle<LarDoc> | null): void;
  /**
   * THE FACE EXPECTED: a lit face proved, its sealed catalog not yet open (it hydrates only once the daemon island's
   * holder stands). From here until `bindFace`, a face row a write names rests in this view's memory alone, never in the
   * floor's document nor its history; reads see it, and the bind carries it into the face's catalog. No clock ends the
   * span: a stop before the bind drops the held rows, and the next boot writes them again.
   */
  expectFace(): void;
}

export type CatalogView = DocHandle<LarDoc> & CatalogViewParts;

const VIEW = Symbol.for("lararium.catalog-view");

/** The view parts behind a handle, or null when it reads one document alone. */
export function catalogViewOf(handle: DocHandle<LarDoc> | null | undefined): CatalogViewParts | null {
  return handle ? ((handle as unknown as Record<symbol, CatalogViewParts | undefined>)[VIEW] ?? null) : null;
}

/** The lit face's catalog url behind a handle, or null (a floor view, a plain handle). */
export function faceCatalogUrlOf(handle: DocHandle<LarDoc> | null | undefined): string | null {
  return catalogViewOf(handle)?.faceHandle()?.url ?? null;
}

/**
 * THE LIT FACE THIS PROCESS STANDS, by its floor catalog's url. A composition that lights a face names its catalog
 * here, and every accessor this process opens over that floor (a standing CLI door, a verb plane) reads the face's rows
 * over it; a process that names none (the direct store door with no vessel standing, a herm, a locked floor) reads the
 * floor's public rows alone. An island stands its own process and reads the grant it was handed, never this.
 */
const litFaceCatalogs = new Map<string, string>();

/** Name the lit face's catalog over `floorUrl` for this process. Returns the unnaming, which a teardown runs. */
export function standLitFaceCatalog(floorUrl: string, faceUrl: string): () => void {
  litFaceCatalogs.set(floorUrl, faceUrl);
  return () => { if (litFaceCatalogs.get(floorUrl) === faceUrl) litFaceCatalogs.delete(floorUrl); };
}

/** The lit face's catalog this process stands over `floorUrl`, or null. */
export function litFaceCatalogOf(floorUrl: string): string | null {
  return litFaceCatalogs.get(floorUrl) ?? null;
}

type ChangeListener = (payload: unknown) => void;

/**
 * The catalog as one handle over its two halves. It answers as the floor's handle (its `url`, `documentId`, readiness),
 * reads the face's rows over the floor's, and routes each write by its row's class. A view with no face reads and writes
 * the floor alone.
 */
export function makeCatalogView(floor: DocHandle<LarDoc>, face: DocHandle<LarDoc> | null = null): CatalogView {
  let faceHandle = face;
  // The face rows held while the face stands expected and unbound (`expectFace`): memory alone.
  let held: LarDoc | null = null;
  let heldSeq = 0;
  const listeners = new Set<ChangeListener>();
  const relay = (payload: unknown): void => {
    const p = (payload ?? {}) as Record<string, unknown>;
    for (const l of [...listeners]) l({ ...p, handle: view, doc: merged() });
  };
  let merge: { floor: unknown; face: unknown; held: number; out: LarDoc | undefined } | null = null;
  const merged = (): LarDoc | undefined => {
    const fd = floor.doc();
    const dd = faceHandle?.doc() ?? (held && Object.keys(held.tiddlers).length ? held : undefined);
    if (!dd) return fd;
    if (merge && merge.floor === fd && merge.face === dd && merge.held === heldSeq) return merge.out;
    const out = { ...(fd ?? {}), tiddlers: { ...(fd?.tiddlers ?? {}), ...dd.tiddlers } } as LarDoc;
    merge = { floor: fd, face: dd, held: heldSeq, out };
    return out;
  };
  const change = (fn: (doc: LarDoc) => void, opts?: unknown): void => {
    const into = faceHandle;
    if (!into && held) {
      const parked = held;
      const before = JSON.stringify(Object.keys(parked.tiddlers));
      let touched = false;
      floor.change((fd) => { fn(routedDraft(fd, parked, () => { touched = true; })); }, opts as never);
      if (touched || JSON.stringify(Object.keys(parked.tiddlers)) !== before) { heldSeq++; relay({}); }
      return;
    }
    if (!into) { floor.change(fn, opts as never); return; }
    floor.change((fd) => { into.change((dd) => { fn(routedDraft(fd, dd)); }); }, opts as never);
  };
  const parts: CatalogViewParts = {
    floorHandle: floor,
    faceHandle: () => faceHandle,
    bindFace: (next) => {
      if (next === faceHandle) return;
      if (faceHandle && listeners.size) faceHandle.off("change", relay as never);
      faceHandle = next;
      merge = null;
      if (faceHandle && held) {
        const parked = held;
        held = null;
        const titles = Object.keys(parked.tiddlers);
        if (titles.length) {
          faceHandle.change((dd) => {
            for (const title of titles) {
              const plain = plainRecordOrNull(ownEntry(parked.tiddlers, title));
              if (plain !== null) dd.tiddlers[title] = storedRecord(plain);
            }
          });
        }
      }
      if (faceHandle && listeners.size) faceHandle.on("change", relay as never);
    },
    expectFace: () => {
      if (faceHandle || held) return;
      held = { tiddlers: {} } as unknown as LarDoc;
    },
  };
  const on = (event: string, listener: ChangeListener): unknown => {
    if (event !== "change") return floor.on(event as never, listener as never);
    if (listeners.size === 0) { floor.on("change", relay as never); faceHandle?.on("change", relay as never); }
    listeners.add(listener);
    return view;
  };
  const off = (event: string, listener: ChangeListener): unknown => {
    if (event !== "change") return floor.off(event as never, listener as never);
    listeners.delete(listener);
    if (listeners.size === 0) { floor.off("change", relay as never); faceHandle?.off("change", relay as never); }
    return view;
  };
  const once = (event: string, listener: ChangeListener): unknown => {
    if (event !== "change") return floor.once(event as never, listener as never);
    const one = (p: unknown): void => { off("change", one); listener(p); };
    return on("change", one);
  };
  const own: Record<PropertyKey, unknown> = { doc: merged, change, on, off, once, addListener: on, removeListener: off, [VIEW]: parts, ...parts };
  const view = new Proxy(floor, {
    get(target, prop) {
      if (Object.hasOwn(own, prop)) return own[prop];
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  }) as unknown as CatalogView;
  return view;
}

/**
 * A draft over both halves inside one change: reads see the face's row over the floor's, a row written lands on the
 * half its class names (and leaves the other), a row deleted leaves both. Every other field of the document reads and
 * writes the floor's.
 */
function routedDraft(fd: LarDoc, dd: LarDoc, onFace?: () => void): LarDoc {
  const halfOf = (title: string, row?: StoredLarRecord): LarDoc => (catalogRowHalf(title, row) === "face" ? dd : fd);
  const read = (title: string): unknown => ownEntry(dd.tiddlers, title) ?? ownEntry(fd.tiddlers, title);
  const tiddlers = new Proxy({} as Record<string, unknown>, {
    get: (_t, prop) => (typeof prop === "string" ? read(prop) : undefined),
    set: (_t, prop, value) => {
      if (typeof prop !== "string") return false;
      const into = halfOf(prop, value as StoredLarRecord);
      const other = into === dd ? fd : dd;
      if (into === dd) onFace?.();
      into.tiddlers[prop] = storedRecord(value as StoredLarRecord);
      if (Object.hasOwn(other.tiddlers, prop)) delete other.tiddlers[prop];
      return true;
    },
    deleteProperty: (_t, prop) => {
      if (typeof prop !== "string") return true;
      if (Object.hasOwn(fd.tiddlers, prop)) delete fd.tiddlers[prop];
      if (Object.hasOwn(dd.tiddlers, prop)) { delete dd.tiddlers[prop]; onFace?.(); }
      return true;
    },
    has: (_t, prop) => typeof prop === "string" && (Object.hasOwn(dd.tiddlers, prop) || Object.hasOwn(fd.tiddlers, prop)),
    ownKeys: () => [...new Set([...Object.keys(fd.tiddlers), ...Object.keys(dd.tiddlers)])],
    getOwnPropertyDescriptor: (_t, prop) => {
      if (typeof prop !== "string") return undefined;
      const value = read(prop);
      return value === undefined ? undefined : { value, writable: true, enumerable: true, configurable: true };
    },
  });
  return new Proxy(fd, {
    get: (target, prop) => (prop === "tiddlers" ? tiddlers : Reflect.get(target, prop)),
  });
}

/**
 * THE LIFT: every face row a floor wrote before the face stood (the anon floor's bags and wikis, a plane registered
 * before the seat) moves into the face's catalog and leaves the floor, so the floor names public rows alone. A row the
 * face already holds keeps the face's value. Idempotent: a second run moves nothing. Returns the titles moved.
 */
export function liftFaceCatalogRows(floor: DocHandle<LarDoc>, face: DocHandle<LarDoc>): string[] {
  const titles = Object.keys(floor.doc()?.tiddlers ?? {}).filter((title) => catalogRowHalf(title, ownEntry(floor.doc()?.tiddlers, title) as StoredLarRecord) === "face");
  if (titles.length === 0) return [];
  const carried: string[] = [];
  face.change((dd) => {
    const fd = floor.doc();
    for (const title of titles) {
      if (Object.hasOwn(dd.tiddlers, title)) continue;
      const row = ownEntry(fd?.tiddlers, title);
      if (row === undefined) continue;
      const plain = plainRecordOrNull(row as never);
      if (plain === null) continue;
      dd.tiddlers[title] = storedRecord(plain);
      carried.push(title);
    }
  });
  floor.change((fd) => { for (const title of titles) delete fd.tiddlers[title]; });
  return titles;
}

/** Every lit face's own view over one floor, by PersonaGroup (`faceViewBook`). */
export interface FaceViewBook {
  /** The view a face reads and registers through: the worn face's own, else a sibling's F with its own D. */
  viewOf(group: string): DocHandle<LarDoc>;
  /** Every row any face's view reads, merged (the vessel's own bridge reading, never a face's). */
  everyRow(): LarDoc | undefined;
}

/**
 * THE SIBLING FACES' OWN VIEWS (sealed-store#/owed, U1): a face lit beside the worn one (`lightFace`) reads and registers
 * through its OWN view, the floor with its own D, never the worn face's. A sibling's D holds its rows in the view's memory
 * (`expectFace`): its seal under the sibling's own chain stays owed, so it rests nowhere, and its rows re-derive from the
 * sibling's proof at each lighting. With no worn face, every group reads a sibling view.
 */
export function faceViewBook(floor: DocHandle<LarDoc>, worn: { readonly group: string; readonly view: DocHandle<LarDoc> } | null): FaceViewBook {
  const siblings = new Map<string, CatalogView>();
  const viewOf = (group: string): DocHandle<LarDoc> => {
    if (worn && group === worn.group) return worn.view;
    let view = siblings.get(group);
    if (!view) { view = makeCatalogView(floor); view.expectFace(); siblings.set(group, view); }
    return view;
  };
  return {
    viewOf,
    everyRow: () => {
      const docs = [worn?.view.doc() ?? floor.doc(), ...[...siblings.values()].map((v) => v.doc())].filter((d): d is LarDoc => d !== undefined);
      if (docs.length <= 1) return docs[0];
      return { ...docs[0]!, tiddlers: Object.assign({}, ...docs.map((d) => d.tiddlers)) } as LarDoc;
    },
  };
}
