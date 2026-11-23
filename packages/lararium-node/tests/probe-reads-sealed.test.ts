/**
 * THE PROBE READS A SEALED DOCUMENT AS SEALED, NEVER TORN.
 *
 * A document of a sealed bag rests no Automerge byte. Each stored value holds either the sealed document store's pointer
 * (`lares-sealed-value:blake3:<hex>`, the holder keeps the sealed bytes) or a sealed value itself (a keyed bag: the secret
 * home, the floor, a public bag). The probe child and the deep vessel lens hold no key, so they read the envelope alone:
 * a well-formed envelope reads sound and the document mounts; a broken envelope reads torn, as any garbled chunk does.
 * Measured live 2026-11-23: the lens read 55 of 115 documents condemned with "bad magic at offset 0", each a sealed
 * document, and a boot's probe had moved a face's sealed intents plane into quarantine.
 *
 *   S1  a sealed document (each form) written through the real sealed store: the probe reads it ok, sealed, never torn.
 *   S2  the lens counts it sealed, not condemned, and says so in its line.
 *   S3  a broken envelope (a cut pointer, a sealed value cut short of its tag) reads torn; a plain torn chunk reads torn.
 *   S4  the boot (the keel's social mount through the fall-aware doors) mounts a sealed face plane and moves no byte.
 *   S5  a sealed plane an earlier probe quarantined: the hand's restore returns it, and the next boot mounts it, sealed-ok.
 *   S6  a sealed document beside a torn clear tail: the clean-tail recovery keeps the sealed records and moves the tail.
 *
 * Real doors throughout: the sealed document store over a real NodeFS store, the child probe, the doctor, the keel. The
 * pointer form's holder seal stands as a port that answers an address, as the holder does; no key reaches any probe.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo, type StorageAdapterInterface } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import {
  assembleVessel, emptyLarDoc, isCondemned, mintHeldRestKey, personaScopedBagIds, sealedAddressOf, SealedDocumentStore,
  SEALED_CHUNK_MARK, SEALED_HEADER_LEN, DAEMON_BAG_ID, type LarDoc, type SealedBagRow,
} from "@lararium/mesh";
import { makeChildProcessDocLoadProbe, probeDocLoad, quarantineDoc, readQuarantineManifests, recoverCleanTail, releaseQuarantinedDoc, resolveChildPath } from "../src/doc-load-probe.js";
import { formatDoctorReport, runDoctor } from "../src/doctor.js";
import { fallAwareProbeDoors } from "../src/engine-fall.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const TITLE = "lar:///ha.ka.ba/probe/sealed-intent";
const FACE = "probe-face";
const PLANES = personaScopedBagIds("probe-sealed-group");
const MAGIC = [0x85, 0x6f, 0x4a, 0x83];
const POINTER = [...new TextEncoder().encode("lares-sealed-value:")];

type Form = "pointer" | "held";

/** The sealed store's ports for one form, mapping `sealedId` (or every document while it stays unknown) to the bag. */
function sealedStore(storageDir: string, form: Form, key: ReturnType<typeof mintHeldRestKey>, sealedId: () => string | null): SealedDocumentStore {
  const row: SealedBagRow = form === "held" ? { bagId: PLANES.intents, face: null, held: key } : { bagId: PLANES.intents, face: FACE };
  const inner: StorageAdapterInterface = new NodeFSStorageAdapter(storageDir);
  const refuse = async () => ({ refusal: "signer-unavailable" }) as never;
  return new SealedDocumentStore({
    inner,
    bagOf: (documentId) => (sealedId() === null || sealedId() === documentId ? row : null),
    sessionFace: () => (form === "pointer" ? FACE : null),
    sessionOf: () => (form === "pointer" ? { id: "probe-session", subject: FACE } : null),
    // The holder's seal answers each value's sealed address; the store rests the pointer to it.
    seal: form === "pointer"
      ? async ({ values }) => ({ values: values.map((v) => ({ role: v.role, ref: v.ref, address: sealedAddressOf(v.plaintext) })) })
      : refuse,
    open: refuse,
  });
}

/** Every stored file of one document. */
function filesOf(storageDir: string, documentId: string): string[] {
  const out: string[] = [];
  const walk = (p: string): void => {
    for (const name of readdirSync(p)) {
      const child = join(p, name);
      if (statSync(child).isDirectory()) walk(child); else out.push(child);
    }
  };
  walk(docStorePath(storageDir, documentId));
  return out.sort();
}

const startsWith = (bytes: Uint8Array, head: readonly number[]): boolean => head.every((b, i) => bytes[i] === b);

/** A store holding a plain daemon document and one sealed document with a record in it, flushed and closed. */
async function storeWithSealedDoc(storageDir: string, form: Form) {
  const plain = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const daemon = plain.create<LarDoc>(emptyLarDoc());
  await plain.flush();
  await plain.shutdown();

  const key = mintHeldRestKey();
  const repo = new Repo({ storage: sealedStore(storageDir, form, key, () => null), network: [] });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { title: TITLE, text: "an intent" }; });
  await repo.flush();
  await repo.shutdown();

  const sealedId = handle.documentId as string;
  // THE SETUP TOOK: every value of the sealed document rests in its sealed form, no Automerge byte among them.
  const files = filesOf(storageDir, sealedId);
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const bytes = readFileSync(f);
    expect(startsWith(bytes, MAGIC)).toBe(false);
    expect(startsWith(bytes, form === "pointer" ? POINTER : [...SEALED_CHUNK_MARK])).toBe(true);
  }
  return { daemonUrl: daemon.url, sealedUrl: handle.url, sealedId, key, files };
}

