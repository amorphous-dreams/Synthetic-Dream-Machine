/**
 * lar-camera — the camera contract's readers fail closed and its builders bound what they send.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_WHOLE_VALUE_MAX_CHARS, boundedWholeValue, isReliableKind, mkLarControlEvent, mkLarFrame,
  readLarControlEvent, readLarControlResult, readLarFrame,
} from "../src/lar-camera.js";

const act = () => mkLarControlEvent({ eventId: "e1", cameraId: "lar:story", mountEpoch: 1, kind: "lar:act", renderId: "7", action: "lar:click", seenFrameRev: 3 });

describe("lar:control-event", () => {
  test("a sound act reads back whole; CONTROL: two targets, no target, a strange kind or an unbounded value read null", () => {
    expect(readLarControlEvent(act())).toMatchObject({ kind: "lar:act", renderId: "7" });
    expect(readLarControlEvent({ ...act(), controlId: "c" })).toBeNull();
    const { renderId: _r, ...noTarget } = act();
    expect(readLarControlEvent(noTarget)).toBeNull();
    expect(readLarControlEvent({ ...act(), kind: "lar:keystroke" })).toBeNull();
    expect(readLarControlEvent({ ...act(), wholeValue: "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS + 1) })).toBeNull();
    expect(readLarControlEvent({ ...act(), mountEpoch: -1 })).toBeNull();
  });
  test("the builder refuses an over-long whole value at the sending shore; CONTROL: a value at the bound passes", () => {
    expect(() => mkLarControlEvent({ ...act(), kind: "lar:sense", action: "lar:sense", wholeValue: "x".repeat(LAR_WHOLE_VALUE_MAX_CHARS + 1) })).toThrow(/exceeds its bound/);
    expect(boundedWholeValue("x".repeat(LAR_WHOLE_VALUE_MAX_CHARS))).not.toBeNull();
    expect(boundedWholeValue(["a", "b"])).toEqual(["a", "b"]);
    expect(boundedWholeValue(42)).toBeNull();
  });
  test("sense drops, every other kind answers", () => {
    expect(isReliableKind("lar:sense")).toBe(false);
    for (const kind of ["lar:act", "lar:write", "lar:service-result"] as const) expect(isReliableKind(kind)).toBe(true);
  });
});

describe("lar:frame and lar:control-result", () => {
  test("a frame reads back when every key carries one payload; CONTROL: a key with two payloads, none, or no revision reads null", () => {
    const frame = mkLarFrame({ wikiUri: "lar:///w", cameraId: "lar:story", mountEpoch: 2, sensedRevision: { body: 4 }, keys: [
      { key: "lar:surface", rev: 9, html: "<p/>" }, { key: "lar:style", rev: 1, css: "" }, { key: "lar:membership", rev: 1, members: ["lar:surface", "lar:style"] },
    ] });
    expect(readLarFrame(frame)).toMatchObject({ mountEpoch: 2 });
    expect(readLarFrame({ ...frame, keys: [{ key: "lar:surface", rev: 1, html: "", css: "" }] })).toBeNull();
    expect(readLarFrame({ ...frame, keys: [{ key: "lar:surface", rev: 1 }] })).toBeNull();
    expect(readLarFrame({ ...frame, keys: [{ key: "lar:surface", html: "" }] })).toBeNull();
    expect(readLarFrame({ ...frame, sensedRevision: { body: "4" } })).toBeNull();
  });
  test("a result names its status, and a refusal names its reason", () => {
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "applied" })).not.toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "refused" })).toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "refused", reason: "unclaimed" })).not.toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "done" })).toBeNull();
  });
});
