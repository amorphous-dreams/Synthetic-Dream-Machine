/**
 * EVERY TW5 TYPE RIDES AS A TIDDLER · A POINTER TIDDLER NAMES BYTES BY THEIR HASH.
 *
 * Two rows of lar:///ha.ka.ba/kahua/memory/course/all-tiddlers-meme-verb-retires, read through the tiddler door on the same
 * booted engine and layered store the door's own suite stands (`bootTestWiki`, a `CompositeStore` of memory layers).
 *
 *   · ANY TW5 TYPE RIDES (step 5). One witness per content type TiddlyWiki registers a reading for: the record lands through
 *     `tiddler-put`, reads back through `tiddler-get` field for field, and the engine's own parser renders it. One witness per
 *     deserializer the engine ships: the tiddlers it yields land through the same put.
 *   · POINTER TIDDLERS (step 6). A record with no `text` whose `_canonical_uri` names content-addressed bytes
 *     (`ni:///sha-256;…`, `cid:…`, a `lar:` cid name) lands as the house pointer; a read resolves the bytes from the content
 *     tier and verifies them by hash; an unread or unverified pointer answers owed, never clean; a wrong digest refuses by name.
 *     Content-addressed, never versioned: the address carries a hash and nothing else.
 */
import { describe, test, expect } from "vitest";
import { sha256HexBytesSync, niUriSha256FromHex } from "@lararium/mesh/crypto";
import { CompositeStore } from "@lararium/mesh/composite-store";
import { bagUri, cidUri } from "@lararium/mesh/lar-uris";
import { MemoryTiddlerStore } from "../src/memory-store.js";
import { makeTiddlerGetReactor, makeTiddlerPutReactor, makeWikiRenderReactor, type TiddlerVerbOptions } from "../src/tiddler-verbs.js";
import { skinnyCid } from "../src/lazy-resolver.js";
import { holdsUnreadPointer, type MemeSink } from "../src/place-meme.js";
import { exportCarrierFile } from "../src/meme-write.js";
import type { TiddlerFields } from "../src/deserializer.js";
import type { VerbContext } from "../src/verb-dispatcher.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const DAEMON = bagUri("daemon");
const CANON = bagUri("lares");
const WORKING_POINTER = "lar:///ha.ka.ba/lararium/config/current-wiki-bag";
const A = { recipe: "default" } as const;
type Cap = VerbContext["cap"];
const writer: Cap = async (access, bag) => (bag === DAEMON || access === "read" ? { ok: true } : { ok: false, reason: "no-grant" });
const ctx = (): VerbContext => ({ daemon: {} as CompositeStore, invocation: { requestId: "r1" } as VerbContext["invocation"], cap: writer });

async function rig(cas: Map<string, Uint8Array> = new Map()) {
  const engine = await bootTestWiki({ tiddlers: [{ title: WORKING_POINTER, text: DAEMON }] });
  const composite = new CompositeStore();
  composite.addLayer({ bagId: CANON, store: new MemoryTiddlerStore(CANON), writable: false });
  composite.addLayer({ bagId: DAEMON, store: new MemoryTiddlerStore(DAEMON), writable: true });
  const asked: string[] = [];
  const opts: TiddlerVerbOptions = { composite, tw5: engine, resolveByCid: async (cid) => { asked.push(cid); return cas.get(cid) ?? null; } };
  return { engine, opts, asked, put: makeTiddlerPutReactor(opts), get: makeTiddlerGetReactor(opts), render: makeWikiRenderReactor(opts) };
}
const fieldsOf = (answer: Record<string, unknown>): Record<string, string> => (answer["tiddler"] as { fields: Record<string, string> }).fields;
const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64");

/** A byte run no utf8 reading survives: a PNG signature and noise. */
const BLOB = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xfe, 0x01]);

