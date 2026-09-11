/**
 * ONE SLOT, ONE ADDRESS — a bare `#a` opener mints `#/a` everywhere a reader hands the slot on.
 *
 * The opener admits two spellings (`#a` · `#/a`) and the record's title mints one (`#/a`). Every
 * reader that carries the slot forward — the kahea ref the parent keeps, the `$slot` field, the
 * meme-ast's `Ahu.uri`, the declared-structure set, the live render's link — must hand on the MINTED
 * spelling, or a ref written `#a` points at an address no record answers to. Measured on the island: a
 * `<<~ kahea ahu #a>>` rendered `tc-tiddlylink-missing` beside a child that stood at `#/a`.
 *
 * The corpus carries no bare opener (`ahu-sections-address` ③); this pins the READER, so a bare
 * opener that still arrives — a test fixture, an older carrier — resolves rather than dangles.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";
import { deserializeCarrier } from "../src/deserializer.js";
import { memeticIngestOps } from "../src/ingest-gate.js";

const URI = "lar:///t/spelling";
const carrier = (body: string): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/spelling"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  body + `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;
const bare   = carrier(`<<~ ahu #a>>\n\n! a\n\n<<~/ahu>>\n`);
const rooted = carrier(`<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n`);
const nested = carrier(`<<~ ahu #/a>>\n\n<<~ ahu #c>>\n\n! c\n\n<<~/ahu>>\n\n<<~/ahu>>\n`);

describe("the deserializer hands on the minted spelling", () => {
  test("a `#a` opener leaves a `#/a` kahea ref and a `#/a` $slot — the same the `#/a` opener leaves", () => {
    const b = deserializeCarrier(bare, { title: URI });
    const r = deserializeCarrier(rooted, { title: URI });
    const refOf = (recs: typeof b.records) => String(recs.find((x) => x.title === URI)?.["text"]).match(/<<~ kahea ahu [^>]*>>/)?.[0];
    expect(refOf(b.records)).toBe("<<~ kahea ahu #/a>>");
    expect(refOf(r.records)).toBe("<<~ kahea ahu #/a>>");
    expect(b.records.find((x) => x.title === `${URI}#/a`)?.["$slot"]).toBe("#/a");
  });

  test("a nested `#c` inside `#/a` leaves a `#/c` ref in its parent and stands at `#/a/c`", () => {
    const n = deserializeCarrier(nested, { title: URI });
    expect(n.records.map((x) => x.title).filter((t) => !/\/\$/.test(String(t))).sort())
      .toEqual([URI, `${URI}#/a`, `${URI}#/a/c`]);
    expect(String(n.records.find((x) => x.title === `${URI}#/a`)?.["text"])).toContain("<<~ kahea ahu #/c>>");
  });
});

describe("the declared-structure set spells every slot rooted, so disk and render compare by address", () => {
  test("`#a` and `#/a` declare the one slot `#/a`", () => {
    expect([...memeticIngestOps.declaredStructure(bare)]).toEqual(["#/a"]);
    expect([...memeticIngestOps.declaredStructure(rooted)]).toEqual(["#/a"]);
  });
});

describe.skipIf(wikiSkip)(`the live render links a bare ref to the record that stands${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  beforeAll(async () => {
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
    await face.place(URI, nested);
  });

  /** The links a ref renders to, read under the tiddler it sits in — grammar imported as a page would. */
  const linksOf = (title: string, text: string): string[] =>
    [...renderWikitext(engine, `<$tiddler tiddler="${title}">${text}</$tiddler>`)
      .matchAll(/<a class="([^"]*tc-tiddlylink[^"]*)" href="#([^"]+)"/g)]
      .map((m) => `${decodeURIComponent(m[2]!)} ${m[1]!.includes("missing") ? "MISSING" : "resolves"}`);

  test("`<<~ kahea ahu #a>>` under the root resolves to `#/a`, the same as `<<~ kahea ahu #/a>>`", () => {
    // The slot's own link comes first; its body then renders the nested `#/a/c` ref beneath it.
    expect(linksOf(URI, "<<~ kahea ahu #a>>")).toEqual([`${URI}#/a resolves`, `${URI}#/a/c resolves`]);
    expect(linksOf(URI, "<<~ kahea ahu #/a>>")).toEqual([`${URI}#/a resolves`, `${URI}#/a/c resolves`]);
  });

  test("`<<~ kahea ahu #/c>>` under the child `#/a` resolves to `#/a/c` — a fragment never repeats its `#`", () => {
    expect(linksOf(`${URI}#/a`, "<<~ kahea ahu #/c>>")).toEqual([`${URI}#/a/c resolves`]);
  });

  test("the meme-ast addresses a bare slot as the record does: `#a` → `#/a`, a nested `#c` → `#/a/c`", () => {
    const uris = (text: string) => {
      const out: string[] = [];
      const walk = (nodes: readonly { kind: string; uri?: string; body?: readonly unknown[] }[]) => {
        for (const n of nodes) { if (n.kind === "Ahu") out.push(n.uri!); if (n.body) walk(n.body as never); }
      };
      walk(face.parse(URI, text).nodes as never);
      return out;
    };
    expect(uris(bare)).toEqual([`${URI}#/a`]);
    expect(uris(rooted)).toEqual([`${URI}#/a`]);
    expect(uris(nested)).toEqual([`${URI}#/a`, `${URI}#/a/c`]);
  });

  test("CONTROL: a ref to a slot no record stands under links missing", () => {
    expect(linksOf(URI, "<<~ kahea ahu #/absent>>")).toEqual([`${URI}#/absent MISSING`]);
  });
});
