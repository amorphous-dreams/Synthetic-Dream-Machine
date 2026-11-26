/**
 * A FAMILY PLACEMENT READS THE ONE FAMILY LAW (wiki-surface-scout #/meme-aware-actions, lane 0).
 *
 * A placement and a removal read the family by its edges, never by a `<uri>/` prefix. A prefix holds no authority: a
 * path child stands as its own meme (or its own plain tiddler), and the door spares it and names it.
 * A removal lands the root and its component slots as ONE store change where the sink can carry one.
 */
import { describe, test, expect } from "vitest";
import { placeMeme, removeMeme, readMeme, familyRefsOf, type MemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const URI = "lar:///t/x";

const meme = (uri: string, slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

function memorySink(): MemeSink & { store: Map<string, TiddlerFields>; changes: string[][] } {
  const store = new Map<string, TiddlerFields>();
  const changes: string[][] = [];
  return {
    store, changes,
    titles: () => [...store.keys()],
    read: (t) => store.get(t),
    land: (f) => { store.set(String(f.title), f); },
    tombstone: (t) => { store.delete(t); changes.push([t]); },
    tombstoneFamily: (titles: readonly string[]) => { for (const t of titles) store.delete(t); changes.push([...titles]); },
  } as MemeSink & { store: Map<string, TiddlerFields>; changes: string[][] };
}

describe("a placement spares plain children", () => {
  test("★ a bare put at an address leaves a plain tiddler and a meme under its path standing ★", async () => {
    const sink = memorySink();
    sink.store.set(`${URI}/y`, { title: `${URI}/y`, type: "text/vnd.tiddlywiki", text: "a plain note" });
    await placeMeme({ uri: `${URI}/sub`, text: meme(`${URI}/sub`, ["a"]) }, sink);
    const r = await placeMeme({ uri: URI, text: "bytes with no frame" }, sink);
    expect(r.decision).toBe("ingest");
    expect(r.tombstoned).toEqual([]);
    expect(sink.store.has(`${URI}/y`)).toBe(true);
    expect(sink.store.has(`${URI}/sub`)).toBe(true);
    expect(sink.store.has(`${URI}/sub#/a`)).toBe(true);
  });

  test("a framed put over a family spares the path children too, and a prefix-only fragment title", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(URI, ["a", "b"]) }, sink);
    sink.store.set(`${URI}/y`, { title: `${URI}/y`, type: "text/vnd.tiddlywiki", text: "a plain note" });
    sink.store.set(`${URI}#note`, { title: `${URI}#note`, type: "text/vnd.tiddlywiki", text: "no edge names this one" });
    const r = await placeMeme({ uri: URI, text: meme(URI, ["a"]) }, sink);
    expect(r.tombstoned).toEqual([`${URI}#/b`]);
    expect(sink.store.has(`${URI}/y`)).toBe(true);
    expect(sink.store.has(`${URI}#note`)).toBe(true);
  });

  test("control: a framed put still tombstones its stale slot", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(URI, ["a", "b"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(URI, ["a", "c"]) }, sink);
    expect(r.tombstoned).toEqual([`${URI}#/b`]);
    expect(sink.store.has(`${URI}#/c`)).toBe(true);
  });
});

describe("a family removal — the family leaves as one change", () => {
  test("★ the root and its slots leave in ONE change; a path child stays and the receipt names it ★", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(URI, ["a", "b", "c"]) }, sink);
    await placeMeme({ uri: `${URI}/sub`, text: meme(`${URI}/sub`, ["a"]) }, sink);
    sink.store.set(`${URI}/y`, { title: `${URI}/y`, type: "text/vnd.tiddlywiki", text: "a plain note" });
    sink.changes.length = 0;
    const r = await removeMeme({ uri: URI }, sink) as Awaited<ReturnType<typeof removeMeme>> & { consequence?: { leaves: ReadonlyArray<{ title: string; why: string }> } };
    expect(r.decision).toBe("removed");
    expect([...r.tombstoned].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`, `${URI}#/c`]);
    expect(sink.changes).toHaveLength(1);
    expect([...sink.changes[0]!].sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`, `${URI}#/c`]);
    expect(r.consequence?.leaves).toEqual(expect.arrayContaining([
      { title: `${URI}/sub`, why: "path-child-stands-as-its-own-meme" },
      { title: `${URI}/y`, why: "path-child-stands-as-its-own-meme" },
    ]));
    expect(sink.store.has(`${URI}/sub#/a`)).toBe(true);
    expect(sink.store.has(`${URI}/y`)).toBe(true);
    expect(await readMeme(`${URI}/sub`, sink)).not.toBeNull();
  });

  test("★ L46: the receipt's versions name the family the act touched, never every tiddler the wiki composes ★", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(URI, ["a", "b", "c"]) }, sink);
    for (let n = 0; n < 120; n += 1) sink.store.set(`$:/boot/noise-${n}`, { title: `$:/boot/noise-${n}`, type: "text/vnd.tiddlywiki", text: "x" });
    const r = await removeMeme({ uri: URI }, sink) as Awaited<ReturnType<typeof removeMeme>> & { consequence?: { versions: Record<string, string | null> } };
    expect(Object.keys(r.consequence?.versions ?? {}).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`, `${URI}#/c`]);
    expect(JSON.stringify(r).length).toBeLessThan(4000);
  });

  test("control: a sink with no family verb still removes every member, one title at a time", async () => {
    const sink = memorySink();
    delete (sink as { tombstoneFamily?: unknown }).tombstoneFamily;
    await placeMeme({ uri: URI, text: meme(URI, ["a"]) }, sink);
    const r = await removeMeme({ uri: URI }, sink);
    expect([...r.tombstoned].sort()).toEqual([URI, `${URI}#/a`]);
    expect(sink.store.size).toBe(0);
  });
});

describe("familyRefsOf — the text grammar the family law reads through", () => {
  test("a kahea call names a component under the record's own root; a loulou names another meme; a fenced one names nothing", () => {
    const text = "<<~ kahea ahu slot=`#/a`>>\n\n<<~ loulou uri=`lar:///t/other#/s`>>\n\n```\n<<~ kahea ahu slot=`#/quoted`>>\n```\n";
    expect(familyRefsOf(`${URI}#/top`, { title: `${URI}#/top`, type: CARRIER_TYPE, text })).toEqual([
      { kind: "kahea", to: `${URI}#/a` },
      { kind: "loulou", to: "lar:///t/other#/s" },
    ]);
  });
});
