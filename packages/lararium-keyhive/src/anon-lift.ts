/**
 * anon-lift — THE ANON-VEIL LIFT (operator ruling 2026-10-22): when an anonymous vessel joins a PersonaGroup, every piece of
 * keyed material its anon veil holds lifts into the face's cap stack. The seat's landing is the gate; no per-item accept stands.
 *
 * ── ONE PATH FROM THE FLOOR TO THE FACE ─────────────────────────────────────────────────────────
 * A floor document (`face-reach = vessel-only`) rides the vessel's own key alone and is delegated to nobody. Re-registering its
 * URL under the face would COPY it: the document's earlier history stays plain at the floor URL for anyone who holds it. So the
 * lift MOVES the content: a NEW document, minted under the face door, takes the floor document's tiddlers; the binding record
 * names the new URL; the floor document leaves the catalog and leaves the vessel's storage (`repo.delete`). Nothing re-registers
 * an old URL under a face, here or at the next reuse.
 *
 * ── THE SET IS DERIVED, NEVER LISTED ────────────────────────────────────────────────────────────
 * Every record this vessel minted at the floor and has not yet moved: daemon-bag binding records reading `vessel-only` (personal
 * and draft kinds alike), the catalog's floor draft records keyed by this vessel's DID, and the catalog's floor WORKING
 * records keyed by the place's own identity (its W29 place KEL prefix). Another vessel's records never match (`minted-by`),
 * and a record that already reads `face` never matches.
 *
 * ── THE WORKING FLOOR GOES TO THE FACE'S DERIVED ADDRESS ────────────────────────────────────────
 * A face's working document has no record: its address derives from the face's secret and the wiki's slug. The lift carries
 * each floor working document's tiddlers into the face's document for that wiki (additively: a title the face's document
 * holds stays), rests it, takes the place's key out of the catalog, and burns the floor document. The place's key then names
 * nothing. A stop between the key's removal and the burn leaves the floor document in this vessel's own storage alone; a
 * stop before the removal runs again whole, its carry adding nothing twice.
 *
 * ── IDEMPOTENT IN D ─────────────────────────────────────────────────────────────────────────────
 * The mark rests with the binding, in the daemon bag: `lifted-from` (a digest of the floor key) and, until the burn finishes,
 * `lifted-from-url`. The floor index keeps no mark and no link to the face: once the lift lands the floor record is gone. A pass
 * that finds a binding still holding `lifted-from-url` finishes the burn and moves nothing a second time.
 */
import {
  DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, canonicalJson, emptyLarDoc,
  mutableLarRecord, tiddlerText, sha256HexBytesSync, utf8Bytes, wikiDraftDocKey, requireLarDid, plainEntries, storedRecord,
  type ChangeOrigin, type CompositeStore, type LarDoc,
} from "@lararium/mesh";
import type { CatalogAccessor } from "@lararium/tw5";
import type { FaceBagDoor } from "./face-bag-door.js";

/** The repo surface the lift needs: mint, read, flush and delete a document. */
export interface LiftRepo {
  create<T = LarDoc>(initialValue: T): { readonly url: string; readonly documentId: string; whenReady?(): Promise<unknown>; change(fn: (doc: LarDoc) => void): void };
  find(url: string): Promise<{ whenReady?(): Promise<unknown>; doc(): LarDoc | undefined }>;
  flush(documents?: string[]): Promise<void>;
  delete(url: string): unknown;
}

export interface LiftArgs {
  readonly repo: LiftRepo;
  readonly daemonStore: CompositeStore;
  readonly catalog: CatalogAccessor | null;
  readonly faceDoor: FaceBagDoor;
  readonly mintedByHex: string;
  readonly vesselDid: string;
  /** The labels a faceless floor gave its documents (the public place key and its DID): a lit face lifts those too. */
  readonly floor?: { readonly mintedByHex: string; readonly vesselDid: string };
  /** The binding slot a wiki's draft floor belongs to: its fingerprint and trace, or null where the wiki is unregistered. */
  /** The working floor: the place's KEL prefix it rests by, the face's derived address for a slug, and its door. */
  readonly working?: {
    readonly place: string | null;
    readonly urlOf: (slug: string) => Promise<string>;
    readonly open?: (url: string, label: string) => Promise<{ readonly documentId: string; change(fn: (doc: LarDoc) => void): void }>;
  };
  readonly traceOf: (slug: string) => Promise<{ readonly fingerprint: string; readonly recipeTrace: { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] } } | null>;
}

export interface LiftResult { readonly moved: readonly string[]; readonly finished: readonly string[] }

