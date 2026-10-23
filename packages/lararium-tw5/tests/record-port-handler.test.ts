import { describe, expect, test } from "vitest";
import { CompositeStore, type IslandToVesselMsg } from "@lararium/mesh";
import type { PortMsg_Open, PortMsg_Write, PortMsg_Ask } from "@lararium/mesh/record-port";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { hasRecordPort } from "../src/record-port-handler.js";
import { shapeId } from "../src/record-port-projection.js";
import type { IslandContext } from "../src/island-context.js";
import type { IslandCap } from "../src/island-caps.js";
import { makeWikiBehavior } from "../src/wiki-behavior.js";
import { VerbTable } from "../src/verb-dispatcher.js";

const origin = { kind: "tw-local", instanceId: "foreign" } as const;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
/** Send an ask and pump macrotask turns, a bounded run, until it posts one more answer. */
const sendAwait = async (r: { messages: unknown[]; send(msg: never): Promise<void> }, msg: unknown): Promise<void> => {
  const count = () => r.messages.filter((m) => (m as { type?: string }).type === "port:answer").length;
  const before = count();
  await r.send(msg as never);
  for (let turn = 0; turn < 5000 && count() <= before; turn++) await new Promise<void>((resolve) => setImmediate(resolve));
};
const openMsg = (portId = "p", overrides: Partial<PortMsg_Open> = {}): PortMsg_Open => ({
  type: "port:open", portId, wikiUri: "wiki", actor: portId, width: "full",
  edits: true, presence: true, maxRecordBytes: 4096, maxBatchBytes: 8192, ...overrides,
});
const writeMsg = (txId: string, title: string, fields: Record<string, string> = { text: "body" }): PortMsg_Write => ({
  type: "port:write", portId: "p", txId, records: [{ title, fields }],
});
const askMsg = (kind: PortMsg_Ask["kind"], overrides: Partial<PortMsg_Ask> & { args?: Record<string, string> } = {}): PortMsg_Ask & { args?: Record<string, string> } => ({
  type: "port:ask", portId: "p", askId: kind, kind, ...overrides,
});

async function rig(options: Parameters<typeof hasRecordPort>[0] = {}, cap: IslandCap = hasRecordPort({ mayEdit: () => true, ...options }), beforeEa?: (composite: CompositeStore) => void) {
  const composite = new CompositeStore();
  const store = new MemoryTiddlerStore("working");
  composite.addLayer({ bagId: "working", store, writable: true });
  const messages: IslandToVesselMsg[] = [];
  const wikiListeners = new Set<() => void>();
  let invoked = 0;
  const tw5 = { $tw: { Tiddler: class {
    constructor(private readonly fields: Record<string, unknown>) {}
    getFieldStrings(): Record<string, string> {
      return Object.fromEntries(Object.entries(this.fields).map(([key, value]) => [key, String(value)]));
    }
  }, config: { preferences: { jsonSpaces: 2 } }, wiki: {
    filterTiddlers: () => ["Ordinary", "$:/StoryList"],
    makeTranscludeWidget: (_title: string, options: { document: { createTextNode: (text: string) => unknown; createElement: (tag: string) => { addEventListener: (type: string, listener: () => void) => void } } }) => {
      let heldContainer: { appendChild: (node: unknown) => void; removeChild: (node: unknown) => void } | undefined;
      let heldButton: ReturnType<typeof options.document.createElement> | undefined;
      const button = () => {
        const next = options.document.createElement("button");
        next.addEventListener("click", () => { invoked++; });
        return next;
      };
      return {
      render: (container: { appendChild: (node: unknown) => void; removeChild: (node: unknown) => void }) => {
        heldContainer = container;
        container.appendChild(options.document.createTextNode("rendered"));
        heldButton = button();
        container.appendChild(heldButton);
      }, refresh: () => {
        if (heldContainer && heldButton) heldContainer.removeChild(heldButton);
        heldButton = button();
        heldContainer?.appendChild(heldButton);
      }, domNodes: [],
    }; },
    addEventListener: (type: string, listener: () => void) => { if (type === "change") wikiListeners.add(listener); },
    removeEventListener: (type: string, listener: () => void) => { if (type === "change") wikiListeners.delete(listener); },
  },
    rootWidget: { invokeActionString: () => { invoked++; } } } };
  const ctx = { wikiUri: "wiki", composite, tw5, handles: new Map(), recipe: { wikiSlug: "wiki" }, post: (message: IslandToVesselMsg) => messages.push(message) } as unknown as IslandContext;
  beforeEa?.(composite);
  const cleanup = await cap.onEa?.(ctx);
  const send = async <T extends { type: string }>(msg: T) => { expect(cap.onSignal?.(msg.type, msg, ctx)).toBe(true); await settle(); };
  return { composite, store, messages, ctx, send, wikiChange: () => { for (const listener of wikiListeners) listener(); },
    get wikiListenerCount() { return wikiListeners.size; }, get invoked() { return invoked; },
    close: async () => { if (typeof cleanup === "function") await cleanup(); } };
}
const ofType = <T extends IslandToVesselMsg["type"]>(messages: IslandToVesselMsg[], type: T) =>
  messages.filter((message): message is Extract<IslandToVesselMsg, { type: T }> => message.type === type);

