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
 *   H4  AN UNSOLICITED PEER PUSH. A peer can push a document no local caller asked for and no map names (a sibling's slot
 *       ahead of its announcement). The store held no name for it and saved its bytes clear. Now the store reads a roster of
 *       documents named clear (`namesClear`, plus every document a local caller of the Repo opened, `solicited`), and a
 *       document neither mapped sealed nor named clear holds in memory (`save-unnamed`): unknown means hold. A rostered
 *       document saves clear, a mapped one seals, and a held one lands by whichever name arrives first: the roster releases
 *       it clear, the map seals it. A find names nothing by itself: only a caller that names its bag does (H4f, H4g).
 *       The federatable shelf names a public board clear by construction, so a board a peer pushes unasked rests clear and
 *       survives a restart, while an off-shelf push from the same peer still waits (H4h, H4i).
 *
 * Real doors throughout: the sealed document store over a real NodeFS store, the real `waitHandle`, the keel's
 * `mountWikiSlot`, and a sibling Repo across a real MessageChannel. The holder stands as a port that keeps each sealed value
 * in memory and opens it, as `sealed-fallback-holds` stands it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as A from "@automerge/automerge";
import { interpretAsDocumentId, Repo, type DocHandle, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  AutomergeDocStore, clearRosterOf, CompositeStore, crossroadsDocUrl, DeterministicFederationGate, emptyLarDoc, fleetEdgeBoardDocUrl, materializeSharedLarDoc, mountWikiSlot, nameDocumentFor, realmEdgeBoardDocUrl, realmVouchBoardDocUrl, receiptInStore, sealedAddressOf, SealedDocumentStore, seatSealedRest, waitHandle,
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
function sealedStore(storageDir: string, mapped: () => readonly string[] | null, hydrates = true, roster?: (documentId: string) => boolean | Promise<boolean>): SealedDocumentStore {
  const inner: StorageAdapterInterface = new NodeFSStorageAdapter(storageDir);
  return new SealedDocumentStore({
    inner,
    // THE CLEAR-NAME ROSTER: present, it turns the store fail-closed for a document neither mapped nor named.
    ...(roster ? { namesClear: roster } : {}),
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
/** A roster that names the documents a list holds now. */
const namesIn = (list: () => readonly string[]) => (documentId: string): boolean => list().includes(documentId);

function seatedRepo(storageDir: string, mapped: () => readonly string[] | null, roster: (documentId: string) => boolean | Promise<boolean> = () => false) {
  const store = sealedStore(storageDir, mapped, true, roster);
  const repo = new Repo({ storage: store, network: [] });
  const settled: SealedSettlement[] = [];
  seatSealedRest(repo, {
    restsSealed: (documentId) => store.holdsSealed(documentId),
    refusalOf: (documentId) => store.refusalOf(documentId),
    nameDocument: (documentId, bagId) => store.nameDocument(documentId, bagId),
    solicited: (documentId) => store.solicited(documentId),
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
    waitHandle: <T>(url: string, bagId: string, fallback: () => DocHandle<T>) => waitHandle<T>(repo, url, bagId, fallback, WINDOW_MS),
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

    const held = await waitHandle<LarDoc>(repo, s.url, SLOT.draftBagId, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS);
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

  test("H1b — a held handle's document deletes whole: the repo's delete runs to its end, nothing refuses midway, and the held bytes leave rest", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-handles-")));
    const s = await storeWithSealedDoc(storageDir);
    faceUp = false;
    const { repo } = seatedRepo(storageDir, () => [s.id]);
    const held = await waitHandle<LarDoc>(repo, s.url, SLOT.draftBagId, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS);
    expect(held.documentId).toBe(s.id);
    expect(await refusalOf(() => held.change(() => {}))).toBe("sealed-document-unopened");
    // A DELETE IS NO WRITE INTO THE HELD CONTENT: it burns the whole document, so it runs whole, never half.
    expect(await refusalOf(() => repo.delete(s.url as never))).toBeNull();
    expect(held.isDeleted()).toBe(true);
    expect((repo.handles as Record<string, unknown>)[s.id]).toBeUndefined();
    await until(() => filesOf(storageDir, s.id).length === 0, "the deleted document's bytes leave rest");
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
    const held = await waitHandle<LarDoc>(repo, absent, SLOT.wikiBagId, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS);
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

/** A sibling Repo holding one document with `text` in it, and a channel that connects it to `repo`: the sibling pushes the
 *  document unsolicited, since no local caller of `repo` asked for it. */
function siblingPushes(repo: Repo, text: string): { readonly id: string; readonly connect: () => void } {
  const sibling = new Repo({ network: [] });
  closers.push(() => sibling.shutdown());
  const pushed = sibling.create<LarDoc>(emptyLarDoc());
  pushed.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text } }; });
  return {
    id: pushed.documentId as string,
    connect: () => {
      const { port1, port2 } = new MessageChannel();
      closers.push(() => { port1.close(); port2.close(); });
      sibling.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
      repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port2));
    },
  };
}
/** A sibling Repo holding a document at a derived address (`url`, a public board), and a channel that connects it. */
function siblingPushesAt(repo: Repo, url: string, text: string): { readonly id: string; readonly connect: () => void } {
  const sibling = new Repo({ network: [] });
  closers.push(() => sibling.shutdown());
  const id = interpretAsDocumentId(url as never) as string;
  const pushed = sibling.import<LarDoc>(A.save(A.from(emptyLarDoc() as unknown as Record<string, unknown>)), { docId: id as never });
  pushed.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text } }; });
  return {
    id,
    connect: () => {
      const { port1, port2 } = new MessageChannel();
      closers.push(() => { port1.close(); port2.close(); });
      sibling.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port1));
      repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(port2));
    },
  };
}
const NEXUS_KEY = "b".repeat(64);
/** The pushed document reads `text` on this Repo: its bytes arrived by the sibling's push. */
const arrived = (repo: Repo, id: string, text: string): boolean => {
  const handle = (repo.handles as Record<string, DocHandle<unknown> | undefined>)[id];
  try { return handle !== undefined && handle.isReady() && textOf(handle, TITLE) === text; } catch { return false; }
};
const PUSHED = "PUSHED-UNSOLICITED-otter-under-the-bridge";

