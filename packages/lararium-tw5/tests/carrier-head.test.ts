/**
 * carrier-head — the one reader of a carrier's framing ends.
 *
 * These vectors are the ones that were paid for. Each names a spelling that broke a hand-rolled
 * reader somewhere in this tree, and the shore now answers all of them from one place.
 */
import { describe, test, expect } from "vitest";
import {
  matchCarrierHead,
  matchCarrierMark,
  matchCarrierHeadLine,
  headUriOf,
  carrierHeadPattern,
  carrierReleasePattern,
} from "../src/carrier-head.js";
import { FRAME_MARKS } from "../src/frame-marks.js";

const URI = "lar:///ha.ka.ba/lares/api/pono/example";

describe("both spellings of the bearing reach ONE reading", () => {
  test("★ quoted and bare name the same address ★", () => {
    const quoted = matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">>`);
    const bare = matchCarrierHead(`<<^ code="&#x0001;" from=? -> to=${URI}>>`);
    expect(quoted?.uri).toBe(URI);
    expect(bare?.uri).toBe(URI);
    expect(quoted?.quoted).toBe(true);
    expect(bare?.quoted).toBe(false);
  });

  test("★ the POSITIONAL far side names the same address ★", () => {
    // The spelling the framing ends carried before they took names. `normalize` converts it, so a
    // reader that required `to=` would refuse exactly the carriers normalization exists to reach.
    expect(matchCarrierHead(`<<^ code="&#x0001;" ? -> ${URI}>>`)?.uri).toBe(URI);
  });

  test("the shifted pair carries the same law", () => {
    expect(matchCarrierHead(`<<^ code="&#x0011;" from="?" -> to="${URI}">>`)?.code).toBe("0011");
  });
});

describe("a namespace arrives WHOLE", () => {
  // 66 carriers declare two glyphs and a space. A reader that took the value to the first space
  // silently lost half of it, and the SOH stopped matching what the meta declared.
  test("★ two glyphs and a space survive ★", () => {
    const h = matchCarrierHead(`<<^ code="&#x0001;" namespace="ॐ ँ" from="?" -> to="${URI}">>`);
    expect(h?.namespace).toBe("ॐ ँ");
    expect(h?.uri).toBe(URI);
  });

  test("a head with no namespace reports null, never an empty string", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">>`)?.namespace).toBeNull();
  });
});

describe("TWO questions, held apart", () => {
  const torn = `<<^ code="&#x0001;" namespace="⊙">>`;

  test("a head with no bearing STANDS as a mark", () => {
    expect(matchCarrierMark(torn, "head")?.code).toBe("0001");
  });

  test("★ and names no address — a torn frame must not report one ★", () => {
    expect(matchCarrierHead(torn)).toBeNull();
    expect(headUriOf(torn)).toBeNull();
  });

  test("a release reads as a release, and a head does not", () => {
    expect(matchCarrierMark(`<<^ code="&#x0004;" -> to="?">>`, "release")).not.toBeNull();
    expect(matchCarrierMark(`<<^ code="&#x0004;" -> to="?">>`, "head")).toBeNull();
  });

  test("the release pattern accepts both spellings", () => {
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to="?">>`)).toBe(true);
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to=?>>`)).toBe(true);
    expect(carrierReleasePattern().test(`<<^ code="&#x0004;" -> to="lar:///x">>`)).toBe(false);
  });
});

describe("offsets locate the mark in its own text", () => {
  test("index and end bracket the sigil exactly", () => {
    const pre = "prose\n\n";
    const head = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    const h = matchCarrierHead(pre + head + "\nmore")!;
    expect(h.index).toBe(pre.length);
    expect(h.end).toBe(pre.length + head.length);
    expect(h.text).toBe(head);
  });

  test("a `from` offset skips a mark already read", () => {
    const two = `<<^ code="&#x0001;" from="?" -> to="lar:///a">>\n<<^ code="&#x0001;" from="?" -> to="lar:///b">>`;
    const first = matchCarrierHead(two)!;
    expect(first.uri).toBe("lar:///a");
    expect(matchCarrierHead(two, first.end)?.uri).toBe("lar:///b");
  });
});

describe("a fresh pattern per call", () => {
  // A module-scope /g regex carries lastIndex between unrelated callers, and the second reader
  // skips the very first mark in its own text.
  test("★ two reads of the same text agree ★", () => {
    const t = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    expect(matchCarrierHead(t)?.uri).toBe(matchCarrierHead(t)?.uri);
    const a = carrierHeadPattern("g"), b = carrierHeadPattern("g");
    expect(a.exec(t)?.index).toBe(b.exec(t)?.index);
  });
});

