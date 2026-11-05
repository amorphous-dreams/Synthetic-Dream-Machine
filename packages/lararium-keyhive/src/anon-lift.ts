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
 * records keyed by the floor's own anchor (a node's W29 place KEL prefix, a browser leaf's private Nexus of one). Another vessel's records never match (`minted-by`),
 * and a record that already reads `face` never matches.
 *
 * ── THE WORKING FLOOR GOES TO THE FACE'S DERIVED ADDRESS ────────────────────────────────────────
 * A face's working document has no record: its address derives from the face's secret and the wiki's slug. The lift carries
 * each floor working document's tiddlers into the face's document for that wiki (additively: a title the face's document
 * holds stays), rests it, marks the anchor's key `lifted-from`, burns the floor document, and takes the key out of the catalog
 * last. A durable floor marker records the destination only after the destination flush. A failed destination flush
 * still writes a durable skip history to the floor source, so a retry after restart never re-carries titles that left.
 * A retry skips titles already listed there or covered by the durable destination marker. A stop
 * after the mark finds the marked key on the next pass, which burns the floor document and removes the key, carrying nothing.
 *
 * ── THE SECRET STANDS FIRST ─────────────────────────────────────────────────────────────────────
 * The seated face's address secret must stand before the first step runs (`slot-doc-resolver` preflights it): with none, the
 * lift refuses `no-address-secret` and changes nothing, so no lift moves its drafts and then halts at the working floor.
 *
 * ── IDEMPOTENT IN D ─────────────────────────────────────────────────────────────────────────────
 * The mark rests with the binding, in the daemon bag: `lifted-from` (a digest of the floor key) and, until the burn finishes,
 * `lifted-from-url`. The floor index keeps no mark and no link to the face: once the lift lands the floor record is gone. A pass
 * that finds a binding still holding `lifted-from-url` finishes the burn and moves nothing a second time.
 */
import {
  DAEMON_BAG_ID, DRAFT_BINDINGS_PREFIX, PERSONAL_BINDINGS_PREFIX, canonicalJson, emptyLarDoc,
  mutableLarRecord, tiddlerText, sha256HexBytesSync, utf8Bytes, wikiDraftDocKey, requireLarDid, plainEntries, storedRecord, storedLarRecord,
  floorAnchorSegment, type WorkingFloorAnchor, type ChangeOrigin, type CompositeStore, type LarDoc, ownEntry, plainField, DOCUMENT_READY_TIMEOUT_MS} from "@lararium/mesh";
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
  /** The binding slot a wiki's draft floor belongs to: its fingerprint and trace, or null where the wiki is unregistered. */
  /** The working floor: the floor's own anchor it rests by, the face's derived address for a slug, and its door. */
  readonly working?: {
    readonly anchor: WorkingFloorAnchor | null;
    readonly urlOf: (slug: string) => Promise<string>;
    readonly open?: (url: string, label: string) => Promise<{ readonly documentId: string; change(fn: (doc: LarDoc) => void): void }>;
    /** Swap a live mounted floor writer synchronously before any further asynchronous work. */
    readonly rebind?: (slug: string, oldUrl: string, newUrl: string, into: { readonly documentId: string; change(fn: (doc: LarDoc) => void): void }) => void;
  };
  readonly traceOf: (slug: string) => Promise<{ readonly fingerprint: string; readonly recipeTrace: { readonly wikiDocId: string; readonly libraryBagDocIds: readonly string[] } } | null>;
}

/** `skipped`: the records a silent floor document held back this pass; the next pass lifts them once the document answers. */
export interface LiftResult { readonly moved: readonly string[]; readonly finished: readonly string[]; readonly skipped: readonly string[] }

const PREFIXES = [
  { prefix: PERSONAL_BINDINGS_PREFIX, kind: "personal-binding" },
  { prefix: DRAFT_BINDINGS_PREFIX, kind: "draft-binding" },
] as const;

/** Whether this vessel minted the record: under the lit face's label, or under the floor's public place label. */
const mintedHere = (args: LiftArgs, by: unknown): boolean => by === args.mintedByHex || (args.floor !== undefined && by === args.floor.mintedByHex);

const digestOf = (text: string): string => sha256HexBytesSync(utf8Bytes(text));
const originFor = (tag: string): ChangeOrigin => ({ kind: "lares-verb", requestId: `anon-lift-${tag}`.slice(0, 32) });
const WORKING_CARRY_MARK = "$:/lares/anon-lift/working-carried-to";
const WORKING_CARRY_SKIP = "skip-titles";

function readWorkingCarrySkip(value: unknown): Set<string> {
  const text = typeof value === "string" ? value : (value == null ? "" : String(value));
  if (text.trim() === "") return new Set();
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((title): title is string => typeof title === "string"));
  } catch { return new Set(); }
}

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

/** A floor document no peer answered for within the read bound: the lift names it, leaves it where it stands and moves on. */
export class FloorDocumentUnavailable extends Error {
  constructor(readonly url: string, readonly waitedMs: number) {
    super(`[anon-lift] floor document ${url} never arrived or never rested (${waitedMs}ms); the lift skips it and leaves it unburned, to lift on a later pass`);
    this.name = "FloorDocumentUnavailable";
  }
}

