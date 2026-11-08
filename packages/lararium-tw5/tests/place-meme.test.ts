/**
 * PLACE A MEME — one function, every skin.
 *
 * A meme arrives as TEXT (a PUT body, an MCP argument, a CLI stdin) and lands as its records: the
 * root and its ahu children, stale children tombstoned, the Confluence gate deciding. The plain
 * TW5 server route and the island's INGEST verb both call this one function through a sink; the
 * tests here drive it over an in-memory sink so the placement law reads without a wiki beneath it.
 */
import { describe, test, expect } from "vitest";
import {
  placeMeme, wikiMemeSink, groupOfMeme, listMemes, readMeme, stageRowTitle, STAGE_ROW_PREFIX,
  ROW_KEY_MISSING_CODE, ROW_KEY_SHAPE_CODE, ROW_KEY_TITLE_CODE, type MemeSink,
} from "../src/place-meme.js";
import type { TiddlerFields } from "../src/deserializer.js";

const URI = "lar:///t/x";

const meme = (slots: readonly string[]): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${URI}\`>>\n` +
  `<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "t/x"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu slot=\`#/${s}\`>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

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
    const stranded = meme(["a"]).replace("<<^ code=`&#x0003;`>>\n", "<<^ code=`&#x0003;`>>\n<<~ ahu slot=`#edges`>>\n\n* a link\n\n<<~/ahu>>\n");
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

/**
 * ROW 16 (bags/lares/ha.ka.ba/lares/docs/pono/child-grade-decision.mem:355) — a `lar:` URI never
 * carries a second raw `#`. Placing text AT A SLOT CHILD'S OWN ADDRESS would have to mint `#/a#/z`;
 * a fragment address never founds a meme, so the placement refuses and lands nothing (the doors
 * suite, fragment-doors.test.ts, holds every skin).
 */
describe("★ ROW 16 — a slot address never founds a meme ★", () => {
  test("placing text at a slot URI refuses, lands nothing, and never mints `#/a#/z`", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    const before = [...sink.store.keys()].sort();
    const child = `${URI}#/a`;
    const r = await placeMeme({ uri: child, text: meme(["z"]).replace(`to=${URI}`, `to=${child}`) }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.landed).toEqual([]);
    expect([...sink.store.keys()].sort()).toEqual(before);
    expect(sink.store.has(`${URI}#/a#/z`)).toBe(false);
  });

  test("CONTROL: a slot child of a ROOT still lands with one '#'", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: meme(["a"]) }, sink);
    expect(r.decision).toBe("ingest");
    expect(sink.store.has(`${URI}#/a`)).toBe(true);
    for (const title of r.landed) {
      expect(title.match(/#/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
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
    // A nested slot: `#/d` holds `#/d/e` — canon: a nested open carries its WHOLE path from the
    // carrier root, a strict descendant of its enclosing slot, never a bare relative leaf.
    const nested = other("t/z", []).replace("<<^ code=`&#x0002;`>>\n\n", "<<^ code=`&#x0002;`>>\n\n<<~ ahu slot=`#/d`>>\n\n! d\n\n<<~ ahu slot=`#/d/e`>>\n\n! e\n\n<<~/ahu>>\n\n<<~/ahu>>\n");
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
      { slot: "#/d", uri: "lar:///t/z#/d", slots: [{ slot: "#/d/e", uri: "lar:///t/z#/d/e", slots: [] }] },
    ]);
    // CONTROL: no slot child, and no carriage part, lists as a root.
    expect(listed.map((r) => r.uri)).toEqual([URI, "lar:///t/y", "lar:///t/z"]);
  });
});

