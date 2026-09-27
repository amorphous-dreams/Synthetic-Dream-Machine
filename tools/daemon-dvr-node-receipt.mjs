/**
 * Container probe for the bounded Node D-VR-C deployment receipt.
 *
 * P is the daemon worker's explicitly owned document. O is an ordinary
 * parent-attached document. The receipt is emitted only after the worker has
 * flushed, the parent Repo has gone away, and a fresh offline Repo reopens P
 * from the owned physical store while refusing O.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

// The Compose image keeps workspace dependencies under the Node package lane.
// Resolve them from that package even though this harness is authored in tools/.
const packageRequire = createRequire(new URL("../packages/lararium-node/package.json", import.meta.url));
const { Repo } = packageRequire("@automerge/automerge-repo");
const { NodeFSStorageAdapter } = packageRequire("@automerge/automerge-repo-storage-nodefs");
const { emptyLarDoc } = await import("../packages/lararium-mesh/dist/index.js");
// This is the production Node host source module. The fixture below supplies
// only the worker's observable P/O crossing; it does not replace the
// production host or storage composition. The Docker image's `tsx` loader
// executes this same source used by the Node package tests until the unrelated
// workspace mesh build is green again.
const { openDaemonVm } = await import("../packages/lararium-node/src/open-daemon-vm.ts");

const PROBE = new URL("../packages/lararium-node/tests/fixtures/daemon-dvr-document-boundary.mjs", import.meta.url);
const ORDINARY_MARKER = "lar:///ha.ka.ba/dvr-boundary/ordinary";
const PINNED_MARKER = "lar:///ha.ka.ba/dvr-boundary/pinned";
const RECEIPT_MARKER = "DVR_NODE_RECEIPT:";
const BOUND_MS = Number(process.env.DVR_BOUND_MS || 15_000);

function bounded(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} exceeded bounded wait`)), BOUND_MS).unref?.()),
  ]);
}

function documentId(url) {
  if (!url.startsWith("automerge:")) throw new Error(`unexpected Automerge URL: ${url}`);
  return url.slice("automerge:".length);
}

function filesUnderDocument(storageRoot, id) {
  const root = join(storageRoot, id.slice(0, 2), id.slice(2));
  const files = [];
  const walk = (path) => {
    if (!existsSync(path)) return;
    const stat = statSync(path);
    if (stat.isFile()) { files.push(path); return; }
    if (!stat.isDirectory()) return;
    for (const name of readdirSync(path)) walk(join(path, name));
  };
  walk(root);
  return files;
}

function waitForBoundary(events, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    let timer;
    const check = () => {
      const event = events.find((candidate) => candidate?.listenable === "daemon:dvr-document-boundary");
      if (event) { clearInterval(timer); resolve(event); }
    };
    timer = setInterval(check, 25);
    setTimeout(() => {
      clearInterval(timer);
      reject(new Error(`D-VR deployment boundary did not return; events=${JSON.stringify(events)}`));
    }, timeoutMs).unref?.();
    check();
  });
}

async function run() {
  const storageRoot = process.env.DVR_STORAGE_ROOT || "/run/dvr";
  const repo = new Repo({ sharePolicy: async () => true });
  const ordinary = repo.create(emptyLarDoc());
  ordinary.change((doc) => {
    doc.tiddlers[ORDINARY_MARKER] = { title: ORDINARY_MARKER, text: "parent-attached" };
  });
  const daemon = repo.create(emptyLarDoc());
  const events = [];
  const core = await openDaemonVm({
    repo,
    daemonUrl: daemon.url,
    coreHash: null,
    grants: { islandUrl: ordinary.url, wikiUrl: daemon.url },
    storageDir: storageRoot,
    ownedDocument: true,
    workerScriptUrl: PROBE,
  });
  core.worker.listen((raw) => {
    if (raw?.type === "event" && raw.listenable === "daemon:dvr-document-boundary") events.push(raw);
  });

  await core.workerEa;
  const witness = await waitForBoundary(events);
  if (!witness.payload?.ordinaryOwnedRefused) throw new Error("owned crossing did not refuse ordinary O");
  if (!witness.payload?.ordinaryPresent) throw new Error("parent did not present ordinary O");
  if (!witness.payload?.pinnedPresent) throw new Error("worker did not author owned P");

  await core.shutdown(5_000);
  await repo.shutdown();

  const pinnedId = documentId(String(witness.payload.pinnedUrl));
  const ordinaryId = documentId(ordinary.url);
  const ownedRoot = join(storageRoot, "daemon-owned");
  const pinnedFiles = filesUnderDocument(ownedRoot, pinnedId);
  const ordinaryFiles = filesUnderDocument(ownedRoot, ordinaryId);
  if (pinnedFiles.length === 0) throw new Error("owned P has no physical records");
  if (ordinaryFiles.length !== 0) throw new Error("ordinary O leaked into owned physical scope");

  const offline = new Repo({ storage: new NodeFSStorageAdapter(ownedRoot) });
  let recovered;
  let ordinaryRefused = false;
  try {
    recovered = await bounded(offline.find(`automerge:${pinnedId}`), "owned P lookup");
    await bounded(recovered.whenReady(), "owned P recovery");
    ordinaryRefused = await bounded(offline.find(`automerge:${ordinaryId}`), "ordinary O refusal")
      .then(() => false, () => true);
  } finally {
    await offline.shutdown();
  }
  if (!recovered?.doc()?.tiddlers?.[PINNED_MARKER]) throw new Error("owned P did not recover after parent shutdown");
  if (!ordinaryRefused) throw new Error("offline owned Repo accepted ordinary O");

  const receipt = {
    schema: "lararium-dvr-node-owned/v1",
    contract: "D-VR-C",
    documents: {
      owned: { role: "P", url: String(witness.payload.pinnedUrl), id: pinnedId },
      ordinary: { role: "O", url: ordinary.url, id: ordinaryId },
    },
    physical: {
      ownedRoot,
      ownedFiles: pinnedFiles,
      ordinaryFiles,
      separate: true,
    },
    recovery: { parentAbsent: true, ownedRecovered: true, ordinaryRefused },
    implementation: {
      module: "packages/lararium-node/src/open-daemon-vm.ts",
      role: "production-node-host",
      fixtureRole: "worker-crossing-observer-only",
    },
    witness: { ordinaryPresent: true, ordinaryOwnedRefused: true, pinnedPresent: true },
  };
  console.log(`${RECEIPT_MARKER}${JSON.stringify(receipt)}`);
}

run().catch((error) => {
  console.error(`DVR_NODE_RECEIPT_ERROR:${error instanceof Error ? error.stack || error.message : String(error)}`);
  process.exitCode = 1;
});
