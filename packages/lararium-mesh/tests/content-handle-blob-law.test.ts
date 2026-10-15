/**
 * content-handle-blob-law.test.ts — THE BLOB LAW: kind picks the shape, size stays a wall.
 *
 * A body whose `type` registers `encoding: "base64"` in TW5's own file-type registry (or carries the
 * `image` flag — a picture the wiki shows) rides as a POINTER; a utf8 body rides INLINE. The one size
 * that survives is the 1 MiB utf8 FAULT wall. `_lar_cas` stays the one operator override. The mesh
 * table is TW5's `registerFileType` declaration transcribed — the fork's `boot.js` pins it here.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  ridesAsPointer, mediaTypeFromExt, isOversizedBody, skinnyHandleTiddler, TW5_FILE_TYPES, SKINNY_CARRIER_THRESHOLD,
} from "../src/content-handle.js";
import { cidUri } from "../src/lar-uris.js";

const BOOT_JS = new URL("../../../TiddlyWiki5/boot/boot.js", import.meta.url).pathname;
const cid = createHash("sha256").update("x").digest("hex");

describe("THE BLOB LAW — kind picks the shape", () => {
  test("a png rides as a pointer (CONTROL: the image family)", () => {
    expect(ridesAsPointer(mediaTypeFromExt(".png", true))).toBe(true);
  });
  test("a pdf (base64 in TW5's registry) rides as a pointer at ANY size — 200 KiB here", () => {
    expect(mediaTypeFromExt(".pdf", true)).toBe("application/pdf");
    expect(ridesAsPointer("application/pdf")).toBe(true);
    expect(isOversizedBody(200 * 1024)).toBe(false);
  });
  test("a 70 KiB text/markdown body rides INLINE — no size floor skins a utf8 body", () => {
    expect(mediaTypeFromExt(".md")).toBe("text/x-markdown");   // the LAST registration owns `.md` (boot.js:2555)
    expect(ridesAsPointer("text/markdown")).toBe(false);
    expect(ridesAsPointer("text/x-markdown")).toBe(false);
    expect(isOversizedBody(70 * 1024)).toBe(false);
  });
  test("an SVG joins the image family — a pointer; a `text/xml` declaration rides inline", () => {
    expect(mediaTypeFromExt(".svg")).toBe("image/svg+xml");
    expect(ridesAsPointer("image/svg+xml")).toBe(true);
    expect(ridesAsPointer("text/xml")).toBe(false);
  });
  test("a 1 MiB + 1 utf8 body crosses the FAULT wall; the wall is the only size that decides anything", () => {
    expect(isOversizedBody(SKINNY_CARRIER_THRESHOLD + 1)).toBe(true);
    expect(isOversizedBody(SKINNY_CARRIER_THRESHOLD)).toBe(false);
  });
  test("an unregistered binary (`.bin`) reads application/octet-stream → pointer; an unregistered text reads text/plain → inline", () => {
    expect(ridesAsPointer(mediaTypeFromExt(".bin", true))).toBe(true);
    expect(ridesAsPointer(mediaTypeFromExt(".xyz", false))).toBe(false);
  });
  test("a declared media family the registry lacks still reads by family (image/ · audio/ · video/ · font/)", () => {
    expect(ridesAsPointer("image/bmp")).toBe(true);
    expect(ridesAsPointer("audio/flac")).toBe(true);
  });
});

describe("the pointer spelling — no lar: _canonical_uri for a base64 family", () => {
  test("a png pointer carries _is_skinny · textCid · _integrity · size · type and NO _canonical_uri", () => {
    const h = skinnyHandleTiddler("lar:///t/p", cid, 3072, ".png", "image/png");
    expect(h).toMatchObject({ _is_skinny: "yes", textCid: cid, size: "3072", type: "image/png" });
    expect(h["_integrity"]).toMatch(/^ni:\/\/\/sha-256;/);
    expect(h["_canonical_uri"]).toBeUndefined();
  });
  test("a text/* pointer (the _lar_cas override) keeps the lar: cid _canonical_uri the lazy path reads", () => {
    const h = skinnyHandleTiddler("lar:///t/book", cid, 10, ".txt", "text/plain");
    expect(h["_canonical_uri"]).toBe(cidUri(cid));
  });
});

describe("the mesh table IS TW5's declaration (boot.js registerFileType, pinned)", () => {
  test("every registerFileType row in the fork's boot.js stands in TW5_FILE_TYPES with the same encoding + image flag", () => {
    const src = readFileSync(BOOT_JS, "utf8");
    const rows = [...src.matchAll(/registerFileType\("([^"]+)","(utf8|utf16le|base64)",(\[[^\]]*\]|"[^"]+")(?:,\{([^}]*)\})?\)/g)];
    expect(rows.length).toBeGreaterThan(40);
    for (const [, type, encoding, extsRaw, opts] of rows) {
      const exts = extsRaw!.startsWith("[") ? (JSON.parse(extsRaw!) as string[]) : [extsRaw!.slice(1, -1)];
      const image = /flags:\["image"\]/.test(opts ?? "");
      const row = TW5_FILE_TYPES[type!];
      expect(row, `boot.js registers ${type} — the mesh table lacks it`).toBeDefined();
      expect(row!.encoding, type).toBe(encoding);
      expect(row!.image ?? false, `${type} image flag`).toBe(image);
      expect([...row!.extensions], `${type} extensions`).toEqual(exts);
    }
    // The extension → type map follows TW5's own assignment order: the LAST row owns the extension.
    const last = new Map<string, string>();
    for (const [, type, , extsRaw] of rows) {
      const exts = extsRaw!.startsWith("[") ? (JSON.parse(extsRaw!) as string[]) : [extsRaw!.slice(1, -1)];
      for (const e of exts) last.set(e, type!);
    }
    for (const [ext, type] of last) expect(mediaTypeFromExt(ext), ext).toBe(type);
  });
});
