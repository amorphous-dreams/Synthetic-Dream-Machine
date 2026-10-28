/** A page lease crosses a real worker, echoes one write, and keeps a second binding outside. */
import { describe, expect, test } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Repo, type PeerId } from "@automerge/automerge-repo";
import { automergeLoad, ENGINE_CORE_ID, emptyLarDoc, storedLarRecord, wikiBagUri, wikiUri, type LarDoc, type PortIslandToVesselMsg } from "@lararium/mesh";
import { resolveSurfaceRecipe } from "../../lararium-mesh/src/surface-recipe.js";
import { casDirForStorage, readCasBlobFromFs } from "../src/node-cas.js";
import { VesselIslandPool } from "../src/vessel-island-pool.js";
import { setupCasFromGenesis } from "./cas-test-setup.js";
import { GENESIS_SEED, loadGenesisBytes } from "./genesis-test-source.js";

const ISLAND_JS = new URL("../dist/src/node-wiki-island.js", import.meta.url);
const missing = !existsSync(GENESIS_SEED) ? "genesis/seed.json absent — build genesis" :
  !existsSync(fileURLToPath(ISLAND_JS)) ? "dist/src/node-wiki-island.js absent — build node" : null;

describe("page port on the real island kernel", () => {
  test("write echoes once before written; a second binding cannot close its port", async () => {
    if (missing) throw new Error(missing);
    const genesisBytes = loadGenesisBytes();
    const genesisDoc = automergeLoad<LarDoc>(genesisBytes);
    const coreHash = genesisDoc.blobs?.[ENGINE_CORE_ID]?.sha256 as string;
    const cas = setupCasFromGenesis(genesisDoc);
    const repo = new Repo({ peerId: "port-page-owner" as PeerId });
    const oracle = repo.import<LarDoc>(genesisBytes);
    const make = (title: string) => {
      const handle = repo.create<LarDoc>(emptyLarDoc());
      handle.change((doc) => { doc.tiddlers[title] = storedLarRecord(title, { text: title }, "test"); });
      return handle;
    };
    const catalog = make("catalog"), canon = make("Canon"), working = make("Working"), plane = make("Plane");
    catalog.change((doc) => { doc.tiddlers[wikiBagUri("port-page")] = storedLarRecord(wikiBagUri("port-page"), { text: canon.url }, "test"); });
    const verdict = await resolveSurfaceRecipe({
      wikiSlug: "port-page",
      planes: { read: (which, title) => (which === "catalog" ? catalog : oracle).doc()?.tiddlers?.[title], oracleDocument: oracle.url },
      face: { facePlaneId: plane.url, planes: [{ name: "lar:///ha.ka.ba/bags/persona-synthetic", document: plane.url }], slotDocument: (_wiki, kind) => kind === "working" ? working.url : null },
      mayRead: () => true,
      plugins: { coreHash, islandBlobs: oracle.doc()?.blobs, lookup: () => undefined, readBytes: (cid) => readCasBlobFromFs(cid, casDirForStorage(cas.storageDir)) },
      profile: "face",
    });
    if (!verdict.ok) throw new Error(`${verdict.refusal}: ${verdict.detail}`);
    let edits = false;
    const received: PortIslandToVesselMsg[] = [];
    const waiting: Array<() => void> = [];
    const pool = new VesselIslandPool({
      workerScriptUrl: ISLAND_JS, mainRepo: repo, storageRoot: cas.storageDir,
      resolvePluginCids: async () => ({ ok: true as const, pluginCids: cas.pluginCids }),
      portPolicy: (binding) => ({ faceId: "face:port-page", actor: binding, edits, bags: [], admin: false }),
      onPortMessage: (_binding, _key, msg) => { received.push(msg); waiting.shift()?.(); },
    });
    const until = async (predicate: () => boolean): Promise<void> => {
      for (let n = 0; n < 32 && !predicate(); n++) await new Promise<void>((resolve) => waiting.push(resolve));
      expect(predicate()).toBe(true);
    };
    try {
      const session = { sessionId: "port-page-session", generation: 0 };
      const key = await pool.mountSurface({ sessionId: "port-page-session", generation: 0, surfaceId: "page", recipe: verdict.recipe });
      const open = { type: "port:open", portId: "p", wikiUri: wikiUri("port-page"), actor: "A", width: "full", edits: true, maxRecordBytes: 8_388_608, maxBatchBytes: 16_777_216 };
      expect(pool.placePort(key, "A", open, session)).toEqual({ ok: true });
      await until(() => received.some((msg) => msg.type === "port:snapshot"));
      expect(pool.placePort(key, "B", { type: "port:close", portId: "p" }, session)).toEqual({ ok: false, reason: "port-owned" });
      expect(pool.placePort(key, "A", { type: "port:write", portId: "p", txId: "tx-denied", records: [{ title: "Denied", fields: { text: "no" } }] }, session)).toEqual({ ok: true });
      await until(() => received.some((msg) => msg.type === "port:written" && msg.txId === "tx-denied"));
      expect(received.find((msg) => msg.type === "port:written" && msg.txId === "tx-denied")).toMatchObject({ reason: "edits-not-granted" });
      edits = true;
      expect(pool.placePort(key, "A", { type: "port:write", portId: "p", txId: "tx-1", records: [{ title: "First", fields: { text: "one" } }] }, session)).toEqual({ ok: true });
      await until(() => received.some((msg) => msg.type === "port:written" && msg.txId === "tx-1"));
      expect(received.filter((msg) => msg.type === "port:changes" && msg.entries.some((entry) => entry.causedBy.includes("tx-1")))).toHaveLength(1);
      expect(received.findIndex((msg) => msg.type === "port:changes" && msg.entries.some((entry) => entry.causedBy.includes("tx-1"))))
        .toBeLessThan(received.findIndex((msg) => msg.type === "port:written" && msg.txId === "tx-1"));
      expect(received.filter((msg) => msg.type === "port:written" && msg.txId === "tx-1")).toHaveLength(1);
      expect(pool.placePort(key, "A", { type: "port:write", portId: "p", txId: "tx-2", records: [{ title: "Second", fields: { text: "two" } }] }, session)).toEqual({ ok: true });
      await until(() => received.some((msg) => msg.type === "port:written" && msg.txId === "tx-2"));
      expect(received.filter((msg) => msg.type === "port:changes" && msg.entries.some((entry) => entry.causedBy.includes("tx-2")))).toHaveLength(1);
      expect(received.filter((msg) => msg.type === "port:changes" && msg.entries.some((entry) => entry.causedBy.includes("tx-1")))).toHaveLength(1);
      expect(received.filter((msg) => msg.type === "port:written" && msg.txId === "tx-1")).toHaveLength(1);
    } finally {
      await pool.disposeAll(); await repo.shutdown(); cas.cleanup();
    }
  }, 60_000);
});
