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
import { transposeMarkdown, projectSubmission } from "../src/weave/index.js";

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
