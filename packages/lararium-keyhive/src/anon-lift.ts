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
 * and draft kinds alike) the catalog's floor draft records keyed by this vessel's DID, and the control document's
 * floor WORKING slots (`floor-slot/<slug>/working`, the veil floor's own wiki content). Another vessel's records never match (`minted-by`),
 * and a record that already reads `face` never matches.
 *
 * ── THE WORKING FLOOR GOES TO THE FACE'S REALM WORKBENCH ────────────────────────────────────────
 * The veil floor stands a wiki's working layer in a document of its own (the-veil-ladder#/the-base-model: "its own local
 * content, no group"). The Lift carries that document's rows into the face's realm workbench for the wiki
 * (cabal-realm#/the-workbench: the address derives from the face and the slug, so every device of the face reaches it),
 * ADDITIVELY: a title the workbench lacks moves; a title it already holds alike moves nothing; a title it holds otherwise
 * STAYS at the floor and the result names it (`kept`), so no lift overwrites a face's row. A floor document that carried
 * every row burns and its control row leaves; one that keeps rows stays, holding those rows alone. This leg reads no retired
 * format: the floor and the workbench both stand in the living design, and every vessel that ever joins a face runs it.
 *
 * ── IDEMPOTENT IN D ─────────────────────────────────────────────────────────────────────────────
 * The mark rests with the binding, in the daemon bag: `lifted-from` (a digest of the floor key) and, until the burn finishes,
 * `lifted-from-url`. The floor index keeps no mark and no link to the face: once the lift lands the floor record is gone. A pass
 * that finds a binding still holding `lifted-from-url` finishes the burn and moves nothing a second time.
 */
import {
  DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, canonicalJson, emptyLarDoc,
  mutableLarRecord, tiddlerText, FLOOR_SLOT_ROOT, floorSlotOf, sha256HexBytesSync, utf8Bytes, wikiDraftDocKey, requireLarDid, plainEntries, storedRecord,
  type ChangeOrigin, type CompositeStore, type LarDoc, ownEntry, DOCUMENT_READY_TIMEOUT_MS} from "@lararium/mesh";
import type { CatalogAccessor } from "@lararium/tw5";
import type { FaceBagDoor } from "./face-bag-door.js";

/** The repo surface the lift needs: mint, read, flush and delete a document. */
export interface LiftRepo {
  create<T = LarDoc>(initialValue: T): { readonly url: string; readonly documentId: string; whenReady?(): Promise<unknown>; change(fn: (doc: LarDoc) => void): void };
  find(url: string): Promise<{ readonly documentId: string; whenReady?(): Promise<unknown>; doc(): LarDoc | undefined; change(fn: (doc: LarDoc) => void): void }>;
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
  /** How long a floor document may stay silent before the lift names it and skips it (default: the house's document-ready bound). */
  readonly readBoundMs?: number;
  /** The labels a faceless floor gave its documents (the public place key and its DID): a lit face lifts those too. */
  readonly floor?: { readonly mintedByHex: string; readonly vesselDid: string };
  /**
   * THE WORKING FLOOR: the control store that names the floor's working slots, and the face's realm workbench for a wiki
   * (stood on ask). Absent, no working floor lifts (a vessel with no control document held none).
   */
  readonly working?: {
    readonly control: CompositeStore;
    readonly workbench: (slug: string) => Promise<string>;
  };
  /** The binding slot a wiki's draft floor belongs to: its fingerprint and trace, or null where the wiki is unregistered. */
  readonly traceOf: (slug: string) => Promise<{ readonly fingerprint: string; readonly recipeTrace: { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] } } | null>;
}

/**
 * The document a skipped record waits on, and WHAT it waits for: `arrival` (a read of a document peers have not delivered yet: its
 * `whenReady` wakes the next pass) or `rest` (a flush of a document the lift holds that storage has not confirmed: its flush wakes the
 * next pass). A waker that mapped every skip to a READY document's arrival would resolve at once and re-run the lift every bound.
 */
export interface SkippedDoc { readonly url: string; readonly waits: "arrival" | "rest" }
/** `skipped`: the records a silent floor document held back this pass; `skippedDocs` names, per skip, the document whose arrival or rest wakes the next pass. */
export interface LiftResult {
  readonly moved: readonly string[]; readonly finished: readonly string[]; readonly skipped: readonly string[]; readonly skippedDocs: readonly SkippedDoc[];
  /** Per wiki, the floor working titles the face's workbench already held otherwise: they stay at the floor, named, never overwritten. */
  readonly kept?: readonly { readonly slug: string; readonly titles: readonly string[] }[];
}

const PREFIXES = [
  { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
  { prefix: DRAFT_BINDINGS_PREFIX, kind: "draft-binding" },
] as const;

/** Whether this vessel minted the record: under the lit face's label, or under the floor's public place label. */
const mintedHere = (args: LiftArgs, by: unknown): boolean => by === args.mintedByHex || (args.floor !== undefined && by === args.floor.mintedByHex);

const digestOf = (text: string): string => sha256HexBytesSync(utf8Bytes(text));
const originFor = (tag: string): ChangeOrigin => ({ kind: "lares-verb", requestId: `anon-lift-${tag}`.slice(0, 32) });
/** Copy `from`'s tiddlers into `into` where `into` holds none of that title: read through the read door, written through the write door. */
function carryTiddlers(from: LarDoc | undefined, into: { change(fn: (doc: LarDoc) => void): void }, skip?: Set<string>): void {
  const source = plainEntries(from?.tiddlers);
  if (source.length === 0) return;
  into.change((doc) => {
    for (const [title, record] of source) {
      if (!skip?.has(title) && ownEntry(doc.tiddlers, title) === undefined) doc.tiddlers[title] = storedRecord(record);
    }
  });
}

/** A document that neither arrived nor rested within the read bound: the lift names it and what it waits for, leaves the floor where it stands and moves on. */
export class FloorDocumentUnavailable extends Error {
  constructor(readonly url: string, readonly waits: SkippedDoc["waits"], readonly waitedMs: number) {
    super(`[anon-lift] document ${url} never ${waits === "arrival" ? "arrived" : "rested (its flush never answered)"} (${waitedMs}ms); the lift skips the floor record it holds and leaves it unburned, to lift on a later pass`);
    this.name = "FloorDocumentUnavailable";
  }
}

/** One read of a document the lift does not own, bounded: automerge-repo's `find` waits for ever while a peer stays silent, and the lift runs inside the daemon island's boot. */
async function boundedRead<T>(args: LiftArgs, url: string, waits: SkippedDoc["waits"], read: () => Promise<T>): Promise<T> {
  const waitedMs = args.readBoundMs ?? DOCUMENT_READY_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // LIVENESS: a peer may never deliver the document; a later pass can retry the skipped read.
    const out = await Promise.race([read(), new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), waitedMs); })]);
    if (out === TIMED_OUT) throw new FloorDocumentUnavailable(url, waits, waitedMs);
    return out;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
