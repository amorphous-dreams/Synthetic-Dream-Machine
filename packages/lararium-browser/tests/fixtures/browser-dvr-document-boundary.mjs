import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";

const O_MARK = "lar:///ha.ka.ba/dvr-browser/ordinary";
const P_MARK = "lar:///ha.ka.ba/dvr-browser/pinned";
let primary = null;
let owned = null;
let wikiUri = "";

const emit = (payload) => self.postMessage({ schema_version: 1, type: "event", wikiUri, listenable: "dvr:browser", payload });

self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || msg.schema_version !== 1) return;
  if (msg.type === "manifest") {
    wikiUri = msg.wikiUri;
    primary = new Repo({ network: [new MessageChannelNetworkAdapter(msg.syncPort)], sharePolicy: async () => true });
    void (async () => {
      const ordinary = await primary.find(msg.grants.islandUrl);
      const ownedId = msg.ownedDocument.documentUrl;
      owned = new Repo({
        network: [new MessageChannelNetworkAdapter(msg.ownedDocument.syncPort)],
        storage: new IndexedDBStorageAdapter(msg.ownedDocument.storage.dbName),
        shareConfig: {
          announce: async (_peer, id) => id === ownedId.replace("automerge:", ""),
          access: async (_peer, id) => id === ownedId.replace("automerge:", ""),
        },
      });
      const daemon = await owned.find(ownedId);
      let ordinaryOwnedRefused = true;
      try { await owned.find(msg.grants.islandUrl); ordinaryOwnedRefused = false; } catch { /* expected */ }
      daemon.change((doc) => { doc.tiddlers[P_MARK] = { title: P_MARK, text: "worker-owned" }; });
      await primary.flush();
      await owned.flush();
      emit({ pinnedUrl: daemon.url, ordinaryUrl: ordinary.url, ordinaryOwnedRefused, ordinaryPresent: Boolean(ordinary.doc()?.tiddlers?.[O_MARK]) });
      self.postMessage({ schema_version: 1, type: "ea", wikiUri });
    })().catch((error) => self.postMessage({ schema_version: 1, type: "fault", wikiUri, error: String(error) }));
    return;
  }
  if (msg.type === "teardown") {
    void (async () => { await primary?.flush(); await owned?.flush(); self.postMessage({ schema_version: 1, type: "teardown:ack" }); })();
  }
});
self.postMessage({ schema_version: 1, type: "ready" });
