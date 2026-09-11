/**
 * skinny-image-src — what the DOM sees when `<$image>` transcludes a POINTER tiddler.
 *
 * TW5's image widget reads `text` first, then `_canonical_uri`, and only in the else branch fires the
 * lazy path (`core/modules/widgets/image.js:61-90`). A pointer that persists a `lar:` `_canonical_uri`
 * takes the middle branch: `src="lar:///…"`, a name nothing fetches — a dead image. So the persisted
 * pointer for a base64 family carries NO `lar:` `_canonical_uri` (blob-carriage #/proposed-law clause 3):
 * the widget falls through to `getTiddlerText`, the lazy resolver splices the base64 `text`, and the
 * re-render emits a `data:` URI the DOM shows. The lazy resolver may mint a per-session `blob:` URL into
 * the VM copy on a browser island; on node the base64 `text` suffices.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { createHash } from "node:crypto";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import { skinnyHandleTiddler, cidUri } from "@lararium/mesh";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const CID = createHash("sha256").update(PNG).digest("hex");

const render = (engine: TW5Engine, tiddler: string): string =>
  engine.wiki.renderText("text/html", "text/vnd.tiddlywiki", `<$image source="${tiddler}"/>`);
const srcOf = (html: string): string | null => /src="([^"]*)"/.exec(html)?.[1] ?? null;

describe.skipIf(wikiSkip)(`the image widget over a pointer tiddler${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki(); });

  test("MEASURED: a pointer persisting a lar: _canonical_uri renders a DEAD src (the widget never lazy-loads it)", () => {
    engine.setTiddler({ title: "lar:///t/dead", _is_skinny: "yes", textCid: CID, _canonical_uri: cidUri(CID), type: "image/png", size: String(PNG.length) });
    const src = srcOf(render(engine, "lar:///t/dead"));
    expect(src).toMatch(/^lar:\/\/\//);
  });

  test("★ the house pointer for a base64 family carries NO _canonical_uri — the widget falls to the lazy branch (no src) ★", () => {
    const handle = skinnyHandleTiddler("lar:///t/photo", CID, PNG.length, ".png", "image/png");
    expect(handle["_canonical_uri"]).toBeUndefined();
    engine.setTiddler(handle as Record<string, string>);
    const html = render(engine, "lar:///t/photo");
    // the widget fires `getTiddlerText` (the lazy branch) and emits no source — never a dead lar: one
    expect(srcOf(html) ?? "").toBe("");
  });

  test("★ once the base64 text is spliced (the lazy resolver's move on node) the src reads a data: URI ★", () => {
    const handle = skinnyHandleTiddler("lar:///t/photo2", CID, PNG.length, ".png", "image/png");
    engine.setTiddler({ ...handle, text: PNG.toString("base64") } as Record<string, string>);
    const src = srcOf(render(engine, "lar:///t/photo2"));
    expect(src).toBe(`data:image/png;base64,${PNG.toString("base64")}`);
  });

  test("a text/* pointer MAY keep its lar: _canonical_uri (the lazy path reads it; no image widget involved)", () => {
    const handle = skinnyHandleTiddler("lar:///t/book", CID, PNG.length, ".txt", "text/plain");
    expect(handle["_canonical_uri"]).toBe(cidUri(CID));
  });
});