const PREFIXES = [
  { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
  { prefix: DRAFT_BINDINGS_PREFIX, kind: "draft-binding" },
] as const;

/** Whether this vessel minted the record: under the lit face's label, or under the floor's public place label. */
const mintedHere = (args: LiftArgs, by: unknown): boolean => by === args.mintedByHex || (args.floor !== undefined && by === args.floor.mintedByHex);

const digestOf = (text: string): string => sha256HexBytesSync(utf8Bytes(text));
const originFor = (tag: string): ChangeOrigin => ({ kind: "lares-verb", requestId: `anon-lift-${tag}`.slice(0, 32) });

/** Copy `from`'s tiddlers into `into` where `into` holds none of that title: read through the read door, written through the write door. */
function carryTiddlers(from: LarDoc | undefined, into: { change(fn: (doc: LarDoc) => void): void }): void {
  const source = plainEntries(from?.tiddlers);
  if (source.length === 0) return;
  into.change((doc) => {
    for (const [title, record] of source) {
      if (doc.tiddlers[title] === undefined) doc.tiddlers[title] = storedRecord(record);
    }
  });
}

async function readDoc(repo: LiftRepo, url: string): Promise<LarDoc | undefined> {
  const handle = await repo.find(url);
  await handle.whenReady?.();
  return handle.doc();
}

/** Mint a fresh document under the face and carry the floor document's tiddlers into it. */
async function rehome(args: LiftArgs, oldUrl: string): Promise<{ url: string; keyhiveDocId: string }> {
  const fresh = args.repo.create<LarDoc>(emptyLarDoc());
  await fresh.whenReady?.();
  const { docId } = await args.faceDoor.mint(fresh.url, "admin");
  carryTiddlers(await readDoc(args.repo, oldUrl), fresh);
  await args.repo.flush([fresh.documentId]);
  return { url: fresh.url, keyhiveDocId: docId };
}

async function burn(args: LiftArgs, oldUrl: string): Promise<void> {
  await args.repo.delete(oldUrl);
}

/** Every string-bearing field of a record as a plain string: an Automerge string reads as an object, never as a primitive. */
const textFieldsOf = (fields: Record<string, unknown>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    const plain = typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    const stringLike = typeof v === "object" && v !== null && !Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v));
    if (plain || stringLike) out[k] = String(v);
  }
  return out;
};
const fieldsOf = (record: { tiddler?: unknown } | undefined | null): Record<string, string> | undefined =>
  record?.tiddler ? textFieldsOf(record.tiddler as Record<string, unknown>) : undefined;
const carried = (fields: Record<string, string>): Record<string, string> => {
  const { title: _title, ...rest } = fields;
  return rest;
};

async function putBinding(args: LiftArgs, title: string, fields: Record<string, string>, tag: string): Promise<void> {
  await args.daemonStore.put(mutableLarRecord(title, fields, "personal-bindings"), originFor(tag), { bag: DAEMON_BAG_ID });
}

