import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  GATE_FINISH_BYTES, GATE_FRAME, GATE_FRAME_BODY_MAX, GATE_FRAME_DIRECTION, GATE_SUBJECT_MAX_BYTES,
  GATE_VERDICT_BYTES, gateFrame, gateFrameTableRefusal, gateFrameTagReserved, gatePartReader, gateParts,
} from "../src/gate-exchange.js";

describe("the sealed gate frame freeze", () => {
  test("the six assigned tags, directions, bounds, and signature frame lengths keep their literal values", () => {
    expect(GATE_FRAME).toEqual({
      presentationPart: 0x01, presentationEnd: 0x02, finish: 0x03,
      answerPart: 0x11, answerEnd: 0x12, verdict: 0x13,
    });
    expect(GATE_FRAME_DIRECTION).toEqual({
      presentationPart: "dialer", presentationEnd: "dialer", finish: "dialer",
      answerPart: "gate", answerEnd: "gate", verdict: "gate",
    });
    expect(Object.isFrozen(GATE_FRAME_DIRECTION)).toBe(true);
    expect(GATE_FRAME_BODY_MAX).toBe(65518);
    expect(GATE_SUBJECT_MAX_BYTES).toBe(1048576);
    expect(GATE_FINISH_BYTES).toBe(65);
    expect(GATE_VERDICT_BYTES).toBe(65);
  });

  test("all 250 unassigned byte tags stay reserved at the writer and reader doors", () => {
    const assigned = new Set<number>(Object.values(GATE_FRAME));
    const reserved = Array.from({ length: 256 }, (_, tag) => tag).filter((tag) => !assigned.has(tag));
    expect(reserved).toHaveLength(250);
    for (const tag of reserved) {
      expect(gateFrameTagReserved(tag)).toBe(true);
      expect(() => gateFrame(tag, new Uint8Array(0))).toThrow(RangeError);
      expect(() => gateParts(tag, GATE_FRAME.presentationEnd, new Uint8Array(0))).toThrow(RangeError);
      expect(() => gateParts(GATE_FRAME.presentationPart, tag, new Uint8Array(0))).toThrow(RangeError);
      expect(() => gatePartReader(tag, GATE_FRAME.presentationEnd)).toThrow(RangeError);
      expect(() => gatePartReader(GATE_FRAME.presentationPart, tag)).toThrow(RangeError);
      expect(gatePartReader(GATE_FRAME.presentationPart, GATE_FRAME.presentationEnd).push(Uint8Array.of(tag))).toBe("refused");
    }
    for (const tag of assigned) {
      expect(gateFrameTagReserved(tag)).toBe(false);
      expect(gateFrame(tag, new Uint8Array(0))[0]).toBe(tag);
      expect(gateParts(tag, tag, new Uint8Array(0))[0]?.[0]).toBe(tag);
      expect(() => gatePartReader(tag, tag)).not.toThrow();
    }
    expect(gateFrameTagReserved(0x04)).toBe(true);
    expect(gateFrameTagReserved(0x14)).toBe(true);
    for (const malformed of [-1, 256, 1.5, NaN, Infinity]) expect(gateFrameTagReserved(malformed)).toBe(true);
  });

  test("the table checker names each refusal and accepts the assigned table", () => {
    expect(gateFrameTableRefusal(GATE_FRAME)).toBeNull();
    expect(gateFrameTableRefusal({ ...GATE_FRAME, answerEnd: GATE_FRAME.answerPart })).toBe("tag-duplicate");
    expect(gateFrameTableRefusal({ ...GATE_FRAME, answerEnd: 0x20 })).toBe("tag-outside-block");
    expect(gateFrameTableRefusal({ ...GATE_FRAME, answerEnd: 0x04 })).toBe("tag-wrong-direction");
    expect(gateFrameTableRefusal({ ...GATE_FRAME, answerEnd: 1.5 })).toBe("tag-malformed");
  });

  test("the frame section carries no provisional label", () => {
    const source = readFileSync(new URL("../src/gate-exchange.ts", import.meta.url), "utf8");
    const frameSection = source.split("// ── Frames on the sealed channel")[1]?.split("// ── The browser's first flight")[0];
    expect(frameSection).toBeDefined();
    expect(frameSection).not.toMatch(/provisional/i);
  });
});
