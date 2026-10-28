import { describe, expect, it } from "vitest";
import { makeGlassPortAdaptor } from "../src/glass-port-adaptor.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { pump } from "./record-port-real-rig.js";

async function glass() {
  const wiki = await bootTestWiki();
  const sent: any[] = [];
  const listeners = new Set<(msg: any) => void>();
  let serial = 0;
  const adaptor = makeGlassPortAdaptor({ wiki: wiki.wiki, Tiddler: wiki.$tw.Tiddler,
    transport: { send(msg) { sent.push(msg); }, onMessage(listener) {
      listeners.add(listener); return () => { listeners.delete(listener); };
    } }, portId: "p", wikiUri: "wiki", actor: "me", width: "full", mintTx: () => `tx-${++serial}` });
  const deliver = (msg: any) => { for (const listener of listeners) listener({ portId: "p", ...msg }); };
  const snapshot = (id: string, i: number, n: number, records: any[]) =>
    deliver({ type: "port:snapshot", snapshotId: id, baseCursor: "base", i, n, records });
  const change = (record: any, causedBy: string[] = []) =>
    deliver({ type: "port:changes", cursor: "cursor", entries: [{ seq: 2, causedBy, ...record }] });
  const writes = () => sent.filter(msg => msg.type === "port:write");
  const text = (title: string) => wiki.wiki.getTiddler(title)?.fields.text;
  return { wiki, sent, adaptor, deliver, snapshot, change, writes, text, flush: pump };
}

