import { afterEach, describe, expect, it } from "vitest";
import { makeGlassPortAdaptor } from "../src/glass-port-adaptor.js";
import { makeDraftNewerBasePrompt } from "../src/glass-draft-prompt.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";
import { pump, realPort } from "./record-port-real-rig.js";

type Rig = Awaited<ReturnType<typeof realPort>>;
const opened: Rig[] = [];
afterEach(async () => { for (const rig of opened.splice(0)) await rig.close(); });

async function glass() {
  const island = await bootTestWiki();
  const wiki = await bootTestWiki();
  const rig = await realPort({}, island);
  opened.push(rig);
  await rig.composite.put({ tiddler: { title: "Page", text: "base" } }, { kind: "tw-local", instanceId: "foreign" });
  const sent: Array<{ type: string; [key: string]: unknown }> = [];
  const listeners = new Set<(msg: any) => void>();
  let delivered = 0;
  const transport = {
    send(msg: { type: string; [key: string]: unknown }) { sent.push(msg); void rig.send(msg); },
    onMessage(listener: (msg: any) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  let next = 0;
  const adaptor = makeGlassPortAdaptor({ wiki: wiki.wiki, Tiddler: wiki.$tw.Tiddler,
    transport, portId: "p", wikiUri: "wiki", actor: "p", width: "full", mintTx: () => `tx-${++next}` });
  const stopPrompt = makeDraftNewerBasePrompt({ wiki: wiki.wiki, Tiddler: wiki.$tw.Tiddler, adaptor });
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
  return { wiki, rig, adaptor, sent, settle, stopPrompt };
}

const alert = "$:/temp/lares/alert/newer-base/Page";
const draft = "Draft of 'Page'";

describe.skipIf(!!wikiSkip)(`glass newer-base prompt over the real island${skipNote}`, () => {
  it("alerts on a peer edit of a standing draft; CONTROLS unrelated and absent drafts", async () => {
    const g = await glass();
    await g.rig.composite.put({ tiddler: { title: "Page", text: "no draft yet" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    expect(g.wiki.wiki.getTiddler(alert)).toBeUndefined();
    g.wiki.setTiddler({ title: draft, "draft.of": "Page", "draft.title": "Page", text: "mine" });
    await g.rig.composite.put({ tiddler: { title: "Other", text: "unrelated" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    expect(g.wiki.wiki.getTiddler(alert)).toBeUndefined();
    await g.rig.composite.put({ tiddler: { title: "Page", text: "theirs" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    const prompt = g.wiki.wiki.getTiddler(alert);
    expect(prompt?.fields.tags).toEqual(["$:/tags/Alert"]);
    expect(String(prompt?.fields.text)).toContain("Take theirs");
    expect(String(prompt?.fields.text)).toContain("Keep mine");
    expect(g.wiki.wiki.renderText("text/html", "text/vnd.tiddlywiki", String(prompt?.fields.text))).toContain("Take theirs");
    await g.rig.composite.put({ tiddler: { title: "Page", text: "theirs again" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    expect(g.wiki.wiki.filterTiddlers("[all[tiddlers]tag[$:/tags/Alert]]").filter(title => title === alert)).toHaveLength(1);
    g.stopPrompt(); g.adaptor.close();
  });

  it("Take theirs deletes draft and alert; Keep mine deletes only alert", async () => {
    const g = await glass();
    const root = (g.wiki.$tw as unknown as { rootWidget: { invokeActionString(s: string): void } }).rootWidget;
    g.wiki.setTiddler({ title: draft, "draft.of": "Page", text: "mine" });
    await g.rig.composite.put({ tiddler: { title: "Page", text: "theirs" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    const keep = String(g.wiki.wiki.getTiddler(alert)?.fields.text).match(/<\$button>Keep mine([\s\S]*?)<\/\$button>/)?.[1];
    expect(keep).toBeDefined();
    root.invokeActionString(keep!);
    expect(g.wiki.wiki.getTiddler(alert)).toBeUndefined();
    expect(g.wiki.wiki.getTiddler(draft)).toBeDefined();
    await g.rig.composite.put({ tiddler: { title: "Page", text: "theirs again" } }, { kind: "tw-local", instanceId: "foreign" });
    await g.settle();
    const take = String(g.wiki.wiki.getTiddler(alert)?.fields.text).match(/<\$button>Take theirs([\s\S]*?)<\/\$button>/)?.[1];
    expect(take).toBeDefined();
    root.invokeActionString(take!);
    expect(g.wiki.wiki.getTiddler(alert)).toBeUndefined();
    expect(g.wiki.wiki.getTiddler(draft)).toBeUndefined();
    g.stopPrompt(); g.adaptor.close();
  });
});
