import { describe, expect, test } from "vitest";
import { CompositeStore, type IslandToVesselMsg } from "@lararium/mesh";
import { AtomicMemoryStore } from "./atomic-memory-store.js";
import { hasRecordPort } from "../src/record-port-handler.js";
import type { IslandContext } from "../src/island-context.js";

const origin = { kind: "tw-local", instanceId: "foreign" } as const;
const settle = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };

describe("browser info record tier", () => {
  test("port-info-browser-local-on-write-and-change; CONTROL: ordinary and other info titles travel", async () => {
    const composite = new CompositeStore();
    const store = new AtomicMemoryStore("working");
    composite.addLayer({ bagId: "working", store, writable: true });
    const messages: IslandToVesselMsg[] = [];
    const ctx = { wikiUri: "wiki", composite, tw5: { $tw: { wiki: {} } },
      post: (message: IslandToVesselMsg) => messages.push(message) } as unknown as IslandContext;
    const cap = hasRecordPort({ mayEdit: () => true });
    const cleanup = cap.onEa?.(ctx);
    const send = async (msg: { type: string }) => { expect(cap.onSignal?.(msg.type, msg, ctx)).toBe(true); await settle(); };
    await composite.put({ tiddler: { title: "$:/info/browser/seed", text: "hidden" } }, origin);
    await composite.put({ tiddler: { title: "$:/info/browser", text: "bare hidden" } }, origin);
    await composite.put({ tiddler: { title: "$:/info/other/x", text: "visible" } }, origin);
    await composite.put({ tiddler: { title: "Ordinary", text: "visible" } }, origin);
    await send({ type: "port:open", portId: "p", wikiUri: "wiki", actor: "p", width: "full", edits: true,
      maxRecordBytes: 4096, maxBatchBytes: 8192 });
    const snapshot = messages.filter(message => message.type === "port:snapshot").flatMap(message => message.records);
    expect(snapshot.map(record => record.title)).not.toContain("$:/info/browser/seed");
    expect(snapshot.map(record => record.title)).not.toContain("$:/info/browser");
    expect(snapshot.map(record => record.title)).toContain("$:/info/other/x");
    expect(snapshot.map(record => record.title)).toContain("Ordinary");
    for (const title of ["$:/info/browser/x", "$:/info/browser", "$:/state", "$:/temp", "$:/status"]) {
      await send({ type: "port:write", portId: "p", txId: `refuse-${title}`, records: [{ title, fields: { text: "blocked" } }] });
      expect(messages.filter(message => message.type === "port:written").at(-1)).toMatchObject({ status: "refused", reason: "local-title" });
    }
    await composite.put({ tiddler: { title: "$:/info/browser/live", text: "hidden" } }, origin);
    await composite.put({ tiddler: { title: "$:/info/other/live", text: "visible" } }, origin);
    await settle();
    const changed = messages.filter(message => message.type === "port:changes").flatMap(message => message.entries.map(entry => entry.title));
    expect(changed).not.toContain("$:/info/browser/live");
    expect(changed).toContain("$:/info/other/live");
    await send({ type: "port:write", portId: "p", txId: "ordinary", records: [{ title: "WrittenOrdinary", fields: { text: "yes" } }] });
    expect(messages.filter(message => message.type === "port:written").at(-1)).toMatchObject({ txId: "ordinary", status: "applied" });
    if (typeof cleanup === "function") await cleanup();
  });
});
