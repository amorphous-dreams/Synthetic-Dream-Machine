/**
 * herm-stack.test.ts — the herm's cap vocabulary: one table of seven holds, the opt-in waymark and eight refusals; the stack a
 * composed vessel holds, derived from what it composed; the inward refusals with their cures.
 * Canon: lar:///ha.ka.ba/lararium/mesh/herm-caps · plan: lar:///ha.ka.ba/kahua/memory/plan/herm-rungs#S2
 */
import { describe, expect, test } from "vitest";
import { composeVessel, type CapModule } from "../src/cap-compose.js";
import { CARRIAGE_CAP } from "../src/carriage-caps.js";
import { CAP_ADDRESS, capLine } from "../src/cap-stack.js";
import * as H from "../src/herm-stack.js";

const cap = (id: string, requires: readonly string[] = []): CapModule => ({ id, requires, build: () => id });
/** A herm's wayfarer composition by cap id, as `composeHerm` wires it; the opener's own words ride beside it. */
const wayfarer = (extra: readonly CapModule[] = []) => composeVessel([
  cap("substrate"), cap("daemon", ["substrate"]), cap(CARRIAGE_CAP.meshpalace, ["substrate"]), cap(CARRIAGE_CAP.carriage, [CARRIAGE_CAP.meshpalace]),
  cap("read-face", ["substrate", CARRIAGE_CAP.meshpalace, "daemon"]), ...extra,
]);
const caps = (holds: readonly H.HermHoldKind[]) => holds.map((h) => h.cap);
const withHold = (row: Partial<H.HermHoldRow>): H.HermCapData => ({ ...H.HERM_CAP_DATA, holds: [...H.HERM_CAP_DATA.holds, { cap: "lar:///herm.probe.stands", gathers: "a probe", stem: "rhizome", proof: [], ...row }] });

describe("the table", () => {
  test("every hold and every refusal root passes the three-term root law", () => {
    expect(H.HERM_CAP_TABLE.holds).toHaveLength(8);
    expect(H.HERM_CAP_TABLE.refusals).toHaveLength(8);
    for (const h of H.HERM_CAP_TABLE.holds) expect(h.cap).toMatch(CAP_ADDRESS);
    for (const r of H.HERM_CAP_TABLE.refusals) expect(r.root).toMatch(CAP_ADDRESS);
  });

  test("a four-term root refuses the table by name, on a hold and on a refusal; a two-term root and a pathed root refuse too", () => {
    for (const root of ["lar:///herm.wiki.renders.twice", "lar:///herm.wiki", "lar:///herm.wiki.renders/x"]) {
      expect(H.readHermCapTable(withHold({ cap: root }))).toMatchObject({ code: "herm-cap-root-malformed" });
    }
    const torn = { ...H.HERM_CAP_DATA, refusals: { ...H.HERM_CAP_DATA.refusals, wikiNeverSaves: { ...H.HERM_CAP_DATA.refusals.wikiNeverSaves, root: "lar:///herm.wiki.never.saves" } } };
    expect(H.readHermCapTable(torn)).toMatchObject({ code: "herm-cap-root-malformed" });
    expect(H.readHermCapTable(H.HERM_CAP_DATA)).not.toHaveProperty("code");
  });

  test("a stolon row, an unknown stem and an address named twice each refuse the table", () => {
    expect(H.readHermCapTable(withHold({ stem: "stolon" }))).toMatchObject({ code: "herm-cap-stolon" });
    expect(H.readHermCapTable(withHold({ stem: "sixth" }))).toMatchObject({ code: "herm-cap-stem-unknown" });
    expect(H.readHermCapTable(withHold({ cap: "lar:///herm.coal.hands" }))).toMatchObject({ code: "herm-cap-twice" });
    expect(H.readHermCapTable(withHold({ cap: "lar:///herm.wiki.never-saves" }))).toMatchObject({ code: "herm-cap-twice" });
  });

  test("a rename moves one place: a renamed root carries its code, its refusal and its data row with it", () => {
    const renamed = { ...H.HERM_CAP_DATA, refusals: { ...H.HERM_CAP_DATA.refusals, wikiNeverSaves: { ...H.HERM_CAP_DATA.refusals.wikiNeverSaves, root: "lar:///herm.wiki.never-keeps" } } };
    const table = H.readHermCapTable(renamed) as H.HermCapTable;
    expect(table.refusals.find((r) => r.office === "wikiNeverSaves")).toMatchObject({ code: "herm-wiki-never-keeps" });
    expect(H.hermRefusal("lar:///herm.wiki.never-keeps", table)).toMatchObject({ code: "herm-wiki-never-keeps" });
    expect(H.hermRefusal("lar:///herm.wiki.never-saves", table)).toBeNull();
    expect(H.hermStackTiddler(table).text).toContain("herm-wiki-never-keeps");
  });
});

