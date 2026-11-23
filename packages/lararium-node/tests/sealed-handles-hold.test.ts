/**
 * A HELD SEALED HANDLE REFUSES EVERY WRITE, AND BYTES WAIT FOR THEIR MAP.
 *
 * `waitHandle` holds a sealed document read-only over its own id until its keyed load opens it (`holdSealed`). Two seams
 * stood open beside that hold:
 *
 *   H1  THE HANDLE ITSELF took writes. A store over it refused by name, yet the handle read ready over an empty document,
 *       and a raw `change` on it landed: a change that created `tiddlers` conflicted with the loaded document's own, and
 *       the sealed content hid behind the conflict once the keyed load opened. Held, the handle reads not ready, waits in
 *       `whenReady`, and refuses every mutator (`change`, `changeAt`, `merge`, `sub`) by `sealed-document-unopened`; once
 *       the keyed load opens it, the sealed content reads whole and a raw change lands, sealed.
 *   H2  MAP BEFORE BYTES. A document of a sealed bag that the bag map did not name yet (a draft whose bytes live on a
 *       sibling) fell back to a fresh id, a write into it landed clear, and its bytes, arriving by sync, rested clear under
 *       the real id. The caller that knows the bag names the document for it before any byte moves (`waitHandle`'s bag,
 *       the store's `nameDocument`): the document stands held over its real id, bytes arriving by sync rest nowhere while
 *       the bag's face has not lit (in memory, `save-unmapped`), and seal and land once it lights.
 *   H3  a clear bag still falls back and writes clear (control).
 *
 * Real doors throughout: the sealed document store over a real NodeFS store, the real `waitHandle`, the keel's
 * `mountWikiSlot`, and a sibling Repo across a real MessageChannel. The holder stands as a port that keeps each sealed value
 * in memory and opens it, as `sealed-fallback-holds` stands it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type DocHandle, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  AutomergeDocStore, CompositeStore, emptyLarDoc, mountWikiSlot, sealedAddressOf, SealedDocumentStore, seatSealedRest, waitHandle,
  type ChangeOrigin, type LarDoc, type LarTiddlerRecord, type SealedBagRow, type SealedSettlement,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
const closers: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const close of closers.splice(0)) await close();
  if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; }
  vault.clear(); faceUp = true; faceLit = true;
});

const TITLE = "lar:///ha.ka.ba/handles/sealed-draft";
const MARKER = "SECRET-MARKER-heron-in-the-reeds";
const RAW = "RAW-CHANGE-on-the-held-handle";
const BEFORE = "USER-EDIT-BEFORE-the-map-named-it";
const AFTER = "USER-EDIT-AFTER-the-face-lit";
const FACE = "handles-face";
const SLOT = { wikiSlug: "handles", wikiKey: "lar:///ha.ka.ba/wikis/handles", wikiBagId: "lar:///ha.ka.ba/bags/handles", draftBagId: "lar:///ha.ka.ba/wikis/handles/draft" };
const WINDOW_MS = 300;
const ORIGIN: ChangeOrigin = { kind: "lares-verb", requestId: "handles-test" };
const POINTER = [...new TextEncoder().encode("lares-sealed-value:")];

/** The holder: each sealed value by its logical reference. */
const vault = new Map<string, { readonly plaintext: Uint8Array; readonly address: string }>();
/** Whether the face stands a session now. */
let faceUp = true;
/** Whether the draft bag's face has lit: until it lights, a document named for the bag maps with no face. */
let faceLit = true;

/** The sealed store: `mapped()` names the documents the bag map names (every one while it answers null); a document a caller
 *  names for the draft bag (`nameDocument`) maps by the bag's own row. */
function sealedStore(storageDir: string, mapped: () => readonly string[] | null, hydrates = true): SealedDocumentStore {
  const inner: StorageAdapterInterface = new NodeFSStorageAdapter(storageDir);
  return new SealedDocumentStore({
    inner,
    bagOf: (documentId) => { const ids = mapped(); return ids === null || ids.includes(documentId) ? { bagId: SLOT.draftBagId, face: FACE } : null; },
    bagRow: (bagId): SealedBagRow | null => (bagId === SLOT.draftBagId ? { bagId, face: faceLit ? FACE : null } : null),
    sessionFace: () => (faceUp ? FACE : null),
    sessionOf: () => (faceUp ? { id: "handles-session", subject: FACE } : null),
    seal: async ({ values }) => ({
      values: values.map((v) => {
        const address = sealedAddressOf(v.plaintext);
        vault.set(v.ref, { plaintext: Uint8Array.from(v.plaintext), address });
        return { role: v.role, ref: v.ref, address };
      }),
    }),
    open: async ({ ref }) => {
      const kept = vault.get(ref);
      return kept
        ? ({ plaintext: Uint8Array.from(kept.plaintext), address: kept.address, writer: FACE, changeWriter: "session:handles-session" }) as never
        : ({ refusal: "value-absent" }) as never;
    },
    ...(hydrates ? { hydrates: true } : {}),
  });
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const walk = (p: string): void => {
    for (const name of readdirSync(p)) {
      const child = join(p, name);
      if (statSync(child).isDirectory()) walk(child); else out.push(child);
    }
  };
  walk(root);
  return out.sort();
}
const hitsOf = (storageDir: string, text: string): string[] => walkFiles(storageDir).filter((f) => readFileSync(f).includes(Buffer.from(text)));
const filesOf = (storageDir: string, documentId: string): string[] => walkFiles(docStorePath(storageDir, documentId));
const restsAsPointers = (files: readonly string[]): boolean => files.length > 0 && files.every((f) => POINTER.every((b, i) => readFileSync(f)[i] === b));

