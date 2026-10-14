/**
 * session-island-probe.mjs — an island that stands where a session's island stands and asks for whatever a
 * test tells it to ask for.
 *
 * It takes the manifest, stands a stock Repo on the manifest's own sync port under the peer ID the manifest
 * names, and then answers placed verbs:
 *   manifest → what the manifest carried (the resolved slots, the plugin CIDs, the store, the view standing)
 *   find     → ask the sync path for a document by URL; answer whether it arrived, and its titles
 *   write    → change a document it holds
 *   catalog  → ask the scoped view for a catalog name (`view:catalog`)
 *   content  → ask the scoped view about a content address (`view:content`)
 *   door     → post one of the vessel's own door asks (`cas:want`, `doc:rest`, `custody:write`) and report
 *              whether anything answered
 *
 * NOT production code — gate fixture only. It holds no rule of its own: an adversary Repo, nothing more.
 */
import { parentPort } from "node:worker_threads";
import { Repo } from "@automerge/automerge-repo";
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel";

let repo = null;
let seen = null;
const parked = new Map();
const post = (msg) => parentPort.postMessage({ schema_version: 1, ...msg });

async function find(url, ms = 1500) {
  const found = repo.find(url).then((h) => h, () => null);
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), ms));
  return Promise.race([found, timeout]);
}
const askView = (type, fields) => new Promise((resolve) => {
  const requestId = `probe-${parked.size}-${Math.random().toString(36).slice(2)}`;
  parked.set(requestId, resolve);
  post({ type, requestId, ...fields });
});

parentPort.on("message", async (msg) => {
  if (typeof msg !== "object" || msg === null || msg.schema_version !== 1) return;

  if (msg.type === "manifest") {
    seen = {
      wikiUri: msg.wikiUri, view: msg.view ?? null, resolved: msg.resolved ?? null, storage: msg.storage ?? null,
      pluginCids: msg.pluginCids ?? [], coreHash: msg.coreHash ?? null, catalogUrl: msg.grants?.catalogUrl ?? null,
      diskMirrors: msg.diskMirrors ?? null,
    };
    repo = new Repo({
      network: [new MessageChannelNetworkAdapter(msg.syncPort)],
      ...(msg.view ? { peerId: msg.view.peerId } : {}),
    });
    post({ type: "ea", wikiUri: msg.wikiUri });
    return;
  }

  if (msg.type === "cas:block" || msg.type === "doc:rested" || msg.type === "custody:written") {
    const resolve = parked.get(msg.requestId);
    parked.delete(msg.requestId);
    resolve?.(msg);
    return;
  }

  if (msg.type === "view:catalog-result" || msg.type === "view:content-result") {
    const resolve = parked.get(msg.requestId);
    parked.delete(msg.requestId);
    resolve?.(msg);
    return;
  }

  if (msg.type === "wiki:place-verb") {
    const { requestId, verb, args } = msg;
    try {
      let result;
      if (verb === "manifest") {
        result = seen;
      } else if (verb === "find") {
        const handle = await find(args.url);
        result = { found: handle !== null, titles: handle ? Object.keys(handle.doc()?.tiddlers ?? {}) : [] };
      } else if (verb === "write") {
        const handle = await find(args.url);
        if (handle) handle.change((doc) => { doc.tiddlers[args.title] = { tiddler: { title: args.title, text: "written by the island" } }; });
        result = { wrote: handle !== null };
      } else if (verb === "catalog") {
        const answer = await askView("view:catalog", { name: args.name });
        result = { documentUrl: answer.documentUrl ?? null, refusal: answer.refusal ?? null };
      } else if (verb === "content") {
        const answer = await askView("view:content", { cid: args.cid });
        result = { ok: answer.bytes instanceof Uint8Array && answer.bytes.length > 0, refusal: answer.refusal ?? null };
      } else if (verb === "door") {
        // An ask the caller expects an answer to waits for that answer, with no clock beside it. Only a caller that
        // reads SILENCE names a window (`silentAfterMs`): silence has no event of its own to wait on.
        const asked = askView(args.type, args.fields ?? {});
        const answered = typeof args.silentAfterMs === "number"
          ? await Promise.race([asked, new Promise((resolve) => setTimeout(() => resolve(null), args.silentAfterMs))])
          : await asked;
        result = answered === null
          ? { answered: false }
          : { answered: true, type: answered.type, bytes: answered.bytes instanceof Uint8Array ? answered.bytes.length : null };
      } else {
        throw new Error(`unknown probe verb ${verb}`);
      }
      post({ type: "wiki:verb-result", requestId, result });
    } catch (err) {
      post({ type: "wiki:verb-result", requestId, error: String(err) });
    }
    return;
  }

  if (msg.type === "teardown" || msg.type === "hooanu") {
    try { await repo?.shutdown(); } catch { /* the port already closed */ }
    post({ type: "teardown:ack" });
  }
});
