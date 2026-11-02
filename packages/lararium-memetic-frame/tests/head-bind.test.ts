/**
 * THE SEAL BINDS THE HEAD ADDRESS — the SOH head stands outside the sealed STX..ETX span, so the frame
 * compares what it names with what the sealed root meta names (controller ruling, 2026-11-01):
 *
 *   · `to=` binds against the meta `title` where one stands, else against `lar:///` + `uri-path`; a
 *     title and a uri-path that disagree with each other tear too. A split reads TORN, `head-meta-split`.
 *   · a head naming a URI over a sealed meta with neither key reads `head-unbound` — never `match`,
 *     never silent, never torn.
 *   · `namespace=` binds only where the meta carries `namespace`; a head namespace over a meta with
 *     none reads `head-unbound`, the namespace named in the detail.
 */
import { describe, test, expect } from "vitest";
import { frameCarrier, stampCarrier, verdict, verifyBcc, headBinding, META_OPEN_CANON } from "../src/index.js";

const URI = "lar:///ha.ka.ba/t/head-bind";
const meta = (...lines: string[]): string => `${META_OPEN_CANON}\n${lines.join("\n")}\n\`\`\`\n\nProse.`;
const sealed = (body: string, head: { uri: string; namespace?: string } = { uri: URI }): string =>
  frameCarrier({ head, body });
const faultsOf = (text: string): string[] => {
  const v = verdict(text);
  return v.kind === "torn" ? v.faults.map((f) => f.kind) : [];
};
/** Swap the head's address without touching a sealed byte — the tamper this cure closes. */
const retarget = (text: string, to: string): string => text.replace(/to=`lar:\/\/\/[^`]*`>>/, `to=\`${to}\`>>`);

