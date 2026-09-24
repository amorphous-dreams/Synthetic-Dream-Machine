/**
 * D-VR-C red-first boundary probe.
 *
 * This fixture deliberately creates one worker-authored document (P) while it
 * resolves one ordinary parent-attached document (O). The host test inspects
 * the physical NodeFS store after the worker flushes. The current one-Repo /
 * one-adapter composition is expected to persist both documents; that failure
 * is the evidence that a document-owned storage boundary is still missing.
 */
import { parentPort } from "node:worker_threads";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

const ORDINARY_MARKER = "lar:///ha.ka.ba/dvr-boundary/ordinary";
const PINNED_MARKER = "lar:///ha.ka.ba/dvr-boundary/pinned";

let repo = null;
let wikiUri = null;

function event(payload) {
  parentPort.postMessage({
    schema_version: 1,
    type: "event",
    wikiUri,
    listenable: "daemon:dvr-document-boundary",
    payload,
  });
}

async function open(msg) {
  wikiUri = msg.wikiUri;
  const opts = {
    sharePolicy: async () => true,
    network: [new MessageChannelNetworkAdapter(msg.syncPort)],
  };
  if (msg.storage?.type === "nodefs") {
    opts.storage = new NodeFSStorageAdapter(msg.storage.dir);
  }
  repo = new Repo(opts);

  try {
    const ordinary = await repo.findWithProgress(msg.grants.wikiUrl).whenReady();
    if (!ordinary.doc()?.tiddlers?.[ORDINARY_MARKER]) {
      throw new Error("ordinary parent-attached document did not arrive");
    }

    // P is created by the worker. Its URL and records are intentionally
    // private to this worker fixture; the parent receives only the witness.
    const pinned = repo.create({
      tiddlers: {
        [PINNED_MARKER]: { title: PINNED_MARKER, text: "worker-authored" },
      },
    });
    await repo.flush();
    event({
      pinnedUrl: pinned.url,
      ordinaryUrl: ordinary.url,
      pinnedPresent: Boolean(pinned.doc()?.tiddlers?.[PINNED_MARKER]),
      ordinaryPresent: Boolean(ordinary.doc()?.tiddlers?.[ORDINARY_MARKER]),
    });
    parentPort.postMessage({ schema_version: 1, type: "ea", wikiUri });
  } catch (error) {
    parentPort.postMessage({ schema_version: 1, type: "fault", wikiUri, error: String(error) });
  }
}

parentPort.on("message", (msg) => {
  if (!msg || msg.schema_version !== 1) return;
  if (msg.type === "manifest") {
    void open(msg);
    return;
  }
  if (msg.type === "teardown") {
    void (async () => {
      try { await repo?.flush(); } catch { /* the red witness is on disk */ }
      parentPort.postMessage({ schema_version: 1, type: "teardown:ack" });
    })();
  }
});