/** Boot the keel with the sealed document as the face's intents plane, through the real probe and the fall-aware doors. */
async function boot(storageDir: string, form: Form, s: { daemonUrl: string; sealedUrl: string; sealedId: string; key: ReturnType<typeof mintHeldRestKey> }) {
  const repo = new Repo({ storage: sealedStore(storageDir, form, s.key, () => s.sealedId), network: [] });
  const doors = fallAwareProbeDoors([], {
    probe: makeChildProcessDocLoadProbe(storageDir),
    recoverCleanTail: (verdict) => recoverCleanTail(storageDir, verdict),
    quarantineDoc: (verdict, bagId) => { quarantineDoc(storageDir, verdict, { bagId }); },
  });
  const assembly = await assembleVessel({
    repo,
    catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
    // The pointer form's holder stands no open here, so its plane resolves the stand-in; the held form reads its record.
    waitHandle: async (url, fallback) => {
      if (form === "pointer" && url === s.sealedUrl) return fallback();
      try { return (await repo.find(url as never)) as never; } catch { return fallback(); }
    },
    systemCanon: async () => ({}),
    loadGenesis: async () => ({
      islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "probe-core",
      bootstrap: { daemonUrl: s.daemonUrl, personaBagId: PLANES.persona, intentsUrl: s.sealedUrl, personaPlanes: [] },
    }),
    tempStore: () => ({}) as never,
    ...doors,
  });
  const entry = assembly.mountManifest.entries.find((e) => e.bagId === PLANES.intents);
  const daemon = assembly.mountManifest.entries.find((e) => e.bagId === DAEMON_BAG_ID);
  const writable = assembly.composite.hasWritableBag(PLANES.intents);
  const record = assembly.composite.get?.(TITLE) ?? null;
  await repo.flush();
  await repo.shutdown();
  return { entry, daemon, writable, record };
}

const quarantined = (storageDir: string): string[] => readdirSync(storageDir).filter((n) => n.startsWith("quarantine-torn-"));

let childStands = true;
try { resolveChildPath(); } catch { childStands = false; }
const d = childStands ? describe : describe.skip;

d("the probe reads a sealed document as sealed, never torn", () => {
  for (const form of ["pointer", "held"] as const) {
    test(`S1/S2 (${form}) — the probe reads it ok and sealed; the lens counts it sealed, not condemned`, async () => {
      const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
      const s = await storeWithSealedDoc(storageDir, form);

      const verdict = await probeDocLoad(storageDir, s.sealedId);
      expect(verdict.status).toBe("ok");
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
    test(`S4 (${form}) — the boot mounts the sealed face plane writable and moves no byte`, async () => {
      const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
      const s = await storeWithSealedDoc(storageDir, form);

      const booted = await boot(storageDir, form, s);
      expect(booted.entry?.status).toBe("mounted");
      expect(booted.writable).toBe(true);
      expect(booted.daemon?.status).toBe("mounted");
      expect(quarantined(storageDir)).toEqual([]);
      expect(existsSync(docStorePath(storageDir, s.sealedId))).toBe(true);
      // The held form opens under its key at the mount: the record reads back through the plane.
      if (form === "held") expect(booted.record).not.toBeNull();
    }, 120_000);
  }

  test("S5 — a sealed plane an earlier probe quarantined: the restore returns it, and the next boot mounts it sealed-ok", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "pointer");
    // The earlier life's verdict, as the boot of 2026-11-22 left it.
    quarantineDoc(storageDir, { documentId: s.sealedId, status: "torn", reason: "snapshot: bad magic at offset 0 — not an automerge chunk / corrupt" }, { bagId: PLANES.intents });

    const held = await boot(storageDir, "pointer", s);
    expect(held.entry?.status).toBe("degraded");
    expect(held.writable).toBe(false);

    expect(releaseQuarantinedDoc(storageDir, s.sealedId, "restored")).toMatchObject({ ok: true, act: "restored" });
    const verdict = await probeDocLoad(storageDir, s.sealedId);
    expect(verdict.status).toBe("ok");
    expect(verdict.sealed).toBe(s.files.length);

    const restored = await boot(storageDir, "pointer", s);
    expect(restored.entry?.status).toBe("mounted");
    expect(restored.writable).toBe(true);
    // No second move: the one manifest stands released, and the bytes stand under the id.
    expect(readQuarantineManifests(storageDir).map((h) => h.manifest.released?.act)).toEqual(["restored"]);
    expect(existsSync(docStorePath(storageDir, s.sealedId))).toBe(true);
  }, 120_000);

  test("S6 — a sealed document beside a torn clear tail: the recovery keeps every sealed record and moves the tail", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-probe-sealed-")));
    const s = await storeWithSealedDoc(storageDir, "held");
    mkdirSync(join(docStorePath(storageDir, s.sealedId), "incremental"), { recursive: true });
    const tail = join(docStorePath(storageDir, s.sealedId), "incremental", "zz-torn-tail");
    writeFileSync(tail, Buffer.from([...MAGIC, 0x01, 0x02, 0x03]));

    const condemned = await probeDocLoad(storageDir, s.sealedId);
    expect(condemned.status).toBe("torn");
    const promoted = await recoverCleanTail(storageDir, condemned);
    expect(promoted?.status).toBe("ok");
    expect(promoted?.cleanTail?.movedAside).toHaveLength(1);
    expect(existsSync(tail)).toBe(false);
    for (const f of s.files) expect(existsSync(f)).toBe(true);
    expect((await probeDocLoad(storageDir, s.sealedId)).status).toBe("ok");
  }, 120_000);
});
