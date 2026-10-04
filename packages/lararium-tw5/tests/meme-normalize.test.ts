/**
 * meme-normalize — the SOH-namespace canonicalization the `lares meme normalize`
 * gesture applies. The class oracle.md tripped: an meta that declares a
 * namespace whose SOH opener does not carry it (round-trip drift + lost
 * idempotence). The transform homes the meta-declared namespace into the SOH
 * as literal glyphs; the meta field is authoritative.
 */

import { describe, test, expect } from "vitest";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { DECLARATION } from "@lararium/mesh/carrier-type";

const HEAD = (soh: string, ns: string) =>
  `${DECLARATION}\n\n${soh}\n` +
  "```toml meta\n" +
  `cacheable = true\n` +
  (ns === "" ? "" : `namespace = "${ns}"\n`) +
  "```\n\n<<^ code=\"&#x0002;\">>\n\nbody\n\n<<^ code=\"&#x0003;\">>\n";

describe("normalizeMemeSource — SOH namespace embed", () => {
  test("homes the meta-declared namespace into a bare SOH (the oracle.md class)", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" ? -> lar:///x>>", "&#x2299;");
    const { text, changed, notes } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<^ code=\"&#x0001;\" namespace=\"⊙\" from=\"?\" -> to=\"lar:///x\">>");
    expect(notes.join()).toMatch(/namespace homed to "⊙"/);
  });

  test("decodes a multi-glyph entity namespace (noosphere ॐ ँ)", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" ? -> lar:///x>>", "&#x0950; &#x0901;");
    const { text } = normalizeMemeSource(src);
    expect(text).toContain("<<^ code=\"&#x0001;\" namespace=\"ॐ ँ\" from=\"?\" -> to=\"lar:///x\">>");
  });

  test("idempotent — a carrier already carrying its namespace is unchanged", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" namespace=\"⊙\" from=\"?\" -> to=\"lar:///x\">>", "&#x2299;");
    const r1 = normalizeMemeSource(src);
    expect(r1.changed).toBe(false);
    expect(r1.text).toBe(src);
    // double-apply on the bare form converges and stays put
    const r2 = normalizeMemeSource(normalizeMemeSource(HEAD("<<^ code=\"&#x0001;\" ? -> lar:///x>>", "&#x2299;")).text);
    expect(r2.changed).toBe(false);
  });

  test("re-homes a STALE SOH namespace to match meta", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" namespace=\"ॐ ँ\" ? -> lar:///x>>", "&#x2299;");
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<^ code=\"&#x0001;\" namespace=\"⊙\" from=\"?\" -> to=\"lar:///x\">>");
    expect(text).not.toContain("ॐ ँ&#x0001;");
  });

  test("clears the SOH namespace when meta declares none", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" namespace=\"⊙\" ? -> lar:///x>>", "");
    const { text, changed } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<^ code=\"&#x0001;\" from=\"?\" -> to=\"lar:///x\">>");
  });

  test("no SOH opener → no change (not a single-meme carrier)", () => {
    const src = "plain prose, no carrier framing\n";
    expect(normalizeMemeSource(src).changed).toBe(false);
  });
});

describe("normalizeMemeSource — SOH opener spacing", () => {
  test("homes a missing space in a no-namespace opener (the lifted-corpus form)", () => {
    // The INPUT must carry the drift this test names — a caret opener with no space after it.
    const src = HEAD("<<^&#x0001; ? -> lar:///x>>", "");
    const { text, changed, notes } = normalizeMemeSource(src);
    expect(changed).toBe(true);
    expect(text).toContain("<<^ code=\"&#x0001;\" from=\"?\" -> to=\"lar:///x\">>");
    expect(notes.join()).toMatch(/spacing canonicalized/);
  });

  test("idempotent — a correctly-spaced bare opener is left untouched", () => {
    const src = HEAD("<<^ code=\"&#x0001;\" from=\"?\" -> to=\"lar:///x\">>", "");
    expect(normalizeMemeSource(src).changed).toBe(false);
  });
});

// meta head with a register field, for the register-band class.
const CLOSE_HEAD = (close: string) =>
  `${DECLARATION}\n\n<<^ code="&#x0001;" from=? -> to=lar:///x>>\n` +
  "```toml meta\n" +
  `cacheable = true\n` +
  "```\n\n<<^ code=\"&#x0002;\">>\n\n" +
  `<<~ ahu #/head${close}>>\n\nbody\n\n<<~/ahu${close}>>\n\n` +
  "<<^ code=\"&#x0003;\">>\n";

const SLOT_HEAD = (body: string) =>
  `${DECLARATION}\n\n<<^ code="&#x0001;" from=? -> to=lar:///x>>\n` +
  "```toml meta\n" +
  `cacheable = true\n` +
  "```\n\n<<^ code=\"&#x0002;\">>\n\n" + body + "\n\n" +
  "<<^ code=\"&#x0003;\">>\n";

