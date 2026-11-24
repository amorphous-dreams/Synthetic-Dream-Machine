/**
 * A QUARANTINED DOCUMENT STAYS HELD ACROSS BOOTS, NEVER A WRITABLE BLANK.
 *
 * A document the probe condemns moves aside into `quarantine-torn-snapshots-*`, and the manifest the move writes beside the
 * bytes names its id. On every later boot that id names a URL with no stored bytes; read bare, the probe child would see
 * zero chunks as a fresh blank and the plane would mount writable over an orphan no pointer names. The manifest answers
 * instead: the plane mounts degraded and read-only, boot after boot, until a hand act restores the bytes or releases the id.
 *
 *   Q1  a torn document quarantined at one boot stays held at the next two: degraded, read-only, no bytes under its id.
 *   Q2  a hand's restore returns the bytes; the next boot mounts the document writable with its record.
 *   Q3  a hand's fresh release lets the id start empty; the bytes stay aside, and no later boot reads it held.
 *   Q4  a release refuses where no hold names the id.
 *   Q5  a fresh release refuses for a plane a sibling device carries (a face plane): a second history under the old id
 *       would hide the sibling's real copy; it names restore or keep instead.
 *   Q6  an id held beside bytes standing under it (a crash between the manifest and the move, or between a restore's move
 *       and its marking) releases with keep; restore and fresh name keep, never a move by hand.
 *   Q7  a restore reads the moved bytes beside the manifest, so a store read under another root prefix still restores.
 *   Q8  keep refuses where nothing stands under the id (it would free a writable blank); with the moved bytes gone too,
 *       restore names only fresh, and fresh refuses for a sibling-carried plane.
 *
 * Real doors throughout: the child probe, the clean-tail child and the quarantine, over a real NodeFS store. The tear
 * comes by hand; nothing runs out of wasm memory.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { assembleVessel, emptyLarDoc, personaScopedBagIds, DAEMON_BAG_ID, type LarDoc } from "@lararium/mesh";
import { makeChildProcessDocLoadProbe, quarantineDoc, readQuarantineManifests, recoverCleanTail, releaseQuarantinedDoc, resolveChildPath } from "../src/doc-load-probe.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

const TITLE = "lar:///ha.ka.ba/probe/quarantine-held";

/** A store holding one daemon document with a record in it, flushed to disk and closed. */
async function storeWithDaemonDoc(storageDir: string): Promise<string> {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)[TITLE] = { title: TITLE, text: "a record" }; });
  await repo.flush();
  await repo.shutdown();
  return handle.url;
}

/** Tear every stored record of a document, the base included, so no clean prefix stands to recover. */
function tearWhole(storageDir: string, documentId: string): void {
  const walk = (p: string): void => {
    for (const name of readdirSync(p)) {
      const child = join(p, name);
      if (statSync(child).isDirectory()) walk(child);
      else writeFileSync(child, Buffer.from([0x85, 0x6f, 0x4a, 0x83, 0x01, 0x02, 0x03]));
    }
  };
  walk(docStorePath(storageDir, documentId));
}

/**
 * Boot the keel over the store with the real probe doors. The handle resolver falls back to a fresh blank where the
 * store holds nothing for a url, as the vessel's own resolver does, so a blank read writable would show here.
 */
async function boot(storageDir: string, daemonUrl: string) {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const assembly = await assembleVessel({
    repo,
    catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
    waitHandle: async (url, _bagId, fallback) => {
      try { return (await repo.find(url as never)) as never; } catch { return fallback(); }
    },
    systemCanon: async () => ({}),
    loadGenesis: async () => ({ islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "probe-core", bootstrap: { daemonUrl, personaPlanes: [] } }),
    tempStore: () => ({}) as never,
    docLoadProbe: makeChildProcessDocLoadProbe(storageDir),
    recoverCleanTail: (verdict) => recoverCleanTail(storageDir, verdict),
    quarantineDoc: (verdict, bagId) => { quarantineDoc(storageDir, verdict, { bagId }); },
  });
  const entry = assembly.mountManifest.entries.find((e) => e.bagId === DAEMON_BAG_ID);
  const writable = assembly.composite.hasWritableBag(DAEMON_BAG_ID);
  const record = assembly.composite.get?.(TITLE) ?? null;
  await repo.flush();
  await repo.shutdown();
  return { entry, writable, record };
}

