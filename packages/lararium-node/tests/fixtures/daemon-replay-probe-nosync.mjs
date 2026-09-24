import { parentPort } from "node:worker_threads";
import { Repo } from "@automerge/automerge-repo";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

const MARKER = "lar:///ha.ka.ba/daemon-replay-probe/marker";
let repo = null;
let wikiUri = null;
function event(present) {
  parentPort.postMessage({ schema_version: 1, type: "event", wikiUri, listenable: "daemon:replay-probe", payload: { present, sync: false } });
}
parentPort.on("message", (msg) => {
  if (!msg || msg.schema_version !== 1) return;
  if (msg.type === "manifest") {
    wikiUri = msg.wikiUri;
    const opts = { sharePolicy: async () => true };
    if (msg.storage?.type === "nodefs") opts.storage = new NodeFSStorageAdapter(msg.storage.dir);
    repo = new Repo(opts);
    void repo.findWithProgress(msg.grants.wikiUrl).whenReady().then((handle) => {
      const report = () => event(Boolean(handle.doc()?.tiddlers?.[MARKER]));
      handle.on("change", report);
      report();
      parentPort.postMessage({ schema_version: 1, type: "ea", wikiUri });
    }, (error) => parentPort.postMessage({ schema_version: 1, type: "fault", wikiUri, error: String(error) }));
  } else if (msg.type === "teardown") {
    void (async () => { try { await repo?.flush(); } catch {} parentPort.postMessage({ schema_version: 1, type: "teardown:ack" }); })();
  }
});
