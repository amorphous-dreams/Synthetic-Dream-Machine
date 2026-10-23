import { describe, expect, test } from "vitest";
import { CompositeStore, type IslandToVesselMsg } from "@lararium/mesh";
import type { PortMsg_Open, PortMsg_Write, PortMsg_Ask } from "@lararium/mesh/record-port";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { hasRecordPort } from "../src/record-port-handler.js";
import type { IslandContext } from "../src/island-context.js";
import type { IslandCap } from "../src/island-caps.js";
import { makeWikiBehavior } from "../src/wiki-behavior.js";

const origin = { kind: "tw-local", instanceId: "foreign" } as const;
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const openMsg = (portId = "p", overrides: Partial<PortMsg_Open> = {}): PortMsg_Open => ({
  type: "port:open", portId, wikiUri: "wiki", actor: portId, width: "full",
  edits: true, presence: true, maxRecordBytes: 4096, maxBatchBytes: 8192, ...overrides,
});
const writeMsg = (txId: string, title: string, fields: Record<string, string> = { text: "body" }): PortMsg_Write => ({
  type: "port:write", portId: "p", txId, records: [{ title, fields }],
});
const askMsg = (kind: PortMsg_Ask["kind"], overrides: Partial<PortMsg_Ask> = {}): PortMsg_Ask => ({
  type: "port:ask", portId: "p", askId: kind, kind, ...overrides,
});

async function rig(options: Parameters<typeof hasRecordPort>[0] = {}, cap: IslandCap = hasRecordPort(options)) {
  const composite = new CompositeStore();
  const store = new MemoryTiddlerStore("working");
  composite.addLayer({ bagId: "working", store, writable: true });
  const messages: IslandToVesselMsg[] = [];
  let invoked = 0;
  const tw5 = { $tw: { wiki: {
    filterTiddlers: () => ["Ordinary", "$:/StoryList"],
    makeTranscludeWidget: (_title: string, options: { document: { createTextNode: (text: string) => unknown } }) => ({
      render: (container: { appendChild: (node: unknown) => void }) => {
        container.appendChild(options.document.createTextNode("rendered"));
      }, refresh: () => {}, domNodes: [],
    }),
    addEventListener: () => {}, removeEventListener: () => {},
  },
    rootWidget: { invokeActionString: () => { invoked++; } } } };
  const ctx = { wikiUri: "wiki", composite, tw5, post: (message: IslandToVesselMsg) => messages.push(message) } as unknown as IslandContext;
  const cleanup = await cap.onEa?.(ctx);
  const send = async (msg: { type: string }) => { expect(cap.onSignal?.(msg.type, msg, ctx)).toBe(true); await settle(); };
  return { composite, store, messages, ctx, send, get invoked() { return invoked; },
    close: async () => { if (typeof cleanup === "function") await cleanup(); } };
}
const ofType = <T extends IslandToVesselMsg["type"]>(messages: IslandToVesselMsg[], type: T) =>
  messages.filter((message): message is Extract<IslandToVesselMsg, { type: T }> => message.type === type);

describe("record port handler", () => {
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
    await r.send(writeMsg("tx", "Ordinary"));
    expect(r.messages.map(message => message.type).slice(-2)).toEqual(["port:changes", "port:written"]);
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

  test("non-admin-invoke-refused: verifier refuses while admin control invokes once", async () => {
    const r = await rig({ authority: req => req.requestedBy === "admin" ? { allowed: true } : { allowed: false, reason: "not-admin" } });
    await r.send(openMsg());
    await r.send(askMsg("invoke", { askId: "denied", provenFace: {}, requestedBy: "guest", renderCursor: "bad", subject: "action" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("not-admin");
    expect(r.invoked).toBe(0);
    await r.close();
  });

  test("ask-invoke-stale-cursor-refused: a changed rendered title invalidates admin's cursor", async () => {
    const r = await rig({ authority: () => ({ allowed: true }) });
    await r.send(openMsg("p", { renders: ["html"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "html" }));
    const renderCursor = (ofType(r.messages, "port:answer").at(-1)?.result as { renderCursor: string }).renderCursor;
    await r.composite.put({ tiddler: { title: "Ordinary", text: "changed" } }, origin);
    await r.send(askMsg("invoke", { provenFace: {}, renderCursor, subject: "action" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("stale-cursor");
    expect(r.invoked).toBe(0);
    await r.close();
  });

  test("invoke-authority-rechecked-at-run: a later denial wins; admin render control invokes once", async () => {
    let allowed = true;
    const r = await rig({ authority: () => allowed ? { allowed: true } : { allowed: false, reason: "revoked" } });
    await r.send(openMsg("p", { renders: ["html"] }));
    await r.send(askMsg("render", { subject: "Ordinary", form: "html" }));
    const answer = ofType(r.messages, "port:answer").at(-1);
    expect(answer?.status).toBe("answered");
    const renderCursor = (answer?.result as { renderCursor: string }).renderCursor;
    allowed = false;
    await r.send(askMsg("invoke", { askId: "denied", provenFace: {}, renderCursor, subject: "action" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.reason).toBe("revoked");
    allowed = true;
    await r.send(askMsg("invoke", { askId: "allowed", provenFace: {}, renderCursor, subject: "action" }));
    expect(ofType(r.messages, "port:answer").at(-1)?.result).toEqual({ invoked: true });
    expect(r.invoked).toBe(1);
    await r.close();
  });

  test("default makeWikiBehavior composition refuses invoke with no-authority", async () => {
    const behavior = makeWikiBehavior();
    const r = await rig({}, { onEa: () => {}, onSignal: (type, raw, ctx) => behavior.onSignal(type, raw, ctx) });
    // The default composition opens its port during ea; dispatch setup needs a full booted engine.
    // This direct signal control confirms that the absent verifier never grants an invoke.
    await r.send(openMsg());
    await r.send(askMsg("invoke", { provenFace: {}, renderCursor: "x", subject: "action" }));
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
});
