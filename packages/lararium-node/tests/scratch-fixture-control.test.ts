/**
 * CONTROL beside scratch-fixture.test.ts: the hand-rolled block the fixture replaces carries no leak check. A test
 * that moves LAR_ROOT and forgets the restore passes, and the env stays moved for whoever runs next. Green by
 * design: it records the hazard the fixture closes.
 */
import { describe, expect, it } from "vitest";

describe("the hand-rolled scratch block", () => {
  it("lets a forgotten restore pass, and the moved value outlives the test", () => {
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = "/a/leaked/root"; // no restore: the old block checks nothing
    expect(process.env["LAR_ROOT"]).toBe("/a/leaked/root");
    // the control puts it back itself, so the hazard stays inside this one test
    if (prior === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = prior;
  });
});
