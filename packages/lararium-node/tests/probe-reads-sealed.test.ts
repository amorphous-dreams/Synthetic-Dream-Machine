/**
 * THE PROBE READS A SEALED DOCUMENT AS SEALED, NEVER TORN; THE KEYED LOAD AT MOUNT DECIDES THE REST.
 *
 * A document of a sealed bag rests no Automerge byte. Each stored value holds either the sealed document store's pointer
 * (`lares-sealed-value:blake3:<hex>`, the holder keeps the sealed bytes) or a sealed value itself (a keyed bag: the secret
 * home, the floor, a public bag). The probe child and the deep vessel lens hold no key, so they read the envelope alone and
 * answer `sealed`: never condemned, never proof the document opens. The key-less check catches a cut pointer, a short header
 * and a last segment shorter than its tag; everything else waits for the keyed load at mount.
 *
 * So the social mount never hands a `sealed` plane to the blank writable fallback. It mounts the plane read-only over its
 * real id; the keyed load that opens re-mounts it writable over the same handle, and one that refuses takes the quarantine
 * and the degraded stand-in, held across boots. A stand-in that carries a sealed document's merged content never lands clear.
 *
 *   S1  a sealed document (each form) written through the real sealed store: the probe reads it `sealed`, never torn.
 *   S2  the lens counts it sealed, not condemned, and says so in its line.
 *   S3  a broken envelope (a cut pointer, a sealed value cut short of its tag) reads torn; a plain torn chunk reads torn.
 *   S4  a healthy sealed plane whose key stands at boot mounts writable over its real id, its record read back.
 *   S5  a sealed plane whose session stands only after the boot window: read-only until it opens, then writable over the
 *       real id, and no plaintext rests anywhere on disk.
 *   S6  a sealed value cut ten bytes short passes the envelope check; the keyed load refuses it and the plane degrades,
 *       quarantined, never a writable blank.
 *   S7  a pointer whose sealed value the holder does not hold: the keyed load refuses, the plane degrades, quarantined.
 *   S8  a sealed plane an earlier probe quarantined: the hand's restore returns it, and the next boot mounts it writable.
 *   S9  a sealed document beside a torn clear tail: the recovery keeps every sealed record, moves the tail, reads sealed.
 *   S10 the late merge of a sealed document into a boot's stand-in never writes its content clear under the stand-in's id.
 *   S11 a sealed plane whose face never lights before a clean stop: the stop ends its wait, the plane settles pending, no
 *       byte moves and nothing is held; the next boot, the session standing, mounts it writable.
 *   S12 a session wearing another face: the keyed load refuses `session-face-foreign`, the plane settles pending, never
 *       quarantined.
 *   S13 a face plane lifted over the veil floor, still resting the floor's seals: with the vessel's key locked the load
 *       waits on the holder and a stop leaves it pending, bytes in place; with the key in reach it mounts writable; under a
 *       wrong key the load refuses by its own key refusal and the plane settles pending.
 *   S14 a sealed value read under another reference (the commitment fails: `context-mismatch`) names custody or mapping as
 *       much as torn bytes: the plane settles pending, never quarantined.
 *
 * Real doors throughout: the sealed document store over a real NodeFS store, the child probe, the doctor, the keel and the
 * real `waitHandle`. The pointer form's holder stands as a port that keeps each sealed value in memory and opens it, as the
 * holder does; no key reaches any probe.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type DocHandle, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  assembleVessel, emptyLarDoc, isCondemned, mintHeldRestKey, personaScopedBagIds, sealedAddressOf, SealedDocumentStore, waitHandle,
  SEALED_CHUNK_MARK, SEALED_HEADER_LEN, DAEMON_BAG_ID, type LarDoc, type SealedBagRow,
} from "@lararium/mesh";
import { makeChildProcessDocLoadProbe, probeDocLoad, quarantineDoc, quarantineHoldOf, readQuarantineManifests, recoverCleanTail, releaseQuarantinedDoc, resolveChildPath } from "../src/doc-load-probe.js";
import { formatDoctorReport, runDoctor } from "../src/doctor.js";
import { fallAwareProbeDoors } from "../src/engine-fall.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } vault.clear(); faceUp = true; wornFace = FACE; vesselKeyNow = null; });

const TITLE = "lar:///ha.ka.ba/probe/sealed-intent";
const MARKER = "SECRET-MARKER-heron-by-the-third-pond";
const FACE = "probe-face";
const PLANES = personaScopedBagIds("probe-sealed-group");
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
const POINTER = [...new TextEncoder().encode("lares-sealed-value:")];
/** The boot window the real `waitHandle` takes here, short so a late session lands past it. */
const WINDOW_MS = 300;

