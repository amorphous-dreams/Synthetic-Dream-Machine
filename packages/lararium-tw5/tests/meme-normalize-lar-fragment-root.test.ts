/**
 * meme-normalize — lar: fragment rooting (operator ruling, 21b4c5123).
 *
 * Every `lar:` URI fragment is ROOTED: `lar:///…#name` becomes `lar:///…#/name` (no plain-name
 * anchors). This clause rewrites a `lar:///<path>#<name>` lar: URI wherever one appears inside a
 * carrier's body — a sigil argument, a wikilink target, or bare prose — leaving an already-rooted
 * `#/name` fragment, a fenced/code-span example, a non-lar URI, and an http(s) URL's `#fragment`
 * untouched. Child-slot OPENS (`<<~ ahu #name>>`) are a separate clause (4, above) and carry no
 * `lar:///path` prefix, so this clause's required prefix naturally excludes them.
 */

import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { DECLARATION } from "@lararium/mesh/carrier-type";

const HEAD = (body: string) =>
  `${DECLARATION}\n\n<<^ code="&#x0001;" from=? -> to=lar:///x>>\n` +
  "```toml meta\n" +
  `cacheable = true\n` +
  "```\n\n<<^ code=\"&#x0002;\">>\n\n" + body + "\n\n" +
  "<<^ code=\"&#x0003;\">>\n";

describe("normalizeMemeSource — lar: fragment rooting", () => {
  test("a wikilink target roots an unrooted fragment", () => {
    const r = normalizeMemeSource(HEAD("see [[here|lar:///ha.ka.ba/lares/api/pono/foo#bar]] for detail"));
    expect(r.text).toContain("[[here|lar:///ha.ka.ba/lares/api/pono/foo#/bar]]");
  });

  test("a sigil argument roots an unrooted fragment", () => {
    const r = normalizeMemeSource(HEAD("<<pin lar:///ha.ka.ba/lares/api/pono/foo#bar>>"));
    expect(r.text).toContain("<<pin lar:///ha.ka.ba/lares/api/pono/foo#/bar>>");
  });

  test("bare prose roots an unrooted fragment", () => {
    const r = normalizeMemeSource(HEAD("read lar:///ha.ka.ba/lares/api/pono/foo#bar before continuing"));
    expect(r.text).toContain("lar:///ha.ka.ba/lares/api/pono/foo#/bar");
  });

  test("a fenced example of an unrooted fragment stays as authored", () => {
    const r = normalizeMemeSource(HEAD("```\nlar:///ha.ka.ba/lares/api/pono/foo#bar\n```"));
    expect(r.text).toContain("lar:///ha.ka.ba/lares/api/pono/foo#bar");
    expect(r.text).not.toContain("foo#/bar");
  });

  test("a code-span example of an unrooted fragment stays as authored", () => {
    const r = normalizeMemeSource(HEAD("prose `lar:///ha.ka.ba/lares/api/pono/foo#bar` prose"));
    expect(r.text).toContain("`lar:///ha.ka.ba/lares/api/pono/foo#bar`");
  });

  test("an already-rooted fragment round-trips byte-unchanged", () => {
    const src = HEAD("see lar:///ha.ka.ba/lares/api/pono/foo#/bar here");
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
    expect(r.text).toBe(src);
  });

  test("a non-lar URI with a fragment stays untouched", () => {
    const r = normalizeMemeSource(HEAD("see custom-scheme:///path#name here"));
    expect(r.text).toContain("custom-scheme:///path#name");
  });

  test("an https URL with a fragment stays untouched", () => {
    const r = normalizeMemeSource(HEAD("see https://www.rfc-editor.org/rfc/rfc3986#section-3.5 here"));
    expect(r.text).toContain("https://www.rfc-editor.org/rfc/rfc3986#section-3.5");
  });

  test("idempotent — rooting twice converges", () => {
    const once = normalizeMemeSource(HEAD("<<pin lar:///ha.ka.ba/lares/api/pono/foo#bar>>"));
    const twice = normalizeMemeSource(once.text);
    expect(twice.changed).toBe(false);
    expect(twice.text).toBe(once.text);
  });

  test("a child-slot open (bare #name, no lar: prefix) is untouched by this clause", () => {
    const src = HEAD("<<~ ahu #name>>\n\nbody\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    // Clause 4 handles slot roots separately; this clause's lar: prefix requirement
    // means it never fires on a bare slot open either way — assert no DOUBLE "//" artifact.
    expect(r.text).not.toContain("#//name");
  });
});