describe("the stack a composition holds", () => {
  test("a wayfarer with a bulb holds the leyline, the coal and the keel; one with no bulb omits herm.coal.hands", async () => {
    const bare = await wayfarer();
    const lit = await wayfarer([cap("bulb", ["substrate"])]);
    expect(caps(H.hermHolds({ composed: bare.order }))).toEqual(["lar:///herm.leyline.carries", "lar:///herm.keel.wards"]);
    expect(caps(H.hermHolds({ composed: lit.order }))).toEqual(["lar:///herm.leyline.carries", "lar:///herm.coal.hands", "lar:///herm.keel.wards"]);
  });

  test("the waymark rides only where the keeper set its knob AND a bulb stands to name", async () => {
    const lit = await wayfarer([cap("bulb", ["substrate"])]);
    const bare = await wayfarer();
    expect(caps(H.hermHolds({ composed: lit.order }))).not.toContain("lar:///herm.waymark.posts");
    expect(caps(H.hermHolds({ composed: lit.order, knobs: [] }))).not.toContain("lar:///herm.waymark.posts");
    expect(caps(H.hermHolds({ composed: lit.order, knobs: ["herm.waymark"] }))).toContain("lar:///herm.waymark.posts");
    expect(caps(H.hermHolds({ composed: bare.order, knobs: ["herm.waymark"] }))).not.toContain("lar:///herm.waymark.posts");
  });

  test("the keel needs both its proofs: a daemon with no FLOW map wards nothing", () => {
    expect(caps(H.hermHolds({ composed: ["substrate", "daemon"] }))).toEqual([]);
    expect(caps(H.hermHolds({ composed: ["daemon", "meshpalace"] }))).toEqual(["lar:///herm.keel.wards"]);
  });

  test("the shelf and the clear wiki stay off every stack until their caps compose, then stand in the table's order", async () => {
    const lit = await wayfarer([cap("bulb", ["substrate"])]);
    expect(caps(H.hermHolds({ composed: lit.order }))).not.toEqual(expect.arrayContaining(["lar:///herm.shelf.rests"]));
    expect(caps(H.hermHolds({ composed: lit.order }))).not.toEqual(expect.arrayContaining(["lar:///herm.wiki.renders"]));
    const whole = [...lit.order, "lease", "floor-porch", "shelf", "clear-wiki"];
    expect(caps(H.hermHolds({ composed: whole, knobs: ["herm.waymark"] }))).toEqual(H.HERM_CAP_TABLE.holds.map((h) => h.cap));
  });

  test("no herm stack ever yields a stolon, whatever a composition claims", () => {
    const facts = [...new Set(H.HERM_CAP_TABLE.holds.flatMap((h) => h.proof)), "stolon", "invite"];
    for (let mask = 0; mask < 1 << facts.length; mask++) {
      const composed = facts.filter((_, i) => (mask & (1 << i)) !== 0);
      for (const knobs of [[], ["herm.waymark", "herm.stolon"]]) {
        const holds = H.hermHolds({ composed, knobs });
        expect(holds.some((h) => (h.stem as string) === "stolon" || h.cap.includes("stolon"))).toBe(false);
      }
    }
  });

  test("the stack's body reads back through the shared `#/has` grammar, one cap per line", () => {
    const holds = H.hermHolds({ composed: ["carriage", "bulb"] });
    expect(H.hermStackBody(holds)).toBe("lar:///herm.leyline.carries\nlar:///herm.coal.hands");
    expect(H.hermStackBody(holds).split("\n").map((l) => capLine(l)?.cap)).toEqual(caps(holds));
  });
});

describe("the refusals answer inward, each with a cure", () => {
  test("each code reads as its root's terms hyphen-joined", () => {
    expect(H.HERM_CAP_TABLE.refusals.map((r) => r.code)).toEqual([
      "herm-seal-never-opens", "herm-voice-never-signs-public", "herm-face-never-seats", "herm-pronaos-never-lights",
      "herm-door-never-describes", "herm-shelf-never-posts", "herm-title-never-answers", "herm-wiki-never-saves",
    ]);
    for (const r of H.HERM_CAP_TABLE.refusals) expect(r.code).toBe(H.refusalCodeOf(r.root));
  });

  test("every office answers its refusal: the code, the root, and a why that names the cure's runnable command", () => {
    expect(Object.keys(H.HERM_REFUSAL).sort()).toEqual([...H.HERM_REFUSAL_OFFICES].sort());
    for (const office of H.HERM_REFUSAL_OFFICES) {
      const r = H.HERM_REFUSAL[office];
      expect(r.code).toBe(H.refusalCodeOf(r.root));
      expect(r.cure).toMatch(/`lares [a-z]/);
      expect(r.why).toContain(r.root);
      expect(r.why).toContain(r.cure);
    }
    expect(H.HERM_REFUSAL.wikiNeverSaves.code).toBe("herm-wiki-never-saves");
    expect(H.hermRefusal("lar:///herm.wiki.never-reads")).toBeNull();
  });

  test("no refusal line carries a copula", () => {
    for (const r of Object.values(H.HERM_REFUSAL)) expect(r.why).not.toMatch(/\b(is|are|was|were|be|been|being|am)\b/i);
  });
});

describe("the data tiddler mirrors the table", () => {
  test("it stands under the canon slot and carries every row the table holds", () => {
    const t = H.hermStackTiddler();
    expect(t.title).toBe("lar:///ha.ka.ba/lararium/mesh/herm-caps#/the-stack");
    expect(t.type).toBe("application/json");
    const data = JSON.parse(t.text) as { holds: Array<{ cap: string }>; refusals: Array<{ root: string; code: string }> };
    expect(data.holds.map((h) => h.cap)).toEqual(H.HERM_CAP_TABLE.holds.map((h) => h.cap));
    expect(data.refusals.map((r) => [r.root, r.code])).toEqual(H.HERM_CAP_TABLE.refusals.map((r) => [r.root, r.code]));
  });
});
