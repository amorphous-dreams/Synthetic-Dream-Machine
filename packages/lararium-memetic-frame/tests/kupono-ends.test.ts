/**
 * THE KUPONO ENDS — the frame's ends speak the cut grammar (Train Q, Cut 1 + Cut 3).
 *
 * Every value names itself and rides a backtick run; the bearing pair `from=` / `to=` carries the
 * relation, and no arrow stands between them. The writer emits `from` before `to`; a reader accepts
 * either order (operator ruling, 2026-10-31). Nothing reads the quoted-arrow spelling back: no
 * back-compat, so an old end reads as a tear.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import {
  CARRIER_DECLARATION, frameCarrier, headSigil, markSigil, releaseSigil,
  matchCarrierHead, matchCarrierMark, carrierReleasePattern, verdict, verifyBcc, META_OPEN_CANON,
} from "../src/index.js";

const URI = "lar:///t/kupono";
const BODY = `${META_OPEN_CANON}\ntitle = "${URI}"\n\`\`\`\n\nProse.`;

describe("★ the writer speaks the cut ★", () => {
  test("the declaration names its type and its spec", () => {
    expect(CARRIER_DECLARATION).toBe(
      "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>");
  });

  test("the head ticks every value and writes from before to, no arrow", () => {
    expect(headSigil({ uri: URI })).toBe("<<^ code=`&#x0001;` from=`?` to=`lar:///t/kupono`>>");
    expect(headSigil({ uri: URI, namespace: "ॐ ँ", kapu: true }))
      .toBe("<<^ code=`&#x0011;` namespace=`ॐ ँ` from=`?` to=`lar:///t/kupono`>>");
  });

  test("the marks and the release tick their values", () => {
    expect(markSigil("STX")).toBe("<<^ code=`&#x0002;`>>");
    expect(markSigil("ETX")).toBe("<<^ code=`&#x0003;`>>");
    expect(releaseSigil()).toBe("<<^ code=`&#x0004;` to=`?`>>");
  });

  test("a framed carrier carries no quote and no arrow in its ends, and its check verifies", () => {
    const c = frameCarrier({ head: { uri: URI }, body: BODY });
    const ends = c.split("\n").filter((l) => l.startsWith("<<^") || l.startsWith("<<!"));
    expect(ends.length).toBe(5);
    for (const l of ends) {
      expect(l, l).not.toContain('"');
      expect(l, l).not.toContain("->");
    }
    expect(verifyBcc(c)).toBe("ok");
    expect(verdict(c).kind).toBe("match");
  });
});

describe("★ the reader reads the cut, either order ★", () => {
  test("from then to: the head names its address and its namespace", () => {
    const h = matchCarrierHead("<<^ code=`&#x0001;` namespace=`ॐ ँ` from=`?` to=`lar:///a/b`>>");
    expect(h?.uri).toBe("lar:///a/b");
    expect(h?.namespace).toBe("ॐ ँ");
    expect(h?.code).toBe("0001");
  });

  test("to then from: the same address", () => {
    expect(matchCarrierHead("<<^ code=`&#x0001;` to=`lar:///a/b` from=`?`>>")?.uri).toBe("lar:///a/b");
  });

  test("the Kapu head reads", () => {
    expect(matchCarrierHead("<<^ code=`&#x0011;` from=`?` to=`lar:///k`>>")?.code).toBe("0011");
  });

  test("the release reads `to=`?``", () => {
    expect(carrierReleasePattern().test("<<^ code=`&#x0004;` to=`?`>>")).toBe(true);
    expect(matchCarrierMark("x\n<<^ code=`&#x0004;` to=`?`>>\n", "release")?.code).toBe("0004");
  });

  test("CONTROL: a head with no `from` names nothing; a release aimed at an address is no release", () => {
    expect(matchCarrierHead("<<^ code=`&#x0001;` to=`lar:///a/b`>>")).toBeNull();
    expect(carrierReleasePattern().test("<<^ code=`&#x0004;` to=`lar:///x`>>")).toBe(false);
  });

  test("the retired quoted-arrow head reads as no head; the carrier built on it reads torn", () => {
    expect(matchCarrierHead('<<^ code="&#x0001;" from="?" -> to="lar:///a/b">>')).toBeNull();
    const c = frameCarrier({ head: { uri: URI }, body: BODY });
    const old = c.replace(headSigil({ uri: URI }), `<<^ code="&#x0001;" from="?" -> to="${URI}">>`);
    expect(old).not.toBe(c);
    const v = verdict(old);
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["torn-spelling"]);
  });

  test("the retired declaration reads torn", () => {
    const c = frameCarrier({ head: { uri: URI }, body: BODY });
    const old = c.replace(CARRIER_DECLARATION,
      '<<!DOCTYPE "memetic-wikitext+tiddlywiki" "lar:///ha.ka.ba/lares/api/pono/memetic-wikitext">>');
    expect(old).not.toBe(c);
    const v = verdict(old);
    expect(v.kind === "torn" && v.faults.map((f) => f.kind)).toEqual(["torn-spelling"]);
  });
});
