/**
 * loaf-buffer.test — THE PAGE'S LONG-ANIMATION-FRAME READING HOLDS A BOUNDED WINDOW.
 *
 * The vessel page observes long animation frames for its whole life. The buffer keeps the newest entries up to a cap
 * and counts every frame it saw, so a long-lived tab reads a stable heap and an honest total.
 */
import { describe, expect, test } from "vitest";
import { createLoafBuffer } from "../src/loaf-buffer.js";

const entry = (n: number) => ({ startTime: n, duration: 60, blockingDuration: 10 });

describe("★ the LoAF buffer caps its window and keeps counting ★", () => {
  test("past the cap the oldest entries leave and the total keeps rising; CONTROL: under the cap nothing leaves", () => {
    const small = createLoafBuffer(3);
    small.push(entry(1)); small.push(entry(2));
    expect(small.entries().map((e) => e.startTime), "CONTROL: under the cap").toEqual([1, 2]);
    expect(small.observed()).toBe(2);
    for (let n = 3; n <= 10; n++) small.push(entry(n));
    expect(small.entries().map((e) => e.startTime)).toEqual([8, 9, 10]);
    expect(small.observed(), "every frame counts").toBe(10);
  });

  test("a cap that bounds nothing refuses by name; CONTROL: a cap of one holds the newest entry", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, 0, -3, 1.5]) expect(() => createLoafBuffer(bad), String(bad)).toThrow(RangeError);
    const one = createLoafBuffer(1);
    one.push(entry(1)); one.push(entry(2));
    expect(one.entries().map((e) => e.startTime)).toEqual([2]);
  });
});
