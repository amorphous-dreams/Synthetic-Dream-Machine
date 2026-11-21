/**
 * face-relation — a face's folder name derives from ONE opaque relation id F, minted once in the founding act.
 *
 * Operator law (2026-11-02): no pet-names and no key-derived names that move, in dir structure. The tag a face's kahua
 * folder wore (`personaScopeTag(group)`) moved with the group, so a recovery onto a new group moved the folder. F is a random
 * UUID the root signs into the founding log as a `plane` act (`FACE_PLANE`), beside the stage and board pins. Every reader
 * takes F from the VERIFIED projection; nothing derives it. A rotation or a recovery updates the binding and never F.
 *
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { FACE_PLANE, faceRelationOf, mintFaceRelation } from "../src/face-relation.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const F = "7b0f6c1e-4a52-4d3b-9c18-2e5a6f0d8b31";
const pinned = (f: string) => ({ planes: { [FACE_PLANE]: f } });

describe("the relation id reads from the verified pin alone", () => {
  test("RED: a pinned UUID answers; an absent pin, a non-UUID value and a derived group tag answer null", () => {
    expect(faceRelationOf(pinned(F))).toBe(F);
    expect(faceRelationOf({ planes: {} })).toBeNull();
    expect(faceRelationOf(pinned("automerge:other"))).toBeNull();
    expect(faceRelationOf(pinned("2a1f0c9e4b7d"))).toBeNull();
  });

  test("CONTROL: the same pin answers the same id every time, whatever the group is", () => {
    expect(faceRelationOf(pinned(F))).toBe(faceRelationOf(pinned(F)));
  });
});

describe("a mint happens once, in the founding", () => {
  test("RED: a fresh founding mints a random v4 UUID, and two mints differ", () => {
    const a = mintFaceRelation({ planes: {} }), b = mintFaceRelation({ planes: {} });
    expect(a).toMatch(UUID);
    expect(b).toMatch(UUID);
    expect(a).not.toBe(b);
  });

  test("RED: a later mint over a pinned face refuses `face-relation-already-minted`; CONTROL: the unpinned projection mints", () => {
    expect(() => mintFaceRelation(pinned(F))).toThrowError(expect.objectContaining({ code: "face-relation-already-minted" }));
    expect(() => mintFaceRelation({ planes: {} })).not.toThrow();
  });
});
