/**
 * A production-boundary probe for the daemon VM's Repo persistence fork.
 *
 * It uses the same Node worker_threads + Automerge Repo + MessageChannel shape as the daemon island,
 * but replaces TW5/keyhive behavior with a tiny observation: report whether a named tiddler is present
 * after the worker Repo resolves the daemon document. The companion `-nosync` fixture deliberately
 * removes the relay peer, so a successful read can only come from the island's own persisted Repo.
 */
import { parentPort } from "node:worker_threads";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs";

const MARKER = "lar:///ha.ka.ba/daemon-replay-probe/marker";
let repo = null;
let wikiUri = null;

function event(present) {
  parentPort.postMessage({
    type: "event",
    wikiUri,
    listenable: "daemon:replay-probe",
    payload: { present, sync: true },
  });
}

async function open(msg) {
  wikiUri = msg.wikiUri;
  const opts = { sharePolicy: async () => true };
  if (msg.storage?.type === "nodefs") opts.storage = new NodeFSStorageAdapter(msg.storage.dir);
  opts.network = [new MessageChannelNetworkAdapter(msg.syncPort)];
  repo = new Repo(opts);
  try {
    // The island's one peer is the vessel's main thread; a Repo with no peer standing settles a find "unavailable"
    // at once, which says nothing about the document. The ask waits for the peer's arrival (the Repo's own `peer`
    // event) and asks again; an unavailable with a peer standing is the relay's word and stays a fault.
    let handle;
    for (;;) {
      try { handle = await repo.findWithProgress(msg.grants.wikiUrl).whenReady(); break; }
      catch (error) {
        if (!/is unavailable/.test(String(error)) || repo.peers.length > 0) throw error;
        await new Promise((resolve) => repo.networkSubsystem.once("peer", resolve));
      }
    }
    const report = () => event(Boolean(handle.doc()?.tiddlers?.[MARKER]));
    handle.on("change", report);
    report();
    parentPort.postMessage({ type: "ea", wikiUri });
  } catch (error) {
    parentPort.postMessage({ type: "fault", wikiUri, error: String(error) });
  }
}

parentPort.on("message", (msg) => {
  if (!msg) return;
  if (msg.type === "manifest") { void open(msg); return; }
  if (msg.type === "teardown") {
    void (async () => {
      try { await repo?.flush(); } catch { /* the probe's refusal is already visible */ }
      parentPort.postMessage({ type: "teardown:ack" });
    })();
  }
});
