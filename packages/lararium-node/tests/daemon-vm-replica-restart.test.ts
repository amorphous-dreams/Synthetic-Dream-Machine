/**
 * Daemon VM Repo persistence characterization.
 *
 * This test does not choose a production policy. It makes the current fork visible:
 *   1. current NodeFS worker storage can replay without a sync peer;
 *   2. a relay-only worker can restart while the vessel Repo is available;
 *   3. without either worker storage or a peer, the daemon worker refuses visibly;
 *   4. with the peer restored, a main-Repo tombstone wins and is observed by the worker.
 *
 * The probe reports a tiddler's presence, so an `ea` handshake alone cannot make this green.
 * No wall-clock value participates in the assertion; bounded waits only stop a hung fixture.
 */
import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { docStorePath } from "../src/store-integrity.js";
import { enumerateStoreDocs } from "../src/doctor.js";
import { Repo } from "@automerge/automerge-repo";
import { emptyLarDoc, type IslandMsg_Event, type LarDoc } from "@lararium/mesh";
import { openDaemonVm } from "../src/open-daemon-vm.js";

const PROBE = new URL("./fixtures/daemon-replay-probe.mjs", import.meta.url);
const NO_SYNC_PROBE = new URL("./fixtures/daemon-replay-probe-nosync.mjs", import.meta.url);
const MARKER = "lar:///ha.ka.ba/daemon-replay-probe/marker";

function probeUrl(noSync = false): URL {
  return new URL(noSync ? NO_SYNC_PROBE : PROBE);
}

function waitFor(
  events: IslandMsg_Event[],
  present: boolean,
  timeoutMs = 8_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      if (events.some((e) => e.listenable === "daemon:replay-probe" && e.payload.present === present)) {
        clearInterval(timer);
        resolve();
      }
    };
    const timer = setInterval(check, 20);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`probe did not observe present=${present}; events=${JSON.stringify(events)}`));
    }, timeoutMs).unref?.();
    check();
  });
}

async function openProbe(
  repo: Repo,
  daemonUrl: string,
  storageDir: string | undefined,
  noSync = false,
  storageResidency: "parent-attached" | "resident" = "resident",
): Promise<{ core: Awaited<ReturnType<typeof openDaemonVm>>; events: IslandMsg_Event[] }> {
  const events: IslandMsg_Event[] = [];
  const core = await openDaemonVm({
    repo,
    daemonUrl,
    coreHash: null,
    grants: { islandUrl: daemonUrl, wikiUrl: daemonUrl },
    ...(storageDir ? { storageDir } : {}),
    ...(storageDir ? { storageResidency } : {}),
    workerScriptUrl: probeUrl(noSync),
  });
  core.worker.listen((raw: unknown) => {
    const event = raw as Partial<IslandMsg_Event>;
    if (event.type === "event" && event.listenable === "daemon:replay-probe") events.push(event as IslandMsg_Event);
  });
  try {
    await core.workerEa;
  } catch (error) {
    core.dispose();
    throw error;
  }
  return { core, events };
}

