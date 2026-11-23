/**
 * fold-load-meter — opens ONE stored document through a Repo over the house's durable store, in a process of its own, and
 * reads what the load cost the live engine: `memory.buffer.byteLength` of every wasm instance this process stands, read
 * before the Repo finds the document and after. A suite's own process already holds an engine whose memory never shrinks,
 * so the meter stands apart; it taps `WebAssembly.Instance` before any engine module loads, hence the dynamic imports.
 *
 * argv: <storeDir> <documentId> <plain|fold|fold-impatient> [write]
 *   plain           the store as it stands, no fold
 *   fold            the house's fold: the child-process double, the pono gate
 *   fold-impatient  the same fold with no patience at all: the double never answers in time, so the load falls back
 *   write           after the load, one change, a flush and a stand-down, so the Repo's own first save lands
 * Output: one JSON line { heads, growthBytes, engineBytes, events }.
 */
const engines: WebAssembly.Instance[] = [];
const NativeInstance = WebAssembly.Instance;
(WebAssembly as { Instance: unknown }).Instance = new Proxy(NativeInstance, {
  construct(target, args, newTarget) {
    const instance = Reflect.construct(target, args, newTarget) as WebAssembly.Instance;
    engines.push(instance);
    return instance;
  },
});
const engineBytes = (): number => engines.reduce((sum, instance) => {
  const memory = instance.exports["memory"];
  return sum + (memory instanceof WebAssembly.Memory ? memory.buffer.byteLength : 0);
}, 0);

const [storeDir, documentId, mode, after] = process.argv.slice(2);
if (!storeDir || !documentId || !mode) throw new Error("usage: fold-load-meter <storeDir> <documentId> <plain|fold|fold-impatient> [write]");

const A = await import("@automerge/automerge");
const { Repo } = await import("@automerge/automerge-repo");
const { DurableNodeFSStorageAdapter } = await import("../src/durable-storage-adapter.js");
const { makeChildProcessDocFold } = await import("../src/doc-load-probe.js");

const events: unknown[] = [];
const fold = mode === "plain" ? undefined : {
  door: makeChildProcessDocFold(mode === "fold-impatient" ? { timeoutMs: 1 } : {}),
  onFold: (event: unknown) => { events.push(event); },
};
const storage = new DurableNodeFSStorageAdapter(storeDir, fold ? { fold } : {});
const repo = new Repo({ storage, network: [] });
const before = engineBytes();
const handle = await repo.find<Record<string, unknown>>(`automerge:${documentId}` as never);
const heads = A.getHeads(handle.doc()!);
const growthBytes = engineBytes() - before;
if (after === "write") {
  handle.change((d) => { d["fold-meter"] = "one write after the load"; });
  await repo.flush();
}
await repo.shutdown();
process.stdout.write(JSON.stringify({ heads, growthBytes, engineBytes: engineBytes(), events }) + "\n");