describe("normalizeMemeSource — child-slot roots", () => {
  test("a bare slot roots at the carrier", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #head>>\n\nbody\n\n<<~/ahu>>"));
    expect(r.changed).toBe(true);
    expect(r.text).toContain("<<~ ahu #/head>>");
    expect(r.notes.join()).toMatch(/child slot: 1 open rooted/);
  });

  test("a nested slot carries its whole path, never just its leaf", () => {
    const src = SLOT_HEAD("<<~ ahu #orient>>\n\n<<~ ahu #ha-fields>>\n\nb\n\n<<~/ahu>>\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    expect(r.text).toContain("<<~ ahu #/orient>>");
    // leaf-only rooting would make the child a sibling of its own parent
    expect(r.text).toContain("<<~ ahu #/orient/ha-fields>>");
    expect(r.text).not.toContain("<<~ ahu #/ha-fields>>");
  });

  test("the English spelling roots the same way", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<fragment #head>>\n\nbody\n\n<</fragment>>"));
    expect(r.text).toContain("<<fragment #/head>>");
  });


  test("a slot shown inside a fence stays as authored — the operator is showing the grammar", () => {
    const r = normalizeMemeSource(SLOT_HEAD("```\n<<~ ahu #shown>>\n```"));
    expect(r.text).toContain("<<~ ahu #shown>>");
  });

  test("a slot held inside a longer fence stays as authored past a shorter fence line it holds", () => {
    const held = "````\n```shown-opener\n<<~ ahu #held-after>>\n````";
    const r = normalizeMemeSource(SLOT_HEAD(held));
    expect(r.text).toContain("<<~ ahu #held-after>>");
  });

  test("control — the same slot outside any fence roots", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #held-after>>\n\nb\n\n<<~/ahu>>"));
    expect(r.text).toContain("<<~ ahu #/held-after>>");
  });

  test("idempotent — root then re-run leaves it put", () => {
    const once = normalizeMemeSource(SLOT_HEAD("<<~ ahu #head>>\n\nbody\n\n<<~/ahu>>")).text;
    expect(normalizeMemeSource(once).changed).toBe(false);
  });

  // ── Flat slot paths expand — operator ruling ──────────────────────────────
  //
  // `<<~ ahu #/a/b/c>> … <<~/ahu>>` names three nested slots in ONE open/close pair; normalize
  // rewrites it into three actually-nested ahu blocks, inserting the missing parent opens before
  // and the matching closes after. A missing parent that already stands elsewhere as its OWN
  // block never gets a second mint — the expansion refuses and reports instead.

  test("a flat path expands into its nested parent chain", () => {
    const r = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/a/b/c>>\n\nleaf body\n\n<<~/ahu>>"));
    expect(r.changed).toBe(true);
    expect(r.text).toContain("<<~ ahu #/a>>");
    expect(r.text).toContain("<<~ ahu #/a/b>>");
    expect(r.text).toContain("<<~ ahu #/a/b/c>>");
    // three opens want three closes, in reverse nesting order.
    const closes = r.text.match(/<<~\/ahu>>/g) ?? [];
    expect(closes.length).toBe(3);
    // the leaf body sits inside the innermost (deepest) block.
    expect(r.text.indexOf("<<~ ahu #/a/b/c>>")).toBeLessThan(r.text.indexOf("leaf body"));
    expect(r.text.indexOf("leaf body")).toBeLessThan(r.text.lastIndexOf("<<~/ahu>>"));
  });

  test("flat expansion is idempotent — a second normalize changes nothing", () => {
    const once = normalizeMemeSource(SLOT_HEAD("<<~ ahu #/a/b/c>>\n\nleaf body\n\n<<~/ahu>>")).text;
    expect(normalizeMemeSource(once).changed).toBe(false);
  });

  test("a missing parent that already stands elsewhere as its OWN block refuses the expansion", () => {
    const src = SLOT_HEAD(
      "<<~ ahu #/a>>\n\nother body\n\n<<~/ahu>>\n\n<<~ ahu #/a/b/c>>\n\nleaf body\n\n<<~/ahu>>",
    );
    const r = normalizeMemeSource(src);
    // the flat open's bytes never move — no duplicate `#/a` block gets minted.
    expect(r.text).toContain("<<~ ahu #/a/b/c>>");
    expect((r.text.match(/<<~ ahu #\/a>>/g) ?? []).length).toBe(1);
    expect(r.flags.join()).toMatch(/#\/a.*#\/a\/b\/c|#\/a\/b\/c.*#\/a/);
  });

  test("a carrier already nested one block per level is unchanged", () => {
    const src = SLOT_HEAD("<<~ ahu #/a>>\n\n<<~ ahu #/a/b>>\n\n<<~ ahu #/a/b/c>>\n\nleaf\n\n<<~/ahu>>\n\n<<~/ahu>>\n\n<<~/ahu>>");
    const r = normalizeMemeSource(src);
    expect(r.changed).toBe(false);
  });

  test("a flat path shown inside a fence stays as authored", () => {
    const r = normalizeMemeSource(SLOT_HEAD("```\n<<~ ahu #/a/b/c>>\n```"));
    expect(r.text).toContain("<<~ ahu #/a/b/c>>");
    expect(r.text).not.toContain("<<~ ahu #/a>>\n\n<<~ ahu #/a/b>>");
  });
});

describe("normalizeMemeSource — sigil close spacing", () => {
  test("tightens a close carrying a space before the brackets", () => {
    const { text, changed, notes } = normalizeMemeSource(CLOSE_HEAD(" "));
    expect(changed).toBe(true);
    expect(text).toContain("<<~ ahu #/head>>");
    expect(text).toContain("<<~/ahu>>");
    expect(notes.join()).toMatch(/sigil close spacing: 2 closes tightened/);
  });

  test("a tight close is already canonical — no change", () => {
    expect(normalizeMemeSource(CLOSE_HEAD("")).changed).toBe(false);
  });

  test("idempotent — tighten then re-run leaves it put", () => {
    const once = normalizeMemeSource(CLOSE_HEAD(" ")).text;
    expect(normalizeMemeSource(once).changed).toBe(false);
  });

  test("a sigil whose content ends in a nested close keeps its space", () => {
    // `params=<<params>> >>` tightened would read `>>>>` and the reader would take the wrong close
    const src = CLOSE_HEAD("").replace("body", "<<has mu name=<<name>> params=<<params>> >>");
    expect(normalizeMemeSource(src).text).toContain("params=<<params>> >>");
  });

  test("a close shown inside a fence keeps its space — held text moves no byte", () => {
    const src = CLOSE_HEAD("").replace("body", "````\n<<~ ahu #shown >>\n```\ninner\n```\n<<~/ahu >>\n````");
    const { text } = normalizeMemeSource(src);
    expect(text).toContain("<<~ ahu #shown >>");
    expect(text).toContain("<<~/ahu >>\n````");
  });

  test("a close shown inside an inline code span keeps its space", () => {
    const src = CLOSE_HEAD("").replace("body", "write `<<~/ahu >>` to close");
    expect(normalizeMemeSource(src).text).toContain("`<<~/ahu >>`");
  });

  test("a close crossing a newline is left alone — a sigil closes on the line it opens", () => {
    const wrapped = ["<<~ scale a ~ one", "-> b ~ two", ">>"].join("\n");
    const src = CLOSE_HEAD("").replace("body", wrapped);
    expect(normalizeMemeSource(src).text).toContain(wrapped);
  });
});

/**
 * THE ONE DOOR — the operator's ruling. Every clause writes `text` through `ClauseSeat.apply`,
 * and states its class AT THAT CALL SITE: never a list of clause names a caller keeps in sync
 * elsewhere. A clause that declares nothing (a typo, a dynamically-registered clause, this test
 * driving the door directly) reads as GRAMMAR — propose, never apply — because that is the one
 * class this door may default to without moving a byte nobody asked to move.
 */
import { ClauseSeat } from "../src/meme-normalize.js";

describe("ClauseSeat — the class declares itself on the clause, never a caller's list", () => {
  test("★ RED: a clause with NO declared class moves no byte — it reads as a grammar preference ★", () => {
    const seat = new ClauseSeat("hello", {});
    // @ts-expect-error — the missing class is exactly the failure this door forecloses at runtime.
    seat.apply(undefined, "goodbye", (applied: boolean) => (applied ? "applied" : "proposed"));
    expect(seat.text, "an undeclared class must never silently apply").toBe("hello");
    expect(seat.grammarChanged).toBe(true);
    expect(seat.grammarNotes).toEqual(["proposed"]);
    expect(seat.notes).toEqual([]);
  });

  test("CONTROL: an explicit frame class applies unconditionally", () => {
    const seat = new ClauseSeat("hello", {});
    seat.apply("frame", "goodbye", () => "frame note");
    expect(seat.text).toBe("goodbye");
    expect(seat.notes).toEqual(["frame note"]);
    expect(seat.grammarChanged).toBe(false);
  });

  test("CONTROL: an explicit grammar class proposes by default and applies with { grammar: true }", () => {
    const proposed = new ClauseSeat("hello", {});
    proposed.apply("grammar", "goodbye", (applied) => (applied ? "applied" : "proposed"));
    expect(proposed.text).toBe("hello");
    expect(proposed.grammarNotes).toEqual(["proposed"]);

    const applied = new ClauseSeat("hello", { grammar: true });
    applied.apply("grammar", "goodbye", (a) => (a ? "applied" : "proposed"));
    expect(applied.text).toBe("goodbye");
    expect(applied.grammarNotes).toEqual(["applied"]);
  });

  test("a no-op call (next === text) reports nothing, on either class", () => {
    const seat = new ClauseSeat("hello", { grammar: true });
    seat.apply("frame", "hello", () => { throw new Error("must not be called on a no-op"); });
    seat.apply("grammar", "hello", () => { throw new Error("must not be called on a no-op"); });
    expect(seat.text).toBe("hello");
    expect(seat.notes).toEqual([]);
    expect(seat.grammarNotes).toEqual([]);
    expect(seat.grammarChanged).toBe(false);
  });
});