/** One read of a document the lift does not own, bounded: automerge-repo's `find` waits for ever while a peer stays silent, and the lift runs inside the daemon island's boot. */
async function boundedRead<T>(args: LiftArgs, url: string, read: () => Promise<T>): Promise<T> {
  const waitedMs = args.readBoundMs ?? DOCUMENT_READY_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const out = await Promise.race([read(), new Promise<typeof TIMED_OUT>((resolve) => { timer = setTimeout(() => resolve(TIMED_OUT), waitedMs); })]);
    if (out === TIMED_OUT) throw new FloorDocumentUnavailable(url, waitedMs);
    return out;
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
const TIMED_OUT = Symbol("timed-out");

async function readDoc(args: LiftArgs, url: string): Promise<LarDoc | undefined> {
  return boundedRead(args, url, async () => {
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
  await boundedRead(args, fresh.url, () => args.repo.flush([fresh.documentId]));
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
    try { next = await rehome(args, oldUrl); } catch (error) { if (error instanceof FloorDocumentUnavailable) { console.warn(error.message); skipped.push(title); continue; } throw error; }
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
        try {
          const into = await boundedRead(args, standingUrl, async () => { const h = await args.repo.find(standingUrl); await h.whenReady?.(); return h; });
          carryTiddlers(await readDoc(args, oldUrl), into as unknown as { change(fn: (doc: LarDoc) => void): void });
        } catch (error) { if (error instanceof FloorDocumentUnavailable) { console.warn(error.message); skipped.push(floorKey); continue; } throw error; }
        url = standingUrl; keyhiveDocId = String(fieldsOf(standing)?.["keyhive-doc-id"] ?? "");
      } else {
        let next: { url: string; keyhiveDocId: string };
        try { next = await rehome(args, oldUrl); } catch (error) { if (error instanceof FloorDocumentUnavailable) { console.warn(error.message); skipped.push(floorKey); continue; } throw error; }
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
    // 4 — the catalog's floor working documents, keyed by the floor's own anchor.
    const working = args.working;
    if (working?.anchor && working.open) {
      const mark = `/working-floor/${floorAnchorSegment(working.anchor)}`;
      for (const [floorKey, rec] of plainEntries(handle.doc()?.tiddlers)) {
        if (!floorKey.endsWith(mark)) continue;
        const fields = textFieldsOf(rec.tiddler as Record<string, unknown>);
        const oldUrl = fields["text"] ?? null;
        if (!oldUrl || fields["face-reach"] !== "vessel-only" || !mintedHere(args, fields["minted-by"])) continue;
        // A key already marked: a stop interrupted its burn or its removal; finish both, carrying nothing again.
        const interrupted = typeof fields["lifted-from"] === "string" && fields["lifted-from"] !== "";
        const slug = floorKey.slice(0, -mark.length).replace(/^.*\/wikis\//, "");
        const url = await working.urlOf(slug);
        if (!interrupted) {
          // The floor source is read FIRST: a silent one opens no destination, so no blank document stands at the derived address.
          let source: Awaited<ReturnType<LiftRepo["find"]>>;
          try { source = await boundedRead(args, oldUrl, async () => { const h = await args.repo.find(oldUrl); await h.whenReady?.(); return h; }); }
          catch (error) { if (error instanceof FloorDocumentUnavailable) { console.warn(error.message); skipped.push(floorKey); continue; } throw error; }
          try {
            const into = await working.open(url, slug);
            const carriedTo = tiddlerText(ownEntry(source.doc()?.tiddlers, WORKING_CARRY_MARK));
            if (carriedTo && carriedTo !== url) throw new Error("[anon-lift] working floor already carried to a different destination");
            const skip = readWorkingCarrySkip(plainField(ownEntry(source.doc()?.tiddlers, WORKING_CARRY_MARK), WORKING_CARRY_SKIP));
            if (!carriedTo) {
              skip.add(WORKING_CARRY_MARK);
              const titles = plainEntries(source.doc()?.tiddlers).map(([title]) => title);
              carryTiddlers(source.doc(), into, skip);
              for (const title of titles) skip.add(title);
            }
            working.rebind?.(slug, oldUrl, url, into);
            // SKIPS ARE RECORDED ONLY AFTER THE DESTINATION RESTS. A destination flush that fails leaves the source mark untouched, so a
            // restart that lost the half-written destination carries every title again and the burn never takes the only copy.
            let destinationRested = false;
            try {
              await boundedRead(args, url, () => args.repo.flush([into.documentId]));
              destinationRested = true;
              if (!carriedTo) source.change((doc) => {
                doc.tiddlers[WORKING_CARRY_MARK] = storedLarRecord(WORKING_CARRY_MARK, {
                  text: url,
                  [WORKING_CARRY_SKIP]: canonicalJson([...skip].sort()),
                }, "anon-lift:working-floor");
              });
              await boundedRead(args, oldUrl, () => args.repo.flush([source.documentId]));
            } catch (error) {
              if (!carriedTo && destinationRested) {
                source.change((doc) => {
                  doc.tiddlers[WORKING_CARRY_MARK] = storedLarRecord(WORKING_CARRY_MARK, {
                    [WORKING_CARRY_SKIP]: canonicalJson([...skip].sort()),
                  }, "anon-lift:working-floor");
                });
                await boundedRead(args, oldUrl, () => args.repo.flush([source.documentId]));
              }
              throw error;
            }
          } catch (error) { if (error instanceof FloorDocumentUnavailable) { console.warn(error.message); skipped.push(floorKey); continue; } throw error; }
          await args.faceDoor.mint(url, "admin");
          // MARK, BURN, THEN DELETE: the key keeps the lift's mark until the floor document burns.
          handle.change((doc) => {
            if (ownEntry(doc.tiddlers, floorKey)) doc.tiddlers[floorKey] = storedLarRecord(floorKey, { ...carried(fields), "lifted-from": digestOf(floorKey) }, "anon-lift:working-floor");
          });
        } else if (working.rebind) {
          const into = await working.open(url, slug);
          working.rebind(slug, oldUrl, url, into);
        }
        await burn(args, oldUrl);
        handle.change((doc) => { delete doc.tiddlers[floorKey]; });
        (interrupted ? finished : moved).push(floorKey);
      }
    }
  }
  return { moved, finished, skipped };
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
