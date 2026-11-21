/**
 * lent-faces — the set of faces a pūlama lends one vessel, and the one face a session wears inside it.
 *
 * The pure core alone runs here: a wire value parses into the canonical set or refuses by class, membership reads, partial
 * lighting serves the lit faces and names the waiting ones, and a session's worn face resolves inside the lent set.
 */
import { describe, expect, test } from "vitest";
import { isLent, lentFacesOf, lentFacesWire, renderLentFaces, servedOf, wearInside, type LentFaces } from "../src/lent-faces.js";

const lent = (raw: unknown): LentFaces => {
  const r = lentFacesOf(raw);
  if (!r.ok) throw new Error(r.refusal);
  return r.faces;
};

describe("lentFacesOf: the wire value parses into the canonical set", () => {
  test("bare ordinals and admitted faces both parse, sorted by ordinal", () => {
    expect(lent([2, 0])).toEqual([{ ordinal: 0 }, { ordinal: 2 }]);
    expect(lent([{ fcid: "fc-2", ordinal: 2 }, { fcid: "fc-0", ordinal: 0 }])).toEqual([{ fcid: "fc-0", ordinal: 0 }, { fcid: "fc-2", ordinal: 2 }]);
  });

  test("the canonical wire form stays stable across input order, so a hash input holds", () => {
    const a = lentFacesWire(lent([{ ordinal: 2, fcid: "fc-2" }, { fcid: "fc-0", ordinal: 0 }]));
    const b = lentFacesWire(lent([{ fcid: "fc-0", ordinal: 0 }, { fcid: "fc-2", ordinal: 2 }]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).toBe('[{"fcid":"fc-0","ordinal":0},{"fcid":"fc-2","ordinal":2}]');
  });

  test("an empty or missing set refuses lent-faces-empty: no set ever means every face", () => {
    for (const raw of [[], null, undefined]) {
      const r = lentFacesOf(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal).toBe("lent-faces-empty");
    }
  });

  test("a repeated ordinal or fcid refuses lent-faces-duplicate", () => {
    for (const raw of [[0, 0], [{ fcid: "a", ordinal: 0 }, { fcid: "a", ordinal: 1 }], [{ fcid: "a", ordinal: 1 }, { fcid: "b", ordinal: 1 }]]) {
      const r = lentFacesOf(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal).toBe("lent-faces-duplicate");
    }
  });

  test("a non-integer, negative or misshapen member refuses lent-faces-malformed", () => {
    for (const raw of [[1.5], [-1], ["h0"], [{ ordinal: "0" }], [{ ordinal: 0, fcid: "" }], [{ ordinal: 0, fcid: 7 }], { faces: [0] }, 0]) {
      const r = lentFacesOf(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.refusal).toBe("lent-faces-malformed");
    }
  });
});

describe("membership, rendering and partial lighting", () => {
  const set = lent([0, 2]);

  test("isLent reads membership by ordinal", () => {
    expect(isLent(set, 0)).toBe(true);
    expect(isLent(set, 2)).toBe(true);
    expect(isLent(set, 1)).toBe(false);
  });

  test("the set renders as `h0, h2` for refusal messages", () => {
    expect(renderLentFaces(set)).toBe("h0, h2");
  });

  test("servedOf serves the lit faces the set lends and names the ones that wait", () => {
    expect(servedOf(set, [0, 1])).toEqual({ served: [{ ordinal: 0 }], waiting: [{ ordinal: 2 }] });
    expect(servedOf(set, [2, 0])).toEqual({ served: [{ ordinal: 0 }, { ordinal: 2 }], waiting: [] });
    expect(servedOf(set, [])).toEqual({ served: [], waiting: [{ ordinal: 0 }, { ordinal: 2 }] });
  });
});

describe("wearInside: the face a session wears inside the lent set", () => {
  const two = lent([{ fcid: "fc-0", ordinal: 0 }, { fcid: "fc-2", ordinal: 2 }]);

  test("a named face the set lends passes", () => {
    expect(wearInside(two, 2, 0)).toEqual({ ok: true, face: { fcid: "fc-2", ordinal: 2 } });
  });

  test("a named face outside the set refuses face-not-lent and names the lent set", () => {
    const r = wearInside(two, 1, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal).toBe("face-not-lent");
      expect(r.message).toContain("h1");
      // The set reads as what this vessel serves: a vessel with no pūlama serves a set too.
      expect(r.message).toBe("face-not-lent: this call names h1, and this vessel serves h0, h2 alone");
    }
  });

  test("no face named takes the worn face when the set lends it", () => {
    expect(wearInside(two, null, 2)).toEqual({ ok: true, face: { fcid: "fc-2", ordinal: 2 } });
  });

  test("no face named and none worn takes the single lent face", () => {
    expect(wearInside(lent([2]), null, null)).toEqual({ ok: true, face: { ordinal: 2 } });
    expect(wearInside(lent([2]), null, 5)).toEqual({ ok: true, face: { ordinal: 2 } });
  });

  test("no face named, several lent and none worn inside them refuses face-not-named", () => {
    for (const worn of [null, 1]) {
      const r = wearInside(two, null, worn);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.refusal).toBe("face-not-named");
        expect(r.message).toBe("face-not-named: this vessel serves h0, h2; name the face this session wears (`--face N`)");
      }
    }
  });
});