describe("an unsolicited peer push waits for a name: unknown means hold", () => {
  test("H4a — unsolicited-unnamed-holds: a document no caller asked for, no map names and no roster names holds in memory; nothing rests on disk", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the sibling's push arrives");
    await repo.flush();
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
    expect(filesOf(storageDir, push.id).filter((f) => !f.includes("sync-state"))).toEqual([]);
    expect(store.held().filter((h) => h.documentId === push.id).map((h) => [h.refusal, h.bagId])).toEqual([["save-unnamed", null]]);
  }, 120_000);

  test("H4b — rostered-clear-saves: a document the roster names clear saves clear, as the engine wrote it", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const roster: string[] = [];
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => roster));
    const push = siblingPushes(repo, PUSHED);
    roster.push(push.id);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the sibling's push arrives");
    await repo.flush();
    expect(hitsOf(storageDir, PUSHED).length).toBeGreaterThan(0);
    expect(store.held()).toEqual([]);
  }, 120_000);

  test("H4c — sealed-mapped-seals: a document the map names sealed seals; no clear byte rests", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const mapped: string[] = [];
    const { store, repo } = seatedRepo(storageDir, () => mapped, namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    mapped.push(push.id);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the sibling's push arrives");
    await repo.flush();
    await store.flush();
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
    expect(restsAsPointers(filesOf(storageDir, push.id))).toBe(true);
    expect(store.held()).toEqual([]);
  }, 120_000);

  test("H4d — roster-later-releases-clear: a held document the roster names later lands clear, and leaves memory", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const roster: string[] = [];
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => roster));
    const push = siblingPushes(repo, PUSHED);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the sibling's push arrives");
    await repo.flush();
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
    expect(store.held().some((h) => h.documentId === push.id && h.refusal === "save-unnamed")).toBe(true);
    // THE ROSTER NAMES IT: the map moves, and the held bytes land clear.
    roster.push(push.id);
    store.mapMoved();
    await until(() => hitsOf(storageDir, PUSHED).length > 0, "the roster releases the held bytes clear");
    await until(() => store.held().length === 0, "the held saves leave memory");
  }, 120_000);

  test("H4e — map-later-seals-held: a held document the map names later seals and lands; no clear byte ever rests", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const mapped: string[] = [];
    const { store, repo } = seatedRepo(storageDir, () => mapped, namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the sibling's push arrives");
    await repo.flush();
    expect(store.held().some((h) => h.documentId === push.id && h.refusal === "save-unnamed")).toBe(true);
    // THE MAP NAMES IT: the waiting bytes seal under the real id.
    mapped.push(push.id);
    store.mapMoved();
    await store.reseal();
    await store.flush();
    expect(store.held()).toEqual([]);
    expect(restsAsPointers(filesOf(storageDir, push.id))).toBe(true);
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
  }, 120_000);

  test("H4f — named-find-saves-clear: a local caller that names the document's clear bag before it finds counts as named, so its pushed bytes save clear", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    // THE LOCAL CALLER NAMES THE BAG, then finds; the sibling connects and pushes.
    expect(nameDocumentFor(repo, push.id, SLOT.wikiBagId)).toBe(false);
    repo.findWithProgress<LarDoc>(`automerge:${push.id}` as never);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the asked-for document arrives");
    await repo.flush();
    await until(() => hitsOf(storageDir, PUSHED).length > 0, "the named document rests clear");
    expect(store.held()).toEqual([]);
  }, 120_000);

  test("H4g — bagless-find-holds: a find that names no bag names nothing, so a pushed document it opened still waits in memory", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    repo.findWithProgress<LarDoc>(`automerge:${push.id}` as never);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the found document arrives");
    await repo.flush();
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
    expect(store.held().some((h) => h.documentId === push.id && h.refusal === "save-unnamed")).toBe(true);
  }, 120_000);

  test("H4h — shelf-board-survives-restart: a public board on the federatable shelf, pushed unasked, rests clear and reads back after the store restarts", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const shelf = new DeterministicFederationGate(NEXUS_KEY);
    const roster = clearRosterOf({ names: () => false, shelf: () => shelf });
    const { store, repo } = seatedRepo(storageDir, () => [], roster);
    const board = siblingPushesAt(repo, crossroadsDocUrl(NEXUS_KEY), PUSHED);
    board.connect();
    await until(() => arrived(repo, board.id, PUSHED), "the board's push arrives");
    await repo.flush();
    await until(() => hitsOf(storageDir, PUSHED).length > 0, "the board rests clear");
    expect(store.held()).toEqual([]);
    await repo.shutdown();

    // THE STORE RESTARTS with no peer: the board reads back from disk alone.
    const again = new Repo({ storage: sealedStore(storageDir, () => [], true, roster), network: [] });
    closers.push(() => again.shutdown());
    const read = await again.find<LarDoc>(`automerge:${board.id}` as never);
    expect(textOf(read, TITLE)).toBe(PUSHED);
  }, 120_000);

  test("H4i — off-shelf-push-holds (control): a document the shelf does not admit, pushed by the same peer, waits in memory and reads nothing after a restart", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const shelf = new DeterministicFederationGate(NEXUS_KEY);
    const roster = clearRosterOf({ names: () => false, shelf: () => shelf });
    const { store, repo } = seatedRepo(storageDir, () => [], roster);
    const push = siblingPushes(repo, PUSHED);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the push arrives");
    await repo.flush();
    expect(hitsOf(storageDir, PUSHED)).toEqual([]);
    expect(store.held().some((h) => h.documentId === push.id && h.refusal === "save-unnamed")).toBe(true);
    await repo.shutdown();
    expect(filesOf(storageDir, push.id).filter((f) => !f.includes("sync-state"))).toEqual([]);
  }, 120_000);
});

