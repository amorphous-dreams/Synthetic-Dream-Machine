import { describe, expect, it } from "vitest";
import { makeGlassPortAdaptor } from "../src/glass-port-adaptor.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { pump } from "./record-port-real-rig.js";

async function glass(width: "full" | "skinny" = "full") {
  const wiki = await bootTestWiki();
  const sent: any[] = [];
  const listeners = new Set<(msg: any) => void>();
  let serial = 0;
  const adaptor = makeGlassPortAdaptor({ wiki: wiki.wiki, Tiddler: wiki.$tw.Tiddler,
    transport: { send(msg) { sent.push(msg); }, onMessage(listener) {
      listeners.add(listener); return () => { listeners.delete(listener); };
    } }, portId: "p", wikiUri: "wiki", actor: "me", width, mintTx: () => `tx-${++serial}` });
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
    const [first] = g.writes();
    expect(g.writes()).toHaveLength(1);                                       // "second" waits behind the write in flight
    g.deliver({ type: "port:written", txId: first.txId, status: "applied", applied: ["Page"], failed: [] });
    await g.flush();
    const second = g.writes()[1];                                             // and goes out as its own write once the first answers
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

  it("a peer write to an opened skinny body reloads the body; CONTROL a title never opened stays skinny", async () => {
    const g = await glass("skinny");
    g.snapshot("s", 1, 1, [{ title: "Open", fields: {}, omitted: ["text"], seq: 1 }, { title: "Shut", fields: {}, omitted: ["text"], seq: 1 }]);
    await g.flush();
    const opening = g.adaptor.openBody("Open");
    const ask = () => g.sent.filter(msg => msg.type === "port:ask");
    g.deliver({ type: "port:answer", askId: ask()[0].askId, status: "answered", result: [{ title: "Open", fields: { text: "one" }, seq: 1 }] });
    await opening;
    expect(g.text("Open")).toBe("one");
    g.change({ title: "Open", fields: {}, omitted: ["text"], seq: 2 });
    g.change({ title: "Shut", fields: {}, omitted: ["text"], seq: 3 });
    await g.flush();
    expect(ask().map(msg => msg.subject)).toEqual(["Open", "Open"]);
    g.deliver({ type: "port:answer", askId: ask()[1].askId, status: "answered", result: [{ title: "Open", fields: { text: "two" }, seq: 2 }] });
    await g.flush();
    expect(g.text("Open")).toBe("two");
    expect(g.text("Shut")).toBeUndefined();
  });

  it("a successor adaptor resends an unsettled write under its txId once; CONTROL an adopted write settles", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "local" });
    await g.flush();
    const [first] = g.adaptor.pendingWrites();
    expect(first?.title).toBe("Page");
    g.adaptor.close();
    const sent: any[] = [];
    const listeners = new Set<(msg: any) => void>();
    const next = makeGlassPortAdaptor({ wiki: g.wiki.wiki, Tiddler: g.wiki.$tw.Tiddler,
      transport: { send(msg) { sent.push(msg); }, onMessage(listener) { listeners.add(listener); return () => listeners.delete(listener); } },
      portId: "q", wikiUri: "wiki", actor: "me", width: "skinny", mintTx: () => "unused", adopt: g.adaptor.pendingWrites() });
    const resent = sent.filter(msg => msg.type === "port:write");
    expect(resent).toHaveLength(1);
    expect(resent[0]).toMatchObject({ portId: "q", txId: first!.txId });
    for (const listener of listeners) listener({ type: "port:written", portId: "q", txId: first!.txId, status: "applied", applied: ["Page"] });
    expect(next.pendingWrites()).toEqual([]);
    expect(g.text("Page")).toBe("local");
  });

  it("a landed record whose fields TW5 normalizes never echoes back as a local edit; CONTROL a real local edit still posts", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Lesson", seq: 1, fields: { text: "body", tags: "Lesson [[Unit 3]]", modified: "20250101000000000", list: "[[Other Page]] Next" } }]);
    await g.flush();
    expect(g.writes()).toEqual([]);
    g.change({ title: "Lesson", fields: { text: "peer body", tags: "Lesson [[Unit 3]]", modified: "20250102000000000" } });
    await g.flush();
    expect(g.writes()).toEqual([]);
    g.wiki.setTiddler({ title: "Lesson", text: "local edit", tags: "Lesson" });
    await g.flush();
    expect(g.writes()).toHaveLength(1);
  });

  it("a widen's snapshot keeps a title written after the open; CONTROL a plain snapshot still drops an absent title", async () => {
    const g = await glass("skinny");
    g.snapshot("first", 1, 1, [{ title: "Base", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Draft of 'New'", text: "typed" });
    await g.flush();
    const write = g.writes()[0];
    g.deliver({ type: "port:written", txId: write.txId, status: "applied", applied: ["Draft of 'New'"], failed: [] });
    await g.flush();
    g.adaptor.widen("full");
    g.snapshot("widened", 1, 1, [{ title: "Base", fields: { text: "base", tags: "x" }, seq: 1 }]);   // taken before the draft landed
    await g.flush();
    expect(g.text("Draft of 'New'")).toBe("typed");
    expect(g.wiki.wiki.getTiddler("Base")?.fields.tags).toBeTruthy();
    g.snapshot("plain", 1, 1, [{ title: "Base", fields: { text: "base", tags: "x" }, seq: 2 }]);
    await g.flush();
    expect(g.text("Draft of 'New'")).toBeUndefined();   // CONTROL: an ordinary snapshot is the whole truth and drops it
  });

  it("keystrokes on one title send one write at a time and the next carries the latest text; CONTROL another title sends at once", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    for (const text of ["a", "ab", "abc"]) { g.wiki.setTiddler({ title: "Page", text }); await g.flush(); }
    expect(g.writes()).toHaveLength(1);                                      // the later keystrokes wait behind the write in flight
    g.wiki.setTiddler({ title: "Other", text: "elsewhere" }); await g.flush();
    expect(g.writes()).toHaveLength(2);                                      // CONTROL: another title is not held
    g.deliver({ type: "port:written", txId: g.writes()[0].txId, status: "applied", applied: ["Page"], failed: [] });
    await g.flush();
    const page = g.writes().filter(w => w.records[0].title === "Page");
    expect(page).toHaveLength(2);
    expect(page[1].records[0].fields.text).toBe("abc");                      // the follow-up carries the latest text, once
    expect(g.text("Page")).toBe("abc");
  });

  it("a peer landing on a title with a deferred local edit leaves the edit standing and the follow-up carries it", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "mine" }); await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "mine, more" }); await g.flush();           // deferred behind the first write
    g.change({ title: "Page", fields: { text: "peer" } }); await g.flush();
    expect(g.text("Page")).toBe("mine, more");                                           // the peer did not stomp the person's typing
    g.deliver({ type: "port:written", txId: g.writes()[0].txId, status: "applied", applied: ["Page"], failed: [] });
    await g.flush();
    const sent = g.writes().filter(w => w.records[0].title === "Page");
    expect(sent.at(-1).records[0].fields.text).toBe("mine, more");
  });
  it("a step-down successor sends the edit that waited behind an adopted write", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "one" }); await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "one two" }); await g.flush();             // deferred
    const sent: any[] = []; const listeners = new Set<(msg: any) => void>();
    g.adaptor.close();
    const next = makeGlassPortAdaptor({ wiki: g.wiki.wiki, Tiddler: g.wiki.$tw.Tiddler,
      transport: { send(msg) { sent.push(msg); }, onMessage(l) { listeners.add(l); return () => listeners.delete(l); } },
      portId: "q", wikiUri: "wiki", actor: "me", width: "skinny", mintTx: () => `next-${sent.length}`,
      adopt: g.adaptor.pendingWrites(), inheritDeferred: g.adaptor.deferredTitles() });
    const adopted = sent.find(m => m.type === "port:write");
    for (const l of listeners) l({ type: "port:written", portId: "q", txId: adopted.txId, status: "applied", applied: ["Page"], failed: [] });
    expect(sent.filter(m => m.type === "port:write").at(-1).records[0].fields.text).toBe("one two");
    expect(next.pendingWrites().length).toBe(1);
  });
  it("an older entry naming no tx never blanks typing while a write stands in flight, deferred or not; CONTROL an idle title takes a peer", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Draft", fields: { text: "" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Draft", text: "", caption: "t" }); await g.flush();     // tx1 carries the empty body
    g.change({ title: "Draft", fields: { text: "" } }, []);                             // an older entry names no tx while tx1 stands pending
    g.wiki.setTiddler({ title: "Draft", text: "typed", caption: "t" }); await g.flush();
    expect(g.text("Draft")).toBe("typed");
    g.deliver({ type: "port:written", txId: g.writes()[0].txId, status: "applied", applied: ["Draft"], failed: [] });
    await g.flush();
    expect(g.writes()).toHaveLength(2);                                                 // tx2 is out and nothing stands deferred
    expect(g.adaptor.deferredTitles()).toEqual([]);
    g.change({ title: "Draft", fields: { text: "" } }, []);                             // the same older entry arrives while tx2 stands pending
    await g.flush();
    expect(g.text("Draft")).toBe("typed");
    g.deliver({ type: "port:written", txId: g.writes()[1].txId, status: "applied", applied: ["Draft"], failed: [] });
    await g.flush();
    expect(g.adaptor.quiescent()).toBe(true);
    g.change({ title: "Draft", fields: { text: "from a peer" } }, []);                  // CONTROL: idle, a peer lands
    await g.flush();
    expect(g.text("Draft")).toBe("from a peer");
  });

  it("a second entry naming a settled tx never lands as a peer; CONTROL an entry naming no tx lands", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Draft", fields: { text: "" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Draft", text: "typed" }); await g.flush();
    const tx = g.writes()[0].txId;
    g.deliver({ type: "port:written", txId: tx, status: "applied", applied: ["Draft"], failed: [] });
    await g.flush();
    let peers = 0; g.adaptor.onPeerEdit(() => peers++);
    g.change({ title: "Draft", fields: { text: "typed" } }, [tx]);
    g.change({ title: "Draft", fields: { text: "" } }, [tx]);                           // the double echo
    await g.flush();
    expect(peers).toBe(0);
    expect(g.text("Draft")).toBe("typed");
    g.change({ title: "Draft", fields: { text: "peer" } }, []);
    await g.flush();
    expect(peers).toBe(1);
    expect(g.text("Draft")).toBe("peer");
  });
  it("a peer entry held while a write stands in flight shows once the write settles, and the next keystroke does not revert it; CONTROL a peer entry older than the write's echo loses to the write", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    g.wiki.setTiddler({ title: "Page", text: "mine" }); await g.flush();
    const tx = g.writes()[0].txId;
    g.change({ title: "Page", fields: { text: "mine" }, seq: 3 }, [tx]);                // the write's own echo
    g.change({ title: "Page", fields: { text: "peer" }, seq: 4 }, []);                  // a peer lands after it, while the write stands pending
    await g.flush();
    expect(g.text("Page")).toBe("mine");
    g.deliver({ type: "port:written", txId: tx, status: "applied", applied: ["Page"], failed: [] });
    await g.flush();
    expect(g.text("Page")).toBe("peer");
    g.wiki.setTiddler({ title: "Page", text: "peer plus" }); await g.flush();
    expect(g.text("Page")).toBe("peer plus");
    expect(g.writes().at(-1).records[0].fields.text).toBe("peer plus");

    const h = await glass();
    h.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await h.flush();
    h.wiki.setTiddler({ title: "Page", text: "mine" }); await h.flush();
    const tx2 = h.writes()[0].txId;
    h.change({ title: "Page", fields: { text: "older peer" }, seq: 2 }, []);            // the peer's entry precedes the write's echo
    h.change({ title: "Page", fields: { text: "mine" }, seq: 3 }, [tx2]);
    h.deliver({ type: "port:written", txId: tx2, status: "applied", applied: ["Page"], failed: [] });
    await h.flush();
    expect(h.text("Page")).toBe("mine");
  });

  it("a saved write with its one echo fires no peer edit", async () => {
    const g = await glass();
    g.snapshot("first", 1, 1, [{ title: "Page", fields: { text: "base" }, seq: 1 }]);
    await g.flush();
    let peers = 0; g.adaptor.onPeerEdit(() => peers++);
    g.wiki.setTiddler({ title: "Page", text: "saved" }); await g.flush();
    const tx = g.writes()[0].txId;
    g.change({ title: "Page", fields: { text: "saved" }, seq: 3 }, [tx]);
    g.deliver({ type: "port:written", txId: tx, status: "applied", applied: ["Page"], failed: [] });
    await g.flush();
    expect(peers).toBe(0);
    expect(g.text("Page")).toBe("saved");
  });
});
