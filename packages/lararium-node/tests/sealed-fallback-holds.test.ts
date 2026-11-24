/**
 * A SEALED BAG NEVER MOUNTS A WRITABLE FALLBACK UNDER AN ID ITS MAP DOES NOT NAME.
 *
 * `waitHandle` races a document's local readiness against a short boot window and, where the window closes first, hands back
 * a fallback and merges the real document into it late. A fallback for a document of a sealed bag would stand under a fresh
 * id the bag map never names: a write into it before the merge would rest clear under that id, and one after the merge would
 * wait in memory (`save-unmapped`) and drop at the stand-down. So a Repo that seats its sealed rest (`seatSealedRest`) holds
 * such a document read-only over its OWN id, the shape the social planes take (`mountSealed`): a write refuses
 * by name (`sealed-document-unopened`), the keyed load that opens makes it writable over the same id and the write seals,
 * one that refuses on integrity evidence moves its bytes aside, and one that ends with none leaves them in place.
 *
 *   F1  a sealed wiki-layer document (the draft slot, through `mountWikiSlot`) whose session stands past the window: read-only
 *       over its real id at boot, a write refuses by name, no plaintext anywhere on disk; once the session stands it takes
 *       the write over the real id, the write seals, nothing waits `save-unmapped`, and a fresh Repo reads the write back.
 *   F2  a clear bag still falls back as before (control): a fresh writable document under a new id that takes the write.
 *   F3  a keyed load that refuses on integrity evidence (a pointer whose value the holder does not hold): degraded, its bytes
 *       quarantined, a write refuses by name.
 *   F4  a stop before the session stands: pending, the bytes untouched, nothing quarantined, nothing held, a write refuses.
 *   F5  a social plane mounted with no probe ahead of it (a vessel that keeps none): past the window its entry reads
 *       `sealed`, a write refuses by name, and once the session stands it reads `mounted` and the write seals.
 *
 * Real doors throughout: the sealed document store over a real NodeFS store, the real `waitHandle`, the keel's
 * `mountWikiSlot` and `assembleVessel`, the probe's quarantine. The holder stands as a port that keeps each sealed value in
 * memory and opens it, as `probe-reads-sealed` stands it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type DocHandle, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  assembleVessel, AutomergeDocStore, CompositeStore, emptyLarDoc, mountWikiSlot, personaScopedBagIds, sealedAddressOf, SealedDocumentStore,
  seatSealedRest, waitHandle, type ChangeOrigin, type LarDoc, type LarTiddlerRecord, type SealedSettlement,
} from "@lararium/mesh";
import { MemoryTiddlerStore } from "../../lararium-tw5/src/memory-store.js";
import { quarantineDoc, quarantineHoldOf } from "../src/doc-load-probe.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } vault.clear(); faceUp = true; });

const TITLE = "lar:///ha.ka.ba/fallback/sealed-draft";
const MARKER = "SECRET-MARKER-wren-under-the-eaves";
const BEFORE = "USER-EDIT-BEFORE-the-session-stood";
const AFTER = "USER-EDIT-AFTER-the-session-stood";
const FACE = "fallback-face";
const PLANES = personaScopedBagIds("fallback-sealed-group");
const SLOT = { wikiSlug: "fallback", wikiKey: "lar:///ha.ka.ba/wikis/fallback", wikiBagId: "lar:///ha.ka.ba/bags/fallback", draftBagId: "lar:///ha.ka.ba/wikis/fallback/draft" };
const WINDOW_MS = 300;
const ORIGIN: ChangeOrigin = { kind: "lares-verb", requestId: "fallback-test" };
const POINTER = [...new TextEncoder().encode("lares-sealed-value:")];

/** The holder: each sealed value by its logical reference. */
const vault = new Map<string, { readonly plaintext: Uint8Array; readonly address: string }>();
/** Whether the face stands a session now. */
let faceUp = true;

/** The sealed store, mapping the documents `sealed()` names (every document while it answers null) to one faced bag. */
function sealedStore(storageDir: string, sealed: () => readonly string[] | null, hydrates = true): SealedDocumentStore {
  const inner: StorageAdapterInterface = new NodeFSStorageAdapter(storageDir);
  return new SealedDocumentStore({
    inner,
    bagOf: (documentId) => { const ids = sealed(); return ids === null || ids.includes(documentId) ? { bagId: SLOT.draftBagId, face: FACE } : null; },
    sessionFace: () => (faceUp ? FACE : null),
    sessionOf: () => (faceUp ? { id: "fallback-session", subject: FACE } : null),
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
        ? ({ plaintext: Uint8Array.from(kept.plaintext), address: kept.address, writer: FACE, changeWriter: "session:fallback-session" }) as never
        : ({ refusal: "value-absent" }) as never;
    },
    ...(hydrates ? { hydrates: true } : {}),
  });
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
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

