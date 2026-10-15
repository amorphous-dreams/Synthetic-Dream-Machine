/**
 * weave — the submission projection's laws, each on the seam it guards.
 *
 * The projection serves a reader who was never taught the grammar, so every law here reads as a
 * promise to that reader: the frame never reaches them, the notation they do meet is shown
 * literally, their anchors resolve, and two projections of one carrier never differ.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  transposeMarkdown, projectSubmission, PROFILES,
  escapeXmlNameSegment, unescapeXmlNameSegment, yamlEscape, mirrorToCanonical,
  GENERATED_ALIAS_MAP, GENERATED_PRIMARY_WEAVE, fenceLineOpen, fenceLineClose,
} from "../src/weave/index.js";

const REPO = new URL("../../..", import.meta.url).pathname;

const CARRIER = `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>

<<^ code="&#x0001;" namespace="⊙" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/probe">>
<<^ code="&#x0002;">>

\`\`\`toml meta
l-space  = "adjacent"
uri-path = "ha.ka.ba/lares/api/pono/probe"
\`\`\`

<<~ ahu #/head>>

! Probe — a worked example

!! The ''bold'' law and the //italic// one

A confidence of 12/20 stays 12/20, and \`lar:///a//b\` keeps its slashes.

|!code |!mark |
|\`&#x0001;\` |SOH |

# first
# second

* a bullet

<<~ranks kind carrier -> descriptor>>
<<~ loulou lar:///ha.ka.ba/lares/api/pono/lar-uri>>

\`\`\`\`
<<^ code="&#x0002;">>
a teaching frame stays byte-identical, ''unrendered''
\`\`\`\`

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;AAAA_probe_check
<<^ code="&#x0004;" -> to="?">>
`;

describe("the submission projection", () => {
  const p = projectSubmission(CARRIER);

  test("the frame never reaches the reader; the meta records it", () => {
    // fenced teaching examples keep their marks by law — the promise binds prose lines only
    let fence = 0;
    for (const line of p.markdown.split("\n")) {
      const m = /^(`{3,})/.exec(line);
      if (m) { fence = fence === 0 ? m[1]!.length : (m[1]!.length >= fence ? 0 : fence); continue; }
      if (fence === 0) {
        expect(line).not.toMatch(/^<<\^/);
        expect(line).not.toMatch(/^<<!DOCTYPE/);
      }
    }
    expect(p.markdown).not.toContain("toml meta");
    expect(p.uri).toBe("lar:///ha.ka.ba/lares/api/pono/probe");
    expect(p.check).toBe("ni:///sha-256;AAAA_probe_check");
    expect(p.meta).toContain("source: lar:///ha.ka.ba/lares/api/pono/probe");
    expect(p.meta).toContain("source-check: ni:///sha-256;AAAA_probe_check");
  });

  test("headings, lists, emphasis transpose total", () => {
    expect(p.markdown).toContain("# Probe — a worked example");
    expect(p.markdown).toContain("## The **bold** law and the *italic* one");
    expect(p.markdown).toContain("1. first");
    expect(p.markdown).toContain("2. second");
    expect(p.markdown).toContain("- a bullet");
  });

  test("prose numerals and code-span slashes survive the emphasis pass", () => {
    expect(p.markdown).toContain("A confidence of 12/20 stays 12/20");
    expect(p.markdown).toContain("`lar:///a//b`");
  });

  test("tables shed the header mark and gain the separator row", () => {
    expect(p.markdown).toContain("| code | mark |");
    expect(p.markdown).toContain("|---|---|");
  });

  test("an ahu opens an anchor; edges become reference bullets; other sigils show literally", () => {
    expect(p.markdown).toContain('<a id="head"></a>');
    expect(p.markdown).not.toContain("<<~/ahu");
    expect(p.markdown).toContain("- `loulou lar:///ha.ka.ba/lares/api/pono/lar-uri`");
    expect(p.markdown).toContain("`<<~ranks kind carrier -> descriptor>>`");
  });

  test("an `ahu #/a/b` opener drops the root slash and joins nested segments with `_`", () => {
    // Operator-approved: 0 of 2,011 canon slot names carry `_`, so the join is unambiguous.
    const rooted = transposeMarkdown(CARRIER.replace("<<~ ahu #/head>>", "<<~ ahu #/a/b>>")).markdown;
    expect(rooted).toContain('<a id="a_b"></a>');
    expect(rooted).not.toContain('id="/a/b"');
    expect(rooted).not.toContain('id="#/a/b"');
  });

  test("an `ahu #/x` opener drops the lone root slash too", () => {
    const rooted = transposeMarkdown(CARRIER.replace("<<~ ahu #/head>>", "<<~ ahu #/x>>")).markdown;
    expect(rooted).toContain('<a id="x"></a>');
    expect(rooted).not.toContain('id="/x"');
  });

  test("CONTROL: an `aka`/`loulou` edge still becomes a reference bullet, untouched by the AHU_OPEN fix", () => {
    expect(p.markdown).toContain("- `loulou lar:///ha.ka.ba/lares/api/pono/lar-uri`");
  });

  test("an `aka` edge keeps its own sigil word, distinct from `loulou`", () => {
    const aka = transposeMarkdown("<<~ aka lar:///ha.ka.ba/lares/api/pono/RFC-2119>>\nprose\n").markdown;
    expect(aka).toContain("- `aka lar:///ha.ka.ba/lares/api/pono/RFC-2119`");
    expect(aka).not.toContain("- `loulou");
  });

  test("a fence seals its interior — the teaching frame passes byte-identical", () => {
    expect(p.markdown).toContain('<<^ code="&#x0002;">>\na teaching frame stays byte-identical');
    expect(p.markdown).toContain("''unrendered''");
  });

  test("★ a TILDE fence seals its interior too — CommonMark §4.5 admits it as a peer ★", () => {
    const src = "prose\n\n~~~\n''unrendered''\n<<~ aka lar:///ha.ka.ba/lares/api/pono/RFC-2119>>\n~~~\n\nafter ''bold''\n";
    const md = transposeMarkdown(src).markdown;
    expect(md).toContain("~~~\n''unrendered''\n<<~ aka lar:///ha.ka.ba/lares/api/pono/RFC-2119>>\n~~~");
    expect(md).not.toContain("- `aka lar:///ha.ka.ba/lares/api/pono/RFC-2119`");
    // CONTROL: past the closing tilde run the walk transposes again.
    expect(md).toContain("after **bold**");
  });

  test("CONTROL: a backtick run never closes a tilde fence", () => {
    const src = "~~~\n```\n''inside''\n~~~\n";
    expect(transposeMarkdown(src).markdown).toContain("```\n''inside''\n~~~");
  });

  test("a sigil spanning lines travels whole, fenced", () => {
    const src = "<<~ranks register a ~ one\n  -> b ~ two\n  -> c ~ three>>\nprose after\n";
    const t = transposeMarkdown(src);
    expect(t.markdown).toContain("```\n<<~ranks register a ~ one\n  -> b ~ two\n  -> c ~ three>>\n```");
    expect(t.markdown).toContain("prose after");
  });

  test("the projection is deterministic", () => {
    const again = projectSubmission(CARRIER);
    expect(again.markdown).toBe(p.markdown);
    expect(again.meta).toBe(p.meta);
  });
});

describe("defect: wikilinks ship as a CommonMark link", () => {
  test("`[[target]]` alone becomes a self-labelled link", () => {
    const t = transposeMarkdown("A line reads [[lar:///ha.ka.ba/lares/api/pono/lar-uri]] here.\n");
    expect(t.markdown).toContain("[lar:///ha.ka.ba/lares/api/pono/lar-uri](lar:///ha.ka.ba/lares/api/pono/lar-uri)");
    expect(t.markdown).not.toContain("[[");
  });

  test("`[[label|target]]` keeps the label separate from the target", () => {
    const t = transposeMarkdown("See [[the URI spec|lar:///ha.ka.ba/lares/api/pono/lar-uri]] for more.\n");
    expect(t.markdown).toContain("[the URI spec](lar:///ha.ka.ba/lares/api/pono/lar-uri)");
  });

  test("a bare-title target (no scheme) renders the same shape as a `lar:` target", () => {
    // Both are equally valid meme titles (HOSTFUL NAMES CONTENT) — neither earns a different
    // href shape. A title carrying whitespace takes CommonMark's angle-bracket destination form.
    const t = transposeMarkdown("[[My Title]]\n");
    expect(t.markdown).toContain("[My Title](<My Title>)");
  });

  test("CONTROL: a wikilink-shaped mention inside a code span stays literal", () => {
    const t = transposeMarkdown("The `[[text|target]]` syntax reads as a link.\n");
    expect(t.markdown).toContain("`[[text|target]]`");
    expect(t.markdown).not.toContain("[text](target)");
  });
});

describe("defect: transclusions carry verbatim, never invented into markdown", () => {
  test("a line-standing `{{title}}` carries whole in a tangle fence", () => {
    const t = transposeMarkdown("prose before\n\n{{lar:///ha.ka.ba/lares/api/pono/lar-uri}}\n\nprose after\n");
    expect(t.markdown).toContain('```memetic-wikitext tangle\n{{lar:///ha.ka.ba/lares/api/pono/lar-uri}}\n```');
    expect(t.markdown).toContain("prose before");
    expect(t.markdown).toContain("prose after");
  });

  test("a filtered `{{{ filter }}}` block carries the same way", () => {
    const t = transposeMarkdown("{{{ [tag[lares]] }}}\n");
    expect(t.markdown).toContain('```memetic-wikitext tangle\n{{{ [tag[lares]] }}}\n```');
  });

  test("a mid-line transclusion carries as an inline code span, since a fence cannot open mid-paragraph", () => {
    const t = transposeMarkdown("Compare {{Foo}} against the source.\n");
    expect(t.markdown).toContain("Compare `{{Foo}}` against the source.");
  });

  test("CONTROL: a `{{…}}` mention already inside a code span stays literal, single-wrapped", () => {
    const t = transposeMarkdown("The `{{title}}` transclusion syntax.\n");
    expect(t.markdown).toContain("`{{title}}`");
    expect((t.markdown.match(/`/g) ?? []).length).toBe(2);
  });
});

describe("defect: bold/italic marks spanning a hard line break now close", () => {
  test("`''bold''` spanning a line break resolves on both sides", () => {
    const t = transposeMarkdown("This spans ''bold\ntext'' across a break.\n");
    expect(t.markdown).toContain("This spans **bold\ntext** across a break.");
    expect(t.markdown).not.toContain("''");
  });

  test("`//italic//` spanning a line break resolves on both sides", () => {
    const t = transposeMarkdown("A run //that opens\nand closes// mid-paragraph.\n");
    expect(t.markdown).toContain("A run *that opens\nand closes* mid-paragraph.");
  });

  test("CONTROL: a code span or a `lar://` scheme elsewhere in the same paragraph run stays untouched", () => {
    // Regression this fix must not reopen: masking a quad-backtick teaching span over the WHOLE
    // joined paragraph (rather than one line at a time) once let it swallow an unrelated `''mark''`
    // three lines down. Masking stays per-line; only the emphasis substitution joins the run.
    const t = transposeMarkdown(
      "A labelled ```` ```toml meta ```` fence states identity.\n" +
      "Some other line reads `ahu` and keeps going.\n" +
      "The third line names the ''carrier'' by its own mark.\n",
    );
    expect(t.markdown).toContain("````");
    expect(t.markdown).toContain("`ahu`");
    expect(t.markdown).toContain("**carrier**");
  });

  test("CONTROL: a blank line still separates two independent paragraphs in the output", () => {
    const t = transposeMarkdown("First ''paragraph'' stands alone.\n\nSecond paragraph, unrelated.\n");
    expect(t.markdown).toContain("First **paragraph** stands alone.\n\nSecond paragraph, unrelated.");
  });
});

describe("against the live corpus", () => {
  test("the lar-uri spec projects whole", () => {
    const src = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/lar-uri.mem"), "utf8");
    const p = projectSubmission(src);
    expect(p.uri).toBe("lar:///ha.ka.ba/lares/api/pono/lar-uri");
    expect(p.check.startsWith("ni:///sha-256;")).toBe(true);
    expect(p.markdown).toContain("# ");
    // The frame stays out of the reader's copy — only fenced teaching examples may carry marks.
    // CENSUS LANE C: walked through weave's OWN fence-open/close rule (`fenceLineOpen`/
    // `fenceLineClose`, re-exported from the sanctioned surface), never a hand-rolled
    // `startsWith("\`\`\`")` that could drift from the production walk's own fence law.
    let fence: ReturnType<typeof fenceLineOpen> = null;
    const unfenced: string[] = [];
    for (const line of p.markdown.split("\n")) {
      if (fence === null) {
        fence = fenceLineOpen(line);
        if (fence) continue;
      } else if (fenceLineClose(line, fence)) {
        fence = null;
        continue;
      }
      if (fence !== null) continue;
      unfenced.push(line);
      expect(line).not.toMatch(/^<<\^ code:/);
    }
    expect(unfenced.length).toBeGreaterThan(50);
  });

  test("a second projection of the spec matches the first byte-for-byte", () => {
    const src = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/api/pono/lar-uri.mem"), "utf8");
    expect(projectSubmission(src).markdown).toBe(projectSubmission(src).markdown);
  });
});

describe("the tooth stands at one dispatch position", () => {
  const carrier = (open: string, close: string) =>
    `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/probe">>\n\n` +
    `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/probe">>\n` +
    `<<^ code="&#x0002;">>\n\n${open}\n\n! A heading\n\n${close}\n\n` +
    `<<^ code="&#x0003;">>\n<<^ code="&#x0004;" -> to="?">>\n`;

  const spellings: Array<[string, string, string]> = [
    ["tooth then space", "<<~ ahu #/entry>>", "<<~/ahu>>"],
    ["close carries a space", "<<~ ahu #/entry>>", "<<~ /ahu>>"],
    ["tooth joined to the word", "<<~ahu #/entry>>", "<<~/ahu>>"],
    ["both joined", "<<~ahu #/entry>>", "<<~ /ahu>>"],
  ];

  // A close word carries its own slash, matching the plain register's
  // `<<fragment …>>` / `<</fragment>>`. Every spelling reaches the same word,
  // so every spelling projects the same markdown.
  const expected = transposeMarkdown(carrier(spellings[0][1], spellings[0][2])).markdown;

  for (const [name, open, close] of spellings) {
    test(name, () => {
      const { markdown } = transposeMarkdown(carrier(open, close));
      expect(markdown).toBe(expected);
      expect(markdown).not.toContain("<<~");
    });
  }
});

describe("dialect profiles — RFC 7764 registered variants", () => {
  const CARRIER2 = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/probe2">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/probe2"
\`\`\`

<<^ code="&#x0002;">>

! A heading

<<^ code="&#x0003;">>ni:///sha-256;PROBE2
<<^ code="&#x0004;" -> to="?">>
`;

  test("CommonMark stays the default; today's output is unchanged", () => {
    const withDefault = projectSubmission(CARRIER2);
    const withExplicit = projectSubmission(CARRIER2, { profile: PROFILES.CommonMark });
    expect(withDefault.markdown).toBe(withExplicit.markdown);
    expect(withDefault.standalone).toBe(false);
    expect(withDefault.markdown).not.toContain("---\n");
    expect(withDefault.meta).toContain("source: lar:///ha.ka.ba/lares/api/pono/probe2");
  });

  test("GFM travels alone: YAML frontmatter PLUS a `.md.meta` sidecar (TW5 loads it too)", () => {
    const p = projectSubmission(CARRIER2, { profile: PROFILES.GFM });
    expect(p.standalone).toBe(true);
    expect(p.markdown.startsWith("---\n")).toBe(true);
    expect(p.markdown).toContain('source: "lar:///ha.ka.ba/lares/api/pono/probe2"');
    expect(p.markdown).toContain('source-check: "ni:///sha-256;PROBE2"');
    expect(p.markdown).toContain('variant: "GFM"');
    expect(p.markdown).toContain('lang: "en"');
    // the sidecar: title/type (what TW5 loads) + the target record (what --check re-projects with)
    expect(p.meta).toContain("title: lar:///ha.ka.ba/lares/api/pono/submissions/probe2");
    expect(p.meta).toContain("type: text/markdown");
    expect(p.meta).toContain("variant: GFM");
  });

  test("frontmatter keys sort lexicographically and every value double-quotes", () => {
    const p = projectSubmission(CARRIER2, { profile: PROFILES.GFM });
    const fm = p.markdown.split("---\n")[1]!;
    const keys = fm.trim().split("\n").map((l) => l.split(":")[0]!);
    expect(keys).toEqual([...keys].sort());
    for (const line of fm.trim().split("\n")) expect(line).toMatch(/: ".*"$/);
  });

  // ADVERSARIAL: a value carrying every byte that could break a naive quoted-scalar writer — a
  // literal `"`, a literal `\`, a `: ` (would end a plain scalar early), a `#` (would open a
  // comment), a leading `-` (would read as a block-sequence dash), and a YAML-1.1 bareword
  // (`no`/`yes`/`on`) that a 1.1 reader coerces to boolean. Every value here rides double-quoted
  // already, so `: `/`#`/leading `-`/the barewords are syntactically inert without any escaping of
  // their own; only `"`, `\`, and the control bytes need one, and this pins those exact bytes.
  test("yamlEscape: quotes, backslashes and control bytes escape to exact YAML 1.2 C-style bytes", () => {
    expect(yamlEscape('a "quoted" word')).toBe('a \\"quoted\\" word');
    expect(yamlEscape("a\\backslash")).toBe("a\\\\backslash");
    expect(yamlEscape("line one\nline two")).toBe("line one\\nline two");
    expect(yamlEscape("a\rb")).toBe("a\\rb");
    expect(yamlEscape("a\r\nb")).toBe("a\\nb");
    expect(yamlEscape("a\tb")).toBe("a\\tb");
    // structurally inert under double-quoting, carried through byte-for-byte, no escape needed:
    expect(yamlEscape("field: value")).toBe("field: value");
    expect(yamlEscape("a # comment")).toBe("a # comment");
    expect(yamlEscape("-leading-dash")).toBe("-leading-dash");
    expect(yamlEscape("no")).toBe("no");
    expect(yamlEscape("yes")).toBe("yes");
    expect(yamlEscape("on")).toBe("on");
  });

  test("an adversarial title weaves into frontmatter as one valid double-quoted scalar", () => {
    const title = 'a "title" with\nbackslash \\ and: colon # hash -dash no yes';
    const p = projectSubmission(CARRIER2, { profile: PROFILES.GFM, title });
    const line = p.markdown.split("\n").find((l) => l.startsWith("title:"));
    expect(line).toBe(
      'title: "a \\"title\\" with\\nbackslash \\\\ and: colon # hash -dash no yes"',
    );
    // exactly one opening and one closing UNESCAPED quote bound the scalar — no earlier unescaped
    // `"` inside it could be mistaken for the close.
    const inner = line!.slice("title: \"".length, -1);
    expect(/(^|[^\\])"/.test(inner)).toBe(false);
  });

  test("kramdown-rfc2629 REFUSES a carrier missing the RFC identity keys (tests/fixtures, not bags/)", () => {
    // Pinned to a FIXTURE rather than the live corpus: docs/pono/lar-uri.mem carried this refusal
    // until Canon-Scribe's 624b85d2d gave it docname/cat/ipr/author/date, and the next corpus edit
    // could add or drop a key just as easily — a RED needs ground that stays put.
    const src = readFileSync(join(REPO, "packages/lararium-tw5/tests/fixtures/kramdown-missing-keys.mem"), "utf8");
    expect(() => projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"] })).toThrow(/docname|cat|ipr|author|date/);
  });

  test("PROPOSAL: the real lar-uri.mem source now weaves under kramdown-rfc2629, per its proposed meta", () => {
    // "Proposed" names what the keys MEAN (docname `draft-fontany-lar-uri-scheme-00`, an unregistered
    // Internet-Draft name — ipr `trust200902` names the boilerplate an eventual submission would
    // carry) — not any uncertainty that the carrier's own toml meta holds them today.
    const src = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/docs/pono/lar-uri.mem"), "utf8");
    const p = projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"] });
    expect(p.standalone).toBe(true);
    expect(p.markdown).toContain('docname: "draft-fontany-lar-uri-scheme-00"');
    expect(p.markdown).toContain('ipr: "trust200902"');
  });

  test("kramdown-rfc2629 WEAVES once every required key stands in the carrier's own toml meta", () => {
    const src = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/draft-probe">>
\`\`\`toml meta
author    = "J. Fontany"
cat       = "info"
date      = "2026-09-29"
docname   = "draft-lares-probe-00"
ipr       = "trust200902"
title     = "A Probe Draft"
uri-path  = "ha.ka.ba/lares/api/pono/draft-probe"
\`\`\`

<<^ code="&#x0002;">>

! A draft

<<^ code="&#x0003;">>ni:///sha-256;PROBE3
<<^ code="&#x0004;" -> to="?">>
`;
    const p = projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"] });
    expect(p.standalone).toBe(true);
    expect(p.markdown).toContain('docname: "draft-lares-probe-00"');
    expect(p.markdown).toContain('cat: "info"');
    expect(p.markdown).toContain('ipr: "trust200902"');
    expect(p.markdown).toContain('author: "J. Fontany"');
    expect(p.markdown).toContain('date: "2026-09-29"');
  });

  test("CONTROL: kramdown-rfc2629's success path, end-to-end over a shelf-shaped test fixture", () => {
    // tests/fixtures, never bags/ — this fixture proves the SUCCESS path; the REFUSAL path above
    // already proves itself against the real corpus (docs/pono/lar-uri.mem, which lacks the keys).
    const src = readFileSync(join(REPO, "packages/lararium-tw5/tests/fixtures/kramdown-draft.mem"), "utf8");
    const p = projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"] });
    expect(p.standalone).toBe(true);
    expect(p.meta).toContain("variant: kramdown-rfc2629");
    expect(p.markdown.startsWith("---\n")).toBe(true);
    // The fixture's meta `title` carries the carrier's own canonical `lar:` address — the same
    // key every real carrier's meta holds it under (the round-trip law: `title` IS the address,
    // never a human caption, or the generic carrier reader would clobber it on every re-parse).
    // kramdown-rfc2629's REQUIRED `title` key reads whatever the carrier's own meta carries under
    // that name, so a standalone RFC draft wanting a human title supplies it via `projectSubmission`'s
    // own `title` option instead of overloading the carrier's identity field.
    expect(p.markdown).toContain(`title: "lar:///ha.ka.ba/lares/api/pono/draft-lares-probe"`);
    expect(p.markdown).toContain('docname: "draft-lares-probe-00"');
    expect(p.markdown).toContain('cat: "info"');
    expect(p.markdown).toContain('ipr: "trust200902"');
    expect(p.markdown).toContain('author: "J. Fontany"');
    expect(p.markdown).toContain('date: "2026-09-29"');
    expect(p.markdown).toContain("# A Probe Draft");
    expect(p.markdown).toContain("Body prose for the shelf-corpus CONTROL");
  });
});

describe("ahu ids: the ISO/IEC 9075-14 `_xHHHH_` escape, self-escaping", () => {
  test("a plain segment round-trips through escape/unescape unchanged", () => {
    for (const seg of ["abstract", "the-load-bearing-property", "a", "control-set"]) {
      expect(unescapeXmlNameSegment(escapeXmlNameSegment(seg))).toBe(seg);
    }
  });

  test("a character illegal in an XML Name escapes and round-trips", () => {
    const seg = "a slot/with a space";
    const escaped = escapeXmlNameSegment(seg);
    expect(escaped).not.toContain(" ");
    expect(unescapeXmlNameSegment(escaped)).toBe(seg);
  });

  test("a literal `_x` self-escapes (the trigger sequence) and round-trips", () => {
    const seg = "_xample";
    const escaped = escapeXmlNameSegment(seg);
    expect(escaped.startsWith("_x005F_x")).toBe(true);
    expect(unescapeXmlNameSegment(escaped)).toBe(seg);
  });

  test("CONTROL: an ahu id for a canon-shaped slot never escapes (0 of 2,011 canon names need it)", () => {
    const t = transposeMarkdown("<<~ ahu #/carrier-spine>>\nprose\n<<~/ahu>>\n");
    expect(t.markdown).toContain('<a id="carrier-spine"></a>');
  });

  test("CONTROL: the Hawaiian long vowels and ʻokina are already XML-Name-legal — no escape (operator ruling, slot-grammar-orthography)", () => {
    for (const seg of ["kānāwai", "hawaiʻi", "ʻōlelo"]) {
      const escaped = escapeXmlNameSegment(seg);
      expect(escaped).toBe(seg); // unchanged — these glyphs sit inside À-￿, already XML_NAME_CHAR
      expect(escaped).not.toContain("_x");
    }
  });

  test("a kahakō + ʻokina ahu slot weaves to a readable, unescaped anchor id", () => {
    const t = transposeMarkdown("<<~ ahu #/hawaiʻi/kānāwai>>\nprose\n<<~/ahu>>\n");
    expect(t.markdown).toContain('<a id="hawaiʻi_kānāwai"></a>');
  });
});

describe("aka vs kahea vs loulou — frozen, live, and plain citation", () => {
  test("a live `kahea` weaves as a plain-text-marked link — no glyph, decodable outward", () => {
    const t = transposeMarkdown("<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n");
    expect(t.markdown).toContain("(live) `kahea` [lar:///ha.ka.ba/lares/api/pono/lar-uri](lar:///ha.ka.ba/lares/api/pono/lar-uri)");
  });

  test("CONTROL: the marker reads the SAME plain-text spelling under every profile", () => {
    for (const profile of [PROFILES.CommonMark, PROFILES.GFM, PROFILES["kramdown-rfc2629"]]) {
      expect(profile.kaheaMarker).toBe("(live) ");
    }
  });

  test("a frozen `aka` with NO resolver falls back to a clearly marked unresolved reference", () => {
    const t = transposeMarkdown('<<~ aka "lar:///ha.ka.ba/lares/api/pono/lar-uri">>\n');
    expect(t.markdown).toContain("- `aka lar:///ha.ka.ba/lares/api/pono/lar-uri` (unresolved — no corpus to pin)");
  });

  test("a frozen `aka` WITH a resolver inlines the target's current text, pinned with its own ni: check", () => {
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

! Target content

<<^ code="&#x0003;">>ni:///sha-256;TARGET_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/target" ? target : null);
    const t = transposeMarkdown('<<~ aka "lar:///ha.ka.ba/lares/api/pono/target">>\n', PROFILES.CommonMark, resolve);
    expect(t.markdown).toContain("<!-- aka: lar:///ha.ka.ba/lares/api/pono/target pinned ni:///sha-256;TARGET_CHECK -->");
    expect(t.markdown).toContain("# Target content");
    expect(t.markdown).toContain("<!-- /aka -->");
    expect(t.markdown).not.toContain("unresolved");
  });

  test("a frozen `aka` with a `#/slot` fragment pins ONLY that slot's body, never the whole carrier", () => {
    // RED-before-fix: `bagsResolver` strips the fragment before resolving, and the old `weaveAka`
    // then inlined the WHOLE resolved carrier regardless — a `#/slot` fragment named nothing once
    // the target text was in hand, so the entire meme (every section) rode into a fragment-scoped
    // pin, which for an outward artifact (an IANA submission) smuggles content the author never
    // pointed at.
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

<<~ ahu #/other-slot>>

! Other Slot

This is a different section — must NOT appear in the pin.

<<~/ahu>>

<<~ ahu #/normative-language>>

! Normative Language

This is the slot the fragment names.

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;WHOLE_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/target" ? target : null);
    const t = transposeMarkdown(
      '<<~ aka "lar:///ha.ka.ba/lares/api/pono/target#/normative-language">>\n',
      PROFILES.CommonMark,
      resolve,
    );
    expect(t.markdown).toContain("# Normative Language");
    expect(t.markdown).toContain("This is the slot the fragment names.");
    expect(t.markdown).not.toContain("Other Slot");
    expect(t.markdown).not.toContain("different section");
    // pinned with a check over the SLOT's own bytes, never the whole carrier's WHOLE_CHECK
    expect(t.markdown).toContain("<!-- aka: lar:///ha.ka.ba/lares/api/pono/target#/normative-language pinned ni:///sha-256;");
    expect(t.markdown).not.toContain("WHOLE_CHECK");
  });

  test("CONTROL: the SAME target with NO fragment still inlines the whole carrier, unchanged", () => {
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

<<~ ahu #/other-slot>>

! Other Slot

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;WHOLE_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/target" ? target : null);
    const t = transposeMarkdown('<<~ aka "lar:///ha.ka.ba/lares/api/pono/target">>\n', PROFILES.CommonMark, resolve);
    expect(t.markdown).toContain("# Other Slot");
    expect(t.markdown).toContain("<!-- aka: lar:///ha.ka.ba/lares/api/pono/target pinned ni:///sha-256;WHOLE_CHECK -->");
  });

  test("a `#/slot` fragment naming no slot falls back to the marked-unresolved form, naming the missing slot", () => {
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

! No slots here

<<^ code="&#x0003;">>ni:///sha-256;TARGET_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/target" ? target : null);
    const t = transposeMarkdown(
      '<<~ aka "lar:///ha.ka.ba/lares/api/pono/target#/nowhere">>\n',
      PROFILES.CommonMark,
      resolve,
    );
    expect(t.markdown).toContain("- `aka lar:///ha.ka.ba/lares/api/pono/target#/nowhere` (unresolved — slot #/nowhere not found)");
  });

  test("a frozen `aka` whose resolver answers null (target unknown to the corpus) still falls back marked", () => {
    const resolve = (): string | null => null;
    const t = transposeMarkdown('<<~ aka "lar:///ha.ka.ba/lares/api/pono/nowhere">>\n', PROFILES.CommonMark, resolve);
    expect(t.markdown).toContain("- `aka lar:///ha.ka.ba/lares/api/pono/nowhere` (unresolved — no corpus to pin)");
  });

  test("CONTROL: `loulou` (and its mirror `link`) stays the plain reference bullet, untouched by the aka/kahea split", () => {
    const t = transposeMarkdown("<<~ loulou lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n<<~ link lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n");
    expect(t.markdown).toContain("- `loulou lar:///ha.ka.ba/lares/api/pono/lar-uri`");
    expect(t.markdown).toContain("- `link lar:///ha.ka.ba/lares/api/pono/lar-uri`");
  });

  test("CONTROL: `pin`, aka's English mirror, takes the same frozen treatment as `aka`", () => {
    // sigil-pin.tid (sibling, this loop) retired `shadow`/`snapshot` for `pin` — read off the
    // table (`mirrorsOf`), never hand-listed here.
    const t = transposeMarkdown('<<~ pin "lar:///ha.ka.ba/lares/api/pono/nowhere">>\n');
    expect(t.markdown).toContain("- `pin lar:///ha.ka.ba/lares/api/pono/nowhere` (unresolved — no corpus to pin)");
  });

  test("a `#/slot` fragment skips a fenced span that SHOWS the ahu sigils literally, and finds the real slot", () => {
    // RED-before-fix: `extractAhuSlot` walked AHU_OPEN/AHU_CLOSE line-by-line with no fence
    // awareness, while `weave()` below it already reads `fenceLineOpen`/`fenceLineClose` from
    // fence-mask.ts before trusting a line as a live sigil. A backtick fence showing the ahu
    // sigils as LITERAL TEXT (a worked example, a quoted illustration) fooled the slot scan into
    // opening and closing on the fence's own fake pair, so the fragment pinned the fence's fake
    // body instead of the real slot — exactly the carrier-bytes-the-author-never-pointed-at
    // failure the slot-scoped law (line ~510 above) exists to rule out.
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/fenced-target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/fenced-target"
\`\`\`

<<^ code="&#x0002;">>

\`\`\`text
<<~ ahu #/normative-language>>
FAKE slot content inside a fence — must not appear in the pin.
<<~/ahu>>
\`\`\`

<<~ ahu #/normative-language>>

! Normative Language

Real slot content, outside any fence.

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;FENCED_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/fenced-target" ? target : null);
    const t = transposeMarkdown(
      '<<~ aka "lar:///ha.ka.ba/lares/api/pono/fenced-target#/normative-language">>\n',
      PROFILES.CommonMark,
      resolve,
    );
    expect(t.markdown).toContain("Real slot content, outside any fence.");
    expect(t.markdown).not.toContain("FAKE slot content");
  });

  test("CONTROL: the same slot with NO fence present still extracts normally", () => {
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/unfenced-target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/unfenced-target"
\`\`\`

<<^ code="&#x0002;">>

<<~ ahu #/normative-language>>

! Normative Language

Real slot content, no fence anywhere.

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;UNFENCED_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/unfenced-target" ? target : null);
    const t = transposeMarkdown(
      '<<~ aka "lar:///ha.ka.ba/lares/api/pono/unfenced-target#/normative-language">>\n',
      PROFILES.CommonMark,
      resolve,
    );
    expect(t.markdown).toContain("Real slot content, no fence anywhere.");
  });
});

describe("LOOP 7: a pin's TARGET decides its shape; WHICH SIGIL (aka/pin vs kanawai/law) decides normative vs informative", () => {
  const carrier = (akaLine: string, where: "head" | "body") =>
    `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/probe">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/probe"
\`\`\`

<<^ code="&#x0002;">>

${where === "head" ? akaLine : ""}

<<~ ahu #/entry>>

! Entry

${where === "body" ? akaLine : ""}

<<~/ahu>>

<<^ code="&#x0003;">>
<<^ code="&#x0004;" -> to="?">>
`;

  // A CONTENT slot: no `reference-kind` at all — the shape every pre-LOOP-7 target still carries
  // (including the house's own `api/pono/RFC-2119` usage-law meme, per the operator's redirect).
  const CONTENT_TARGET = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

! Target content

<<^ code="&#x0003;">>ni:///sha-256;TARGET_CHECK
<<^ code="&#x0004;" -> to="?">>
`;

  // A REFERENCE meme, shaped exactly as Canon-Scribe's sibling work ships it (bags/lares/ha.ka.ba/
  // lares/ref/RFC-9498.mem): `reference-kind` top-level, citation fields under a nested `[reference]`
  // TOML table (`parseTaploFields` flattens it to `reference-<key>`). NOT RFC-2119/BCP 14 — an
  // ordinary informational reference, to prove detection reads meta, never a hardcoded path.
  const REFERENCE_TARGET = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/ref/RFC-9498">>
\`\`\`toml meta
reference-kind = "rfc"
uri-path       = "ha.ka.ba/lares/ref/RFC-9498"

[reference]
author     = "M. Schanzenbach"
date       = "November 2023"
seriesinfo = "Informational"
target     = "https://www.rfc-editor.org/info/rfc9498"
title      = "The GNU Name System"
\`\`\`

<<^ code="&#x0002;">>

! GNU Name System reference meme

<<^ code="&#x0003;">>ni:///sha-256;REF9498_CHECK
<<^ code="&#x0004;" -> to="?">>
`;

  // The BCP 14 key-words source — `reference-kind = "rfc"` plus `seriesinfo` naming RFC 2119/BCP 14.
  // Lives at a DELIBERATELY ODD address (never `.../RFC-2119`) to prove the special case fires off
  // the target's META, never a hardcoded path string.
  const BCP14_TARGET = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/ref/key-words-source">>
\`\`\`toml meta
reference-kind = "rfc"
uri-path       = "ha.ka.ba/lares/ref/key-words-source"

[reference]
author     = "S. Bradner"
date       = "March 1997"
seriesinfo = "BCP 14"
target     = "https://www.rfc-editor.org/info/rfc2119"
title      = "Key words for use in RFCs to Indicate Requirement Levels"
\`\`\`

<<^ code="&#x0002;">>

! RFC 2119 — Key Words

<<^ code="&#x0003;">>ni:///sha-256;BCP14_CHECK
<<^ code="&#x0004;" -> to="?">>
`;

  const resolve = (uri: string): string | null => {
    if (uri === "lar:///ha.ka.ba/lares/api/pono/target") return CONTENT_TARGET;
    if (uri === "lar:///ha.ka.ba/lares/ref/RFC-9498") return REFERENCE_TARGET;
    if (uri === "lar:///ha.ka.ba/lares/ref/key-words-source") return BCP14_TARGET;
    return null;
  };

  for (const where of ["head", "body"] as const) {
    test(`RED: a pin of a CONTENT target weaves as the frozen image in ${where} position — position no longer decides`, () => {
      const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/api/pono/target">>', where);
      const t = transposeMarkdown(src, PROFILES.CommonMark, resolve);
      expect(t.markdown).toContain("<!-- aka: lar:///ha.ka.ba/lares/api/pono/target pinned ni:///sha-256;TARGET_CHECK -->");
      expect(t.markdown).toContain("# Target content");
    });

    test(`RED: a pin of a REFERENCE meme weaves as a citation in ${where} position — position no longer decides`, () => {
      const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/RFC-9498">>', where);
      const t = transposeMarkdown(src, PROFILES.CommonMark, resolve);
      expect(t.markdown).toContain("- `aka lar:///ha.ka.ba/lares/ref/RFC-9498` — pinned `ni:///sha-256;REF9498_CHECK`");
      expect(t.markdown).not.toContain("GNU Name System reference meme");
      expect(t.markdown).not.toContain("<!--");
    });
  }

  test("a pin with no resolver falls back to the clearly marked unresolved form, whatever the eventual target kind", () => {
    const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/RFC-9498">>', "head");
    const t = transposeMarkdown(src);
    expect(t.markdown).toContain("- `aka lar:///ha.ka.ba/lares/ref/RFC-9498` (unresolved — no corpus to pin)");
  });

  test("RED: kramdown-rfc2629 weaves a KANAWAI pin of the BCP 14 key-words source as the boilerplate — detected off META, not a hardcoded path", () => {
    const src = carrier('<<~ kanawai "lar:///ha.ka.ba/lares/ref/key-words-source">>', "head");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolve);
    expect(t.markdown).toContain(
      'The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", ' +
      '"RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted ' +
      "as described in BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals, as " +
      "shown here.",
    );
    expect(t.references).toEqual([
      { anchor: "RFC2119", category: "normative" },
      { anchor: "RFC8174", category: "normative" },
    ]);
  });

  test("CONTROL: the SAME BCP 14 source, pinned in BODY position, still weaves the boilerplate — position never decided this", () => {
    const src = carrier('<<~ kanawai "lar:///ha.ka.ba/lares/ref/key-words-source">>', "body");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolve);
    expect(t.markdown).toContain("BCP 14");
  });

  test("CONTROL: an AKA pin (never kanawai) of the SAME BCP 14 source weaves an ordinary informative citation, never the boilerplate — role decides, not the target alone", () => {
    const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/key-words-source">>', "head");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolve);
    expect(t.markdown).not.toContain("BCP 14");
    // the fixture's address is deliberately NOT `.../RFC-2119` (proving detection reads meta, never
    // a path), so its derived anchor is its own last path segment, not "RFC2119".
    expect(t.markdown).toContain("[KEYWORDSSOURCE]");
    // not a standard-RFC-shaped anchor — carries its citation fields inline too.
    expect(t.references).toEqual([{
      anchor: "KEYWORDSSOURCE",
      category: "informative",
      fields: {
        author: "S. Bradner", date: "March 1997", seriesinfo: "BCP 14",
        target: "https://www.rfc-editor.org/info/rfc2119",
        title: "Key words for use in RFCs to Indicate Requirement Levels",
      },
    }]);
  });

  test("CONTROL: a non-BCP-14 reference meme pinned by AKA under kramdown-rfc2629 weaves its bracketed anchor, folded into `informative`", () => {
    const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/RFC-9498">>', "head");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolve);
    expect(t.markdown).toContain("[RFC9498]");
    expect(t.markdown).not.toContain("BCP 14");
    // RFC9498 IS a standard-RFC-shaped anchor — kramdown resolves it itself, no inline fields.
    expect(t.references).toEqual([{ anchor: "RFC9498", category: "informative" }]);
  });

  test("CONTROL: the SAME non-BCP-14 reference meme pinned by KANAWAI instead folds into `normative` — role alone flips the list, not the target", () => {
    const src = carrier('<<~ kanawai "lar:///ha.ka.ba/lares/ref/RFC-9498">>', "head");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolve);
    expect(t.markdown).toContain("[RFC9498]");
    expect(t.references).toEqual([{ anchor: "RFC9498", category: "normative" }]);
  });

  test("--tongue en weaves `aka` as `pin` and `kanawai` as `law` in the citation bullet", () => {
    const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/RFC-9498">>', "head");
    const t = transposeMarkdown(src, PROFILES.CommonMark, resolve, "en");
    expect(t.markdown).toContain("- `pin lar:///ha.ka.ba/lares/ref/RFC-9498` — pinned");
    const src2 = carrier('<<~ kanawai "lar:///ha.ka.ba/lares/ref/RFC-9498">>', "head");
    const t2 = transposeMarkdown(src2, PROFILES.CommonMark, resolve, "en");
    expect(t2.markdown).toContain("- `law lar:///ha.ka.ba/lares/ref/RFC-9498` — pinned");
  });

  test("CONTROL: a reference meme whose anchor is NOT standard-RFC-shaped carries its citation fields inline", () => {
    const nonStandard = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/ref/w3c-dom">>
\`\`\`toml meta
anchor         = "W3C.DOM"
reference-kind = "w3c"
uri-path       = "ha.ka.ba/lares/ref/w3c-dom"

[reference]
author     = "W3C"
date       = "2021"
seriesinfo = "W3C Recommendation"
target     = "https://www.w3.org/TR/dom/"
title      = "DOM Standard"
\`\`\`

<<^ code="&#x0002;">>

! DOM reference meme

<<^ code="&#x0003;">>ni:///sha-256;DOM_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolveDom = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/ref/w3c-dom" ? nonStandard : null);
    const src = carrier('<<~ aka "lar:///ha.ka.ba/lares/ref/w3c-dom">>', "head");
    const t = transposeMarkdown(src, PROFILES["kramdown-rfc2629"], resolveDom);
    expect(t.markdown).toContain("[W3C.DOM]");
    expect(t.references).toEqual([{
      anchor: "W3C.DOM",
      category: "informative",
      fields: { author: "W3C", date: "2021", seriesinfo: "W3C Recommendation", target: "https://www.w3.org/TR/dom/", title: "DOM Standard" },
    }]);
  });

  test("projectSubmission over kramdown-rfc2629 DERIVES normative:/informative: from the carrier's own pins, never hand-listed", () => {
    const src = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/draft-probe">>
\`\`\`toml meta
author    = "J. Fontany"
cat       = "info"
date      = "2026-09-29"
docname   = "draft-lares-probe-00"
ipr       = "trust200902"
title     = "A Probe Draft"
uri-path  = "ha.ka.ba/lares/api/pono/draft-probe"
\`\`\`

<<^ code="&#x0002;">>

<<~ kanawai "lar:///ha.ka.ba/lares/ref/key-words-source">>

<<~ ahu #/entry>>

! Entry

<<~ aka "lar:///ha.ka.ba/lares/ref/RFC-9498">>

<<~/ahu>>

<<^ code="&#x0003;">>ni:///sha-256;PROBE3
<<^ code="&#x0004;" -> to="?">>
`;
    const p = projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"], resolve });
    expect(p.markdown).toContain("normative:\n  RFC2119:\n  RFC8174:");
    expect(p.markdown).toContain("informative:\n  RFC9498:");
    expect(p.markdown).toContain("BCP 14");
  });
});

describe("fence-open reads through fence-mask's own rule — one rule, one place", () => {
  // CommonMark §4.5: a backtick fence's info string may carry no backtick. Before this fix, weave's
  // own `/^(`{3,})/` test opened a fence on ANY line starting with 3+ backticks, ignorant of that
  // guard — a prose line that merely QUOTES a quad-backtick inline span (alone on its own line) would
  // wrongly open a fence with no closer in sight, masking every line after it to end-of-text.
  test("RED-before-fix: a line opening with a quad-backtick inline span must NOT open a fence", () => {
    const t = transposeMarkdown("```` `a quoted span` ````\nprose that follows, unmasked\n");
    // Read as ordinary prose (the leading run's info string carries a backtick, so it never opens):
    // the code span inside masks and restores, and the next line reaches the reader untouched.
    expect(t.markdown).toContain("prose that follows, unmasked");
    expect(t.markdown).not.toMatch(/^````\n/);
  });

  test("CONTROL: a genuine fence (info string carries no backtick) still opens and seals its interior", () => {
    const t = transposeMarkdown("```toml\nkey = 1\n```\nprose after\n");
    expect(t.markdown).toContain("```toml\nkey = 1\n```");
    expect(t.markdown).toContain("prose after");
  });

  // CommonMark §4.5's close rule needs a run ≥ the opener AND NOTHING ELSE ON THE LINE. Before this
  // fix, weave's close test accepted any run ≥ the opener regardless of trailing content, so a
  // CONTENT line that merely starts with a shorter backtick run closed the fence early and read
  // what followed as if the fence had never opened.
  test("RED-before-fix: a content line starting with a trailed backtick run must NOT close an open fence", () => {
    const t = transposeMarkdown("````\nexample of `backticks`\n! Not a heading\n````\nafter\n");
    // Still fenced whole — "! Not a heading" never reaches the heading recognizer because the
    // fence never closed early on the "example of `backticks`" line.
    expect(t.markdown).toContain("````\nexample of `backticks`\n! Not a heading\n````");
    expect(t.markdown).not.toContain("# Not a heading");
    expect(t.markdown).toContain("after");
  });

  test("CONTROL: a bare closer (the run alone on its line) still closes", () => {
    const t = transposeMarkdown("````\nbody\n````\nafter\n");
    expect(t.markdown).toContain("````\nbody\n````");
    expect(t.markdown).toContain("after");
  });

  test("the meta fence's own close reads the same guard: a content line starting with backticks never closes it early", () => {
    const src = [
      '<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/probe">>',
      "```toml meta",
      "role = \"a value\"",
      "```` a content line that STARTS with backticks but is not a bare closer",
      "uri-path = \"ha.ka.ba/probe\"",
      "```",
      "",
      '<<^ code="&#x0002;">>',
      "",
      "! Body",
      "",
      '<<^ code="&#x0003;">>',
      '<<^ code="&#x0004;" -> to="?">>',
      "",
    ].join("\n");
    const t = transposeMarkdown(src);
    // RED-before-fix: the trailed line would have closed the meta fence early, dropping it into
    // `inMetaFence = false` mid-body — `uri-path` would then read as ORDINARY PROSE, never captured,
    // and the carrier's own address would go missing.
    expect(t.markdown).toContain("# Body");
    expect(t.markdown).not.toContain("content line that STARTS");
    expect(t.markdown).not.toContain("uri-path");
    expect(t.uri).toBe("lar:///ha.ka.ba/probe");
  });
});

describe("the hana fence: a foreign-grammar span weaves as ONE fenced block, never through the line recognizers", () => {
  test("RED-before-fix shape: a `#` inside a hana TOML body must NOT become a markdown list item", () => {
    const t = transposeMarkdown("<<~ hana toml>>\n# a TOML comment, not a heading\nkey = 1\n<<~/hana>>\n");
    expect(t.markdown).not.toContain("1. a TOML comment");
    expect(t.markdown).toContain("```toml\n# a TOML comment, not a heading\nkey = 1\n```");
  });

  test("the fence's info string carries the grammar key", () => {
    const t = transposeMarkdown("<<~ hana yaml>>\nfoo: bar\n<<~/hana>>\n");
    expect(t.markdown).toContain("```yaml\nfoo: bar\n```");
  });

  test("a hana body's own `''`/`//` marks stay verbatim — the span never reaches the emphasis pass", () => {
    const t = transposeMarkdown("<<~ hana toml>>\nnote = \"a //path// with ''marks''\"\n<<~/hana>>\n");
    expect(t.markdown).toContain("note = \"a //path// with ''marks''\"");
  });

  test("CONTROL: an ordinary `#` ordered item just outside the hana span still numbers, unbroken by the span", () => {
    // Matches the walk's pre-existing law: ordinal resets on a BLANK LINE alone (not on every
    // construct that interrupts a prose run — an ahu anchor or an edge bullet between two ordered
    // items does not reset the count either). A hana span between two `#` items keeps that law.
    const t = transposeMarkdown("# first\n<<~ hana toml>>\n# not a list item\n<<~/hana>>\n# second\n");
    expect(t.markdown).toContain("1. first");
    expect(t.markdown).toContain("2. second");
    expect(t.markdown).toContain("```toml\n# not a list item\n```");
  });
});

describe("the tongue axis — sigil HEAD names weave through the tongue's primary mirror", () => {
  const CARRIER3 = (body: string) =>
    `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/tongue-probe">>\n\`\`\`toml meta\nuri-path = "ha.ka.ba/lares/api/pono/tongue-probe"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n${body}\n\n<<^ code="&#x0003;">>\n<<^ code="&#x0004;" -> to="?">>\n`;

  test("CONTROL: no --tongue (undefined) leaves every head name canonical, byte-identical to before", () => {
    const src = CARRIER3(
      '<<~ ahu #/entry>>\n\n<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n\n<<~ loulou lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n\n<<~/ahu>>',
    );
    const noTongue = transposeMarkdown(src);
    const explicitUndefined = transposeMarkdown(src, PROFILES.CommonMark, undefined, undefined);
    expect(noTongue.markdown).toBe(explicitUndefined.markdown);
    expect(noTongue.markdown).toContain("(live) `kahea` [lar:///ha.ka.ba/lares/api/pono/lar-uri]");
    expect(noTongue.markdown).toContain("- `loulou lar:///ha.ka.ba/lares/api/pono/lar-uri`");
  });

  test("RED: --tongue en weaves kahea as transclude and aka as pin; ahu (no primary) stays ahu", () => {
    const src = CARRIER3(
      '<<~ ahu #/entry>>\n\n<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n\n<<~ aka "lar:///ha.ka.ba/lares/api/pono/lar-uri">>\n\n<<~/ahu>>',
    );
    const t = transposeMarkdown(src, PROFILES.CommonMark, undefined, "en");
    expect(t.markdown).toContain("(live) `transclude` [lar:///ha.ka.ba/lares/api/pono/lar-uri]");
    expect(t.markdown).toContain("- `pin lar:///ha.ka.ba/lares/api/pono/lar-uri` (unresolved — no corpus to pin)");
    // ahu carries no primary mirror in "en" — its own name never appears in the woven output either
    // way, but the ahu construct itself (the anchor) still weaves untouched, proving the tongue axis
    // does not disturb a construct it has nothing to translate for.
    expect(t.markdown).toContain('<a id="entry"></a>');
  });

  test("RED: a kahea ARGUMENT containing the word \"kahea\" stays untranslated — only the head token moves", () => {
    const src = CARRIER3('<<~ kahea "lar:///ha.ka.ba/lares/api/pono/kahea-fixture">>');
    const t = transposeMarkdown(src, PROFILES.CommonMark, undefined, "en");
    expect(t.markdown).toContain("(live) `transclude` [lar:///ha.ka.ba/lares/api/pono/kahea-fixture](lar:///ha.ka.ba/lares/api/pono/kahea-fixture)");
    // the argument's own "kahea" substring rides untouched — never swept by a global replace
    expect(t.markdown).toContain("kahea-fixture");
  });

  test("loulou has no primary mirror for \"en\" — stays canonical under --tongue too", () => {
    const src = CARRIER3('<<~ loulou lar:///ha.ka.ba/lares/api/pono/lar-uri>>');
    const t = transposeMarkdown(src, PROFILES.CommonMark, undefined, "en");
    expect(t.markdown).toContain("- `loulou lar:///ha.ka.ba/lares/api/pono/lar-uri`");
  });

  test("CONTROL: a generic line-standing sigil (no dedicated shape) also translates its head word only", () => {
    const t = transposeMarkdown('<<~ranks kind carrier -> descriptor>>\n', PROFILES.CommonMark, undefined, "en");
    // `ranks` names no sigil in the table at all — mirrorToCanonical answers null, so it passes
    // through as itself (the `?? word` fallback), exactly like an unrecognized word must.
    expect(t.markdown).toContain("`<<~ranks kind carrier -> descriptor>>`");
  });

  test("a frozen aka's PINNED content weaves under the same tongue, recursively", () => {
    const target = `<<^ code="&#x0001;" from="?" -> to="lar:///ha.ka.ba/lares/api/pono/target">>
\`\`\`toml meta
uri-path = "ha.ka.ba/lares/api/pono/target"
\`\`\`

<<^ code="&#x0002;">>

<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>

<<^ code="&#x0003;">>ni:///sha-256;TARGET_CHECK
<<^ code="&#x0004;" -> to="?">>
`;
    const resolve = (uri: string): string | null => (uri === "lar:///ha.ka.ba/lares/api/pono/target" ? target : null);
    const t = transposeMarkdown(
      '<<~ aka "lar:///ha.ka.ba/lares/api/pono/target">>\n',
      PROFILES.CommonMark,
      resolve,
      "en",
    );
    expect(t.markdown).toContain("<!-- pin: lar:///ha.ka.ba/lares/api/pono/target pinned");
    expect(t.markdown).toContain("(live) `transclude` [lar:///ha.ka.ba/lares/api/pono/lar-uri]");
  });

  test("--tongue en, --dialect GFM: frontmatter carries lang and tongue: \"x-lares>en\"", () => {
    const src = CARRIER3('<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>');
    const p = projectSubmission(src, { profile: PROFILES.GFM, tongue: "en" });
    expect(p.markdown).toContain('lang: "en"');
    expect(p.markdown).toContain('tongue: "x-lares>en"');
    expect(p.markdown).toContain("(live) `transclude`");
  });

  test("CONTROL: with no --tongue, frontmatter carries lang but OMITS the tongue key entirely", () => {
    const src = CARRIER3('<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>');
    const p = projectSubmission(src, { profile: PROFILES.GFM });
    expect(p.markdown).toContain('lang: "en"');
    expect(p.markdown).not.toContain("tongue:");
  });

  // ADVERSARIAL: a QUOTED sigil — inside a teaching fence, or inside a hana foreign-grammar span —
  // never reaches the line recognizers at all (the `fence > 0` passthrough, and hana's own
  // byte-verbatim capture, both run BEFORE any construct regex gets a look at the line). Under a
  // tongue this stays true: neither path calls `resolveHeadWord`/`translateSigilHead`, so a quoted
  // `<<~ kahea …>>` reads byte-identical whether or not `--tongue` is active. Proven, not assumed.
  test("ADVERSARIAL: a fenced example's `<<~ kahea …>>` does NOT translate under --tongue en", () => {
    const src = CARRIER3('```\n<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n```');
    const noTongue = transposeMarkdown(src);
    const tongued = transposeMarkdown(src, PROFILES.CommonMark, undefined, "en");
    expect(tongued.markdown).toBe(noTongue.markdown);
    expect(tongued.markdown).toContain("```\n<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n```");
    expect(tongued.markdown).not.toContain("transclude");
  });

  test("ADVERSARIAL: a hana body's `<<~ kahea …>>` does NOT translate under --tongue en", () => {
    const src = CARRIER3('<<~ hana toml>>\nnote = "<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>"\n<<~/hana>>');
    const noTongue = transposeMarkdown(src);
    const tongued = transposeMarkdown(src, PROFILES.CommonMark, undefined, "en");
    expect(tongued.markdown).toBe(noTongue.markdown);
    expect(tongued.markdown).toContain('note = "<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>"');
    expect(tongued.markdown).not.toContain("transclude");
  });
});

describe("the reverse mirror map and its round-trip property", () => {
  test("mirrorToCanonical answers every mirror in the table's own alias map, primary or read-only", () => {
    for (const [alias, canonical] of Object.entries(GENERATED_ALIAS_MAP)) {
      expect(mirrorToCanonical(alias)).toBe(canonical);
    }
  });

  test("CONTROL: a canonical name, or a word naming no sigil at all, answers null", () => {
    expect(mirrorToCanonical("ahu")).toBeNull();
    expect(mirrorToCanonical("kahea")).toBeNull();
    expect(mirrorToCanonical("not-a-sigil-at-all")).toBeNull();
  });

  test("PROPERTY: for every declared primary, canonical→primary→canonical is identity, and no two canonicals claim the same primary within one tongue", () => {
    // Walks `GENERATED_PRIMARY_WEAVE` (canonical → tongue → primary) — the table's OWN derived
    // index, re-exported from weave's sanctioned surface — rather than scanning `GENERATED_SIGILS`
    // directly (vm-grammar-boundary.test.ts's compile-layer boundary).
    const byTongue = new Map<string, Map<string, string>>(); // tongue -> primary name -> canonical it serves
    for (const [canonical, perTongue] of Object.entries(GENERATED_PRIMARY_WEAVE)) {
      for (const [tongue, primary] of Object.entries(perTongue)) {
        // round-trip: the primary's own reverse-map entry must point back at the SAME canonical the
        // forward (weave) direction derives it from.
        expect(mirrorToCanonical(primary), `${primary} → canonical (tongue ${tongue})`).toBe(canonical);

        // injectivity: no two DIFFERENT canonicals may claim the same primary name in one tongue —
        // a table violation here is reported, never silently patched (a sibling owns the tiddlers).
        const claimed = byTongue.get(tongue) ?? new Map<string, string>();
        const priorCanonical = claimed.get(primary);
        if (priorCanonical !== undefined && priorCanonical !== canonical) {
          throw new Error(
            `grammar-table ambiguity (REPORT, do not patch): tongue "${tongue}" primary "${primary}" ` +
            `is claimed by both "${priorCanonical}" and "${canonical}"`,
          );
        }
        claimed.set(primary, canonical);
        byTongue.set(tongue, claimed);
      }
    }
    // sanity floor: the two primaries #/mirror-vocabulary names by hand stand in the derived table.
    expect(byTongue.get("en")?.get("pin")).toBe("aka");
    expect(byTongue.get("en")?.get("transclude")).toBe("kahea");
  });
});

describe("the projector reads a framing opener that names its ends", () => {
  const URI = "lar:///a.b.c/x";
  const body = (ends: string) =>
    [`<<^ code="&#x0001;" ${ends}>>`, "", "A line of body.", "", '<<^ code="&#x0004;" -> to="?">>'].join("\n");

  test("the named end reaches the projection as the carrier's address", () => {
    const p = projectSubmission(body(`from="?" -> to="${URI}"`), { title: "lar:///t" });
    expect(p.markdown).toBeTruthy();
    expect(p.markdown).not.toContain("to=lar:///");
  });
});
