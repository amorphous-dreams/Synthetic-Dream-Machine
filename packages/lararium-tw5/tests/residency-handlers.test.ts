/**
 * residency-handlers — the `residency` stats reactor mirrors the stowage's own idleness:
 * each live entry carries `idleFor` in the stowage clock's unit, the answer names that clock's
 * kind, and no instant (`lastTouched`) leaves the stowage for another process to subtract from.
 *
 * Meme: lar:///ha.ka.ba/lararium/api/residency-model
 */

import { describe, test, expect } from "vitest";
import { BagStowage } from "@lararium/mesh";
import { makeResidencyStatsReactor } from "../src/residency-handlers.js";
import type { VerbContext } from "../src/verb-dispatcher.js";

const URL_A = "automerge:residency-handlers-a" as never;

describe("the residency stats reactor", () => {
  test("mirrors clockKind and idleFor and carries no lastTouched", async () => {
    let rolls = 10;
    const residency = new BagStowage({ idle: 30, clock: () => rolls });
    await residency.touch(URL_A);
    residency.setSyncActive(URL_A, true);
    rolls = 14;
    const answer = await makeResidencyStatsReactor({ residency })({}, {} as VerbContext);
    expect(answer["clockKind"]).toBe("realm");
    const wela = answer["wela"] as Array<Record<string, unknown>>;
    expect(wela).toHaveLength(1);
    expect(wela[0]!["idleFor"]).toBe(4);
    expect(wela[0]).not.toHaveProperty("lastTouched");
    expect(answer["hotCap"]).toBe(residency.stats().hotCap);
    expect(wela[0]!["syncActive"]).toBe(true);
    expect(answer["anuCount"]).toBe(0);
    expect(answer["pinned"]).toEqual([]);
  });

  test("a wall-floor stowage names itself so", async () => {
    const residency = new BagStowage({});
    await residency.touch(URL_A);
    const answer = await makeResidencyStatsReactor({ residency })({}, {} as VerbContext);
    expect(answer["clockKind"]).toBe("wall-floor");
  });
});
