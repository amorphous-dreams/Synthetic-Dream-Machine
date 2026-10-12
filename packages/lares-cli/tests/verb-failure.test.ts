/**
 * verb-call — `verbFailure` tells a fault apart by its TYPE, never by sniffing the message (M3).
 *
 * Before this, every `runVerb` catch other than `act.ts`'s folded every thrown fault into
 * `daemon-unreachable`, hinting "start the daemon" to a caller whose daemon stood the whole time
 * and merely answered slower than this process waited (`LocalWaitExpired`). This proves each of
 * the three branches lands on its OWN code — including a known-positive control for the one case
 * `verbFailure` must NOT special-case.
 */
import { describe, test, expect } from "vitest";
import { verbFailure, DaemonUnreachable, refusalCode, refusalHint } from "../src/verb-call.js";
import { LocalWaitExpired } from "../src/local-connector.js";
import { exitFor } from "../src/render.js";

describe("verbFailure — fault told apart by type (M3)", () => {
  test("LocalWaitExpired → outcome-unknown, carrying the request id", () => {
    const err = new LocalWaitExpired("recall", 5_000, "req-abc");
    const f = verbFailure(err);
    expect(f.code).toBe("outcome-unknown");
    expect(f.requestId).toBe("req-abc");
    expect(f.hint).toMatch(/already committed|re-run/);
  });

  test("DaemonUnreachable → daemon-unreachable, with the standing hint", () => {
    const err = new DaemonUnreachable("/tmp/does-not-exist.sock");
    const f = verbFailure(err);
    expect(f.code).toBe("daemon-unreachable");
    expect(f.requestId).toBeUndefined();
    expect(f.hint).toMatch(/vessel stand --foreground/);
  });

  test("CONTROL — any other thrown fault reads verb-error, never daemon-unreachable", () => {
    const f = verbFailure(new Error("the island refused for its own reasons"));
    expect(f.code).toBe("verb-error");
    expect(f.message).toBe("the island refused for its own reasons");
  });

  test("a non-Error throw still resolves to a message, never a crash", () => {
    const f = verbFailure("a bare string throw");
    expect(f.code).toBe("verb-error");
    expect(f.message).toBe("a bare string throw");
  });
});

describe("an interrupted request reads its own code and cure", () => {
  test("★ the channel's `interrupted` reason maps to request-interrupted, with a hint naming --change-id ★", () => {
    expect(refusalCode("interrupted")).toBe("request-interrupted");
    expect(refusalHint("request-interrupted", "cid-1")).toContain("--change-id cid-1");
    expect(refusalHint("request-interrupted", "cid-1")).toContain("may have landed in part");
  });
  test("a reactor's named refusals map to their own codes, and bag-retired names its cure", () => {
    expect(refusalCode("bag-retired")).toBe("bag-retired");
    expect(refusalCode("cap-denied")).toBe("cap-denied");
    expect(refusalCode("crossing-outward")).toBe("crossing-outward");
    expect(refusalHint("bag-retired", undefined)).toContain("lares act CREATE --bag <bag>");
    expect(refusalHint("bag-retired", undefined)).toContain("DROPped");
    expect(exitFor("bag-retired")).toBe(2);
    expect(exitFor("crossing-outward")).toBe(5);
    expect(exitFor("cap-denied")).toBe(5);
  });
  test("the faceless floor's refusal maps to its own code, in the usage family", () => {
    expect(refusalCode("waking-floor")).toBe("waking-floor");
    expect(exitFor("waking-floor")).toBe(2);
  });
  test("CONTROL: an unrecognized reason still falls to verb-error", () => {
    expect(refusalCode("some-future-reason")).toBe("verb-error");
  });
});
