/**
 * THE KUPONO READERS — the tw5 readers read the cut grammar (Train Q, row Q4).
 *
 * Every value names itself and rides a backtick run (``key=`value` ``, ```` key=```v``` ```` where the
 * value holds a tick); the bearing pair `from=` / `to=` carries a relation and no arrow stands between
 * them; a slot word rides ``slot=`#/…` ``. Each vector stands beside a control the old reader already
 * keeps, so a cure that widened a gate shows as a moved control.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext
 */
import { describe, test, expect } from "vitest";
import { frameCarrier } from "@lararium/memetic-frame";

import { readSigilAttrs, sigilAttrValue, schemeShapedPositionals } from "../src/sigil-attrs.js";
import { sigilOpenEnd, matchPranalaOpenAt } from "../src/wikirules/lar-sigil-shared.js";
import { readCarrierEdges } from "../src/carrier-edges.js";
import { deserializeCarrier } from "../src/deserializer.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { AHU_OPEN_RE, KAHEA_REF_RE, collectAhuSlots } from "../src/meme-ast/ahu-scan.js";
import { declaresCarrier } from "../src/carrier-files.js";
import { pinTargetsOf } from "../src/weave/index.js";

describe("★ a ticked value hands back its interior ★", () => {
  test("single and triple ticks strip to the value", () => {
    expect(sigilAttrValue(" a=`x y`", "a")).toBe("x y");
    expect(sigilAttrValue(" a=```it's `odd` ok```", "a")).toBe("it's `odd` ok");
  });

  test("a key inside a ticked value is no parameter", () => {
    expect(readSigilAttrs(" k=`a:b c=d`").map((a) => a.name)).toEqual(["k"]);
    expect(readSigilAttrs(" k=```a `c=d` e```").map((a) => a.name)).toEqual(["k"]);
  });

  test("a scheme inside a ticked value names no hazard", () => {
    expect(schemeShapedPositionals(" note=`see lar:///x and y:z`")).toEqual([]);
  });

  test("CONTROL: the quoted spelling already masks, and a bare scheme still reads as a hazard", () => {
    expect(readSigilAttrs(' k="a:b c=d"').map((a) => a.name)).toEqual(["k"]);
    expect(schemeShapedPositionals(" lar:///x")).toEqual(["lar:///x"]);
  });
});

describe("★ a sigil ends at its own `>>`, never one a ticked value carries ★", () => {
  test("a `>>` and a lone quote inside ticks ride as content", () => {
    const s = "<<~ x a=`it's >> ok`>> after";
    expect(sigilOpenEnd(s, 0)).toBe(s.indexOf(" after"));
    const t = "<<~ x a=```a `>>` b```>> after";
    expect(sigilOpenEnd(t, 0)).toBe(t.indexOf(" after"));
  });

  test("CONTROL: the quoted spelling already holds", () => {
    const s = '<<~ x a="it\'s >> ok">> after';
    expect(sigilOpenEnd(s, 0)).toBe(s.indexOf(" after"));
  });
});

describe("★ pranala reads its pair by name, either order ★", () => {
  test("from then to, with a slot and named tails", () => {
    const s = "<<~ pranala slot=`#source` from=`lar:///a/b` to=`lar:///c/d` family=`code` role=`has`>>";
    const m = matchPranalaOpenAt(s, 0);
    expect(m && { slot: m.slot, from: m.from, to: m.to, attrs: m.attrs, end: m.end }).toEqual({
      slot: "#source", from: "lar:///a/b", to: "lar:///c/d", attrs: { family: "code", role: "has" }, end: s.length,
    });
  });

  test("to then from", () => {
    const m = matchPranalaOpenAt("<<~ pranala to=`lar:///c/d` from=`?`>>", 0);
    expect(m && [m.from, m.to]).toEqual(["?", "lar:///c/d"]);
  });

  test("CONTROL: a pranala naming no `to` opens nothing", () => {
    expect(matchPranalaOpenAt("<<~ pranala from=`lar:///a/b`>>", 0)).toBeNull();
  });
});

