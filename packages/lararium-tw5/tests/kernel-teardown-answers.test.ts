/**
 * kernel-teardown-answers — an island's teardown always answers: `teardown:ack` when it came down, a `fault` by name
 * when a step threw (clock-sweep step 3).
 *
 * The vessel's teardown wait ends on the island's answer. A kernel whose teardown threw (an adaptor that will not stop,
 * a behavior's `onHooAnu` that refuses) posted nothing, so the wait ran out its clock. The kernel answers either way.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/sovereign-kernel
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { IslandToVesselMsg } from "@lararium/mesh";
import { answerTeardown } from "../src/sovereign-kernel.js";

const WIKI = "lar:///ha.ka.ba/bags/test/wiki";

describe("an island's teardown answers either way", () => {
  test("RED (clock-sweep): a teardown step that throws answers a fault by name, and no ack", async () => {
    const posted: IslandToVesselMsg[] = [];
    await answerTeardown(async () => { throw new Error("the adaptor would not stop"); }, (m) => posted.push(m), () => WIKI);
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ type: "fault", wikiUri: WIKI });
    expect((posted[0] as { error: string }).error).toMatch(/^teardown-fault: .*the adaptor would not stop/);
  });

  test("CONTROL: a teardown that came down answers one ack", async () => {
    const posted: IslandToVesselMsg[] = [];
    await answerTeardown(async () => {}, (m) => posted.push(m), () => WIKI);
    expect(posted).toEqual([{ type: "teardown:ack" }]);
  });

  test("the kernel's teardown and hooanu both answer through answerTeardown, and the body posts no ack of its own", () => {
    const source = readFileSync(new URL("../src/sovereign-kernel.ts", import.meta.url), "utf8");
    expect(source).toMatch(/raw\.type === "teardown" \|\| raw\.type === "hooanu"\) \{\s*void answerTeardown\(_handleTeardown,/);
    const body = source.slice(source.indexOf("async function _handleTeardown"));
    expect(body).not.toContain("mkTeardownAck()");
  });
});