/** `lifted`: the document rests the veil floor's seals (written `held`) and its bag now maps to a face, opening them with
 *  the vessel's own key while it stands in reach (`vesselKeyNow`). */
type Form = "pointer" | "held" | "lifted";
type Key = ReturnType<typeof mintHeldRestKey>;

/** The pointer form's holder: each sealed value by its logical reference, as the holder keeps it. */
const vault = new Map<string, { readonly plaintext: Uint8Array; readonly address: string }>();
/** Whether the pointer form's face stands a session now. */
let faceUp = true;
/** The face that session wears. */
let wornFace = FACE;
/** The vessel's own key as the lifted form's store reads it now: null while the custody stays locked. */
let vesselKeyNow: Key | null = null;

/** The sealed store's ports for one form, mapping `sealedId` (or every document while it stays unknown) to the bag. */
function sealedStore(storageDir: string, form: Form, key: Key, sealedId: () => string | null, hydrates = false): SealedDocumentStore {
  const row: SealedBagRow = form === "held" ? { bagId: PLANES.intents, face: null, held: key } : { bagId: PLANES.intents, face: FACE };
  const faced = form !== "held";
  const inner: StorageAdapterInterface = new NodeFSStorageAdapter(storageDir);
  return new SealedDocumentStore({
    inner,
    bagOf: (documentId) => (sealedId() === null || sealedId() === documentId ? row : null),
    sessionFace: () => (faced && faceUp ? wornFace : null),
    sessionOf: () => (faced && faceUp ? { id: "probe-session", subject: wornFace } : null),
    ...(form === "lifted" ? { vesselKey: () => vesselKeyNow } : {}),
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
        ? ({ plaintext: Uint8Array.from(kept.plaintext), address: kept.address, writer: FACE, changeWriter: "session:probe-session" }) as never
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
const filesOf = (storageDir: string, documentId: string): string[] => walkFiles(docStorePath(storageDir, documentId));
/** Every file under the store that holds the sealed record's text in the clear. */
const clearHits = (storageDir: string): string[] => walkFiles(storageDir).filter((f) => readFileSync(f).includes(Buffer.from(MARKER)));
const startsWith = (bytes: Uint8Array, head: readonly number[]): boolean => head.every((b, i) => bytes[i] === b);

interface SealedFixture { readonly daemonUrl: string; readonly sealedUrl: string; readonly sealedId: string; readonly key: Key; readonly files: string[] }

/** A store holding a plain daemon document and one sealed document with a record in it, flushed and closed. */
async function storeWithSealedDoc(storageDir: string, form: Form): Promise<SealedFixture> {
  const plain = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const daemon = plain.create<LarDoc>(emptyLarDoc());
  await plain.flush();
  await plain.shutdown();

  const key = mintHeldRestKey();
  const repo = new Repo({ storage: sealedStore(storageDir, form, key, () => null), network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { tiddler: { title: TITLE, text: MARKER } }; });
  await repo.flush();
  await repo.shutdown();

  const sealedId = handle.documentId as string;
  // THE SETUP TOOK: every value of the sealed document rests in its sealed form, no Automerge byte and no text among them.
  const files = filesOf(storageDir, sealedId);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const bytes = readFileSync(f);
    expect(startsWith(bytes, MAGIC)).toBe(false);
    expect(startsWith(bytes, form === "pointer" ? POINTER : [...SEALED_CHUNK_MARK])).toBe(true);
  }
  expect(clearHits(storageDir)).toEqual([]);
  return { daemonUrl: daemon.url, sealedUrl: handle.url, sealedId, key, files };
}

/** Wait until `ready()` holds, or fail naming what never came. */
async function until(ready: () => boolean, what: string, ms = 15_000): Promise<void> {
  const end = Date.now() + ms;
  while (!ready()) {
    if (Date.now() > end) throw new Error(`never: ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/**
 * Boot the keel with the sealed document as the worn face's intents plane, through the real probe, the fall-aware doors and
 * the real `waitHandle`. `meanwhile` runs after the keel returns and before the store closes (a session standing late).
 */
async function boot(storageDir: string, form: Form, s: SealedFixture, opts: { hydrates?: boolean; meanwhile?: (store: SealedDocumentStore) => void; settle?: boolean } = {}) {
  const store = sealedStore(storageDir, form, s.key, () => s.sealedId, opts.hydrates ?? false);
  const repo = new Repo({ storage: store, network: [] });
  const doors = fallAwareProbeDoors([], {
    probe: makeChildProcessDocLoadProbe(storageDir),
    recoverCleanTail: (verdict) => recoverCleanTail(storageDir, verdict),
    quarantineDoc: (verdict, bagId) => { quarantineDoc(storageDir, verdict, { bagId }); },
  });
  const assembly = await assembleVessel({
    repo,
    catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
    waitHandle: <T>(url: string, fallback: () => DocHandle<T>) => waitHandle<T>(repo, url, fallback, WINDOW_MS),
    systemCanon: async () => ({}),
    loadGenesis: async () => ({
      islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "probe-core",
      bootstrap: { daemonUrl: s.daemonUrl, personaBagId: PLANES.persona, intentsUrl: s.sealedUrl, personaPlanes: [] },
    }),
    tempStore: () => ({}) as never,
    sealedRefusalOf: (documentId) => store.refusalOf(documentId),
    ...doors,
  });
  const entryNow = () => assembly.mountManifest.entries.find((e) => e.bagId === PLANES.intents);
  const atBoot = { entry: entryNow(), writable: assembly.composite.hasWritableBag(PLANES.intents) };
  opts.meanwhile?.(store);
  if (opts.settle !== false) await assembly.sealedMounts;
  const settled = {
    entry: entryNow(),
    daemon: assembly.mountManifest.entries.find((e) => e.bagId === DAEMON_BAG_ID),
    writable: assembly.composite.hasWritableBag(PLANES.intents),
    record: (await assembly.composite.get?.(TITLE)) ?? null,
    degraded: assembly.mountManifest.degraded,
  };
  await repo.flush();
  await repo.shutdown();
  return { atBoot, ...settled };
}

const quarantined = (storageDir: string): string[] => readdirSync(storageDir).filter((n) => n.startsWith("quarantine-torn-"));

let childStands = true;
try { resolveChildPath(); } catch { childStands = false; }
const d = childStands ? describe : describe.skip;

d("the probe reads a sealed document as sealed; the keyed load at mount decides the rest", () => {
  for (const form of ["pointer", "held"] as const) {
    test(`S1/S2 (${form}) — the probe reads it sealed; the lens counts it sealed, not condemned`, async () => {
      const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
      const s = await storeWithSealedDoc(storageDir, form);

      const verdict = await probeDocLoad(storageDir, s.sealedId);
      expect(verdict.status).toBe("sealed");
      expect(isCondemned(verdict)).toBe(false);
      expect(verdict.sealed).toBe(s.files.length);
      expect(verdict.integrity?.sealed).toBe(s.files.length);

      const report = await runDoctor(storageDir);
      expect(report.total).toBe(2);
      expect(report.condemned).toBe(0);
      expect(report.sealed).toBe(1);
      expect(report.healthy).toBe(1);
      expect(report.degraded).toBe(false);
      const line = formatDoctorReport(report, storageDir);
      expect(line).toMatch(/2 docs · 1 healthy · 1 sealed[^·]*· 0 condemned/);
      expect(line).not.toMatch(/bad magic/);
      expect(quarantined(storageDir)).toEqual([]);
    }, 120_000);
  }

  test("S3 — a cut pointer and a sealed value cut short of its tag read torn; a plain torn chunk reads torn", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const pointer = await storeWithSealedDoc(storageDir, "pointer");
    const cut = readFileSync(pointer.files[0]!);
    writeFileSync(pointer.files[0]!, cut.subarray(0, cut.length - 10));
    const torn = await probeDocLoad(storageDir, pointer.sealedId);
    expect(torn.status).toBe("torn");
    expect(torn.reason).toMatch(/sealed pointer/);

    const second = mkdtempSync(join(tmpdir(), "lar-probe-sealed-"));
    try {
      const held = await storeWithSealedDoc(second, "held");
      // The header stands whole, then five bytes: a last segment shorter than its own tag.
      writeFileSync(held.files[0]!, readFileSync(held.files[0]!).subarray(0, SEALED_HEADER_LEN + 5));
      const short = await probeDocLoad(second, held.sealedId);
      expect(short.status).toBe("torn");
      expect(short.reason).toMatch(/sealed value/);

      // CONTROL: a plain document's chunk garbled past its magic reads torn, as before.
      const daemonId = held.daemonUrl.replace(/^automerge:/, "");
      for (const f of filesOf(second, daemonId)) writeFileSync(f, Buffer.from([...MAGIC, 0x01, 0x02, 0x03]));
      expect((await probeDocLoad(second, daemonId)).status).toBe("torn");
    } finally { rmSync(second, { recursive: true, force: true }); }
  }, 120_000);

  for (const form of ["pointer", "held"] as const) {
    test(`S4 (${form}) — a healthy sealed plane whose key stands at boot mounts writable over its real id`, async () => {
      const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
      const s = await storeWithSealedDoc(storageDir, form);

      const booted = await boot(storageDir, form, s, { hydrates: true });
      expect(booted.entry?.status).toBe("mounted");
      expect(booted.writable).toBe(true);
      expect(booted.daemon?.status).toBe("mounted");
      expect(booted.record?.tiddler.text).toBe(MARKER);
      expect(quarantined(storageDir)).toEqual([]);
      expect(clearHits(storageDir)).toEqual([]);
    }, 120_000);
  }

  test("S5 — a session standing past the boot window: read-only until it opens, then writable over the real id, no plaintext on disk", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    faceUp = false;

    const booted = await boot(storageDir, "pointer", s, {
      hydrates: true,
      meanwhile: (store) => { setTimeout(() => { faceUp = true; store.mapMoved(); }, WINDOW_MS * 4); },
    });
    // At boot, past the window: no writable blank stands in for the plane.
    expect(booted.atBoot.entry?.status).toBe("sealed");
    expect(booted.atBoot.writable).toBe(false);
    // The key stood late: the plane opens over its real id, writable, its record whole.
    expect(booted.entry?.status).toBe("mounted");
    expect(booted.writable).toBe(true);
    expect(booted.record?.tiddler.text).toBe(MARKER);
    expect(quarantined(storageDir)).toEqual([]);
    expect(clearHits(storageDir)).toEqual([]);
  }, 120_000);

  test("S6 — a sealed value cut ten bytes short passes the envelope; the keyed load refuses and the plane degrades, quarantined", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "held");
    for (const f of s.files) { const bytes = readFileSync(f); writeFileSync(f, bytes.subarray(0, bytes.length - 10)); }
    // The key-less check cannot see this cut: it reads sealed, and the keyed load decides.
    expect((await probeDocLoad(storageDir, s.sealedId)).status).toBe("sealed");

    const booted = await boot(storageDir, "held", s, { hydrates: true });
    expect(booted.entry?.status).toBe("degraded");
    expect(booted.writable).toBe(false);
    expect(booted.degraded).toBe(true);
    expect(quarantineHoldOf(storageDir, s.sealedId)).not.toBeNull();
    // Held across boots: the next boot reads the hold, never a writable blank.
    const again = await boot(storageDir, "held", s, { hydrates: true });
    expect(again.entry?.status).toBe("degraded");
    expect(again.writable).toBe(false);
  }, 120_000);

  test("S7 — a pointer whose sealed value the holder does not hold: the keyed load refuses, the plane degrades, quarantined", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    vault.clear();
    expect((await probeDocLoad(storageDir, s.sealedId)).status).toBe("sealed");

    const booted = await boot(storageDir, "pointer", s, { hydrates: true });
    expect(booted.entry?.status).toBe("degraded");
    expect(booted.writable).toBe(false);
    expect(quarantineHoldOf(storageDir, s.sealedId)).not.toBeNull();
  }, 120_000);

  test("S8 — a sealed plane an earlier probe quarantined: the restore returns it, and the next boot mounts it writable", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    // An earlier probe's verdict, as a framing gate that read only Automerge magic left it.
    quarantineDoc(storageDir, { documentId: s.sealedId, status: "torn", reason: "snapshot: bad magic at offset 0 — not an automerge chunk / corrupt" }, { bagId: PLANES.intents });

    const held = await boot(storageDir, "pointer", s, { hydrates: true });
    expect(held.entry?.status).toBe("degraded");
    expect(held.writable).toBe(false);

    const syncDir = join(docStorePath(storageDir, s.sealedId), "sync-state");
    mkdirSync(syncDir, { recursive: true });
    writeFileSync(join(syncDir, "peer"), "held sync state");
    const keep = releaseQuarantinedDoc(storageDir, s.sealedId, "kept");
    expect(keep.ok).toBe(false);
    if (!keep.ok) expect(keep.why).toContain(`\`lares vessel release ${s.sealedId}\``);

    expect(releaseQuarantinedDoc(storageDir, s.sealedId, "restored")).toMatchObject({ ok: true, act: "restored" });
    const shard = join(storageDir, s.sealedId.slice(0, 2));
    const aside = readdirSync(shard).find((name) => name.startsWith("sync-state-aside-"));
    expect(aside).toBeDefined();
    expect(readFileSync(join(shard, aside!, "store", "sync-state", "peer"), "utf8")).toBe("held sync state");
    const verdict = await probeDocLoad(storageDir, s.sealedId);
    expect(verdict.status).toBe("sealed");
    expect(verdict.sealed).toBe(s.files.length);

    const restored = await boot(storageDir, "pointer", s, { hydrates: true });
    expect(restored.entry?.status).toBe("mounted");
    expect(restored.writable).toBe(true);
    expect(restored.record?.tiddler.text).toBe(MARKER);
    // No second move: the one manifest stands released, and the bytes stand under the id.
    expect(readQuarantineManifests(storageDir).map((h) => h.manifest.released?.act)).toEqual(["restored"]);
    expect(existsSync(docStorePath(storageDir, s.sealedId))).toBe(true);
  }, 120_000);

  test("S9 — a sealed document beside a torn clear tail: the recovery keeps every sealed record and moves the tail", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "held");
    mkdirSync(join(docStorePath(storageDir, s.sealedId), "incremental"), { recursive: true });
    const tail = join(docStorePath(storageDir, s.sealedId), "incremental", "zz-torn-tail");
    writeFileSync(tail, Buffer.from([...MAGIC, 0x01, 0x02, 0x03]));

    const condemned = await probeDocLoad(storageDir, s.sealedId);
    expect(condemned.status).toBe("torn");
    const promoted = await recoverCleanTail(storageDir, condemned);
    expect(promoted?.status).toBe("sealed");
    expect(promoted?.cleanTail?.movedAside).toHaveLength(1);
    expect(existsSync(tail)).toBe(false);
    for (const f of s.files) expect(existsSync(f)).toBe(true);
    expect((await probeDocLoad(storageDir, s.sealedId)).status).toBe("sealed");
  }, 120_000);

  test("S10 — a sealed document merged late into a stand-in never lands clear under the stand-in's id", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    faceUp = false;
    const store = sealedStore(storageDir, "pointer", s.key, () => s.sealedId, true);
    const repo = new Repo({ storage: store, network: [] });
    const fresh = await waitHandle<LarDoc>(repo, s.sealedUrl, () => repo.create<LarDoc>(emptyLarDoc()), WINDOW_MS);
    expect(fresh.documentId).not.toBe(s.sealedId);
    faceUp = true;
    store.mapMoved();
    // The late merge reaches the fallback's save, and the store holds it in memory, never clear under the fallback's id.
    await until(() => store.waiting(fresh.documentId) > 0, "the late merge's save, held");
    await repo.flush();
    await repo.shutdown();
    expect(clearHits(storageDir)).toEqual([]);
  }, 120_000);

  test("S11 — no session before a clean stop: the stop ends the wait, the plane settles pending, no byte moves, nothing held", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    const before = s.files.map((f) => readFileSync(f).toString("hex"));
    faceUp = false;

    // The stop ends every hydrating wait (`endHydration`, as the composition's close does) before the face lights.
    const stopped = await boot(storageDir, "pointer", s, { hydrates: true, meanwhile: (store) => { store.endHydration(); } });
    expect(stopped.atBoot.entry?.status).toBe("sealed");
    expect(stopped.entry?.status).toBe("pending");
    expect(stopped.writable).toBe(false);
    expect(stopped.degraded).toBe(false);
    expect(quarantined(storageDir)).toEqual([]);
    expect(readQuarantineManifests(storageDir)).toEqual([]);
    expect(filesOf(storageDir, s.sealedId).map((f) => readFileSync(f).toString("hex"))).toEqual(before);

    faceUp = true;
    const next = await boot(storageDir, "pointer", s, { hydrates: true });
    expect(next.entry?.status).toBe("mounted");
    expect(next.writable).toBe(true);
    expect(next.record?.tiddler.text).toBe(MARKER);
  }, 120_000);

  test("S12 — a session wearing another face: the keyed load refuses session-face-foreign, the plane settles pending", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    wornFace = "another-face";

    const booted = await boot(storageDir, "pointer", s, { hydrates: true });
    expect(booted.entry?.status).toBe("pending");
    expect(booted.writable).toBe(false);
    expect(quarantined(storageDir)).toEqual([]);
    expect(existsSync(docStorePath(storageDir, s.sealedId))).toBe(true);
  }, 120_000);

  test("S13 — a lifted face plane resting the floor's seals: locked key waits (pending at a stop), key in reach mounts, wrong key pends", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "held");
    const before = s.files.map((f) => readFileSync(f).toString("hex"));

    // The vessel's key locked: the load waits on the holder, and the stop leaves the plane pending, nothing moved.
    vesselKeyNow = null;
    const locked = await boot(storageDir, "lifted", s, { hydrates: true, meanwhile: (store) => { store.endHydration(); } });
    expect(locked.entry?.status).toBe("pending");
    expect(locked.writable).toBe(false);
    expect(quarantined(storageDir)).toEqual([]);
    expect(filesOf(storageDir, s.sealedId).map((f) => readFileSync(f).toString("hex"))).toEqual(before);

    // A wrong key in reach: its own key refusal, never a malformed pointer, and the plane pends.
    vesselKeyNow = mintHeldRestKey();
    const wrong = await boot(storageDir, "lifted", s, { hydrates: true });
    expect(wrong.entry?.status).toBe("pending");
    expect(wrong.entry?.reason).not.toMatch(/pointer-malformed/);
    expect(quarantined(storageDir)).toEqual([]);

    // The vessel's own key in reach: the floor's seals open for the face, and the plane mounts writable.
    vesselKeyNow = s.key;
    const opened = await boot(storageDir, "lifted", s, { hydrates: true });
    expect(opened.entry?.status).toBe("mounted");
    expect(opened.writable).toBe(true);
    expect(opened.record?.tiddler.text).toBe(MARKER);
  }, 120_000);

  test("S14 — a sealed value read under another reference refuses context-mismatch: the plane settles pending, never quarantined", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "held");
    // The value moves under another storage key: its logical reference changes, so the commitment fails under the same key.
    for (const f of s.files) renameSync(f, `${f.slice(0, f.lastIndexOf("/") + 1)}${"f".repeat(64)}`);
    expect((await probeDocLoad(storageDir, s.sealedId)).status).toBe("sealed");

    const booted = await boot(storageDir, "held", s, { hydrates: true });
    expect(booted.entry?.status).toBe("pending");
    expect(booted.entry?.reason).toMatch(/context-mismatch/);
    expect(booted.writable).toBe(false);
    expect(quarantined(storageDir)).toEqual([]);
  }, 120_000);
});
