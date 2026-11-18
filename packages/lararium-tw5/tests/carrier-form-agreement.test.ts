/**
 * carrier-form-agreement — the mesh's one carrier form (`carrierFormOf`, `@lararium/mesh`) names the SAME bytes the
 * disk projector hashes, for the same record.
 *
 * ── ONE ALGORITHM, ONE AUTHORITY ────────────────────────────────────────────────────────────────
 * An override's fork base, the face bases and the INGEST gate hash a record's carrier form without an engine
 * (`carrierHashOf`); the projector hashes the bytes `makeTw5FileInfo` renders through the booted engine's `$tw.Tiddler`
 * (`carrierHash(body, metaBody)`, `disk-projector.ts`). Two computations that agree today part silently the day one
 * changes, so this suite pins them together across a corpus of record shapes: fields, lists with and without
 * whitespace, dates, special characters, a sidecar'd record, a meme, a tiddler with no fields past its title, an
 * empty text, a record the `.json` form carries. The engine side runs with NO path or extension cascade, the record's own
 * type alone deciding the form; the one divergence the mesh form names is a `$:/config/FileSystemExtensions` filter
 * re-typing a record (the engine honours it; the mesh form cannot read an engine's config).
 *
 * Meme: lar:///ha.ka.ba/lararium/api/disk-projection
 */

import { describe, expect, test, beforeAll } from "vitest";
import { carrierFormOf, carrierHashOf } from "@lararium/mesh";
import { carrierHash } from "@lararium/mesh/crypto";

import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { makeTw5FileInfo } from "../src/tw5-file-info.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { TW5Instance } from "../src/types/tiddlywiki.js";

const MEME = "<<^ code=`&#x0001;` from=`?` to=`lar:///t.seed.weighs/one`>>\n<<^ code=`&#x0002;`>>\n\n! One\n\nwords\n\n<<^ code=`&#x0003;`>>\n\n<<^ code=`&#x0004;` to=`?`>>\n";

const CORPUS: ReadonlyArray<Record<string, unknown>> = [
  { title: "T", text: "canon words" },
  { title: "bare" },
  { title: "empty text", text: "" },
  { title: "tagged", tags: ["a b", "c"], text: "list as an array" },
  { title: "tagged string", tags: "[[a b]] c c", text: "list as a bracketed string, a duplicate dropped" },
  { title: "listed", list: ["x", "y z"], text: "the list field" },
  { title: "nbsp", tags: ["a b", "c d"], text: "U+00A0 stays unbracketed, a space brackets" },
  { title: "dated", created: "20261110010203004", modified: "20261110010203004", text: "dates" },
  { title: "dated object", created: new Date(Date.UTC(2026, 10, 10, 1, 2, 3, 4)), text: "a Date object" },
  { title: "numeric", count: 3, flag: true, text: "non-string values" },
  { title: "stamped", bag: "lar:///ha.ka.ba/bags/x", "$origin-bag": "lar:///ha.ka.ba/bags/x", text: "residency stamps out" },
  { title: "nulled", gone: null, kept: "v", text: "a null field drops" },
  { title: "special", note: "ünï \"quoted\" <b> & 'x'", text: "line\nbreak\n\nand a blank line\n" },
  { title: "crlf", text: "a\r\nb" },
  { title: "sidecar", type: "text/markdown", text: "# note", tags: "x" },
  { title: "sidecar empty", type: "text/markdown", text: "" },
  { title: "binary", type: "image/png", text: "iVBORw0KGgo=" },
  { title: "typed json", type: "application/json", text: "{\"a\":1}" },
  { title: "multiple", type: "text/vnd.tiddlywiki-multiple", text: "title: a\n\nx" },
  { title: "canonical uri", type: "image/png", _canonical_uri: "http://x/y.png", text: "" },
  { title: "meme", type: "text/vnd.tiddlywiki", "uri-path": "t.seed.weighs/one", text: MEME },
  { title: "unsafe name", "weird:name": "v", text: "an unsafe field name carries as json" },
  { title: "unsafe value", note: "line\u0001ctl", text: "a control character carries as json" },
  { title: "padded value", note: " padded ", text: "edge whitespace carries as json" },
];

describe("the one carrier form hashes as carrierHash does", () => {
  test("a record's carrier hash folds the form's body and meta, nothing else", () => {
    for (const fields of CORPUS) {
      const { body, meta } = carrierFormOf(fields);
      expect(carrierHashOf(fields), String(fields["title"])).toBe(carrierHash(body, meta));
    }
  });
  test("the `.tid` form reads block, blank line, text; a bare record reads its title line alone", () => {
    expect(carrierFormOf({ title: "T", text: "canon words", tags: ["a b", "c"] }).body).toBe("tags: [[a b]] c\ntitle: T\n\ncanon words");
    expect(carrierFormOf({ title: "bare" })).toEqual({ body: "title: bare" });
    expect(carrierFormOf({ title: "x", type: "text/markdown", text: "t" })).toEqual({ body: "t", meta: "title: x\ntype: text/markdown" });
  });
});

describe.skipIf(wikiSkip)(`the mesh carrier form agrees with the engine's bytes${skipNote}`, () => {
  let engine: TW5Engine;
  let $tw: TW5Instance;

  beforeAll(async () => {
    engine = await bootTestWiki({ tiddlers: [] });
    $tw = engine.$tw as unknown as TW5Instance;
  }, 120_000);

  test("★ every corpus record: the projector's body and meta equal the mesh form's, and so do the hashes ★", () => {
    for (const fields of CORPUS) {
      const title = String(fields["title"]);
      const port = makeTw5FileInfo($tw, title, fields as Record<string, unknown>, {});
      const mesh = carrierFormOf(fields);
      expect(mesh.body, `${title}: body`).toBe(port.body);
      expect(mesh.meta, `${title}: meta`).toBe(port.metaBody);
      expect(carrierHashOf(fields), `${title}: hash`).toBe(carrierHash(port.body, port.metaBody));
    }
  });
});
