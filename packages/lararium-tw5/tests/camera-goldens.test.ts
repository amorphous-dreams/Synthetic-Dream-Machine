import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { bootTestWiki } from "./test-wiki.js";

const directory = path.join(import.meta.dirname, "goldens", "cameras");
const specimens = JSON.parse(readFileSync(path.join(directory, "specimens.json"), "utf8")) as Array<{ title: string; text: string }>;
const normalize = (value: string) => value.replace(/\r\n/g, "\n").trim();

describe("TW5 html and text camera goldens", () => {
  it("matches normalized html and plain text for each specimen", async () => {
    const engine = await bootTestWiki({ tiddlers: specimens.map(({ title, text }) => ({ title, text })) });
    for (const specimen of specimens) {
      const expected = JSON.parse(readFileSync(path.join(directory, `${encodeURIComponent(specimen.title)}.json`), "utf8")) as { html: string; text: string };
      expect(normalize(engine.wiki.renderTiddler("text/html", specimen.title))).toBe(expected.html);
      expect(normalize(engine.wiki.renderTiddler("text/plain", specimen.title))).toBe(expected.text);
    }
  });

  // A camera the engine does not name degrades to the text camera, byte for byte: the mandatory degradation case.
  it("an unnamed camera degrades to the text camera's bytes", async () => {
    const engine = await bootTestWiki({ tiddlers: specimens.map(({ title, text }) => ({ title, text })) });
    for (const specimen of specimens) {
      const expected = JSON.parse(readFileSync(path.join(directory, `${encodeURIComponent(specimen.title)}.json`), "utf8")) as { text: string };
      expect(normalize(engine.wiki.renderTiddler("text/x-pono-missing-camera", specimen.title)), specimen.title).toBe(expected.text);
    }
  });
});
