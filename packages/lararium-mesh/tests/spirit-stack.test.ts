/**
 * spirit-stack.test.ts — one spirit record and the stack of what it holds: the caps a record's tags and fields stand, the
 * profiles they sign, the `#/has` slot's lines, the write a body of lines asks, and the stack line in the seed's shape.
 * Design: lar:///ha.ka.ba/kahua/memory/research/alana-reweave
 */
import { describe, expect, test } from "vitest";
import * as K from "../src/spirit-stack.js";

const ONE = K.spiritOf("cold-reader");
const M = "lar:///ha.ka.ba/kahua/memory/";
const LANE = "lar:///spirit.lane.holds";
const FACE = "lar:///spirit.face.serves";
const CANON = "lar:///spirit.canon.transcludes";

describe("the one address", () => {
  test("a pet name answers at lares/spirit/<pet>, a three-segment path under the stable root", () => {
    expect(ONE).toBe("lar:///ha.ka.ba/lares/spirit/cold-reader");
    expect(K.seatedCap(ONE)).toBeNull();
  });
  test("every cap the house names reads as a three-term address", () => {
    for (const k of K.SPIRIT_CAPS) expect(k.cap).toMatch(K.CAP_ADDRESS);
    expect("lar:///spirit.lane").not.toMatch(K.CAP_ADDRESS);
    expect("lar:///spirit.lane.holds/x").not.toMatch(K.CAP_ADDRESS);
  });
});

describe("the stack reads off the record", () => {
  test("a tagged cap stands with its field's value, and a foreign address rides as a bare cap", () => {
    const stack = K.stackOf({ tags: `stage/x ${LANE} lar:///custody.hand.admits [[a title]]`, lane: "read a PR cold" }, ONE);
    expect(stack.map((h) => [h.cap, h.value, h.tagged, h.field])).toEqual([[LANE, "read a PR cold", true, "lane"], ["lar:///custody.hand.admits", "", true, null]]);
    expect(K.profilesOf(stack)).toEqual(["tasked"]);
  });
  test("a spirit holds several profiles at once, in the house's order", () => {
    expect(K.profilesOf(K.stackOf({ tags: `${LANE} ${FACE}`, face: "1", lane: "an errand" }, ONE))).toEqual(["familiar", "tasked"]);
  });
  test("each legacy address signs its profile's cap, untagged, so the three kinds read through with no record moved", () => {
    expect(K.profilesOf(K.stackOf({}, `${M}familiar/lares-alpha`))).toEqual(["familiar"]);
    expect(K.profilesOf(K.stackOf({}, `${M}spirit/cold-reader`))).toEqual(["tasked"]);
    const card = K.stackOf({ pet: "cold-reader", lane: "read a PR cold" }, `${M}spirit-card/cold-reader`);
    expect(card).toMatchObject([{ cap: LANE, value: "read a PR cold", tagged: false, seated: true }]);
    expect(K.profilesOf(K.stackOf({ canon: "lar:///ha.ka.ba/elyncia/lindwyrm" }, K.maskCardOf("lindwyrm")))).toEqual(["masked"]);
    expect(K.stackOf({}, ONE)).toEqual([]);
  });
  test("who strings a cap: the table's holder, any body for a bare tag", () => {
    expect(K.capHolder(LANE)).toBe("hand");
    expect(K.capHolder("lar:///spirit.mandate.offers")).toBe("door");
    expect(K.capHolder("lar:///custody.hand.admits")).toBe("body");
  });
});

describe("the #/has slot", () => {
  test("the body reads one cap per line, a value folded onto its line", () => {
    expect(K.stackBody(K.stackOf({ tags: `${LANE} lar:///render.road.projects`, lane: "read\n  cold" }, ONE))).toBe(`${LANE} read cold\nlar:///render.road.projects`);
  });
  test("a line names its cap with or without the scheme", () => {
    expect(K.capLine("spirit.lane.holds read cold")).toEqual({ cap: LANE, value: "read cold" });
    expect(K.capLine(`${LANE}`)).toEqual({ cap: LANE, value: "" });
    expect(K.capLine("not a cap")).toBeNull();
  });
  test("a line added strings the cap: its tag joins the tags and its field takes the value, in one write", () => {
    const fields = { tags: "stage/x", model: "opus" };
    expect(K.stackWrite(fields, ONE, `${LANE} read a PR cold`)).toEqual({ patch: { lane: "read a PR cold", tags: `stage/x ${LANE}` }, unset: [] });
  });
  test("a later line for one cap trues its value; a body that asks nothing new writes nothing", () => {
    const fields = { tags: LANE, lane: "old" };
    expect(K.stackWrite(fields, ONE, `${LANE} old\n${LANE} new`)).toEqual({ patch: { lane: "new" }, unset: [] });
    expect(K.stackWrite(fields, ONE, `${LANE} old`)).toBeNull();
    expect(K.stackWrite({ tags: LANE, lane: "two\nlines" }, ONE, `${LANE} two lines`)).toBeNull();
  });
  test("a line left out unstrings the cap: its tag and its field both leave, and other tags stay", () => {
    expect(K.stackWrite({ tags: `stage/x ${LANE} ${FACE}`, lane: "l", face: "1" }, ONE, `${FACE} 1`)).toEqual({ patch: { tags: `stage/x ${FACE}` }, unset: ["lane"] });
    expect(K.stackWrite({ tags: LANE, lane: "l" }, ONE, "")).toEqual({ patch: {}, unset: ["lane", "tags"] });
  });
  test("a malformed line, a bare cap carrying a value and a seated cap dropped each refuse by name", () => {
    expect(K.stackWrite({}, ONE, "no cap here")).toMatchObject({ code: "spirit-cap-malformed" });
    expect(K.stackWrite({}, ONE, "custody.hand.admits yes")).toMatchObject({ code: "spirit-cap-malformed" });
    expect(K.stackWrite({ lane: "l" }, `${M}spirit-card/cold-reader`, "")).toMatchObject({ code: "spirit-cap-seated" });
  });
  test("a legacy record takes a new cap beside the one its address signs", () => {
    expect(K.stackWrite({}, `${M}familiar/lares-alpha`, `${FACE}\nlar:///custody.hand.admits`)).toEqual({ patch: { tags: `${FACE} lar:///custody.hand.admits` }, unset: [] });
  });
});

describe("the stack line", () => {
  test("the whole stack rides one has line in the seed's shape: profiles, caps, then the record's other fields", () => {
    const line = K.stackLine("cold-reader", { title: ONE, pet: "cold-reader", tags: `stage/x ${LANE}`, lane: "read a PR cold", model: "sonnet", bodies: "one\ntwo", description: "a cold reader", text: "{{||t}}" }, ONE);
    expect(line).toBe("<<~ has entity=`spirit` name=`cold-reader` params=`kind/tasked lane.holds/[[read a PR cold]] bodies/[[one two]] model/sonnet ~ a cold reader`>>");
  });
  test("a sealed field rides as its name alone, and a long value cuts", () => {
    const line = K.stackLine("lindwyrm", { tags: CANON, canon: "lar:///ha.ka.ba/elyncia/lindwyrm", hoard: "the true name", sealed: "hoard", look: "x".repeat(200) }, ONE);
    expect(line).not.toContain("the true name");
    expect(line).toContain("hoard/sealed");
    expect(line).toContain(`look/${"x".repeat(K.STACK_VALUE_CHARS - 1)}…`);
    expect(line).toContain("kind/masked canon.transcludes/lar:///ha.ka.ba/elyncia/lindwyrm");
  });
});
