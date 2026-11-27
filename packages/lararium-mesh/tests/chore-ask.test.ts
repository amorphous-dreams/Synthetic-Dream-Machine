/**
 * chore-ask — the face a chore acts for, and the mark its receipt carries (place-and-face-islands#/the-isomorphic-core).
 *
 * RT-core: the lend decides what a chore may name (`wearInside`), and what this process carries decides what it may act as.
 * Before the islands split the process carries the daemon mount alone, so a lent face other than the mount refuses
 * `chore-face-not-mounted`, naming both; no face named over a two-face lend refuses `face-not-named`; an unlent face refuses
 * `face-not-lent`, naming the set. The receipt mark carries the acting face, the asker's hand and its session, and no key,
 * id or signature.
 */
import { describe, expect, test } from "vitest";
import { lentFacesOf, type LentFaces } from "../src/lent-faces.js";
import { actingFaceOf, choreReceiptMark, choreReceiptMarkOf, type ChoreAsk } from "../src/chore-ask.js";

const lent = (raw: unknown): LentFaces => {
  const r = lentFacesOf(raw);
  if (!r.ok) throw new Error(r.refusal);
  return r.faces;
};
const ask = (face: number | null, chore = "tiddler-put"): ChoreAsk => ({ chore, face, asker: { hand: "seat", session: "s-1", generation: 0 } });

describe("actingFaceOf: the acting face of a chore", () => {
  test("a lent face this process carries acts", () => {
    expect(actingFaceOf(ask(0), lent([0, 1]), [0])).toEqual({ ok: true, face: 0 });
    expect(actingFaceOf(ask(1), lent([0, 1]), [0, 1])).toEqual({ ok: true, face: 1 });
  });

  test("a lent face outside what this process carries refuses chore-face-not-mounted, naming both faces and the chore", () => {
    const r = actingFaceOf(ask(1), lent([0, 1]), [0]);
    expect(r).toMatchObject({ ok: false, refusal: "chore-face-not-mounted" });
    if (r.ok) return;
    expect(r.message).toMatch(/^chore-face-not-mounted: /);
    expect(r.message).toMatch(/h1/);
    expect(r.message).toMatch(/h0/);
    expect(r.message).toMatch(/tiddler-put/);
  });

  test("no face named over a two-face lend refuses face-not-named: never a silent steward", () => {
    expect(actingFaceOf(ask(null), lent([0, 1]), [0])).toMatchObject({ ok: false, refusal: "face-not-named" });
  });

  test("no face named over a one-face lend acts as that face, where carried", () => {
    expect(actingFaceOf(ask(null), lent([0]), [0])).toEqual({ ok: true, face: 0 });
    expect(actingFaceOf(ask(null), lent([1]), [0])).toMatchObject({ ok: false, refusal: "chore-face-not-mounted" });
  });

  test("a named face the set never lent refuses face-not-lent, naming the set", () => {
    const r = actingFaceOf(ask(2), lent([0, 1]), [0, 1, 2]);
    expect(r).toMatchObject({ ok: false, refusal: "face-not-lent" });
    if (!r.ok) expect(r.message).toMatch(/h0, h1/);
  });

  test("a process that carries no face refuses chore-face-not-mounted", () => {
    expect(actingFaceOf(ask(0), lent([0]), [])).toMatchObject({ ok: false, refusal: "chore-face-not-mounted" });
  });
});

describe("ChoreReceiptMark: the acting face, riding an existing receipt", () => {
  test("the mark names the acting face, the asker's hand and its session alone", () => {
    expect(choreReceiptMark(ask(0), 0)).toEqual({ acting: 0, asker: "seat", session: "s-1" });
    expect(Object.keys(choreReceiptMark(ask(0), 0)).sort()).toEqual(["acting", "asker", "session"]);
  });

  test("the validator reads a well-formed mark and refuses one carrying any other field (a key, an id, a signature)", () => {
    expect(choreReceiptMarkOf({ acting: 1, asker: "cli", session: null })).toEqual({ acting: 1, asker: "cli", session: null });
    expect(choreReceiptMarkOf({ acting: 1, asker: "cli", session: null, key: "0xabc" })).toBeNull();
    expect(choreReceiptMarkOf({ acting: 1, asker: "cli", session: null, signature: "sig" })).toBeNull();
    expect(choreReceiptMarkOf({ acting: -1, asker: "cli", session: null })).toBeNull();
    expect(choreReceiptMarkOf({ acting: 0, asker: "stranger", session: null })).toBeNull();
    expect(choreReceiptMarkOf("h0")).toBeNull();
  });
});
