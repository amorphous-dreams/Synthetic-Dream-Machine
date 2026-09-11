/**
 * THE EXPORT DOOR — a stock wiki's Export dropdown offers memetic-wikitext.
 *
 * TiddlyWiki lists every tiddler tagged `$:/tags/Exporter` in the Tiddler and Page export dropdowns and
 * renders the chosen one with `exportFilter` bound to the selection. The plugin ships one whose body
 * emits each selected meme RECOMPOSED (children spliced whole, the block check adjacent) — the same
 * bytes `--render` writes through the `mem` template and `$tw.lares.meme.project(uri, "mem")` returns.
 *
 * The CONTROL: a selection holding no carrier root exports nothing — an empty file, never a frame
 * invented around a record that was no meme.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const EXPORTER = "lar:///ha.ka.ba/lararium/exporters/memetic-wikitext";
const uriOf = (n: string): string => `lar:///t/${n}`;
const meme = (n: string, slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${uriOf(n)}">>\n\`\`\`toml meta\nuri-path = "t/${n}"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe.skipIf(wikiSkip)(`Export → memetic-wikitext${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  const exportOf = (filter: string): string =>
    engine.wiki.renderTiddler("text/plain", EXPORTER, { variables: { exportFilter: filter } });

  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: [{ title: "plain", text: "a wikitext record, no meme" }] });
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
    await face.place(uriOf("one"), meme("one", ["a", "b"]));
    await face.place(uriOf("two"), meme("two", ["c"]));
  });

  test("the exporter stands tagged for the dropdown, extension .mem", () => {
    const fields = engine.wiki.getTiddler(EXPORTER)!.fields as Record<string, unknown>;
    expect(engine.wiki.filterTiddlers("[all[shadows+tiddlers]tag[$:/tags/Exporter]]")).toContain(EXPORTER);
    expect(fields["extension"]).toBe(".mem");
    expect(fields["file-type"]).toBe(CARRIER_TYPE);
  });

  test("one root exports the recomposed carrier — the bytes project(uri, 'mem') returns", () => {
    const out = exportOf(`[[${uriOf("one")}]]`);
    expect(out).toBe(face.project(uriOf("one"), "mem").text);
    const records = memeticWikitextDeserializer.call({ wiki: engine.wiki } as never, out, { title: uriOf("one") }, CARRIER_TYPE) as Array<{ title: string }>;
    expect(records.map((r) => r.title).filter((t) => !t.includes("#/$")).sort()).toEqual([uriOf("one"), `${uriOf("one")}#/a`, `${uriOf("one")}#/b`]);
  });

  test("a child record exports the meme it belongs to; two roots export two carriers, once each", () => {
    expect(exportOf(`[[${uriOf("one")}#/b]]`)).toBe(face.project(uriOf("one"), "mem").text);
    const both = exportOf(`[[${uriOf("one")}]] [[${uriOf("one")}#/a]] [[${uriOf("two")}]]`);
    // Each carrier closes on its own newline after EOT, so the next DOCTYPE opens on a fresh line.
    expect(both).toBe(face.project(uriOf("one"), "mem").text + face.project(uriOf("two"), "mem").text);
  });

  test("CONTROL: a selection with no carrier root exports nothing", () => {
    expect(exportOf("[[plain]]")).toBe("");
    expect(exportOf("[[lar:///t/absent]]")).toBe("");
  });
});
