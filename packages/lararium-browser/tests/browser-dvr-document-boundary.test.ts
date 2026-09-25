import { afterEach, describe, expect, test } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { emptyLarDoc, type LarDoc, type IslandMsg_Event } from "@lararium/mesh";
import { openBrowserDaemonVm, ownedDaemonDbName } from "../src/open-browser-daemon-vm.js";

const FIXTURE = new URL("./fixtures/browser-dvr-document-boundary.mjs", import.meta.url);
const O_MARK = "lar:///ha.ka.ba/dvr-browser/ordinary";

describe("browser D-VR-C owned crossing", () => {
  let repo: Repo | null = null;
  let core: Awaited<ReturnType<typeof openBrowserDaemonVm>> | null = null;
  const dbNames: string[] = [];

  afterEach(async () => {
    try { await core?.shutdown(2_000); } catch { core?.dispose(); }
    await repo?.shutdown();
    core = null;
    repo = null;
    for (const dbName of dbNames.splice(0)) indexedDB.deleteDatabase(dbName);
  });

  test("keeps O on primary, refuses O on owned crossing, and reopens P from IDB", async () => {
    repo = new Repo({ sharePolicy: async () => true });
    const ordinary = repo.create<LarDoc>(emptyLarDoc());
    ordinary.change((doc) => { doc.tiddlers[O_MARK] = { title: O_MARK, text: "parent-attached" }; });
    const daemon = repo.create<LarDoc>(emptyLarDoc());
    const dbName = ownedDaemonDbName(daemon.url);
    dbNames.push(dbName);
    core = await openBrowserDaemonVm({
      repo,
      daemonUrl: daemon.url,
      coreHash: null,
      recipe: { wikiSlug: "daemon" },
      grants: { islandUrl: ordinary.url, wikiUrl: daemon.url },
      ownedDocument: true,
      workerScriptUrl: FIXTURE,
    });
    const events: IslandMsg_Event[] = [];
    core.worker.listen((raw) => {
      const event = raw as Partial<IslandMsg_Event>;
      if (event.type === "event" && event.listenable === "dvr:browser") events.push(event as IslandMsg_Event);
    });
    await core.workerEa;
    const witness = await new Promise<IslandMsg_Event>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("browser D-VR witness timeout")), 8_000);
      const poll = setInterval(() => {
        const hit = events[0];
        if (hit) { clearInterval(poll); clearTimeout(timer); resolve(hit); }
      }, 20);
    });
    expect(witness.payload.ordinaryPresent).toBe(true);
    expect(witness.payload.ordinaryOwnedRefused).toBe(true);
    await core.shutdown(2_000);
    core = null;

    const offline = new Repo({ storage: new IndexedDBStorageAdapter(dbName) });
    try {
      const recovered = await offline.find<LarDoc>(String(witness.payload.pinnedUrl));
      await recovered.whenReady();
      expect(recovered.doc()?.tiddlers?.["lar:///ha.ka.ba/dvr-browser/pinned"]).toBeDefined();
      await expect(offline.find<LarDoc>(ordinary.url)).rejects.toThrow();
    } finally {
      await offline.shutdown();
    }
  }, 45_000);
});