/** A stage row: the memory stage's carrier, its `row-key` in the meta, at whatever title the writer names. */
const stageRow = (uri: string, rowKey: string | null, body = "The memory crosses a re-stand by its content key."): string =>
  `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  `\`\`\`toml meta\nuri-path = "${uri.slice("lar:///".length)}"\nkind = "memory"\n${rowKey === null ? "" : `row-key = "${rowKey}"\n`}\`\`\`\n\n` +
  `! A stage row\n\n${body}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe("★ L9: a stage row's title derives from its row key, never a clock or a counter ★", () => {
  test("the title reads the stage prefix and the row key, the same key always the same title", () => {
    expect(STAGE_ROW_PREFIX).toBe("lar:///ha.ka.ba/kahua/memory/");
    expect([ROW_KEY_MISSING_CODE, ROW_KEY_SHAPE_CODE, ROW_KEY_TITLE_CODE]).toEqual(["row-key-missing", "row-key-shape", "row-key-title"]);
    expect(stageRowTitle("l9-dogfood-proof")).toBe("lar:///ha.ka.ba/kahua/memory/l9-dogfood-proof");
    expect(stageRowTitle("feedback/never-stash")).toBe("lar:///ha.ka.ba/kahua/memory/feedback/never-stash");
    expect(stageRowTitle("l9-dogfood-proof")).toBe(stageRowTitle("l9-dogfood-proof"));
  });

  test("CONTROL: a changed row key derives a different title", () => {
    expect(stageRowTitle("l9-dogfood-proof-changed")).not.toBe(stageRowTitle("l9-dogfood-proof"));
  });

  test.each([
    ["", "empty"], ["L9", "uppercase"], ["a/b/c", "three segments overrun the uri's four path segments"],
    ["../x", "dot segment"], ["a/", "empty segment"], ["-a", "leading hyphen"], ["a b", "space"], ["a#b", "fragment"],
  ])("a row key that reads no path refuses by name: %j (%s)", (key) => {
    expect(() => stageRowTitle(key)).toThrow(/^row-key-shape: /);
  });

  test("a row placed at its derived title lands", async () => {
    const sink = memorySink();
    const uri = stageRowTitle("l9-dogfood-proof");
    const r = await placeMeme({ uri, text: stageRow(uri, "l9-dogfood-proof") }, sink);
    expect(r.decision).toBe("ingest");
    expect(sink.store.get(uri)?.["row-key"]).toBe("l9-dogfood-proof");
  });

  test("★ a row placed at any other title refuses `row-key-title`, and nothing lands ★", async () => {
    const sink = memorySink();
    const drifted = stageRowTitle("l9-dogfood-proof-changed");
    const r = await placeMeme({ uri: drifted, text: stageRow(drifted, "l9-dogfood-proof") }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.diagnostics.map((d) => d.code)).toEqual([ROW_KEY_TITLE_CODE]);
    expect(r.warnings[0]).toContain(stageRowTitle("l9-dogfood-proof"));
    expect(sink.store.size).toBe(0);
  });

  test("a row key outside the stage refuses `row-key-title` too: the key names one title, one place", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: "lar:///t/x", text: stageRow("lar:///t/x", "l9-dogfood-proof") }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.diagnostics.map((d) => d.code)).toEqual([ROW_KEY_TITLE_CODE]);
    expect(sink.store.size).toBe(0);
  });

  test("★ a row under the stage prefix with no row key refuses `row-key-missing` ★", async () => {
    const sink = memorySink();
    const uri = stageRowTitle("l9-dogfood-proof");
    const r = await placeMeme({ uri, text: stageRow(uri, null) }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.diagnostics.map((d) => d.code)).toEqual([ROW_KEY_MISSING_CODE]);
    expect(sink.store.size).toBe(0);
  });

  test("a row key that reads no path refuses `row-key-shape` at the gate", async () => {
    const sink = memorySink();
    const uri = `${STAGE_ROW_PREFIX}L9`;
    const r = await placeMeme({ uri, text: stageRow(uri, "L9") }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.diagnostics.map((d) => d.code)).toEqual([ROW_KEY_SHAPE_CODE]);
    expect(sink.store.size).toBe(0);
  });

  test("★ RED (L9): one export poured onto two fresh sinks reproduces the same tiddlers, title, fields and text ★", async () => {
    const first = memorySink();
    const uri = stageRowTitle("l9-dogfood-proof");
    await placeMeme({ uri, text: stageRow(uri, "l9-dogfood-proof") }, first);
    const exported = (await readMeme(uri, first))!.text;
    const a = memorySink();
    const b = memorySink();
    expect((await placeMeme({ uri, text: exported }, a)).decision).toBe("ingest");
    expect((await placeMeme({ uri, text: exported }, b)).decision).toBe("ingest");
    expect([...a.store.entries()]).toEqual([...b.store.entries()]);
    expect([...a.store.entries()]).toEqual([...first.store.entries()]);
    expect((await readMeme(uri, b))!.text).toBe(exported);
  });
});