let childStands = true;
try { resolveChildPath(); } catch { childStands = false; }
const d = childStands ? describe : describe.skip;

d("a quarantined document stays held across boots until a hand act releases it", () => {
  test("Q1 — a torn document quarantined at one boot stays held, read-only, at the next two; no blank takes its id", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    tearWhole(storageDir, daemonId);

    const first = await boot(storageDir, daemonUrl);
    expect(first.entry?.status).toBe("degraded");
    expect(first.writable).toBe(false);
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(false);
    // The move records the plane it held, so a later release can tell a plane a sibling carries.
    expect(readQuarantineManifests(storageDir).map((h) => h.manifest.bagId)).toEqual([DAEMON_BAG_ID]);

    for (const _ of [2, 3]) {
      const later = await boot(storageDir, daemonUrl);
      expect(later.entry?.status).toBe("degraded");
      expect(later.entry?.reason).toMatch(/held in quarantine/);
      expect(later.writable).toBe(false);
      expect(existsSync(docStorePath(storageDir, daemonId))).toBe(false);
    }
    // Exactly one move: a held id takes no second quarantine.
    const quarantined = readdirSync(storageDir).filter((n) => n.startsWith("quarantine-torn-snapshots-"))
      .flatMap((q) => readdirSync(join(storageDir, q)).filter((n) => !n.endsWith(".manifest.json")));
    expect(quarantined).toHaveLength(1);
  }, 120_000);

  test("Q2 — a hand's restore returns the bytes; the next boot mounts the document writable", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    // An earlier condemn, as the boot's quarantine door leaves it (the bytes here stand sound, so the restore mounts).
    quarantineDoc(storageDir, { documentId: daemonId, status: "aborted", reason: "an earlier life's verdict" });

    const held = await boot(storageDir, daemonUrl);
    expect(held.entry?.status).toBe("degraded");
    expect(held.writable).toBe(false);
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(false);

    const release = releaseQuarantinedDoc(storageDir, daemonId, "restored");
    expect(release.ok).toBe(true);
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(true);

    const restored = await boot(storageDir, daemonUrl);
    expect(restored.entry?.status).toBe("mounted");
    expect(restored.writable).toBe(true);
  }, 120_000);

  test("Q3 — a hand's fresh release lets the id start empty; the bytes stay aside and no boot reads it held", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    const movedTo = quarantineDoc(storageDir, { documentId: daemonId, status: "torn", reason: "an earlier life's verdict" }, { bagId: DAEMON_BAG_ID });

    const syncDir = join(docStorePath(storageDir, daemonId), "sync-state");
    mkdirSync(syncDir, { recursive: true });
    writeFileSync(join(syncDir, "peer"), "old sync state");
    expect(releaseQuarantinedDoc(storageDir, daemonId, "fresh")).toMatchObject({ ok: true, act: "fresh" });
    const shard = join(storageDir, daemonId.slice(0, 2));
    const aside = readdirSync(shard).find((name) => name.startsWith("sync-state-aside-"));
    expect(aside).toBeDefined();
    expect(readFileSync(join(shard, aside!, "store", "sync-state", "peer"), "utf8")).toBe("old sync state");
    expect(existsSync(syncDir)).toBe(false);
    const fresh = await boot(storageDir, daemonUrl);
    expect(fresh.entry?.status).toBe("mounted");
    expect(fresh.writable).toBe(true);
    expect(movedTo && existsSync(movedTo)).toBe(true);
    // The empty document rests under the held id itself, so the pointer names it and no orphan takes the writes.
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(true);
  }, 120_000);

  test("Q4 — a release refuses where no hold names the id", () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    expect(releaseQuarantinedDoc(storageDir, "4NMNnkMhL8jXrdJ9jamS2rUEaQDq", "restored")).toMatchObject({ ok: false });
  });

  test("Q5 — a fresh release refuses for a face plane a sibling carries, and names restore or keep", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const docId = daemonUrl.replace(/^automerge:/, "");
    const circles = personaScopedBagIds("probe-group").circles;
    quarantineDoc(storageDir, { documentId: docId, status: "torn", reason: "an earlier life's verdict" }, { bagId: circles });

    const refused = releaseQuarantinedDoc(storageDir, docId, "fresh");
    expect(refused).toMatchObject({ ok: false });
    expect(refused.ok === false && refused.why).toMatch(/sibling/);
    expect(refused.ok === false && refused.why).toMatch(/`lares vessel release \w+`|lares vessel release \w+ --keep/);
    expect(existsSync(docStorePath(storageDir, docId))).toBe(false);
    // A plane whose bag the manifest never named refuses too: fail-closed.
    const unnamed = mkdtempSync(join(tmpdir(), "lar-quarantine-held-"));
    try {
      const url2 = await storeWithDaemonDoc(unnamed);
      const id2 = url2.replace(/^automerge:/, "");
      quarantineDoc(unnamed, { documentId: id2, status: "torn" });
      expect(releaseQuarantinedDoc(unnamed, id2, "fresh")).toMatchObject({ ok: false });
    } finally { rmSync(unnamed, { recursive: true, force: true }); }
  }, 120_000);

  test("Q6 — an id held beside bytes standing under it releases with keep; restore and fresh name keep", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    // A restore that moved the bytes back and fell before it marked the manifest: the bytes stand, the hold stands.
    const movedTo = quarantineDoc(storageDir, { documentId: daemonId, status: "aborted" }, { bagId: DAEMON_BAG_ID })!;
    renameSync(movedTo, docStorePath(storageDir, daemonId));

    const held = await boot(storageDir, daemonUrl);
    expect(held.entry?.status).toBe("degraded");
    for (const act of ["restored", "fresh"] as const) {
      const r = releaseQuarantinedDoc(storageDir, daemonId, act);
      expect(r).toMatchObject({ ok: false });
      expect(r.ok === false && r.why).toMatch(/lares vessel release \w+ --keep/);
      expect(r.ok === false && r.why).not.toMatch(/by hand/);
    }
    expect(releaseQuarantinedDoc(storageDir, daemonId, "kept")).toMatchObject({ ok: true, act: "kept" });
    const kept = await boot(storageDir, daemonUrl);
    expect(kept.entry?.status).toBe("mounted");
    expect(kept.writable).toBe(true);
  }, 120_000);

  test("Q7 — a restore reads the moved bytes beside the manifest, under another root prefix", async () => {
    const first = mkdtempSync(join(tmpdir(), "lar-quarantine-held-"));
    const daemonUrl = await storeWithDaemonDoc(first);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    quarantineDoc(first, { documentId: daemonId, status: "aborted" }, { bagId: DAEMON_BAG_ID });
    // The vessel recorded its own path; the hand reads the same store from another prefix.
    const storageDir = (dir = `${first}-seen-from-the-host`);
    renameSync(first, storageDir);

    expect(releaseQuarantinedDoc(storageDir, daemonId, "restored")).toMatchObject({ ok: true, act: "restored" });
    const restored = await boot(storageDir, daemonUrl);
    expect(restored.entry?.status).toBe("mounted");
    expect(restored.writable).toBe(true);
  }, 120_000);

  test("Q8 — keep refuses where nothing stands under the id; each refusal names only an act that can land", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-quarantine-held-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    const movedTo = quarantineDoc(storageDir, { documentId: daemonId, status: "aborted" }, { bagId: DAEMON_BAG_ID })!;

    // The moved bytes still rest: keep refuses and names restore.
    const withBytes = releaseQuarantinedDoc(storageDir, daemonId, "kept");
    expect(withBytes).toMatchObject({ ok: false });
    expect(withBytes.ok === false && withBytes.why).toMatch(/`lares vessel release \w+`/);

    // The moved bytes gone as well: restore and keep each name fresh alone, never each other.
    rmSync(movedTo, { recursive: true, force: true });
    const restore = releaseQuarantinedDoc(storageDir, daemonId, "restored");
    expect(restore.ok === false && restore.why).toMatch(/lares vessel release \w+ --fresh/);
    expect(restore.ok === false && restore.why).not.toMatch(/lares vessel release \w+ --keep/);
    const keep = releaseQuarantinedDoc(storageDir, daemonId, "kept");
    expect(keep.ok === false && keep.why).toMatch(/lares vessel release \w+ --fresh/);
    expect(keep.ok === false && keep.why).not.toMatch(/`lares vessel release \w+`/);

    // The hold still stands: the next boot holds the plane read-only, no blank.
    const held = await boot(storageDir, daemonUrl);
    expect(held.entry?.status).toBe("degraded");
    expect(held.writable).toBe(false);
  }, 120_000);
});
