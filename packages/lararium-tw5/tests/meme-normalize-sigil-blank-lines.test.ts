/**
 * `lares meme normalize` leaves ONE blank line between two sigils.
 *
 * OPERATOR RULED (2026-11-01): the corpus had collected extra blank lines in its leading body —
 * three between `<<~ kanawai …>>` and the first `<<~ ahu …>>` in 161 memes, between `<<~ aka …>>`
 * and the first section in 23 more, and a few between body sigils — and normalize read them as
 * canonical. "Scan and fix, one newline between sigils, then the fix for the normalize/check code."
 * A run of blank lines whose neighbours are both sigil lines (`<<~`, `<<^`, `<<!`) collapses to one
 * blank line. A run beside prose is authored spacing and holds; a run SHOWN inside a fence is held
 * text and moves no byte.
 */
import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";

const HEAD = (body: string) =>
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\n" +
  "<<^ code=`&#x0001;` to=`lar:///t.u.v/x`>>\n<<^ code=`&#x0002;`>>\n\n" +
  '```toml meta\ncacheable = true\n```\n\n' +
  body + "\n\n<<^ code=`&#x0004;` to=`?`>>\n";

describe("normalizeMemeSource — one blank line between sigils", () => {
  test("RED→GREEN — the head gap between kanawai and the first ahu collapses to one blank line", () => {
    const src = HEAD("<<~ kanawai uri=`lar:///ha.ka.ba/lares/ref/RFC-2119`>>\n\n\n\n<<~ ahu slot=`#/head`>>\n\n! Head\n\n<<~/ahu>>");
    const { text, changed, notes } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<~ kanawai uri=`lar:///ha.ka.ba/lares/ref/RFC-2119`>>\n\n<<~ ahu slot=`#/head`>>");
    expect(notes.join()).toMatch(/blank lines between sigils/);
  });

  test("RED→GREEN — an aka pin and a body sigil pair collapse too", () => {
    const src = HEAD("<<~ aka uri=`lar:///a.b.c/x`>>\n\n\n<<~ ahu slot=`#/a`>>\n\nText.\n\n<<~/ahu>>\n\n\n<<~ ahu slot=`#/b`>>\n\nMore.\n\n<<~/ahu>>");
    const { text } = normalizeMemeSource(src);
    expect(text).toContain("<<~ aka uri=`lar:///a.b.c/x`>>\n\n<<~ ahu slot=`#/a`>>");
    expect(text).toContain("<<~/ahu>>\n\n<<~ ahu slot=`#/b`>>");
  });

  test("CONTROL — a run beside prose is authored spacing and holds", () => {
    const body = "<<~ ahu slot=`#/a`>>\n\nFirst paragraph.\n\n\n\nSecond paragraph.\n\n<<~/ahu>>";
    const { text } = normalizeMemeSource(HEAD(body));
    expect(text).toContain("First paragraph.\n\n\n\nSecond paragraph.");
  });

  test("CONTROL — a gap SHOWN inside a fence is held text and moves no byte", () => {
    const body = "<<~ ahu slot=`#/a`>>\n\n```memetic-wikitext\n<<~ kanawai uri=`lar:///x.y.z`>>\n\n\n<<~ ahu slot=`#/q`>>\n```\n\n<<~/ahu>>";
    const { text } = normalizeMemeSource(HEAD(body));
    expect(text).toContain("<<~ kanawai uri=`lar:///x.y.z`>>\n\n\n<<~ ahu slot=`#/q`>>");
  });

  test("IDEMPOTENT — a carrier already at one blank line reads canonical", () => {
    const src = HEAD("<<~ kanawai uri=`lar:///ha.ka.ba/lares/ref/RFC-2119`>>\n\n<<~ ahu slot=`#/head`>>\n\n! Head\n\n<<~/ahu>>");
    const once = normalizeMemeSource(src).text;
    const twice = normalizeMemeSource(once);
    expect(twice.changed).toBe(false);
  });
});