/** Run the lift once. Safe to run again: it moves nothing it already moved and finishes any burn a crash left. */
export async function liftVesselOnlyIntoFace(args: LiftArgs): Promise<LiftResult> {
  const moved: string[] = [];
  const finished: string[] = [];
  const entries = await args.daemonStore.entries();

  // 1 — a burn a crash left: a binding still holding its floor URL finishes the burn, moving nothing.
  for (const { title, bagId, record } of entries) {
    if (bagId !== DAEMON_BAG_ID || !PREFIXES.some((p) => title.startsWith(`${p.prefix}/`))) continue;
    const fields = fieldsOf(record);
    const pending = fields?.["lifted-from-url"];
    if (!fields || typeof pending !== "string") continue;
    await burn(args, pending);
    await dropFloorRecord(args, String(fields["lifted-from"] ?? ""));
    const { ["lifted-from-url"]: _gone, ...rest } = carried(fields);
    await putBinding(args, title, rest, `finish-${title.slice(-8)}`);
    finished.push(title);
  }

  // 2 — daemon-bag bindings minted at the floor by this vessel.
  for (const { title, bagId, record } of entries) {
    if (bagId !== DAEMON_BAG_ID || !PREFIXES.some((p) => title.startsWith(`${p.prefix}/`))) continue;
    const fields = fieldsOf(record);
    const oldUrl = tiddlerText(record);
    if (!fields || !oldUrl || fields["face-reach"] !== "vessel-only" || !mintedHere(args, fields["minted-by"])) continue;
    const next = await rehome(args, oldUrl);
    await putBinding(args, title, {
      ...carried(fields), text: next.url, "face-reach": "face", "keyhive-doc-id": next.keyhiveDocId,
      "lifted-from": digestOf(title), "lifted-from-url": oldUrl,
    }, `bind-${title.slice(-8)}`);
    await burn(args, oldUrl);
    await putBinding(args, title, {
      ...carried(fieldsOf(await args.daemonStore.get(title)) ?? {}), text: next.url, "face-reach": "face", "keyhive-doc-id": next.keyhiveDocId,
      "lifted-from": digestOf(title),
    }, `done-${title.slice(-8)}`);
    moved.push(title);
  }

  // 3 — the catalog's floor drafts, keyed by this vessel's DID.
  const catalog = args.catalog;
  if (catalog) {
    const handle = await catalog.handle();
    const marks = [args.vesselDid, ...(args.floor ? [args.floor.vesselDid] : [])]
      .map((did) => `/drafts/${encodeURIComponent(requireLarDid(did, "anon-lift"))}`);
    for (const [floorKey, rec] of plainEntries(handle.doc()?.tiddlers)) {
      const mark = marks.find((m) => floorKey.endsWith(m));
      if (!mark) continue;
      const fields = textFieldsOf(rec.tiddler as Record<string, unknown>);
      const oldUrl = fields["text"] ?? null;
      if (!oldUrl || fields["face-reach"] !== "vessel-only" || !mintedHere(args, fields["minted-by"])) continue;
      const slug = floorKey.slice(0, -mark.length).replace(/^.*\/wikis\//, "");
      const trace = await args.traceOf(slug);
      if (!trace) continue;
      const bindingKey = `${DRAFT_BINDINGS_PREFIX}/${trace.fingerprint}`;
      const standing = await args.daemonStore.get(bindingKey);
      const standingUrl = tiddlerText(standing);
      let url: string; let keyhiveDocId: string;
      if (standingUrl && fieldsOf(standing)?.["face-reach"] === "face") {
        // The face already holds a draft for this wiki: the floor draft joins it, additively.
        const into = await args.repo.find(standingUrl);
        await into.whenReady?.();
        carryTiddlers(await readDoc(args.repo, oldUrl), into as unknown as { change(fn: (doc: LarDoc) => void): void });
        url = standingUrl; keyhiveDocId = String(fieldsOf(standing)?.["keyhive-doc-id"] ?? "");
      } else {
        const next = await rehome(args, oldUrl);
        url = next.url; keyhiveDocId = next.keyhiveDocId;
      }
      await putBinding(args, bindingKey, {
        text: url, kind: "draft-binding", fingerprint: trace.fingerprint, "recipe-trace": canonicalJson(trace.recipeTrace),
        "minted-by": args.mintedByHex, "face-reach": "face", "keyhive-doc-id": keyhiveDocId,
        "lifted-from": digestOf(floorKey), "lifted-from-url": oldUrl,
      }, `floor-${slug.slice(0, 12)}`);
      await burn(args, oldUrl);
      handle.change((doc) => { delete doc.tiddlers[floorKey]; });
      await putBinding(args, bindingKey, {
        text: url, kind: "draft-binding", fingerprint: trace.fingerprint, "recipe-trace": canonicalJson(trace.recipeTrace),
        "minted-by": args.mintedByHex, "face-reach": "face", "keyhive-doc-id": keyhiveDocId,
        "lifted-from": digestOf(floorKey),
      }, `floor-done-${slug.slice(0, 12)}`);
      moved.push(floorKey);
    }
    // 4 — the catalog's floor working documents, keyed by the place's own identity.
    const working = args.working;
    if (working?.place && working.open) {
      const mark = `/working-floor/${encodeURIComponent(working.place)}`;
      for (const [floorKey, rec] of plainEntries(handle.doc()?.tiddlers)) {
        if (!floorKey.endsWith(mark)) continue;
        const fields = textFieldsOf(rec.tiddler as Record<string, unknown>);
        const oldUrl = fields["text"] ?? null;
        if (!oldUrl || fields["face-reach"] !== "vessel-only" || !mintedHere(args, fields["minted-by"])) continue;
        const slug = floorKey.slice(0, -mark.length).replace(/^.*\/wikis\//, "");
        const url = await working.urlOf(slug);
        const into = await working.open(url, slug);
        carryTiddlers(await readDoc(args.repo, oldUrl), into);
        await args.repo.flush([into.documentId]);
        await args.faceDoor.mint(url, "admin");
        handle.change((doc) => { delete doc.tiddlers[floorKey]; });
        await burn(args, oldUrl);
        moved.push(floorKey);
      }
    }
  }
  return { moved, finished };
}

/** Remove the catalog floor record whose key digests to `digest`, if one still stands. */
async function dropFloorRecord(args: LiftArgs, digest: string): Promise<void> {
  if (!args.catalog || !digest) return;
  const handle = await args.catalog.handle();
  const keys = Object.keys(handle.doc()?.tiddlers ?? {}).filter((k) => digestOf(k) === digest);
  if (keys.length === 0) return;
  handle.change((doc) => { for (const k of keys) delete doc.tiddlers[k]; });
}

export { wikiDraftDocKey };
