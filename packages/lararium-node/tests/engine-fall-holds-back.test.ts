/**
 * THE DOCUMENT IN FLIGHT AT AN ENGINE FALL STANDS HELD AT THE NEXT BOOT, THROUGH THE COMPOSITION'S OWN PATH.
 *
 * A fall rests the document the Repo was handling (`EngineFall.inFlight`). The next boot hands that id to the keel's probe
 * doors (`fallAwareProbeDoors`), and the REAL probe reads it. A torn one takes the composition's own path (the clean-tail
 * recovery, then the quarantine and the degraded stand-in). One that loads clean stands HELD: read-only in the `pending`
 * branch, its bytes where they rest, no writable stand-in, until the hand releases it. Under an OOM the document in flight
 * usually stands innocent, so no sound document's bytes ever move.
 *
 *   H1  a sound held daemon document mounts pending and read-only, its bytes in place, nothing quarantined.
 *   H2  a torn held daemon document still takes L3 or the quarantine, never the pending hold.
 *   H1 CONTROL  with no fall resting, the same store mounts writable.
 *
 * Real doors throughout: the child probe, the clean-tail child and the quarantine, over a real store; no blank document
 * mounts writable in any case.
 *
 * No wasm runs out of anything: the fall rests by hand, as a fallen life leaves it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { assembleVessel, emptyLarDoc, DAEMON_BAG_ID, type LarDoc } from "@lararium/mesh";
import { createEngineWatch } from "../src/engine-watch.js";
import { fallAwareProbeDoors, readEngineFalls, restEngineFall } from "../src/engine-fall.js";
import { makeChildProcessDocLoadProbe, quarantineDoc, recoverCleanTail, resolveChildPath } from "../src/doc-load-probe.js";
import { docStorePath } from "../src/store-integrity.js";

let dir = "";
afterEach(() => { if (dir) { rmSync(dir, { recursive: true, force: true }); dir = ""; } });

/** A store holding one daemon document with a record in it, flushed to disk and closed. */
async function storeWithDaemonDoc(storageDir: string): Promise<string> {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const handle = repo.create<LarDoc>(emptyLarDoc());
  handle.change((doc) => { (doc.tiddlers as Record<string, unknown>)["lar:///ha.ka.ba/probe/held"] = { title: "lar:///ha.ka.ba/probe/held", text: "a record" }; });
  await repo.flush();
  await repo.shutdown();
  return handle.url;
}

/** Boot the keel over that store with the real probe doors, aware of whatever falls rest there. */
async function boot(storageDir: string, daemonUrl: string) {
  const repo = new Repo({ storage: new NodeFSStorageAdapter(storageDir) });
  const doors = fallAwareProbeDoors(readEngineFalls(storageDir), {
    probe: makeChildProcessDocLoadProbe(storageDir),
    recoverCleanTail: (verdict) => recoverCleanTail(storageDir, verdict),
    quarantineDoc: (verdict) => { quarantineDoc(storageDir, verdict); },
  });
  const assembly = await assembleVessel({
    repo,
    catalogHandle: repo.create<LarDoc>(emptyLarDoc()),
    waitHandle: async (url) => repo.find(url as never) as never,
    systemCanon: async () => ({}),
    loadGenesis: async () => ({ islandHandle: repo.create<LarDoc>(emptyLarDoc()), coreHash: "probe-core", bootstrap: { daemonUrl, personaPlanes: [] } }),
    tempStore: () => ({}) as never,
    ...doors,
  });
  return { repo, assembly };
}

let childStands = true;
try { resolveChildPath(); } catch { childStands = false; }
const d = childStands ? describe : describe.skip;

d("the document in flight at a fall stands held, or takes the torn path, at the next boot", () => {
  /** Rest a fall that names the daemon document in flight. */
  const restFallOn = (storageDir: string, daemonId: string): void => {
    const watch = createEngineWatch(() => new Date("2026-11-22T10:00:00.000Z"));
    watch.carrying(daemonId, () => watch.note(new WebAssembly.RuntimeError("unreachable"), "repo"));
    restEngineFall(storageDir, watch.fallen()!, "a".repeat(32));
  };
  const quarantined = (storageDir: string): boolean => readdirSync(storageDir).some((name) => name.startsWith("quarantine-torn-snapshots-"));

  test("H1 — a sound held document mounts pending and read-only, its bytes in place", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-fall-holds-back-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    restFallOn(storageDir, daemonId);

    const { repo, assembly } = await boot(storageDir, daemonUrl);
    const entry = assembly.mountManifest.entries.find((e) => e.documentId === daemonId);
    expect(entry?.status).toBe("pending");
    expect(entry?.reason).toMatch(/held/);
    expect(assembly.composite.hasWritableBag(DAEMON_BAG_ID)).toBe(false);
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(true);
    expect(quarantined(storageDir)).toBe(false);
    await repo.shutdown();
  }, 60_000);

  test("H2 — a torn held document still takes L3 or the quarantine", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-fall-holds-back-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    const torn = join(docStorePath(storageDir, daemonId), "incremental");
    mkdirSync(torn, { recursive: true });
    writeFileSync(join(torn, "zz-torn-tail"), Buffer.from([0x85, 0x6f, 0x4a, 0x83, 0x01, 0x02]));
    restFallOn(storageDir, daemonId);

    const { repo, assembly } = await boot(storageDir, daemonUrl);
    const entry = assembly.mountManifest.entries.find((e) => e.documentId === daemonId);
    expect(["promoted", "degraded"]).toContain(entry?.status);
    if (entry?.status === "degraded") {
      expect(assembly.composite.hasWritableBag(DAEMON_BAG_ID)).toBe(false);
      expect(quarantined(storageDir)).toBe(true);
    } else {
      expect(readdirSync(storageDir).some((name) => name.startsWith("quarantine-torn-tail-"))).toBe(true);
    }
    await repo.shutdown();
  }, 60_000);

  test("H1 CONTROL — with no fall resting, the same store mounts the daemon plane writable", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-fall-holds-back-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    const { repo, assembly } = await boot(storageDir, daemonUrl);
    expect(assembly.mountManifest.entries.find((e) => e.documentId === daemonId)?.status).toBe("mounted");
    expect(assembly.composite.hasWritableBag(DAEMON_BAG_ID)).toBe(true);
    await repo.shutdown();
  }, 60_000);
});
