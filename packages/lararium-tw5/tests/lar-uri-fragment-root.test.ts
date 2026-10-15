/**
 * lar-uri filter — rooted-fragment equivalence (operator ruling, 21b4c5123).
 *
 * Every `lar:` URI fragment is ROOTED: `lar:///…#name` and `lar:///…#/name` name the SAME slot.
 * `divide()` (src/filters/lar-uri.ts) read the fragment raw, with no leading-`/` strip — a title
 * written in rooted form disagreed with its unrooted twin on `fragment` (extra leading `/`) and on
 * `depth` (off by one: `["", "bar"]` vs `["bar"]`). This file proves both spellings resolve
 * identically across every part this operator answers.
 */
import { describe, test, expect } from "vitest";
import { larUri } from "../src/filters/lar-uri.js";
import type { TW5FilterSource } from "../src/types/tiddlywiki.js";

const over = (titles: string[]): TW5FilterSource =>
  ((cb: (t: unknown, title: string) => void) => { for (const t of titles) cb(undefined, t); }) as never;
const part = (title: string, suffix: string) => larUri(over([title]), { suffix } as never);

const NESTED_BARE   = "lar:///ha.ka.ba/lares/api/pono/meme#edges/inbound";
const NESTED_ROOTED  = "lar:///ha.ka.ba/lares/api/pono/meme#/edges/inbound";
const SHALLOW_BARE  = "lar:///ha.ka.ba/lares/api/pono/meme#edges";
const SHALLOW_ROOTED = "lar:///ha.ka.ba/lares/api/pono/meme#/edges";

describe("lar-uri — a rooted fragment resolves to the same slot as its unrooted twin", () => {
  test("fragment reads identically rooted or bare", () => {
    expect(part(NESTED_ROOTED, "fragment")).toEqual(part(NESTED_BARE, "fragment"));
    expect(part(SHALLOW_ROOTED, "fragment")).toEqual(part(SHALLOW_BARE, "fragment"));
  });

  test("depth counts the same number of segments rooted or bare", () => {
    expect(part(NESTED_ROOTED, "depth")).toEqual(part(NESTED_BARE, "depth"));
    expect(part(SHALLOW_ROOTED, "depth")).toEqual(part(SHALLOW_BARE, "depth"));
    expect(part(NESTED_ROOTED, "depth")).toEqual(["2"]);
  });

  test("parent climbs identically rooted or bare", () => {
    expect(part(NESTED_ROOTED, "parent")).toEqual(part(NESTED_BARE, "parent"));
  });

  test("bare drops the fragment identically rooted or bare", () => {
    expect(part(NESTED_ROOTED, "bare")).toEqual(part(NESTED_BARE, "bare"));
  });
});
