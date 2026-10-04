/**
 * A FRAGMENT ADDRESS NEVER FOUNDS A MEME — at every door.
 *
 * `#` may not repeat in a lar address, so a placement at `uri#/slot` could mint only `uri#/slot#/z`:
 * a title the group law admits and the address grammar has no name for. The `/memes/` PUT route has
 * refused one all along; every other door — `placeMeme` (the MCP verb, the CLI, the face's `place`,
 * the island's INGEST) — now refuses through the gate it shares, and lands nothing.
 */
import { describe, test, expect } from "vitest";
import { placeMeme, type MemeSink } from "../src/place-meme.js";
import { childUri, composeSlotPath } from "../src/meme-ast/ahu-scan.js";
import type { TiddlerFields } from "../src/deserializer.js";
import { bootTestWiki, wikiSkip } from "./test-wiki.js";

const URI = "lar:///t/x";

const memeAt = (uri: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uri}">>\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

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

describe("★ placeMeme refuses a fragment-carrying address ★", () => {
  test("a URI carrying a fragment refuses and lands nothing — never `#/a#/z`", async () => {
    const sink = memorySink();
    await placeMeme({ uri: URI, text: memeAt(URI, ["a"]) }, sink);
    const before = [...sink.store.keys()].sort();
    const r = await placeMeme({ uri: `${URI}#/a`, text: memeAt(`${URI}#/a`, ["z"]) }, sink);
    expect(r.decision).toBe("refuse");
    expect(r.warnings.join(" ")).toMatch(/a fragment address never founds a meme/);
    expect(r.landed).toEqual([]);
    expect([...sink.store.keys()].sort()).toEqual(before);
    expect([...sink.store.keys()].some((t) => (t.match(/#/g)?.length ?? 0) > 1)).toBe(false);
  });

  test("a head naming a fragment refuses, even at a root URI", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: memeAt(`${URI}#/a`, ["z"]) }, sink);
    expect(r.decision).toBe("refuse");
    expect(sink.store.size).toBe(0);
  });

  test("CONTROL: a root URI with a root head lands", async () => {
    const sink = memorySink();
    const r = await placeMeme({ uri: URI, text: memeAt(URI, ["a"]) }, sink);
    expect(r.decision).toBe("ingest");
  });
});

describe("★ childUri — one address helper beside composeSlotPath ★", () => {
  test("a root's child, a child's child, and a slot that already carries a path", () => {
    expect(childUri("lar:///t/x", "#/a")).toBe("lar:///t/x#/a");
    expect(childUri("lar:///t/x#/a", "#/z")).toBe("lar:///t/x#/a/z");
    expect(childUri("lar:///t/x#/a", "#/b/c")).toBe("lar:///t/x#/a/b/c");
  });
  test("agrees with composeSlotPath over the root", () => {
    expect(childUri("lar:///t/x#/a/b", "#/c")).toBe("lar:///t/x" + composeSlotPath("#/a/b", "#/c"));
  });
  test("a nested open's own full path under its own prefix stays that path, never re-prefixed", () => {
    // CANON (meme-normalize.ts's child-slot clause): a nested open already carries its whole
    // path from the carrier root by the time a scanner reads it — re-applying the parent prefix
    // would double the shared segment (`#/observe/observe/observe-ha`).
    expect(composeSlotPath("#/observe", "#/observe/observe-ha")).toBe("#/observe/observe-ha");
    expect(composeSlotPath("#/a/b", "#/a/b/c")).toBe("#/a/b/c");
    // A slot that does NOT carry its prefix is a fresh relative child — still appended (the
    // placeMeme/childUri mint path, unaffected by the nested-open case above).
    expect(composeSlotPath("#/a", "#/z")).toBe("#/a/z");
  });
});

describe.skipIf(wikiSkip)("★ the field a slot child carries is the field the orphan scan filters by ★", () => {
  test("`[field:$fragment-parent[…]]` finds the records the split mints", async () => {
    const engine = await bootTestWiki({
      tiddlers: [
        { title: `${URI}#/old`, "$fragment-parent": URI, text: "old" },
        { title: "lar:///t/y#/a", "$fragment-parent": "lar:///t/y", text: "other" },
      ],
    });
    const found = engine.wiki.filterTiddlers(`[field:$fragment-parent[${URI}]]`) as string[];
    expect(found).toEqual([`${URI}#/old`]);
    engine.dispose();
  });
});