const TIMED_OUT = Symbol("timed-out");

async function readDoc(args: LiftArgs, url: string): Promise<LarDoc | undefined> {
  return boundedRead(args, url, "arrival", async () => {
    const handle = await args.repo.find(url);
    await handle.whenReady?.();
    return handle.doc();
  });
}

/** Mint a fresh document under the face and carry the floor document's tiddlers into it. */
async function rehome(args: LiftArgs, oldUrl: string): Promise<{ url: string; keyhiveDocId: string }> {
  // The floor document is read FIRST: a silent one leaves nothing minted behind it.
  const old = await readDoc(args, oldUrl);
  const fresh = args.repo.create<LarDoc>(emptyLarDoc());
  await fresh.whenReady?.();
  const { docId } = await args.faceDoor.mint(fresh.url, "admin");
  carryTiddlers(old, fresh);
  await boundedRead(args, fresh.url, "rest", () => args.repo.flush([fresh.documentId]));
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
  const skipped: string[] = [];
  const skippedDocs: SkippedDoc[] = [];
  const held = (error: FloorDocumentUnavailable, key: string): void => { console.warn(error.message); skipped.push(key); skippedDocs.push({ url: error.url, waits: error.waits }); };
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
    let next: { url: string; keyhiveDocId: string };
    try { next = await rehome(args, oldUrl); } catch (error) { if (error instanceof FloorDocumentUnavailable) { held(error, title); continue; } throw error; }
    await putBinding(args, title, {
      ...carried(fields), text: next.url, "face-reach": "face", "keyhive-doc-id": next.keyhiveDocId,
      "lifted-from": digestOf(title), "lifted-from-url": oldUrl,
    }, `bind-${title.slice(-8)}`);
    await burn(args, oldUrl);
    // The burn landed: the pending mark leaves with it, so a replay finds nothing to finish.
    const { ["lifted-from-url"]: _burned, ...settled } = carried(fieldsOf(await args.daemonStore.get(title)) ?? {});
    await putBinding(args, title, {
      ...settled, text: next.url, "face-reach": "face", "keyhive-doc-id": next.keyhiveDocId,
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
        try {
          const into = await boundedRead(args, standingUrl, "arrival", async () => { const h = await args.repo.find(standingUrl); await h.whenReady?.(); return h; });
          carryTiddlers(await readDoc(args, oldUrl), into as unknown as { change(fn: (doc: LarDoc) => void): void });
        } catch (error) { if (error instanceof FloorDocumentUnavailable) { held(error, floorKey); continue; } throw error; }
        url = standingUrl; keyhiveDocId = String(fieldsOf(standing)?.["keyhive-doc-id"] ?? "");
      } else {
        let next: { url: string; keyhiveDocId: string };
        try { next = await rehome(args, oldUrl); } catch (error) { if (error instanceof FloorDocumentUnavailable) { held(error, floorKey); continue; } throw error; }
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
  }

  // 4 — the veil floor's working slots, named by the control document: each wiki's rows go to the face's realm workbench.
  const kept: { slug: string; titles: string[] }[] = [];
  const working = args.working;
  if (working) {
    for (const { title, record } of await working.control.entries()) {
      const named = title.startsWith(FLOOR_SLOT_ROOT) ? floorSlotOf(title) : null;
      const fields = fieldsOf(record);
      const floorUrl = tiddlerText(record);
      if (!named || named.kind !== "working" || !fields || !floorUrl || fields["face-reach"] !== "vessel-only" || !mintedHere(args, fields["minted-by"])) continue;
      try {
        const floor = await boundedRead(args, floorUrl, "arrival", async () => { const h = await args.repo.find(floorUrl); await h.whenReady?.(); return h; });
        const source = plainEntries(floor.doc()?.tiddlers);
        const benchUrl = await working.workbench(named.slug);
        const bench = await boundedRead(args, benchUrl, "arrival", async () => { const h = await args.repo.find(benchUrl); await h.whenReady?.(); return h; });
        const same = (a: unknown, b: unknown): boolean => canonicalJson(textFieldsOf(a as Record<string, unknown>)) === canonicalJson(textFieldsOf(b as Record<string, unknown>));
        const stays: string[] = [];
        const lifts: string[] = [];
        const standing = bench.doc()?.tiddlers;
        for (const [rowTitle, row] of source) {
          const there = ownEntry(standing, rowTitle);
          if (there === undefined) lifts.push(rowTitle);
          else if (!same((there as { tiddler?: unknown }).tiddler ?? {}, (row as { tiddler?: unknown }).tiddler ?? {})) stays.push(rowTitle);
        }
        if (lifts.length > 0) {
          const carry = new Set(lifts);
          bench.change((doc) => { for (const [rowTitle, row] of source) if (carry.has(rowTitle) && ownEntry(doc.tiddlers, rowTitle) === undefined) doc.tiddlers[rowTitle] = storedRecord(row); });
        }
        await boundedRead(args, benchUrl, "rest", () => args.repo.flush([bench.documentId]));
        if (stays.length === 0) {
          // Every row rests in the workbench: the floor document burns, then its control row leaves.
          await burn(args, floorUrl);
          await working.control.remove(title, originFor(`work-${named.slug.slice(0, 12)}`));
        } else {
          // The rows the workbench holds otherwise stay, alone, so a replay reads the same floor and moves nothing.
          const stay = new Set(stays);
          floor.change((doc) => { for (const rowTitle of Object.keys(doc.tiddlers)) if (!stay.has(rowTitle)) delete doc.tiddlers[rowTitle]; });
          await boundedRead(args, floorUrl, "rest", () => args.repo.flush([floor.documentId]));
          kept.push({ slug: named.slug, titles: stays.sort() });
          console.warn(`[anon-lift] ${named.slug}: ${stays.length} floor row(s) stay at the floor; the face's workbench holds each title otherwise (${stays.slice(0, 5).join(", ")}${stays.length > 5 ? ", …" : ""})`);
        }
        if (lifts.length > 0 || stays.length === 0) moved.push(title);
      } catch (error) { if (error instanceof FloorDocumentUnavailable) { held(error, title); continue; } throw error; }
    }
  }
  return { moved, finished, skipped, skippedDocs, ...(kept.length > 0 ? { kept } : {}) };
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