/** A store holding one sealed document with a record in it, flushed and closed. */
async function storeWithSealedDoc(storageDir: string): Promise<{ readonly url: string; readonly id: string }> {
  const repo = new Repo({ storage: sealedStore(storageDir, () => null, false), network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text: MARKER } }; });
  await repo.flush();
  await repo.shutdown();
  const id = handle.documentId as string;
  // THE SETUP TOOK: every value rests as the store's pointer, and no text rests clear.
  expect(restsAsPointers(filesOf(storageDir, id))).toBe(true);
  expect(hitsOf(storageDir, MARKER)).toEqual([]);
  return { url: handle.url, id };
}

async function until(ready: () => boolean | Promise<boolean>, what: string, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!(await ready())) {
    if (Date.now() > end) throw new Error(`never: ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const record = (text: string): LarTiddlerRecord => ({ tiddler: { title: `${TITLE}/${text}`, text } }) as LarTiddlerRecord;
/** The refusal an act ended on, by name, or null where it landed. */
async function refusalOf(act: Promise<unknown> | (() => unknown)): Promise<string | null> {
  try { await (typeof act === "function" ? act() : act); return null; } catch (error) { return (error as { reason?: string }).reason ?? (error as Error).message; }
}

/** A Repo over the sealed store with the sealed rest seated, the way each vessel seats it: the map before the bytes too. */
function seatedRepo(storageDir: string, mapped: () => readonly string[] | null) {
  const store = sealedStore(storageDir, mapped);
  const repo = new Repo({ storage: store, network: [] });
  const settled: SealedSettlement[] = [];
  seatSealedRest(repo, {
    restsSealed: (documentId) => store.holdsSealed(documentId),
    refusalOf: (documentId) => store.refusalOf(documentId),
    nameDocument: (documentId, bagId) => store.nameDocument(documentId, bagId),
    onSettled: (s) => { settled.push(s); },
  });
  closers.push(() => repo.shutdown());
  return { store, repo, settled };
}

/** Mount the wiki slot whose draft resolves to `draftUrl`, through the keel's own `mountWikiSlot` and the real `waitHandle`. */
async function mountDraft(repo: Repo, draftUrl: string) {
  const composite = new CompositeStore();
  const keel = {
    repo,
    catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
    waitHandle: <T>(url: string, fallback: () => DocHandle<T>, bagId?: string) => waitHandle<T>(repo, url, fallback, WINDOW_MS, bagId),
    tempStore: () => new MemoryTiddlerStore(),
  } as never;
  const { draftHandle } = await mountWikiSlot(keel, composite, SLOT, async () => draftUrl, async () => null);
  return { composite, draftHandle };
}

type Doc = { tiddlers: Record<string, { tiddler: { title: string; text: string } }> };
const textOf = (handle: DocHandle<unknown>, title: string): string | undefined => (handle.doc() as Doc | undefined)?.tiddlers?.[title]?.tiddler?.text;

describe("a held sealed handle refuses every write, and bytes wait for their map", () => {
  test("H1 — the held handle reads not ready and refuses every mutator by name; once the keyed load opens it, the sealed content reads whole", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-handles-")));
    const s = await storeWithSealedDoc(storageDir);
    faceUp = false;
    const { store, repo, settled } = seatedRepo(storageDir, () => [s.id]);

    const held = await waitHandle<LarDoc>(repo, s.url, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS);
    expect(held.documentId).toBe(s.id);
    // READERS SEE IT HELD: not ready, and `whenReady` waits for the open.
    expect(held.isReady()).toBe(false);
    expect(await Promise.race([held.whenReady().then(() => "ready"), new Promise((r) => setTimeout(() => r("held"), 150))])).toBe("held");
    // EVERY MUTATOR REFUSES BY NAME, before any byte moves.
    const raw = (doc: LarDoc) => { (doc.tiddlers as Record<string, unknown>)["raw"] = { tiddler: { title: "raw", text: RAW } }; };
    expect(await refusalOf(() => held.change(raw))).toBe("sealed-document-unopened");
    expect(await refusalOf(() => held.changeAt(held.heads(), raw))).toBe("sealed-document-unopened");
    const other = repo.create<LarDoc>(emptyLarDoc());
    other.change(raw);
    expect(await refusalOf(() => held.merge(other))).toBe("sealed-document-unopened");
    expect(await refusalOf(() => held.sub("tiddlers"))).toBe("sealed-document-unopened");
    await repo.flush();
    expect(filesOf(storageDir, s.id).filter((f) => readFileSync(f).includes(Buffer.from(RAW)))).toEqual([]);

    // The session stands: the keyed load opens the document over the same id, and the sealed content reads whole.
    faceUp = true;
    store.mapMoved();
    await until(() => settled.some((x) => x.documentId === s.id && x.status === "mounted"), "the keyed load opens");
    expect(held.isReady()).toBe(true);
    await held.whenReady();
    expect(textOf(held, TITLE)).toBe(MARKER);
    expect(textOf(held, "raw")).toBeUndefined();
    // Now a raw change lands, over the real id, and seals.
    expect(await refusalOf(() => held.change(raw))).toBeNull();
    expect(textOf(held, TITLE)).toBe(MARKER);
    expect(textOf(held, "raw")).toBe(RAW);
    await repo.flush();
    await store.flush();
    expect(store.held()).toEqual([]);
    expect(restsAsPointers(filesOf(storageDir, s.id))).toBe(true);
    expect(hitsOf(storageDir, MARKER)).toEqual([]);
  }, 120_000);

  test("H2 — a sealed draft the map names no document for yet: held over its real id; its bytes arriving by sync rest nowhere until the face lights, then seal and land", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-handles-")));
    // THE BYTES LIVE ELSEWHERE: a sibling holds the draft, and this store holds nothing of it.
    const sibling = new Repo({ network: [] });
    closers.push(() => sibling.shutdown());
    const draft = sibling.create<LarDoc>(emptyLarDoc());
    draft.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text: MARKER } }; });
    // The bag rests sealed and its face has not lit; the bag map names no document for it.
    faceLit = false;
    const { store, repo } = seatedRepo(storageDir, () => []);

    const { composite, draftHandle } = await mountDraft(repo, draft.url);
    // NO FALLBACK: the layer stands on the draft's own id, held.
    expect(draftHandle.documentId).toBe(draft.documentId);
    expect(await refusalOf(composite.put(record(BEFORE), ORIGIN, { bag: SLOT.draftBagId }))).toBe("sealed-document-unopened");

    // The sibling connects, and the draft's bytes arrive by sync.
    const { port1, port2 } = new MessageChannel();
    closers.push(() => { port1.close(); port2.close(); });
    sibling.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
    repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port2));
    await until(() => textOf(draftHandle, TITLE) === MARKER, "the draft's bytes arrive by sync");
    await repo.flush();
    // NOTHING CLEAR ON DISK: the bytes wait in memory, named, until the face lights.
    expect(hitsOf(storageDir, MARKER)).toEqual([]);
    expect(hitsOf(storageDir, BEFORE)).toEqual([]);
    expect(filesOf(storageDir, draft.documentId)).toEqual([]);
    expect(store.held().map((h) => [h.documentId, h.refusal, h.bagId])).toEqual([[draft.documentId, "save-unmapped", SLOT.draftBagId]]);

    // The face lights: the waiting bytes seal and land under the real id.
    faceLit = true;
    store.mapMoved();
    await store.reseal();
    await store.flush();
    expect(store.held()).toEqual([]);
    expect(restsAsPointers(filesOf(storageDir, draft.documentId))).toBe(true);
    expect(hitsOf(storageDir, MARKER)).toEqual([]);

    // A write lands over the real id, and seals.
    expect(await refusalOf(composite.put(record(AFTER), ORIGIN, { bag: SLOT.draftBagId }))).toBeNull();
    await repo.flush();
    await store.flush();
    expect(store.held()).toEqual([]);
    expect(hitsOf(storageDir, AFTER)).toEqual([]);
    expect(restsAsPointers(filesOf(storageDir, draft.documentId))).toBe(true);
    await repo.shutdown();

    // A fresh Repo, whose map names the draft, reads both back from the sealed rest.
    const again = new Repo({ storage: sealedStore(storageDir, () => [draft.documentId]), network: [] });
    closers.push(() => again.shutdown());
    const read = await again.find<LarDoc>(draft.url);
    const readStore = new AutomergeDocStore(read, SLOT.draftBagId);
    expect((await readStore.get(TITLE))?.tiddler.text).toBe(MARKER);
    expect((await readStore.get(`${TITLE}/${AFTER}`))?.tiddler.text).toBe(AFTER);
  }, 120_000);

  test("H3 — a clear bag still falls back and writes clear (control)", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-handles-")));
    const { repo, store, settled } = seatedRepo(storageDir, () => []);
    const absent = new Repo({ network: [] }).create<LarDoc>(emptyLarDoc()).url;
    const held = await waitHandle<LarDoc>(repo, absent, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS, SLOT.wikiBagId);
    expect(held.url).not.toBe(absent);
    expect(held.isReady()).toBe(true);
    const layer = new AutomergeDocStore(held, SLOT.wikiBagId);
    expect(await refusalOf(layer.put(record(BEFORE), ORIGIN))).toBeNull();
    await repo.flush();
    expect(hitsOf(storageDir, BEFORE).length).toBeGreaterThan(0);
    expect(settled).toEqual([]);
    expect(store.held()).toEqual([]);
  }, 120_000);
});
