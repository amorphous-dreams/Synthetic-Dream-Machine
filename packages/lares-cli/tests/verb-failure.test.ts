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
import { verbFailure, DaemonUnreachable } from "../src/verb-call.js";
import { LocalWaitExpired } from "../src/local-connector.js";

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