describe.skipIf(wikiSkip)(`every TW5 type rides as a tiddler through the door${skipNote}`, () => {
  // One row per content type the engine registers a reading for. `text` rides as the engine holds it: words for a utf8
  // type, base64 for a type the registry marks `base64`.
  const UTF8: ReadonlyArray<readonly [type: string, text: string]> = [
    ["text/vnd.tiddlywiki", "''bold'' words"],
    ["text/plain", "plain words, no markup read"],
    ["text/markdown", "# a heading\n\na paragraph"],
    ["text/x-markdown", "# a heading\n\na paragraph"],
    ["text/html", "<p>a paragraph</p>"],
    ["text/css", "body { color: red; }"],
    ["application/javascript", "exports.answer = 42;"],
    ["application/json", "{\"alpha\":1,\"beta\":[2,3]}"],
    ["application/x-tiddler-dictionary", "alpha: one\nbeta: two"],
    ["text/csv", "name,count\nalpha,1\nbeta,2"],
    ["image/svg+xml", "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle r=\"1\"/></svg>"],
    ["text/x-bibtex", "@book{key, title={A Title}}"],
  ];
  const BASE64: readonly string[] = [
    "image/png", "image/jpeg", "image/gif", "image/webp", "image/x-icon", "application/pdf",
    "audio/mpeg", "audio/ogg", "audio/mp4", "video/mp4", "video/webm", "video/ogg",
    "font/woff2", "application/zip", "application/octet-stream",
  ];

  test.each(UTF8)("RED: a %s tiddler lands through tiddler-put and reads back field for field", async (type, text) => {
    const r = await rig();
    const title = `Typed ${type}`;
    expect(await r.put({ ...A, title, create: true, text, fields: { type, tags: "typed" } }, ctx())).toMatchObject({ decision: "put", created: true });
    expect(fieldsOf(await r.get({ ...A, title, grain: "fat" }, ctx()))).toEqual({ title, type, tags: "typed", text });
    // The engine holds the record under its own type, where every filter, widget and parser reads it.
    expect(r.engine.wiki.getTiddler(title)!.fields["type"]).toBe(type);
    expect(r.engine.wiki.getTiddlerText(title)).toBe(text);
  });

  test.each(BASE64)("RED: a %s tiddler lands inline as base64 through tiddler-put; a bare get leaves the blob home and a fat get carries it byte for byte", async (type) => {
    const r = await rig();
    const title = `Blob ${type}`;
    expect(await r.put({ ...A, title, create: true, text: b64(BLOB), fields: { type } }, ctx())).toMatchObject({ decision: "put", created: true });
    // THE BLOB LAW at the read: no grain named, the body stays home and `next` names the grain that carries it.
    const bare = await r.get({ ...A, title }, ctx());
    expect(bare).toMatchObject({ grain: { applied: "skinny" }, next: { grain: "fat" } });
    expect(fieldsOf(bare)["text"]).toBeUndefined();
    const fat = fieldsOf(await r.get({ ...A, title, grain: "fat" }, ctx()));
    expect(fat).toEqual({ title, type, text: b64(BLOB) });
    expect(new Uint8Array(Buffer.from(fat["text"]!, "base64"))).toEqual(BLOB);
  });

  test("RED: the engine's own parsers render what the door landed: plain text as its words, an image as a data URI, a csv as its cells", async () => {
    const r = await rig();
    await r.put({ ...A, title: "Plain", create: true, text: "plain words", fields: { type: "text/plain" } }, ctx());
    await r.put({ ...A, title: "Picture", create: true, text: b64(BLOB), fields: { type: "image/png" } }, ctx());
    await r.put({ ...A, title: "Table", create: true, text: "name,count\nalpha,1", fields: { type: "text/csv" } }, ctx());
    expect((await r.render({ ...A, title: "Plain" }, ctx()))["text"]).toContain("plain words");
    expect((await r.render({ ...A, title: "Picture", form: "html" }, ctx()))["text"]).toContain(`data:image/png;base64,${b64(BLOB)}`);
    expect((await r.render({ ...A, title: "Table" }, ctx()))["text"]).toContain("alpha");
  });

  // One row per deserializer the engine ships: the source text, and a tiddler it yields.
  const DESERIALIZED: ReadonlyArray<readonly [type: string, source: string, title: string, text: string]> = [
    ["application/x-tiddler", "title: From Tid\ntype: text/plain\n\nbody of the tid", "From Tid", "body of the tid"],
    ["application/json", "[{\"title\":\"From Json\",\"type\":\"text/plain\",\"text\":\"body of the json\"}]", "From Json", "body of the json"],
    ["application/x-tiddlers", "title: Multi/\n\none: body of one\ntwo: body of two", "Multi/two", "body of two"],
    ["application/x-tiddler-html-div", "<div title=\"From Div\" type=\"text/plain\">\n<pre>body of the div</pre>\n</div>", "From Div", "body of the div"],
  ];
  test.each(DESERIALIZED)("RED: the %s deserializer answers in the island engine, and each tiddler it yields lands through the plain put", async (type, source, title, text) => {
    const r = await rig();
    const wiki = r.engine.wiki as unknown as { deserializeTiddlers(type: string, text: string, fields?: Record<string, string>): Array<Record<string, string>> };
    const yielded = wiki.deserializeTiddlers(type, source, {});
    const named = yielded.find((fields) => fields["title"] === title);
    expect(named).toBeDefined();
    for (const fields of yielded) {
      const { title: each, text: body, ...rest } = fields;
      expect(await r.put({ ...A, title: each!, create: true, ...(typeof body === "string" ? { text: body } : {}), fields: rest }, ctx())).toMatchObject({ decision: "put", created: true });
    }
    expect(fieldsOf(await r.get({ ...A, title, grain: "fat" }, ctx()))["text"]).toBe(text);
  });
});

