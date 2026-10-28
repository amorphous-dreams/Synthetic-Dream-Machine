import { afterEach, describe, expect, it } from "vitest";
import { makeGlassPortAdaptor } from "../src/glass-port-adaptor.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { pump, realPort } from "./record-port-real-rig.js";
import type { RecordPortOptions } from "../src/record-port-handler.js";

type Rig = Awaited<ReturnType<typeof realPort>>;
const opened: Rig[] = [];
afterEach(async () => { for (const rig of opened.splice(0)) await rig.close(); });

async function glass(width: "full" | "skinny" = "full", seed?: { title: string; text: string }, options: RecordPortOptions = {}) {
  const island = await bootTestWiki();
  const wiki = await bootTestWiki();
  const rig = await realPort(options, island);
  opened.push(rig);
  if (seed) await rig.composite.put({ tiddler: { title: seed.title, text: seed.text } }, { kind: "tw-local", instanceId: "foreign" });
  const sent: Array<{ type: string; [key: string]: unknown }> = [];
  const listeners = new Set<(msg: any) => void>();
  let delivered = 0;
  const transport = {
    send(msg: { type: string; [key: string]: unknown }) { sent.push(msg); void rig.send(msg); },
    onMessage(listener: (msg: any) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  let next = 0;
  const adaptor = makeGlassPortAdaptor({ wiki: wiki.wiki, Tiddler: wiki.$tw.Tiddler,
    transport, portId: "p", wikiUri: "wiki", actor: "p", width, mintTx: () => `tx-${++next}` });
  async function settle() {
    for (let i = 0; i < 5; i++) {
      await pump();
      const batch = rig.messages.slice(delivered);
      delivered = rig.messages.length;
      for (const msg of batch) for (const listener of listeners) listener(msg);
    }
    await pump();
  }
  await settle();
  return { rig, wiki, adaptor, sent, settle, deliver: (msg: any) => { for (const listener of listeners) listener(msg); } };
}

describe.skipIf(!!wikiSkip)(`glass port adaptor over the real island${skipNote}`, () => {
  it("glass-echo-lands-once; CONTROL foreign peer write lands once", async () => {
    const g = await glass();
    let lands = 0;
    g.adaptor.onLanded(({ title }) => { if (title === "Page") lands++; });
    g.wiki.setTiddler({ title: "Page", text: "local" });
    await g.settle();
    expect(g.sent.filter(msg => msg.type === "port:write")).toHaveLength(1);
    expect(lands).toBe(0);
    expect(g.wiki.wiki.getTiddler("Page")?.fields.text).toBe("local");
    await g.rig.composite.put({ tiddler: { title: "Page", text: "peer" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    expect(lands).toBe(1);
    expect(g.wiki.wiki.getTiddler("Page")?.fields.text).toBe("peer");
  });

  it("glass-skinny-body-loads-on-open; CONTROL full width needs no ask", async () => {
    const skinny = await glass("skinny", { title: "Page", text: "body" });
    expect(skinny.wiki.wiki.getTiddler("Page")?.fields.text).toBeUndefined();
    expect(skinny.adaptor.omittedFields("Page")).toContain("text");
    const loading = skinny.adaptor.openBody("Page");
    await skinny.settle();
    await expect(loading).resolves.toBe("body");
    expect(skinny.wiki.wiki.getTiddler("Page")?.fields.text).toBe("body");
    expect(skinny.sent.filter(msg => msg.type === "port:ask")).toHaveLength(1);
    const full = await glass("full", { title: "Page", text: "body" });
    expect(full.wiki.wiki.getTiddler("Page")?.fields.text).toBe("body");
    await expect(full.adaptor.openBody("Page")).resolves.toBe("body");
    expect(full.sent.filter(msg => msg.type === "port:ask")).toHaveLength(0);
  });

  it("glass-peer-edit-presence-reads-aloud; CONTROL tier-local titles stay quiet", async () => {
    const g = await glass("full", { title: "Page", text: "old" });
    const peers: string[] = []; const presence: string[] = [];
    g.adaptor.onPeerEdit(({ title }) => peers.push(title));
    g.adaptor.onPresence(msg => presence.push(msg.actorKey));
    g.deliver({ type: "port:presence", portId: "p", actorKey: "friend", beat: 1 });
    await g.rig.composite.put({ tiddler: { title: "Page", text: "new" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    expect(peers).toEqual(["Page"]);
    expect(presence).toEqual(["friend"]);
    g.wiki.setTiddler({ title: "$:/temp/local", text: "private" });
    await g.settle();
    expect(g.sent.filter(msg => msg.type === "port:write")).toHaveLength(0);
    expect(peers).toEqual(["Page"]);
  });

  it("refused write rolls back; CONTROL applied write stays", async () => {
    const g = await glass("full", { title: "Page", text: "base" }, { mayEdit: () => false });
    const reasons: string[] = [];
    g.adaptor.onRefused(result => reasons.push(result.reason));
    g.wiki.setTiddler({ title: "Page", text: "hope" });
    await g.settle();
    expect(g.wiki.wiki.getTiddler("Page")?.fields.text).toBe("base");
    expect(reasons).toEqual(["edits-not-granted"]);
    const applied = await glass("full", { title: "Page", text: "base" });
    applied.wiki.setTiddler({ title: "Page", text: "accepted" });
    await applied.settle();
    expect(applied.wiki.wiki.getTiddler("Page")?.fields.text).toBe("accepted");
  });

  it("landing carries its own origin tag and never posts", async () => {
    const g = await glass("full", { title: "Page", text: "landed" });
    expect(g.sent.filter(msg => msg.type === "port:write")).toHaveLength(0);
    expect(g.wiki.wiki.getTiddler("Page")?.fields.text).toBe("landed");
  });
});