/** A store holding one sealed document with a record in it, flushed and closed. */
async function storeWithSealedDoc(storageDir: string): Promise<{ readonly url: string; readonly id: string; readonly files: string[] }> {
  const repo = new Repo({ storage: sealedStore(storageDir, () => null, false), network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text: MARKER } }; });
  await repo.flush();
  await repo.shutdown();
  const id = handle.documentId as string;
  const files = filesOf(storageDir, id);
  // THE SETUP TOOK: every value rests as the store's pointer, and no text rests clear.
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) expect(POINTER.every((b, i) => readFileSync(f)[i] === b)).toBe(true);
  expect(hitsOf(storageDir, MARKER)).toEqual([]);
  return { url: handle.url, id, files };
}

async function until(ready: () => boolean, what: string, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > end) throw new Error(`never: ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

const record = (text: string): LarTiddlerRecord => ({ tiddler: { title: `${TITLE}/${text}`, text } }) as LarTiddlerRecord;
/** The refusal a write ended on, by name, or null where it landed. */
async function refusalOf(write: Promise<unknown>): Promise<string | null> {
  try { await write; return null; } catch (error) { return (error as { reason?: string }).reason ?? (error as Error).message; }
}

/** A Repo over the sealed store with the sealed rest seated, the way each vessel seats it. */
function seatedRepo(storageDir: string, sealed: () => readonly string[] | null) {
  const store = sealedStore(storageDir, sealed);
  const repo = new Repo({ storage: store, network: [] });
  const settled: SealedSettlement[] = [];
  seatSealedRest(repo, {
    restsSealed: (documentId) => store.holdsSealed(documentId),
    refusalOf: (documentId) => store.refusalOf(documentId),
    quarantine: (documentId, reason) => { quarantineDoc(storageDir, { documentId, status: "load-error", reason }, { bagId: SLOT.draftBagId }); },
    onSettled: (s) => { settled.push(s); },
  });
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

describe("a sealed bag never mounts a writable fallback under an id its map does not name", () => {
  test("F1 — a sealed draft whose session stands late: read-only over its id, a write refuses by name, then writable over the same id and the write seals", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-fallback-")));
    const s = await storeWithSealedDoc(storageDir);
    faceUp = false;
    const { store, repo, settled } = seatedRepo(storageDir, () => [s.id]);

    const { composite, draftHandle } = await mountDraft(repo, s.url);
    // No fallback: the layer stands on the document the bag map names.
    expect(draftHandle.documentId).toBe(s.id);
    // A write while it stands read-only refuses by name, and lands nothing anywhere.
    expect(await refusalOf(composite.put(record(BEFORE), ORIGIN, { bag: SLOT.draftBagId }))).toBe("sealed-document-unopened");
    await repo.flush();
    expect(hitsOf(storageDir, BEFORE)).toEqual([]);
    expect(hitsOf(storageDir, MARKER)).toEqual([]);

    // The session stands: the keyed load opens the document over the same id.
    faceUp = true;
    store.mapMoved();
    await until(() => settled.some((x) => x.documentId === s.id), "the keyed load settles");
    expect(settled).toEqual([{ documentId: s.id, status: "mounted" }]);
    expect((await composite.get?.(TITLE))?.tiddler.text).toBe(MARKER);

    // Now the write lands, over the real id, and seals: nothing waits in memory, no plaintext rests.
    expect(await refusalOf(composite.put(record(AFTER), ORIGIN, { bag: SLOT.draftBagId }))).toBeNull();
    await repo.flush();
    await store.flush();
    expect(store.held()).toEqual([]);
    expect(store.waiting()).toBe(0);
    await repo.shutdown();
    expect(hitsOf(storageDir, AFTER)).toEqual([]);
    expect(hitsOf(storageDir, MARKER)).toEqual([]);
    // Every value of the document rests as a pointer under its own id: no document beside it took a byte.
    for (const f of filesOf(storageDir, s.id)) expect(POINTER.every((b, i) => readFileSync(f)[i] === b)).toBe(true);

    // A fresh Repo reads the write back from the sealed rest.
    const again = new Repo({ storage: sealedStore(storageDir, () => [s.id]), network: [] });
    const read = await again.find<LarDoc>(s.url as never);
    expect((await new AutomergeDocStore(read, SLOT.draftBagId).get(`${TITLE}/${AFTER}`))?.tiddler.text).toBe(AFTER);
    await again.shutdown();
  }, 120_000);

  test("F2 — a clear bag still falls back as before (control): a fresh writable document under a new id", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-fallback-")));
    const { repo, store, settled } = seatedRepo(storageDir, () => []);
    // A document this store has never seen, in no sealed bag: the window closes and the fallback stands in.
    const absent = new Repo({ network: [] }).create<LarDoc>(emptyLarDoc()).url;
    const { composite, draftHandle } = await mountDraft(repo, absent);
    expect(draftHandle.url).not.toBe(absent);
    expect(await refusalOf(composite.put(record(BEFORE), ORIGIN, { bag: SLOT.draftBagId }))).toBeNull();
    await repo.flush();
    // A clear bag rests clear, as it always has.
    expect(hitsOf(storageDir, BEFORE).length).toBeGreaterThan(0);
    expect(settled).toEqual([]);
    expect(store.held()).toEqual([]);
    await repo.shutdown();
  }, 120_000);

  test("F3 — a keyed load that refuses on integrity evidence: degraded, its bytes quarantined, a write refuses by name", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-fallback-")));
    const s = await storeWithSealedDoc(storageDir);
    vault.clear();
    const { repo, store, settled } = seatedRepo(storageDir, () => [s.id]);

    const { composite, draftHandle } = await mountDraft(repo, s.url);
    expect(draftHandle.documentId).toBe(s.id);
    await until(() => settled.length > 0, "the keyed load settles");
    expect(settled[0]).toMatchObject({ documentId: s.id, status: "degraded" });
    expect(settled[0]?.reason).toMatch(/value-absent/);
    expect(quarantineHoldOf(storageDir, s.id)).not.toBeNull();
    expect(await refusalOf(composite.put(record(BEFORE), ORIGIN, { bag: SLOT.draftBagId }))).toBe("sealed-document-unopened");
    await repo.flush();
    expect(store.held()).toEqual([]);
    expect(hitsOf(storageDir, BEFORE)).toEqual([]);
    await repo.shutdown();
  }, 120_000);

  test("F4 — a stop before the session stands: pending, the bytes untouched, nothing quarantined, nothing held, a write refuses", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-fallback-")));
    const s = await storeWithSealedDoc(storageDir);
    const before = s.files.map((f) => readFileSync(f).toString("hex"));
    faceUp = false;
    const { repo, store, settled } = seatedRepo(storageDir, () => [s.id]);

    const { composite, draftHandle } = await mountDraft(repo, s.url);
    expect(draftHandle.documentId).toBe(s.id);
    store.endHydration();
    await until(() => settled.length > 0, "the keyed load settles");
    expect(settled[0]).toMatchObject({ documentId: s.id, status: "pending" });
    expect(quarantineHoldOf(storageDir, s.id)).toBeNull();
    expect(await refusalOf(composite.put(record(BEFORE), ORIGIN, { bag: SLOT.draftBagId }))).toBe("sealed-document-unopened");
    await repo.flush();
    await repo.shutdown();
    expect(store.held()).toEqual([]);
    expect(filesOf(storageDir, s.id).map((f) => readFileSync(f).toString("hex"))).toEqual(before);
    expect(hitsOf(storageDir, BEFORE)).toEqual([]);
  }, 120_000);

  test("F5 — a social plane mounted with no probe: past the window it reads sealed and refuses a write; once the session stands it mounts and the write seals", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-sealed-fallback-")));
    const s = await storeWithSealedDoc(storageDir);
    const daemonRepo = new Repo({ storage: new NodeFSStorageAdapter(storageDir), network: [] });
    const daemonUrl = daemonRepo.create<LarDoc>(emptyLarDoc()).url;
    await daemonRepo.flush();
    await daemonRepo.shutdown();
    faceUp = false;
    const { repo, store } = seatedRepo(storageDir, () => [s.id]);

    const assembly = await assembleVessel({
      repo,
      catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
      waitHandle: <T>(url: string, bagId: string, fallback: () => DocHandle<T>) => waitHandle<T>(repo, url, bagId, fallback, WINDOW_MS),
      systemCanon: async () => ({}),
      loadGenesis: async () => ({
        islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "fallback-core",
        bootstrap: { daemonUrl, personaBagId: PLANES.persona, intentsUrl: s.url, personaPlanes: [] },
      }),
      tempStore: () => ({}) as never,
      sealedRefusalOf: (documentId: string) => store.refusalOf(documentId),
    } as never);
    const entry = () => assembly.mountManifest.entries.find((e) => e.bagId === PLANES.intents);
    expect(entry()?.status).toBe("sealed");
    expect(entry()?.documentId).toBe(s.id);
    expect(await refusalOf(assembly.composite.put(record(BEFORE), ORIGIN, { bag: PLANES.intents }))).toBe("sealed-document-unopened");

    faceUp = true;
    store.mapMoved();
    await assembly.sealedMounts;
    expect(entry()?.status).toBe("mounted");
    expect(assembly.mountManifest.degraded).toBe(false);
    expect((await assembly.composite.get?.(TITLE))?.tiddler.text).toBe(MARKER);
    expect(await refusalOf(assembly.composite.put(record(AFTER), ORIGIN, { bag: PLANES.intents }))).toBeNull();
    await repo.flush();
    await store.flush();
    expect(store.held()).toEqual([]);
    await repo.shutdown();
    expect(hitsOf(storageDir, BEFORE)).toEqual([]);
    expect(hitsOf(storageDir, AFTER)).toEqual([]);
    expect(hitsOf(storageDir, MARKER)).toEqual([]);
  }, 120_000);
});
