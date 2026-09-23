/**
 * Daemon worker storage accounting witness.
 *
 * This is a read-only characterization of the existing NodeFS worker path. It
 * records what is present, where it is owned, and how the isolated load probe
 * reports it. It does not choose D-VR-A/B/C, compact history, or alter the
 * persistence path.
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdtempSync, readdirSync, statSync, rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type IslandMsg_Event, type LarDoc } from "@lararium/mesh";
import { openDaemonVm } from "../src/open-daemon-vm.js";
import { docStorePath } from "../src/store-integrity.js";
import { enumerateStoreDocs } from "../src/doctor.js";
import { probeDocLoad, type ProbeResult } from "../src/doc-load-probe.js";

const PROBE = new URL("./fixtures/daemon-replay-probe.mjs", import.meta.url);
// The fixture's named marker is the only content it reports; keeping the
// witness on that existing seam avoids adding a second production behavior.
const MARKER = "lar:///ha.ka.ba/daemon-replay-probe/marker";
const OWNER_ISLAND = "daemon-worker";

type ChunkKind = "snapshot" | "incremental";

interface StorageChunk {
  kind: ChunkKind;
  relativePath: string;
  bytes: number;
}

interface StorageAccounting {
  ownerIsland: typeof OWNER_ISLAND;
  storagePath: string;
  documentId: string;
  heads: readonly string[] | null;
  chunks: readonly StorageChunk[];
  bytes: number;
  replayMs: number;
  loadStatus: ProbeResult["status"];
}

function walkChunks(storagePath: string, root: string): StorageChunk[] {
  const chunks: StorageChunk[] = [];
  for (const kind of ["snapshot", "incremental"] as const) {
    const dir = join(storagePath, kind);
    let names: string[];
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names.sort()) {
      const path = join(dir, name);
      let stat;
      try { stat = statSync(path); } catch { continue; }
      if (!stat.isFile()) continue;
      chunks.push({ kind, relativePath: relative(root, path), bytes: stat.size });
    }
  }
  return chunks;
}

/** Read one existing document store; duration is a diagnostic observation only. */
async function accountDocument(storageRoot: string, documentId: string): Promise<StorageAccounting> {
  const workerRoot = join(storageRoot, "daemon");
  const storagePath = docStorePath(workerRoot, documentId);
  const started = performance.now();
  const probe = await probeDocLoad(workerRoot, documentId, { timeoutMs: 8_000 });
  const replayMs = performance.now() - started;
  const chunks = walkChunks(storagePath, workerRoot);
  return {
    ownerIsland: OWNER_ISLAND,
    storagePath,
    documentId,
    heads: probe.heads ?? null,
    chunks,
    bytes: chunks.reduce((sum, chunk) => sum + chunk.bytes, 0),
    replayMs,
    loadStatus: probe.status,
  };
}

function assertAccounting(report: Partial<StorageAccounting>, workerRoot: string): asserts report is StorageAccounting {
  if (report.ownerIsland !== OWNER_ISLAND) throw new Error("accounting owner island is absent or mismatched");
  if (!report.documentId) throw new Error("accounting document id is absent");
  if (report.storagePath !== docStorePath(workerRoot, report.documentId)) {
    throw new Error("accounting storage path is absent or mismatched");
  }
  if (!Array.isArray(report.chunks)) throw new Error("accounting chunks are absent");
  if (typeof report.bytes !== "number" || report.bytes < 1) throw new Error("accounting bytes are absent");
  if (typeof report.replayMs !== "number" || !Number.isFinite(report.replayMs)) {
    throw new Error("accounting replay duration is absent");
  }
}

function waitFor(events: IslandMsg_Event[], present: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (events.some((event) => event.listenable === "daemon:replay-probe" && event.payload.present === present)) {
        clearInterval(timer);
        resolve();
      }
    };
    const timer = setInterval(check, 20);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`accounting fixture did not observe present=${present}`));
    }, 8_000).unref?.();
    check();
  });
}

describe("daemon VM worker storage accounting", () => {
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

  test("accounts the existing worker store and rejects missing ownership/path evidence", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "daemon-accounting-"));
    roots.push(storageRoot);
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const events: IslandMsg_Event[] = [];
    const core = await openDaemonVm({
      repo,
      daemonUrl: daemon.url,
      coreHash: null,
      grants: { islandUrl: daemon.url, wikiUrl: daemon.url },
      storageDir: storageRoot,
      workerScriptUrl: PROBE,
    });
    cores.push(core);
    core.worker.listen((raw: unknown) => {
      const event = raw as Partial<IslandMsg_Event>;
      if (event.type === "event" && event.listenable === "daemon:replay-probe") events.push(event as IslandMsg_Event);
    });
    await core.workerEa;
    daemon.change((doc) => { doc.tiddlers[MARKER] = { title: MARKER, text: "accounted" }; });
    await waitFor(events, true);
    await core.shutdown(2_000);
    cores.splice(cores.indexOf(core), 1);

    const workerRoot = join(storageRoot, "daemon");
    const documentIds = enumerateStoreDocs(workerRoot);
    expect(documentIds.length).toBeGreaterThan(0);
    // NodeFS stores the URL's opaque document id (without the `automerge:`
    // scheme); retain that storage identity exactly in this diagnostic.
    const reports = await Promise.all(documentIds.map((id) => accountDocument(storageRoot, id)));
    const report = reports.find((entry) => entry.documentId === documentIds[0]);
    expect(report).toBeDefined();
    assertAccounting(report, workerRoot);
    expect(report.ownerIsland).toBe(OWNER_ISLAND);
    expect(report.storagePath).toBe(docStorePath(workerRoot, report.documentId));
    expect(report.chunks.length).toBeGreaterThan(0);
    expect(report.bytes).toBeGreaterThan(0);
    expect(report.replayMs).toBeGreaterThanOrEqual(0);
    expect(["ok", "load-error", "aborted", "timeout", "torn"]).toContain(report.loadStatus);
    // A bounded child abort is itself evidence: never invent heads after an
    // unsafe replay. A clean load must carry heads; every other verdict may
    // honestly carry the unavailable marker.
    if (report.loadStatus === "ok") expect(report.heads?.length).toBeGreaterThan(0);
    else expect(report.heads).toBeNull();
    expect(report.chunks.every((chunk) => chunk.kind === "snapshot" || chunk.kind === "incremental")).toBe(true);

    // Red-first weakening controls: a report that loses its owner or points at
    // another island must fail before an operator trusts its byte accounting.
    const withoutOwner = { ...report } as Partial<StorageAccounting>;
    delete withoutOwner.ownerIsland;
    expect(() => assertAccounting(withoutOwner, workerRoot)).toThrow(/owner island/);
    const wrongPath = { ...report, storagePath: join(storageRoot, "other-island", "wrong") };
    expect(() => assertAccounting(wrongPath, workerRoot)).toThrow(/storage path/);
  }, 45_000);
});