describe("a named open keeps what a peer pushed first: announced slots and derived boards survive a restart", () => {
  /** Push `url`'s document from a sibling (or an island), then let `name` name it on this vessel; flush, restart, read back. */
  async function survivesRestart(url: string, name: (repo: Repo, store: SealedDocumentStore, id: string) => Promise<void> | void): Promise<{ readonly before: string[]; readonly after: string | undefined }> {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => []));
    const pushed = siblingPushesAt(repo, url, PUSHED);
    pushed.connect();
    await until(() => arrived(repo, pushed.id, PUSHED), "the push arrives");
    await repo.flush();
    // HELD UNTIL NAMED: the push alone names nothing.
    const before = store.held().filter((h) => h.documentId === pushed.id).map((h) => h.refusal);
    await name(repo, store, pushed.id);
    await until(() => hitsOf(storageDir, PUSHED).length > 0, "the named document rests");
    await repo.flush();
    await repo.shutdown();
    const again = new Repo({ storage: sealedStore(storageDir, () => [], true, () => false), network: [] });
    closers.push(() => again.shutdown());
    const read = await again.find<LarDoc>(`automerge:${pushed.id}` as never);
    return { before: [...new Set(before)], after: textOf(read, TITLE) };
  }

  test("H5a — announced-clear-slot-survives-restart: an island mints a clear working slot on its own Repo; the vessel holds its bytes until the announcement names it, then they rest and read back after a restart", async () => {
    const slot = new Repo({ network: [] }).create<LarDoc>(emptyLarDoc()).url;
    const out = await survivesRestart(slot, (_repo, store, id) => { expect(store.nameDocument(id, SLOT.wikiBagId)).toBe(false); });
    expect(out.before).toEqual(["save-unnamed"]);
    expect(out.after).toBe(PUSHED);
  }, 120_000);

  test("H5b — receipt-refuses-unnamed: a receipt that names nothing refuses a save held unnamed; the house island's own ask names its mint, and the receipt issues", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-clear-roster-")));
    const { store, repo } = seatedRepo(storageDir, () => [], namesIn(() => []));
    const push = siblingPushes(repo, PUSHED);
    push.connect();
    await until(() => arrived(repo, push.id, PUSHED), "the push arrives");
    const heldOf = (id: string) => store.heldRefusalOf(id);
    // A RECEIPT THAT NAMES NOTHING (a peer's push, no house island asking) refuses by name: a flush into memory is no rest.
    expect(await refusalOf(receiptInStore(repo, [push.id], undefined, undefined, { heldOf }))).toMatch(/^save-unnamed/);
    // THE HOUSE ISLAND'S OWN ASK names its mint first: the held saves land, and the receipt issues.
    expect(await refusalOf(receiptInStore(repo, [push.id], undefined, undefined, { name: (id) => store.solicited(id), heldOf }))).toBeNull();
    expect(store.heldRefusalOf(push.id)).toBeNull();
    expect(hitsOf(storageDir, PUSHED).length).toBeGreaterThan(0);
  }, 120_000);

  test("H5c — fleet-edge-board-survives-restart: a non-root device's fleet edge board, pushed first, rests once its open derives it and reads back offline", async () => {
    const out = await survivesRestart(fleetEdgeBoardDocUrl("did:key:z6MkFleetRootForTheRosterTest"), async (repo) => { await materializeSharedLarDoc(repo, fleetEdgeBoardDocUrl("did:key:z6MkFleetRootForTheRosterTest"), "board:edge-kapae"); });
    expect(out.before).toEqual(["save-unnamed"]);
    expect(out.after).toBe(PUSHED);
  }, 120_000);

  test("H5d — realm-vouch-board-survives-restart: a realm's vouch board, pushed first, rests once its open derives it and reads back offline", async () => {
    const out = await survivesRestart(realmVouchBoardDocUrl("realm-of-the-roster"), async (repo) => { await materializeSharedLarDoc(repo, realmVouchBoardDocUrl("realm-of-the-roster"), "board:vouch-registry"); });
    expect(out.before).toEqual(["save-unnamed"]);
    expect(out.after).toBe(PUSHED);
  }, 120_000);

  test("H5e — realm-edge-board-survives-restart: a realm's edge board, pushed first, rests once its open derives it and reads back offline", async () => {
    const out = await survivesRestart(realmEdgeBoardDocUrl("realm-of-the-roster"), async (repo) => { await materializeSharedLarDoc(repo, realmEdgeBoardDocUrl("realm-of-the-roster"), "board:edge-kapae"); });
    expect(out.before).toEqual(["save-unnamed"]);
    expect(out.after).toBe(PUSHED);
  }, 120_000);
});