describe.skipIf(wikiSkip)(`a pointer tiddler names content-addressed bytes${skipNote}`, () => {
  const body = new TextEncoder().encode("the words the pointer names");
  const hex = sha256HexBytesSync(body);
  const ni = niUriSha256FromHex(hex);
  const blobHex = sha256HexBytesSync(BLOB);
  const blobNi = niUriSha256FromHex(blobHex);

  test("RED: a put of `_canonical_uri: ni:///sha-256;…` with `_integrity` seats the house pointer, and the tier's bytes verify at the put", async () => {
    const r = await rig(new Map([[hex, body]]));
    const made = await r.put({ ...A, title: "Words", create: true, fields: { type: "text/plain", _canonical_uri: ni, _integrity: ni } }, ctx());
    expect(made).toMatchObject({ decision: "put", created: true, pointer: { cid: hex, integrity: ni, body: "verified" } });
    // THE POINTER SHAPE: the address as written, the CAS key, the digest's RFC 6920 name, the lazy mark, the verified size.
    expect(r.engine.wiki.getTiddler("Words")!.getFieldStrings()).toMatchObject({
      title: "Words", type: "text/plain", _canonical_uri: ni, _integrity: ni, textCid: hex, _is_skinny: "yes", size: String(body.length),
    });
    expect(r.engine.wiki.getTiddler("Words")!.fields["text"]).toBeUndefined();
    // A second put of the same pointer moves nothing.
    expect(await r.put({ ...A, title: "Words", fields: { type: "text/plain", _canonical_uri: ni, _integrity: ni } }, ctx())).toMatchObject({ decision: "noop" });
  });

  test("RED: every content-address spelling names the same bytes: ni, cid:, cid:sha256:, and the house's lar cid name; `_integrity` may ride alone beside `textCid`", async () => {
    const r = await rig(new Map([[hex, body]]));
    const spellings = [ni, `cid:${hex}`, `cid:sha256:${hex.toUpperCase()}`, cidUri(hex)];
    for (const [index, address] of spellings.entries()) {
      const title = `Spelled ${index}`;
      expect(await r.put({ ...A, title, create: true, fields: { type: "text/plain", _canonical_uri: address } }, ctx())).toMatchObject({ decision: "put", pointer: { cid: hex, integrity: ni, body: "verified" } });
      expect(skinnyCid(r.engine.wiki.getTiddler(title)!.fields)).toBe(hex);
      expect(fieldsOf(await r.get({ ...A, title, grain: "resolved" }, ctx()))["text"]).toBe("the words the pointer names");
    }
    expect(await r.put({ ...A, title: "By Key", create: true, fields: { type: "text/plain", textCid: hex } }, ctx())).toMatchObject({ pointer: { cid: hex, integrity: ni, body: "verified" } });
    // The readers that never pass the door read an authored address too: the lazy resolver's key, the meme face's unread check.
    expect(skinnyCid({ _canonical_uri: ni })).toBe(hex);
    expect(skinnyCid({ _canonical_uri: `cid:${hex}` })).toBe(hex);
    expect(skinnyCid({ _canonical_uri: "https://example.org/a.png" })).toBeNull();
    const sink = { read: async () => ({ title: "x", _canonical_uri: ni } as TiddlerFields) } as Pick<MemeSink, "read">;
    expect(await holdsUnreadPointer("x", sink)).toBe(true);
  });

  test("RED: an unread pointer answers owed, never clean; a resolved read verifies by hash and answers verified; a tier that lacks the bytes answers owed and names the cure", async () => {
    const cas = new Map<string, Uint8Array>();
    const r = await rig(cas);
    // The tier holds nothing at the put: the pointer lands, owed.
    const made = await r.put({ ...A, title: "Later", create: true, fields: { type: "text/plain", _canonical_uri: ni, _integrity: ni } }, ctx());
    expect(made).toMatchObject({ decision: "put", pointer: { cid: hex, body: "owed", owes: expect.stringContaining(hex), cure: expect.stringContaining("lares bag cas") } });
    expect(r.engine.wiki.getTiddler("Later")!.fields["size"]).toBeUndefined();
    // No grain named: the handle, and the body owed (unread), with the read that closes it.
    const handle = await r.get({ ...A, title: "Later" }, ctx());
    expect(handle).toMatchObject({ grain: { applied: "handle" }, next: { grain: "resolved" }, pointer: { cid: hex, integrity: ni, body: "owed", owes: expect.stringMatching(/^unread/), cure: expect.stringContaining("form=text") } });
    // Asked for the body while the tier lacks it: still the handle, still owed, the tier named.
    const missed = await r.get({ ...A, title: "Later", grain: "resolved" }, ctx());
    expect(missed).toMatchObject({ grain: { applied: "handle" }, pointer: { body: "owed", owes: expect.stringContaining("holds no bytes") } });
    expect(fieldsOf(missed)["text"]).toBeUndefined();
    // The bytes arrive: the same read resolves, verifies and says so.
    cas.set(hex, body);
    const resolved = await r.get({ ...A, title: "Later", grain: "resolved" }, ctx());
    expect(resolved).toMatchObject({ grain: { applied: "resolved" }, pointer: { cid: hex, integrity: ni, body: "verified" } });
    expect(fieldsOf(resolved)["text"]).toBe("the words the pointer names");
    // CONTROL: a record that holds its text inline names no pointer.
    await r.put({ ...A, title: "Inline", create: true, text: "inline words" }, ctx());
    expect(await r.get({ ...A, title: "Inline" }, ctx())).not.toHaveProperty("pointer");
  });

  test("RED: a wrong digest refuses by name at the put and at the read, and nothing lands or splices", async () => {
    const wrong = new TextEncoder().encode("other bytes under the same name");
    const cas = new Map<string, Uint8Array>([[hex, wrong]]);
    const r = await rig(cas);
    await expect(r.put({ ...A, title: "Forged", create: true, fields: { type: "text/plain", _canonical_uri: ni, _integrity: ni } }, ctx()))
      .rejects.toMatchObject({ reason: "pointer-digest-mismatch" });
    expect(r.engine.wiki.tiddlerExists("Forged")).toBe(false);
    // A pointer that landed while the tier held nothing, and bytes that arrive hashing otherwise: the read refuses.
    cas.delete(hex);
    await r.put({ ...A, title: "Swapped", create: true, fields: { type: "text/plain", _canonical_uri: ni } }, ctx());
    cas.set(hex, wrong);
    await expect(r.get({ ...A, title: "Swapped", grain: "resolved" }, ctx())).rejects.toMatchObject({ reason: "pointer-digest-mismatch" });
    // CONTROL: the handle still answers, owed.
    expect(await r.get({ ...A, title: "Swapped" }, ctx())).toMatchObject({ grain: { applied: "handle" }, pointer: { body: "owed" } });
  });

  test("RED: names that disagree, and an address under no spelling the house reads, refuse by name before any byte reads", async () => {
    const r = await rig(new Map([[hex, body]]));
    const other = niUriSha256FromHex(blobHex);
    await expect(r.put({ ...A, title: "Split", create: true, fields: { type: "text/plain", _canonical_uri: ni, _integrity: other } }, ctx()))
      .rejects.toMatchObject({ reason: "pointer-integrity-mismatch" });
    await expect(r.put({ ...A, title: "Split", create: true, fields: { type: "text/plain", _canonical_uri: ni, textCid: blobHex } }, ctx()))
      .rejects.toMatchObject({ reason: "pointer-integrity-mismatch" });
    for (const address of ["ni:///md5;AAAA", "ni:///sha-256;AAAA", "cid:not-a-digest", `cid:blake3:${hex}`, `cid:${hex}@v2`]) {
      await expect(r.put({ ...A, title: "Unread", create: true, fields: { type: "text/plain", _canonical_uri: address } }, ctx()))
        .rejects.toMatchObject({ reason: "pointer-address-malformed" });
    }
    expect(r.engine.wiki.tiddlerExists("Split")).toBe(false);
    expect(r.engine.wiki.tiddlerExists("Unread")).toBe(false);
    expect(r.asked).toEqual([]);
    // A standing record whose names disagree (it reached the wiki by another road) refuses at the read too.
    r.engine.setTiddler({ title: "Standing", type: "text/plain", _is_skinny: "yes", textCid: hex, _integrity: other });
    await expect(r.get({ ...A, title: "Standing" }, ctx())).rejects.toMatchObject({ reason: "pointer-integrity-mismatch" });
  });

  test("RED: a pointer-kind type (an image) sheds its content-address `_canonical_uri` at the put, resolves to base64, and projects as the whole file beside its .meta", async () => {
    const r = await rig(new Map([[blobHex, BLOB]]));
    const title = "lar:///ha.ka.ba/lares/api/native/door-photo";
    const made = await r.put({ ...A, title, create: true, fields: { type: "image/png", _canonical_uri: blobNi, _integrity: blobNi } }, ctx());
    expect(made).toMatchObject({ decision: "put", pointer: { cid: blobHex, integrity: blobNi, body: "verified", seated: expect.arrayContaining(["_canonical_uri", "textCid", "_is_skinny", "size"]) } });
    const landed = r.engine.wiki.getTiddler(title)!.getFieldStrings();
    // TiddlyWiki's image widget emits `_canonical_uri` as `src`, and no browser fetches a content address: the record carries none.
    expect(landed["_canonical_uri"]).toBeUndefined();
    expect(landed).toMatchObject({ type: "image/png", textCid: blobHex, _integrity: blobNi, _is_skinny: "yes", size: String(BLOB.length) });
    const resolved = fieldsOf(await r.get({ ...A, title, grain: "resolved" }, ctx()));
    expect(new Uint8Array(Buffer.from(resolved["text"]!, "base64"))).toEqual(BLOB);
    // THE MIRROR'S SHORE: the pointer the door seated projects as the projector's pointer file, the blob named by its hash.
    const file = exportCarrierFile(r.engine, title);
    expect(file).toMatchObject({ ext: ".png", pointerCid: blobHex, body: "" });
    // CONTROL: a web2 address stays a source, named and never fetched, and the door seats nothing over it.
    const web = await r.put({ ...A, title: "Web", create: true, fields: { type: "image/png", _canonical_uri: "https://example.org/a.png" } }, ctx());
    expect(web).not.toHaveProperty("pointer");
    expect(r.engine.wiki.getTiddler("Web")!.fields["textCid"]).toBeUndefined();
    expect(await r.get({ ...A, title: "Web", grain: "resolved" }, ctx())).toMatchObject({ grain: { applied: "handle" }, pointer: { uri: "https://example.org/a.png", body: "owed" } });
  });

  test("RED: a tag patch over a standing pointer leaves its address as it stood; CONTROL: a put that moves the address re-seats it", async () => {
    const r = await rig(new Map([[hex, body], [blobHex, BLOB]]));
    r.engine.setTiddler({ title: "Legacy", type: "text/plain", _is_skinny: "yes", textCid: `sha256:${hex.toUpperCase()}` });
    const patched = await r.put({ ...A, title: "Legacy", tagsAdd: "kept" }, ctx());
    expect(patched).toMatchObject({ decision: "put", changed: ["tags"] });
    expect(patched).not.toHaveProperty("pointer");
    expect(r.engine.wiki.getTiddler("Legacy")!.fields["textCid"]).toBe(`sha256:${hex.toUpperCase()}`);
    const moved = await r.put({ ...A, title: "Legacy", fields: { textCid: blobHex } }, ctx());
    expect(moved).toMatchObject({ decision: "put", pointer: { cid: blobHex, body: "verified" } });
    expect(r.engine.wiki.getTiddler("Legacy")!.getFieldStrings()).toMatchObject({ textCid: blobHex, _integrity: blobNi, size: String(BLOB.length) });
  });
});
