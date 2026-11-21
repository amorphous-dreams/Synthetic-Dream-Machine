// opened-store — read every document a STOPPED vessel's store rests, opened through the vessel itself.
//
// A face's documents rest SEALED (lar:///ha.ka.ba/lararium/mesh/sealed-store): a plain Repo over the raw rest loads a
// sealed pointer and no change chunk. This reader stands the floor in the calling process, seats custody over the
// root's own homes, opens the node key and the vessel's face under the published TEST route, composes the vessel over
// the root's own store with that route as its boot ward, and reads every document through the vessel's Repo. It then
// tears the composition down, releases the floor and unseats every seat it took, so a caller's process ends clean.
//
// One reader for every suite: custody-door K1 (node:test) and the root e2e set (vitest) both import it. The root
// must hold no live daemon (the floor claims the store), and its custody must open under TEST_PASSPHRASE.
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { TEST_PASSPHRASE } from "./test-custody-route.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const nodeDist = (file) => pathToFileURL(join(repo, "packages/lararium-node/dist/src", file)).href;

/** The built node package, as both callers load it. */
export const loadNode = () => import(nodeDist("index.js"));

/** The documents that rest SEALED: a plain Repo over the raw rest cannot load them (a sealed pointer, no change chunk). */
export async function restsSealed(node, storageDir) {
  const { Repo } = await import(pathToFileURL(join(repo, "packages/lararium-node/node_modules/@automerge/automerge-repo/dist/index.js")).href);
  const { DurableNodeFSStorageAdapter } = await import(nodeDist("durable-storage-adapter.js"));
  const store = new Repo({ storage: new DurableNodeFSStorageAdapter(storageDir) });
  const sealed = [];
  try {
    for (const id of node.enumerateStoreDocs(storageDir)) {
      try { const h = await store.find(`automerge:${id}`); h.doc(); } catch { sealed.push(id); }
    }
  } finally { await store.shutdown(); }
  return sealed;
}

/**
 * Every document `root`'s stopped store rests, opened through the vessel: `{ docs: [{ id, doc }], sealedIds, opened }`,
 * where `opened` counts the sealed documents the vessel read. A sealed document that refuses to open throws, by name.
 */
export async function openedStored(root, { node: given, wikiId = "lares", hostId = "opened-store-reader" } = {}) {
  const node = given ?? await loadNode();
  const prior = process.env.LAR_ROOT;
  process.env.LAR_ROOT = root;
  try {
    const storageDir = node.larDataDir();
    const sealedIds = await restsSealed(node, storageDir);
    const floor = await node.standNodeFloor(storageDir);
    let vessel = null;
    try {
      const homes = node.vesselCustodyHomes();
      const holder = node.makeCustodyHolder({ io: new node.FsCustodyIo(homes), homes });
      node.seatCustody(holder);
      const route = [{ kind: "passphrase", passphrase: TEST_PASSPHRASE }];
      const key = await holder.unlock(route);
      if (key.reading !== "opens") throw new Error(`opened-store: the test route opens no node key (${key.reading})`);
      const faces = (await holder.unlockFaces(route)).filter((r) => r.reading === "opens").map((r) => r.ordinal);
      if (faces.length === 0) throw new Error("opened-store: the test route opens no face");
      node.setMountedFace(faces[0]);
      if (!node.sovereignStands()) throw new Error("opened-store: the reader composes no sovereign vessel");
      // The unlock's own route rides the composition as its boot ward, as the custody door's recomposition hands it.
      node.seatWardGatherer(async () => route);
      vessel = await node.openNodeVessel({ hostId, floor, bootWard: node.wardCredential(route), wikiId, storageDir, genesisDir: join(root, "genesis"), rootDir: root, wss: new EventEmitter() });
      await vessel.daemon.workerEa;
      const docs = [];
      let opened = 0;
      for (const id of node.enumerateStoreDocs(storageDir)) {
        const h = await vessel.repo.find(`automerge:${id}`);
        docs.push({ id, doc: h.doc() });
        if (sealedIds.includes(id)) opened += 1;
      }
      return { docs, sealedIds, opened };
    } finally {
      if (vessel !== null) await vessel.teardown();
      await floor.release();
      node.seatCustody(null);
      node.seatWardGatherer(null);
      node.setMountedFace(undefined);
    }
  } finally {
    if (prior === undefined) delete process.env.LAR_ROOT; else process.env.LAR_ROOT = prior;
  }
}

/** A document as plain JSON: each Automerge string wrapper reads as its string. */
const plain = (doc) => JSON.parse(JSON.stringify(doc, (_k, v) => (v !== null && typeof v === "object" && typeof v.val === "string" && Object.keys(v).length === 1 ? v.val : v)));

/**
 * The same reading in a process of its own: `node tools/opened-store.mjs <root> <out.json>` writes `{ docs, sealedIds,
 * opened }` (each document as plain JSON) and exits. A vitest caller reads through this child: the reader seats
 * process-wide custody, a mounted face and a ward gatherer, and the store's holder, and a child that exits takes every
 * one of them with it, so nothing the reading took outlives it inside the test worker.
 */
export async function openedStoredApart(root) {
  const { spawn } = await import("node:child_process");
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "opened-store-"));
  const out = join(dir, "read.json");
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), root, out], { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, LAR_ROOT: root } });
    let err = "";
    child.stderr?.on("data", (d) => { err += String(d); });
    const code = await new Promise((resolve) => child.once("exit", resolve));
    if (code !== 0) throw new Error(`opened-store: the reader exited ${code}: ${err.slice(-2000)}`);
    return JSON.parse(readFileSync(out, "utf8"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [root, out] = process.argv.slice(2);
  const { writeFileSync } = await import("node:fs");
  const read = await openedStored(root);
  writeFileSync(out, JSON.stringify({ docs: read.docs.map(({ id, doc }) => ({ id, doc: plain(doc) })), sealedIds: read.sealedIds, opened: read.opened }));
  process.exit(0);
}
