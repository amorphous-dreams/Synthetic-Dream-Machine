/**
 * PLACE A MEME — one function, every skin.
 *
 * A meme arrives as TEXT (a PUT body, an MCP argument, a CLI stdin) and lands as its records: the
 * root and its ahu children, stale children tombstoned, the Confluence gate deciding. The plain
 * TW5 server route and the island's INGEST verb both call this one function through a sink; the
 * tests here drive it over an in-memory sink so the placement law reads without a wiki beneath it.
 */
import { describe, test, expect } from "vitest";
import { placeMeme, wikiMemeSink, groupOfMeme, listMemes, type MemeSink } from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t/x";

const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n` +
  `<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

/** An in-memory sink: the smallest thing that holds tiddlers by title. */
function memorySink(): MemeSink & { store: Map<string, TiddlerFields> } {
  const store = new Map<string, TiddlerFields>();
  return {
    store,
    titles: () => [...store.keys()],
    read: (t) => store.get(t),
    land: (f) => { store.set(String(f.title), f); },
    tombstone: (t) => { store.delete(t); },
  };
}

describe("★ placeMeme lands a meme from text alone ★", () => {
  test("a fresh meme adopts: the root and every ahu child land", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    expect(r.decision).toBe("ingest");
    expect(r.landed.sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
    expect(r.tombstoned).toEqual([]);
    expect(sink.store.has(`${URI}#/b`)).toBe(true);
  });

  test("the same text again reads canonical-equivalent: a noop, nothing moves", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    expect(r.decision).toBe("noop");
    expect(sink.store.size).toBe(2);
  });

  test("★ a slot the new text drops gets tombstoned; a slot it adds gets born ★", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a", "c"]) }, sink);
    expect(r.decision).toBe("ingest");
    expect(r.tombstoned).toEqual([`${URI}#/b`]);
    expect(sink.store.has(`${URI}#/b`)).toBe(false);
    expect(sink.store.has(`${URI}#/c`)).toBe(true);
  });

  test("★ a stale base hash surfaces a CONFLICT and lands nothing ★", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    // A second writer moves the records past the base the first writer read.
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a", "z"]), baseHash: first.canonicalHash }, sink);
    expect(r.decision).toBe("conflict");
    expect(sink.store.has(`${URI}#/z`)).toBe(false);
    expect(sink.store.has(`${URI}#/b`)).toBe(true);
  });

  test("a current base hash lets the write through", async () => {
    const sink = memorySink();
    const first = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a", "z"]), baseHash: first.canonicalHash }, sink);
    expect(r.decision).toBe("ingest");
    expect(sink.store.has(`${URI}#/z`)).toBe(true);
  });

  test("CONTROL: content stranded past ETX refuses, and the sink stays untouched", async () => {
    const sink = memorySink();
    const stranded = meme(["a"]).replace("<<^ code=\"&#x0003;\">>\n", "<<^ code=\"&#x0003;\">>\n<<~ ahu #edges>>\n\n* a link\n\n<<~/ahu>>\n");
    const r = await placeMeme({ uri: URI, text: stranded }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.grade).toBe("error");
    expect(sink.store.size).toBe(0);
  });

  test("the group law: root, #fragment and /path children belong to the meme", () => {
    const titles = [URI, `${URI}#/a`, `${URI}/wires/1`, `${URI}-other`, "lar:///t/y"];
    expect(groupOfMeme(titles, URI)).toEqual([URI, `${URI}#/a`, `${URI}/wires/1`]);
  });
});

describe("the $tw.wiki skin", () => {
  test("wikiMemeSink lands through addTiddler and tombstones through deleteTiddler", async () => {
    const store = new Map<string, TiddlerFields>();
    const wiki = {
      allTitles: () => [...store.keys()],
      getTiddler: (t: string) => (store.has(t) ? { fields: store.get(t)! } : undefined),
      addTiddler: (f: TiddlerFields) => { store.set(String(f.title), f); },
      deleteTiddler: (t: string) => { store.delete(t); },
    };
    const sink = wikiMemeSink(wiki as never);
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    const r = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    expect(r.tombstoned).toEqual([`${URI}#/b`]);
    expect([...store.keys()].sort()).toEqual([URI, `${URI}#/a`]);
  });
});

