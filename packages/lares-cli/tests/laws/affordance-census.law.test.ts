/**
 * THE CENSUS RATCHET (lar:///ha.ka.ba/kahua/memory/plan/cap-memes-compass §4): flipped doors + legacy doors = the door count,
 * the legacy count only falls, and a door holds one home for its words, never two.
 *
 * A door FLIPS when every affordance it skins holds a carrier: the baked pack then carries its help (`doors.<door>`), and the
 * flipping commit burns its `COMMAND_HELP` entry and every `"<door> <sub>"` key with it. LEGACY_CEILING records the legacy
 * count as it stands; a commit that flips a door lowers it by hand in the same act, and no commit may raise it. At zero,
 * `command-help.ts` leaves and the seam's second branch burns. Seed: `oracle` flipped first. Control: a door planted in both
 * homes reads red, and a census over a pack that flips nothing breaks the ceiling.
 *
 * Law: lar:///ha.ka.ba/lares/docs/pono/cli-test-laws#/the-laws
 */
import { describe, expect, test } from "vitest";
import { COMMAND_HELP } from "../../src/command-help.js";
import { COMMAND_NAMES } from "../../src/bin/lares.js";
import { REBAKE, pack } from "./affordance-harness.js";

/** The legacy count today: 45 doors, `oracle` flipped. Lower it in the commit that flips the next door; never raise it. */
const LEGACY_CEILING = 44;

function census(flippedDoors: readonly string[], help: Readonly<Record<string, unknown>> = COMMAND_HELP) {
  const flipped = COMMAND_NAMES.filter((d) => flippedDoors.includes(d));
  const legacy = COMMAND_NAMES.filter((d) => !flippedDoors.includes(d));
  const twoHomes = flipped.filter((d) => Object.keys(help).some((k) => k === d || k.startsWith(`${d} `)));
  const strays = flippedDoors.filter((d) => !COMMAND_NAMES.includes(d));
  return { flipped, legacy, twoHomes, strays };
}

describe("the census ratchet: flipped + legacy = doors; legacy only falls; one home per door", () => {
  const c = census(Object.keys(pack().doors));

  test("SEED: oracle reads flipped", () => {
    expect(c.flipped, `the pack flips no oracle door; ${REBAKE}`).toContain("oracle");
  });

  test("★ every door counts once, flipped or legacy ★", () => {
    expect(c.flipped.length + c.legacy.length).toBe(COMMAND_NAMES.length);
    expect(c.strays).toEqual([]);
  });

  test("★ the legacy count never rises past its ceiling ★", () => {
    expect(c.legacy.length).toBeLessThanOrEqual(LEGACY_CEILING);
  });

  test("★ a flipped door keeps no legacy help entry ★", () => {
    expect(c.twoHomes).toEqual([]);
  });

  test("CONTROL: a door in both homes, and a pack that flips nothing, each read red", () => {
    expect(census(["oracle"], { ...COMMAND_HELP, oracle: {} }).twoHomes).toEqual(["oracle"]);
    expect(census([]).legacy.length).toBeGreaterThan(LEGACY_CEILING);
  });
});
