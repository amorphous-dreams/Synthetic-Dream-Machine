/** The pure gate's order is a control; the live socket/session bridge is still owed. */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dial, presenter, world } from "./face-gate-fixture.js";

const red = process.env.LAR_UNBUILT_REDS === "1" ? test : test.skip;

describe("gate verdict and first application frame", () => {
  test("CONTROL: the in-memory gate opens a session only after sending its verdict", async () => {
    const w = await world();
    const p = await presenter(w, "order-control");
    const result = await dial(w, p);
    expect(result.outcome.state).toBe("verified");
    expect(w.attached).toHaveLength(1);
    expect(w.sentAtAttach[0]).toBeGreaterThan(0);
  });

  red("VERDICT_OPENS_BEFORE_FIRST_SYNC_FRAME: an immediate application frame waits for the live session bridge", async () => {
    // No production adapter yet exposes a queue/open boundary to inject the first frame.
    // The missing bridge is the declared red; the container witness must later replace this probe.
    const adapter = readFileSync(new URL("../src/face-dial.ts", import.meta.url), "utf8");
    expect(/queueUntilGateSessionOpen/.test(adapter)).toBe(true);
  });
});
