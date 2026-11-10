/**
 * face-canon-stands-registered — a worn face's daemon canon stands only where its bag stands registered and sealed.
 *
 * The canon's document seals under the face, so a save there waits on a bag the face registers. A worn face that stands
 * unlit registers no daemon bag (`wornFaceWikiBags`), so it stands no canon either: `standingDaemonCanonBag` answers the
 * canon's bag under the one condition the register set reads.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { daemonFaceCanonBag, standingDaemonCanonBag, wornFaceWikiBags } from "../src/index.js";

const F = "123e4567-e89b-42d3-a456-426614174000";

describe("the face daemon canon follows its registration", () => {
  test("an unlit worn face stands no canon; a lit one stands the canon its register set seals", () => {
    expect(standingDaemonCanonBag({ lit: false, faceRelation: F })).toBeNull();
    expect(standingDaemonCanonBag({ lit: true, faceRelation: null })).toBeNull();
    const bag = standingDaemonCanonBag({ lit: true, faceRelation: F });
    expect(bag).toBe(daemonFaceCanonBag(F));
    const bags = wornFaceWikiBags({ lit: true, daemonCanon: bag! });
    expect(bags.registered).toContain(bag);
    expect(bags.sealed).toContain(bag);
  });

  test("the node vessel stands the canon off the registered bag alone", () => {
    const src = readFileSync(new URL("../../lararium-node/src/open-node-vessel.ts", import.meta.url), "utf8");
    expect(src).toMatch(/const canonBagId = standingDaemonCanonBag\(/);
    expect(src).toMatch(/const daemonCanon = canonBagId && wornRelation \? await standFaceDaemonCanon\(/);
  });
});