describe("the codes come from frame-marks, never from here", () => {
  // One fact, declared once. Restating the codes would let a mark added to FRAME_MARKS read correct in
  // every file while this reader quietly dropped it.
  test("★ every SOH mark the grammar stands is a mark this shore reads ★", () => {
    const soh = FRAME_MARKS.filter((m) => m.name.startsWith("SOH"));
    expect(soh.length).toBeGreaterThan(1);
    for (const m of soh) {
      const head = `<<^ code="${m.code}" from="?" -> to="${URI}">>`;
      expect(matchCarrierHead(head)?.uri, `${m.name} (${m.code})`).toBe(URI);
    }
  });

  test("★ and every EOT mark reads as a release ★", () => {
    for (const m of FRAME_MARKS.filter((x) => x.name.startsWith("EOT"))) {
      expect(carrierReleasePattern().test(`<<^ code="${m.code}" -> to="?">>`), m.name).toBe(true);
    }
  });

  test("a mark that is neither names no head", () => {
    for (const m of FRAME_MARKS.filter((x) => !/^(SOH|EOT)/.test(x.name))) {
      expect(matchCarrierHead(`<<^ code="${m.code}" from="?" -> to="${URI}">>`), m.name).toBeNull();
    }
  });
});

describe("the prefix stops at an entity", () => {
  // A namespace written as entities and placed BEFORE the code would be read AS the code — the
  // quietest way this frame has broken. Canonical writes `code=` first, so the guard costs nothing.
  test("★ an entity namespace ahead of the code cannot be scanned PAST ★", () => {
    // The FIRST entity is authoritative. A reader whose prefix crossed `&` would skip the namespace,
    // find the real code behind it, and report a sound head for a carrier written out of order.
    const h = matchCarrierHead(`<<^ namespace="&#x0011;" code="&#x0001;" from="?" -> to="${URI}">>`);
    expect(h?.code).not.toBe("0001");
  });

  test("and the canonical order reads", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" namespace="&#x2299;" from="?" -> to="${URI}">>`)?.code).toBe("0001");
  });
});

describe("a `>` rides as content", () => {
  // TiddlyWiki's reUnquotedAttribute admits `>(?!>)` inside a value. A capture that excluded `>`
  // outright read NULL where the parser read the whole address — found against the parse tree.
  test("★ an address carrying a bracket survives, quoted ★", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="lar:///a>b">>`)?.uri).toBe("lar:///a>b");
  });

  test("★ and bare ★", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to=lar:///a>b>>`)?.uri).toBe("lar:///a>b");
  });

  test("but `>>` still closes the sigil", () => {
    expect(matchCarrierHead(`<<^ code="&#x0001;" from="?" -> to="${URI}">> trailing`)?.uri).toBe(URI);
  });
});

describe("a QUOTED head opens nothing", () => {
  // Found by measuring the shore against TiddlyWiki's own parse tree over 700 carriers: a fenced decoy
  // standing above a real head is the one reading where pattern and parser ever diverged.
  const real = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;

  test("★ a head inside a fence is not this carrier's head ★", () => {
    const decoy = '```\n<<^ code="&#x0001;" from="?" -> to="lar:///DECOY">>\n```\n\n';
    expect(matchCarrierHead(decoy + real)?.uri).toBe(URI);
  });

  test("★ nor one inside a tick span ★", () => {
    const ticked = 'the head reads `<<^ code="&#x0001;" from="?" -> to="lar:///DECOY">>` like so\n\n';
    expect(matchCarrierHead(ticked + real)?.uri).toBe(URI);
  });

  test("a carrier that only QUOTES a head names no address", () => {
    expect(matchCarrierHead('```\n' + real + '\n```')).toBeNull();
  });
});

describe("CONTROLS — what must NOT read as a head", () => {
  test("a speaking sigil is not a control frame", () => {
    expect(matchCarrierHead(`<<~ ahu #/entry>>`)).toBeNull();
  });

  test("a pranala carrying from= and to= is not a frame", () => {
    expect(matchCarrierHead(`<<~ pranala #x from=? -> to=lar:///d family=code role=has>>`)).toBeNull();
  });

  test("a turn bearing is not a frame", () => {
    expect(matchCarrierHead(`<<~ lares aim from=lar:///a -> to=lar:///b>>`)).toBeNull();
  });

  test("a non-framing control code names no head", () => {
    expect(matchCarrierHead(`<<^ code="&#x0002;" from="?" -> to="${URI}">>`)).toBeNull();
  });

  test("prose that merely mentions the shape reads as nothing", () => {
    expect(matchCarrierHead("the head writes code then a bearing arrow then an address")).toBeNull();
  });

  test("a line-anchored read refuses a head that does not open the line", () => {
    const head = `<<^ code="&#x0001;" from="?" -> to="${URI}">>`;
    expect(matchCarrierHeadLine(head)?.uri).toBe(URI);
    expect(matchCarrierHeadLine("  " + head)).toBeNull();
  });
});