describe("★ the seal binds the head address ★", () => {
  describe("to= against the sealed title", () => {
    test("CONTROL: a head naming its sealed title reads match", () => {
      expect(verdict(sealed(meta(`title = "${URI}"`))).kind).toBe("match");
    });
    test("a head retargeted past its sealed title reads torn, head-meta-split — the check still verifies", () => {
      const tampered = retarget(sealed(meta(`title = "${URI}"`)), "lar:///ha.ka.ba/t/elsewhere");
      expect(faultsOf(tampered)).toEqual(["head-meta-split"]);
      expect(verifyBcc(tampered)).toBe("torn");
    });
    test("re-stamping a retargeted head launders nothing: the title it splits from stays sealed", () => {
      const tampered = stampCarrier(retarget(sealed(meta(`title = "${URI}"`)), "lar:///ha.ka.ba/t/elsewhere"));
      expect(faultsOf(tampered)).toEqual(["head-meta-split"]);
    });
  });

  describe("to= against the sealed uri-path, where no title stands", () => {
    test("CONTROL: a head naming lar:/// + uri-path reads match", () => {
      expect(verdict(sealed(meta(`uri-path = "ha.ka.ba/t/head-bind"`))).kind).toBe("match");
    });
    test("a head split from its uri-path reads torn, head-meta-split", () => {
      expect(faultsOf(retarget(sealed(meta(`uri-path = "ha.ka.ba/t/head-bind"`)), "lar:///ha.ka.ba/t/x"))).toEqual(["head-meta-split"]);
    });
    test("a title and a uri-path that disagree with each other tear, whatever the head says", () => {
      expect(faultsOf(sealed(meta(`title = "${URI}"`, `uri-path = "ha.ka.ba/t/other"`)))).toEqual(["head-meta-split"]);
    });
    test("CONTROL: a title and its own uri-path agree and read match", () => {
      expect(verdict(sealed(meta(`title = "${URI}"`, `uri-path = "ha.ka.ba/t/head-bind"`))).kind).toBe("match");
    });
  });

  describe("head-unbound — a head the sealed meta never names", () => {
    test("a head naming a URI over a meta with neither title nor uri-path reads head-unbound, the check carried", () => {
      const text = sealed(meta(`type = "text/memetic-wikitext+tiddlywiki"`));
      const v = verdict(text);
      expect(v.kind).toBe("head-unbound");
      if (v.kind === "head-unbound") {
        expect(v.check).toMatch(/^ni:\/\/\/sha-256;/);
        expect(v.unbound).toEqual(["to"]);
      }
      expect(verifyBcc(text)).toBe("head-unbound");
    });
    test("a head over a body carrying no meta at all reads head-unbound", () => {
      expect(verdict(frameCarrier({ head: { uri: URI }, body: "Prose." })).kind).toBe("head-unbound");
    });
    test("a meta past the first does not bind: only the root meta, the body's own, names the carrier", () => {
      const body = `Prose first.\n\n${meta(`title = "${URI}"`)}`;
      // the root meta locator takes the first live meta after STX, wherever it stands — so this binds
      expect(verdict(sealed(body)).kind).toBe("match");
    });
    test("a title keyed under a table binds nothing — only a ROOT key names the carrier", () => {
      expect(verdict(sealed(meta(`[slot]`, `title = "${URI}"`))).kind).toBe("head-unbound");
    });
    test("an unchecked carrier stays absent: the binding rides the seal, and no seal stands", () => {
      expect(verdict(sealed(meta(`type = "x"`)).replace(/ bcc=`[^`]*`/, "")).kind).toBe("absent");
    });
    test("headBinding names each end it could not bind", () => {
      const text = sealed(meta(`type = "x"`), { uri: URI, namespace: "⊙" });
      expect(headBinding(text)).toEqual({ kind: "unbound", unbound: ["to", "namespace"] });
    });
  });

  describe("an unaddressed head", () => {
    const unaddressed = (body: string): string => sealed(body).replace(/to=`lar:\/\/\/[^`]*`>>/, "to=`?`>>");
    test("CONTROL: to=`?` over a meta naming no address reads match — the head claims nothing", () => {
      expect(verdict(unaddressed(meta(`type = "x"`))).kind).toBe("match");
    });
    test("to=`?` over a sealed title reads torn — the head dropped the address the seal names", () => {
      expect(faultsOf(unaddressed(meta(`title = "${URI}"`)))).toEqual(["head-meta-split"]);
    });
  });

  describe("no head at all", () => {
    test("CONTROL: a text frame with no SOH binds nothing and reads match", () => {
      const text = sealed(meta(`title = "${URI}"`)).replace(/^<<\^ code=`&#x0001;`[^\n]*\n/m, "");
      expect(verdict(text).kind).toBe("match");
    });
  });

  describe("namespace= against the sealed namespace", () => {
    const NS_META = `namespace = "&#x0950; &#x0901;"`;
    test("CONTROL: glyphs in the head match the meta's entity spelling", () => {
      expect(verdict(sealed(meta(`title = "${URI}"`, NS_META), { uri: URI, namespace: "ॐ ँ" })).kind).toBe("match");
    });
    test("a head namespace split from the sealed one reads torn, head-meta-split", () => {
      expect(faultsOf(sealed(meta(`title = "${URI}"`, NS_META), { uri: URI, namespace: "⊙" }))).toEqual(["head-meta-split"]);
    });
    test("a head that DROPS the namespace the seal names reads torn", () => {
      expect(faultsOf(sealed(meta(`title = "${URI}"`, NS_META)))).toEqual(["head-meta-split"]);
    });
    test("a head namespace over a meta carrying none reads head-unbound, the namespace named", () => {
      const v = verdict(sealed(meta(`title = "${URI}"`), { uri: URI, namespace: "⊙" }));
      expect(v.kind === "head-unbound" && v.unbound).toEqual(["namespace"]);
    });
  });

  describe("the binding reads ONE spelling — anything a TOML parser might read otherwise tears", () => {
    test.each([
      ["a quoted key", `"title" = "${URI}"`],
      ["a literal-quoted key", `'title' = "${URI}"`],
      ["an escape in the value", `title = "lar:///ha.ka.ba/t/head\\u002dbind"`],
      ["a literal string value", `title = '${URI}'`],
      ["a multi-line string value", `title = """${URI}"""`],
      ["a dotted key", `title.x = "${URI}"`],
      ["a doubled key", `title = "${URI}"\ntitle = "${URI}"`],
      ["a trailing comment", `title = "${URI}" # note`],
    ])("%s tears, head-meta-split", (_name, line) => {
      expect(faultsOf(sealed(meta(line)))).toEqual(["head-meta-split"]);
    });
    test("a key-shaped line inside a multi-line string binds nothing — TOML reads it as string content", () => {
      expect(verdict(sealed(meta(`note = """`, `title = "lar:///ha.ka.ba/t/decoy"`, `"""`, `title = "${URI}"`))).kind).toBe("match");
    });
    test("CONTROL: aligned spacing (the corpus's own) reads match", () => {
      expect(verdict(sealed(meta(`title     = "${URI}"`, `uri-path  = "ha.ka.ba/t/head-bind"`))).kind).toBe("match");
    });
  });
});