describe("the read half", () => {
  test("readMeme returns the recomposed text and the hash a writer hands back as its base", async () => {
    const { readMeme } = await import("../src/place-meme.js");
    const sink = memorySink();
    expect(await readMeme(URI, sink)).toBeNull();
    const placed = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    const read = await readMeme(URI, sink);
    expect(read?.canonicalHash).toBe(placed.canonicalHash);
    const r = await placeMeme({ uri: URI, text: meme(["a", "b"]), baseHash: read?.canonicalHash }, sink);
    expect(r.decision).toBe("ingest");
  });
});

/**
 * THE LISTING — RULED 2026-09-12: roots + the canonical hash by default; `tree` nests the slot tree
 * under each root. A root reads as a carrier-typed record with no `$fragment-parent`; a slot child, a
 * carriage part (`$preamble` · `$postamble`) and a plain tiddler never list as roots.
 */
describe("★ listMemes — roots by default, the slot tree on request ★", () => {
  const other = (path: string, slots: readonly string[]): string =>
    meme(slots).replaceAll("t/x", path);

  test("every root lists with the hash a writer hands back as its base; CONTROL: a plain tiddler never lists", async () => {
    const sink = memorySink();
    const a = await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    const y = await placeMeme({ uri: "lar:///t/y", text: other("t/y", ["c"]) }, sink);
    sink.store.set("plain", { title: "plain", text: "prose" });
    sink.store.set("lar:///t/prose", { title: "lar:///t/prose", text: "a lar-titled plain tiddler, no carrier type" });
    const listed = await listMemes(sink);
    expect(listed.map((r) => r.uri)).toEqual([URI, "lar:///t/y"]);
    expect(listed.map((r) => r.canonicalHash)).toEqual([a.canonicalHash, y.canonicalHash]);
    expect(listed.every((r) => r.slots === undefined)).toBe(true);
  });

  test("★ `tree` nests `uri#/slot` children under their OWN root only ★", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(["a", "b"]) }, sink);
    await placeMeme({ uri: "lar:///t/y", text: other("t/y", ["c"]) }, sink);
    // A nested slot: `#/d` holds `#/e`; the record spells its slot as declared, its uri carries the whole address.
    const nested = other("t/z", []).replace("<<^ code=\"&#x0002;\">>\n\n", "<<^ code=\"&#x0002;\">>\n\n<<~ ahu #/d>>\n\n! d\n\n<<~ ahu #/e>>\n\n! e\n\n<<~/ahu>>\n\n<<~/ahu>>\n");
    const z = await placeMeme({ uri: "lar:///t/z", text: nested }, sink);
    expect(z.decision, z.warnings.join()).toBe("ingest");
    const listed = await listMemes(sink, { tree: true });
    const byUri = Object.fromEntries(listed.map((r) => [r.uri, r.slots]));
    expect(byUri[URI]).toEqual([
      { slot: "#/a", uri: `${URI}#/a`, slots: [] },
      { slot: "#/b", uri: `${URI}#/b`, slots: [] },
    ]);
    expect(byUri["lar:///t/y"]).toEqual([{ slot: "#/c", uri: "lar:///t/y#/c", slots: [] }]);
    expect(byUri["lar:///t/z"]).toEqual([
      { slot: "#/d", uri: "lar:///t/z#/d", slots: [{ slot: "#/e", uri: "lar:///t/z#/d/e", slots: [] }] },
    ]);
    // CONTROL: no slot child, and no carriage part, lists as a root.
    expect(listed.map((r) => r.uri)).toEqual([URI, "lar:///t/y", "lar:///t/z"]);
  });
});