describe.skipIf(!!wikiSkip)(`glass port ordered races${skipNote}`, () => {
  it("reconciles a whole snapshot; CONTROL a present title stays", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Gone", fields: { text: "old" }, seq: 1 },
      { title: "Keep", fields: { text: "old" }, seq: 1 }]);
    await g.flush();
    g.snapshot("second", 1, 2, [{ title: "Keep", fields: { text: "new" }, seq: 2 }]);
    await g.flush();
    expect(g.text("Gone")).toBe("old");
    expect(g.text("Keep")).toBe("old");
    g.snapshot("second", 2, 2, []);
    await g.flush();
    expect(g.text("Gone")).toBeUndefined();
    expect(g.text("Keep")).toBe("new");
  });

  it("reset reopens and replays an unsettled edit; CONTROL changes still land", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "local" });
    await g.flush();
    expect(g.writes()).toHaveLength(1);
    g.deliver({ type: "port:reset", reason: "compacted", floorSeq: 0, headSeq: 2 });
    expect(g.sent.filter(msg => msg.type === "port:open")).toHaveLength(2);
    expect(g.sent.at(-1)?.type).toBe("port:open");
    expect(g.sent.at(-1)?.since).toBeUndefined();
    expect(g.text("Page")).toBe("local");
    g.snapshot("fresh", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 2 }]);
    await g.flush();
    expect(g.text("Page")).toBe("local");
    expect(g.writes()).toHaveLength(2);
    g.change({ title: "Peer", fields: { text: "peer" } });
    await g.flush();
    expect(g.text("Peer")).toBe("peer");
  });

  it("a tombstone defeats an older load answer; CONTROL an extant load resolves", async () => {
    const g = await glass();
    g.snapshot("one", 1, 1, [{ title: "Page", fields: {}, omitted: ["text"], seq: 1 }]);
    const old = g.adaptor.openBody("Page");
    const askId = g.sent.at(-1)?.askId;
    g.change({ title: "Page", fields: {}, deleted: true, seq: 3 });
    g.deliver({ type: "port:answer", askId, status: "answered",
      result: [{ title: "Page", fields: { text: "stale" }, seq: 2 }] });
    await expect(old).resolves.toBeUndefined();
    expect(g.text("Page")).toBeUndefined();
    g.snapshot("two", 1, 1, [{ title: "Live", fields: {}, omitted: ["text"], seq: 4 }]);
    const live = g.adaptor.openBody("Live");
    g.deliver({ type: "port:answer", askId: g.sent.at(-1)?.askId, status: "answered",
      result: [{ title: "Live", fields: { text: "body" }, seq: 4 }] });
    await expect(live).resolves.toBe("body");
  });

  it("refusal respects a later equal local edit and peer landing; CONTROL latest refusal rolls back", async () => {
    const g = await glass();
    g.snapshot("one", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "same" }); await g.flush();
    const first = g.writes()[0].txId;
    g.change({ title: "Page", fields: { text: "peer" }, seq: 2 }); await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "same" }); await g.flush();
    g.deliver({ type: "port:written", txId: first, status: "refused", applied: [], failed: ["Page"] });
    expect(g.text("Page")).toBe("same");
    const second = g.writes().at(-1).txId;
    g.deliver({ type: "port:written", txId: second, status: "refused", applied: [], failed: ["Page"] });
    expect(g.text("Page")).toBe("peer");
  });

  it("keeps a settled echo through 1025 later writes; CONTROL a peer entry lands", async () => {
    const g = await glass();
    g.wiki.setTiddler({ title: "Page", text: "own" }); await g.flush();
    const first = g.writes()[0].txId;
    g.deliver({ type: "port:written", txId: first, status: "applied", applied: ["Page"], failed: [] });
    for (let i = 0; i < 1025; i++) {
      g.wiki.setTiddler({ title: `Other${i}`, text: String(i) }); await g.flush();
      g.deliver({ type: "port:written", txId: g.writes().at(-1).txId,
        status: "applied", applied: [`Other${i}`], failed: [] });
    }
    let peers = 0; g.adaptor.onPeerEdit(() => peers++);
    g.change({ title: "Page", fields: { text: "own" } }, [first]);
    expect(peers).toBe(0);
    g.change({ title: "Peer", fields: { text: "foreign" } });
    expect(peers).toBe(1);
  }, 15000);

  it("commits the acknowledged payload; CONTROL a later accepted write commits its own payload", async () => {
    const g = await glass();
    g.snapshot("one", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]); await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "first" }); await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "second" }); await g.flush();
    const [first, second] = g.writes();
    g.deliver({ type: "port:written", txId: first.txId, status: "applied", applied: ["Page"], failed: [] });
    g.deliver({ type: "port:written", txId: second.txId, status: "refused", applied: [], failed: ["Page"] });
    expect(g.text("Page")).toBe("first");
    g.wiki.setTiddler({ title: "Page", text: "third" }); await g.flush();
    g.deliver({ type: "port:written", txId: g.writes().at(-1).txId,
      status: "applied", applied: ["Page"], failed: [] });
    expect(g.text("Page")).toBe("third");
  });

  it("same-tick landing preserves a local edit; CONTROL plain landing sends no write", async () => {
    const g = await glass();
    g.change({ title: "Page", fields: { text: "peer" } });
    await g.flush();
    expect(g.writes()).toHaveLength(0);
    g.change({ title: "Page", fields: { text: "next" }, seq: 3 });
    g.wiki.setTiddler({ title: "Page", text: "local" });
    await g.flush();
    expect(g.writes().at(-1)?.records[0].fields.text).toBe("local");
  });

  it("load returns the asked body without replacing a newer edit; CONTROL idle load lands", async () => {
    const g = await glass();
    g.snapshot("one", 1, 1, [{ title: "Page", fields: {}, omitted: ["text"], seq: 1 },
      { title: "Idle", fields: {}, omitted: ["text"], seq: 1 }]); await g.flush();
    const load = g.adaptor.openBody("Page"); const askId = g.sent.at(-1)?.askId;
    g.wiki.setTiddler({ title: "Page", text: "local" }); await g.flush();
    g.deliver({ type: "port:answer", askId, status: "answered",
      result: [{ title: "Page", fields: { text: "remote" }, seq: 1 }] });
    await expect(load).resolves.toBe("remote");
    expect(g.text("Page")).toBe("local");
    const idle = g.adaptor.openBody("Idle");
    g.deliver({ type: "port:answer", askId: g.sent.at(-1)?.askId, status: "answered",
      result: [{ title: "Idle", fields: { text: "body" }, seq: 1 }] });
    await expect(idle).resolves.toBe("body");
    expect(g.text("Idle")).toBe("body");
  });
});
