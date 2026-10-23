import { describe, expect, it, vi } from "vitest";
import { gateInvoke } from "../src/record-port-invoke-gate.js";

describe("invoke gate", () => {
  const req = { provenFace: {}, renderCursor: "r1", affordanceId: "a0", action: "click" };
  const invokeActions = vi.fn(() => "ran");
  const currentRenderCursor = () => "r1";
  it("non-admin-invoke-refused", () => {
    invokeActions.mockClear();
    expect(gateInvoke(req, { authority: () => ({ allowed: false, reason: "no-authority" }), currentRenderCursor, invokeActions })).toEqual({ invoked: false, reason: "no-authority" });
    expect(invokeActions).not.toHaveBeenCalled();
  });
  it("ask-invoke-stale-cursor-refused", () => {
    expect(gateInvoke({ ...req, renderCursor: "old" }, { authority: () => ({ allowed: true }), currentRenderCursor, invokeActions })).toEqual({ invoked: false, reason: "stale-cursor" });
  });
  it("invoke-authority-rechecked-at-run", () => {
    let allowed = true;
    const authority = () => allowed ? { allowed: true as const } : { allowed: false as const, reason: "no-authority" };
    expect(gateInvoke(req, { authority, currentRenderCursor, invokeActions }).invoked).toBe(true);
    allowed = false;
    expect(gateInvoke(req, { authority, currentRenderCursor, invokeActions })).toEqual({ invoked: false, reason: "no-authority" });
  });
  it("control: admin invokes exactly once", () => {
    invokeActions.mockClear();
    expect(gateInvoke(req, { authority: () => ({ allowed: true }), currentRenderCursor, invokeActions })).toEqual({ invoked: true, value: "ran" });
    expect(invokeActions).toHaveBeenCalledTimes(1);
  });
  it("control: default composition refuses no-authority", () => {
    expect(gateInvoke(req, { currentRenderCursor, invokeActions })).toEqual({ invoked: false, reason: "no-authority" });
  });
  it("non-admin never learns freshness", () => {
    const cursor = vi.fn(() => "new");
    expect(gateInvoke({ ...req, renderCursor: "old" }, { authority: () => ({ allowed: false, reason: "no-authority" }), currentRenderCursor: cursor, invokeActions })).toEqual({ invoked: false, reason: "no-authority" });
    expect(cursor).not.toHaveBeenCalled();
  });
  it("bare requestedBy cannot supply a proven face", () => {
    expect(gateInvoke({ requestedBy: "admin", renderCursor: "r1", affordanceId: "a0", action: "click" }, { authority: () => ({ allowed: true }), currentRenderCursor, invokeActions })).toEqual({ invoked: false, reason: "no-proven-face" });
  });
});
