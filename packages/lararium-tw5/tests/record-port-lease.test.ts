import { describe, expect, test } from "vitest";
import { CompositeStore, type IslandToVesselMsg } from "@lararium/mesh";
import type { PortMsg_Open, PortMsg_Write, PortMsg_Ask } from "@lararium/mesh/record-port";
import { AtomicMemoryStore as MemoryTiddlerStore } from "./atomic-memory-store.js";
import { hasRecordPort } from "../src/record-port-handler.js";
import type { PortGrant } from "@lararium/mesh/record-port";
import { bagUri } from "@lararium/mesh";
import { kahuHand } from "../../lararium-mesh/tests/kahu-reach-fixture.js";
import type { IslandContext } from "../src/island-context.js";
import type { IslandCap } from "../src/island-caps.js";
import { makeWikiBehavior } from "../src/wiki-behavior.js";

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

async function rig(options: Parameters<typeof hasRecordPort>[0] = {}, cap: IslandCap = hasRecordPort({ mayEdit: () => true, bagGrant: () => true, ...options }), beforeEa?: (composite: CompositeStore) => void) {
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

const grant = (overrides: Partial<PortGrant> = {}): PortGrant =>
  ({ faceId: "face", actor: "actor", edits: true, bags: ["b"], admin: false, ...overrides });
const lease = (value: PortGrant, portId = "p") => ({ type: "port:lease", portId, grant: value });

describe("composed record port lease", () => {
  test("no-lease-open-resets-and-holds-nothing; CONTROL: leased write echoes its txId", async () => {
    const r = await rig({}, makeWikiBehavior());
    await r.send(openMsg());
    expect(ofType(r.messages, "port:reset").at(-1)).toMatchObject({ portId: "p", reason: "lagged" });
    await r.send(writeMsg("unheld", "NoLease"));
    expect(await r.composite.get("NoLease")).toBeNull();
    expect(ofType(r.messages, "port:written")).toHaveLength(0);
    await r.send(lease(grant()));
    await r.send(openMsg());
    await r.send(writeMsg("leased", "Leased"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied", txId: "leased" });
    expect(ofType(r.messages, "port:changes").flatMap(msg => msg.entries).find(entry => entry.title === "Leased")?.causedBy).toEqual(["leased"]);
    expect(await r.composite.get("Leased")).not.toBeNull();
    await r.close();
  });

  test("edits-and-explicit-bag-follow-the-grant; CONTROL: granted bag writes", async () => {
    const r = await rig({}, makeWikiBehavior());
    r.composite.addLayer({ bagId: "b", store: new MemoryTiddlerStore("b"), writable: true, defaultWritable: false });
    await r.send(lease(grant({ edits: false })));
    await r.send(openMsg());
    await r.send(writeMsg("denied", "Denied"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ reason: "edits-not-granted" });
    await r.send(lease(grant()));
    await r.send({ ...writeMsg("bag", "Bag"), records: [{ title: "Bag", fields: { text: "body" }, bag: "b" }] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied" });
    await r.send({ ...writeMsg("other", "Other"), records: [{ title: "Other", fields: { text: "body" }, bag: "other" }] });
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ reason: "bag-not-granted" });
    await r.close();
  });

  test("admin-grant-controls-invoke; CONTROL: admin invokes once", async () => {
    const r = await rig({}, makeWikiBehavior());
    await r.send(lease(grant()));
    await r.send(openMsg("p", { renders: ["blocks"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "blocks" }));
    const answer = ofType(r.messages, "port:answer").at(-1);
    const result = answer?.result as { renderCursor: string; value: { children: { affordances: { id: string }[] }[] } };
    const affordanceId = result.value.children.flatMap(child => child.affordances)[0]!.id;
    await r.send(askMsg("invoke", { askId: "denied", renderCursor: result.renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ reason: "not-admin" });
    await r.send(lease(grant({ admin: true })));
    await r.send(askMsg("invoke", { askId: "allowed", renderCursor: result.renderCursor, affordanceId }));
    expect(ofType(r.messages, "port:answer").at(-1)?.result).toEqual({ invoked: true });
    expect(r.invoked).toBe(1);
    await r.close();
  });

  test("face-change-retires-open-port; CONTROL: same face continues", async () => {
    const r = await rig({}, makeWikiBehavior());
    await r.send(lease(grant()));
    await r.send(openMsg());
    await r.send(lease(grant({ edits: false })));
    await r.send(askMsg("filter", { askId: "same", subject: "[all[]]" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).not.toBe("face-changed");
    await r.send(lease(grant({ faceId: "another" })));
    await r.send(askMsg("filter", { askId: "moved", subject: "[all[]]" }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ reason: "face-changed" });
    await r.close();
  });

  test("port-gone-retires-a-port-and-fans-out-presence; CONTROL: live port receives a beat", async () => {
    const r = await rig({}, makeWikiBehavior());
    await r.send(lease(grant(), "p"));
    await r.send(lease(grant({ actor: "other" }), "q"));
    await r.send(openMsg("p"));
    await r.send(openMsg("q"));
    await r.send({ type: "port:presence", portId: "p", actorKey: "actor", beat: 1 });
    expect(ofType(r.messages, "port:presence")).toContainEqual(expect.objectContaining({ portId: "q", beat: 1 }));
    await r.send({ type: "port:gone", portId: "p" });
    expect(ofType(r.messages, "port:presence")).toContainEqual(expect.objectContaining({ portId: "q", gone: true }));
    const answers = ofType(r.messages, "port:answer").length;
    await r.send(askMsg("filter", { askId: "after", subject: "[all[]]" }));
    expect(ofType(r.messages, "port:answer")).toHaveLength(answers);
    await r.close();
  });

  test("system-canon-write-requires-kahu-reach; CONTROL: proven cabal facts admit it", async () => {
    const bag = bagUri("lares");
    const r = await rig({}, makeWikiBehavior());
    r.composite.addLayer({ bagId: bag, store: new MemoryTiddlerStore(bag), writable: true, defaultWritable: false });
    await r.send(lease(grant({ bags: [bag] })));
    await r.send(openMsg());
    const write = (txId: string, title: string) => ({ ...writeMsg(txId, title), records: [{ title, fields: { text: "body" }, bag }] });
    await r.send(write("stranger", "Stranger"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ reason: "kahu-reach" });
    const source = await kahuHand();
    await r.send(lease(grant({ bags: [bag], kahu: await source() })));
    await r.send(write("kahu", "Kahu"));
    expect(ofType(r.messages, "port:written").at(-1)).toMatchObject({ status: "applied" });
    await r.close();
  });

  test("cas-ask-reads-only-a-public-grant-tier; CONTROL: public bytes answer", async () => {
    const bytes = new TextEncoder().encode("public body");
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const cid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const r = await rig({}, makeWikiBehavior());
    let reads = 0;
    r.ctx.resolveByCid = async () => { reads++; return bytes; };
    await r.send(lease(grant()));
    await r.send(openMsg());
    await sendAwait(r, askMsg("cas", { askId: "unknown", subject: cid }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ reason: "cas-tier-unknown" });
    expect(reads).toBe(0);
    await r.send(lease(grant({ casTier: { [cid]: "public" } })));
    await sendAwait(r, askMsg("cas", { askId: "public", subject: cid }));
    expect(ofType(r.messages, "port:answer").at(-1)).toMatchObject({ status: "answered" });
    expect(reads).toBe(1);
    await r.close();
  });
});

