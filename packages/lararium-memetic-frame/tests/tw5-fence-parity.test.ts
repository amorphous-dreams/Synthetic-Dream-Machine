/**
 * FENCES AT TIDDLYWIKI'S LAW — the frame masks what TW5 fences, and nothing else.
 *
 * TiddlyWiki's codeblock opens on a run of three or more BACKTICKS (`/(`{3,})/`) and closes on a line
 * holding only a run at least as long. A tilde run opens nothing there: `~~~` reads as text, and every
 * sigil beneath it stays live. TW5 decides every parity question (controller ruling, 2026-11-01), so the
 * fence mask follows it — a frame mark under `~~~` frames, exactly as the plugin renders it and
 * tree-sitter parses it.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { fencedSpans, fenceLineOpen, frameMarks } from "../src/index.js";

describe("★ a tilde run opens no fence ★", () => {
  test("RED: `~~~` opens nothing; the mask holds no span over it", () => {
    expect(fenceLineOpen("~~~")).toBeNull();
    expect(fencedSpans("~~~\nx\n~~~\n")).toEqual([]);
  });

  test("RED: a frame mark under `~~~` stays live", () => {
    expect(frameMarks("~~~\n<<^ code=`&#x0003;`>>\n~~~\n").etx).toHaveLength(1);
  });

  test("CONTROL: a backtick fence still masks, at TW5's length law", () => {
    expect(fenceLineOpen("```")).toEqual({ len: 3, ch: "`" });
    expect(frameMarks("```\n<<^ code=`&#x0003;`>>\n```\n").etx).toHaveLength(0);
    expect(frameMarks("````\n```\n<<^ code=`&#x0003;`>>\n```\n````\n").etx).toHaveLength(0);
  });
});