describe("record port handler", () => {
  test("port refuses a non-atomic family without a member write; CONTROL: atomic layer writes the family", async () => {
    const r = await rig();
    const plainBacking = new MemoryTiddlerStore();
    let puts = 0;
    const plain = new Proxy(plainBacking, { get(target, key) {
      if (key === "writeFamily") return undefined;
      if (key === "put") return async (...args: Parameters<MemoryTiddlerStore["put"]>) => { puts++; return target.put(...args); };
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    } });
    r.composite.addLayer({ bagId: "plain", store: plain, writable: true, defaultWritable: false });
    await r.send(openMsg());
    await r.send({ type: "port:write", portId: "p", txId: "plain-tx", records: [
      { title: "PlainA", fields: { text: "a" }, bag: "plain" },
      { title: "PlainB", fields: { text: "b" }, bag: "plain" },
    ] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "non-atomic-layer" });
    expect(puts).toBe(0);
    expect(await plainBacking.get("PlainA")).toBeNull();
    await r.send({ type: "port:write", portId: "p", txId: "atomic-tx", records: [
      { title: "AtomicA", fields: { text: "a" } }, { title: "AtomicB", fields: { text: "b" } },
    ] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied" });
    expect(await r.store.get("AtomicB")).not.toBeNull();
    await r.close();
  });

  test("actor ledger evicts closed actors under pressure; CONTROL: a live actor replays its answer", async () => {
    const r = await rig({ maxActors: 2 });
    await r.send(openMsg("p", { edits: true }));
    await r.send(writeMsg("first", "First"));
    await r.send({ type: "port:close", portId: "p" });
    await r.send(openMsg("live", { edits: true }));
    await r.send({ ...writeMsg("live-tx", "Live"), portId: "live" });
    for (let index = 0; index < 300; index++) {
      const portId = `reader-${index}`;
      await r.send(openMsg(portId, { edits: false, presence: false }));
      await r.send({ type: "port:close", portId });
    }
    await r.send(openMsg("p", { edits: true }));
    await r.send(writeMsg("first", "First"));
    // The evicted actor's answer left the table, so the resent id applies afresh: port p hears First twice.
    expect(ofType(r.messages, "port:changes").filter(message => message.portId === "p").flatMap(message => message.entries).filter(entry => entry.title === "First")).toHaveLength(2);
    await r.send({ ...writeMsg("live-tx", "Live"), portId: "live" });
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "Live")).toHaveLength(1);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", portId: "live" });
    await r.close();
  });

  test("full actor table serves reads and refuses writes; CONTROL: existing actor writes", async () => {
    const r = await rig({ maxActors: 1 });
    await r.send(openMsg("held"));
    await r.send(openMsg("reader"));
    expect(ofType(r.messages, "port:snapshot").some(message => message.portId === "reader")).toBe(true);
    await r.send({ ...writeMsg("blocked", "Never"), portId: "reader" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "actor-table-full" });
    expect(await r.store.get("Never")).toBeNull();
    await r.send({ ...writeMsg("held-tx", "Allowed"), portId: "held" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied" });
    await r.close();
  });

  test("unanswered partial transaction protects a closed actor from eviction; CONTROL: its retry completes", async () => {
    const r = await rig({ maxActors: 1 });
    r.composite.addLayer({ bagId: "second", store: new MemoryTiddlerStore(), writable: true, defaultWritable: false });
    const writeFamily = r.composite.writeFamily.bind(r.composite);
    let failSecond = true;
    r.composite.writeFamily = async (...args: Parameters<CompositeStore["writeFamily"]>) => {
      if (args[3]?.bag === "second" && failSecond) throw new Error("second-fault");
      return writeFamily(...args);
    };
    await r.send(openMsg("p"));
    const tx: PortMsg_Write = { type: "port:write", portId: "p", txId: "partial", records: [
      { title: "PartOne", fields: { text: "one" }, bag: "working" },
      { title: "PartTwo", fields: { text: "two" }, bag: "second" },
    ] };
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "partial", applied: ["working"] });
    await r.send({ type: "port:close", portId: "p" });
    await r.send(openMsg("reader", { edits: false }));
    await r.send({ ...writeMsg("blocked", "Blocked"), portId: "reader" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ reason: "actor-table-full" });
    await r.send({ type: "port:close", portId: "reader" });
    failSecond = false;
    await r.send(openMsg("p"));
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["working", "second"] });
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "PartOne")).toHaveLength(1);
    await r.close();
  });

  test("two bag families echo separately before written; CONTROL: one family echoes once", async () => {
    const r = await rig();
    r.composite.addLayer({ bagId: "second", store: new MemoryTiddlerStore(), writable: true, defaultWritable: false });
    await r.send(openMsg());
    const before = r.messages.length;
    await r.send({ type: "port:write", portId: "p", txId: "two", records: [
      { title: "FirstBag", fields: { text: "a" }, bag: "working" },
      { title: "SecondBag", fields: { text: "b" }, bag: "second" },
    ] });
    const output = r.messages.slice(before).filter(message => message.type === "port:changes" || message.type === "port:written");
    expect(output.map(message => message.type)).toEqual(["port:changes", "port:changes", "port:written"]);
    expect(output.slice(0, 2).map(message => message.type === "port:changes" ? message.entries.map(entry => [entry.title, entry.causedBy]) : []))
      .toEqual([[["FirstBag", ["two"]]], [["SecondBag", ["two"]]]]);
    const oneBefore = r.messages.length;
    await r.send(writeMsg("one", "Single"));
    expect(r.messages.slice(oneBefore).filter(message => message.type === "port:changes")).toHaveLength(1);
    await r.close();
  });
  test("port-memory-family-lands-in-one-stretch: a foreign write fired inside a listener cannot split the family; CONTROL: a throwing listener leaves the commit standing", async () => {
    const r = await rig();
    await r.send(openMsg());
    const seen: string[] = [];
    let fired = false;
    r.composite.subscribe(change => {
      seen.push(change.title);
      if (change.title === "FamA" && !fired) { fired = true; void r.composite.put({ tiddler: { title: "Foreign", text: "c" } }, { kind: "tw-local", instanceId: "elsewhere" }); }
    });
    const before = r.messages.length;
    await r.send({ type: "port:write", portId: "p", txId: "fam", records: [
      { title: "FamA", fields: { text: "a" } }, { title: "FamB", fields: { text: "b" } },
    ] });
    await settle();
    // Both members applied before any listener ran, so a listener sees the whole family in the store.
    expect(await r.store.get("FamA")).not.toBeNull();
    expect(await r.store.get("FamB")).not.toBeNull();
    const entries = ofType(r.messages.slice(before) as never, "port:changes").flatMap(message => message.entries);
    // The port log keeps the order the store fired (here the listener fired the foreign write between the members).
    expect(entries.map(entry => entry.title)).toEqual(seen.filter(title => entries.some(entry => entry.title === title)));
    expect(entries.find(entry => entry.title === "FamB")?.causedBy).toEqual(["fam"]);
    expect(entries.find(entry => entry.title === "Foreign")?.causedBy).toEqual([]);
    // CONTROL: a listener that throws faults the listener, never the write.
    r.composite.subscribe(() => { throw new Error("listener fault"); });
    await r.send({ type: "port:write", portId: "p", txId: "fam2", records: [{ title: "FamC", fields: { text: "c" } }, { title: "FamD", fields: { text: "d" } }] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ txId: "fam2", status: "applied" });
    await r.close();
  });
  test("port-memory-family-reentrant-rewrite-keeps-store-truth: a listener that rewrites a later member leaves the highest-seq port value equal to the store's; CONTROL: an untouched member keeps its own value", async () => {
    const r = await rig();
    await r.send(openMsg());
    let rewrote = false;
    r.composite.subscribe(change => {
      if (change.title === "RA" && !rewrote) { rewrote = true; void r.composite.put({ tiddler: { title: "RB", text: "new" } }, { kind: "tw-local", instanceId: "elsewhere" }); }
    });
    await r.send({ type: "port:write", portId: "p", txId: "re", records: [{ title: "RA", fields: { text: "a" } }, { title: "RB", fields: { text: "old" } }, { title: "RC", fields: { text: "c" } }] });
    await settle();
    const last = (title: string) => ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === title).sort((x, y) => x.seq - y.seq).at(-1);
    expect((await r.store.get("RB"))?.tiddler["text"]).toBe("new");
    expect(last("RB")?.fields["text"]).toBe("new");
    expect(last("RC")?.fields["text"]).toBe("c");
    await r.close();
  });

  test("port-memory-family-reentrant-removal-keeps-store-truth: a listener that hard-removes a later member leaves the port's last value absent like the store; CONTROL: an untouched member stays", async () => {
    const r = await rig();
    await r.send(openMsg());
    let removed = false;
    r.composite.subscribe(change => {
      if (change.title === "GA" && !removed) { removed = true; void r.composite.remove("GB", { kind: "tw-local", instanceId: "elsewhere" }); }
    });
    await r.send({ type: "port:write", portId: "p", txId: "gone", records: [{ title: "GA", fields: { text: "a" } }, { title: "GB", fields: { text: "old" } }, { title: "GC", fields: { text: "c" } }] });
    await settle();
    const last = (title: string) => ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === title).sort((x, y) => x.seq - y.seq).at(-1);
    expect(await r.store.get("GB")).toBeNull();
    expect(last("GB")?.deleted).toBe(true);
    expect(last("GC")?.fields["text"]).toBe("c");
    await r.close();
  });

  test("port-echo-survives-an-earlier-throwing-listener: a composite listener that throws never starves the port; CONTROL: both members still echo", async () => {
    const r = await rig({}, undefined, composite => { composite.subscribe(() => { throw new Error("earlier listener fault"); }); });
    await r.send(openMsg());
    await r.send({ type: "port:write", portId: "p", txId: "boom", records: [{ title: "EA", fields: { text: "a" } }, { title: "EB", fields: { text: "b" } }] });
    const entries = ofType(r.messages, "port:changes").flatMap(message => message.entries);
    expect(entries.filter(entry => entry.causedBy.includes("boom")).map(entry => entry.title).sort()).toEqual(["EA", "EB"]);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ txId: "boom", status: "applied" });
    await r.close();
  });
  test("port-verb-no-authority and port-verb-guest-refused; CONTROL: admin runs once with proven identity and targets", async () => {
    let runs = 0;
    const verbs = () => { const table = new VerbTable(); table.register("probe", async (args, context) => {
      runs++;
      expect(args).toEqual({ word: "yes" });
      expect(context.invocation.targets).toEqual(["Target"]);
      expect(context.invocation.requestedBy).toBe("admin-id");
      expect(await context.cap("admin", "working")).toEqual({ ok: true });
      return { ran: true };
    }); return table; };
    const face = { id: "admin-id", role: "admin" };
    const r = await rig({ verbs, faceOf: () => face });
    await r.send(openMsg());
    const ask = askMsg("verb", { subject: "probe", args: { word: "yes" }, titles: ["Target"] });
    await r.send(ask);
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "no-authority" });
    expect(runs).toBe(0);
    await r.close();
    let role = "guest";
    const gated = await rig({ verbs, faceOf: () => ({ ...face, role }), verbCap: () => async () => ({ ok: true }), authority: req =>
      (req.provenFace as { role: string }).role === "admin" ? { allowed: true } : { allowed: false, reason: "guest" } });
    await gated.send(openMsg());
    await gated.send(ask);
    expect(ofType(gated.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "guest" });
    expect(runs).toBe(0);
    role = "admin";
    await gated.send(ask);
    expect(ofType(gated.messages, "port:answer").at(-1)).toMatchObject({ status: "answered", result: { ran: true } });
    expect(runs).toBe(1);
    await gated.close();
  });

  test("port-verb-system-kahu-refused: admin cannot CLEAR system canon without reach; CONTROL: CLEAR user bag succeeds", async () => {
    const r = await rig({ faceOf: () => ({ id: "admin", role: "admin" }), verbCap: () => async () => ({ ok: true }), authority: () => ({ allowed: true }) });
    await r.send(openMsg());
    await sendAwait(r, askMsg("verb", { subject: "CLEAR", args: { bag: "lar:///ha.ka.ba/bags/lares" } }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "kahu-reach" });
    await sendAwait(r, askMsg("verb", { subject: "CLEAR", args: { bag: "working" } }));
    expect(ofType(r.messages, "port:answer").at(-1)?.status).toBe("answered");
    await r.close();
  });

  test("port-verb-no-proven-face and unknown verb refuse; CONTROL: known verb reaches its handler", async () => {
    let runs = 0;
    const table = new VerbTable();
    table.register("known", async () => { runs++; return { ok: true }; });
    let face: object | undefined;
    const r = await rig({ faceOf: () => face, authority: () => ({ allowed: true }), verbs: () => table });
    await r.send(openMsg());
    await r.send(askMsg("verb", { subject: "known" }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "no-proven-face" });
    expect(runs).toBe(0);
    face = { id: "admin" };
    await r.send(askMsg("verb", { subject: "absent" }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "no-such-verb" });
    await r.send(askMsg("verb", { subject: "known" }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "answered", result: { ok: true } });
    expect(runs).toBe(1);
    await r.close();
  });

  test("port-verb-copy-bag-grants: a gated face denied source or destination lands nothing; CONTROL: both grants copy once", async () => {
    const source = "lar:///test/port/source";
    const destination = "lar:///test/port/destination";
    const face = { id: "verified" };
    let denied: string | undefined = source;
    const checks: Array<[object, string, string]> = [];
    const r = await rig({ faceOf: () => face, authority: () => ({ allowed: true }),
      verbCap: (proven, portId) => async (access, bag) => {
        checks.push([proven, portId, `${access}:${bag}`]);
        return bag === denied ? { ok: false, reason: "withheld" } : { ok: true };
      } });
    const from = new MemoryTiddlerStore(source);
    const to = new MemoryTiddlerStore(destination);
    r.composite.addLayer({ bagId: source, store: from, writable: true, defaultWritable: false });
    r.composite.addLayer({ bagId: destination, store: to, writable: true, defaultWritable: false });
    await from.put({ tiddler: { title: "CopyMe", text: "source" } }, origin);
    await r.send(openMsg());
    const copy = (askId: string) => askMsg("verb", { askId, subject: "COPY",
      args: { title: "CopyMe", "from-bag": source, "to-bag": destination, "change-id": askId } });
    await sendAwait(r, copy("source-denied"));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cap-denied" });
    expect(await to.get("CopyMe")).toBeNull();
    denied = destination;
    await sendAwait(r, copy("destination-denied"));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cap-denied" });
    expect(await to.get("CopyMe")).toBeNull();
    denied = undefined;
    await sendAwait(r, copy("allowed"));
    expect(ofType(r.messages, "port:answer").at(-1)?.status).toBe("answered");
    expect((await to.get("CopyMe"))?.tiddler.text).toBe("source");
    expect(checks).toContainEqual([face, "p", `read:${source}`]);
    expect(checks).toContainEqual([face, "p", `admin:${destination}`]);
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "CopyMe")).toHaveLength(1);
    await r.close();
  });

  test("port-verb-repack-read-grant: a gated face without read refuses; CONTROL: a lent read returns the pack", async () => {
    const bag = "lar:///test/port/pack";
    let read = false;
    let storeReads = 0;
    const r = await rig({ faceOf: () => ({ id: "verified" }), authority: () => ({ allowed: true }),
      verbCap: () => async (access, requested) => ({ ok: read && access === "read" && requested === bag, reason: "withheld" }) });
    const store = new MemoryTiddlerStore(bag);
    const get = store.get.bind(store);
    store.get = async (...args) => { storeReads++; return get(...args); };
    r.composite.addLayer({ bagId: bag, store, writable: true, defaultWritable: false });
    await store.put({ tiddler: { title: "$:/config/OriginalTiddlerPaths", text: JSON.stringify({ Member: "bundle.json" }) } }, origin);
    await store.put({ tiddler: { title: "Member", text: "body" } }, origin);
    await r.send(openMsg());
    storeReads = 0;   // the setup puts read the layer; count only what the verb reads
    await sendAwait(r, askMsg("verb", { askId: "repack-denied", subject: "REPACK", args: { bag, "pack-path": "bundle.json" } }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "verb-unavailable" });
    expect(storeReads).toBe(0);
    read = true;
    await sendAwait(r, askMsg("verb", { askId: "repack-allowed", subject: "REPACK", args: { bag, "pack-path": "bundle.json" } }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "answered", result: { verb: "REPACK", path: "bundle.json", count: 1 } });
    expect(storeReads).toBeGreaterThan(0);
    await r.close();
  });

  test("port-verb-default-cap-denies: a gated verb's bag check refuses without a lend; CONTROL: a lent cap permits it", async () => {
    const face = { id: "verified" };
    const ask = askMsg("verb", { subject: "CLEAR", args: { bag: "working" } });
    const denied = await rig({ faceOf: () => face, authority: () => ({ allowed: true }) });
    await denied.send(openMsg()); await sendAwait(denied, ask);
    expect(ofType(denied.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cap-denied" });
    expect(ofType(denied.messages, "port:answer").at(-1)).not.toHaveProperty("result");
    await denied.close();
    const allowed = await rig({ faceOf: () => face, authority: () => ({ allowed: true }),
      verbCap: () => async () => ({ ok: true }) });
    await allowed.send(openMsg()); await sendAwait(allowed, ask);
    expect(ofType(allowed.messages, "port:answer").at(-1)?.status).toBe("answered");
    await allowed.close();
  });

  test("port-verb-refusal-keeps-verifier-diagnostic-private; CONTROL: lent grant answers CLEAR", async () => {
    const face = { id: "verified" };
    const privateReason = "grant document <private-id> not found";
    let grant = false;
    const r = await rig({ faceOf: () => face, authority: () => ({ allowed: true }),
      verbCap: () => async () => grant ? { ok: true } : { ok: false, reason: privateReason } });
    await r.send(openMsg());
    await sendAwait(r, askMsg("verb", { askId: "private-refusal", subject: "CLEAR", args: { bag: "working" } }));
    const denied = ofType(r.messages, "port:answer").at(-1);
    expect(denied).toMatchObject({ status: "refused", reason: "cap-denied" });
    expect(denied).not.toHaveProperty("result");
    expect(JSON.stringify(denied)).not.toContain("private-id");
    grant = true;
    await sendAwait(r, askMsg("verb", { askId: "granted", subject: "CLEAR", args: { bag: "working" } }));
    expect(ofType(r.messages, "port:answer").at(-1)?.status).toBe("answered");
    await r.close();
  });

  test("port-cas-tier-refusals read no bytes; CONTROL: public matching bytes answer", async () => {
    const bytes = new TextEncoder().encode("public body");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const cid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    let reads = 0;
    let tier: "veil" | "personagroup" | "contract" | "public" | undefined;
    let returned: Uint8Array | null = bytes;
    const r = await rig({ casTierOf: () => tier });
    r.ctx.resolveByCid = async () => { reads++; return returned; };
    await r.send(openMsg());
    const ask = askMsg("cas", { subject: cid });
    for (const [next, reason] of [[undefined, "cas-tier-unknown"], ["veil", "cas-private"], ["personagroup", "cas-private"], ["contract", "cas-contract"]] as const) {
      tier = next;
      await sendAwait(r, ask);
      expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason });
      expect(reads).toBe(0);
    }
    tier = "public";
    returned = null;
    await sendAwait(r, ask);
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cas-missing" });
    returned = new Uint8Array([1]);
    await sendAwait(r, ask);
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cas-corrupt" });
    returned = bytes;
    await sendAwait(r, ask);
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "answered", result: { cid, bytesBase64: "cHVibGljIGJvZHk=" } });
    await r.close();
  });

  test("port-cas-default-tier-unknown and bad cid refuse; CONTROL: public tier requires resolver", async () => {
    const r = await rig();
    await r.send(openMsg());
    await sendAwait(r, askMsg("cas", { subject: "bad" }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "bad-cid" });
    await sendAwait(r, askMsg("cas", { subject: "a".repeat(64) }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cas-tier-unknown" });
    await r.close();
    const publicPort = await rig({ casTierOf: () => "public" });
    await publicPort.send(openMsg());
    await sendAwait(publicPort, askMsg("cas", { subject: "a".repeat(64) }));
    expect(ofType(publicPort.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cas-unavailable" });
    await publicPort.close();
  });

  test("port-cas-too-large refuses before hashing; CONTROL: a bounded public body answers", async () => {
    const small = new TextEncoder().encode("small");
    const digest = await crypto.subtle.digest("SHA-256", small);
    const cid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const r = await rig({ casTierOf: () => "public" });
    r.ctx.resolveByCid = async () => new Uint8Array(786_433);
    await r.send(openMsg());
    await sendAwait(r, askMsg("cas", { subject: cid }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "refused", reason: "cas-too-large" });
    r.ctx.resolveByCid = async () => small;
    await sendAwait(r, askMsg("cas", { subject: cid }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "answered", result: { cid, bytesBase64: "c21hbGw=" } });
    await r.close();
  });
  test("port-write-needs-server-grant: edits request without lookup refuses; CONTROL: server grant writes once", async () => {
    const denied = await rig({}, hasRecordPort());
    await denied.send(openMsg());
    await denied.send(writeMsg("no-lookup", "Denied"));
    expect(ofType(denied.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "edits-not-granted" });
    expect(await denied.composite.get("Denied")).toBeNull();
    await denied.close();

    const granted = await rig({ mayEdit: (portId, actor) => portId === "p" && actor === "p" });
    await granted.send(openMsg());
    await granted.send(writeMsg("granted", "Allowed"));
    expect(ofType(granted.messages, "port:written").at(-1)?.status).toBe("applied");
    expect(await granted.composite.get("Allowed")).not.toBeNull();
    expect(ofType(granted.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "Allowed")).toHaveLength(1);
    await granted.close();
  });

  test("port-write-revoked-server-grant: false lookup for port refuses; CONTROL: true lookup writes", async () => {
    let allowed = false;
    const r = await rig({ mayEdit: (portId, actor) => allowed && portId === "p" && actor === "p" });
    await r.send(openMsg());
    await r.send(writeMsg("revoked", "Denied"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "edits-not-granted" });
    expect(await r.composite.get("Denied")).toBeNull();
    allowed = true;
    await r.send(writeMsg("allowed", "Allowed"));
    expect(ofType(r.messages, "port:written").at(-1)?.status).toBe("applied");
    expect(await r.composite.get("Allowed")).not.toBeNull();
    await r.send(openMsg("p", { edits: false }));
    await r.send(writeMsg("not-asked", "NoRequest"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "edits-not-granted" });
    expect(await r.composite.get("NoRequest")).toBeNull();
    await r.close();
  });

  test("default makeWikiBehavior refuses write by name; CONTROL: server-granted handler writes", async () => {
    const defaultPort = await rig({}, makeWikiBehavior());
    await defaultPort.send(openMsg());
    await defaultPort.send(writeMsg("default", "Denied"));
    expect(ofType(defaultPort.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "edits-not-granted" });
    expect(await defaultPort.composite.get("Denied")).toBeNull();
    await defaultPort.close();
    const granted = await rig();
    await granted.send(openMsg());
    await granted.send(writeMsg("control", "Allowed"));
    expect(await granted.composite.get("Allowed")).not.toBeNull();
    await granted.close();
  });

  test("port-rejected-opening-read-resets-and-unpins: failed entries resets; CONTROL: fresh read snapshots", async () => {
    const r = await rig({ retainEntries: 1, bootNonce: "read-fault" });
    await r.composite.put({ tiddler: { title: "Before", text: "one" } }, origin); await settle();
    const original = r.composite.entries.bind(r.composite);
    let reject!: (reason: Error) => void;
    const held = new Promise<void>((_resolve, fail) => { reject = fail; });
    let first = true;
    r.composite.entries = async () => {
      if (first) { first = false; await held; }
      return original();
    };
    await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "After", text: "two" } }, origin); await settle();
    reject(new Error("read-failed")); await settle();
    expect(ofType(r.messages, "port:reset").at(-1)).toMatchObject({ reason: "lagged", headSeq: 2 });
    expect(ofType(r.messages, "port:snapshot")).toHaveLength(0);
    expect(ofType(r.messages, "port:changes")).toHaveLength(0);
    await r.composite.put({ tiddler: { title: "Third", text: "three" } }, origin); await settle();
    await r.send(openMsg("p", { since: `read-fault.${shapeId({ width: "full" })}.1` }));
    expect(ofType(r.messages, "port:reset").at(-1)).toMatchObject({ reason: "compacted", floorSeq: 2 });
    await r.send(openMsg());
    expect(ofType(r.messages, "port:snapshot").at(-1)?.records.map(record => record.title)).toEqual(["Before", "After", "Third"]);
    await r.close();
  });

  test("port-txid-payload-mismatch-refuses-partial-retry: changed pending fields refuse; CONTROL: identical retry resumes", async () => {
    const r = await rig();
    const second = new MemoryTiddlerStore("second");
    r.composite.addLayer({ bagId: "second", store: second, writable: true, defaultWritable: false });
    await r.send(openMsg());
    const original = r.composite.writeFamily.bind(r.composite);
    let fail = true;
    r.composite.writeFamily = async (...args) => {
      if (args[3]?.bag === "second" && fail) { fail = false; throw new Error("transient"); }
      return original(...args);
    };
    const tx: PortMsg_Write = { type: "port:write", portId: "p", txId: "partial-digest", records: [
      { title: "First", fields: { text: "one" } }, { title: "Second", fields: { text: "two" }, bag: "second" },
    ] };
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "partial", applied: ["(default)"], failed: ["second"] });
    await r.send({ ...tx, records: [tx.records[0]!, { ...tx.records[1]!, fields: { text: "changed" } }] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "txid-payload-mismatch" });
    expect(await second.get("Second")).toBeNull();
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["(default)", "second"] });
    expect((await second.get("Second"))?.tiddler.text).toBe("two");
    await r.close();
  });
  test("port-load-raced: delayed A never carries B's seq; CONTROL: stable load carries A", async () => {
    const r = await rig(); await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "Ordinary", text: "A" } }, origin); await settle();
    await r.send(askMsg("load", { titles: ["Ordinary"], fields: ["text"] }));
    expect((ofType(r.messages, "port:answer").at(-1)?.result as { fields: { text: string } }[])[0]?.fields.text).toBe("A");
    const original = r.composite.get.bind(r.composite);
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let captured = false;
    r.composite.get = async (...args) => {
      const value = await original(...args);
      if (!captured) { captured = true; await held; }
      return value;
    };
    await r.send(askMsg("load", { askId: "raced", titles: ["Ordinary"], fields: ["text"] }));
    await r.composite.put({ tiddler: { title: "Ordinary", text: "B" } }, origin); await settle();
    release(); await settle();
    const latest = ofType(r.messages, "port:answer").at(-1)!;
    expect(latest.status === "refused" && latest.reason === "load-raced" ||
      (latest.result as { fields: { text: string } }[])[0]?.fields.text === "B").toBe(true);
    await r.close();
  });

  test("port-replay-before-grants: completed tx replays with edits revoked; CONTROL: new tx refuses", async () => {
    let granted = true;
    const r = await rig({ mayEdit: () => granted }); await r.send(openMsg()); await r.send(writeMsg("once", "Once"));
    const original = ofType(r.messages, "port:written").at(-1)!;
    granted = false;
    await r.send(openMsg("p", { edits: true }));
    await r.send(writeMsg("once", "Once"));
    expect(ofType(r.messages, "port:written").at(-1)).toEqual(original);
    await r.send(writeMsg("once", "Once", { text: "changed" }));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "txid-payload-mismatch" });
    await r.send(writeMsg("new", "New"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "edits-not-granted" });
    await r.close();
  });

  test("port-partial-retry-skips-applied-bag: retired applied bag never blocks pending family; CONTROL: both land", async () => {
    const r = await rig();
    const first = new MemoryTiddlerStore("first");
    const second = new MemoryTiddlerStore("second");
    r.composite.addLayer({ bagId: "first", store: first, writable: true, defaultWritable: false });
    r.composite.addLayer({ bagId: "second", store: second, writable: true, defaultWritable: false });
    await r.send(openMsg());
    const original = r.composite.writeFamily.bind(r.composite);
    let fail = true;
    r.composite.writeFamily = async (...args) => {
      if (args[3]?.bag === "second" && fail) { fail = false; throw new Error("transient"); }
      return original(...args);
    };
    const tx = { type: "port:write", portId: "p", txId: "partial", records: [
      { title: "First", fields: { text: "one" }, bag: "first" }, { title: "Second", fields: { text: "two" }, bag: "second" },
    ] };
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "partial", applied: ["first"], failed: ["second"] });
    r.composite.removeLayer("first");
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["first", "second"] });
    expect(await second.get("Second")).not.toBeNull();
    await r.close();
  });

  test("port-write-boundary-drift: second bag retires after first commit and resumes; CONTROL: first landed", async () => {
    const r = await rig(); const second = new MemoryTiddlerStore("second");
    r.composite.addLayer({ bagId: "second", store: second, writable: true, defaultWritable: false });
    await r.send(openMsg());
    const original = r.composite.writeFamily.bind(r.composite);
    let calls = 0;
    r.composite.writeFamily = async (...args) => {
      calls++;
      if (calls === 2) r.composite.removeLayer("second");
      return original(...args);
    };
    const tx = { type: "port:write", portId: "p", txId: "drift", records: [
      { title: "First", fields: { text: "one" } }, { title: "Second", fields: { text: "two" }, bag: "second" },
    ] };
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "partial", applied: ["(default)"], failed: ["second"] });
    expect(await r.composite.get("First")).not.toBeNull();
    r.composite.addLayer({ bagId: "second", store: second, writable: true, defaultWritable: false });
    await r.send(tx);
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", applied: ["(default)", "second"] });
    expect(await second.get("Second")).not.toBeNull();
    await r.close();
  });

  test("port-ack-unsent-head: an ack beyond posted cursor leaves backlog; CONTROL: posted ack clears", async () => {
    const r = await rig({ lagByteBudget: 300 }); await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "A", text: "x".repeat(80) } }, origin); await settle();
    const posted = ofType(r.messages, "port:changes").at(-1)!.cursor;
    await r.composite.put({ tiddler: { title: "$:/StoryList", text: "hidden" } }, origin); await settle();
    const unsent = ofType(r.messages, "port:changes").at(-1)!.cursor.replace(/\d+$/, "2");
    await r.send({ type: "port:ack", portId: "p", cursor: unsent });
    await r.composite.put({ tiddler: { title: "B", text: "x".repeat(80) } }, origin); await settle();
    expect(ofType(r.messages, "port:reset").at(-1)?.reason).toBe("lagged");
    const c = await rig({ lagByteBudget: 300 }); await c.send(openMsg());
    await c.composite.put({ tiddler: { title: "A", text: "x".repeat(80) } }, origin); await settle();
    await c.send({ type: "port:ack", portId: "p", cursor: ofType(c.messages, "port:changes").at(-1)!.cursor });
    await c.composite.put({ tiddler: { title: "B", text: "x".repeat(80) } }, origin); await settle();
    expect(ofType(c.messages, "port:reset")).toHaveLength(0);
    expect(posted).toBeDefined();
    await r.close(); await c.close();
  });

  test("port-tw5-change-stales-render: local wiki event refuses old affordance; CONTROL: quiet render invokes", async () => {
    const r = await rig({ faceOf: () => ({}), authority: () => ({ allowed: true }) });
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const result = ofType(r.messages, "port:answer").at(-1)!.result as { renderCursor: string; value: { children: { affordances: { id: string }[] }[] } };
    const affordanceId = result.value.children.flatMap(child => child.affordances)[0]!.id;
    await r.send(askMsg("invoke", { renderCursor: result.renderCursor, affordanceId }));
    expect(r.invoked).toBe(1);
    r.wikiChange();
    await r.send(askMsg("invoke", { renderCursor: result.renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("stale-cursor");
    expect(r.invoked).toBe(1);
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    expect(r.wikiListenerCount).toBe(2);
    await r.close(); expect(r.wikiListenerCount).toBe(0);
  });
  test("port-echo-named-by-txid: the port echo names its tx; a foreign change carries no cause", async () => {
    const r = await rig();
    await r.send(openMsg());
    await r.send(writeMsg("tx", "Ordinary"));
    await r.composite.put({ tiddler: { title: "Foreign", text: "outside" } }, origin);
    const entries = ofType(r.messages, "port:changes").flatMap(message => message.entries);
    expect(entries.find(entry => entry.title === "Ordinary")?.causedBy).toEqual(["tx"]);
    expect(entries.find(entry => entry.title === "Foreign")?.causedBy).toEqual([]);
    await r.close();
  });

  test("port-written-follows-echo: one applied family echoes before its answer", async () => {
    const r = await rig();
    await r.send(openMsg());
    const before = r.messages.length;
    await r.send(writeMsg("tx", "Ordinary"));
    expect(r.messages.slice(before).map(message => message.type)).toEqual(["port:changes", "port:written"]);
    expect(ofType(r.messages.slice(before), "port:changes")).toHaveLength(1);
    expect(ofType(r.messages, "port:written")[0]?.status).toBe("applied");
    await r.close();
  });

  test("port-write-retry-is-idempotent: resend replays written with one change", async () => {
    const r = await rig();
    await r.send(openMsg());
    await r.send(writeMsg("tx", "Ordinary"));
    const original = ofType(r.messages, "port:written")[0];
    await r.composite.put({ tiddler: { title: "Foreign", text: "later" } }, origin);
    await r.send(writeMsg("tx", "Ordinary"));
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries)).toHaveLength(2);
    expect(ofType(r.messages, "port:written")).toHaveLength(2);
    expect(ofType(r.messages, "port:written")[1]).toEqual(original);
    await r.close();
  });

  test("port-write-refused-whole: a local title refuses the whole batch; ordinary title writes", async () => {
    const r = await rig();
    await r.send(openMsg());
    await r.send({ type: "port:write", portId: "p", txId: "bad", records: [
      { title: "Ordinary", fields: { text: "new" } }, { title: "$:/StoryList", fields: { text: "private" } },
    ] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "local-title" });
    expect(await r.composite.get("Ordinary")).toBeNull();
    await r.send(writeMsg("good", "Ordinary"));
    expect(await r.composite.get("Ordinary")).not.toBeNull();
    await r.close();
  });

  test("port-skinny-then-load: omitted text returns with its seq on load", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "Ordinary", text: "body", tags: "one" } }, origin);
    await r.send(openMsg("p", { width: "skinny" }));
    const record = ofType(r.messages, "port:snapshot")[0]?.records[0];
    expect(record?.fields.tags).toBe("one");
    expect(record?.fields).not.toHaveProperty("text");
    expect(record?.omitted).toContain("text");
    await r.send(askMsg("load", { titles: ["Ordinary"], fields: ["text"] }));
    expect(ofType(r.messages, "port:answer").at(-1)?.result).toEqual([expect.objectContaining({
      title: "Ordinary", seq: record?.seq, fields: { text: "body" },
    })]);
    await r.close();
  });

  test("port-storylist-stays-local: tier local change stays off wire; ordinary change travels", async () => {
    const r = await rig();
    await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "$:/StoryList", text: "private" } }, origin);
    await r.composite.put({ tiddler: { title: "Ordinary", text: "shared" } }, origin);
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries.map(entry => entry.title))).toEqual(["Ordinary"]);
    await r.close();
  });

  test("port-cursor-reset-on-width-change: another shape resets; same shape resumes", async () => {
    const r = await rig();
    await r.send(openMsg());
    const cursor = ofType(r.messages, "port:snapshot")[0]!.baseCursor;
    await r.send(openMsg("p", { since: cursor, width: "skinny" }));
    expect(ofType(r.messages, "port:reset").at(-1)?.reason).toBe("shape-changed");
    await r.send(openMsg("p", { since: cursor }));
    expect(ofType(r.messages, "port:reset")).toHaveLength(1);
    await r.close();
  });

  test("port-same-shape-cursor-resumes-without-snapshot-or-reset; CONTROL: retained change reaches reopen", async () => {
    const r = await rig();
    await r.send(openMsg());
    const cursor = ofType(r.messages, "port:snapshot")[0]!.baseCursor;
    await r.composite.put({ tiddler: { title: "AfterBase", text: "body" } }, origin);
    await settle();
    const before = r.messages.length;
    await r.send(openMsg("p", { since: cursor }));
    const resumed = r.messages.slice(before);
    expect(ofType(resumed, "port:snapshot")).toHaveLength(0);
    expect(ofType(resumed, "port:reset")).toHaveLength(0);
    expect(ofType(resumed, "port:changes").flatMap(message => message.entries.map(entry => entry.title))).toEqual(["AfterBase"]);
    await r.close();
  });

  test("non-admin-invoke-refused: claimed admin fails; CONTROL: proven admin fires", async () => {
    let role = "guest";
    const r = await rig({ faceOf: () => ({ role }), authority: req => (req.provenFace as { role: string }).role === "admin" ? { allowed: true } : { allowed: false, reason: "not-admin" } });
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const result = ofType(r.messages, "port:answer").at(-1)?.result as { renderCursor: string; value: { children: { affordances: { id: string }[] }[] } };
    const affordanceId = result.value.children.flatMap(child => child.affordances)[0]!.id;
    await r.send({ ...askMsg("invoke", { askId: "denied", renderCursor: result.renderCursor, affordanceId }), provenFace: { role: "admin" }, requestedBy: "admin" });
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("not-admin");
    expect(r.invoked).toBe(0);
    role = "admin";
    await r.send(askMsg("invoke", { askId: "allowed", renderCursor: result.renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.result).toEqual({ invoked: true });
    expect(r.invoked).toBe(1);
    await r.close();
  });

  test("ask-invoke-stale-cursor-refused: a changed rendered title invalidates admin's cursor", async () => {
    const r = await rig({ faceOf: () => ({}), authority: () => ({ allowed: true }) });
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const renderCursor = (ofType(r.messages, "port:answer").at(-1)?.result as { renderCursor: string }).renderCursor;
    await r.composite.put({ tiddler: { title: "Ordinary", text: "changed" } }, origin);
    await r.send(askMsg("invoke", { renderCursor, affordanceId: "forged" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("stale-cursor");
    expect(r.invoked).toBe(0);
    await r.close();
  });

  test("invoke-authority-rechecked-at-run: a later denial wins; admin render control invokes once", async () => {
    let allowed = true;
    const r = await rig({ faceOf: () => ({}), authority: () => allowed ? { allowed: true } : { allowed: false, reason: "revoked" } });
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const answer = ofType(r.messages, "port:answer").at(-1);
    expect(answer?.status).toBe("answered");
    const renderCursor = (answer?.result as { renderCursor: string }).renderCursor;
    const value = (answer?.result as { value: { affordances: { id: string }[]; children: { affordances: { id: string }[] }[] } }).value;
    const affordanceId = value.children.flatMap(child => child.affordances)[0]!.id;
    allowed = false;
    await r.send(askMsg("invoke", { askId: "denied", renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("revoked");
    allowed = true;
    await r.send(askMsg("invoke", { askId: "allowed", renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.result).toEqual({ invoked: true });
    expect(r.invoked).toBe(1);
    await r.close();
  });

  test("default makeWikiBehavior composition refuses invoke with no-authority", async () => {
    const behavior = makeWikiBehavior();
    const r = await rig({}, behavior);
    await r.send(openMsg());
    await r.send(askMsg("invoke", { renderCursor: "x", affordanceId: "a0" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("no-authority");
    await r.close();
  });

  test("presence beats fan out and port:close sends gone; one open peer controls fan out", async () => {
    const r = await rig();
    await r.send(openMsg("p"));
    await r.send(openMsg("q"));
    await r.send({ type: "port:presence", portId: "p", actorKey: "p", beat: 1, state: { cursor: "x" } });
    expect(ofType(r.messages, "port:presence")).toContainEqual(expect.objectContaining({ portId: "q", beat: 1 }));
    expect(ofType(r.messages, "port:presence").filter(message => message.portId === "p")).toHaveLength(0);
    await r.send(openMsg("fresh"));
    expect(ofType(r.messages, "port:presence")).toContainEqual(expect.objectContaining({ portId: "fresh", beat: 1 }));
    await r.send({ type: "port:close", portId: "p" });
    expect(ofType(r.messages, "port:presence")).toContainEqual(expect.objectContaining({ portId: "q", gone: true }));
    await r.close();
  });

  test("closed queued write refuses to land; CONTROL: a live write lands", async () => {
    const r = await rig();
    await r.send(openMsg());
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const original = r.composite.precheckFamily.bind(r.composite);
    r.composite.precheckFamily = async (...args) => { await held; return original(...args); };
    await r.send(writeMsg("closed", "Closed"));
    await r.send({ type: "port:close", portId: "p" });
    release(); await settle();
    expect(await r.composite.get("Closed")).toBeNull();
    expect(ofType(r.messages, "port:written")).toHaveLength(0);
    await r.send(openMsg());
    await r.send(writeMsg("live", "Live"));
    expect(await r.composite.get("Live")).not.toBeNull();
    await r.close();
  });

  test("supersession stops after an in-flight family; CONTROL: the first family may finish", async () => {
    const r = await rig({ actorOf: portId => portId === "p" || portId === "new" ? "same-bound-actor" : undefined });
    r.composite.addLayer({ bagId: "other", store: new MemoryTiddlerStore("other"), writable: true, defaultWritable: false });
    await r.send(openMsg());
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const original = r.composite.writeFamily.bind(r.composite);
    let calls = 0;
    r.composite.writeFamily = async (...args) => { calls++; if (calls === 1) await held; return original(...args); };
    await r.send({ type: "port:write", portId: "p", txId: "stopped", records: [
      { title: "First", fields: { text: "one" } }, { title: "Second", fields: { text: "two" }, bag: "other" },
    ] });
    await r.send(openMsg("new", { actor: "p" }));
    release(); await settle();
    expect(calls).toBe(1);
    expect(await r.composite.get("First")).not.toBeNull();
    expect(await r.composite.get("Second")).toBeNull();
    expect(ofType(r.messages, "port:written")).toHaveLength(0);
    await r.close();
  });

  test("port-committed-family-survives-supersession-retry; CONTROL: live family records and answers", async () => {
    const r = await rig({ actorOf: portId => portId === "p" || portId === "successor" ? "bound-writer" : undefined });
    r.composite.addLayer({ bagId: "other", store: new MemoryTiddlerStore("other"), writable: true, defaultWritable: false });
    await r.send(openMsg());
    let firstChanges = 0;
    r.store.subscribe(change => { if (change.title === "First") firstChanges++; });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const original = r.composite.writeFamily.bind(r.composite);
    r.composite.writeFamily = async (...args) => {
      await original(...args);
      if (args[0].some(record => record.tiddler.title === "First")) await held;
    };
    const tx: PortMsg_Write = { type: "port:write", portId: "p", txId: "committed-before-close", records: [
      { title: "First", fields: { text: "one" } },
      { title: "Second", fields: { text: "two" }, bag: "other" },
    ] };
    await r.send(tx);
    expect(firstChanges).toBe(1);
    await r.send(openMsg("successor"));
    release(); await settle();
    expect(ofType(r.messages, "port:written")).toHaveLength(0);
    await r.send({ ...tx, portId: "successor" });
    expect(firstChanges).toBe(1);
    expect(await r.composite.get("Second")).not.toBeNull();
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ portId: "successor", status: "applied", applied: ["(default)", "other"] });
    await r.send({ ...writeMsg("live-control", "Live"), portId: "successor" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ portId: "successor", status: "applied", applied: ["(default)"] });
    await r.close();
  });

  test("late invalid family refuses whole transaction; CONTROL: two valid families land", async () => {
    const r = await rig();
    r.composite.addLayer({ bagId: "other", store: new MemoryTiddlerStore("other"), writable: true, defaultWritable: false });
    await r.send(openMsg());
    await r.send({ type: "port:write", portId: "p", txId: "invalid", records: [
      { title: "First", fields: { text: "one" } },
      { title: "lar://mara:operator@room/heading.angle.dynamic", fields: { text: "bad" }, bag: "other" },
    ] });
    expect(await r.composite.get("First")).toBeNull();
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "session-form-title" });
    await r.send({ type: "port:write", portId: "p", txId: "valid", records: [
      { title: "First", fields: { text: "one" } }, { title: "Second", fields: { text: "two" }, bag: "other" },
    ] });
    expect(await r.composite.get("First")).not.toBeNull();
    expect(await r.composite.get("Second")).not.toBeNull();
    await r.close();
  });

  test("port-precheck-refusals-release-window: 128 distinct invalid families cannot poison a later write; CONTROL: valid family lands", async () => {
    const r = await rig();
    await r.send(openMsg());
    for (let index = 0; index < 128; index++) {
      await r.send(writeMsg(`refused-${index}`, `lar://mara:operator@room/heading.angle.dynamic/${index}`));
      expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", reason: "session-form-title" });
    }
    await r.send(writeMsg("after-refusals", "ValidAfterRefusals"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", txId: "after-refusals" });
    expect(await r.composite.get("ValidAfterRefusals")).not.toBeNull();
    await r.close();
  });

  test("family changes batch once and foreign prefix carries no cause; CONTROL: port token carries tx", async () => {
    const r = await rig(); await r.send(openMsg());
    await r.send({ type: "port:write", portId: "p", txId: "tx", records: [
      { title: "A", fields: { text: "a" } }, { title: "B", fields: { text: "b" } },
    ] });
    const own = ofType(r.messages, "port:changes").filter(message => message.entries.some(entry => entry.title === "A"));
    expect(own).toHaveLength(1);
    expect(own[0]!.entries.map(entry => entry.causedBy)).toEqual([["tx"], ["tx"]]);
    expect(own[0]!.entries[1]!.seq).toBe(own[0]!.entries[0]!.seq + 1);
    await r.composite.put({ tiddler: { title: "Foreign", text: "x" } }, { kind: "tw-local", instanceId: "port:p:forged" });
    await settle();
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).find(entry => entry.title === "Foreign")?.causedBy).toEqual([]);
    await r.close();
  });

  test("snapshot held read buffers foreign change after chunks; CONTROL: unchanged title stays in chunk", async () => {
    const r = await rig();
    await r.composite.put({ tiddler: { title: "Changed", text: "old" } }, origin);
    await r.composite.put({ tiddler: { title: "Steady", text: "still" } }, origin);
    await settle();
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const original = r.composite.entries.bind(r.composite);
    r.composite.entries = async () => { const value = await original(); await held; return value; };
    await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "Changed", text: "new" } }, origin);
    await settle();
    expect(ofType(r.messages, "port:changes")).toHaveLength(0);
    release(); await settle();
    const chunks = ofType(r.messages, "port:snapshot");
    expect(chunks.flatMap(chunk => chunk.records.map(record => record.title))).toEqual(["Steady"]);
    expect(r.messages.findIndex(message => message.type === "port:changes")).toBeGreaterThan(r.messages.findIndex(message => message.type === "port:snapshot"));
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "Changed")).toHaveLength(1);
    await r.close();
  });

  test("lag without ack resets; CONTROL: acked changes continue", async () => {
    const r = await rig({ lagByteBudget: 300 }); await r.send(openMsg());
    await r.composite.put({ tiddler: { title: "A", text: "x".repeat(80) } }, origin); await settle();
    const cursor = ofType(r.messages, "port:changes").at(-1)?.cursor;
    expect(cursor).toBeDefined();
    await r.send({ type: "port:ack", portId: "p", cursor: cursor! });
    await r.composite.put({ tiddler: { title: "B", text: "x".repeat(80) } }, origin); await settle();
    expect(ofType(r.messages, "port:reset")).toHaveLength(0);
    await r.composite.put({ tiddler: { title: "C", text: "x".repeat(80) } }, origin); await settle();
    expect(ofType(r.messages, "port:reset").at(-1)?.reason).toBe("lagged");
    await r.close();
  });

  test("presence key binds to actor and transportGone fans gone; CONTROL: own key fans state", async () => {
    const cap = hasRecordPort(); const r = await rig({}, cap);
    await r.send(openMsg("p")); await r.send(openMsg("q"));
    await r.send({ type: "port:presence", portId: "p", actorKey: "q", beat: 1, state: {} });
    expect(ofType(r.messages, "port:presence")).toHaveLength(0);
    await r.send({ type: "port:presence", portId: "p", actorKey: "p", beat: 1, state: {} });
    expect(ofType(r.messages, "port:presence").at(-1)).toMatchObject({ portId: "q", actorKey: "p" });
    cap.transportGone("p");
    expect(ofType(r.messages, "port:presence").at(-1)).toMatchObject({ portId: "q", actorKey: "p", gone: true });
    await r.close();
  });

  test("port-presence-uses-bound-actor-when-lent; CONTROL: unlent port keeps claimed presence label", async () => {
    const cap = hasRecordPort({ actorOf: portId => portId === "bound-port" ? "bound-actor" : undefined });
    const r = await rig({}, cap);
    await r.send(openMsg("bound-port", { actor: "display-label" }));
    await r.send(openMsg("peer"));
    await r.send({ type: "port:presence", portId: "bound-port", actorKey: "display-label", beat: 1, state: {} });
    expect(ofType(r.messages, "port:presence")).toHaveLength(0);
    await r.send({ type: "port:presence", portId: "bound-port", actorKey: "bound-actor", beat: 1, state: {} });
    expect(ofType(r.messages, "port:presence").at(-1)).toMatchObject({ portId: "peer", actorKey: "bound-actor" });
    await r.send(openMsg("unlent", { actor: "claimed-label" }));
    await r.send({ type: "port:presence", portId: "unlent", actorKey: "claimed-label", beat: 1, state: {} });
    expect(ofType(r.messages, "port:presence").at(-1)).toMatchObject({ portId: "peer", actorKey: "claimed-label" });
    await r.close();
  });

  test("port-presence-reused-id-publishes-after-reopen; CONTROL: superseded id stays silent until reopen", async () => {
    const r = await rig({ actorOf: portId => portId === "p1" || portId === "p2" ? "actor-a" : undefined });
    await r.send(openMsg("peer"));
    await r.send(openMsg("p1"));
    await r.send({ type: "port:presence", portId: "p1", actorKey: "actor-a", beat: 1, state: "first" });
    await r.send(openMsg("p2"));
    const beforeStale = ofType(r.messages, "port:presence").length;
    await r.send({ type: "port:presence", portId: "p1", actorKey: "actor-a", beat: 2, state: "stale" });
    expect(ofType(r.messages, "port:presence")).toHaveLength(beforeStale);
    await r.send({ type: "port:close", portId: "p2" });
    await r.send(openMsg("p1"));
    await r.send({ type: "port:presence", portId: "p1", actorKey: "actor-a", beat: 3, state: "reopened" });
    expect(ofType(r.messages, "port:presence").at(-1)).toMatchObject({ portId: "peer", actorKey: "actor-a", beat: 3, state: "reopened" });
    await r.close();
  });

  test("actor ledger survives reopen; CONTROL: new tx writes once", async () => {
    const r = await rig(); await r.send(openMsg()); await r.send(writeMsg("tx", "Once"));
    await r.send(openMsg()); await r.send(writeMsg("tx", "Once"));
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "Once")).toHaveLength(1);
    expect(ofType(r.messages, "port:written")).toHaveLength(2);
    await r.send(writeMsg("next", "Next"));
    expect(await r.composite.get("Next")).not.toBeNull();
    await r.close();
  });

  test("port-claimed-actor-cannot-supersede-or-select-ledger-or-edit: guest claims editor; CONTROL: editor stays live", async () => {
    const edits: Array<[string, string]> = [];
    const r = await rig({ mayEdit: (portId, actor) => { edits.push([portId, actor]); return actor === "editor-port"; } });
    await r.send(openMsg("editor-port", { actor: "editor", edits: true }));
    await r.send({ ...writeMsg("shared-id", "First"), portId: "editor-port" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", portId: "editor-port" });
    await r.send(openMsg("guest-port", { actor: "editor", edits: true }));
    await r.send({ ...writeMsg("shared-id", "First"), portId: "guest-port" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "refused", portId: "guest-port", reason: "edits-not-granted" });
    expect(edits).toContainEqual(["guest-port", "guest-port"]);
    expect(edits).not.toContainEqual(["guest-port", "editor"]);
    await r.send({ ...writeMsg("editor-next", "Second"), portId: "editor-port" });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", portId: "editor-port" });
    expect(await r.composite.get("Second")).not.toBeNull();
    await r.close();
  });

  test("port-bound-actor-reopen-supersedes-and-keeps-ledger; CONTROL: same tx replays once", async () => {
    const r = await rig({ actorOf: portId => portId === "first-port" || portId === "second-port" ? "editor-bound" : undefined,
      mayEdit: (_portId, actor) => actor === "editor-bound" });
    await r.send(openMsg("first-port", { actor: "first-label" }));
    await r.send({ ...writeMsg("once", "Once"), portId: "first-port" });
    const firstAnswer = ofType(r.messages, "port:written").at(-1)!;
    await r.send(openMsg("second-port", { actor: "second-label" }));
    await r.send({ ...writeMsg("once", "Once"), portId: "second-port" });
    expect(ofType(r.messages, "port:written").at(-1)).toEqual({ ...firstAnswer, portId: "second-port" });
    expect(ofType(r.messages, "port:changes").flatMap(message => message.entries).filter(entry => entry.title === "Once")).toHaveLength(1);
    await r.send({ ...writeMsg("stale-port", "Never"), portId: "first-port" });
    expect(await r.composite.get("Never")).toBeNull();
    await r.close();
  });

  test("forged affordance and transcluded change refuse; CONTROL: offered affordance fires", async () => {
    const r = await rig({ faceOf: () => ({}), authority: () => ({ allowed: true }) });
    await r.composite.put({ tiddler: { title: "Ordinary", text: "{{Transcluded}}" } }, origin);
    await r.composite.put({ tiddler: { title: "Transcluded", text: "before" } }, origin);
    await settle();
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const result = ofType(r.messages, "port:answer").at(-1)!.result as { renderCursor: string; value: { children: { affordances: { id: string }[] }[] } };
    const affordanceId = result.value.children.flatMap(child => child.affordances)[0]!.id;
    await r.send(askMsg("invoke", { renderCursor: result.renderCursor, affordanceId: "forged" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("unknown-affordance");
    await r.send(askMsg("invoke", { renderCursor: result.renderCursor, affordanceId }));
    expect(r.invoked).toBe(1);
    await r.composite.put({ tiddler: { title: "Transcluded", text: "changed" } }, origin); await settle();
    await r.send(askMsg("invoke", { renderCursor: result.renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("stale-cursor");
    expect(r.invoked).toBe(1);
    await r.close();
  });
});