describe("★ carrier-edges reads the named forms ★", () => {
  test("loulou uri=, pranala to=, kahea uri= each name their edge", () => {
    const src = [
      "<<~ loulou uri=`lar:///ha.ka.ba/a/one`>>",
      "<<~ pranala from=`lar:///ha.ka.ba/a/source` to=`lar:///ha.ka.ba/a/two`>>",
      "<<~ kahea uri=`lar:///ha.ka.ba/a/three`>>",
      "[[label|lar:///ha.ka.ba/a/four]]",
    ].join("\n\n");
    expect(readCarrierEdges(src).map((e) => [e.form, e.address])).toEqual([
      ["loulou", "ha.ka.ba/a/one"],
      ["pranala", "ha.ka.ba/a/two"],
      ["kahea", "ha.ka.ba/a/three"],
      ["wikilink", "ha.ka.ba/a/four"],
    ]);
  });

  test("CONTROL: a wikilink edge reads", () => {
    expect(readCarrierEdges("[[lar:///ha.ka.ba/a/five]]").map((e) => e.address)).toEqual(["ha.ka.ba/a/five"]);
  });
});

describe("★ the deserializer and the normalizer read the ticked head ★", () => {
  const URI = "lar:///ha.ka.ba/t/kupono-reader";
  const carrier = frameCarrier({
    head: { uri: URI, namespace: "⊙" },
    body: "```toml meta\nnamespace = \"⊙\"\ntitle     = \"" + URI + "\"\n```\n\nProse.",
  });

  test("the head the writer mints carries ticks (setup took)", () => {
    expect(carrier).toContain("namespace=`⊙`");
  });

  test("the namespace rides every record the carrier's text splits into (carriage records aside)", () => {
    const read = deserializeCarrier(carrier, {});
    const split = read.records.filter((t) => !String(t["title"]).includes("#/$"));
    expect(split.length).toBeGreaterThan(0);
    for (const t of split) expect(t["namespace"]).toBe("⊙");
  });

  test("normalize holds the minted carrier as a fixed point", () => {
    const r = normalizeMemeSource(carrier);
    expect(r.text).toBe(carrier);
  });
});

describe("★ an ahu opener names its slot ★", () => {
  test("ahu slot= and kahea ahu slot= read their paths", () => {
    expect([..."<<~ ahu slot=`#/a/b`>>".matchAll(new RegExp(AHU_OPEN_RE.source, "g"))].map((m) => m[1])).toEqual(["#/a/b"]);
    expect([..."<<~ kahea ahu slot=`#/a/b`>>".matchAll(new RegExp(KAHEA_REF_RE.source, "g"))].map((m) => m[1])).toEqual(["#/a/b"]);
    expect([...collectAhuSlots("<<~ ahu slot=`#/one` to=`lar:///x/y`>>\nbody\n<<~/ahu>>\n")]).toEqual(["#/one"]);
  });

  test("CONTROL: an ahu opener with no slot names none", () => {
    expect([...collectAhuSlots("<<~ ahu>>\nbody\n<<~/ahu>>\n")]).toEqual([]);
  });
});

describe("★ the declaration and the pins read the cut ★", () => {
  test("the ruled declaration declares a carrier", () => {
    const d = declaresCarrier(
      "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\nx\n");
    expect(d?.form).toBe("doctype");
  });

  test("a pin names its target by uri=", () => {
    expect(pinTargetsOf("<<~ aka uri=`lar:///ha.ka.ba/a/pin#/x`>>\n<<~ kanawai uri=`lar:///ha.ka.ba/ref/law`>>\n"))
      .toEqual(["lar:///ha.ka.ba/a/pin", "lar:///ha.ka.ba/ref/law"]);
  });

  test("CONTROL: a declaration inside another language's line declares nothing", () => {
    expect(declaresCarrier('const D = "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`x`>>";\n')).toBeNull();
  });
});
