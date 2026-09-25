/**
 * D-VR-C physical document-custody probe.
 *
 * P is a worker-authored document. O is an ordinary parent-attached document
 * observed by the same worker. The intended contract is that the flushed
 * physical store contains P-owned records and zero O-owned records. The first
 * test is intentionally red against today's one-Repo/one-adapter composition;
 * it is the red-first gate for the future bounded composition.
 *
 * Bag `wela`/`anu` and operator bag pins are deliberately absent here. This
 * test measures document-prefix bytes on disk, not vessel hot-memory state.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";
import { emptyLarDoc, type IslandMsg_Event, type LarDoc } from "@lararium/mesh";
import { openDaemonVm } from "../src/open-daemon-vm.js";
import { docStorePath } from "../src/store-integrity.js";

const PROBE = new URL("./fixtures/daemon-dvr-document-boundary.mjs", import.meta.url);
const ORDINARY_MARKER = "lar:///ha.ka.ba/dvr-boundary/ordinary";

function documentId(url: string): string {
  const prefix = "automerge:";
  if (!url.startsWith(prefix)) throw new Error(`unexpected Automerge URL: ${url}`);
  return url.slice(prefix.length);
}

/**
 * Enumerate every physical file under one exact document prefix. This covers
 * snapshot, incremental, sync-state, and any future document-owned key kind;
 * repository metadata such as storage-adapter-id is outside this path.
 */
function filesUnderDocument(storageRoot: string, id: string): string[] {
  const root = docStorePath(storageRoot, id);
  const files: string[] = [];
  const walk = (path: string): void => {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isFile()) {
      files.push(path);
      return;
    }
    if (!stat.isDirectory()) return;
    for (const name of readdirSync(path)) walk(join(path, name));
  };
  walk(root);
  return files;
}

function waitForBoundary(events: IslandMsg_Event[], timeoutMs = 8_000): Promise<IslandMsg_Event> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const event = events.find((candidate) => candidate.listenable === "daemon:dvr-document-boundary");
      if (event) {
        clearInterval(timer);
        resolve(event);
      }
    };
    const timer = setInterval(check, 20);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`D-VR boundary probe did not return; events=${JSON.stringify(events)}`));
    }, timeoutMs).unref?.();
    check();
  });
}

describe("D-VR-C document-owned physical boundary", () => {
  const roots: string[] = [];
  const repos: Repo[] = [];
  const cores: Array<Awaited<ReturnType<typeof openDaemonVm>>> = [];

  afterEach(async () => {
    for (const core of cores.splice(0)) {
      try { await core.shutdown(2_000); } catch { core.dispose(); }
    }
    for (const repo of repos.splice(0)) await repo.shutdown();
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  async function runProbe(owned = false): Promise<{ workerRoot: string; pinnedId: string; ordinaryId: string; pinnedFiles: string[]; ordinaryFiles: string[]; ordinaryOwnedRefused: boolean }> {
    const storageRoot = mkdtempSync(join(tmpdir(), "daemon-dvr-document-boundary-"));
    roots.push(storageRoot);
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const ordinary = repo.create<LarDoc>(emptyLarDoc());
    ordinary.change((doc) => {
      doc.tiddlers[ORDINARY_MARKER] = { title: ORDINARY_MARKER, text: "parent-attached" };
    });
    const events: IslandMsg_Event[] = [];
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const core = await openDaemonVm({
      repo,
      daemonUrl: daemon.url,
      coreHash: null,
      grants: { islandUrl: ordinary.url, wikiUrl: daemon.url },
      storageDir: storageRoot,
      ...(owned ? { ownedDocument: true } : {}),
      workerScriptUrl: PROBE,
    });
    cores.push(core);
    core.worker.listen((raw: unknown) => {
      const event = raw as Partial<IslandMsg_Event>;
      if (event.type === "event" && event.listenable === "daemon:dvr-document-boundary") {
        events.push(event as IslandMsg_Event);
      }
    });
    await core.workerEa;
    const witness = await waitForBoundary(events);
    expect(witness.payload.pinnedPresent).toBe(true);
    expect(witness.payload.ordinaryPresent).toBe(true);
    await core.shutdown(2_000);
    cores.splice(cores.indexOf(core), 1);
    const workerRoot = join(storageRoot, owned ? "daemon-owned" : "daemon");
    const pinnedId = documentId(String(witness.payload.pinnedUrl));
    const ordinaryId = documentId(ordinary.url);
    return {
      workerRoot,
      pinnedId,
      ordinaryId,
      pinnedFiles: filesUnderDocument(workerRoot, pinnedId),
      ordinaryFiles: filesUnderDocument(workerRoot, ordinaryId),
      ordinaryOwnedRefused: Boolean(witness.payload.ordinaryOwnedRefused),
    };
  }

  test.fails("P owns physical records while ordinary parent-attached O owns none", async () => {
    const result = await runProbe();
    expect(result.pinnedFiles.length).toBeGreaterThan(0);
    // This is the intended contract and is expected to fail until a
    // document-scoped physical storage composition exists.
    expect(result.ordinaryFiles).toEqual([]);
    expect(result.ordinaryOwnedRefused).toBe(true);
  }, 45_000);

  test("weakening control: today's adapter persists every observed document", async () => {
    const result = await runProbe();
    expect(result.pinnedFiles.length).toBeGreaterThan(0);
    expect(result.ordinaryFiles.length).toBeGreaterThan(0);
  }, 45_000);

  test("owned crossing keeps ordinary O on the primary relay and persists daemon P only", async () => {
    const result = await runProbe(true);
    expect(result.pinnedFiles.length).toBeGreaterThan(0);
    expect(result.ordinaryFiles).toEqual([]);
    expect(result.ordinaryOwnedRefused).toBe(true);
  }, 45_000);

  test("owned crossing refuses O and reopens P without the parent", async () => {
    const result = await runProbe(true);
    // The fixture's event is the direct crossing refusal witness; the physical
    // store assertion below is the restart witness.
    expect(result.pinnedFiles.length).toBeGreaterThan(0);
    expect(result.ordinaryFiles).toEqual([]);
    const offline = new Repo({ storage: new NodeFSStorageAdapter(result.workerRoot) });
    try {
      const pinned = await offline.find<LarDoc>(`automerge:${result.pinnedId}`);
      await pinned.whenReady();
      await expect(offline.find<LarDoc>(`automerge:${result.ordinaryId}`)).rejects.toThrow();
    } finally {
      await offline.shutdown();
    }
  }, 45_000);
});
