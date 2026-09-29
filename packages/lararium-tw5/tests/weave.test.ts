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
  escapeXmlNameSegment, unescapeXmlNameSegment, yamlEscape,
} from "../src/weave/index.js";

const REPO = new URL("../../..", import.meta.url).pathname;

const CARRIER = `<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>

<<^ code="&#x0001;" namespace="⊙" from=? -> to=lar:///ha.ka.ba/lares/api/pono/probe>>
\`\`\`toml meta
l-space  = "adjacent"
uri-path = "ha.ka.ba/lares/api/pono/probe"
\`\`\`

<<^ code="&#x0002;">>

<<~ ahu #head>>

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
<<^ code="&#x0004;" -> to=?>>
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
    const rooted = transposeMarkdown(CARRIER.replace("<<~ ahu #head>>", "<<~ ahu #/a/b>>")).markdown;
    expect(rooted).toContain('<a id="a_b"></a>');
    expect(rooted).not.toContain('id="/a/b"');
    expect(rooted).not.toContain('id="#/a/b"');
  });

  test("an `ahu #/x` opener drops the lone root slash too", () => {
    const rooted = transposeMarkdown(CARRIER.replace("<<~ ahu #head>>", "<<~ ahu #/x>>")).markdown;
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
    // the frame stays out of the reader's copy — only fenced teaching examples may carry marks
    const unfenced = p.markdown.split("\n").filter((l) => !l.startsWith("```"));
    let fenced = 0;
    for (const line of p.markdown.split("\n")) {
      const m = /^(`{3,})/.exec(line);
      if (m) { fenced = fenced === 0 ? m[1]!.length : 0; continue; }
      if (fenced === 0) expect(line).not.toMatch(/^<<\^ code:/);
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
    `<<!DOCTYPE memetic-wikitext+tiddlywiki lar:///ha.ka.ba/probe>>\n\n` +
    `<<^ code="&#x0001;" from=? -> to=lar:///ha.ka.ba/probe>>\n` +
    `<<^ code="&#x0002;">>\n\n${open}\n\n! A heading\n\n${close}\n\n` +
    `<<^ code="&#x0003;">>\n<<^ code="&#x0004;" -> to=?>>\n`;

  const spellings: Array<[string, string, string]> = [
    ["tooth then space", "<<~ ahu #entry>>", "<<~/ahu>>"],
    ["close carries a space", "<<~ ahu #entry>>", "<<~ /ahu>>"],
    ["tooth joined to the word", "<<~ahu #entry>>", "<<~/ahu>>"],
    ["both joined", "<<~ahu #entry>>", "<<~ /ahu>>"],
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
<<^ code="&#x0004;" -> to=?>>
`;

  test("CommonMark stays the default; today's output is unchanged", () => {
    const withDefault = projectSubmission(CARRIER2);
    const withExplicit = projectSubmission(CARRIER2, { profile: PROFILES.CommonMark });
    expect(withDefault.markdown).toBe(withExplicit.markdown);
    expect(withDefault.standalone).toBe(false);
    expect(withDefault.markdown).not.toContain("---\n");
    expect(withDefault.meta).toContain("source: lar:///ha.ka.ba/lares/api/pono/probe2");
  });

  test("GFM travels alone: YAML frontmatter, no .md.meta sidecar", () => {
    const p = projectSubmission(CARRIER2, { profile: PROFILES.GFM });
    expect(p.standalone).toBe(true);
    expect(p.meta).toBe("");
    expect(p.markdown.startsWith("---\n")).toBe(true);
    expect(p.markdown).toContain('source: "lar:///ha.ka.ba/lares/api/pono/probe2"');
    expect(p.markdown).toContain('source-check: "ni:///sha-256;PROBE2"');
    expect(p.markdown).toContain('variant: "GFM"');
    expect(p.markdown).toContain('lang: "en"');
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

  test("kramdown-rfc2629 REFUSES a carrier missing the RFC identity keys (docs/pono/lar-uri.mem, today)", () => {
    const src = readFileSync(join(REPO, "bags/lares/ha.ka.ba/lares/docs/pono/lar-uri.mem"), "utf8");
    expect(() => projectSubmission(src, { profile: PROFILES["kramdown-rfc2629"] })).toThrow(/docname|cat|ipr|author|date/);
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
<<^ code="&#x0004;" -> to=?>>
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
    expect(p.meta).toBe("");
    expect(p.markdown.startsWith("---\n")).toBe(true);
    expect(p.markdown).toContain('title: "A Probe Draft"');
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
});

describe("aka vs kahea vs loulou — frozen, live, and plain citation", () => {
  test("a live `kahea` weaves as a plain-text-marked link — no glyph, decodable outward", () => {
    const t = transposeMarkdown("<<~ kahea lar:///ha.ka.ba/lares/api/pono/lar-uri>>\n");
    expect(t.markdown).toContain("(live) [lar:///ha.ka.ba/lares/api/pono/lar-uri](lar:///ha.ka.ba/lares/api/pono/lar-uri)");
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
<<^ code="&#x0004;" -> to=?>>
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
<<^ code="&#x0004;" -> to=?>>
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
<<^ code="&#x0004;" -> to=?>>
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
<<^ code="&#x0004;" -> to=?>>
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

  test("CONTROL: `snapshot`, aka's mirror, takes the same frozen treatment as `aka`", () => {
    const t = transposeMarkdown('<<~ snapshot "lar:///ha.ka.ba/lares/api/pono/nowhere">>\n');
    expect(t.markdown).toContain("- `snapshot lar:///ha.ka.ba/lares/api/pono/nowhere` (unresolved — no corpus to pin)");
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
      '<<^ code="&#x0004;" -> to=?>>',
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

describe("the projector reads a framing opener that names its ends", () => {
  // One spelling reads. A carrier holding any earlier spelling arrives through `meme normalize`, which
  // homes it — so the projector answers to the current form alone and keeps no second branch.
  const URI = "lar:///a.b.c/x";
  const body = (ends: string) =>
    [`<<^ code="&#x0001;" ${ends}>>`, "", "A line of body.", "", '<<^ code="&#x0004;" -> to=?>>'].join("\n");

  test("the named end reaches the projection as the carrier's address", () => {
    const p = projectSubmission(body(`from=? -> to=${URI}`), { title: "lar:///t" });
    expect(p.markdown).toBeTruthy();
    expect(p.markdown).not.toContain("to=lar:///");
  });
});
