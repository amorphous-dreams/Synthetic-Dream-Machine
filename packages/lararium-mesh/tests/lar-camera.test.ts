/**
 * lar-camera — the camera contract's readers fail closed and its builders bound what they send.
 */
import { describe, expect, test } from "vitest";
import {
  LAR_WHOLE_VALUE_MAX_CHARS, boundedWholeValue, isReliableKind, mkLarControlEvent, mkLarFrame,
  readLarControlEvent, readLarControlResult, readLarFrame, readLarResend, readLarService, mkLarResend, mkLarService,
  larKeyChordName, readLarCancel, readLarStampTokens,
  readLarSurfaceManifest, LAR_SURFACE_DEFAULT_SERVICES,
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
  test("a key's payload reads by type, not presence alone; CONTROL: a number for html, a number in members, a false tombstone, each reads null", () => {
    const frame = (keys: unknown[]) => ({ type: "lar:frame", wikiUri: "lar:///w", cameraId: "lar:story", mountEpoch: 2, sensedRevision: {}, keys });
    expect(readLarFrame(frame([{ key: "lar:surface", rev: 1, html: 5 }]))).toBeNull();
    expect(readLarFrame(frame([{ key: "lar:style", rev: 1, css: {} }]))).toBeNull();
    expect(readLarFrame(frame([{ key: "lar:membership", rev: 1, members: [1] }]))).toBeNull();
    expect(readLarFrame(frame([{ key: "lar:surface", rev: 1, tombstone: false }]))).toBeNull();
    expect(readLarFrame(frame([{ key: "lar:surface", rev: 1, tombstone: true }]))).not.toBeNull();
    expect(readLarFrame(frame([{ key: "lar:membership", rev: 1, members: [] }]))).not.toBeNull();
  });
  test("a frame names each key once; CONTROL: two keys under one name read null", () => {
    const frame = (keys: unknown[]) => ({ type: "lar:frame", wikiUri: "lar:///w", cameraId: "lar:story", mountEpoch: 2, sensedRevision: {}, keys });
    expect(readLarFrame(frame([{ key: "lar:surface", rev: 1, html: "" }, { key: "lar:surface", rev: 2, html: "" }]))).toBeNull();
    expect(readLarFrame(frame([{ key: "lar:surface", rev: 1, html: "" }, { key: "lar:style", rev: 2, css: "" }]))).not.toBeNull();
  });
  test("a sense carries its local revision; CONTROL: an act carries none and reads back", () => {
    const sense = mkLarControlEvent({ eventId: "s1", cameraId: "lar:story", mountEpoch: 1, kind: "lar:sense", controlId: "c", action: "lar:sense", seenFrameRev: 1, localRev: 3, wholeValue: "v" });
    expect(readLarControlEvent(sense)).toMatchObject({ localRev: 3 });
    const { localRev: _dropped, ...noRev } = sense;
    expect(readLarControlEvent(noRev)).toBeNull();
    expect(readLarControlEvent({ ...noRev, kind: "lar:act", action: "lar:click" })).not.toBeNull();
  });
  test("a toggle's checked reads as a boolean; CONTROL: the string \"true\" reads null", () => {
    const toggle = mkLarControlEvent({ eventId: "t1", cameraId: "lar:story", mountEpoch: 1, kind: "lar:act", controlId: "c", action: "lar:toggle", seenFrameRev: 1, checked: true });
    expect(readLarControlEvent(toggle)).toMatchObject({ checked: true });
    expect(readLarControlEvent({ ...toggle, checked: "true" })).toBeNull();
  });
  test("a resend names its camera; a service names its wiki, request, a door the house names, primitive args and a person's activation; CONTROLS read null", () => {
    expect(readLarResend(mkLarResend())).toMatchObject({ cameraId: "lar:story" });
    expect(readLarResend({ type: "lar:resend", cameraId: "" })).toBeNull();
    expect(readLarResend({ type: "lar:resend" })).toBeNull();
    const svc = mkLarService({ wikiUri: "lar:///w", requestId: "r1", kind: "clipboard", args: { text: "hi" } });
    expect(readLarService(svc)).toMatchObject({ kind: "clipboard", userActivation: true });
    expect(readLarService({ ...svc, kind: "lar:http-request" })).toBeNull();
    expect(readLarService({ ...svc, userActivation: false })).toBeNull();
    expect(readLarService({ ...svc, args: { nested: {} } })).toBeNull();
    expect(readLarService({ ...svc, args: [] })).toBeNull();
    expect(readLarService({ ...svc, requestId: "" })).toBeNull();
  });
  test("a write names the basis it builds on; CONTROL: a basis that is not a list of names reads null", () => {
    const write = mkLarControlEvent({ eventId: "w1", cameraId: "lar:story", mountEpoch: 1, kind: "lar:write", controlId: "c", action: "lar:write", seenFrameRev: 1, txId: "t1", basis: ["h1", "h2"], records: [{ title: "T", fields: { text: "x" } }] });
    expect(readLarControlEvent(write)).toMatchObject({ basis: ["h1", "h2"] });
    expect(readLarControlEvent({ ...write, basis: "h1" })).toBeNull();
    expect(readLarControlEvent({ ...write, basis: [1] })).toBeNull();
    expect(readLarControlEvent({ ...write, records: "x" })).toBeNull();
    expect(readLarControlEvent({ ...write, records: [{ fields: {} }] })).toBeNull();
  });
  test("a text operation carries its selection and the field it edits; CONTROL: a selection running backwards, a negative offset or a nameless field reads null", () => {
    const op = mkLarControlEvent({ ...act(), action: "lar:edit-operation", controlType: "lar-field-operation", wholeValue: "wrap me", selection: { start: 5, end: 7 }, fieldId: "12", localRev: 0 });
    expect(readLarControlEvent(op)).toMatchObject({ selection: { start: 5, end: 7 }, fieldId: "12" });
    expect(readLarControlEvent({ ...op, selection: { start: 7, end: 5 } })).toBeNull();
    expect(readLarControlEvent({ ...op, selection: { start: -1, end: 5 } })).toBeNull();
    expect(readLarControlEvent({ ...op, selection: "5..7" })).toBeNull();
    expect(readLarControlEvent({ ...op, fieldId: "" })).toBeNull();
    expect(readLarControlEvent({ ...op, controlType: 7 })).toBeNull();
  });
  test("a result's want names a whole value and a forward selection; CONTROL: a want without its value or running backwards reads null", () => {
    const applied = { type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "applied" };
    expect(readLarControlResult({ ...applied, want: { value: "wrap ''me''", selStart: 5, selEnd: 11 } })).toMatchObject({ want: { selEnd: 11 } });
    expect(readLarControlResult({ ...applied, want: { selStart: 5, selEnd: 11 } })).toBeNull();
    expect(readLarControlResult({ ...applied, want: { value: "x", selStart: 9, selEnd: 1 } })).toBeNull();
  });
  test("a result names its status, and a refusal names its reason", () => {
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "applied" })).not.toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "refused" })).toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "refused", reason: "unclaimed" })).not.toBeNull();
    expect(readLarControlResult({ type: "lar:control-result", eventId: "e", cameraId: "c", mountEpoch: 1, status: "done" })).toBeNull();
  });
  test("a surface names its doors at open: a resend carries a manifest of house kinds, each once; CONTROLS: a strange kind, a repeat or a bare list read null", () => {
    expect(LAR_SURFACE_DEFAULT_SERVICES).toEqual(["clipboard", "download", "route"]);
    expect(readLarResend(mkLarResend("lar:story", { services: ["clipboard", "print"] }))).toMatchObject({ manifest: { services: ["clipboard", "print"] } });
    expect(mkLarResend()).not.toHaveProperty("manifest");
    expect(readLarSurfaceManifest({ services: [] })).toEqual({ services: [] });
    expect(readLarSurfaceManifest({ services: ["http-request"] })).toBeNull();
    expect(readLarSurfaceManifest({ services: ["print", "print"] })).toBeNull();
    expect(readLarSurfaceManifest(["print"])).toBeNull();
    expect(readLarResend({ ...mkLarResend(), manifest: { services: ["teleport"] } })).toBeNull();
  });
  test("a service answer names the request it closes and its status; CONTROL: one lacking either reads null", () => {
    const result = mkLarControlEvent({ eventId: "r1", cameraId: "lar:story", mountEpoch: 1, kind: "lar:service-result", controlId: "lar:document", action: "lar:service-result", seenFrameRev: 1, requestId: "q1", status: "ok" });
    expect(readLarControlEvent(result)).toMatchObject({ requestId: "q1", status: "ok" });
    const { requestId: _q, ...noRequest } = result;
    expect(readLarControlEvent(noRequest)).toBeNull();
    const { status: _s, ...noStatus } = result;
    expect(readLarControlEvent(noStatus)).toBeNull();
  });
});

describe("the binding stamps", () => {
  test("data-lar-cancel reads each type's rule and fails closed on a qualifier the contract never named", () => {
    expect([...readLarCancel("click:ordinary keydown:declared dragover drop")]).toEqual([
      ["click", "ordinary"], ["keydown", "declared"], ["dragover", "always"], ["drop", "always"],
    ]);
    // CONTROL: an unknown qualifier, a doubled one and an empty stamp cancel nothing.
    expect([...readLarCancel("click:sometimes keydown:declared:extra")]).toEqual([]);
    expect([...readLarCancel(null)]).toEqual([]);
    expect([...readLarStampTokens("  click   keydown ")]).toEqual(["click", "keydown"]);
  });

  test("a chord names itself the same way on both shores: modifiers in order, then the key by its code", () => {
    expect(larKeyChordName({ keyCode: 13 })).toBe("enter");
    expect(larKeyChordName({ keyCode: 78, alt: true, shift: true })).toBe("alt-shift-N");
    expect(larKeyChordName({ keyCode: 83, meta: true, ctrl: true })).toBe("ctrl-meta-S");
    // CONTROL: a code outside the named set names its number, never a guess.
    expect(larKeyChordName({ keyCode: 186 })).toBe("186");
  });
});