describe("daemon VM Repo persistence fork", () => {
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

  test("refuses an explicit empty storage path instead of silently choosing memory-only", async () => {
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const daemon = repo.create<LarDoc>(emptyLarDoc());

    await expect(openDaemonVm({
      repo,
      daemonUrl: daemon.url,
      coreHash: null,
      grants: { islandUrl: daemon.url, wikiUrl: daemon.url },
      storageDir: "",
      workerScriptUrl: probeUrl(true),
    })).rejects.toThrow("storageDir must be omitted");
  });

  test("separates persisted replay, peer-backed restart, and missing-peer refusal", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "daemon-replay-"));
    roots.push(storageRoot);
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const daemon = repo.create<LarDoc>(emptyLarDoc());

    // Seed and observe a marker through the live sync peer. The worker then flushes this replica.
    const first = await openProbe(repo, daemon.url, storageRoot);
    cores.push(first.core);
    daemon.change((doc) => { doc.tiddlers[MARKER] = { title: MARKER, text: "persisted" }; });
    await waitFor(first.events, true);
    await first.core.shutdown(2_000);
    cores.splice(cores.indexOf(first.core), 1);

    // NO SYNC: the same worker storage alone must replay the marker. This is the deliberate
    // weakening: deleting the worker store below must remove this observation.
    const replay = await openProbe(repo, daemon.url, storageRoot, true);
    cores.push(replay.core);
    await waitFor(replay.events, true);
    expect(replay.events.at(-1)?.payload.sync).toBe(false);
    await replay.core.shutdown(2_000);
    cores.splice(cores.indexOf(replay.core), 1);

    // Relay-only control: with no worker storage, a live vessel Repo still supplies the marker.
    const relay = await openProbe(repo, daemon.url, undefined);
    cores.push(relay.core);
    await waitFor(relay.events, true);
    await relay.core.shutdown(2_000);
    cores.splice(cores.indexOf(relay.core), 1);

    // A main-Repo tombstone converges through the available peer, proving the harness sees a
    // document outcome rather than merely an ea/boot receipt.
    daemon.change((doc) => { delete doc.tiddlers[MARKER]; });
    const converged = await openProbe(repo, daemon.url, storageRoot);
    cores.push(converged.core);
    await waitFor(converged.events, false);
    await converged.core.shutdown(2_000);
    cores.splice(cores.indexOf(converged.core), 1);

    // Remove the worker's persisted Repo and remove the sync peer at the probe boundary. The
    // resulting fault is the explicit missing-peer refusal required before an ephemeral policy.
    rmSync(join(storageRoot, "daemon"), { recursive: true, force: true });
    const refused = await openProbe(repo, daemon.url, storageRoot, true).catch((error: unknown) => ({ error }));
    if (!("error" in refused)) throw new Error(`missing-peer probe unexpectedly booted: ${JSON.stringify(refused.events)}`);
  }, 45_000);

  test("parent-attached storage requires the live peer and never falls back to an empty doc", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "daemon-parent-attached-"));
    roots.push(storageRoot);
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const daemon = repo.create<LarDoc>(emptyLarDoc());

    const first = await openProbe(repo, daemon.url, storageRoot, false, "resident");
    cores.push(first.core);
    daemon.change((doc) => { doc.tiddlers[MARKER] = { title: MARKER, text: "resident" }; });
    await waitFor(first.events, true);
    await first.core.shutdown(2_000);
    cores.splice(cores.indexOf(first.core), 1);

    const refused = await openProbe(repo, daemon.url, storageRoot, true, "parent-attached")
      .then((result) => ({ result }), (error: unknown) => ({ error }));
    if ("result" in refused) throw new Error(`parent-attached unexpectedly booted: ${JSON.stringify(refused.result.events)}`);
    const { error: refusedError } = refused;
    expect(refusedError).toBeInstanceOf(Error);
    expect(String(refusedError)).toMatch(/document-not-resident/);
  }, 45_000);

  test("a corrupt resident store refuses with a named storage result", async () => {
    const storageRoot = mkdtempSync(join(tmpdir(), "daemon-corrupt-resident-"));
    roots.push(storageRoot);
    const repo = new Repo({ sharePolicy: async () => true });
    repos.push(repo);
    const daemon = repo.create<LarDoc>(emptyLarDoc());

    const first = await openProbe(repo, daemon.url, storageRoot, false, "resident");
    cores.push(first.core);
    daemon.change((doc) => { doc.tiddlers[MARKER] = { title: MARKER, text: "corrupt-me" }; });
    await waitFor(first.events, true);
    await first.core.shutdown(2_000);
    cores.splice(cores.indexOf(first.core), 1);

    const documentId = enumerateStoreDocs(join(storageRoot, "daemon"))[0];
    expect(documentId).toBeDefined();
    const store = docStorePath(join(storageRoot, "daemon"), documentId!);
    for (const kind of ["snapshot", "incremental"] as const) {
      if (!existsSync(join(store, kind))) continue;
      for (const name of readdirSync(join(store, kind), { withFileTypes: true })) {
        if (name.isFile()) writeFileSync(join(store, kind, name.name), Buffer.from("torn"));
      }
    }

    const refused = await openProbe(repo, daemon.url, storageRoot, true, "resident")
      .then((result) => ({ result }), (error: unknown) => ({ error }));
    if ("result" in refused) throw new Error(`corrupt resident unexpectedly booted: ${JSON.stringify(refused.result.events)}`);
    expect(refused.error).toBeInstanceOf(Error);
    expect(String(refused.error)).toMatch(/storage-corrupt/);
  }, 45_000);
});
