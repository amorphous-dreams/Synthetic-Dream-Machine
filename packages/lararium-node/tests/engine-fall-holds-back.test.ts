/**
 * THE DOCUMENT IN FLIGHT AT AN ENGINE FALL READS CONDEMNED AT THE NEXT BOOT, THROUGH THE COMPOSITION'S OWN PATH.
 *
 * A fall rests the document the Repo was handling (`EngineFall.inFlight`). The next boot hands that id to the keel's probe
 * doors (`fallAwareProbeDoors`), so the social mount reads it condemned: the clean-tail recovery (L3) runs, and where it cuts
 * nothing it holds nothing back, so the whole-document quarantine moves the bytes aside and a read-only stand-in mounts.
 * Quarantining ahead of the composition instead left the probe a store with no bytes, which reads "fresh, not a tear", and the
 * plane mounted writable over a new blank document: that life's writes landed in an orphan while health read fine.
 *
 *   H1  a fall naming the daemon document: the plane mounts degraded, read-only, the manifest says degraded, and the bytes
 *       rest in quarantine. Real doors: the child probe, the clean-tail child and the quarantine, over a real store.
 *   H1 CONTROL  with no fall resting, the same store mounts writable.
 *
 * No wasm runs out of anything: the fall rests by hand, as a fallen life leaves it.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
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

d("the document in flight at a fall reads condemned at the next boot", () => {
  test("H1 — a fall naming the daemon document mounts its plane degraded and read-only; its bytes rest in quarantine", async () => {
    const storageDir = (dir = mkdtempSync(join(tmpdir(), "lar-fall-holds-back-")));
    const daemonUrl = await storeWithDaemonDoc(storageDir);
    const daemonId = daemonUrl.replace(/^automerge:/, "");
    const watch = createEngineWatch(() => new Date("2026-11-22T10:00:00.000Z"));
    watch.carrying(daemonId, () => watch.note(new WebAssembly.RuntimeError("unreachable"), "repo"));
    restEngineFall(storageDir, watch.fallen()!, "a".repeat(32));

    const { repo, assembly } = await boot(storageDir, daemonUrl);
    const entry = assembly.mountManifest.entries.find((e) => e.documentId === daemonId);
    expect(entry?.status).toBe("degraded");
    expect(entry?.reason).toMatch(/engine fall/);
    expect(assembly.mountManifest.degraded).toBe(true);
    expect(assembly.composite.hasWritableBag(DAEMON_BAG_ID)).toBe(false);
    expect(existsSync(docStorePath(storageDir, daemonId))).toBe(false);
    expect(readdirSync(storageDir).some((name) => name.startsWith("quarantine-torn-snapshots-"))).toBe(true);
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
