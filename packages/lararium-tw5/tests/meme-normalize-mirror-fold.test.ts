/**
 * `lares meme normalize` folds every READ-ONLY mirror's HEAD TOKEN to its canonical house name —
 * every `lar-mirror-of` entry the generated table carries, `define`->`wehe` included.
 *
 * OPERATOR RULED: `lares meme normalize` "shall preserve explicitly marked weave/tangle
 * alternates, but otherwise normalize to house memetic-wikitext grammar." A read-only mirror
 * (`lar-mirror-of` set, no `lar-weave: primary`) carries no grammar of its own, so folding its head
 * token loses no authored intent; a `lar-weave: primary` mirror (`transclude`, `snapshot`) IS a
 * canonical spelling in its own tongue and never folds.
 *
 * EXPLICIT MARK = preserve: a carrier whose meta declares `tongue = "<bcp47>"` rests in its
 * authored mirror spellings — this fold never touches it.
 */
import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { GENERATED_SIGILS } from "../src/meme-ast/grammar-table.generated.js";

const READ_ONLY_MIRRORS = GENERATED_SIGILS
  .filter((s) => s.aliasFor && !s.weave)
  .map((s) => ({ name: s.name, canonical: s.aliasFor! }));

const HEAD = (body: string, meta = "") =>
  `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>\n\n` +
  `<<^ code="&#x0001;" from="?" -> to="lar:///t/x">>\n<<^ code="&#x0002;">>\n` +
  '```toml meta\ncacheable = true\n' + meta + '```\n\n' +
  body + `\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe("normalizeMemeSource — every read-only mirror folds to its canonical head", () => {
  // `fragment` alone opens bare (`<<fragment`, no `~`) — its own dedicated test below exercises
  // its real shape; this table covers every OTHER (sharktooth) mirror.
  test.each(READ_ONLY_MIRRORS.filter((m) => m.name !== "fragment").map((m) => [m.name, m.canonical] as const))(
    "RED→GREEN — %s folds to %s", (name, canonical) => {
      const src = HEAD(`<<~ ${name} "lar:///a.b.c/x">>`);
      const { text, changed, notes } = normalizeMemeSource(src);
      expect(changed, name).toBe(true);
      expect(text, name).toContain(`<<~ ${canonical} "lar:///a.b.c/x">>`);
      expect(text, name).not.toMatch(new RegExp(`<<~\\s*${name}\\b`));
      expect(notes.join(), name).toMatch(/read-only mirror occurrence.*folded to its canonical head/);
    });

  test("fragment (the one bare-form mirror) folds its open AND close to ahu", () => {
    const src = HEAD("<<fragment #/head>>\nbody\n<</fragment>>");
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<ahu #/head>>");
    expect(text).toContain("<</ahu>>");
    expect(text).not.toContain("fragment");
  });

  test("define/procedure fold to wehe; let/var/const fold to waiho (the pragma-kind mirrors)", () => {
    const src = HEAD('<<~ define greet(name:"world")>>Hello<<~/define>>');
    const { text } = normalizeMemeSource(src);
    expect(text).toContain('<<~ wehe greet(name:"world")>>');
    expect(text).toContain("<<~/wehe>>");
  });

  test("CONTROL — a bare `<<link …>>` (no `~`) matches NO declared mirror pattern, so it never folds", () => {
    // Measured against the real corpus (ai-phrasebook.mem:14): `<<link "https://…">>` resembles
    // the `link` mirror's own word but carries none of its declared sharktooth shape
    // (`<<~ link …>>`) — a universally-optional `~` in the fold regex would rewrite text that is
    // not actually the sigil at all. Only `fragment` (its own `lar-open-pattern`) opens bare.
    const src = HEAD('<<link "https://www.rfc-editor.org/rfc/rfc2119#section-1">>');
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toContain('<<link "https://www.rfc-editor.org/rfc/rfc2119#section-1">>');
  });

  test("CONTROL — a canonical head's own invocation stays byte-identical", () => {
    const src = HEAD('<<~ kahea "lar:///a.b.c/x">>');
    const { changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
  });

  test("CONTROL — a mirror word inside an ARGUMENT never folds (head token only)", () => {
    const src = HEAD('<<~ kahea "lar:///import/shadow/link">>');
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toContain('"lar:///import/shadow/link"');
  });

  test("CONTROL — a fenced example of a mirror stays verbatim", () => {
    const src = HEAD('```text\n<<~ import "lar:///a.b.c/x">>\n```');
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toContain('<<~ import "lar:///a.b.c/x">>');
  });

  test("a mirror written inside a hana/task guest-grammar body never folds", () => {
    const src = HEAD('<<~ hana "text">>\nsee <<~ import here>> in prose\n<<~/hana>>');
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
    expect(text).toContain("<<~ import here>>");
  });

  test("PRESERVE — a carrier declaring `tongue = \"en\"` in its meta keeps every authored mirror", () => {
    const src = HEAD('<<~ import "lar:///a.b.c/x">>', 'tongue = "en"\n');
    const { text, notes } = normalizeMemeSource(src);
    expect(text).toContain('<<~ import "lar:///a.b.c/x">>');
    expect(notes.join()).not.toMatch(/folded to its canonical head/);
  });

  test("a lar-weave: primary mirror (transclude/snapshot) never folds — it IS canonical in its tongue", () => {
    const src = HEAD('<<~ transclude "lar:///a.b.c/x">>\n<<~ snapshot "lar:///a.b.c/y">>');
    const { changed } = normalizeMemeSource(src);
    expect(changed).toBe(false);
  });

  test("applies UNCONDITIONALLY (FRAME authority) — no --grammar flag needed", () => {
    const src = HEAD('<<~ import "lar:///a.b.c/x">>');
    const { changed, grammarChanged } = normalizeMemeSource(src, { grammar: false });
    expect(changed).toBe(true);
    expect(grammarChanged).toBe(false);
  });

  test("idempotent — re-running normalize over already-folded text changes nothing further", () => {
    const once = normalizeMemeSource(HEAD('<<~ import "lar:///a.b.c/x">>')).text;
    const twice = normalizeMemeSource(once);
    expect(twice.changed).toBe(false);
  });
});
